// Celda de manufactura: 2 CNC, 1 brazo y 2 AGV (autómatas) + la red de Petri de los recursos compartidos.
// Es el único lugar donde cambia el estado del sistema, y siempre por δ (Automata.ejecutar) o por un
// disparo de la red (RedPetri.disparar). Sin motor gráfico ni DOM: se prueba con Node.
//
// Sincronización por producto (GDD, sección 5.1): un evento que tiene transición en la red solo ocurre
// si el autómata lo permite Y la transición está habilitada. Se ejecutan los dos o ninguno.
//   brazo  m desde Reposo           <-> tr_ir        brazo  m desde Mandril_Cerrado <-> tr_volver
//   AGV    v reservar               <-> t1a / t2a    AGV    u iniciar_descarga      <-> t1b / t2b
//   AGV    z fin_descarga           <-> t1c / t2c    (g llegar_estacion no tiene transición)
// Los eventos compartidos c y d ocurren a la vez en la CNC atendida y en el brazo.
// El supervisor CNC || Brazo solo se aplica a la CNC que el brazo atiende (GDD, sección 5.1).

import { Automata } from './automata.js';
import { componer, supervisor, claveDe } from './composicion.js';
import { RedPetri } from './redPetri.js';
import { validarConRegExp, validarConDFA, EXPRESION_TEXTO } from './lenguaje.js';
import { explorar } from './cobertura.js';
import { TIEMPOS, TURNOS, PUNTOS, DURACION_AYUDA, ENFRIAMIENTO_RADAR } from '../config.js';

export const CNCS = ['CNC1', 'CNC2'];
export const AGVS = ['AGV1', 'AGV2'];

// Transiciones de cada AGV en la red (a = reservar, b = iniciar descarga, c = fin de descarga).
const TRANSICIONES_AGV = {
  AGV1: { a: 't1a', b: 't1b', c: 't1c' },
  AGV2: { a: 't2a', b: 't2b', c: 't2c' },
};

export class Celda {
  /**
   * @param {object} opciones
   * @param {object} opciones.modelos cnc, brazo, agv, red, supervisor, reparacion (JSON de src/sed/modelos/).
   * @param {import('./reloj.js').Reloj} opciones.reloj Calendario de eventos.
   * @param {{siguiente:()=>number, entre:(a:number,b:number)=>number}} opciones.aleatorio Generador con semilla.
   * @param {object} [opciones.turno] Parámetros del turno (por defecto el turno 1 del GDD).
   * @param {object} [opciones.tiempos] Duraciones en s de simulación (por defecto las del GDD).
   * @param {number} [opciones.puntajeInicial] Puntaje acumulado de los turnos anteriores.
   */
  constructor({ modelos, reloj, aleatorio, turno = TURNOS[0], tiempos = TIEMPOS, puntajeInicial = 0 }) {
    this.modelos = modelos;
    this.reloj = reloj;
    this.aleatorio = aleatorio;
    this.turno = turno;
    this.tiempos = tiempos;

    // Una instancia de Automata por máquina.
    this.automatas = {
      CNC1: new Automata(modelos.cnc),
      CNC2: new Automata(modelos.cnc),
      BRAZO: new Automata(modelos.brazo),
      AGV1: new Automata(modelos.agv),
      AGV2: new Automata(modelos.agv),
    };
    this.red = new RedPetri(modelos.red);

    // Supervisor CNC || Brazo (se consulta con el estado de la CNC atendida y del brazo).
    this.composicion = componer(modelos.cnc, modelos.brazo);
    // Una instancia del supervisor por CNC: cada una se consulta solo cuando el brazo atiende a esa CNC.
    this.razonSupervisor = modelos.supervisor.razon;
    this.supervisores = {};
    for (const cnc of CNCS) {
      const s = supervisor(this.composicion, modelos.supervisor.prohibidos, { razon: this.razonSupervisor });
      s.bloqueos = 0; // intentos bloqueados en esta CNC
      this.supervisores[cnc] = s;
    }

    this.atendida = null; // CNC que el brazo atiende ('CNC1', 'CNC2' o null con el brazo en reposo)
    this.pedidos = []; // pedidos de AGV pendientes: {id, t, vencido}
    this.estadisticas = {
      piezas: 0, ciclosAGV: 0, fallas: 0, reparaciones: 0, pedidosVencidos: 0, bloqueos: 0,
      radarVerdes: 0, // veces que el radar volvió de amarillo a verde (deadlocks evitados)
      deadlocks: 0,
    };
    this.terminado = false; // el turno ya terminó (meta cumplida o se acabó el tiempo)
    this.resultado = null; // 'victoria' | 'tiempo' cuando terminado
    this.deadlock = false;
    this.puntajeInicial = puntajeInicial;
    this.puntaje = puntajeInicial; // puntos acumulados (GDD, sección 8)
    this.ayudaHasta = 0; // tiempo de simulación hasta el que se muestra la expresión regular
    this._fresado = { CNC1: null, CNC2: null }; // evento del reloj pendiente de cada fresado
    this.bitacora = []; // todo lo que ocurrió: {t, ...evento}
    this._escuchas = [];
    this._siguientePedido = 0;

    // Radar del árbol de cobertura (GDD, sección 9): se recalcula tras cada disparo con explorar(red, M, 1).
    this.radar = { nivel: 'verde', muertosAlcanzables: [] };
    this.historialMarcados = []; // últimos marcados: {M, nivel, transicion, t}
    this._ultimoPremioRadar = -Infinity;
    this.ultimoVerde = null; // instantánea del último marcado verde (reintento)
    this.secuenciaDeadlock = []; // disparos desde el último verde hasta el marcado muerto
    this.controlador = false; // Controlador de celda (red corregida con Celda_libre)
    this._nivelAplicar = 0;
    this._huboDisparo = false;
  }

