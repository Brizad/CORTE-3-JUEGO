// Textos del juego: intro, teclas, entregas de metal, radar, puntos flotantes, estrellas y frases (docs/GDD.md, secciones 18.13 y 18.20).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  avisoTurno, tarjetaTurno, razonRadarAmarillo, LEYENDA, LEYENDA_RADAR, DESCRIPCION_MAQUINA, CONTROLES, introLineas, ATAJOS, TIP_RADAR,
  textoEsperaAGV, fraseJefe, etiquetasEntregas, cuentaEntrega, etiquetaPuntos, estrellas,
} from '../src/textos.js';
import { TURNOS, TURNO_0, COLORES, PUNTOS } from '../src/config.js';
import { VERBOS } from '../src/sed/controles.js';

test('la tarjeta de inicio de cada turno usa los valores del GDD', () => {
  assert.equal(tarjetaTurno(TURNOS[0], 0), 'TURNO 1 · Meta 6 piezas · 180 s');
  assert.equal(tarjetaTurno(TURNOS[1], 1), 'TURNO 2 · Meta 8 piezas · 180 s');
  assert.equal(tarjetaTurno(TURNOS[2], 2), 'TURNO 3 · Meta 8 piezas · 180 s');
  assert.equal(avisoTurno(TURNOS[0], 0), 'Fallas 10 % · metal cada 25 s · plazo 30 s');
  assert.equal(avisoTurno(TURNOS[2], 2), 'Fallas 20 % · metal cada 18 s, a veces 2 juntas · plazo 20 s');
  assert.match(avisoTurno(TURNO_0, 0, true), /^Turno 0 \(tutorial\)/);
});

test('el radar amarillo dice qué AGV no atender', () => {
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [{ camino: ['t2a'] }] }), /si atiendes el AGV 2 ahora, la celda se traba/);
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [{ camino: ['t1a'] }] }), /AGV 1/);
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [{ camino: ['tr_ir'] }] }), /tr_ir/);
  assert.match(razonRadarAmarillo({ muertosAlcanzables: [] }), /trabar/); // sin datos: mensaje general
  assert.match(razonRadarAmarillo(undefined), /trabar/);
  assert.equal(TIP_RADAR, 'M6 = foto actual de las fichas. Verde: seguro. Amarillo: si atiendes otro AGV ahora, te trabas. Rojo: trabado.');
});

test('la leyenda usa colores de la paleta y cubre verde, gris, rojo, naranja y el radar', () => {
  for (const [clave] of [...LEYENDA, ...LEYENDA_RADAR]) assert.ok(clave in COLORES, `color ${clave} fuera de la paleta`);
  const texto = LEYENDA.map((l) => l[1]).join(' ');
  for (const palabra of ['Verde', 'Gris', 'Rojo', 'Naranja']) assert.ok(texto.includes(palabra), palabra);
  assert.equal(LEYENDA_RADAR.length, 3);
});

test('cada máquina tiene una descripción corta; la del AGV dice lo que hace en la red', () => {
  for (const id of ['CNC1', 'CNC2', 'BRAZO', 'AGV1', 'AGV2']) assert.ok(DESCRIPCION_MAQUINA[id].length > 20 && DESCRIPCION_MAQUINA[id].length < 120, id);
  assert.equal(DESCRIPCION_MAQUINA.AGV1, 'AGV 1: trae metal. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.');
  assert.equal(DESCRIPCION_MAQUINA.AGV2, 'AGV 2: trae metal. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.');
});

test('la intro «Cómo jugar» tiene 6 líneas como máximo, usa la meta del turno y nombra las teclas', () => {
  const lineas = introLineas(TURNOS[0].meta);
  assert.ok(lineas.length <= 6);
  assert.equal(lineas[0], 'Eres el jefe de turno: fabrica 6 piezas antes de 180 s.');
  const todo = lineas.join(' ');
  for (const palabra of ['abre la pinza', 'mete el bloque', 'H C T C R', 'traen metal', 'la mesa y el robot', 'se traba', 'verde = bien', 'amarillo = cuidado', 'rojo = trabado']) assert.ok(todo.includes(palabra), palabra);
  for (const tecla of ['(Z, X)', '(A)', '(C)', '(E)', '(F, G)', '(Q, W)']) assert.ok(todo.includes(tecla), tecla);
});

test('las teclas de la ayuda y de la tabla de controles son las de la barra de control; 1, 2 y 4 son solo la velocidad', () => {
  const ayuda = ATAJOS.map((a) => a[0]).join(' ');
  const tabla = CONTROLES.map((c) => c[1]).join(' | ');
  for (const v of VERBOS) {
    assert.ok(ayuda.includes(v.tecla), `la ayuda no muestra la tecla ${v.tecla} de ${v.verbo}`);
    assert.ok(tabla.includes(v.tecla), `la tabla de controles no muestra la tecla ${v.tecla}`);
  }
  assert.ok(ATAJOS.some(([t, que]) => t === '1 · 2 · 4' && /velocidad/.test(que)));
  assert.ok(CONTROLES.some(([que, teclas]) => /Velocidad/.test(que) && teclas === '1, 2 y 4'));
  assert.equal(new Set(VERBOS.map((v) => v.tecla)).size, VERBOS.length); // ninguna tecla repetida
  for (const v of VERBOS) assert.ok(!'12 4PIMHTR'.includes(v.tecla), `${v.tecla} choca con otra función`);
});

