// Partes fijas de la planta que no tienen autómata: rutas y bases de los AGV, y la mesa de descarga.
// docs/arte.md, secciones 3, 4 y 9.1.

import { COLORES, TEXTO_HEX, POSICIONES, RUTAS_AGV, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, puntosPrisma, dibujarPrisma } from '../iso/formas.js';

const ANCHO_RUTA = 8; // px (docs/arte.md, sección 3)

export class Escenario {
  constructor(escena) {
    this.escena = escena;
    this._rutas();
    this._bases();
    this._mesa();
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
      // El rótulo va bajo la baldosa, en el suelo.
      const r = aPantalla(x + 0.5, y + 1.05);
      this.escena.add
        .text(r.x, r.y, nombre, { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto })
        .setOrigin(0.5, 0)
        .setDepth(4)
        .setAlpha(0.85);
    }
  }

  /** Mesa de descarga: plataforma plana de 12 px con el tablero café. */
  _mesa() {
    const { x, y } = POSICIONES.MESA;
    const g = this.escena.add.graphics().setDepth(10 + x + y);
    dibujarPrisma(g, puntosPrisma(x, y, 1, 1, ALTOS.MESA), COLORES.mesa);
    const c = aPantalla(x + 0.5, y + 1.05);
    this.escena.add
      .text(c.x, c.y, 'Mesa', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto })
      .setOrigin(0.5, 0)
      .setDepth(4)
      .setAlpha(0.85);
  }
}