  // ---- Observadores ----

  /** Registra una función que recibe cada cambio. Devuelve la función para darse de baja. */
  alCambiar(funcion) {
    this._escuchas.push(funcion);
    return () => {
      this._escuchas = this._escuchas.filter((f) => f !== funcion);
    };
  }

  _emitir(evento) {
    const completo = { t: this.reloj.ahora, ...evento };
    this.bitacora.push(completo);
    for (const f of this._escuchas) f(completo);
  }

  // ---- Arranque ----

  /** Programa los pedidos de AGV en el reloj (t = n × intervalo, t < duración del turno). */
  arrancar() {
    this._programarPedido(1);
    this._programarFinTurno();
    this._recalcularRadar(null);
    this.ultimoVerde = this.capturar();
  }

  _programarPedido(n) {
    const t = n * this.turno.intervaloPedidos;
    if (t >= this.turno.duracion) return;
    this.reloj.programar(t, () => {
      const pedido = { id: ++this._siguientePedido, t: this.reloj.ahora, vencido: false };
      this.pedidos.push(pedido);
      this._emitir({ tipo: 'pedido', pedido });
      this._programarVencimiento(pedido, this.reloj.ahora + this.tiempos.pedidoVence);
      this._programarPedido(n + 1);
    });
  }

  /** Cada pedido penaliza una sola vez, al cumplir 30 s sin atender; sigue pendiente aunque haya vencido. */
  _programarVencimiento(pedido, t) {
    this.reloj.programar(t, () => {
      if (this.pedidos.includes(pedido) && !pedido.vencido) {
        pedido.vencido = true;
        this.estadisticas.pedidosVencidos++;
        this.sumarPuntos(PUNTOS.pedidoVencido, 'pedido vencido');
        this._emitir({ tipo: 'pedidoVencido', pedido });
      }
    });
  }

  // ---- Puntaje y ayuda ----

  /** Suma (o resta) puntos y avisa a quien escuche. */
  sumarPuntos(puntos, motivo, maquina = null) {
    this.puntaje += puntos;
    this._emitir({ tipo: 'puntos', puntos, motivo, maquina, total: this.puntaje });
  }

  /** "Pedir ayuda": muestra la expresión regular durante 5 s y resta 20 puntos cada vez. */
  pedirAyuda(maquina = null) {
    this.ayudaHasta = this.reloj.ahora + DURACION_AYUDA;
    this.sumarPuntos(PUNTOS.ayuda, 'ayuda de reparación', maquina);
    this._emitir({ tipo: 'ayuda', maquina, hasta: this.ayudaHasta });
    return EXPRESION_TEXTO;
  }

