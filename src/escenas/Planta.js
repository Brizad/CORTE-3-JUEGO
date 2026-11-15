// Escena principal: la planta isométrica de 12 x 10 celdas (docs/arte.md).
// El update solo avanza el reloj y dibuja. No hay reglas de juego aquí.

import { COLORES, TEXTO_HEX, ANCHO, PLANTA, POSICIONES } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import {
  oscurecer, aclarar, puntosPrisma, dibujarPrisma, siluetaPrisma, puntoEnPoligono,
} from '../iso/formas.js';
import { GestorEntrada, ACCIONES } from '../entrada/gestorEntrada.js';

const ALTO_MURO = 24; // px (docs/arte.md, sección 3)
const ALTO_CNC = 40; // px (docs/arte.md, sección 4)
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2;
const DESPLAZAMIENTO_MAX = 240; // px de cámara desde el centro

export class Planta extends Phaser.Scene {
  constructor() {
    super('Planta');
  }

  create() {
    // Servicios creados en Arranque.
    this.reloj = this.registry.get('reloj');
    this.reloj.reiniciar();
    this.aleatorio = this.registry.get('aleatorio');

    this.cameras.main.setBackgroundColor(COLORES.panel);
    this._dibujarSuelo();
    this._dibujarMuros();
    this._crearMaquinas();
    this._crearTextos();

    // Entrada unificada: mouse, teclado y táctil emiten las mismas acciones.
    this.entrada = new GestorEntrada(this);
    this._conectarAcciones();

    // Escenas superpuestas (vacías por ahora). Se lanzan una sola vez.
    for (const clave of ['HUDMaquina', 'Inspector']) {
      if (!this.scene.isActive(clave)) this.scene.launch(clave);
    }

    this.events.once('shutdown', () => {
      this.entrada.destruir();
      this.scene.stop('HUDMaquina');
      this.scene.stop('Inspector');
    });
  }

  /** Por cuadro: avanza el reloj y dibuja. Nada más. */
  update(_tiempo, delta) {
    // delta llega en ms; se limita para no dar un salto enorme al volver a la pestaña.
    const dt = Math.min(delta, 100) / 1000;
    this.reloj.avanzar(dt * this.reloj.velocidad);
    this._dibujar();
  }

  // ---- Dibujo estático ----

