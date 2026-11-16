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
import { Estaciones } from '../entidades/Estaciones.js';
import { Etiquetas } from '../entidades/Etiquetas.js';
import { VistaRed } from '../entidades/VistaRed.js';
import { Piezas } from '../entidades/Piezas.js';
import { Logros } from '../sed/logros.js';

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
    this.partida = this.registry.get('partida'); // turno actual, puntaje acumulado y logros
    this.sonidos = this.registry.get('sonidos');
    if (this.partida.rngInicio !== null) {
      // Reintento del turno: la misma semilla y el estado del generador del inicio del turno (GDD, sección 17).
      this.aleatorio.restaurarEstado(this.partida.rngInicio);
    } else {
      if (this.partida.turno === 0) this.aleatorio.restaurarEstado(SEMILLA); // la partida siempre empieza igual
      this.partida.rngInicio = this.aleatorio.obtenerEstado();
    }

    this.cameras.main.setBackgroundColor(COLORES.panel);
    this._dibujarSuelo();
    this._dibujarMuros();
    this._crearCelda();
    this._crearTextos();

    // Entrada unificada: mouse, teclado y táctil emiten las mismas acciones.
    this.entrada = new GestorEntrada(this);
    this._conectarAcciones();

    // Escenas superpuestas. Al reiniciar la planta (otro turno) todavía hay una parada en cola de la partida anterior:
    // se vuelve a pedir la parada y luego el lanzamiento, así quedan siempre recién creadas.
    for (const clave of ['HUDMaquina', 'Inspector', 'HUDGeneral', ...(this.partida.tutorial ? ['Tutorial'] : [])]) {
      this.scene.stop(clave);
      this.scene.launch(clave);
    }

    this.events.once('shutdown', () => {
      this.piloto.desactivar();
      this.entidades.forEach((e) => e.destruir());
      this.fichas.destruir();
      this.estaciones.destruir();
      this.etiquetas.destruir();
      this.vistaRed.destruir();
      this.piezas.destruir();
      this._bajaTemblor();
      this.logros.detener();
      this.scene.stop('Resultados');
      this.scene.stop('GameOver');
      this.entrada.destruir();
      this.scene.stop('HUDMaquina');
      this.scene.stop('Inspector');
      this.scene.stop('HUDGeneral');
      this.scene.stop('Tutorial');
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
    this.celda = new Celda({
      modelos: MODELOS,
      reloj: this.reloj,
      aleatorio: this.aleatorio,
      turno: this.partida.parametros, // meta, probabilidad de falla y pedidos del turno
      puntajeInicial: this.partida.puntaje,
    });
    // Logros del GDD: se vigilan con los eventos de la Celda y avisan con un tween en el HUD.
    this.logrosDelTurno = [];
    this.logros = new Logros(this.partida.logros, this.partida.turno, (logro) => {
      if (this.partida.tutorial) return; // el tutorial no guarda logros
      this.logrosDelTurno.push(logro.id);
      this.events.emit('logro', logro);
      this.sonidos.logro();
    });
    this.logros.vigilar(this.celda);
    this.celda.arrancar(); // programa los pedidos de AGV y el fin del turno en el reloj
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
    this.estaciones = new Estaciones(this, this.celda);
    this.etiquetas = new Etiquetas(this, this.celda, () => this.fichas);
    this.vistaRed = new VistaRed(this, this.celda, () => this.fichas);
    this.piezas = new Piezas(this, this.celda, () => this.entidades);
    // Insistir en un botón rojo (evento que el supervisor deshabilita): la cámara tiembla 0,3 s (docs/arte.md, sección 9).
    this._bajaTemblor = this.celda.alCambiar((e) => {
      if (e.tipo === 'rechazo' && e.motivo === 'supervisor') this.cameras.main.shake(300, 0.004);
      // Interbloqueo: el radar se pone rojo, la cámara tiembla y sale el game over (la simulación ya está detenida).
      if (e.tipo === 'deadlock') {
        this.cameras.main.shake(300, 0.006);
        // En el tutorial no hay game over: el Tutorial explica el interbloqueo y se abre la vista de la red.
        if (this.partida.tutorial) {
          this.scene.get('HUDMaquina').cerrar?.(); // el panel taparía la vista de la red
          this.vistaRed.activar();
        }
        else this.scene.launch('GameOver');
      }
      // Controlador de celda: la red tiene un lugar más, se rehacen las fichas.
      if (e.tipo === 'controlador') {
        this.fichas.destruir();
        this.fichas = new FichasPlanta(this, this.celda);
      }
      if (e.tipo === 'restaurado') this.piloto.reprogramar();
      // Fin del turno (meta cumplida o se acabó el tiempo): resultados.
      if (e.tipo === 'finTurno') {
        this.scene.get('HUDMaquina').cerrar?.();
        this.scene.get('Inspector').cerrar?.();
        this.scene.stop('GameOver');
        this.partida.terminarTurno(e.resumen);
        this.scene.launch('Resultados');
      }
      this._sonar(e);
    });
  }

  // ---- Textos de depuración ----

  _crearTextos() {
    const estilo = { fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto };
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
      .text(ANCHO / 2, 98, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.operacion })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);
  }

  /** Redibuja las entidades y las fichas, y actualiza los textos. */
  _dibujar() {
    const r = this.reloj;
    for (const e of this.entidades) e.actualizar(r.ahora);
    this.fichas.actualizar();
    this.estaciones.actualizar();
    this.vistaRed.actualizar();
    this.piezas.actualizar();
    // Etiqueta pequeña de la demostración (el puntaje, el reloj y lo demás los muestra el HUD de partida).
    this.textoDemo.setText(this.piloto.activo ? 'DEMO' : '');
    this.textoPausa.setVisible(r.enPausa);
    if (this.textoFps.visible) {
      this.textoFps.setText(`FPS: ${Math.round(this.game.loop.actualFps)}   t simulación: ${r.ahora.toFixed(1)} s`);
    }
  }

  /** Sonidos cortos: disparo de transición, falla, reparación, botón bloqueado y deadlock (el del logro suena al ganarlo). */
  _sonar(e) {
    const s = this.sonidos;
    if (e.tipo === 'disparo') s.disparo();
    else if (e.tipo === 'automata' && e.evento === 'falla_husillo') s.falla();
    else if (e.tipo === 'reparacion' && e.valida) s.reparacion();
    else if (e.tipo === 'rechazo' && e.motivo === 'supervisor') s.bloqueado();
    else if (e.tipo === 'deadlock') s.deadlock();
  }

  // ---- Acciones de entrada ----

  _conectarAcciones() {
    const e = this.entrada;
    const hud = () => this.scene.get('HUDMaquina');
    const inspector = () => this.scene.get('Inspector');

    e.on(ACCIONES.PAUSA, () => {
      // El Inspector pausa por su cuenta y tras un deadlock la simulación queda detenida.
      if (this.celda.deadlock || this.celda.terminado || this.scene.get('Inspector').abierto) return;
      this.reloj.alternarPausa();
    });
    e.on(ACCIONES.VELOCIDAD, ({ valor }) => this.reloj.cambiarVelocidad(valor));
    e.on(ACCIONES.FPS, () => this.textoFps.setVisible(!this.textoFps.visible));
    e.on(ACCIONES.DEMO, () => {
      if (!this.partida.tutorial) this.piloto.alternar();
    });
    // Solo en desarrollo (npm run dev): fuerza una falla_husillo para probar la consola de reparación.
    e.on(ACCIONES.FORZAR_FALLA, () => {
      if (!import.meta.env?.DEV) return;
      if (!this.celda.forzarFalla()) this.scene.get('HUDGeneral').alertas?.avisar('Tecla F: no hay ninguna CNC fresando.', 'espera');
    });
    e.on(ACCIONES.INSPECTOR, () => {
      if (!this.celda.terminado) inspector().alternar?.();
    });
    e.on(ACCIONES.SILENCIO, () => this.sonidos.alternarSilencio());
    e.on(ACCIONES.RED_PETRI, () => {
      // Con la consola de reparación abierta, R es el comando de reset: no abre la vista.
      const h = hud();
      if (h.abierto && h._modoConsola && h._pestana === 'automata') return;
      this.vistaRed.alternar();
    });
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
      this.etiquetas.mover(mundo.x, mundo.y, this._bajoPanel(x, y) || !!bajo);
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
      if (!m) this.etiquetas.tocar(mundo.x, mundo.y); // toque sobre un lugar: muestra su etiqueta unos segundos
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
    return ['HUDMaquina', 'Inspector', 'HUDGeneral', 'Tutorial', 'GameOver', 'Resultados'].some((c) => this.scene.get(c)?.contiene?.(x, y));
  }
}