  /**
   * Solo para pruebas en desarrollo: fuerza falla_husillo (por δ) en una CNC que esté fresando.
   * Cancela el fin_fresado pendiente. Devuelve la CNC afectada o null.
   */
  forzarFalla() {
    const cnc = CNCS.find((id) => this.automatas[id].estado === 'Fresando');
    if (!cnc) return null;
    if (this._fresado[cnc] !== null) this.reloj.cancelar(this._fresado[cnc]);
    this._interno([[cnc, 'falla_husillo']], undefined, () => { this.estadisticas.fallas++; });
    return cnc;
  }

  // ---- Consultas ----

  /** Estado actual de una máquina. */
  estado(maquina) {
    return this.automatas[maquina].estado;
  }

  /** Eventos que el supervisor deshabilita ahora para la CNC dada (solo si el brazo la atiende). */
  deshabilitadosPorSupervisor(cnc) {
    if (this.atendida !== cnc) return [];
    return this.supervisores[cnc].deshabilitadosEn(this._claveSupervisor(cnc));
  }

  /**
   * Qué fichas faltan para un evento controlable que dispara una transición (AND-join), por ejemplo
   * ['Robot_libre']. Vacío si no hay transición o si no falta ninguna.
   */
  faltaPara(maquina, evento, opciones = {}) {
    const plan = this._plan(maquina, evento, opciones);
    return plan.transicion ? this.red.faltantes(this.red.M, plan.transicion) : [];
  }

  /** Qué fichas faltan para que una transición automática (t1b, t2b…) se dispare ahora. */
  faltantes(transicion) {
    return this.red.faltantes(this.red.M, transicion);
  }

  /** Estado compuesto (CNC, Brazo) de la CNC dada, por ejemplo ['Cargado', 'Mandril_Abierto']. */
  estadoCompuesto(cnc) {
    return [this.automatas[cnc].estado, this.automatas.BRAZO.estado];
  }

  _claveSupervisor(cnc) {
    return claveDe([this.automatas[cnc].estado, this.automatas.BRAZO.estado]);
  }

  // ---- Petición de eventos controlables (jugador o piloto automático) ----

  /**
   * Comprueba si un evento controlable puede ocurrir ahora, sin ejecutarlo.
   * @returns {null|'indefinido'|'recurso'|'supervisor'|'palabra_invalida'|'no_controlable'}
   *   null = se puede. 'indefinido' = δ no está definida en algún autómata. 'recurso' = la transición
   *   de la red no está habilitada. 'supervisor' = lo inhibe el supervisor CNC || Brazo.
   */
  evaluar(maquina, evento, opciones = {}) {
    if (this.terminado) return 'turno_terminado';
    const plan = this._plan(maquina, evento, opciones);
    return plan.error ?? this._comprobar(plan);
  }

  /**
   * Ejecuta un evento controlable por δ y, si corresponde, por el disparo de su transición.
   * @returns {{ok:boolean, motivo?:string}}
   */
  solicitar(maquina, evento, opciones = {}) {
    if (this.terminado) return { ok: false, motivo: 'turno_terminado' };
    const plan = this._plan(maquina, evento, opciones);
    const motivo = plan.error ?? this._comprobar(plan);
    if (motivo) {
      let cnc = null;
      if (motivo === 'supervisor') {
        // Insistir en un evento que el supervisor deshabilita: no se ejecuta y cuesta 15 puntos.
        // (El bloqueo por Celda_libre sería 'recurso' y no entra aquí.)
        cnc = plan.supervisada;
        this.estadisticas.bloqueos++;
        this.supervisores[cnc].bloqueos++;
        this.sumarPuntos(PUNTOS.intentoBloqueado, 'intento bloqueado por el supervisor', cnc);
      }
      if (motivo === 'palabra_invalida') {
        this.sumarPuntos(PUNTOS.palabraInvalida, 'palabra de reparación inválida', maquina);
        this._emitir({ tipo: 'reparacion', maquina, valida: false });
      }
      this._emitir({ tipo: 'rechazo', maquina, evento, motivo, cnc });
      return { ok: false, motivo };
    }
    this._aplicar(plan);
    return { ok: true };
  }

