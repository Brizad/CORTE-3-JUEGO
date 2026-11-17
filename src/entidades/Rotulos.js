// Rótulos de la planta (docs/GDD.md, sección 18.19):
//  - Nombres fijos de las máquinas: "CNC 1", "CNC 2", "Brazo", "AGV 1" y "AGV 2" (el del AGV lo sigue por su ruta). "Mesa" lo pone el Escenario.
//  - Textos flotantes en el sitio del evento: "+100 pieza", "+40 metal", "−15 bloqueado", "−20 entrega perdida". Suben y se
//    desvanecen con un tween.
// Solo muestran lo que ya pasó en el modelo: no cambian reglas ni puntajes.

import { COLORES, TEXTO_HEX, POSICIONES, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { etiquetaPuntos } from '../textos.js';

const PROFUNDIDAD = 420;
const NOMBRES = { CNC1: 'CNC 1', CNC2: 'CNC 2', BRAZO: 'Brazo', AGV1: 'AGV 1', AGV2: 'AGV 2' };
const SIN_MAQUINA = aPantalla(9.5, 4.5, 30); // puntos que no son de una máquina (pedido vencido, deadlock): entre las dos estaciones

export class Rotulos {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   * @param {() => object[]} entidades Función que devuelve las entidades de las máquinas.
   */
  constructor(escena, celda, entidades) {
    this.escena = escena;
    this.celda = celda;
    this.entidades = entidades;
    this.fondo = escena.add.graphics().setDepth(PROFUNDIDAD);
    this.textos = {};
    for (const [id, nombre] of Object.entries(NOMBRES)) {
      this.textos[id] = escena.add
        .text(0, 0, nombre, { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto })
        .setOrigin(0.5, 0)
        .setDepth(PROFUNDIDAD + 1);
    }
    this._clave = '';
    this._flotantes = new Set();
    this._ultimoFlotante = { t: -Infinity, n: 0 };
    this._baja = celda.alCambiar((e) => {
      if (e.tipo === 'puntos' && e.puntos !== 0) this._puntos(e);
    });
  }

  /** Dónde va el nombre de cada máquina (punto de arriba y al centro del rótulo). */
  _posicion(id) {
    if (id.startsWith('CNC')) {
      const p = POSICIONES[id];
      return aPantalla(p.x + 0.5, p.y + 1.05); // bajo la cara del frente, como los rótulos del Escenario
    }
    if (id === 'BRAZO') {
      const c = aPantalla(POSICIONES.BRAZO.x + 0.5, POSICIONES.BRAZO.y + 0.5);
      return { x: c.x, y: c.y + 9 };
    }
    // AGV: a la derecha del carrito, siguiéndolo por la ruta.
    const e = this.entidades().find((q) => q.id === id);
    const c = aPantalla(e.fx, e.fy, ALTOS.AGV);
    return { x: c.x + 30, y: c.y - 6 };
  }

  /** Por cuadro: coloca los rótulos (solo redibuja el fondo cuando algún AGV se movió). */
  actualizar() {
    // Con la vista de la red de Petri activa los nombres se esconden: allí mandan los rótulos de lugares y transiciones.
    const visible = !this.escena.vistaRed?.activa;
    const pos = Object.keys(NOMBRES).map((id) => [id, this._posicion(id)]);
    const clave = `${visible}|` + pos.map(([, p]) => `${Math.round(p.x)},${Math.round(p.y)}`).join('|');
    if (clave === this._clave) return;
    this._clave = clave;
    this.fondo.clear();
    this.fondo.fillStyle(COLORES.panel, 0.7);
    for (const [id, p] of pos) {
      const t = this.textos[id];
      t.setVisible(visible);
      if (!visible) continue;
      t.setPosition(p.x, p.y + 2);
      this.fondo.fillRoundedRect(p.x - t.width / 2 - 4, p.y, t.width + 8, t.height + 4, 3);
    }
  }

  /** Texto de puntos en el sitio del evento: "+100 pieza" en verde, "−20 entrega perdida" en rojo. */
  _puntos(e) {
    const ent = e.maquina ? this.entidades().find((q) => q.id === e.maquina) : null;
    const base = ent?.silueta?.length ? { x: ent.silueta.reduce((a, q) => a + q.x, 0) / ent.silueta.length, y: Math.min(...ent.silueta.map((q) => q.y)) - 26 } : SIN_MAQUINA;
    const texto = etiquetaPuntos(e.puntos, e.motivo);
    // Varios textos casi a la vez (por ejemplo −200 y −20): se apilan para que no se tapen.
    const ahora = this.escena.time.now;
    const u = this._ultimoFlotante;
    u.n = ahora - u.t < 600 ? u.n + 1 : 0;
    u.t = ahora;
    this.flotar(texto, base.x, base.y - u.n * 16, e.puntos > 0 ? TEXTO_HEX.operacion : TEXTO_HEX.fallo);
  }

  /** Texto que sube 34 px y se desvanece en 1,4 s. */
  flotar(texto, x, y, color) {
    const t = this.escena.add
      .text(x, y, texto, { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color, stroke: '#161b22', strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setDepth(PROFUNDIDAD + 30);
    this._flotantes.add(t);
    this.escena.tweens.add({
      targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: 1400, ease: 'Cubic.easeIn',
      onComplete: () => { this._flotantes.delete(t); t.destroy(); },
    });
  }

  destruir() {
    this._baja();
    this.fondo.destroy();
    for (const t of Object.values(this.textos)) t.destroy();
    for (const t of this._flotantes) t.destroy();
    this._flotantes.clear();
  }
}
