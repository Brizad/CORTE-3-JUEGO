// Entidad: la parte visible de una máquina. Tiene su propia instancia de Automata (la crea la Celda).
// Nunca cambia de estado por su cuenta: solo lee el estado del autómata y se redibuja cuando la Celda avisa.

import { aspectoDe } from '../arte/estados.js';
import { dibujarIcono } from '../arte/iconos.js';

const PROFUNDIDAD_BASE = 10; // las entidades se dibujan encima del suelo y los muros
const PROFUNDIDAD_ICONOS = 300; // los íconos quedan por encima de todas las máquinas

/** Interpolación lineal en el tiempo de simulación: {desde, hasta, t0, dur}. */
export function valorAnimado(a, t) {
  const k = a.dur > 0 ? Math.min(1, Math.max(0, (t - a.t0) / a.dur)) : 1;
  return a.desde + (a.hasta - a.desde) * k;
}

/** Suaviza un valor de 0 a 1 (arranque y llegada lentos). */
export const suave = (k) => k * k * (3 - 2 * k);

export class Entidad {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda Núcleo formal (autómatas, red y reloj).
   * @param {string} id 'CNC1', 'CNC2', 'BRAZO', 'AGV1' o 'AGV2'.
   * @param {'CNC'|'BRAZO'|'AGV'} tipo Tipo de máquina (elige la tabla de color e ícono).
   */
  constructor(escena, celda, id, tipo) {
    this.escena = escena;
    this.celda = celda;
    this.id = id;
    this.tipo = tipo;
    this.automata = celda.automatas[id]; // instancia propia de esta máquina
    this.nombre = id.replace(/^(CNC|AGV)(\d)$/, '$1 $2').replace('BRAZO', 'Brazo');
    this.cuerpo = escena.add.graphics();
    this.iconos = escena.add.graphics();
    this.silueta = [];
    this.hover = false;
    this.sucia = true;
    this._estadoDibujado = null;
    // La Celda avisa de cada cambio de estado: aquí solo se anota que hay que redibujar.
    this._baja = celda.alCambiar((e) => {
      if (e.tipo === 'automata' && e.maquina === this.id) this.alCambiarEstado(e);
    });
  }

  /** Color e ícono del estado actual del autómata. */
  get aspecto() {
    return aspectoDe(this.tipo, this.automata.estado);
  }

  /** Posición para el orden de profundidad: más grande se dibuja encima. */
  fijarProfundidad(suma) {
    this.cuerpo.setDepth(PROFUNDIDAD_BASE + suma);
    this.iconos.setDepth(PROFUNDIDAD_ICONOS + suma);
  }

  /** Gancho para las subclases: la Celda cambió el estado de este autómata. */
  alCambiarEstado(_evento) {
    this.sucia = true;
  }

  /** Se llama una vez por cuadro con el tiempo de simulación t (s). */
  actualizar(t) {
    if (this.sucia || this._estadoDibujado !== this.automata.estado) {
      this.dibujarCuerpo(t);
      this._estadoDibujado = this.automata.estado;
      this.sucia = false;
    }
    this.redibujarIcono(t);
  }

  /** Dibuja el ícono del estado actual en su punto. */
  redibujarIcono(t) {
    this.iconos.clear();
    const { x, y } = this.puntoIcono(t);
    const a = this.aspecto;
    dibujarIcono(this.iconos, a.icono, x, y, a.color, t);
  }

  /** Las subclases dibujan el cuerpo y la silueta. */
  dibujarCuerpo(_t) {}

  /** Centro del ícono en pantalla. */
  puntoIcono(_t) {
    return { x: 0, y: 0 };
  }

  destruir() {
    this._baja();
    this.cuerpo.destroy();
    this.iconos.destroy();
  }
}
