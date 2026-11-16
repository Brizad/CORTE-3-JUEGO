// Piezas visibles (docs/GDD.md, sección 18.6). Capa solo visual: no tiene estado propio ni cambia reglas.
// Todo sale de los estados de las CNC y de los eventos c (cargar) y d (descargar) del modelo:
//  - "Entrada": 3 bloques en bruto junto al brazo (se rellenan solos).
//  - Al cargar, un bloque viaja de la Entrada a la CNC pasando por la pinza del brazo; en Cargado y Fresando se ve sobre la máquina.
//  - En Terminado el bloque es una pieza brillante (dorada, con glow); en Falla se ve rojo.
//  - Al descargar, la pieza viaja a "Piezas terminadas", se apila y suma al contador.

import { COLORES, TEXTO_HEX, POSICIONES, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, aclarar } from '../iso/formas.js';

const ENTRADA = { x: 6, y: 5 }; // celda de la zona "Entrada"
const TERMINADAS = { x: 6, y: 3 }; // celda de la zona "Piezas terminadas"
const DURACION_VUELO = 650; // ms de reloj de pared a x1 (se divide por la velocidad)
const MAX_PILA = 10;
const LADO = 11; // semi-ancho de un bloque en px
const ALTO_BLOQUE = 9; // px
const PROFUNDIDAD = 250;

/** Dibuja un cubo isométrico pequeño cuya base está centrada en (x, y) de la pantalla. */
function cubo(g, x, y, color, lado = LADO, alto = ALTO_BLOQUE, alfa = 1) {
  const w = lado;
  g.fillStyle(oscurecer(color, 0.2), alfa);
  g.fillPoints([{ x: x - w, y: y - alto }, { x, y: y - alto + w / 2 }, { x, y: y + w / 2 }, { x: x - w, y }], true);
  g.fillStyle(oscurecer(color, 0.35), alfa);
  g.fillPoints([{ x, y: y - alto + w / 2 }, { x: x + w, y: y - alto }, { x: x + w, y }, { x, y: y + w / 2 }], true);
  g.fillStyle(color, alfa);
  g.fillPoints([{ x, y: y - alto - w / 2 }, { x: x + w, y: y - alto }, { x, y: y - alto + w / 2 }, { x: x - w, y: y - alto }], true);
}

