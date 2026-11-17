// Pantalla de título (docs/GDD.md, secciones 18.8 y 18.21): nombre del juego, integrantes, el jugador actual («Cambiar jugador»),
// los botones Jugar, Tutorial, Controles y Logros, y la tabla «Mejores puntajes» (top 10) con «Borrar puntajes».
// Al entrar por primera vez pide el nombre (máx. 16 caracteres, sin vacío) y recuerda el último.
// La partida empieza solo con "Jugar" o con Enter; "Tutorial" abre el Turno 0 y "Controles" muestra la tabla de controles.

import { COLORES, TEXTO_HEX, ANCHO, ALTO } from '../config.js';
import { Partida } from '../sed/partida.js';
import { resaltable } from './resaltar.js';
import { LOGROS } from '../sed/logros.js';
import { CONTROLES } from '../textos.js';
import { jugadorActual, fijarJugador, datosJugador, mejoresPuntajes, borrarPuntajes, validarNombre, fechaCorta } from '../guardado.js';
import { camaraLogica } from './camara.js';
import { ZONAS_TITULO } from '../disposicion.js';
import { fichaLogro, confirmar, pedirNombre } from './ventanas.js';

export const INTEGRANTES = ['Brian Acevedo', 'Brayan Amado', 'Manuel Carvajal'];

const DISPOSICION_TITULO = ZONAS_TITULO; // columna izquierda (juego y botones) y derecha (mejores puntajes): no se enciman
const GRIS = '#8794a3';

export class Titulo extends Phaser.Scene {
  constructor() {
    super('Titulo');
  }

