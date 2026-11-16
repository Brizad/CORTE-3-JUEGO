// Etiquetas de la planta que salen solo al pasar el mouse (o al tocar) sobre un lugar de la red: nombre, marcado m/k y, si está en
// conflicto, las transiciones que compiten. Van sobre un fondo oscuro semitransparente junto al puntero (docs/GDD.md, sección 18.1).

import { COLORES, TEXTO_HEX } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { ZONAS, ANCLAS } from './FichasPlanta.js';

const RADIO_ACIERTO = 24; // px alrededor de la ficha o de la baldosa del lugar
const NOMBRES_EXTRA = { Mesa_libre: 'Mesa', Celda_libre: 'Controlador de celda', Robot_en_CNC: 'Robot en la CNC' };

export class Etiquetas {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   * @param {() => import('./FichasPlanta.js').FichasPlanta} fichas Función que devuelve las fichas actuales.
   */
  constructor(escena, celda, fichas) {
    this.escena = escena;
    this.celda = celda;
    this.fichas = fichas;
    this.fondo = escena.add.graphics().setDepth(500).setVisible(false);
    this.texto = escena.add
      .text(0, 0, '', { fontFamily: 'Arial', fontSize: '11px', color: TEXTO_HEX.texto, lineSpacing: 3 })
      .setDepth(501)
      .setVisible(false);
    this._hasta = 0;
    this._clave = '';
  }

  /** Lugar más cercano al punto del mundo (x, y), o null. */
  _lugarEn(x, y) {
    const f = this.fichas();
    let mejor = null;
    let dist = RADIO_ACIERTO;
    for (const l of f.lugares) {
      const puntos = [f.ancla(l)];
      const zona = ANCLAS[l.nombre];
      if (zona) puntos.push(aPantalla(Math.floor(zona[0]) + 0.5, Math.floor(zona[1]) + 0.5));
      for (const p of puntos) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < dist) {
          dist = d;
          mejor = l;
        }
      }
    }
    return mejor;
  }

  /** El puntero se mueve (mouse): muestra o esconde la etiqueta. */
  mover(x, y, bloqueado = false) {
    const l = bloqueado ? null : this._lugarEn(x, y);
    if (!l) {
      if (this._hasta === 0 || this.escena.time.now > this._hasta) this._ocultar();
      return false;
    }
    this._mostrar(l, x, y);
    this._hasta = 0; // con el mouse dura mientras el puntero esté encima
    return true;
  }

  /** Toque o clic: la etiqueta dura 2,5 s (en pantallas táctiles no hay "pasar el mouse"). */
  tocar(x, y) {
    const l = this._lugarEn(x, y);
    if (!l) return false;
    this._mostrar(l, x, y);
    this._hasta = this.escena.time.now + 2500;
    return true;
  }

  _mostrar(l, x, y) {
    const red = this.celda.red;
    const m = red.M[l.j];
    const nombre = ZONAS[l.nombre] ?? NOMBRES_EXTRA[l.nombre] ?? l.nombre;
    const lineas = [`${nombre} · ${red.lugares[l.j].id} ${l.nombre}`, `Fichas: ${m} / ${red.lugares[l.j].k}`];
    const c = red.conflictos().find((q) => q.lugar === l.nombre);
    if (c) lineas.push(`Conflicto: ${c.transiciones.join(' ↔ ')}`);
    const t = lineas.join('\n');
    if (t !== this._clave) {
      this._clave = t;
      this.texto.setText(t);
    }
    const w = this.texto.width + 12;
    const h = this.texto.height + 8;
    // A la derecha y arriba del puntero; si se sale de la planta, a la izquierda.
    const px = x + 16 + w > 950 ? x - 16 - w : x + 16;
    const py = Math.max(60, y - 16 - h);
    this.fondo.clear();
    this.fondo.fillStyle(COLORES.panel, 0.85);
    this.fondo.fillRoundedRect(px, py, w, h, 4);
    this.fondo.lineStyle(1, c ? COLORES.robot : COLORES.banda, 1);
    this.fondo.strokeRoundedRect(px, py, w, h, 4);
    this.texto.setPosition(px + 6, py + 4);
    this.fondo.setVisible(true);
    this.texto.setVisible(true);
  }

  _ocultar() {
    this.fondo.setVisible(false);
    this.texto.setVisible(false);
    this._hasta = 0;
  }

  destruir() {
    this.fondo.destroy();
    this.texto.destroy();
  }
}
