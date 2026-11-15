// Escena principal: la planta isométrica de 12 x 10 celdas (docs/arte.md).
// El update solo avanza el reloj y dibuja. No hay reglas de juego aquí.

import { COLORES, TEXTO_HEX, ANCHO, PLANTA, ALTOS, SEMILLA, TURNOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, aclarar, puntoEnPoligono } from '../iso/formas.js';
import { GestorEntrada, ACCIONES } from '../entrada/gestorEntrada.js';
import { MODELOS } from '../modelos.js';
import { Celda } from '../sed/celda.js';
import { Piloto } from '../sed/piloto.js';
import { Escenario } from '../entidades/Escenario.js';
import { EntidadCNC } from '../entidades/EntidadCNC.js';
import { EntidadBrazo } from '../entidades/EntidadBrazo.js';
import { EntidadAGV } from '../entidades/EntidadAGV.js';
import { FichasPlanta } from '../entidades/FichasPlanta.js';

const ALTO_MURO = ALTOS.MURO; // px (docs/arte.md, sección 3)
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
    this.aleatorio.restaurarEstado(SEMILLA); // cada vez que se abre la planta, la misma secuencia

    this.cameras.main.setBackgroundColor(COLORES.panel);
    this._dibujarSuelo();
    this._dibujarMuros();
    this._crearCelda();
    this._crearTextos();

    // Entrada unificada: mouse, teclado y táctil emiten las mismas acciones.
    this.entrada = new GestorEntrada(this);
    this._conectarAcciones();

    // Escenas superpuestas (vacías por ahora). Se lanzan una sola vez.
    for (const clave of ['HUDMaquina', 'Inspector']) {
      if (!this.scene.isActive(clave)) this.scene.launch(clave);
    }

    this.events.once('shutdown', () => {
      this.piloto.desactivar();
      this.entidades.forEach((e) => e.destruir());
      this.fichas.destruir();
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

  // ---- Celda: núcleo formal y entidades ----

  /** Crea el núcleo (2 CNC, 1 brazo, 2 AGV y la red de Petri) y la parte visible de cada máquina. */
  _crearCelda() {
    this.celda = new Celda({ modelos: MODELOS, reloj: this.reloj, aleatorio: this.aleatorio, turno: TURNOS[0] });
    this.celda.arrancar(); // programa los pedidos de AGV en el reloj
    this.piloto = new Piloto(this.celda);
    this.escenario = new Escenario(this);
    this.entidades = [
      new EntidadCNC(this, this.celda, 'CNC1'),
      new EntidadCNC(this, this.celda, 'CNC2'),
      new EntidadBrazo(this, this.celda, 'BRAZO'),
      new EntidadAGV(this, this.celda, 'AGV1'),
      new EntidadAGV(this, this.celda, 'AGV2'),
    ];
    this.fichas = new FichasPlanta(this, this.celda);
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
    this.textoDemo = this.add
      .text(ANCHO / 2, 40, '', { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.operacion })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);
  }

  /** Redibuja las entidades y las fichas, y actualiza los textos. */
  _dibujar() {
    const r = this.reloj;
    for (const e of this.entidades) e.actualizar(r.ahora);
    this.fichas.actualizar();
    const est = this.celda.estadisticas;
    this.textoEstado.setText(
      `Velocidad x${r.velocidad}   Piezas ${est.piezas}   Ciclos AGV ${est.ciclosAGV}   Pedidos ${this.celda.pedidos.length}`,
    );
    this.textoDemo.setText(this.celda.deadlock ? 'DEADLOCK' : this.piloto.activo ? 'MODO DEMOSTRACIÓN (D para salir)' : '');
    this.textoDemo.setColor(this.celda.deadlock ? TEXTO_HEX.fallo : TEXTO_HEX.operacion);
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
    e.on(ACCIONES.DEMO, () => this.piloto.alternar());
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
      const bajo = this._entidadEn(mundo.x, mundo.y);
      for (const m of this.entidades) {
        const dentro = !this._bajoPanel(x, y) && m === bajo;
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
      const m = this._entidadEn(mundo.x, mundo.y);
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

  /** La entidad bajo un punto del mundo (la de adelante si se solapan), o undefined. */
  _entidadEn(x, y) {
    return this.entidades
      .filter((e) => puntoEnPoligono(x, y, e.silueta))
      .sort((a, b) => b.cuerpo.depth - a.cuerpo.depth)[0];
  }

  /** Verdadero si el punto cae sobre un panel superpuesto abierto (el clic no llega a la planta). */
  _bajoPanel(x, y) {
    return ['HUDMaquina', 'Inspector'].some((c) => this.scene.get(c)?.contiene?.(x, y));
  }
}