  create() {
    camaraLogica(this);
    this.cameras.main.setBackgroundColor(COLORES.panel);
    this.cameras.main.fadeIn(350, 22, 27, 34);
    this._ya = false;
    this._modal = null;
    const t = (x, y, texto, estilo = {}) =>
      this.add.text(x, y, texto, { fontFamily: 'Arial', color: TEXTO_HEX.texto, ...estilo }).setOrigin(0.5);
    const iz = DISPOSICION_TITULO.izquierda;
    const cx = iz.x + iz.ancho / 2;

    t(cx, 52, 'RoboCell Tycoon 2.5D', { fontSize: '38px', fontStyle: 'bold' });
    t(cx, 92, 'Jefe de turno de una celda con 2 CNC, 1 brazo y 2 AGV', { fontSize: '14px', color: TEXTO_HEX.espera });
    t(cx, 124, 'Integrantes', { fontSize: '11px', color: GRIS });
    t(cx, 144, INTEGRANTES.join('  ·  '), { fontSize: '14px', fontStyle: 'bold' });

    // Jugador actual y «Cambiar jugador».
    this.txtJugador = this.add.text(cx - 8, 186, '', { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(1, 0.5);
    this.add.text(cx, 186, '·', { fontFamily: 'Arial', fontSize: '16px', color: GRIS }).setOrigin(0.5);
    const cambiar = this.add
      .text(cx + 8, 186, 'Cambiar jugador', { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera, padding: { x: 4, y: 12 } })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    cambiar.on('pointerover', () => cambiar.setColor(TEXTO_HEX.texto));
    cambiar.on('pointerout', () => cambiar.setColor(TEXTO_HEX.espera));
    cambiar.on('pointerup', () => this._pedirNombre(true));
    this.botonCambiar = cambiar;
    this.txtResumen = t(cx, 214, '', { fontSize: '13px', fontStyle: 'bold', color: '#d4af37' });

    // Botones (2 x 2).
    const boton = (x, y, etiqueta, color, accion, explicacion) => {
      const rect = this.add.rectangle(x, y, 204, 52, color).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
      t(x, y, etiqueta, { fontSize: '19px', fontStyle: 'bold' });
      rect.on('pointerover', () => {
        rect.setStrokeStyle(3, COLORES.espera, 1);
        this.explicacion.setText(explicacion);
      });
      rect.on('pointerout', () => {
        rect.setStrokeStyle(2, COLORES.texto, 0.9);
        this.explicacion.setText('');
      });
      rect.on('pointerup', () => !this._modal && accion());
      return rect;
    };
    this.botones = [
      boton(cx - 110, 272, 'Jugar', COLORES.operacion, () => this._iniciar(false), 'Los 3 turnos de 180 s: cumple la meta de piezas sin bloquear la celda.'),
      boton(cx + 110, 272, 'Tutorial', COLORES.mantenimiento, () => this._iniciar(true), 'Turno 0 guiado paso a paso, sin tiempo ni fallas.'),
      boton(cx - 110, 334, 'Controles', COLORES.banda, () => this._controles(true), 'Tabla de teclas, clics y gestos táctiles.'),
      boton(cx + 110, 334, 'Logros', 0x7a5c12, () => this._verLogros(true), 'Los 6 logros: toca uno para ver qué significa y cómo se gana.'),
    ];
    t(cx, 384, 'Enter: jugar   ·   T: tutorial   ·   C: controles   ·   L: logros', { fontSize: '12px', color: GRIS });
    this.explicacion = this.add.text(cx, 412, '', { fontFamily: 'Arial', fontSize: '13px', color: TEXTO_HEX.texto, align: 'center', wordWrap: { width: iz.ancho - 20 } }).setOrigin(0.5, 0);

    this._tablaPuntajes();
    this._panel();
    this._panelLogros();
    this._actualizarJugador();
    const libre = () => !this.panel.visible && !this.panelLogros.visible && !this._modal;
    this.input.keyboard?.on('keydown-ENTER', () => libre() && this._iniciar(false));
    this.input.keyboard?.on('keydown-T', () => libre() && this._iniciar(true));
    this.input.keyboard?.on('keydown-C', () => !this._modal && !this.panelLogros.visible && this._controles(!this.panel.visible));
    this.input.keyboard?.on('keydown-L', () => !this._modal && !this.panel.visible && this._verLogros(!this.panelLogros.visible));
    this.input.keyboard?.on('keydown-ESC', () => { if (!this._modal) { this._controles(false); this._verLogros(false); } });
    this.events.once('shutdown', () => this.input.keyboard?.removeAllListeners());
    // Primera vez: se pide el nombre (sin cancelar).
    if (!jugadorActual()) this._pedirNombre(false);
  }

  /** Abre la ventana del nombre. Cancelable solo si ya hay un jugador. */
  _pedirNombre(cancelable) {
    if (this._modal) return;
    this._modal = pedirNombre(this, (nombre) => {
      fijarJugador(nombre);
      this._actualizarJugador();
    }, { inicial: cancelable ? jugadorActual() ?? '' : '', cancelable, validar: validarNombre, alCerrar: () => this._libre() });
  }

  /** Se llama al cerrar cualquier ventana (nombre, confirmación o ficha de logro). */
  _libre() {
    this._modal = null;
  }

  _actualizarJugador() {
    const nombre = jugadorActual();
    this.jugador = nombre;
    this.txtJugador.setText(`Jugador: ${nombre ?? '—'}`);
    const d = datosJugador(nombre ?? '');
    const ganados = LOGROS.filter((l) => d.logros[l.id]).length;
    this.txtResumen.setText(`Tu mejor puntaje: ${d.mejorPuntaje}   ·   Logros: ${ganados} de ${LOGROS.length}`);
    this._dibujarPuntajes();
    this._rehacerLogros();
  }

  // ---- Mejores puntajes (top 10) ----

  _tablaPuntajes() {
    const z = DISPOSICION_TITULO.puntajes;
    const g = this.add.graphics();
    g.fillStyle(0x0d1117, 0.6).fillRoundedRect(z.x, z.y, z.ancho, z.alto, 8);
    g.lineStyle(2, 0xd4af37, 0.9).strokeRoundedRect(z.x, z.y, z.ancho, z.alto, 8);
    this.add.text(z.x + 16, z.y + 12, 'Mejores puntajes', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#d4af37' });
    this.COLUMNAS = [z.x + 16, z.x + 46, z.x + 214, z.x + 290, z.x + 350];
    ['#', 'Nombre', 'Puntaje', 'Turno', 'Fecha'].forEach((c, i) =>
      this.add.text(this.COLUMNAS[i], z.y + 48, c, { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: GRIS }));
    this.filasPuntajes = this.add.container(0, 0);
    // «Borrar puntajes» (pequeño, con confirmación dentro del juego).
    const bx = z.x + z.ancho - 144;
    const by = z.y + z.alto - 52;
    const borrar = resaltable(this.add.rectangle(bx, by, 128, 44, COLORES.panel).setOrigin(0).setInteractive({ useHandCursor: true }), [1, COLORES.fallo, 0.8]);
    this.add.text(bx + 64, by + 22, 'Borrar puntajes', { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#e57373' }).setOrigin(0.5);
    borrar.on('pointerup', () => {
      if (this._modal) return;
      this._modal = confirmar(this, '¿Borrar la tabla de mejores puntajes?\nLos logros de cada jugador se conservan.', () => {
        borrarPuntajes();
        this._actualizarJugador();
      }, { alCerrar: () => this._libre() });
    });
    this.botonBorrar = borrar;
    this.txtSinPuntajes = this.add.text(z.x + z.ancho / 2, z.y + 200, 'Todavía no hay puntajes.\nJuega una partida para entrar en la tabla.', {
      fontFamily: 'Arial', fontSize: '14px', color: GRIS, align: 'center',
    }).setOrigin(0.5);
  }

  _dibujarPuntajes() {
    const z = DISPOSICION_TITULO.puntajes;
    const lista = mejoresPuntajes();
    this.filasPuntajes.removeAll(true);
    this.txtSinPuntajes.setVisible(lista.length === 0);
    lista.forEach((p, i) => {
      const y = z.y + 72 + i * 36;
      const yo = p.nombre === this.jugador;
      if (i % 2 === 0) this.filasPuntajes.add(this.add.rectangle(z.x + 8, y - 6, z.ancho - 16, 32, 0xffffff, 0.04).setOrigin(0));
      const estilo = { fontFamily: 'Arial', fontSize: '14px', fontStyle: yo ? 'bold' : 'normal', color: i === 0 ? '#d4af37' : yo ? TEXTO_HEX.espera : TEXTO_HEX.texto };
      [String(i + 1), p.nombre, String(p.puntaje), `${p.turno} de 3`, fechaCorta(p.fecha)].forEach((v, k) =>
        this.filasPuntajes.add(this.add.text(this.COLUMNAS[k], y, v, estilo)));
    });
  }

  // ---- Logros (cada uno abre su ficha) ----

  _panelLogros() {
    this.panelLogros = this.add.container(0, 0).setVisible(false).setDepth(10);
    const x0 = 160;
    const y0 = 40;
    const ancho = ANCHO - 320;
    const fondo = this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.7).setOrigin(0).setInteractive();
    fondo.on('pointerup', () => this._verLogros(false));
    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 1).fillRoundedRect(x0, y0, ancho, 460, 8);
    marco.lineStyle(2, 0xd4af37, 1).strokeRoundedRect(x0, y0, ancho, 460, 8);
    const atrapa = this.add.rectangle(x0, y0, ancho, 460, 0, 0).setOrigin(0).setInteractive();
    this.tituloLogros = this.add.text(x0 + 20, y0 + 14, '', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#d4af37' });
    const ayuda = this.add.text(x0 + 20, y0 + 44, 'Toca un logro para ver qué significa y cómo se gana.', { fontFamily: 'Arial', fontSize: '12px', color: GRIS });
    this.listaLogros = this.add.container(0, 0);
    const cerrar = resaltable(this.add.rectangle(x0 + ancho / 2 - 70, y0 + 404, 140, 44, COLORES.banda).setOrigin(0).setInteractive({ useHandCursor: true }));
    cerrar.on('pointerup', () => this._verLogros(false));
    const tc = this.add.text(x0 + ancho / 2, y0 + 426, 'Cerrar', { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
    this.panelLogros.add([fondo, marco, atrapa, this.tituloLogros, ayuda, this.listaLogros, cerrar, tc]);
    this._geoLogros = { x0, y0, ancho };
  }

  _rehacerLogros() {
    const { x0, y0, ancho } = this._geoLogros;
    const d = datosJugador(this.jugador ?? '');
    this.listaLogros.removeAll(true);
    const ganados = LOGROS.filter((l) => d.logros[l.id]).length;
    this.tituloLogros.setText(`Logros de ${this.jugador ?? '—'} (${ganados} de ${LOGROS.length})`);
    LOGROS.forEach((l, i) => {
      const ganado = l.id in d.logros;
      const y = y0 + 70 + i * 54;
      const rect = resaltable(this.add.rectangle(x0 + 20, y, ancho - 40, 48, ganado ? 0x3a2f10 : 0x0d1117).setOrigin(0).setInteractive({ useHandCursor: true }), [1, ganado ? 0xd4af37 : COLORES.banda, 1]);
      rect.on('pointerup', () => this._abrirFicha(l));
      const nombre = this.add.text(x0 + 36, y + 6, `${ganado ? '★' : '☆'}  ${l.nombre}`, { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: ganado ? '#d4af37' : TEXTO_HEX.texto });
      const desc = this.add.text(x0 + 62, y + 27, l.comoSeGana, { fontFamily: 'Arial', fontSize: '11px', color: GRIS, wordWrap: { width: ancho - 220 } });
      const estado = this.add.text(x0 + ancho - 36, y + 8, ganado ? `Ganado${d.logros[l.id] ? ` · ${fechaCorta(d.logros[l.id])}` : ''}` : 'Bloqueado', {
        fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: ganado ? TEXTO_HEX.operacion : '#566170',
      }).setOrigin(1, 0);
      this.listaLogros.add([rect, nombre, desc, estado]);
    });
  }

  _abrirFicha(l) {
    if (this._modal) return;
    const d = datosJugador(this.jugador ?? '');
    this._modal = fichaLogro(this, l, { ganado: l.id in d.logros, fecha: d.logros[l.id], alCerrar: () => this._libre() });
  }

  _verLogros(ver) {
    if (ver) this._rehacerLogros();
    this.panelLogros.setVisible(ver);
  }

  /** Panel con la tabla de controles (oculto hasta pulsar "Controles"). */
  _panel() {
    const x0 = 110;
    const y0 = 36;
    const ancho = ANCHO - 220;
    this.panel = this.add.container(0, 0).setVisible(false).setDepth(10);
    const fondo = this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.7).setOrigin(0).setInteractive();
    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 1);
    marco.fillRect(x0, y0, ancho, 468);
    marco.lineStyle(2, COLORES.banda, 1);
    marco.strokeRect(x0, y0, ancho, 468);
    const estilo = (extra = {}) => ({ fontFamily: 'Arial', fontSize: '13px', color: TEXTO_HEX.texto, ...extra });
    const objetos = [fondo, marco, this.add.text(x0 + 16, y0 + 12, 'Controles', estilo({ fontSize: '20px', fontStyle: 'bold' }))];
    ['Acción', 'Mouse y teclado', 'Táctil'].forEach((c, i) => objetos.push(this.add.text(x0 + 16 + [0, 300, 530][i], y0 + 48, c, estilo({ fontStyle: 'bold', color: TEXTO_HEX.espera }))));
    CONTROLES.forEach((fila, r) => fila.forEach((c, i) => objetos.push(this.add.text(x0 + 16 + [0, 300, 530][i], y0 + 72 + r * 20, c, estilo({ fontSize: '12px' })))));
    const cerrar = resaltable(this.add.rectangle(x0 + ancho / 2, y0 + 442, 140, 34, COLORES.banda).setInteractive({ useHandCursor: true }));
    cerrar.on('pointerup', () => this._controles(false));
    objetos.push(cerrar, this.add.text(x0 + ancho / 2, y0 + 442, 'Cerrar', estilo({ fontStyle: 'bold' })).setOrigin(0.5));
    this.panel.add(objetos);
  }

  _controles(ver) {
    this.panel.setVisible(ver);
  }

  /** Fundido de salida y paso a la planta (con una Partida nueva: normal o tutorial). */
  _iniciar(tutorial) {
    if (this._ya || this._modal) return;
    if (!jugadorActual()) return this._pedirNombre(false);
    this._ya = true;
    this.registry.set('partida', new Partida({ tutorial }));
    this.cameras.main.fadeOut(300, 22, 27, 34);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Planta'));
  }
}