  /** Arma el plan de un evento controlable: qué autómatas avanzan, qué transición se dispara y qué sigue. */
  _plan(maquina, evento, opciones) {
    const brazo = this.automatas.BRAZO;
    if (CNCS.includes(maquina)) {
      const cnc = maquina;
      switch (evento) {
        case 'cargar':
          // Evento compartido: la CNC y el brazo lo ejecutan a la vez, y el brazo debe atender a esa CNC.
          return this._compartido(cnc, 'cargar');
        case 'descargar':
          return this._compartido(cnc, 'descargar', () => {
            this.estadisticas.piezas++;
            this.sumarPuntos(PUNTOS.pieza, 'pieza descargada', cnc);
            this._volverBrazo();
            if (this.estadisticas.piezas >= this.turno.meta) this._terminarTurno('victoria');
          });
        case 'iniciar_fresado':
          return {
            pasos: [[cnc, 'iniciar_fresado']],
            supervisada: cnc,
            despues: () => this._programarFresado(cnc),
          };
        case 'reset': {
          // La palabra w se valida con la RegExp anclada y con el DFA de JFLAP: deben coincidir.
          const palabra = opciones.palabra ?? '';
          const porRegExp = validarConRegExp(palabra);
          const porDFA = validarConDFA(this.modelos.reparacion, palabra);
          if (porRegExp !== porDFA) throw new Error(`La RegExp y el DFA no coinciden con "${palabra}"`);
          if (!porDFA) return { error: 'palabra_invalida' };
          return {
            pasos: [[cnc, 'reset']],
            despues: () => {
              this.estadisticas.reparaciones++;
              this.sumarPuntos(PUNTOS.reparacion, 'reparación válida', cnc);
              this._emitir({ tipo: 'reparacion', maquina: cnc, valida: true });
            },
          };
        }
        default:
          return { error: 'no_controlable' };
      }
    }
    if (maquina === 'BRAZO') {
      switch (evento) {
        case 'mover': {
          // Solo la ida (tr_ir). La vuelta (tr_volver) es automática.
          if (brazo.estado !== 'Reposo') return { error: 'indefinido' };
          if (!CNCS.includes(opciones.objetivo)) return { error: 'indefinido' };
          return {
            pasos: [['BRAZO', 'mover']],
            transicion: 'tr_ir',
            despues: () => {
              this.atendida = opciones.objetivo;
              this.reloj.programarEn(this.tiempos.brazoLlegar, () => this._interno([['BRAZO', 'llegar']]));
            },
          };
        }
        case 'volver':
          // Vuelta manual a reposo (tr_volver): el mismo evento m, desde Mandril_Cerrado.
          if (brazo.estado !== 'Mandril_Cerrado') return { error: 'indefinido' };
          return { pasos: [['BRAZO', 'mover']], transicion: 'tr_volver', despues: () => { this.atendida = null; } };
        case 'abrir_mandril':
          return { pasos: [['BRAZO', 'abrir_mandril']], supervisada: this.atendida };
        case 'cerrar_mandril':
          return { pasos: [['BRAZO', 'cerrar_mandril']], supervisada: this.atendida, despues: () => this._volverBrazo() };
        default:
          return { error: 'no_controlable' };
      }
    }
    if (AGVS.includes(maquina)) {
      if (evento !== 'reservar') return { error: 'no_controlable' };
      const t = TRANSICIONES_AGV[maquina];
      return {
        pasos: [[maquina, 'reservar']],
        transicion: t.a,
        despues: () => this.reloj.programarEn(this.tiempos.agvViaje, () => this._interno([[maquina, 'llegar_estacion']])),
      };
    }
    return { error: 'indefinido' };
  }

  _compartido(cnc, evento, despues) {
    if (this.atendida !== cnc) return { error: 'indefinido' }; // el brazo no está atendiendo a esa CNC
    return { pasos: [[cnc, evento], ['BRAZO', evento]], supervisada: cnc, despues };
  }

  /** ¿El plan puede ejecutarse ahora? Devuelve el motivo del rechazo o null. */
  _comprobar(plan) {
    for (const [maquina, evento] of plan.pasos) {
      if (!this.automatas[maquina].puede(evento)) return 'indefinido';
    }
    if (plan.transicion && !this.red.habilitada(plan.transicion)) {
      // Con el Controlador de celda activo, la ficha que falta puede ser Celda_libre (otro AGV está en la celda).
      return this.red.faltantes(this.red.M, plan.transicion).includes('Celda_libre') ? 'celda' : 'recurso';
    }
    if (plan.supervisada && this.atendida === plan.supervisada) {
      const clave = this._claveSupervisor(plan.supervisada);
      for (const [, evento] of plan.pasos) {
        if (!this.supervisores[plan.supervisada].permite(clave, evento)) return 'supervisor';
      }
    }
    return null;
  }

