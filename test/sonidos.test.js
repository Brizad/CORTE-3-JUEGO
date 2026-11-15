// Los sonidos usan Web Audio: aquí se prueba con un AudioContext de mentira (no suena nada).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sonidos } from '../src/audio/sonidos.js';

function falso() {
  const osciladores = [];
  class Contexto {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() {
      const o = { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() { osciladores.push(o); }, stop() {} };
      return o;
    }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  return { Contexto, osciladores };
}

test('los 6 sonidos (disparo, falla, reparación, bloqueo, logro y deadlock) crean osciladores', () => {
  const { Contexto, osciladores } = falso();
  const anterior = globalThis.AudioContext;
  globalThis.AudioContext = Contexto;
  try {
    const s = new Sonidos();
    for (const nombre of ['disparo', 'falla', 'reparacion', 'bloqueado', 'logro', 'deadlock']) {
      const antes = osciladores.length;
      s[nombre]();
      assert.ok(osciladores.length > antes, `${nombre} no sonó`);
    }
  } finally {
    globalThis.AudioContext = anterior;
  }
});

test('en silencio no suena nada y sin Web Audio no falla', () => {
  const { Contexto, osciladores } = falso();
  const anterior = globalThis.AudioContext;
  globalThis.AudioContext = Contexto;
  try {
    const s = new Sonidos();
    assert.equal(s.alternarSilencio(), true);
    s.logro();
    assert.equal(osciladores.length, 0);
    globalThis.AudioContext = undefined;
    const t = new Sonidos();
    assert.doesNotThrow(() => t.deadlock());
  } finally {
    globalThis.AudioContext = anterior;
  }
});