export class Piezas {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   * @param {() => object[]} entidades Función que devuelve las entidades (para ubicar la pinza del brazo).
   */
  constructor(escena, celda, entidades) {
    this.escena = escena;
    this.celda = celda;
    this.entidades = entidades;
    this.fijo = escena.add.graphics().setDepth(4); // baldosas de las zonas
    this.g = escena.add.graphics().setDepth(PROFUNDIDAD); // bloques y pila
    this.brillo = escena.add.graphics().setDepth(PROFUNDIDAD + 1); // piezas brillantes (con glow)
    this.brillo.enableFilters();
    this.glow = this.brillo.filters.internal.addGlow(COLORES.celda, 4, 0).setPaddingOverride(null);
    this.vuelos = escena.add.graphics().setDepth(PROFUNDIDAD + 2);
    this.llegando = { CNC1: 0, CNC2: 0 }; // bloques que todavía viajan hacia esa CNC
    this.entradaVacia = 0; // bloques de la Entrada que faltan por rellenar
    this.mostradas = 0; // piezas que ya llegaron a la zona de terminadas
    this.enCamino = 0; // piezas que viajan hacia la zona de terminadas
    this.tweens = new Set();
    this.vuelosActivos = new Set();
    this._zonas();
    this.contador = escena.add
      .text(0, 0, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto })
      .setOrigin(0.5, 0)
      .setDepth(PROFUNDIDAD + 3);
    this._baja = celda.alCambiar((e) => {
      if (e.tipo === 'automata' && e.maquina.startsWith('CNC')) {
        if (e.evento === 'cargar') this._cargar(e.maquina);
        if (e.evento === 'descargar') this._descargar(e.maquina);
      }
      if (e.tipo === 'restaurado') this._restaurar();
    });
  }

  // ---- Zonas ----

  _zonas() {
    const g = this.fijo;
    for (const [celda, nombre] of [[ENTRADA, 'Entrada'], [TERMINADAS, 'Piezas terminadas']]) {
      const { x, y } = celda;
      const rombo = [aPantalla(x, y), aPantalla(x + 1, y), aPantalla(x + 1, y + 1), aPantalla(x, y + 1)];
      g.fillStyle(COLORES.banda, 0.55);
      g.fillPoints(rombo, true);
      g.lineStyle(1.5, oscurecer(COLORES.banda, 0.2), 1);
      g.strokePoints(rombo, true);
      // El rótulo de las terminadas va sobre la baldosa (la mesa taparía el de abajo).
      const r = nombre === 'Entrada' ? aPantalla(x + 0.5, y + 1.0) : aPantalla(x + 0.5, y - 0.15);
      const t = this.escena.add
        .text(r.x, r.y + 2, nombre, { fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color: TEXTO_HEX.texto })
        .setOrigin(0.5, 0)
        .setDepth(5);
      g.fillStyle(COLORES.panel, 0.7);
      g.fillRoundedRect(r.x - t.width / 2 - 4, r.y, t.width + 8, t.height + 4, 3);
    }
  }

  /** Posición en pantalla (base del bloque) en una celda con altura z. */
  _celda(c, dx, dy, z = 0) {
    return aPantalla(c.x + dx, c.y + dy, z);
  }

  _arriba(cnc) {
    const p = POSICIONES[cnc];
    return aPantalla(p.x + 0.72, p.y + 0.72, ALTOS.CNC);
  }

  // ---- Eventos: vuelos con tween ----

  /** Cargar: un bloque sale de la Entrada, pasa por la pinza del brazo y llega a la CNC. */
  _cargar(cnc) {
    this.llegando[cnc]++;
    this.entradaVacia++;
    const brazo = this.entidades().find((e) => e.id === 'BRAZO');
    const desde = this._celda(ENTRADA, 0.5, 0.5, ALTO_BLOQUE + 8);
    const pinza = brazo?._muneca ?? aPantalla(POSICIONES.BRAZO.x + 0.5, POSICIONES.BRAZO.y + 0.5, ALTOS.BRAZO);
    const hasta = this._arriba(cnc);
    this._volar({ desde, via: { x: pinza.x, y: pinza.y + 8 }, hasta, color: COLORES.banda, fin: () => {
      this.llegando[cnc]--;
      // La Entrada se rellena sola: el bloque que falta vuelve con un pequeño retraso.
      this.escena.time.delayedCall(350 / Math.max(1, this.celda.reloj.velocidad), () => { this.entradaVacia = Math.max(0, this.entradaVacia - 1); });
    } });
  }

  /** Descargar: la pieza brillante viaja de la CNC a la zona de piezas terminadas. */
  _descargar(cnc) {
    this.enCamino++;
    const desde = this._arriba(cnc);
    const hasta = this._celda(TERMINADAS, 0.5, 0.5, this._alturaPila());
    this._volar({ desde, hasta, color: COLORES.celda, brillante: true, fin: () => {
      this.enCamino--;
      this.mostradas++;
    } });
  }

  _alturaPila() {
    return Math.floor(Math.min(this.mostradas + this.enCamino, MAX_PILA) / 4) * ALTO_BLOQUE;
  }

  /** Un bloque viaja de `desde` a `hasta` (pasando por `via` si hay) con un tween; al llegar llama a `fin`. */
  _volar({ desde, via = null, hasta, color, brillante = false, fin }) {
    const vuelo = { k: 0, color, brillante };
    this.vuelosActivos.add(vuelo);
    const punto = (k) => {
      const lerp = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s - 22 * Math.sin(Math.PI * s) });
      if (!via) return lerp(desde, hasta, k);
      return k < 0.5 ? lerp(desde, via, k * 2) : lerp(via, hasta, (k - 0.5) * 2);
    };
    vuelo.punto = punto;
    const tween = this.escena.tweens.add({
      targets: vuelo,
      k: 1,
      duration: DURACION_VUELO / Math.max(1, this.celda.reloj.velocidad),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.delete(tween);
        this.vuelosActivos.delete(vuelo);
        fin();
      },
    });
    this.tweens.add(tween);
  }

  /** Reintento: se cancelan los vuelos y todo vuelve a lo que dicen los estados. */
  _restaurar() {
    for (const tw of this.tweens) tw.remove();
    this.tweens.clear();
    this.vuelosActivos.clear();
    this.llegando = { CNC1: 0, CNC2: 0 };
    this.entradaVacia = 0;
    this.enCamino = 0;
    this.mostradas = this.celda.estadisticas.piezas;
  }

  // ---- Por cuadro ----

  actualizar() {
    // Sin vuelos pendientes, el contador debe coincidir con las piezas descargadas del modelo.
    if (this.vuelosActivos.size === 0 && this.enCamino === 0) this.mostradas = this.celda.estadisticas.piezas;

    const g = this.g;
    const brillo = this.brillo;
    g.clear();
    brillo.clear();

    // Entrada: 3 bloques en bruto (los que están viajando faltan).
    for (let i = 0; i < 3; i++) {
      if (i >= 3 - this.entradaVacia) continue;
      const p = this._celda(ENTRADA, 0.28 + i * 0.22, 0.5);
      cubo(g, p.x, p.y, COLORES.banda, 9, 8);
    }
    // Sobre cada CNC: el bloque según su estado (derivado del autómata, nunca guardado aparte).
    for (const cnc of ['CNC1', 'CNC2']) {
      if (this.llegando[cnc] > 0) continue;
      const estado = this.celda.estado(cnc);
      const p = this._arriba(cnc);
      if (estado === 'Cargado' || estado === 'Fresando') cubo(g, p.x, p.y, aclarar(COLORES.banda, 0.15), 10, 8);
      else if (estado === 'Falla') cubo(g, p.x, p.y, COLORES.fallo, 10, 8);
      else if (estado === 'Terminado') cubo(brillo, p.x, p.y, COLORES.celda, 10, 8);
    }
    // Pila de piezas terminadas (hasta 10 visibles): 2 x 2 por capa.
    const n = Math.min(this.mostradas, MAX_PILA);
    for (let i = 0; i < n; i++) {
      const col = i % 2;
      const fila = Math.floor(i / 2) % 2;
      const capa = Math.floor(i / 4);
      const p = this._celda(TERMINADAS, 0.34 + col * 0.34, 0.34 + fila * 0.34, capa * ALTO_BLOQUE);
      cubo(brillo, p.x, p.y, COLORES.celda, 8, 8);
    }
    // Contador.
    const c = aPantalla(TERMINADAS.x + 0.5, TERMINADAS.y + 0.5);
    this.contador.setPosition(c.x, c.y - 38 - Math.floor(n / 4) * ALTO_BLOQUE).setText(`${this.mostradas}`);

    // Bloques en vuelo.
    const v = this.vuelos;
    v.clear();
    for (const vuelo of this.vuelosActivos) {
      const p = vuelo.punto(vuelo.k);
      cubo(v, p.x, p.y, vuelo.color, 10, 8);
      if (vuelo.brillante) {
        v.lineStyle(2, COLORES.celda, 0.6);
        v.strokeCircle(p.x, p.y - 6, 10);
      }
    }
    this.glow.outerStrength = 3 + 2 * Math.sin(this.escena.time.now / 300);
  }

  destruir() {
    this._baja();
    for (const tw of this.tweens) tw.remove();
    [this.fijo, this.g, this.brillo, this.vuelos, this.contador].forEach((o) => o.destroy());
  }
}
