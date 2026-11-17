// Escena principal: la planta isométrica de 12 x 10 celdas (docs/arte.md).
// El update solo avanza el reloj y dibuja. No hay reglas de juego aquí.

import { COLORES, TEXTO_HEX, ANCHO, RES, PLANTA, ALTOS, SEMILLA, TURNOS, VELOCIDADES } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, aclarar, puntoEnPoligono } from '../iso/formas.js';
import { GestorEntrada, ACCIONES } from '../entrada/gestorEntrada.js';
import { MODELOS } from '../modelos.js';
import { Celda } from '../sed/celda.js';
import { Piloto } from '../sed/piloto.js';
import { Acciones } from '../sed/acciones.js';
import { Rotulos } from '../entidades/Rotulos.js';
import { Escenario } from '../entidades/Escenario.js';
import { EntidadCNC } from '../entidades/EntidadCNC.js';
import { EntidadBrazo } from '../entidades/EntidadBrazo.js';
import { EntidadAGV } from '../entidades/EntidadAGV.js';
import { FichasPlanta } from '../entidades/FichasPlanta.js';
import { Estaciones } from '../entidades/Estaciones.js';
import { Etiquetas } from '../entidades/Etiquetas.js';
import { VistaRed } from '../entidades/VistaRed.js';
import { Piezas } from '../entidades/Piezas.js';
import { Efectos } from '../entidades/Efectos.js';
import { Logros } from '../sed/logros.js';
import { camaraLogica } from './camara.js';
import { alternarPantallaCompleta } from '../pantalla.js';
import { guardarResultado } from '../guardado.js';
import { DESCRIPCION_MAQUINA } from '../textos.js';

const ALTO_MURO = ALTOS.MURO; // px (docs/arte.md, sección 3)
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2;
const DESPLAZAMIENTO_MAX = 240; // px de cámara desde el centro

export class Planta extends Phaser.Scene {
  constructor() {
    super('Planta');
  }

  create() {
    camaraLogica(this);
    // Vista de la planta en coordenadas lógicas (zoom alrededor del centro de 960x540); _aplicarVista la pasa a la cámara real.
    this.vista = { zoom: 1, sx: 0, sy: 0 };
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
    this.cameras.main.fadeIn(350, 22, 27, 34); // transición desde el título o los resultados
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

    // Intro corta (5 líneas) antes del turno 1, una sola vez por partida. Con ?intro=0 en la dirección no sale (pruebas automáticas).
    const sinIntro = new URLSearchParams(globalThis.location?.search ?? '').get('intro') === '0';
    this.scene.stop('Ayuda');
    if (!this.partida.tutorial && this.partida.turno === 0 && !this.partida.introVista && !sinIntro) {
      this.partida.introVista = true;
      this.scene.launch('Ayuda', { inicio: true });
    }

    this.events.once('shutdown', () => {
      this.piloto.desactivar();
      this.entidades.forEach((e) => e.destruir());
      this.fichas.destruir();
      this.estaciones.destruir();
      this.etiquetas.destruir();
      this.vistaRed.destruir();
      this.piezas.destruir();
      this.efectos.destruir();
      this.rotulos.destruir();
      this.acciones.destruir();
      this.sonidos.zumbido(false);
      this._bajaTemblor();
      this.logros.detener();
      this.scene.stop('Resultados');
      this.scene.stop('GameOver');
      this.scene.stop('MenuPausa');
      this.scene.stop('Ayuda');
      this.events.off('ayuda');
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
    this._vigilarFps(dt);
    this.reloj.avanzar(dt * this.reloj.velocidad);
    this.acciones.actualizar(); // siguiente evento del brazo si hay una secuencia en marcha
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
      this.cameras.main.flash(320, 212, 175, 55); // destello dorado al ganar un logro
    });
    this.logros.vigilar(this.celda);
    this.celda.arrancar(); // programa los pedidos de AGV y el fin del turno en el reloj
    this.piloto = new Piloto(this.celda);
    this.acciones = new Acciones(this.celda); // verbos de juego: encadenan los eventos reales del autómata (sección 18.19)
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
    this.efectos = new Efectos(this, this.celda, () => this.entidades);
    this.piezas.efectos = this.efectos;
    this.rotulos = new Rotulos(this, this.celda, () => this.entidades);
    this._lento = 0; // segundos seguidos por debajo de 50 fps
    // Insistir en un botón rojo (evento que el supervisor deshabilita): la cámara tiembla 0,3 s (docs/arte.md, sección 9).
    this._bajaTemblor = this.celda.alCambiar((e) => {
      if (e.tipo === 'rechazo' && e.motivo === 'supervisor') this.cameras.main.shake(300, 0.004);
      // Falla del husillo: la cámara tiembla y la pantalla brilla un instante (bloom).
      if (e.tipo === 'automata' && e.evento === 'falla_husillo') {
        this.cameras.main.shake(300, 0.006);
        this.efectos.pulsoBloom();
      }
      // Interbloqueo: el radar se pone rojo, la cámara tiembla y sale el game over (la simulación ya está detenida).
      if (e.tipo === 'deadlock') {
        this.cameras.main.shake(300, 0.006);
        this.efectos.pulsoBloom(900);
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
        if (!this.partida.tutorial) guardarResultado({ puntaje: e.resumen.puntaje, logros: [...this.partida.logros.ganados] }); // mejor puntaje y logros
        this.scene.launch('Resultados');
      }
      this._sonar(e);
    });
  }

