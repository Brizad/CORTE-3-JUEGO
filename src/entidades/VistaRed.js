// Vista "Red de Petri" (tecla R y botón "Red"): dibuja la red sobre la planta (docs/GDD.md, sección 18.4).
//  - Cada lugar es un círculo sobre su objeto, con sus fichas y su contador m/k (las dibuja FichasPlanta en el mismo sitio).
//  - Cada transición es una barra negra en su estación, con su nombre.
//  - Arcos con flecha lugar → transición (Pre) y transición → lugar (Post).
//  - Barra verde: habilitada. Naranja: compite por una ficha (conflicto). Roja: bloqueada en deadlock.
// Las fichas viajan siguiendo las flechas: FichasPlanta usa posicionBarra() como estación mientras la vista está activa.
// Solo muestra: el marcado real vive en la RedPetri de la Celda.

import { COLORES, TEXTO_HEX, POSICIONES } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';

const PROFUNDIDAD = 385;
const RADIO_LUGAR = 15;
const BARRA = { ancho: 34, alto: 9 };

// Posición de cada barra (celda de la estación y desplazamiento en píxeles): las tres de cada AGV van apiladas en su estación.
const BARRAS = {
  t1a: [POSICIONES.S1, 6, -26], t1b: [POSICIONES.S1, 6, 0], t1c: [POSICIONES.S1, 6, 26],
  t2a: [POSICIONES.S2, -36, -26], t2b: [POSICIONES.S2, -36, 0], t2c: [POSICIONES.S2, -36, 26],
  tr_ir: [POSICIONES.BRAZO, -54, -54], tr_volver: [POSICIONES.BRAZO, 46, -54],
};

export class VistaRed {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   * @param {() => import('./FichasPlanta.js').FichasPlanta} fichas Función que devuelve las fichas actuales.
   */
  constructor(escena, celda, fichas) {
    this.escena = escena;
    this.celda = celda;
    this.fichas = fichas;
    this.activa = false;
    this.velo = escena.add.graphics().setDepth(PROFUNDIDAD - 15).setVisible(false);
    this.velo.fillStyle(COLORES.panel, 0.55);
    this.velo.fillRect(0, 56, 960, 392);
    this.g = escena.add.graphics().setDepth(PROFUNDIDAD).setVisible(false);
    this.textos = [];
    this._lugares = 0;
  }

  alternar() {
    this.activa = !this.activa;
    this.velo.setVisible(this.activa);
    this.g.setVisible(this.activa);
    this.textos.forEach((t) => t.setVisible(this.activa));
    return this.activa;
  }

  activar() {
    if (!this.activa) this.alternar();
  }

  /** Posición en pantalla de la barra de una transición. */
  posicionBarra(t) {
    const [celda, dx, dy] = BARRAS[t];
    const p = aPantalla(celda.x + 0.5, celda.y + 0.5);
    return { x: p.x + dx, y: p.y + dy };
  }

  _texto(x, y, contenido, color = TEXTO_HEX.texto) {
    const t = this.escena.add
      .text(x, y, contenido, { fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color, backgroundColor: 'rgba(22,27,34,0.8)', padding: { x: 2, y: 1 } })
      .setOrigin(0.5)
      .setDepth(PROFUNDIDAD + 1)
      .setVisible(this.activa);
    this.textos.push(t);
    return t;
  }

  /** Crea los rótulos (ids de lugar y nombres de transición) la primera vez y cuando cambia la red. */
  _construir() {
    const red = this.celda.red;
    this.textos.forEach((t) => t.destroy());
    this.textos = [];
    this.idLugares = red.lugares.map((l) => this._texto(0, 0, l.id, '#8794a3'));
    this.nombresBarras = red.transiciones.map((t) => this._texto(0, 0, t.id));
    this._lugares = red.lugares.length;
  }

