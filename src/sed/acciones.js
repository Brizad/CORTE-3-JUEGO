// Acciones de juego (docs/GDD.md, sección 18.19): verbos como "Cargar bloque" o "Sacar pieza" que el jugador pulsa en la pestaña
// «Acciones» del HUD de una máquina. Cada verbo NO cambia nada por su cuenta: encadena, uno por uno y con una pausa corta, los
// eventos reales del autómata (m, l, a, c, e, m...) pidiéndolos a la Celda (δ, supervisor y red de Petri). Todos quedan en la bitácora.
// Sin motor gráfico ni DOM: se prueba con Node.

import { CNCS, AGVS } from './celda.js';
import { TIEMPOS } from '../config.js';

const PAUSA_ENTRE_PASOS = 0.5; // s de simulación entre un evento y el siguiente (para que se vea cada uno)

export class Acciones {
  /**
   * @param {import('./celda.js').Celda} celda
   * @param {{pausa?:number}} [opciones] pausa: s de simulación entre pasos.
   */
  constructor(celda, { pausa = PAUSA_ENTRE_PASOS } = {}) {
    this.celda = celda;
    this.reloj = celda.reloj;
    this.pausa = pausa;
    this.activa = null; // {cnc, tipo: 'cargar'|'sacar'} mientras el brazo encadena los eventos
    this._proximo = 0;
    this.paso = ''; // texto del último evento de la secuencia (para mostrarlo)
    // Historial de eventos de los autómatas con la CNC que el brazo atendía: así el panel de una CNC muestra también
    // los eventos del brazo que fueron para ella (m, l, a, e), no solo los suyos (c, i, f, d).
    this.historial = []; // {t, maquina, evento, de, a, cnc}
    this._ida = null; // la ida del brazo (m desde Reposo) se anota antes de saber a qué CNC va
    this._baja = celda.alCambiar((e) => {
      if (e.tipo === 'restaurado' || e.tipo === 'finTurno' || e.tipo === 'deadlock') this.cancelar();
      if (this._ida && celda.atendida) {
        this._ida.cnc = celda.atendida;
        this._ida = null;
      }
      if (e.tipo !== 'automata') return;
      const fila = { t: e.t, maquina: e.maquina, evento: e.evento, de: e.de, a: e.a, cnc: e.maquina === 'BRAZO' ? celda.atendida : null };
      if (e.maquina === 'BRAZO' && e.evento === 'mover' && e.de === 'Reposo') this._ida = fila;
      this.historial.push(fila);
    });
  }

  destruir() {
    this._baja();
  }

  cancelar() {
    this.activa = null;
  }

  /** Últimos `n` eventos que tocan a una máquina: los suyos y, si es una CNC, los del brazo mientras la atendía. */
  eventosDe(maquina, n = 10) {
    return this.historial.filter((h) => h.maquina === maquina || h.cnc === maquina).slice(-n);
  }

  /** Acción de un AGV: despachar (v · reservar) o, si no puede salir, qué está haciendo o qué le falta. */
  describirAGV(agv) {
    const c = this.celda;
    const q = c.estado(agv);
    const n = agv.slice(3);
    if (c.terminado || c.deadlock) return { tipo: 'ninguna', etiqueta: 'Turno detenido', detalle: '', habilitada: false };
    const motivo = c.evaluar(agv, 'reservar');
    if (motivo === null) return { tipo: 'despachar', etiqueta: `Despachar AGV ${n}`, detalle: 'Evento v · reservar: viaja 4 s a su estación y descarga 5 s con la mesa y el robot.', habilitada: true };
    if (q === 'Viajando') return { tipo: 'despachar', etiqueta: 'En camino…', detalle: 'Viaja a su estación (4 s).', habilitada: false };
    if (q === 'Esperando') return { tipo: 'despachar', etiqueta: 'Esperando…', detalle: 'Necesita la mesa y el robot al mismo tiempo para descargar.', habilitada: false };
    if (q === 'Descargando') return { tipo: 'despachar', etiqueta: 'Descargando…', detalle: 'Descarga el material (5 s) y vuelve a su base.', habilitada: false };
    const falta = c.faltaPara(agv, 'reservar').join(', ');
    return { tipo: 'despachar', etiqueta: 'No puede salir', detalle: motivo === 'celda' ? 'El Controlador de celda deja pasar un solo AGV a la vez.' : `Falta ${falta || 'un recurso'}.`, habilitada: false };
  }

  /** ¿El brazo está libre para servir a esta CNC? (en reposo, o ya atendiéndola sin una secuencia de otra CNC). */
  brazoDisponible(cnc) {
    const c = this.celda;
    if (this.activa && this.activa.cnc !== cnc) return false;
    return c.estado('BRAZO') === 'Reposo' || c.atendida === cnc;
  }

