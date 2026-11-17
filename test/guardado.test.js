// Guardado local: jugadores, logros con fecha y "Mejores puntajes" (docs/GDD.md, secciones 18.14 y 18.21).
// Debe funcionar aunque el almacenamiento falle (incógnito, ZIP del aula virtual con bloqueo).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leerGuardado, CLAVE_GUARDADO, validarNombre, fijarJugador, jugadorActual, datosJugador, guardarLogros,
  registrarPuntaje, mejoresPuntajes, borrarPuntajes, fechaCorta, MAX_PUNTAJES,
} from '../src/guardado.js';

function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return { datos, getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = String(v); } };
}

test('sin nada guardado: ningún jugador, ningún puntaje', () => {
  const a = almacenFalso();
  assert.equal(jugadorActual(a), null);
  assert.deepEqual(mejoresPuntajes(a), []);
  assert.deepEqual(datosJugador('Ana', a), { mejorPuntaje: 0, logros: {} });
});

test('el nombre: máximo 16 caracteres, sin vacío y sin espacios a los lados', () => {
  assert.equal(validarNombre('  Ana  '), 'Ana');
  assert.equal(validarNombre(''), null);
  assert.equal(validarNombre('    '), null);
  assert.equal(validarNombre(null), null);
  assert.equal(validarNombre('Maximiliano Rodríguez').length, 16);
});

test('recuerda el último jugador y guarda los logros POR jugador, con su fecha', () => {
  const a = almacenFalso();
  assert.equal(fijarJugador('Ana', a), 'Ana');
  assert.equal(fijarJugador('', a), null);
  assert.equal(jugadorActual(a), 'Ana');
  guardarLogros('Ana', ['primera_pieza'], a, '2026-11-17T10:00:00.000Z');
  guardarLogros('Ana', ['primera_pieza', 'doble_husillo'], a, '2026-11-18T10:00:00.000Z');
  fijarJugador('Luis', a);
  assert.equal(jugadorActual(a), 'Luis');
  assert.deepEqual(datosJugador('Ana', a).logros, { primera_pieza: '2026-11-17T10:00:00.000Z', doble_husillo: '2026-11-18T10:00:00.000Z' });
  assert.deepEqual(datosJugador('Luis', a).logros, {});
  assert.equal(fechaCorta('2026-11-17T10:00:00.000Z').length, 10);
});

test('mejores puntajes: top 10 de mayor a menor, una fila por partida (se actualiza al reintentar)', () => {
  const a = almacenFalso();
  for (let i = 0; i < 12; i++) registrarPuntaje({ id: `p${i}`, nombre: `J${i}`, puntaje: i * 100, turno: 1 + (i % 3) }, a);
  const tabla = mejoresPuntajes(a);
  assert.equal(tabla.length, MAX_PUNTAJES);
  assert.deepEqual(tabla.map((p) => p.puntaje), [1100, 1000, 900, 800, 700, 600, 500, 400, 300, 200]);
  assert.ok(tabla.every((p) => p.nombre && p.turno && p.fecha));
  // La misma partida (mismo id) no se duplica: se actualiza.
  registrarPuntaje({ id: 'p11', nombre: 'J11', puntaje: 1500, turno: 3 }, a);
  assert.equal(mejoresPuntajes(a).filter((p) => p.id === 'p11').length, 1);
  assert.equal(mejoresPuntajes(a)[0].puntaje, 1500);
  assert.equal(datosJugador('J11', a).mejorPuntaje, 1500);
  // Borrar puntajes: la tabla queda vacía y los logros se conservan.
  guardarLogros('J11', ['ojo_de_radar'], a);
  borrarPuntajes(a);
  assert.deepEqual(mejoresPuntajes(a), []);
  assert.ok(datosJugador('J11', a).logros.ojo_de_radar);
});

test('un guardado dañado no rompe el juego', () => {
  for (const basura of ['no es json', '{"puntajes":5,"jugadores":"x"}', 'null', '[]', '{"puntajes":[{"nombre":"","puntaje":3},{"nombre":"Ana","puntaje":"x"}]}']) {
    const a = almacenFalso({ [CLAVE_GUARDADO]: basura });
    const g = leerGuardado(a);
    assert.ok(Array.isArray(g.puntajes));
    assert.equal(g.puntajes.length, 0);
    assert.equal(typeof g.jugadores, 'object');
  }
});

test('el guardado de la versión anterior (sin jugadores) pasa al jugador "Jugador"', () => {
  const a = almacenFalso({ [CLAVE_GUARDADO]: JSON.stringify({ mejorPuntaje: 900, logros: ['primera_pieza'] }) });
  assert.equal(datosJugador('Jugador', a).mejorPuntaje, 900);
  assert.ok('primera_pieza' in datosJugador('Jugador', a).logros);
});

test('si el almacenamiento lanza errores o no existe, no se propaga nada y la sesión sigue', () => {
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('lleno'); } };
  assert.equal(fijarJugador('Ana', roto), 'Ana');
  assert.equal(jugadorActual(roto), 'Ana'); // en memoria durante la sesión
  registrarPuntaje({ id: 'x', nombre: 'Ana', puntaje: 50, turno: 1 }, roto);
  assert.equal(mejoresPuntajes(roto).length, 1);
  guardarLogros('Ana', ['primera_pieza'], roto);
  borrarPuntajes(roto);
  assert.equal(fijarJugador('Bea', null), 'Bea');
  assert.deepEqual(mejoresPuntajes(null), []);
});
