// Gestor de entrada: mouse, teclado y táctil emiten las mismas acciones.
// Las demás capas escuchan acciones y nunca leen el dispositivo directamente.

import { VELOCIDADES, RES } from '../config.js';

/** Nombres de las acciones que emite el gestor. */
export const ACCIONES = {
  SELECCIONAR: 'seleccionar', // clic o toque: {x, y} en coordenadas de pantalla del juego
  SOLICITAR_EVENTO: 'solicitarEvento', // {codigo, origen}: un botón del HUD pide un evento
  PAUSA: 'pausa', // tecla P
  INSPECTOR: 'inspector', // tecla I
  VELOCIDAD: 'velocidad', // teclas 1, 2 y 4: {valor}
  CERRAR: 'cerrar', // tecla Esc
  FPS: 'fps', // tecla F1
  FORZAR_FALLA: 'forzarFalla', // tecla F: solo en desarrollo, fuerza falla_husillo en la CNC que fresa
  PANTALLA_COMPLETA: 'pantallaCompleta', // tecla G: entra o sale de pantalla completa (F ya fuerza fallas)
  RED_PETRI: 'redPetri', // tecla R: vista de la red de Petri sobre la planta
  SILENCIO: 'silencio', // tecla M: activa o desactiva los sonidos
  DEMO: 'demo', // tecla D: modo demostración (provisional, hasta que exista el HUD de eventos)
  PUNTERO: 'puntero', // el puntero se mueve: {x, y}
  ARRASTRE: 'arrastre', // arrastre con mouse o un dedo: {dx, dy}
  ZOOM: 'zoom', // rueda o pellizco: {factor}
};

// Distancia (px) a partir de la cual un gesto cuenta como arrastre y no como clic.
const UMBRAL_ARRASTRE = 6;

export class GestorEntrada {
  /**
   * @param {Phaser.Scene} escena Escena cuya entrada se escucha (la planta).
   */
  constructor(escena) {
    this.escena = escena;
    this.emisor = new Phaser.Events.EventEmitter();
    this._gesto = null; // {x0, y0, xa, ya, movido}
    this._distanciaPellizco = 0;
    this._activo = true;
    this._atendidas = new WeakSet();
    this._conectar();
  }

  /** Suscribe una función a una acción. */
  on(accion, fn, contexto) {
    this.emisor.on(accion, fn, contexto);
    return this;
  }

  /** Los botones del HUD llaman a este método: equivale a una acción de entrada. */
  solicitarEvento(codigo, origen) {
    this.emisor.emit(ACCIONES.SOLICITAR_EVENTO, { codigo, origen });
  }

  /** Desconecta todo. Se llama al cerrar la escena. */
  destruir() {
    const input = this.escena.input;
    input.off('pointerdown', this._alPulsar, this);
    input.off('pointermove', this._alMover, this);
    input.off('pointerup', this._alSoltar, this);
    input.off('pointerupoutside', this._alSoltar, this);
    input.off('wheel', this._alRueda, this);
    input.keyboard?.off('keydown', this._alTecla, this);
    this.emisor.removeAllListeners();
    this._activo = false;
  }

  // ---- Interno ----

  _conectar() {
    const input = this.escena.input;
    input.addPointer(2); // permite hasta 3 punteros para el pellizco
    input.on('pointerdown', this._alPulsar, this);
    input.on('pointermove', this._alMover, this);
    input.on('pointerup', this._alSoltar, this);
    input.on('pointerupoutside', this._alSoltar, this);
    input.on('wheel', this._alRueda, this);
    input.keyboard?.on('keydown', this._alTecla, this);
  }

  _emitir(accion, datos) {
    if (this._activo) this.emisor.emit(accion, datos);
  }

  _alPulsar(p) {
    const x = p.x / RES, y = p.y / RES;
    this._gesto = { x0: x, y0: y, xa: x, ya: y, movido: false };
  }

  _alMover(p) {
    this._emitir(ACCIONES.PUNTERO, { x: p.x / RES, y: p.y / RES });
    const input = this.escena.input;
    const p1 = input.pointer1;
    const p2 = input.pointer2;

    // Pellizco con dos dedos: acerca o aleja.
    if (p1?.isDown && p2?.isDown) {
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (this._distanciaPellizco > 0 && d > 0) {
        this._emitir(ACCIONES.ZOOM, { factor: d / this._distanciaPellizco });
      }
      this._distanciaPellizco = d;
      if (this._gesto) this._gesto.movido = true;
      return;
    }
    this._distanciaPellizco = 0;

    // Arrastre con el botón izquierdo o con un dedo.
    if (p.isDown && this._gesto) {
      const g = this._gesto;
      const px = p.x / RES, py = p.y / RES;
      if (!g.movido && Math.hypot(px - g.x0, py - g.y0) > UMBRAL_ARRASTRE) g.movido = true;
      if (g.movido) this._emitir(ACCIONES.ARRASTRE, { dx: px - g.xa, dy: py - g.ya });
      g.xa = px;
      g.ya = py;
    }
  }

  _alSoltar(p) {
    const g = this._gesto;
    this._gesto = null;
    this._distanciaPellizco = 0;
    if (g && !g.movido) this._emitir(ACCIONES.SELECCIONAR, { x: p.x / RES, y: p.y / RES });
  }

  _alRueda(_puntero, _objetos, _dx, dy) {
    this._emitir(ACCIONES.ZOOM, { factor: dy > 0 ? 0.9 : 1.1 });
  }

  _alTecla(evento) {
    // Cada tecla se atiende una sola vez aunque Phaser entregue el mismo evento varias veces (equipos lentos).
    if (this._atendidas.has(evento)) return;
    this._atendidas.add(evento);
    const tecla = evento.key;
    if (tecla === 'p' || tecla === 'P') this._emitir(ACCIONES.PAUSA);
    else if (tecla === 'i' || tecla === 'I') this._emitir(ACCIONES.INSPECTOR);
    else if (tecla === 'd' || tecla === 'D') this._emitir(ACCIONES.DEMO);
    else if (tecla === 'r' || tecla === 'R') this._emitir(ACCIONES.RED_PETRI);
    else if (tecla === 'm' || tecla === 'M') this._emitir(ACCIONES.SILENCIO);
    else if (tecla === 'g' || tecla === 'G') this._emitir(ACCIONES.PANTALLA_COMPLETA);
    else if (tecla === 'f' || tecla === 'F') this._emitir(ACCIONES.FORZAR_FALLA);
    else if (tecla === 'Escape') this._emitir(ACCIONES.CERRAR);
    else if (tecla === 'F1') {
      evento.preventDefault(); // evita la ayuda del navegador
      this._emitir(ACCIONES.FPS);
    } else if (VELOCIDADES.includes(Number(tecla)) && tecla.length === 1) {
      this._emitir(ACCIONES.VELOCIDAD, { valor: Number(tecla) });
    }
  }
}
