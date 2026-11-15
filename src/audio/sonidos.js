// Sonidos cortos con Web Audio, generados con osciladores (sin archivos de audio).
// El navegador solo deja sonar tras un gesto del jugador: el contexto se crea (o se reanuda) al primer sonido.
// Sin Phaser. Si el navegador no tiene Web Audio, todos los métodos no hacen nada.

export class Sonidos {
  constructor() {
    this.ctx = null;
    this.silenciado = false;
    this.volumen = 0.12;
    this._ultimo = new Map(); // nombre -> última marca de tiempo (ms), para no saturar
  }

  /** Contexto de audio listo para usar, o null. */
  _contexto() {
    if (this.silenciado) return null;
    if (!this.ctx) {
      const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Contexto) return null;
      this.ctx = new Contexto();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume?.();
    return this.ctx;
  }

  /** Un tono con envolvente rápida. frecuencia → fin (Hz) en `duracion` s, empezando `retraso` s después. */
  _tono({ frecuencia, fin = frecuencia, duracion = 0.1, tipo = 'sine', volumen = 1, retraso = 0 }) {
    const ctx = this._contexto();
    if (!ctx) return;
    const t0 = ctx.currentTime + retraso;
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, t0);
    if (fin !== frecuencia) osc.frequency.exponentialRampToValueAtTime(Math.max(1, fin), t0 + duracion);
    ganancia.gain.setValueAtTime(0.0001, t0);
    ganancia.gain.exponentialRampToValueAtTime(this.volumen * volumen, t0 + 0.01);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duracion + 0.02);
  }

  /** Evita repetir el mismo sonido en menos de `ms` milisegundos. */
  _libre(nombre, ms) {
    const ahora = Date.now();
    if (ahora - (this._ultimo.get(nombre) ?? 0) < ms) return false;
    this._ultimo.set(nombre, ahora);
    return true;
  }

  alternarSilencio() {
    this.silenciado = !this.silenciado;
    return this.silenciado;
  }

  /** Disparo de una transición: un "clic" corto. */
  disparo() {
    if (!this._libre('disparo', 60)) return;
    this._tono({ frecuencia: 660, fin: 880, duracion: 0.06, tipo: 'triangle', volumen: 0.7 });
  }

  /** Falla del husillo: tono descendente áspero. */
  falla() {
    this._tono({ frecuencia: 420, fin: 90, duracion: 0.45, tipo: 'sawtooth', volumen: 0.9 });
  }

  /** Reparación válida: dos tonos ascendentes. */
  reparacion() {
    this._tono({ frecuencia: 523, duracion: 0.1, tipo: 'sine' });
    this._tono({ frecuencia: 784, duracion: 0.16, tipo: 'sine', retraso: 0.1 });
  }

  /** Botón bloqueado por el supervisor: dos golpes graves. */
  bloqueado() {
    if (!this._libre('bloqueado', 120)) return;
    this._tono({ frecuencia: 170, duracion: 0.09, tipo: 'square', volumen: 0.8 });
    this._tono({ frecuencia: 150, duracion: 0.12, tipo: 'square', volumen: 0.8, retraso: 0.11 });
  }

  /** Logro: arpegio ascendente. */
  logro() {
    [523, 659, 784, 1047].forEach((f, i) => this._tono({ frecuencia: f, duracion: 0.16, tipo: 'triangle', retraso: i * 0.09 }));
  }

  /** Deadlock: caída grave y larga. */
  deadlock() {
    this._tono({ frecuencia: 220, fin: 55, duracion: 0.9, tipo: 'sawtooth', volumen: 1 });
    this._tono({ frecuencia: 110, fin: 40, duracion: 1.1, tipo: 'square', volumen: 0.6, retraso: 0.05 });
  }
}
