// Fichas de la red de Petri sobre la planta. Cada lugar flota sobre el objeto que representa, con su contador m/k.
// Cuando una transición se dispara, las fichas consumidas viajan (tween de 0,3 s) desde sus lugares hasta la
// estación de la transición, en el orden de Pre, y desde la estación salen hacia los lugares de salida, en el orden de Post.
// Los lugares en conflicto (dos transiciones habilitadas que compiten por la misma ficha) se resaltan en naranja.
// La planta solo muestra: el marcado real vive en la RedPetri de la Celda.

import { TEXTO_HEX, COLORES, POSICIONES } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { dibujarFicha, FICHAS_DE_LUGAR } from '../arte/tokens.js';

const DURACION_VUELO = 300; // ms de reloj de pared a x1 por tramo (se divide por la velocidad)
const ESCALON = 70; // ms entre una ficha y la siguiente del mismo tramo (a x1)
const PROFUNDIDAD = 400;

// Dónde flota cada lugar: [columna, fila, altura en px]. Celdas libres junto al objeto que representa.
export const ANCLAS = {
  Mesa_libre: [7.5, 4.5, 28], // sobre la mesa (7, 4)
  Robot_libre: [5.5, 5.5, 10], // zona del robot, junto a la base del brazo (5, 4)
  AGV1_listo: [11.5, 1.5, 10], // base del AGV1, junto al depósito D1 (10, 1)
  AGV2_listo: [11.5, 8.5, 10], // base del AGV2, junto al depósito D2 (10, 8)
  AGV1_con_mesa: [8.5, 2.5, 10], // zona de espera del AGV1, junto a la estación S1 (8, 3)
  AGV1_trabajando: [9.5, 2.5, 10], // zona de trabajo del AGV1
  AGV2_con_robot: [8.5, 6.5, 10], // zona de espera del AGV2, junto a la estación S2 (8, 5)
  AGV2_trabajando: [9.5, 6.5, 10], // zona de trabajo del AGV2
  Celda_libre: [6.5, 2.5, 10], // solo existe en la red corregida
};
// Rótulo de la zona del mapa que corresponde a cada lugar (lo dibuja el Escenario).
export const ZONAS = {
  Robot_libre: 'Robot',
  AGV1_listo: 'Base AGV1',
  AGV2_listo: 'Base AGV2',
  AGV1_con_mesa: 'Espera AGV1',
  AGV1_trabajando: 'Trabajo AGV1',
  AGV2_con_robot: 'Espera AGV2',
  AGV2_trabajando: 'Trabajo AGV2',
};
// Robot_en_CNC flota junto a la CNC que el brazo atiende; en reposo queda cerca del brazo.
const REPOSO_ROBOT_EN_CNC = [4.5, 4.5, 10];
const JUNTO_A_CNC = { CNC1: [4.5, 2.5, 10], CNC2: [4.5, 6.5, 10] };

