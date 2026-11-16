// Guardado local: mejor puntaje y logros (docs/GDD.md, sección 18.14). Debe funcionar aunque el almacenamiento falle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerGuardado, guardarResultado, CLAVE_GUARDADO } from '../src/guardado.js';

function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return { datos, getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = String(v); } };
}

test('sin nada guardado devuelve el guardado vacío', () => {
  assert.deepEqual(leerGuardado(almacenFalso()), { mejorPuntaje: 0, logros: [] });
});

test('guarda el mejor puntaje y no lo baja con un puntaje peor', () => {
  const a = almacenFalso();
  assert.equal(guardarResultado({ puntaje: 900, logros: [] }, a).mejorPuntaje, 900);
  assert.equal(guardarResultado({ puntaje: 300, logros: [] }, a).mejorPuntaje, 900);
  assert.equal(guardarResultado({ puntaje: 1200, logros: [] }, a).mejorPuntaje, 1200);
  assert.equal(leerGuardado(a).mejorPuntaje, 1200);
});

test('los logros se acumulan sin repetirse', () => {
  const a = almacenFalso();
  guardarResultado({ puntaje: 0, logros: ['primera_pieza'] }, a);
  const g = guardarResultado({ puntaje: 0, logros: ['primera_pieza', 'manos_seguras'] }, a);
  assert.deepEqual(g.logros.sort(), ['manos_seguras', 'primera_pieza']);
});

test('un guardado dañado no rompe el juego', () => {
  for (const basura of ['no es json', '{"mejorPuntaje":"x","logros":5}', 'null', '[]']) {
    const g = leerGuardado(almacenFalso({ [CLAVE_GUARDADO]: basura }));
    assert.equal(typeof g.mejorPuntaje, 'number');
    assert.ok(Array.isArray(g.logros));
  }
});

test('si el almacenamiento lanza errores o no existe, no se propaga nada', () => {
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('lleno'); } };
  assert.deepEqual(leerGuardado(roto), { mejorPuntaje: 0, logros: [] });
  assert.equal(guardarResultado({ puntaje: 50, logros: ['x'] }, roto).mejorPuntaje, 50);
  assert.deepEqual(leerGuardado(null), { mejorPuntaje: 0, logros: [] });
  assert.equal(guardarResultado({ puntaje: 10 }, null).mejorPuntaje, 10);
});