  // ---- Ejecución ----

  /** Ejecuta un plan ya comprobado: δ de cada autómata, disparo de la transición y luego lo que sigue. */
  _aplicar(plan) {
    this._nivelAplicar++;
    try {
      this._aplicarPlan(plan);
    } finally {
      this._nivelAplicar--;
    }
    // Al terminar la cadena de eventos: si el marcado es verde, se guarda para el reintento.
    if (this._nivelAplicar === 0 && this._huboDisparo) {
      this._huboDisparo = false;
      if (this.radar.nivel === 'verde' && !this.deadlock) this.ultimoVerde = this.capturar();
    }
  }

  _aplicarPlan(plan) {
    const cambios = [];
    for (const [maquina, evento] of plan.pasos) {
      const a = this.automatas[maquina];
      const de = a.estado;
      a.ejecutar(evento); // lanza un error si δ no está definida
      cambios.push({ tipo: 'automata', maquina, evento, de, a: a.estado });
    }
    let disparo = null;
    if (plan.transicion) {
      const antes = this.red.marcado();
      this.red.disparar(plan.transicion); // lanza un error si no está habilitada
      disparo = { tipo: 'disparo', transicion: plan.transicion, antes, despues: this.red.marcado() };
    }
    for (const c of cambios) this._emitir(c);
    if (disparo) {
      this._emitir(disparo);
      this._huboDisparo = true;
      this._recalcularRadar(plan.transicion);
    }
    plan.despues?.();
    this._automaticos();
    if (!this.deadlock && this.red.esMuerto()) this._declararDeadlock();
  }

  // ---- Fin del turno ----

  /** El turno dura `duracion` s de simulación (GDD, sección 7): al llegar a ese tiempo sin la meta, se pierde. */
  _programarFinTurno() {
    this.reloj.programar(this.turno.duracion, () => this._terminarTurno('tiempo'));
  }

  /**
   * Termina el turno: desactiva el Controlador, detiene el reloj y avisa con el resumen.
   * @param {'victoria'|'tiempo'} resultado Meta cumplida antes de que se acabe el tiempo, o se acabó el tiempo.
   */
  _terminarTurno(resultado) {
    if (this.terminado) return;
    this.terminado = true;
    this.resultado = resultado;
    this.desactivarControlador();
    this.reloj.pausar();
    this._emitir({ tipo: 'finTurno', resultado, resumen: this.resumen() });
  }

  /** Resumen del turno para la pantalla de Resultados. */
  resumen() {
    const e = this.estadisticas;
    return {
      resultado: this.resultado,
      meta: this.turno.meta,
      piezas: e.piezas,
      fallasReparadas: e.reparaciones,
      fallas: e.fallas,
      intentosBloqueados: e.bloqueos,
      pedidosVencidos: e.pedidosVencidos,
      deadlocksEvitados: e.radarVerdes,
      deadlocks: e.deadlocks,
      ciclosAGV: e.ciclosAGV,
      puntajeTurno: this.puntaje - this.puntajeInicial,
      puntaje: this.puntaje,
      tiempo: Math.min(this.reloj.ahora, this.turno.duracion),
    };
  }

  // ---- Radar, deadlock, Controlador de celda y reintento ----

  /** Recalcula el radar con explorar(red, M, 1) y da +25 al volver de amarillo a verde (enfriamiento de 20 s). */
  _recalcularRadar(transicion) {
    const anterior = this.radar.nivel;
    const r = explorar(this.red, this.red.M, 1);
    this.radar = { nivel: r.nivel, muertosAlcanzables: r.muertosAlcanzables };
    this.historialMarcados.push({ M: this.red.marcado(), nivel: r.nivel, transicion, t: this.reloj.ahora });
    if (this.historialMarcados.length > 12) this.historialMarcados.shift();
    if (anterior === 'amarillo' && r.nivel === 'verde') this.estadisticas.radarVerdes++;
    if (anterior === 'amarillo' && r.nivel === 'verde' && this.reloj.ahora - this._ultimoPremioRadar >= ENFRIAMIENTO_RADAR) {
      this._ultimoPremioRadar = this.reloj.ahora;
      this.sumarPuntos(PUNTOS.radarVerde, 'radar de amarillo a verde');
    }
    this._emitir({ tipo: 'radar', nivel: r.nivel, anterior, marcado: this.red.marcado() });
  }