// Estación de cada transición: el punto por donde pasan las fichas (celda y altura).
const ESTACION = {
  t1a: [POSICIONES.S1, 14], t1b: [POSICIONES.S1, 14], t1c: [POSICIONES.S1, 14],
  t2a: [POSICIONES.S2, 14], t2b: [POSICIONES.S2, 14], t2c: [POSICIONES.S2, 14],
  tr_ir: [POSICIONES.BRAZO, 34], tr_volver: [POSICIONES.BRAZO, 34],
};

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
      const conflicto = escena.add
        .text(0, 0, '', { fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color: '#f08a24', stroke: '#161b22', strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setDepth(PROFUNDIDAD + 1)
        .setVisible(false);
      return { j, nombre: l.nombre, k: l.k, g, contador, rotulo, conflicto, mostrado: l.m0, vuelos: 0, credito: 0, sucio: true };
    });
    this.gConflicto = escena.add.graphics().setDepth(PROFUNDIDAD - 1);
    this.volando = new Set(); // fichas en el aire (objetos Graphics)
    this.transitosActivos = 0; // transiciones con fichas todavía viajando
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

  /** Posición de la estación de una transición. */
  estacion(transicion) {
    const [celda, z] = ESTACION[transicion];
    return aPantalla(celda.x + 0.5, celda.y + 0.5, z);
  }

  _alDisparar(e) {
    if (this.celda.atendida) this.ultimaCNC = this.celda.atendida;
    const i = this.red.indiceT(e.transicion);
    // Orden de Pre y de Post: el de los lugares en la matriz (p1, p2, …).
    const pre = [];
    const post = [];
    this.red.lugares.forEach((_, j) => {
      if (this.red.pre[i][j] > 0) pre.push(j);
      if (this.red.post[i][j] > 0) post.push(j);
    });
    // Las fichas consumidas salen del lugar de inmediato; las producidas aparecen al llegar.
    for (const j of pre) this.lugares[j].mostrado -= this.red.pre[i][j];
    for (const j of post) {
      this.lugares[j].credito += this.red.post[i][j];
      this.lugares[j].vuelos++;
      this.lugares[j].sucio = true;
    }
    for (const j of pre) this.lugares[j].sucio = true;

    const vel = Math.max(1, this.celda.reloj.velocidad);
    const duracion = DURACION_VUELO / vel;
    const escalon = ESCALON / vel;
    const estacion = () => this.estacion(e.transicion);
    this.transitosActivos++;
    let llegadas = 0;
    const salir = () => {
      // Tramo 2: de la estación a los lugares de salida, en el orden de Post.
      let restantes = post.length;
      post.forEach((j, n) => {
        const destino = this.lugares[j];
        this._volar(destino.nombre, estacion, () => this.ancla(destino), duracion, n * escalon, () => {
          if (--destino.vuelos === 0) {
            destino.mostrado += destino.credito;
            destino.credito = 0;
          }
          destino.sucio = true;
          if (--restantes === 0) this.transitosActivos--;
        });
      });
    };
    // Tramo 1: de cada lugar de entrada a la estación, en el orden de Pre. Salen todas juntas (AND-join).
    pre.forEach((j, n) => {
      const origen = this.lugares[j];
      this._volar(origen.nombre, () => this.ancla(origen), estacion, duracion, n * escalon, () => {
        if (++llegadas === pre.length) salir();
      });
    });
  }

  /** Una ficha viaja de `desde()` a `hasta()` con un tween. Los extremos se evalúan en cada cuadro. */
  _volar(nombreLugar, desde, hasta, duracion, retraso, alLlegar) {
    const g = this.escena.add.graphics().setDepth(PROFUNDIDAD + 2);
    this.volando.add(g);
    const avance = { k: 0 };
    this.escena.tweens.add({
      targets: avance,
      k: 1,
      duration: duracion,
      delay: retraso,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const a = desde();
        const b = hasta();
        g.clear();
        dibujarFicha(g, nombreLugar, a.x + (b.x - a.x) * avance.k, a.y + (b.y - a.y) * avance.k - 6 * Math.sin(Math.PI * avance.k));
      },
      onComplete: () => {
        g.destroy();
        this.volando.delete(g);
        alLlegar();
      },
    });
  }

  /** Por cuadro: dibuja cada lugar con su ficha (o un contorno tenue si está vacío), su contador m/k y los conflictos. */
  actualizar() {
    // Si no hay fichas en el aire, lo mostrado debe coincidir con el marcado real.
    if (this.transitosActivos === 0 && this.volando.size === 0) {
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
    this._dibujarConflictos();
  }

  /** Conflictos: dos transiciones habilitadas que compiten por la misma ficha se resaltan en naranja. */
  _dibujarConflictos() {
    const g = this.gConflicto;
    g.clear();
    for (const l of this.lugares) l.conflicto.setVisible(false);
    const pulso = 0.55 + 0.45 * Math.sin(this.escena.time.now / 180);
    for (const c of this.red.conflictos()) {
      const l = this.lugares[this.red.indiceP(c.lugar)];
      const p = this.ancla(l);
      g.lineStyle(3, COLORES.robot, pulso);
      g.strokeCircle(p.x, p.y, 17);
      l.conflicto.setText(c.transiciones.join(' ↔ ')).setPosition(p.x, p.y + 23).setVisible(true);
    }
  }

  destruir() {
    this._baja();
    for (const l of this.lugares) {
      l.g.destroy();
      l.contador.destroy();
      l.rotulo?.destroy();
      l.conflicto.destroy();
    }
    this.gConflicto.destroy();
    for (const g of this.volando) g.destroy();
    this.volando.clear();
  }
}