  /**
   * Qué verbo le toca a una CNC según su estado.
   * @returns {{tipo:'cargar'|'fresar'|'progreso'|'sacar'|'reparar'|'ninguna', etiqueta:string, detalle:string, habilitada:boolean, enCurso?:boolean}}
   */
  describir(cnc) {
    const c = this.celda;
    const q = c.estado(cnc);
    if (c.terminado || c.deadlock) return { tipo: 'ninguna', etiqueta: 'Turno detenido', detalle: '', habilitada: false };
    if (this.activa && this.activa.cnc === cnc) {
      return { tipo: this.activa.tipo, etiqueta: 'El brazo trabaja…', detalle: this.paso || 'Se ejecutan los eventos del brazo uno por uno.', habilitada: false, enCurso: true };
    }
    if (q === 'Falla') return { tipo: 'reparar', etiqueta: 'Reparar la CNC', detalle: 'Escribe H C T C R y Enter en la consola.', habilitada: false };
    if (q === 'Fresando') return { tipo: 'progreso', etiqueta: 'Fresando…', detalle: 'La CNC trabaja sola: dura 10 s.', habilitada: false };
    if (q === 'Cargado') {
      const motivo = c.evaluar(cnc, 'iniciar_fresado');
      return motivo === null
        ? { tipo: 'fresar', etiqueta: 'Fresar', detalle: 'Evento i · iniciar_fresado.', habilitada: true }
        : { tipo: 'fresar', etiqueta: 'Fresar', detalle: 'Ahora no se puede: el supervisor lo bloquea (el brazo tiene el mandril abierto aquí).', habilitada: false };
    }
    const tipo = q === 'Terminado' ? 'sacar' : 'cargar';
    const etiqueta = tipo === 'sacar' ? 'Sacar pieza' : 'Cargar bloque';
    const detalle = tipo === 'sacar'
      ? 'El brazo hace m, l, a, d (descargar) y vuelve solo.'
      : 'El brazo hace m, l, a, c (cargar), e y vuelve solo.';
    if (!this.brazoDisponible(cnc)) return { tipo, etiqueta: 'Brazo ocupado', detalle: 'El brazo está atendiendo a otra CNC. Espera a que vuelva a reposo.', habilitada: false };
    if (c.estado('BRAZO') === 'Reposo' && c.evaluar('BRAZO', 'mover', { objetivo: cnc }) !== null) {
      return { tipo, etiqueta: 'Brazo ocupado', detalle: 'El robot lo está usando un AGV (falta Robot_libre). Espera unos segundos.', habilitada: false };
    }
    return { tipo, etiqueta, detalle, habilitada: true };
  }

  /** Progreso del fresado de una CNC (0 a 1) y los segundos que lleva. */
  progresoFresado(cnc) {
    const c = this.celda;
    if (c.estado(cnc) !== 'Fresando') return { fraccion: 0, segundos: 0 };
    let t0 = 0;
    for (let i = c.bitacora.length - 1; i >= 0; i--) {
      const e = c.bitacora[i];
      if (e.tipo === 'automata' && e.maquina === cnc && e.evento === 'iniciar_fresado') { t0 = e.t; break; }
    }
    const segundos = Math.max(0, this.reloj.ahora - t0);
    return { fraccion: Math.min(1, segundos / TIEMPOS.fresado), segundos };
  }

  /** Ejecuta la acción principal de la CNC (verbo habilitado). Devuelve true si hizo algo. */
  ejecutar(cnc) {
    const d = this.describir(cnc);
    if (!d.habilitada) return false;
    if (d.tipo === 'fresar') return this.celda.solicitar(cnc, 'iniciar_fresado').ok;
    this.activa = { cnc, tipo: d.tipo };
    this.paso = '';
    this._proximo = this.reloj.ahora; // el primer evento sale enseguida
    this.actualizar();
    return true;
  }

  /** Despacha un AGV (evento v · reservar). */
  despachar(agv) {
    if (!AGVS.includes(agv)) return { ok: false, motivo: 'indefinido' };
    return this.celda.solicitar(agv, 'reservar');
  }

  /** Siguiente evento de la secuencia: [máquina, evento, opciones], 'esperar' o null si terminó o no puede seguir. */
  _siguiente({ cnc, tipo }) {
    const c = this.celda;
    const q = c.estado(cnc);
    const b = c.estado('BRAZO');
    const quiero = tipo === 'cargar' ? 'Libre' : 'Terminado'; // estado de la CNC con el que se empieza
    const compartido = tipo === 'cargar' ? 'cargar' : 'descargar';
    if (b === 'Moviendo') return 'esperar'; // el evento l (llegar) lo dispara el reloj
    if (b === 'Reposo') return q === quiero ? ['BRAZO', 'mover', { objetivo: cnc }] : null;
    if (c.atendida !== cnc) return null;
    if (b === 'Mandril_Cerrado') return q === quiero ? ['BRAZO', 'abrir_mandril'] : null;
    if (b === 'Mandril_Abierto') {
      if (q === quiero) return [cnc, compartido];
      if (q === 'Cargado') return ['BRAZO', 'cerrar_mandril']; // tras cargar
      return null;
    }
    return null;
  }

  /** Por cuadro (con el reloj de simulación): lanza el siguiente evento de la secuencia cuando toca. */
  actualizar() {
    const a = this.activa;
    if (!a) return;
    const c = this.celda;
    if (c.terminado || c.deadlock || CNCS.every((id) => id !== a.cnc)) return this.cancelar();
    if (this.reloj.ahora < this._proximo) return;
    const paso = this._siguiente(a);
    if (paso === 'esperar') return;
    if (!paso) {
      this.activa = null;
      return;
    }
    const [maquina, evento, opciones] = paso;
    const motivo = c.evaluar(maquina, evento, opciones);
    if (motivo === 'recurso' || motivo === 'celda') return; // falta una ficha (por ejemplo el robot lo usa un AGV): se espera
    if (motivo !== null) return this.cancelar(); // nunca se insiste contra el supervisor
    const r = c.solicitar(maquina, evento, opciones);
    if (!r.ok) return this.cancelar();
    this.paso = `${maquina === 'BRAZO' ? 'Brazo' : maquina}: ${evento}`;
    this._proximo = this.reloj.ahora + this.pausa;
    if (c.terminado) this.cancelar();
  }
}
