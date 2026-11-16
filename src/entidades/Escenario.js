// Partes fijas de la planta que no tienen autómata: rutas y bases de los AGV, y la mesa de descarga.
// docs/arte.md, secciones 3, 4 y 9.1.

import { COLORES, TEXTO_HEX, POSICIONES, RUTAS_AGV, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, puntosPrisma, dibujarPrisma } from '../iso/formas.js';
import { ANCLAS, ZONAS } from './FichasPlanta.js';

const ANCHO_RUTA = 8; // px (docs/arte.md, sección 3)

export class Escenario {
  constructor(escena) {
    this.escena = escena;
    this._rutas();
    this._bases();
    this._mesa();
    this._zonas();
  }

  /** Bandas de 8 px en el suelo por donde viajan los AGV. */
  _rutas() {
    const g = this.escena.add.graphics().setDepth(2);
    g.lineStyle(ANCHO_RUTA, COLORES.banda, 1);
    for (const ruta of Object.values(RUTAS_AGV)) {
      g.strokePoints(ruta.map(([x, y]) => aPantalla(x + 0.5, y + 0.5)), false, false);
    }
  }

  /** Depósitos (D1, D2) y estaciones (S1, S2): una baldosa de la celda con su rótulo. */
  _bases() {
    const g = this.escena.add.graphics().setDepth(3);
    const bases = [['D1', POSICIONES.D1], ['D2', POSICIONES.D2], ['S1', POSICIONES.S1], ['S2', POSICIONES.S2]];
    for (const [nombre, { x, y }] of bases) {
      const rombo = [aPantalla(x, y), aPantalla(x + 1, y), aPantalla(x + 1, y + 1), aPantalla(x, y + 1)];
      g.fillStyle(COLORES.banda, 1);
      g.fillPoints(rombo, true);
      g.lineStyle(2, oscurecer(COLORES.banda, 0.35), 1);
      g.strokePoints(rombo, true);
      // El rótulo va bajo la baldosa, en el suelo, sobre un fondo oscuro semitransparente.
      const r = aPantalla(x + 0.5, y + 1.05);
      this._rotulo(r.x, r.y, nombre);
    }
  }

  /** Rótulo corto con fondo oscuro semitransparente (así no se pierde sobre el suelo ni sobre otros dibujos). */
  _rotulo(x, y, contenido) {
    const t = this.escena.add
      .text(x, y + 2, contenido, { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto })
      .setOrigin(0.5, 0)
      .setDepth(5);
    const fondo = this.escena.add.graphics().setDepth(4);
    fondo.fillStyle(COLORES.panel, 0.7);
    fondo.fillRoundedRect(x - t.width / 2 - 4, y, t.width + 8, t.height + 4, 3);
    return t;
  }

  /** Zonas de los lugares de la red: base, espera y trabajo de cada AGV, y la zona del robot. */
  _zonas() {
    const g = this.escena.add.graphics().setDepth(3);
    for (const [lugar, rotulo] of Object.entries(ZONAS)) {
      const x = Math.floor(ANCLAS[lugar][0]);
      const y = Math.floor(ANCLAS[lugar][1]);
      const rombo = [aPantalla(x, y), aPantalla(x + 1, y), aPantalla(x + 1, y + 1), aPantalla(x, y + 1)];
      g.fillStyle(COLORES.banda, 0.5);
      g.fillPoints(rombo, true);
      g.lineStyle(1.5, oscurecer(COLORES.banda, 0.2), 1);
      g.strokePoints(rombo, true);
      // Sin rótulo fijo: el nombre de la zona sale al pasar el mouse (Etiquetas.js).
      void rotulo;
    }
  }

  /** Mesa de descarga: plataforma plana de 12 px con el tablero café. */
  _mesa() {
    const { x, y } = POSICIONES.MESA;
    const g = this.escena.add.graphics().setDepth(10 + x + y);
    dibujarPrisma(g, puntosPrisma(x, y, 1, 1, ALTOS.MESA), COLORES.mesa);
    const c = aPantalla(x + 0.5, y + 1.05);
    this._rotulo(c.x, c.y, 'Mesa');
  }
}