  /** Por cuadro (solo hace algo con la vista activa). */
  actualizar() {
    if (!this.activa) return;
    const celda = this.celda;
    const red = celda.red;
    if (this._lugares !== red.lugares.length) this._construir();
    const fichas = this.fichas();
    const g = this.g;
    g.clear();

    const habilitadas = new Set(red.habilitadas());
    const conflicto = new Set(red.conflictos().flatMap((c) => c.transiciones));
    const colorBarra = (id) => {
      if (celda.deadlock && !habilitadas.has(id)) return COLORES.fallo; // bloqueada en deadlock
      if (conflicto.has(id)) return COLORES.robot; // compite por una ficha
      if (habilitadas.has(id)) return COLORES.operacion; // habilitada
      return 0x000000;
    };
    const anclaLugar = (j) => fichas.ancla(fichas.lugares[j]);

    // Arcos.
    red.transiciones.forEach((t, i) => {
      const b = this.posicionBarra(t.id);
      const color = colorBarra(t.id);
      const resaltada = color !== 0x000000;
      g.lineStyle(resaltada ? 2 : 1.5, resaltada ? color : COLORES.maquina, resaltada ? 1 : 0.8);
      g.fillStyle(resaltada ? color : COLORES.maquina, resaltada ? 1 : 0.8);
      red.lugares.forEach((_, j) => {
        const l = anclaLugar(j);
        if (red.pre[i][j] > 0) this._flecha(g, l, b, RADIO_LUGAR, BARRA.alto / 2 + 2); // lugar → transición
        if (red.post[i][j] > 0) this._flecha(g, b, l, BARRA.alto / 2 + 2, RADIO_LUGAR); // transición → lugar
      });
    });

    // Lugares: círculos sobre su objeto.
    red.lugares.forEach((l, j) => {
      const p = anclaLugar(j);
      g.fillStyle(COLORES.panel, 0.9);
      g.fillCircle(p.x, p.y, RADIO_LUGAR);
      g.lineStyle(2, red.M[j] > 0 ? COLORES.texto : COLORES.banda, 1);
      g.strokeCircle(p.x, p.y, RADIO_LUGAR);
      this.idLugares[j].setPosition(p.x, p.y - RADIO_LUGAR - 8);
    });

    // Barras de las transiciones: negras (o verde / naranja / roja) con su nombre.
    red.transiciones.forEach((t, i) => {
      const b = this.posicionBarra(t.id);
      g.fillStyle(colorBarra(t.id), 1);
      g.fillRect(b.x - BARRA.ancho / 2, b.y - BARRA.alto / 2, BARRA.ancho, BARRA.alto);
      g.lineStyle(1.5, COLORES.texto, 0.9);
      g.strokeRect(b.x - BARRA.ancho / 2, b.y - BARRA.alto / 2, BARRA.ancho, BARRA.alto);
      this.nombresBarras[i].setPosition(b.x + BARRA.ancho / 2 + 18, b.y);
    });
  }

  /** Flecha recta de `a` a `b`, recortada en los bordes (radios `ra` y `rb`). */
  _flecha(g, a, b, ra, rb) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < ra + rb + 4) return;
    const ux = dx / d;
    const uy = dy / d;
    const ini = { x: a.x + ux * ra, y: a.y + uy * ra };
    const fin = { x: b.x - ux * rb, y: b.y - uy * rb };
    g.lineBetween(ini.x, ini.y, fin.x - ux * 6, fin.y - uy * 6);
    const ang = Math.atan2(dy, dx);
    g.fillTriangle(
      fin.x, fin.y,
      fin.x - Math.cos(ang - 0.4) * 9, fin.y - Math.sin(ang - 0.4) * 9,
      fin.x - Math.cos(ang + 0.4) * 9, fin.y - Math.sin(ang + 0.4) * 9,
    );
  }

  destruir() {
    this.velo.destroy();
    this.g.destroy();
    this.textos.forEach((t) => t.destroy());
  }
}
