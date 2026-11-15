// Árbol de cobertura de Karp y Miller y radar (docs/modelo/petri.md, secciones 6 y 8; docs/GDD.md, sección 9).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RedPetri } from '../src/sed/redPetri.js';
import { arbolCobertura, explorar, claveMarcado, nombreMarcado } from '../src/sed/cobertura.js';
import { cargarModelo } from './ayudas.js';

const original = () => new RedPetri(cargarModelo('red_agv.json'));
const corregida = () => new RedPetri(cargarModelo('red_agv_corregida.json'));

test('red_agv.json: el árbol desde M0 tiene 14 nodos, 8 marcados distintos y 1 muerto', () => {
  const red = original();
  const arbol = arbolCobertura(red, red.m0);
  assert.equal(arbol.nodos.length, 14);
  assert.equal(arbol.marcadosDistintos, 8);
  assert.deepEqual(arbol.muertos, [[0, 0, 0, 0, 1, 1, 0, 0, 0]]);
  assert.equal(arbol.aristas.length, 13);
  assert.equal(arbol.acotada, true);
  assert.equal(arbol.truncado, false);
});

test('red_agv_corregida.json: 12 nodos, 7 marcados distintos y ningún muerto', () => {
  const red = corregida();
  const arbol = arbolCobertura(red, red.m0);
  assert.equal(arbol.nodos.length, 12);
  assert.equal(arbol.marcadosDistintos, 7);
  assert.deepEqual(arbol.muertos, []);
  assert.equal(arbol.aristas.length, 11);
});

test('los nodos duplicados no se expanden y hay un solo nodo muerto', () => {
  const red = original();
  const { nodos } = arbolCobertura(red);
  assert.equal(nodos.filter((n) => n.tipo === 'duplicado').length, 6);
  assert.equal(nodos.filter((n) => n.tipo === 'muerto').length, 1);
  // El árbol (con duplicados) coincide con la tabla de petri.md, sección 6.4.
  const t = nodos.slice(1).map((n) => `${claveMarcado(nodos[n.padre].marcado)} -${n.transicion}-> ${claveMarcado(n.marcado)}`);
  assert.ok(t.includes('1,1,1,1,0,0,0,0,0 -t1a-> 0,1,0,1,1,0,0,0,0'));
  assert.ok(t.includes('0,1,0,1,1,0,0,0,0 -t2a-> 0,0,0,0,1,1,0,0,0'));
});

test('Karp y Miller usa ω cuando la red no es acotada', () => {
  // Red mínima con un generador: t0 no consume nada y deja una ficha en p0 (k "desborde").
  const red = new RedPetri({
    nombre: 'generador',
    lugares: [{ id: 'p1', nombre: 'p0', m0: 0, k: 1, capacidad: 'desborde' }],
    transiciones: [{ id: 't0', nombre: 'generar', disparo: 'automatica' }],
    pre: [[0]],
    post: [[1]],
  });
  const arbol = arbolCobertura(red);
  assert.equal(arbol.acotada, false);
  assert.ok(arbol.nodos.some((n) => n.marcado[0] === Infinity));
  assert.equal(arbol.truncado, false);
});

test('maxNodos corta el árbol y lo marca como truncado', () => {
  const red = original();
  const arbol = arbolCobertura(red, red.m0, 5);
  assert.equal(arbol.truncado, true);
  assert.ok(arbol.nodos.length <= 5);
});

test('radar con profundidad 1: verde en M0, amarillo en M1 y M2, rojo en el marcado muerto', () => {
  const red = original();
  const nivel = (M) => explorar(red, M, 1).nivel;
  assert.equal(nivel([1, 1, 1, 1, 0, 0, 0, 0, 0]), 'verde'); // M0
  assert.equal(nivel([0, 1, 0, 1, 1, 0, 0, 0, 0]), 'amarillo'); // M1: t2a lleva al muerto
  assert.equal(nivel([1, 0, 1, 0, 0, 1, 0, 0, 0]), 'amarillo'); // M2: t1a lleva al muerto
  assert.equal(nivel([0, 0, 0, 0, 1, 1, 0, 0, 0]), 'rojo'); // M5
  // Los demás marcados del GDD (M3, M4, M6, M7) son verdes.
  for (const M of [[1, 0, 1, 1, 0, 0, 0, 0, 1], [0, 0, 0, 1, 0, 0, 1, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 0, 0, 0, 1, 0]]) {
    assert.equal(nivel(M), 'verde', claveMarcado(M));
  }
});

test('el amarillo indica la secuencia que lleva al deadlock', () => {
  const red = original();
  const r = explorar(red, [0, 1, 0, 1, 1, 0, 0, 0, 0], 1);
  assert.equal(r.muertosAlcanzables.length, 1);
  assert.deepEqual(r.muertosAlcanzables[0].camino, ['t2a']);
  assert.deepEqual(r.muertosAlcanzables[0].marcado, [0, 0, 0, 0, 1, 1, 0, 0, 0]);
});

test('con profundidad 2 el radar ve más lejos: desde M0 ya hay amarillo', () => {
  const red = original();
  assert.equal(explorar(red, red.m0, 1).nivel, 'verde');
  assert.equal(explorar(red, red.m0, 2).nivel, 'amarillo');
});

test('red corregida: el radar nunca pasa de verde en todos sus marcados alcanzables', () => {
  const red = corregida();
  const arbol = arbolCobertura(red);
  for (const nodo of arbol.nodos) assert.equal(explorar(red, nodo.marcado, 3).nivel, 'verde');
});

test('los 8 marcados alcanzables de la red original tienen su nombre M0…M7 (y coinciden con petri.md)', () => {
  const red = original();
  const { nodos } = arbolCobertura(red);
  const nombres = new Set(nodos.map((n) => nombreMarcado(n.marcado)));
  assert.equal(nombres.has(null), false);
  assert.deepEqual([...nombres].sort(), ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
  assert.equal(nombreMarcado([0, 0, 1, 0, 0, 0, 0, 1, 0]), 'M7'); // M2 –t2b→ (t2b consume Mesa_libre)
});

test('árbol con profundidad: desde un marcado y 4 niveles no se expande más allá', () => {
  const red = original();
  const arbol = arbolCobertura(red, [0, 1, 0, 1, 1, 0, 0, 0, 0], 2000, 4);
  assert.ok(arbol.nodos.every((n) => n.nivel <= 4));
  assert.equal(arbol.muertos.length, 1); // M1 –t2a→ M5 está a 1 nivel
  const tope = arbolCobertura(red, red.m0, 2000, 1);
  assert.equal(tope.nodos.length, 4); // M0 y sus 3 hijos (t1a, t2a, tr_ir)
});