  /** Marcado muerto: la simulación se detiene y se restan 200 puntos (una sola vez). */
  _declararDeadlock() {
    this.deadlock = true;
    this.estadisticas.deadlocks++;
    const desde = this.ultimoVerde ? this.ultimoVerde.historial.length : 0;
    this.secuenciaDeadlock = this.red.historial.slice(desde);
    this.sumarPuntos(PUNTOS.deadlock, 'deadlock');
    this.reloj.pausar();
    this._emitir({ tipo: 'deadlock', marcado: this.red.marcado(), secuencia: [...this.secuenciaDeadlock] });
  }

  /** Instantánea del sistema (para volver al último marcado verde). */
  capturar() {
    return {
      t: this.reloj.ahora,
      M: this.red.marcado(),
      historial: [...this.red.historial],
      estados: Object.fromEntries(Object.entries(this.automatas).map(([id, a]) => [id, a.estado])),
      atendida: this.atendida,
      pedidos: this.pedidos.map((p) => ({ ...p })),
      siguientePedido: this._siguientePedido,
      rng: this.aleatorio.obtenerEstado(),
    };
  }

  /** Ajusta un marcado a la red actual (con o sin Celda_libre). */
  _ajustarMarcado(M) {
    const n = this.red.lugares.length;
    if (M.length === n) return [...M];
    if (n === M.length + 1) return [...M, this._celdaLibreFicha(M)];
    return M.slice(0, n);
  }

  /** Fichas de Celda_libre que respetan el invariante IP5: 1 − (p5 + p6 + p7 + p8). */
  _celdaLibreFicha(M) {
    const idx = ['AGV1_con_mesa', 'AGV2_con_robot', 'AGV1_trabajando', 'AGV2_trabajando'].map((n) => this.red.indiceP(n));
    return 1 - idx.reduce((s, j) => s + M[j], 0);
  }

  /**
   * Reintentar desde el último marcado verde: restaura el marcado, los autómatas, los pedidos y el
   * generador de ese instante, y reprograma los eventos que estaban en curso (con su duración completa).
   * El puntaje se conserva (incluido el −200).
   */
  reintentarDesdeVerde() {
    const snap = this.ultimoVerde;
    if (!snap) return false;
    this.reloj.reiniciar(); // vacía el calendario y reanuda
    this.reloj.ahora = snap.t;
    this._fresado = { CNC1: null, CNC2: null };
    this.aleatorio.restaurarEstado(snap.rng);
    for (const [id, estado] of Object.entries(snap.estados)) this.automatas[id].restaurar(estado);
    this.atendida = snap.atendida;
    this.pedidos = snap.pedidos.map((p) => ({ ...p }));
    this._siguientePedido = snap.siguientePedido;
    this.red.M = this._ajustarMarcado(snap.M);
    this.red.historial = [...snap.historial];
    this.deadlock = false;
    this.secuenciaDeadlock = [];
    // Eventos no controlables que estaban en curso.
    if (this.estado('BRAZO') === 'Moviendo') {
      this.reloj.programarEn(this.tiempos.brazoLlegar, () => this._interno([['BRAZO', 'llegar']]));
    }
    for (const agv of AGVS) {
      const q = this.estado(agv);
      if (q === 'Viajando') this.reloj.programarEn(this.tiempos.agvViaje, () => this._interno([[agv, 'llegar_estacion']]));
      if (q === 'Descargando') this.reloj.programarEn(this.tiempos.agvDescarga, () => this._finDescarga(agv));
    }
    for (const cnc of CNCS) if (this.estado(cnc) === 'Fresando') this._programarFresado(cnc);
    this._programarFinTurno();
    this._programarPedido(Math.floor(snap.t / this.turno.intervaloPedidos) + 1);
    for (const p of this.pedidos) if (!p.vencido) this._programarVencimiento(p, Math.max(snap.t, p.t + this.tiempos.pedidoVence));
    this._emitir({ tipo: 'restaurado', t: snap.t });
    this._recalcularRadar(null);
    this._automaticos();
    return true;
  }

