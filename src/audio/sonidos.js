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
    if (this.silenciado) {
      this.zumbido(false);
      this.ambiente(false);
    }
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

  /** Tic del reloj: uno por segundo en los últimos 30 s del turno y en la cuenta 3, 2, 1. */
  tic() {
    if (!this._libre('tic', 200)) return;
    this._tono({ frecuencia: 1000, duracion: 0.04, tipo: 'square', volumen: 0.35 });
  }

  /** Zumbido de fábrica de fondo, muy suave: suena mientras el turno corre (activo = true). */
  ambiente(activo) {
    if (!activo || this.silenciado) {
      if (this._ambiente) {
        const { osc, osc2, ganancia, ctx } = this._ambiente;
        const t = ctx.currentTime;
        ganancia.gain.setValueAtTime(this.volumen * 0.07, t);
        ganancia.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        osc.stop(t + 0.35);
        osc2.stop(t + 0.35);
        this._ambiente = null;
      }
      return;
    }
    if (this._ambiente) return;
    const ctx = this._contexto();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.setValueAtTime(55, ctx.currentTime);
    osc2.frequency.setValueAtTime(82.5, ctx.currentTime);
    ganancia.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(this.volumen * 0.07, ctx.currentTime + 0.8);
    osc.connect(ganancia);
    osc2.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.start();
    osc2.start();
    this._ambiente = { osc, osc2, ganancia, ctx };
  }

  /** Clic de un botón de la interfaz. */
  clic() {
    if (!this._libre('clic', 40)) return;
    this._tono({ frecuencia: 440, fin: 300, duracion: 0.05, tipo: 'square', volumen: 0.45 });
  }

  /** "Ding" al terminar una pieza (la CNC queda Terminada). */
  ding() {
    this._tono({ frecuencia: 1318, duracion: 0.28, tipo: 'sine', volumen: 0.9 });
    this._tono({ frecuencia: 1760, duracion: 0.35, tipo: 'sine', volumen: 0.5, retraso: 0.06 });
  }

  /** Fanfarria corta al ganar un turno. */
  fanfarria() {
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]].forEach(([f, t]) => this._tono({ frecuencia: f, duracion: t === 0.38 ? 0.5 : 0.14, tipo: 'triangle', retraso: t }));
    this._tono({ frecuencia: 262, duracion: 0.7, tipo: 'sine', volumen: 0.6, retraso: 0.38 });
  }

  /** Turno perdido por tiempo: dos tonos que bajan. */
  derrota() {
    this._tono({ frecuencia: 392, duracion: 0.2, tipo: 'triangle' });
    this._tono({ frecuencia: 262, duracion: 0.4, tipo: 'triangle', retraso: 0.2 });
  }

  /** Zumbido de fresado: suena mientras alguna CNC fresa (activo = true) y se apaga con activo = false o en silencio. */
  zumbido(activo) {
    if (!activo || this.silenciado) {
      if (this._zumbido) {
        const { osc, osc2, ganancia, ctx } = this._zumbido;
        const t = ctx.currentTime;
        ganancia.gain.setValueAtTime(this.volumen * 0.3, t);
        ganancia.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        osc.stop(t + 0.12);
        osc2.stop(t + 0.12);
        this._zumbido = null;
      }
      return;
    }
    if (this._zumbido) return;
    const ctx = this._contexto();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = 'sawtooth';
    osc2.type = 'square';
    osc.frequency.setValueAtTime(96, ctx.currentTime);
    osc2.frequency.setValueAtTime(144, ctx.currentTime);
    ganancia.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(this.volumen * 0.3, ctx.currentTime + 0.15);
    osc.connect(ganancia);
    osc2.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.start();
    osc2.start();
    this._zumbido = { osc, osc2, ganancia, ctx };
  }

  /** Deadlock: caída grave y larga. */
  deadlock() {
    this._tono({ frecuencia: 220, fin: 55, duracion: 0.9, tipo: 'sawtooth', volumen: 1 });
    this._tono({ frecuencia: 110, fin: 40, duracion: 1.1, tipo: 'square', volumen: 0.6, retraso: 0.05 });
  }
}
