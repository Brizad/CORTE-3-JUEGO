// Pruebas del reloj de simulación y del generador pseudoaleatorio. Se ejecutan con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { Reloj } from '../src/sed/reloj.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { aPantalla, aCelda, profundidad } from '../src/iso/proyeccion.js';
import { SEMILLA } from '../src/config.js';

test('tres eventos en desorden se disparan en orden de tiempo', () => {
  const reloj = new Reloj();
  const orden = [];
  reloj.programar(5, () => orden.push('C'));
  reloj.programar(1, () => orden.push('A'));
  reloj.programar(3, () => orden.push('B'));
  const disparados = reloj.avanzar(10);
  assert.deepEqual(orden, ['A', 'B', 'C']);
  assert.deepEqual(disparados.map((d) => d.t), [1, 3, 5]);
  assert.equal(reloj.ahora, 10);
});

test('la misma semilla da la misma secuencia', () => {
  const a = crearAleatorio(SEMILLA);
  const b = crearAleatorio(SEMILLA);
  const secuenciaA = Array.from({ length: 20 }, () => a.siguiente());
  const secuenciaB = Array.from({ length: 20 }, () => b.siguiente());
  assert.deepEqual(secuenciaA, secuenciaB);
  // Una semilla distinta da otra secuencia.
  const c = crearAleatorio(SEMILLA + 1);
  const secuenciaC = Array.from({ length: 20 }, () => c.siguiente());
  assert.notDeepEqual(secuenciaA, secuenciaC);
});

test('los números aleatorios quedan en el rango pedido', () => {
  const r = crearAleatorio(SEMILLA);
  for (let i = 0; i < 1000; i++) {
    const x = r.siguiente();
    assert.ok(x >= 0 && x < 1);
    const f = r.entre(2, 8); // falla del husillo: entre 2 s y 8 s
    assert.ok(f >= 2 && f < 8);
  }
});

test('restaurar el estado repite la secuencia (reintento de turno)', () => {
  const r = crearAleatorio(SEMILLA);
  r.siguiente();
  const estado = r.obtenerEstado();
  const primera = [r.siguiente(), r.siguiente(), r.siguiente()];
  r.restaurarEstado(estado);
  const segunda = [r.siguiente(), r.siguiente(), r.siguiente()];
  assert.deepEqual(primera, segunda);
});

test('eventos con el mismo tiempo se disparan en orden de programación', () => {
  const reloj = new Reloj();
  const orden = [];
  reloj.programar(2, () => orden.push(1));
  reloj.programar(2, () => orden.push(2));
  reloj.programar(2, () => orden.push(3));
  reloj.avanzar(2);
  assert.deepEqual(orden, [1, 2, 3]);
});

test('un evento aún no vencido no se dispara', () => {
  const reloj = new Reloj();
  let disparado = false;
  reloj.programar(4, () => { disparado = true; });
  reloj.avanzar(3.9);
  assert.equal(disparado, false);
  assert.equal(reloj.pendientes(), 1);
  reloj.avanzar(0.1);
  assert.equal(disparado, true);
  assert.equal(reloj.pendientes(), 0);
});

test('un evento programado dentro de otro se dispara en su tiempo', () => {
  const reloj = new Reloj();
  const orden = [];
  reloj.programar(1, (r) => {
    orden.push('inicio');
    r.programarEn(2, () => orden.push('derivado')); // t = 3
  });
  reloj.programar(5, () => orden.push('final'));
  reloj.avanzar(10);
  assert.deepEqual(orden, ['inicio', 'derivado', 'final']);
});

test('pausa y velocidad', () => {
  const reloj = new Reloj();
  let n = 0;
  reloj.programar(1, () => { n++; });
  reloj.pausar();
  reloj.avanzar(5);
  assert.equal(n, 0);
  assert.equal(reloj.ahora, 0);
  reloj.reanudar();
  assert.equal(reloj.cambiarVelocidad(4), true);
  assert.equal(reloj.cambiarVelocidad(3), false); // no permitida
  assert.equal(reloj.velocidad, 4);
  reloj.avanzar(0.5 * reloj.velocidad); // 2 s de simulación
  assert.equal(n, 1);
  assert.equal(reloj.ahora, 2);
});

test('un evento cancelado no se dispara', () => {
  const reloj = new Reloj();
  const orden = [];
  const id = reloj.programar(1, () => orden.push('cancelado'));
  reloj.programar(2, () => orden.push('queda'));
  assert.equal(reloj.cancelar(id), true);
  reloj.avanzar(5);
  assert.deepEqual(orden, ['queda']);
});

test('la proyección isométrica 2:1 es reversible', () => {
  for (const [x, y] of [[0, 0], [3, 2], [11, 9], [5.5, 4.25]]) {
    const p = aPantalla(x, y);
    const c = aCelda(p.x, p.y);
    assert.ok(Math.abs(c.fx - x) < 1e-9 && Math.abs(c.fy - y) < 1e-9);
  }
  // Una celda más abajo a la derecha y otra a la izquierda, a distinta profundidad.
  assert.ok(profundidad(4, 3) > profundidad(3, 2));
});
