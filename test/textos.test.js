// Textos de ayuda: aviso de turno, razón del radar amarillo, leyenda y descripciones (docs/GDD.md, sección 18.13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoTurno, razonRadarAmarillo, LEYENDA, LEYENDA_RADAR, DESCRIPCION_MAQUINA, CONTROLES } from '../src/textos.js';
import { TURNOS, TURNO_0, COLORES } from '../src/config.js';

test('el aviso de cada turno usa los valores del GDD', () => {
  assert.equal(avisoTurno(TURNOS[0], 0), 'Turno 1: 3 piezas, fallas 10 %, pedidos cada 25 s');
  assert.equal(avisoTurno(TURNOS[1], 1), 'Turno 2: 5 piezas, fallas 20 %, pedidos cada 18 s');
  assert.equal(avisoTurno(TURNOS[2], 2), 'Turno 3: 7 piezas, fallas 30 %, pedidos cada 12 s');
  assert.match(avisoTurno(TURNO_0, 0, true), /^Turno 0 \(tutorial\)/);
});

test('el radar amarillo dice qué AGV no despachar', () => {
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [{ camino: ['t2a'] }] }), /si despachas AGV2 ahora, la celda se bloquea/);
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [{ camino: ['t1a'] }] }), /AGV1/);
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [{ camino: ['tr_ir'] }] }), /tr_ir/);
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [] }), /bloquear/); // sin datos: mensaje general
  assert.match(razonRadarAmarillo(undefined), /bloquear/);
});

test('la leyenda usa colores de la paleta y cubre verde, gris, rojo, naranja y el radar', () => {
  for (const [clave] of [...LEYENDA, ...LEYENDA_RADAR]) assert.ok(clave in COLORES, `color ${clave} fuera de la paleta`);
  const texto = LEYENDA.map((l) => l[1]).join(' ');
  for (const palabra of ['Verde', 'Gris', 'Rojo', 'Naranja']) assert.ok(texto.includes(palabra), palabra);
  assert.equal(LEYENDA_RADAR.length, 3);
});

test('cada máquina tiene una descripción corta de una frase', () => {
  for (const id of ['CNC1', 'CNC2', 'BRAZO', 'AGV1', 'AGV2']) {
    assert.ok(DESCRIPCION_MAQUINA[id].length > 20 && DESCRIPCION_MAQUINA[id].length < 120, id);
  }
});

test('la tabla de controles incluye la ayuda (?) y la pantalla completa (G)', () => {
  assert.ok(CONTROLES.some((f) => f[0] === 'Ayuda' && f[1] === '?'));
  assert.ok(CONTROLES.some((f) => f[0] === 'Pantalla completa' && f[1] === 'G'));
});
