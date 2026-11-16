// Pantalla completa: el navegador puede negar el permiso o no tener la API; nunca debe lanzar un error (se vio en la prueba al azar:
// "HierarchyRequestError: The new child element contains the parent" y "TypeError: not granted" al pulsar G varias veces).
import test from 'node:test';
import assert from 'node:assert/strict';
import { alternarPantallaCompleta } from '../src/pantalla.js';

function conDocumento(doc, prueba) {
  const anterior = globalThis.document;
  globalThis.document = doc;
  try {
    prueba();
  } finally {
    globalThis.document = anterior;
  }
}

test('si no hay documento (Node) no hace nada ni lanza', () => {
  conDocumento(undefined, () => assert.doesNotThrow(() => alternarPantallaCompleta()));
});

test('pide pantalla completa sobre #game-container y sale si ya está en pantalla completa', () => {
  const llamadas = [];
  const contenedor = { requestFullscreen: () => { llamadas.push('entrar'); return Promise.resolve(); } };
  const doc = { fullscreenElement: null, getElementById: (id) => (id === 'game-container' ? contenedor : null), exitFullscreen: () => { llamadas.push('salir'); return Promise.resolve(); } };
  conDocumento(doc, () => {
    alternarPantallaCompleta();
    doc.fullscreenElement = contenedor;
    alternarPantallaCompleta();
  });
  assert.deepEqual(llamadas, ['entrar', 'salir']);
});

test('si el navegador niega el permiso (promesa rechazada o error síncrono) no se propaga nada', async () => {
  const rechazos = [];
  const alRechazo = (e) => rechazos.push(e);
  process.on('unhandledRejection', alRechazo);
  const negado = { requestFullscreen: () => Promise.reject(new TypeError('not granted')) };
  conDocumento({ fullscreenElement: null, getElementById: () => negado }, () => assert.doesNotThrow(() => alternarPantallaCompleta()));
  const lanza = { requestFullscreen: () => { throw new Error('no permitido'); } };
  conDocumento({ fullscreenElement: null, getElementById: () => lanza }, () => assert.doesNotThrow(() => alternarPantallaCompleta()));
  conDocumento({ fullscreenElement: null, getElementById: () => ({}) }, () => assert.doesNotThrow(() => alternarPantallaCompleta())); // sin la API
  await new Promise((r) => setTimeout(r, 20));
  process.off('unhandledRejection', alRechazo);
  assert.deepEqual(rechazos, [], 'la promesa rechazada debe quedar atendida');
});
