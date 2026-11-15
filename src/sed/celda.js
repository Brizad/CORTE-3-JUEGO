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
import { ValidadorReparacion } from './lenguaje.js';
import { TIEMPOS, TURNOS } from '../config.js';

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
   */
  constructor({ modelos, reloj, aleatorio, turno = TURNOS[0], tiempos = TIEMPOS }) {
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
    this.supervisor = supervisor(this.composicion, modelos.supervisor.prohibidos, { razon: modelos.supervisor.razon });
    this.validadores = { CNC1: new ValidadorReparacion(modelos.reparacion), CNC2: new ValidadorReparacion(modelos.reparacion) };

    this.atendida = null; // CNC que el brazo atiende ('CNC1', 'CNC2' o null con el brazo en reposo)
    this.pedidos = []; // pedidos de AGV pendientes: {id, t, vencido}
    this.estadisticas = { piezas: 0, ciclosAGV: 0, fallas: 0, reparaciones: 0, pedidosVencidos: 0, bloqueos: 0 };
    this.deadlock = false;
    this.bitacora = []; // todo lo que ocurrió: {t, ...evento}
    this._escuchas = [];
    this._siguientePedido = 0;
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
  }

  _programarPedido(n) {
    const t = n * this.turno.intervaloPedidos;
    if (t >= this.turno.duracion) return;
    this.reloj.programar(t, () => {
      const pedido = { id: ++this._siguientePedido, t: this.reloj.ahora, vencido: false };
      this.pedidos.push(pedido);
      this._emitir({ tipo: 'pedido', pedido });
      this.reloj.programarEn(this.tiempos.pedidoVence, () => {
        // Cada pedido penaliza una sola vez; sigue pendiente aunque haya vencido.
        if (this.pedidos.includes(pedido)) {
          pedido.vencido = true;
          this.estadisticas.pedidosVencidos++;
          this._emitir({ tipo: 'pedidoVencido', pedido });
        }
      });
      this._programarPedido(n + 1);
    });
  }

  // ---- Consultas ----

  /** Estado actual de una máquina. */
  estado(maquina) {
    return this.automatas[maquina].estado;
  }

  /** Eventos que el supervisor deshabilita ahora para la CNC dada (solo si el brazo la atiende). */
  deshabilitadosPorSupervisor(cnc) {
    if (this.atendida !== cnc) return [];
    return this.supervisor.deshabilitadosEn(this._claveSupervisor(cnc));
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
    const plan = this._plan(maquina, evento, opciones);
    return plan.error ?? this._comprobar(plan);
  }

  /**
   * Ejecuta un evento controlable por δ y, si corresponde, por el disparo de su transición.
   * @returns {{ok:boolean, motivo?:string}}
   */
  solicitar(maquina, evento, opciones = {}) {
    const plan = this._plan(maquina, evento, opciones);
    const motivo = plan.error ?? this._comprobar(plan);
    if (motivo) {
      if (motivo === 'supervisor') this.estadisticas.bloqueos++;
      this._emitir({ tipo: 'rechazo', maquina, evento, motivo });
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
            this._volverBrazo();
          });
        case 'iniciar_fresado':
          return {
            pasos: [[cnc, 'iniciar_fresado']],
            supervisada: cnc,
            despues: () => this._programarFresado(cnc),
          };
        case 'reset': {
          const v = this.validadores[cnc];
          v.reiniciar();
          for (const simbolo of opciones.palabra ?? '') v.avanzar(simbolo);
          if (!v.esValida()) return { error: 'palabra_invalida' };
          return { pasos: [[cnc, 'reset']], despues: () => { this.estadisticas.reparaciones++; } };
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
    if (plan.transicion && !this.red.habilitada(plan.transicion)) return 'recurso';
    if (plan.supervisada && this.atendida === plan.supervisada) {
      const clave = this._claveSupervisor(plan.supervisada);
      for (const [, evento] of plan.pasos) {
        if (!this.supervisor.permite(clave, evento)) return 'supervisor';
      }
    }
    return null;
  }

  // ---- Ejecución ----

  /** Ejecuta un plan ya comprobado: δ de cada autómata, disparo de la transición y luego lo que sigue. */
  _aplicar(plan) {
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
    if (disparo) this._emitir(disparo);
    plan.despues?.();
    this._automaticos();
    if (!this.deadlock && this.red.esMuerto()) {
      this.deadlock = true;
      this._emitir({ tipo: 'deadlock', marcado: this.red.marcado() });
    }
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
      this.reloj.programarEn(dt, () => this._interno([[cnc, 'falla_husillo']], undefined, () => { this.estadisticas.fallas++; }));
    } else {
      this.reloj.programarEn(this.tiempos.fresado, () => this._interno([[cnc, 'fin_fresado']]));
    }
  }
}