  /**
   * Comprar el Controlador de celda (−150): cambia a la red corregida conservando el marcado y agrega
   * Celda_libre con 1 − (p5 + p6 + p7 + p8) fichas. No se puede comprar en el marcado muerto.
   * @returns {{ok:boolean, motivo?:string}}
   */
  comprarControlador() {
    if (this.deadlock || this.red.esMuerto()) return { ok: false, motivo: 'deadlock' };
    if (this.controlador) return { ok: false, motivo: 'ya_activo' };
    if (!this.modelos.redCorregida) return { ok: false, motivo: 'sin_modelo' };
    const M = this.red.marcado();
    const nueva = new RedPetri(this.modelos.redCorregida);
    nueva.reiniciar([...M, this._celdaLibreFicha(M)]);
    nueva.historial = [...this.red.historial];
    this.red = nueva;
    this.controlador = true;
    this.sumarPuntos(PUNTOS.controlador, 'Controlador de celda');
    this._emitir({ tipo: 'controlador', activo: true });
    this._recalcularRadar(null);
    return { ok: true };
  }

  /** Al terminar el turno el Controlador se desactiva y la red vuelve a la original (conserva el marcado). */
  desactivarControlador() {
    if (!this.controlador) return false;
    const M = this.red.marcado().slice(0, this.modelos.red.lugares.length);
    const original = new RedPetri(this.modelos.red);
    original.reiniciar(M);
    original.historial = [...this.red.historial];
    this.red = original;
    this.controlador = false;
    this._emitir({ tipo: 'controlador', activo: false });
    this._recalcularRadar(null);
    return true;
  }

  /** Evento no controlable que dispara el reloj: se ejecuta sin consultar al supervisor. */
  _interno(pasos, transicion, despues) {
    const plan = { pasos, transicion, despues };
    const motivo = this._comprobar(plan);
    if (motivo) throw new Error(`Evento no controlable imposible (${pasos.map((p) => p.join('.'))}): ${motivo}`);
    this._aplicar(plan);
  }

  /** Transiciones automáticas de la red: el AGV empieza a descargar en cuanto la mesa y el brazo están libres. */
  _automaticos() {
    for (const agv of AGVS) {
      if (this.automatas[agv].estado !== 'Esperando') continue;
      const t = TRANSICIONES_AGV[agv];
      const plan = {
        pasos: [[agv, 'iniciar_descarga']],
        transicion: t.b,
        despues: () => this.reloj.programarEn(this.tiempos.agvDescarga, () => this._finDescarga(agv)),
      };
      if (!this._comprobar(plan)) {
        this._aplicar(plan);
        return; // _aplicar vuelve a llamar a _automaticos()
      }
    }
  }

  _finDescarga(agv) {
    this._interno([[agv, 'fin_descarga']], TRANSICIONES_AGV[agv].c, () => {
      this.estadisticas.ciclosAGV++;
      this.sumarPuntos(PUNTOS.cicloAGV, 'ciclo de AGV', agv);
      const atendido = this.pedidos.shift(); // atiende el pedido pendiente más antiguo, si hay
      if (atendido) this._emitir({ tipo: 'pedidoAtendido', pedido: atendido, agv });
    });
  }

  /** Vuelta automática del brazo (GDD 17.3 y 17.4): tr_volver, 0 s, tras e o d. */
  _volverBrazo() {
    this._interno([['BRAZO', 'mover']], 'tr_volver', () => {
      this.atendida = null;
    });
  }

  /** Decide con el generador con semilla si el fresado falla, y programa fin_fresado o falla_husillo. */
  _programarFresado(cnc) {
    const falla = this.aleatorio.siguiente() < this.turno.probFalla;
    if (falla) {
      const dt = this.aleatorio.entre(this.tiempos.fallaMin, this.tiempos.fallaMax);
      this._fresado[cnc] = this.reloj.programarEn(dt, () => this._interno([[cnc, 'falla_husillo']], undefined, () => { this.estadisticas.fallas++; }));
    } else {
      this._fresado[cnc] = this.reloj.programarEn(this.tiempos.fresado, () => this._interno([[cnc, 'fin_fresado']]));
    }
  }
}