test('el AGV detenido dice qué espera', () => {
  assert.equal(textoEsperaAGV(['Robot_libre']), 'Espera el robot');
  assert.equal(textoEsperaAGV(['Mesa_libre']), 'Espera la mesa');
  assert.equal(textoEsperaAGV(['Robot_libre', 'Mesa_libre']), 'Espera el robot y la mesa');
  assert.equal(textoEsperaAGV([]), '');
});

test('las entregas de metal se rotulan con el AGV que las trae y su cuenta regresiva con color', () => {
  const entregas = [{ id: 1, t: 0 }, { id: 2, t: 10 }, { id: 3, t: 20 }];
  assert.deepEqual(etiquetasEntregas(entregas, { AGV1: 'Libre', AGV2: 'Libre' }).map((r) => r.texto), ['AGV 1 trae metal', 'AGV 2 trae metal', 'Metal en cola']);
  // Un AGV que ya salió atiende la entrega más antigua: va primero.
  assert.deepEqual(etiquetasEntregas(entregas.slice(0, 2), { AGV1: 'Libre', AGV2: 'Viajando' }).map((r) => r.texto), ['AGV 2 en camino', 'AGV 1 trae metal']);
  assert.deepEqual(etiquetasEntregas([], { AGV1: 'Libre', AGV2: 'Libre' }), []);
  const c = (t, plazo = 30) => cuentaEntrega({ t: 0, vencido: false }, t, plazo);
  assert.deepEqual([c(0).texto, c(18).texto, c(29.5).texto], ['30 s', '12 s', '1 s']);
  assert.deepEqual([c(5).nivel, c(18).nivel, c(27).nivel], ['operacion', 'espera', 'fallo']); // verde > amarillo > rojo
  assert.deepEqual([c(0, 20).texto, c(12, 20).nivel], ['20 s', 'espera']); // turno 3: plazo de 20 s
  assert.equal(cuentaEntrega({ t: 0, vencido: true }, 40, 30).texto, 'perdida');
  assert.equal(cuentaEntrega({ t: 0 }, 40, 30, false).texto, 'sin plazo'); // tutorial
});

test('los textos flotantes usan los valores de puntaje del GDD, sin cambiarlos', () => {
  assert.equal(etiquetaPuntos(PUNTOS.pieza, 'pieza descargada'), '+100 pieza');
  assert.equal(etiquetaPuntos(PUNTOS.cicloAGV, 'ciclo de AGV'), '+40 metal');
  assert.equal(etiquetaPuntos(PUNTOS.reparacion, 'reparación válida'), '+50 reparada');
  assert.equal(etiquetaPuntos(PUNTOS.intentoBloqueado, 'intento bloqueado por el supervisor'), '−15 bloqueado');
  assert.equal(etiquetaPuntos(PUNTOS.pedidoVencido, 'entrega perdida'), '−20 entrega perdida');
  assert.equal(etiquetaPuntos(PUNTOS.palabraInvalida, 'palabra de reparación inválida'), '−30 palabra inválida');
});

test('estrellas (1 a 3 según las piezas sobre la meta) y frase del jefe de planta', () => {
  assert.equal(estrellas({ resultado: 'victoria', meta: 6, piezas: 6 }), 3);
  assert.equal(estrellas({ resultado: 'tiempo', meta: 6, piezas: 5 }), 2);
  assert.equal(estrellas({ resultado: 'tiempo', meta: 6, piezas: 3 }), 2);
  assert.equal(estrellas({ resultado: 'tiempo', meta: 6, piezas: 2 }), 1);
  assert.equal(estrellas({ resultado: 'tiempo', meta: 8, piezas: 0 }), 1);
  assert.equal(fraseJefe({ resultado: 'victoria', meta: 6, piezas: 6 }), '¡Turno cumplido!');
  assert.equal(fraseJefe({ resultado: 'tiempo', meta: 8, piezas: 6, pedidosVencidos: 2, deadlocks: 0, fallas: 0, fallasReparadas: 0 }), 'Faltaron 2 piezas: atiende el metal a tiempo.');
  assert.match(fraseJefe({ resultado: 'tiempo', meta: 8, piezas: 7, pedidosVencidos: 0, deadlocks: 0, fallas: 2, fallasReparadas: 1 }), /^Faltó 1 pieza: repara/);
  assert.match(fraseJefe({ resultado: 'tiempo', meta: 8, piezas: 4, pedidosVencidos: 0, deadlocks: 1, fallas: 0, fallasReparadas: 0 }), /se trabó/);
});

test('ningún texto visible del juego usa las palabras "pedido" ni "cliente"', () => {
  // Se revisan las cadenas con espacios (frases) de src/ y de index.html; los nombres de variables y de eventos internos no cuentan.
  const hallazgos = [];
  const revisar = (archivo) => {
    const s = fs.readFileSync(archivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of s.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const t = m[2].replace(/\$\{[^}]*\}/g, '');
      if (t.includes(' ') && /pedido|cliente/i.test(t)) hallazgos.push(`${archivo}: «${t.slice(0, 80)}»`);
    }
  };
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'modelos') recorrer(p); } else if (p.endsWith('.js')) revisar(p);
    }
  };
  recorrer('src');
  revisar('index.html');
  assert.deepEqual(hallazgos, []);
});
