// Fichas de la red de Petri sobre la planta. Cada lugar flota sobre el objeto que representa, con su contador m/k.
// Cuando una transición se dispara, las fichas viajan entre los lugares con un tween (0,3 s, docs/arte.md sección 6).
// La planta solo muestra: el marcado real vive en la RedPetri de la Celda.

import { TEXTO_HEX } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { dibujarFicha, FICHAS_DE_LUGAR } from '../arte/tokens.js';

const DURACION_VUELO = 300; // ms de reloj de pared a x1 (se divide por la velocidad)
const PROFUNDIDAD = 400;

// Dónde flota cada lugar: [columna, fila, altura en px]. Celdas libres junto al objeto que representa.
const ANCLAS = {
  Mesa_libre: [7.5, 4.5, 28], // sobre la mesa (7, 4)
  Robot_libre: [5.5, 5.5, 10], // junto a la base del brazo (5, 4)
  AGV1_listo: [11.5, 1.5, 10], // junto al depósito D1 (10, 1)
  AGV2_listo: [11.5, 8.5, 10], // junto al depósito D2 (10, 8)
  AGV1_con_mesa: [8.5, 2.5, 10], // junto a la estación S1 (8, 3)
  AGV1_trabajando: [9.5, 2.5, 10],
  AGV2_con_robot: [8.5, 6.5, 10], // junto a la estación S2 (8, 5)
  AGV2_trabajando: [9.5, 6.5, 10],
  Celda_libre: [6.5, 2.5, 10], // solo existe en la red corregida
};
// Robot_en_CNC flota junto a la CNC que el brazo atiende; en reposo queda cerca del brazo.
const REPOSO_ROBOT_EN_CNC = [4.5, 4.5, 10];
const JUNTO_A_CNC = { CNC1: [4.5, 2.5, 10], CNC2: [4.5, 6.5, 10] };

export class FichasPlanta {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   */
  constructor(escena, celda) {
    this.escena = escena;
    this.celda = celda;
    this.red = celda.red;
    this.lugares = this.red.lugares.map((l, j) => {
      const g = escena.add.graphics().setDepth(PROFUNDIDAD);
      const contador = escena.add
        .text(0, 0, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto })
        .setOrigin(0.5, 0)
        .setDepth(PROFUNDIDAD + 1);
      const etiqueta = FICHAS_DE_LUGAR[l.nombre].etiqueta;
      const rotulo = etiqueta
        ? escena.add
            .text(0, 0, etiqueta, { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#161b22' })
            .setOrigin(0.5)
            .setDepth(PROFUNDIDAD + 1)
        : null;
      return { j, nombre: l.nombre, k: l.k, g, contador, rotulo, mostrado: l.m0, vuelos: 0, credito: 0, sucio: true };
    });
    this.volando = new Set(); // fichas en el aire (objetos Graphics)
    this.ultimaCNC = null;
    this._baja = celda.alCambiar((e) => {
      if (e.tipo === 'disparo') this._alDisparar(e);
    });
  }

  /** Posición en pantalla de un lugar. */
  ancla(lugar) {
    if (lugar.nombre === 'Robot_en_CNC') {
      const cnc = this.celda.atendida ?? this.ultimaCNC;
      const [x, y, z] = cnc ? JUNTO_A_CNC[cnc] : REPOSO_ROBOT_EN_CNC;
      return aPantalla(x, y, z);
    }
    const [x, y, z] = ANCLAS[lugar.nombre];
    return aPantalla(x, y, z);
  }

  _alDisparar(e) {
    if (this.celda.atendida) this.ultimaCNC = this.celda.atendida;
    const i = this.red.indiceT(e.transicion);
    const pre = [];
    const post = [];
    this.red.lugares.forEach((_, j) => {
      if (this.red.pre[i][j] > 0) pre.push(j);
      if (this.red.post[i][j] > 0) post.push(j);
    });
    // Se retiran las fichas consumidas de inmediato; las producidas aparecen al llegar.
    for (const j of pre) this.lugares[j].mostrado -= this.red.pre[i][j];
    for (const j of post) this.lugares[j].credito += this.red.post[i][j];
    const vuelos = Math.max(pre.length, post.length);
    const duracion = DURACION_VUELO / Math.max(1, this.celda.reloj.velocidad);
    for (let n = 0; n < vuelos; n++) {
      const origen = this.lugares[pre[n % pre.length]];
      const destino = this.lugares[post[n % post.length]];
      destino.vuelos++;
      this._volar(origen, destino, duracion);
    }
    for (const lugar of [...pre, ...post]) this.lugares[lugar].sucio = true;
  }

  /** Una ficha viaja del lugar origen al destino. El destino se evalúa en cada cuadro (el brazo puede moverse). */
  _volar(origen, destino, duracion) {
    const g = this.escena.add.graphics().setDepth(PROFUNDIDAD + 2);
    const desde = this.ancla(origen);
    this.volando.add(g);
    const avance = { k: 0 };
    this.escena.tweens.add({
      targets: avance,
      k: 1,
      duration: duracion,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const hasta = this.ancla(destino);
        g.clear();
        dibujarFicha(g, origen.nombre, desde.x + (hasta.x - desde.x) * avance.k, desde.y + (hasta.y - desde.y) * avance.k - 6 * Math.sin(Math.PI * avance.k));
      },
      onComplete: () => {
        g.destroy();
        this.volando.delete(g);
        if (--destino.vuelos === 0) {
          destino.mostrado += destino.credito;
          destino.credito = 0;
        }
        destino.sucio = true;
      },
    });
  }

  /** Por cuadro: dibuja cada lugar con su ficha (o un contorno tenue si está vacío) y su contador m/k. */
  actualizar() {
    // Si no hay fichas en el aire, lo mostrado debe coincidir con el marcado real.
    if (this.volando.size === 0) {
      for (const l of this.lugares) {
        const real = this.red.M[l.j];
        if (l.mostrado !== real || l.credito !== 0) {
          l.mostrado = real;
          l.credito = 0;
          l.vuelos = 0;
          l.sucio = true;
        }
      }
    }
    for (const l of this.lugares) {
      const p = this.ancla(l);
      if (l.nombre === 'Robot_en_CNC') l.sucio = true; // su ancla depende de la CNC atendida
      if (!l.sucio) continue;
      l.g.clear();
      dibujarFicha(l.g, l.nombre, p.x, p.y, l.mostrado > 0 ? 1 : 0.22);
      l.contador.setPosition(p.x, p.y + 12).setText(`${l.mostrado}/${l.k}`);
      l.contador.setColor(l.mostrado > 0 ? TEXTO_HEX.texto : '#566170');
      l.rotulo?.setPosition(p.x, p.y).setVisible(l.mostrado > 0);
      l.sucio = false;
    }
  }

  destruir() {
    this._baja();
    for (const l of this.lugares) {
      l.g.destroy();
      l.contador.destroy();
      l.rotulo?.destroy();
    }
    for (const g of this.volando) g.destroy();
    this.volando.clear();
  }
}