  // ---- Textos de depuración ----

  _crearTextos() {
    const estilo = { fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto };
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

  /** Si el juego baja de 50 fps durante 4 s seguidos, se reducen los efectos (partículas, bloom y glow de piezas). */
  _vigilarFps(dt) {
    if (this.efectos.reducido || new URLSearchParams(globalThis.location?.search ?? '').get('auto') === '0') return;
    this._lento = this.game.loop.actualFps < 50 ? this._lento + dt : 0;
    if (this._lento > 4) this.efectos.reducir();
  }

  /** Redibuja las entidades y las fichas, y actualiza los textos. */
  _dibujar() {
    const r = this.reloj;
    for (const e of this.entidades) e.actualizar(r.ahora);
    this.fichas.actualizar();
    this.estaciones.actualizar();
    this.vistaRed.actualizar();
    const hud = this.scene.get('HUDMaquina');
    this.efectos.actualizar(hud.abierto ? hud.maquinaId : null); // glow en la máquina seleccionada
    this.piezas.actualizar();
    this.rotulos.actualizar();
    // Zumbido de fresado mientras alguna CNC fresa y la simulación corre.
    this.sonidos.zumbido(!this.reloj.enPausa && ['CNC1', 'CNC2'].some((id) => this.celda.estado(id) === 'Fresando'));
    // Etiqueta pequeña de la demostración (el puntaje, el reloj y lo demás los muestra el HUD de partida).
    this.textoDemo.setText(this.piloto.activo ? 'DEMO' : '');
    this.textoPausa.setVisible(false); // la pausa la anuncian el menú de pausa y el HUD ("· pausa")
    const fps = this.scene.get('HUDGeneral')?.txtFps;
    if (fps?.visible) fps.setText(`FPS: ${Math.round(this.game.loop.actualFps)}   t simulación: ${r.ahora.toFixed(1)} s`);
  }

  /** Sonidos cortos: disparo de transición, falla, reparación, botón bloqueado y deadlock (el del logro suena al ganarlo). */
  _sonar(e) {
    const s = this.sonidos;
    if (e.tipo === 'disparo') s.disparo();
    else if (e.tipo === 'automata' && e.evento === 'falla_husillo') s.falla();
    else if (e.tipo === 'reparacion' && e.valida) s.reparacion();
    else if (e.tipo === 'rechazo' && e.motivo === 'supervisor') s.bloqueado();
    else if (e.tipo === 'deadlock') s.deadlock();
    else if (e.tipo === 'automata' && e.evento === 'fin_fresado') s.ding();
    else if (e.tipo === 'finTurno' && !this.partida.tutorial) (e.resultado === 'victoria' ? s.fanfarria() : s.derrota());
  }

  // ---- Acciones de entrada ----

  _conectarAcciones() {
    const e = this.entrada;
    const hud = () => this.scene.get('HUDMaquina');
    const inspector = () => this.scene.get('Inspector');

    // P y el botón de pausa abren o cierran el menú de pausa (que detiene el reloj mientras está abierto).
    e.on(ACCIONES.PAUSA, () => {
      // El Inspector pausa por su cuenta y tras un deadlock o el fin del turno la simulación queda detenida.
      if (this.celda.deadlock || this.celda.terminado || this.scene.get('Inspector').abierto) return;
      const menu = this.scene.get('MenuPausa');
      if (menu.scene.isActive()) menu.cerrar();
      else if (!this.scene.get('Ayuda').scene.isActive()) this.scene.launch('MenuPausa');
    });
    // ? abre o cierra la ayuda (con la simulación en pausa mientras está abierta).
    const alternarAyuda = () => {
      const ayuda = this.scene.get('Ayuda');
      if (ayuda.scene.isActive()) ayuda.cerrar();
      else if (!this.scene.get('Inspector').abierto && !this.celda.deadlock && !this.celda.terminado) this.scene.launch('Ayuda', {});
      else if (this.celda.deadlock || this.celda.terminado) this.scene.launch('Ayuda', {}); // la simulación ya está detenida
    };
    e.on(ACCIONES.AYUDA, alternarAyuda);
    this.events.on('ayuda', alternarAyuda);
    e.on(ACCIONES.VELOCIDAD, ({ valor }) => this.reloj.cambiarVelocidad(valor));
    e.on(ACCIONES.VELOCIDAD_CICLO, () => this.reloj.cambiarVelocidad(VELOCIDADES[(VELOCIDADES.indexOf(this.reloj.velocidad) + 1) % VELOCIDADES.length]));
    // Atajos de juego: 1 y 2 eligen la CNC, Espacio hace su acción principal, Q y W despachan los AGV y Tab cambia de pestaña.
    const libre = () => !this.celda.terminado && !this.celda.deadlock && !['Ayuda', 'MenuPausa', 'Inspector'].some((c) => this.scene.get(c)?.contiene?.(0, 0));
    e.on(ACCIONES.ELEGIR_CNC, ({ n }) => {
      if (!libre()) return;
      const m = this.entidades.find((q) => q.id === `CNC${n}`);
      if (m) hud().abrir?.(m.id, m.nombre);
    });
    e.on(ACCIONES.ACCION_PRINCIPAL, () => {
      const h = hud();
      if (!libre() || !h.abierto) return;
      h.accionPrincipal();
    });
    e.on(ACCIONES.DESPACHAR, ({ n }) => {
      if (libre()) this.scene.get('HUDGeneral')?._despachar?.(`AGV${n}`);
    });
    e.on(ACCIONES.PESTANA, () => {
      if (hud().abierto) hud().alternarPestana();
    });
    e.on(ACCIONES.FPS, () => {
      const fps = this.scene.get('HUDGeneral')?.txtFps;
      fps?.setVisible(!fps.visible);
    });
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
    e.on(ACCIONES.PANTALLA_COMPLETA, () => alternarPantallaCompleta());
    e.on(ACCIONES.SILENCIO, () => {
      // M o el botón del altavoz. Al volver a activar el sonido suena un clic para confirmarlo.
      if (!this.sonidos.alternarSilencio()) this.sonidos.clic();
    });
    e.on(ACCIONES.RED_PETRI, () => {
      // Con la consola de reparación abierta, R es el comando de reset: no abre la vista.
      const h = hud();
      if (h.abierto && h._modoConsola && h._pestana !== 'composicion') return;
      this.vistaRed.alternar();
    });
    e.on(ACCIONES.CERRAR, () => {
      // Esc cierra primero la ayuda, luego el menú de pausa y por último los paneles.
      const ayuda = this.scene.get('Ayuda');
      const menu = this.scene.get('MenuPausa');
      if (ayuda.scene.isActive()) return ayuda.cerrar();
      if (menu.scene.isActive()) return menu.cerrar();
      hud().cerrar?.();
      inspector().cerrar?.();
    });
    e.on(ACCIONES.SOLICITAR_EVENTO, (datos) => {
      // Todavía no hay modelo formal: solo se registra la solicitud.
      console.debug('[entrada] solicitarEvento', datos);
    });

    // Pasar el mouse sobre una máquina la ilumina.
    e.on(ACCIONES.PUNTERO, ({ x, y }) => {
      const mundo = this.cameras.main.getWorldPoint(x * RES, y * RES);
      let sobreAlguna = false;
      const bajo = this._entidadEn(mundo.x, mundo.y);
      const hud0 = this.scene.get('HUDGeneral');
      if (hud0) hud0.sobreMaquina = bajo && !this._bajoPanel(x, y) ? DESCRIPCION_MAQUINA[bajo.id] ?? null : null;
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
      const mundo = this.cameras.main.getWorldPoint(x * RES, y * RES);
      const m = this._entidadEn(mundo.x, mundo.y);
      if (!m) this.etiquetas.tocar(mundo.x, mundo.y); // toque sobre un lugar: muestra su etiqueta unos segundos
      else this.scene.get('HUDGeneral')?.explicar?.(DESCRIPCION_MAQUINA[m.id]); // toque sobre una máquina: su frase unos segundos
      if (m) this.sonidos.clic();
      if (m) hud().abrir?.(m.id, m.nombre);
      else hud().cerrar?.();
    });

    // Cámara: arrastre y rueda o pellizco.
    e.on(ACCIONES.ARRASTRE, ({ dx, dy }) => {
      const v = this.vista;
      v.sx = Phaser.Math.Clamp(v.sx - dx / v.zoom, -DESPLAZAMIENTO_MAX, DESPLAZAMIENTO_MAX);
      v.sy = Phaser.Math.Clamp(v.sy - dy / v.zoom, -DESPLAZAMIENTO_MAX, DESPLAZAMIENTO_MAX);
      this._aplicarVista();
    });
    e.on(ACCIONES.ZOOM, ({ factor }) => {
      this.vista.zoom = Phaser.Math.Clamp(this.vista.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      this._aplicarVista();
    });
  }

  /** Pasa la vista lógica (zoom en torno al centro de 960x540) a la cámara de alta resolución (origen arriba a la izquierda). */
  _aplicarVista() {
    const { zoom, sx, sy } = this.vista;
    const cam = this.cameras.main;
    cam.setZoom(zoom * RES);
    cam.setScroll(sx + ANCHO / 2 - ANCHO / 2 / zoom, sy + 270 - 270 / zoom);
  }

  /** Posición en la pantalla lógica (960x540) de un punto del mundo. */
  aPantallaLogica(x, y) {
    const { zoom, sx, sy } = this.vista;
    return { x: (x - sx - ANCHO / 2) * zoom + ANCHO / 2, y: (y - sy - 270) * zoom + 270 };
  }

  /** La entidad bajo un punto del mundo (la de adelante si se solapan), o undefined. */
  _entidadEn(x, y) {
    return this.entidades
      .filter((e) => puntoEnPoligono(x, y, e.silueta))
      .sort((a, b) => b.cuerpo.depth - a.cuerpo.depth)[0];
  }

  /** Verdadero si el punto cae sobre un panel superpuesto abierto (el clic no llega a la planta). */
  _bajoPanel(x, y) {
    return ['Ayuda', 'MenuPausa', 'HUDMaquina', 'Inspector', 'HUDGeneral', 'Tutorial', 'GameOver', 'Resultados'].some((c) => this.scene.get(c)?.contiene?.(x, y));
  }
}
