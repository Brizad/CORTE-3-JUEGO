// Textos de ayuda: aviso de turno, razón del radar amarillo, leyenda y descripciones (docs/GDD.md, sección 18.13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoTurno, razonRadarAmarillo, LEYENDA, LEYENDA_RADAR, DESCRIPCION_MAQUINA, CONTROLES, introLineas, ATAJOS, TIP_RADAR, textoEsperaAGV, fraseJefe, etiquetasPedidos, cuentaPedido } from '../src/textos.js';
import { TURNOS, TURNO_0, COLORES } from '../src/config.js';

test('el aviso de cada turno usa los valores del GDD', () => {
  assert.equal(avisoTurno(TURNOS[0], 0), 'Turno 1: 3 piezas, fallas 10 %, pedidos cada 25 s');
  assert.equal(avisoTurno(TURNOS[1], 1), 'Turno 2: 5 piezas, fallas 20 %, pedidos cada 18 s');
  assert.equal(avisoTurno(TURNOS[2], 2), 'Turno 3: 6 piezas, fallas 30 %, pedidos cada 12 s');
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

test('el texto del AGV dice lo que hace en la red: trae material y necesita la mesa y el robot a la vez', () => {
  assert.equal(DESCRIPCION_MAQUINA.AGV1, 'AGV 1: trae material. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.');
  assert.equal(DESCRIPCION_MAQUINA.AGV2, 'AGV 2: trae material. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.');
  for (const t of Object.values(DESCRIPCION_MAQUINA)) assert.ok(!/lleva la pieza/.test(t));
});

test('la intro tiene 5 líneas como máximo, usa la meta del turno y nombra lo esencial', () => {
  const lineas = introLineas(TURNOS[0].meta);
  assert.ok(lineas.length <= 5);
  assert.match(lineas[0], /fabrica 3 piezas con las 2 CNC antes de 180 s/);
  assert.match(introLineas(5)[0], /fabrica 5 piezas/);
  const todo = lineas.join(' ');
  for (const palabra of ['jefe de turno', 'H C T C R', '30 s', 'pierdes 20', 'se traba', 'verde', 'amarillo', 'rojo']) assert.ok(todo.includes(palabra), palabra);
  for (const l of lineas) assert.ok(l.length <= 95, l);
});

test('los atajos del botón «?» son 1, 2, Espacio, Q, W, Tab y M, y también están en la tabla de controles', () => {
  const teclas = ATAJOS.map((a) => a[0]).join(' ');
  for (const t of ['1 y 2', 'Espacio', 'Q y W', 'Tab', 'M']) assert.ok(teclas.includes(t), t);
  const tabla = CONTROLES.map((c) => c[1]).join(' | ');
  for (const t of ['Espacio', '1 y 2', 'Q y W', 'Tab']) assert.ok(tabla.includes(t), t);
});

test('el radar se explica con una frase y el AGV detenido dice qué espera', () => {
  assert.match(TIP_RADAR, /foto actual de las fichas/);
  assert.match(TIP_RADAR, /Verde: seguro\. Amarillo: si despachas otro AGV ahora, te trabas\. Rojo: trabado\./);
  assert.equal(textoEsperaAGV(['Robot_libre']), 'Espera el robot');
  assert.equal(textoEsperaAGV(['Mesa_libre']), 'Espera la mesa');
  assert.equal(textoEsperaAGV(['Robot_libre', 'Mesa_libre']), 'Espera el robot y la mesa');
  assert.equal(textoEsperaAGV([]), '');
});

test('los pedidos se rotulan con el AGV que hay que despachar y su cuenta regresiva de 30 s con color', () => {
  const pedidos = [{ id: 1, t: 0 }, { id: 2, t: 10 }, { id: 3, t: 20 }];
  assert.deepEqual(etiquetasPedidos(pedidos, { AGV1: 'Libre', AGV2: 'Libre' }).map((r) => r.texto), ['AGV 1 espera', 'AGV 2 espera', 'Pedido en cola']);
  // Un AGV que ya salió atiende el pedido más antiguo: va primero.
  assert.deepEqual(etiquetasPedidos(pedidos.slice(0, 2), { AGV1: 'Libre', AGV2: 'Viajando' }).map((r) => r.texto), ['AGV 2 en camino', 'AGV 1 espera']);
  assert.deepEqual(etiquetasPedidos([], { AGV1: 'Libre', AGV2: 'Libre' }), []);
  const c = (t) => cuentaPedido({ t: 0, vencido: false }, t, 30);
  assert.deepEqual([c(0).texto, c(18).texto, c(29.5).texto], ['30 s', '12 s', '1 s']);
  assert.deepEqual([c(5).nivel, c(18).nivel, c(27).nivel], ['operacion', 'espera', 'fallo']); // verde > amarillo > rojo
  assert.equal(cuentaPedido({ t: 0, vencido: true }, 40, 30).texto, 'vencido');
  assert.equal(cuentaPedido({ t: 0 }, 40, 30, false).texto, 'sin límite'); // tutorial
});

test('el jefe de planta dice una frase corta al ganar o perder el turno', () => {
  assert.equal(fraseJefe({ resultado: 'victoria', meta: 3, piezas: 3 }), '¡Turno cumplido!');
  assert.equal(fraseJefe({ resultado: 'tiempo', meta: 5, piezas: 3, pedidosVencidos: 2, deadlocks: 0, fallas: 0, fallasReparadas: 0 }), 'Faltaron 2 piezas, ojo con los pedidos vencidos.');
  assert.match(fraseJefe({ resultado: 'tiempo', meta: 5, piezas: 4, pedidosVencidos: 0, deadlocks: 0, fallas: 2, fallasReparadas: 1 }), /^Faltaron 1 pieza, repara/);
  assert.match(fraseJefe({ resultado: 'tiempo', meta: 5, piezas: 4, pedidosVencidos: 0, deadlocks: 1, fallas: 0, fallasReparadas: 0 }), /se trabó/);
  for (const r of ['victoria', 'tiempo']) assert.ok(fraseJefe({ resultado: r, meta: 6, piezas: 1, pedidosVencidos: 0, deadlocks: 0, fallas: 0, fallasReparadas: 0 }).length < 70);
});
