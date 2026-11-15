// Red de Petri (docs/modelo/petri.md): matrices, disparo, deadlock e invariantes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RedPetri } from '../src/sed/redPetri.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const nueva = (archivo = 'red_agv.json') => new RedPetri(cargarModelo(archivo));

// Invariantes P de petri.md, sección 7 (cada suma vale 1).
const INVARIANTES = [
  ['Mesa_libre', 'AGV1_con_mesa', 'AGV1_trabajando', 'AGV2_trabajando'],
  ['Robot_libre', 'AGV2_con_robot', 'AGV1_trabajando', 'AGV2_trabajando', 'Robot_en_CNC'],
  ['AGV1_listo', 'AGV1_con_mesa', 'AGV1_trabajando'],
  ['AGV2_listo', 'AGV2_con_robot', 'AGV2_trabajando'],
];
const INVARIANTE_CELDA = ['Celda_libre', 'AGV1_con_mesa', 'AGV1_trabajando', 'AGV2_con_robot', 'AGV2_trabajando'];

const suma = (red, nombres) => nombres.reduce((s, n) => s + red.fichas(n), 0);

test('red_agv.json: 9 lugares, 8 transiciones, M0 y capacidad k = 1 estricta', () => {
  const red = nueva();
  assert.equal(red.lugares.length, 9);
  assert.equal(red.transiciones.length, 8);
  assert.deepEqual(red.m0, [1, 1, 1, 1, 0, 0, 0, 0, 0]);
  assert.ok(red.lugares.every((l) => l.k === 1 && l.capacidad === 'estricta'));
  assert.deepEqual(
    red.transiciones.filter((t) => t.disparo === 'jugador').map((t) => t.id),
    ['t1a', 't2a', 'tr_ir'],
  );
});