  /** Suelo: 12 x 10 rombos con una línea de rejilla más oscura. */
  _dibujarSuelo() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORES.suelo, 1);
    g.lineStyle(1, oscurecer(COLORES.suelo, 0.25), 1);
    for (let gx = 0; gx < PLANTA.columnas; gx++) {
      for (let gy = 0; gy < PLANTA.filas; gy++) {
        const rombo = [aPantalla(gx, gy), aPantalla(gx + 1, gy), aPantalla(gx + 1, gy + 1), aPantalla(gx, gy + 1)];
        g.fillPoints(rombo, true);
        g.strokePoints(rombo, true);
      }
    }
  }

  /** Muros de 24 px en los dos bordes del fondo (gy = 0 y gx = 0). */
  _dibujarMuros() {
    const g = this.add.graphics().setDepth(1);
    const sube = (p) => ({ x: p.x, y: p.y - ALTO_MURO });
    // Borde de atrás a la derecha: su cara visible mira hacia adelante-izquierda (−20 %).
    g.fillStyle(oscurecer(COLORES.muro, 0.2), 1);
    for (let gx = 0; gx < PLANTA.columnas; gx++) {
      const a = aPantalla(gx, 0);
      const b = aPantalla(gx + 1, 0);
      g.fillPoints([a, b, sube(b), sube(a)], true);
    }
    // Borde de atrás a la izquierda: su cara visible mira hacia adelante-derecha (−35 %).
    g.fillStyle(oscurecer(COLORES.muro, 0.35), 1);
    for (let gy = 0; gy < PLANTA.filas; gy++) {
      const a = aPantalla(0, gy);
      const b = aPantalla(0, gy + 1);
      g.fillPoints([a, b, sube(b), sube(a)], true);
    }
    // Borde superior de los muros con la luz de arriba.
    g.lineStyle(2, aclarar(COLORES.muro, 0.2), 1);
    g.strokePoints(
      [aPantalla(PLANTA.columnas, 0), aPantalla(0, 0), aPantalla(0, PLANTA.filas)].map(sube),
      false,
    );
  }

  // ---- Máquinas ----

  /** Crea la CNC de prueba (CNC 1) en su celda de docs/arte.md. */
  _crearMaquinas() {
    const { x, y } = POSICIONES.CNC1;
    const pr = puntosPrisma(x, y, 1, 1, ALTO_CNC);
    this.maquinas = [
      {
        id: 'CNC1',
        nombre: 'CNC 1',
        pr,
        silueta: siluetaPrisma(pr),
        gfx: this.add.graphics().setDepth(10 + x + y),
        hover: false,
        sucia: true, // hay que redibujar
      },
    ];
  }

  /** Dibuja una CNC: prisma, ventana en la cara frontal, husillo y ícono de estado. */
  _dibujarCNC(m) {
    const g = m.gfx;
    const pr = m.pr;
    g.clear();

    // Al pasar el mouse, la máquina se aclara y se rodea con el color de espera.
    dibujarPrisma(g, pr, m.hover ? aclarar(COLORES.maquina, 0.2) : COLORES.maquina);

    // Ventana sobre la cara izquierda (interpolación entre D, C, Dt y Ct).
    const punto = (u, v) => ({
      x: pr.D.x + (pr.C.x - pr.D.x) * u + (pr.Dt.x - pr.D.x) * v,
      y: pr.D.y + (pr.C.y - pr.D.y) * u + (pr.Dt.y - pr.D.y) * v,
    });
    g.fillStyle(oscurecer(COLORES.maquina, 0.6), 1);
    g.fillPoints([punto(0.2, 0.3), punto(0.8, 0.3), punto(0.8, 0.75), punto(0.2, 0.75)], true);

    // Husillo: un prisma pequeño sobre la cara superior.
    const { x, y } = POSICIONES.CNC1;
    const h = puntosPrisma(x + 0.375, y + 0.375, 0.25, 0.25, 14);
    const sube = ALTO_CNC;
    const arriba = Object.fromEntries(Object.entries(h).map(([k, p]) => [k, { x: p.x, y: p.y - sube }]));
    dibujarPrisma(g, arriba, oscurecer(COLORES.maquina, 0.3));

    // Ícono del estado Libre: círculo vacío de 16 px en el color de espera.
    const centro = aPantalla(x + 0.5, y + 0.5);
    g.lineStyle(2, COLORES.espera, 1);
    g.strokeCircle(centro.x, centro.y - ALTO_CNC - 18, 7);

    if (m.hover) {
      g.lineStyle(2, COLORES.espera, 0.9);
      g.strokePoints(m.silueta, true);
    }
    m.sucia = false;
  }

  // ---- Textos de depuración ----

  _crearTextos() {
    const estilo = { fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto };
    this.textoEstado = this.add.text(8, 8, '', estilo).setDepth(100).setScrollFactor(0);
    this.textoFps = this.add
      .text(8, 24, '', { ...estilo, color: TEXTO_HEX.espera })
      .setDepth(100)
      .setScrollFactor(0)
      .setVisible(false);
    this.textoPausa = this.add
      .text(ANCHO / 2, 70, 'PAUSA', { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: TEXTO_HEX.espera })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0)
      .setVisible(false);
  }

  /** Redibuja lo que cambió y actualiza los textos. */
  _dibujar() {
    for (const m of this.maquinas) if (m.sucia) this._dibujarCNC(m);
    const r = this.reloj;
    this.textoEstado.setText(`Velocidad x${r.velocidad}`);
    this.textoPausa.setVisible(r.enPausa);
    if (this.textoFps.visible) {
      this.textoFps.setText(`FPS: ${Math.round(this.game.loop.actualFps)}   t simulación: ${r.ahora.toFixed(1)} s`);
    }
  }

  // ---- Acciones de entrada ----

  _conectarAcciones() {
    const e = this.entrada;
    const hud = () => this.scene.get('HUDMaquina');
    const inspector = () => this.scene.get('Inspector');

    e.on(ACCIONES.PAUSA, () => this.reloj.alternarPausa());
    e.on(ACCIONES.VELOCIDAD, ({ valor }) => this.reloj.cambiarVelocidad(valor));
    e.on(ACCIONES.FPS, () => this.textoFps.setVisible(!this.textoFps.visible));
    e.on(ACCIONES.INSPECTOR, () => inspector().alternar?.());
    e.on(ACCIONES.CERRAR, () => {
      hud().cerrar?.();
      inspector().cerrar?.();
    });
    e.on(ACCIONES.SOLICITAR_EVENTO, (datos) => {
      // Todavía no hay modelo formal: solo se registra la solicitud.
      console.debug('[entrada] solicitarEvento', datos);
    });

    // Pasar el mouse sobre una máquina la ilumina.
    e.on(ACCIONES.PUNTERO, ({ x, y }) => {
      const mundo = this.cameras.main.getWorldPoint(x, y);
      let sobreAlguna = false;
      for (const m of this.maquinas) {
        const dentro = !this._bajoPanel(x, y) && puntoEnPoligono(mundo.x, mundo.y, m.silueta);
        if (dentro !== m.hover) {
          m.hover = dentro;
          m.sucia = true;
        }
        sobreAlguna = sobreAlguna || dentro;
      }
      this.input.setDefaultCursor(sobreAlguna ? 'pointer' : 'default');
    });

    // Clic o toque: abre el HUD de la máquina bajo el puntero.
    e.on(ACCIONES.SELECCIONAR, ({ x, y }) => {
      if (this._bajoPanel(x, y)) return;
      const mundo = this.cameras.main.getWorldPoint(x, y);
      const m = this.maquinas.find((q) => puntoEnPoligono(mundo.x, mundo.y, q.silueta));
      if (m) hud().abrir?.(m.id, m.nombre);
      else hud().cerrar?.();
    });

    // Cámara: arrastre y rueda o pellizco.
    e.on(ACCIONES.ARRASTRE, ({ dx, dy }) => {
      const cam = this.cameras.main;
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX - dx / cam.zoom, -DESPLAZAMIENTO_MAX, DESPLAZAMIENTO_MAX);
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY - dy / cam.zoom, -DESPLAZAMIENTO_MAX, DESPLAZAMIENTO_MAX);
    });
    e.on(ACCIONES.ZOOM, ({ factor }) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX));
    });
  }

  /** Verdadero si el punto cae sobre un panel superpuesto abierto (el clic no llega a la planta). */
  _bajoPanel(x, y) {
    return ['HUDMaquina', 'Inspector'].some((c) => this.scene.get(c)?.contiene?.(x, y));
  }
}