test('A = Post − Pre y tiene tamaño |T| x |P| (fila por transición)', () => {
  const red = nueva();
  assert.equal(red.A.length, 8);
  assert.ok(red.A.every((fila) => fila.length === 9));
  // Filas de petri.md, sección 4.
  assert.deepEqual(red.A[red.indiceT('t1a')], [-1, 0, -1, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(red.A[red.indiceT('t1c')], [1, 1, 1, 0, 0, 0, -1, 0, 0]);
  assert.deepEqual(red.A[red.indiceT('tr_volver')], [0, 1, 0, 0, 0, 0, 0, 0, -1]);
  red.A.forEach((fila, i) => fila.forEach((v, j) => assert.equal(v, red.post[i][j] - red.pre[i][j])));
});

test('en M0 están habilitadas t1a, t2a y tr_ir, y t1a y t2a están en conflicto', () => {
  const red = nueva();
  assert.deepEqual(red.habilitadas(), ['t1a', 't2a', 'tr_ir']);
  assert.equal(red.habilitada('t1b'), false);
  const conflictos = red.conflictos();
  // Mesa_libre la comparten t1a (y t2b, no habilitada); Robot_libre la comparten t2a y tr_ir.
  assert.deepEqual(conflictos, [{ lugar: 'Robot_libre', transiciones: ['t2a', 'tr_ir'] }]);
  assert.equal(red.esMuerto(), false);
});

test('t1a y luego t2a llevan al marcado muerto [0,0,0,0,1,1,0,0,0]', () => {
  const red = nueva();
  red.disparar('t1a');
  assert.deepEqual(red.marcado(), [0, 1, 0, 1, 1, 0, 0, 0, 0]);
  red.disparar('t2a');
  assert.deepEqual(red.marcado(), [0, 0, 0, 0, 1, 1, 0, 0, 0]);
  assert.equal(red.esMuerto(), true);
  assert.deepEqual(red.habilitadas(), []);
  assert.deepEqual(red.historial, ['t1a', 't2a']);
  assert.throws(() => red.disparar('t1b'), /no está habilitada/);
});

test('el orden t2a y luego t1a da el mismo marcado muerto', () => {
  const red = nueva();
  red.disparar('t2a');
  red.disparar('t1a');
  assert.deepEqual(red.marcado(), [0, 0, 0, 0, 1, 1, 0, 0, 0]);
  assert.equal(red.esMuerto(), true);
});

test('ciclo completo del AGV1: t1a t1b t1c vuelve a M0', () => {
  const red = nueva();
  for (const t of ['t1a', 't1b', 't1c']) red.disparar(t);
  assert.deepEqual(red.marcado(), red.m0);
});

test('ecuación de estado: M = M0 + Aᵀ·u con u = t1a + t2a da el marcado muerto', () => {
  const red = nueva();
  const u = red.transiciones.map((t) => (t.id === 't1a' || t.id === 't2a' ? 1 : 0));
  const M = red.m0.map((v, j) => v + u.reduce((s, uk, k) => s + red.A[k][j] * uk, 0));
  assert.deepEqual(M, [0, 0, 0, 0, 1, 1, 0, 0, 0]);
});

test('la capacidad estricta deshabilita una transición que superaría k', () => {
  const red = nueva();
  red.disparar('tr_ir'); // Robot_en_CNC = 1
  assert.equal(red.habilitada('tr_ir'), false); // además no hay Robot_libre
  // Fuerza un marcado con Robot_libre = 1 y Robot_en_CNC = 1: tr_volver superaría k = 1 en Robot_libre.
  red.reiniciar([1, 1, 1, 1, 0, 0, 0, 0, 1]);
  assert.equal(red.habilitada('tr_volver'), false);
});

test('con capacidad "desborde" la misma transición sí se dispara', () => {
  const modelo = cargarModelo('red_agv.json');
  modelo.lugares.forEach((l) => { l.capacidad = 'desborde'; });
  const red = new RedPetri(modelo);
  red.reiniciar([1, 1, 1, 1, 0, 0, 0, 0, 1]);
  assert.equal(red.habilitada('tr_volver'), true);
});

test('red corregida: t1a y luego t2a no bloquea (Celda_libre inhibe a t2a)', () => {
  const red = nueva('red_agv_corregida.json');
  assert.equal(red.lugares.length, 10);
  assert.deepEqual(red.m0, [1, 1, 1, 1, 0, 0, 0, 0, 0, 1]);
  red.disparar('t1a');
  assert.equal(red.fichas('Celda_libre'), 0);
  assert.equal(red.habilitada('t2a'), false);
  assert.equal(red.esMuerto(), false);
  assert.deepEqual(red.habilitadas(), ['t1b', 'tr_ir']);
});

test('los 4 invariantes P se conservan en 1000 disparos aleatorios (semilla 2026)', () => {
  const azar = crearAleatorio(SEMILLA);
  const red = nueva();
  let disparos = 0;
  while (disparos < 1000) {
    const habilitadas = red.habilitadas();
    if (habilitadas.length === 0) {
      red.reiniciar(); // marcado muerto: se vuelve a M0 y se sigue
      continue;
    }
    red.disparar(habilitadas[Math.floor(azar.siguiente() * habilitadas.length)]);
    disparos++;
    for (const inv of INVARIANTES) assert.equal(suma(red, inv), 1, `invariante ${inv.join('+')} tras ${disparos} disparos`);
    assert.ok(red.M.every((v) => v === 0 || v === 1)); // red segura (1-acotada)
  }
});

test('red corregida: los 4 invariantes y el de Celda_libre se conservan en 1000 disparos y nunca hay deadlock', () => {
  const azar = crearAleatorio(SEMILLA);
  const red = nueva('red_agv_corregida.json');
  for (let disparos = 1; disparos <= 1000; disparos++) {
    const habilitadas = red.habilitadas();
    assert.ok(habilitadas.length > 0, `deadlock en ${red.marcado()}`);
    red.disparar(habilitadas[Math.floor(azar.siguiente() * habilitadas.length)]);
    for (const inv of INVARIANTES) assert.equal(suma(red, inv), 1);
    assert.equal(suma(red, INVARIANTE_CELDA), 1);
  }
});

test('las columnas p1..p9 de la red corregida son las de la red original', () => {
  const a = nueva();
  const b = nueva('red_agv_corregida.json');
  for (let i = 0; i < 8; i++) {
    assert.deepEqual(b.pre[i].slice(0, 9), a.pre[i]);
    assert.deepEqual(b.post[i].slice(0, 9), a.post[i]);
  }
  // Solo cambia p10: t1a y t2a la toman, t1c y t2c la devuelven.
  assert.deepEqual(b.transiciones.map((_, i) => b.post[i][9] - b.pre[i][9]), [-1, 0, 1, -1, 0, 1, 0, 0]);
});

test('faltantes: qué ficha falta para cada transición (AND-join) y lugares llenos', () => {
  const red = nueva();
  assert.deepEqual(red.faltantes(red.M, 't1a'), []);
  red.disparar('tr_ir'); // el brazo sale: Robot_libre = 0
  assert.deepEqual(red.faltantes(red.M, 't2a'), ['Robot_libre']);
  red.disparar('t1a'); // AGV1 con la mesa
  assert.deepEqual(red.faltantes(red.M, 't1b'), ['Robot_libre']); // AGV1 espera al robot
  assert.deepEqual(red.faltantes(red.M, 't2b'), ['Mesa_libre', 'AGV2_con_robot']);
  red.reiniciar([1, 1, 1, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(red.faltantes(red.M, 'tr_volver'), ['Robot_libre (llena)']);
});
