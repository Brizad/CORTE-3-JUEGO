// Controles paso a paso: cada botón de la barra dispara UN solo evento del autómata (docs/GDD.md, sección 18.20).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Celda } from '../src/sed/celda.js';
import { VERBOS, describir, ejecutar, verbosDe, progresoFresado, textoTooltip } from '../src/sed/controles.js';
import { Racha } from '../src/sed/racha.js';
import { Reloj } from '../src/sed/reloj.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA, TURNOS, PUNTOS } from '../src/config.js';
import { BOTONES, BOTON_DE_VERBO, ZONAS, PANEL_MAQUINA } from '../src/disposicion.js';
import { cargarModelo } from './ayudas.js';

const modelos = () => ({
  cnc: cargarModelo('cnc.json'), brazo: cargarModelo('brazo.json'), agv: cargarModelo('agv.json'),
  red: cargarModelo('red_agv.json'), redCorregida: cargarModelo('red_agv_corregida.json'),
  supervisor: cargarModelo('supervisor.json'), reparacion: cargarModelo('reparacion_dfa.json'),
});

function nueva(extra = {}) {
  const reloj = new Reloj();
  const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(SEMILLA), turno: { ...TURNOS[0], meta: 999, duracion: 100000, probFalla: 0, ...extra } });
  celda.arrancar();
  const automatas = () => celda.bitacora.filter((e) => e.tipo === 'automata').map((e) => `${e.maquina}.${e.evento}`);
  const tipo = (id) => describir(celda, id).tipo;
  return { reloj, celda, automatas, tipo };
}

test('la barra tiene los 11 verbos con sus teclas: Z X A C D E V para el brazo, F G para las CNC y Q W para los AGV', () => {
  assert.deepEqual(VERBOS.map((v) => `${v.verbo} (${v.tecla})`), [
    'Ir a CNC 1 (Z)', 'Ir a CNC 2 (X)', 'Abrir pinza (A)', 'Meter bloque (C)', 'Sacar pieza (D)', 'Cerrar pinza (E)', 'Volver (V)',
    'Fresar (F)', 'Fresar (G)', 'Atender AGV 1 (Q)', 'Atender AGV 2 (W)',
  ]);
  assert.deepEqual(VERBOS.filter((v) => v.grupo === 'BRAZO').length, 7);
});

test('cada botón dispara UN solo evento: cargar una pieza son 5 pulsaciones y el historial las muestra una por una', () => {
  const { reloj, celda, automatas, tipo } = nueva();
  const pulsar = (id) => { const n = automatas().length; assert.equal(ejecutar(celda, id).ok, true, id); return automatas().slice(n); };
  assert.deepEqual(pulsar('ir1'), ['BRAZO.mover']);
  assert.equal(tipo('abrir'), 'gris'); // el brazo todavía va en camino
  reloj.avanzar(2); // l · llegar lo dispara el reloj (no controlable)
  assert.deepEqual(pulsar('abrir'), ['BRAZO.abrir_mandril']);
  assert.deepEqual(pulsar('meter'), ['CNC1.cargar', 'BRAZO.cargar']); // UN evento compartido: lo ejecutan los dos autómatas
  assert.deepEqual(pulsar('cerrar'), ['BRAZO.cerrar_mandril', 'BRAZO.mover']); // e, y la vuelta automática del GDD (tr_volver, 0 s)
  assert.deepEqual(pulsar('fresar1'), ['CNC1.iniciar_fresado']);
  assert.deepEqual(automatas(), ['BRAZO.mover', 'BRAZO.llegar', 'BRAZO.abrir_mandril', 'CNC1.cargar', 'BRAZO.cargar', 'BRAZO.cerrar_mandril', 'BRAZO.mover', 'CNC1.iniciar_fresado']);
  assert.equal(celda.estado('CNC1'), 'Fresando');
});

test('no quedan macros: ningún verbo encadena eventos con el tiempo', () => {
  const { reloj, celda, automatas } = nueva();
  ejecutar(celda, 'ir1');
  reloj.avanzar(60); // sin pulsar nada más, solo ocurre l · llegar
  assert.deepEqual(automatas(), ['BRAZO.mover', 'BRAZO.llegar']);
  assert.equal(celda.estado('CNC1'), 'Libre');
  assert.ok(!fs.existsSync(new URL('../src/sed/acciones.js', import.meta.url)));
});

test('colores: verde se puede, gris ahora no (con la razón formal) y rojo lo bloquea el supervisor (−15 si se intenta)', () => {
  const { reloj, celda, tipo } = nueva();
  assert.deepEqual(['ir1', 'ir2', 'agv1', 'agv2'].map(tipo), ['verde', 'verde', 'verde', 'verde']);
  assert.deepEqual(['abrir', 'meter', 'sacar', 'cerrar', 'volver', 'fresar1', 'fresar2'].map(tipo), Array(7).fill('gris'));
  assert.match(describir(celda, 'abrir').tip, /δ no está definida: el brazo debe estar en Mandril Cerrado/);
  assert.match(describir(celda, 'meter').tip, /El brazo no está en ninguna CNC/);
  ejecutar(celda, 'ir1'); reloj.avanzar(2);
  assert.equal(tipo('volver'), 'verde'); // desde Mandril_Cerrado se puede volver a mano
  ejecutar(celda, 'abrir'); ejecutar(celda, 'meter');
  // CNC 1 cargada con la pinza abierta: fresar queda en rojo.
  const d = describir(celda, 'fresar1');
  assert.equal(d.tipo, 'rojo');
  assert.match(d.tip, /Supervisor: .*Intentarlo resta 15 puntos/);
  const r = ejecutar(celda, 'fresar1');
  assert.deepEqual([r.ok, r.motivo], [false, 'supervisor']);
  assert.equal(celda.puntaje, PUNTOS.intentoBloqueado);
  assert.equal(celda.estado('CNC1'), 'Cargado');
  // Gris: no hace nada y no cuesta puntos.
  assert.equal(ejecutar(celda, 'sacar').ok, false);
  assert.equal(celda.puntaje, PUNTOS.intentoBloqueado);
});

test('«Fresar» pasa a «Reparar» cuando la CNC está en Falla: no dispara ningún evento, pide abrir la consola', () => {
  const { reloj, celda, automatas } = nueva();
  for (const id of ['ir2']) ejecutar(celda, id);
  reloj.avanzar(2);
  for (const id of ['abrir', 'meter', 'cerrar', 'fresar2']) ejecutar(celda, id);
  assert.equal(describir(celda, 'fresar2').fresando, true);
  reloj.avanzar(5);
  assert.ok(Math.abs(progresoFresado(celda, 'CNC2').fraccion - 0.5) < 0.01);
  celda.forzarFalla();
  const d = describir(celda, 'fresar2');
  assert.deepEqual([d.verbo, d.tipo], ['Reparar', 'reparar']);
  const n = automatas().length;
  assert.deepEqual(ejecutar(celda, 'fresar2').reparar, 'CNC2');
  assert.equal(automatas().length, n);
  assert.equal(celda.estado('CNC2'), 'Falla');
});

test('atender los dos AGV a la vez traba la celda; con el radar en amarillo el segundo sigue en verde (la decisión es del jugador)', () => {
  const { celda, tipo } = nueva();
  assert.equal(ejecutar(celda, 'agv1').ok, true);
  assert.equal(celda.radar.nivel, 'amarillo');
  assert.equal(tipo('agv1'), 'gris');
  assert.match(describir(celda, 'agv1').tip, /debe estar Libre \(ahora: Viajando\)/);
  assert.equal(tipo('agv2'), 'verde');
  ejecutar(celda, 'agv2');
  assert.equal(celda.deadlock, true);
  for (const v of VERBOS) assert.equal(tipo(v.id), 'gris'); // tras el interbloqueo no hay controles
});

test('en el panel de una CNC solo van sus eventos (c, i, d); en el del brazo los suyos; en el del AGV el suyo', () => {
  assert.deepEqual(verbosDe('CNC1'), ['meter', 'fresar1', 'sacar']);
  assert.deepEqual(verbosDe('CNC2'), ['meter', 'fresar2', 'sacar']);
  assert.deepEqual(verbosDe('BRAZO'), ['ir1', 'ir2', 'abrir', 'meter', 'sacar', 'cerrar', 'volver']);
  assert.deepEqual(verbosDe('AGV2'), ['agv2']);
  // «Meter bloque» en el panel de la CNC 2 con el brazo en la CNC 1: gris, dice dónde está el brazo.
  const { reloj, celda } = nueva();
  ejecutar(celda, 'ir1'); reloj.avanzar(2); ejecutar(celda, 'abrir');
  assert.equal(describir(celda, 'meter', { cnc: 'CNC1' }).tipo, 'verde');
  const d = describir(celda, 'meter', { cnc: 'CNC2' });
  assert.equal(d.tipo, 'gris');
  assert.match(d.tip, /El brazo atiende a la CNC 1/);
});

test('la barra de control cabe en 960 × 540, con botones de 44 px o más, sin tapar las fichas, las alertas ni el panel de máquina', () => {
  for (const v of VERBOS) {
    const b = BOTONES[BOTON_DE_VERBO[v.id]];
    assert.ok(b, `sin botón para ${v.id}`);
    assert.ok(b.ancho >= 44 && b.alto >= 44, `${v.id} mide ${b.ancho}x${b.alto}`);
    assert.ok(b.y >= PANEL_MAQUINA.y + PANEL_MAQUINA.alto, `${v.id} queda bajo el panel de máquina`);
    for (const zona of [ZONAS.fichas, ZONAS.alertas]) {
      const encima = b.x < zona.x + zona.ancho && zona.x < b.x + b.ancho && b.y < zona.y + zona.alto && zona.y < b.y + b.alto;
      assert.ok(!encima, `${v.id} tapa una zona del HUD`);
    }
  }
  // El hueco del medio deja ver la punta de la planta (la base del AGV 2).
  assert.ok(BOTONES.volver.x + BOTONES.volver.ancho <= 428 && BOTONES.fresar1.x >= 596);
});

test('la racha cuenta piezas seguidas sin errores, se reinicia con un error y NO cambia el puntaje', () => {
  const { reloj, celda } = nueva({ intervaloPedidos: 1e6 }); // sin entregas de metal: una entrega perdida también reinicia la racha
  const racha = new Racha(celda);
  const pieza = (n) => {
    ejecutar(celda, `ir${n}`); reloj.avanzar(2);
    for (const id of ['abrir', 'meter', 'cerrar', `fresar${n}`]) ejecutar(celda, id);
    reloj.avanzar(10);
    ejecutar(celda, `ir${n}`); reloj.avanzar(2);
    for (const id of ['abrir', 'sacar']) ejecutar(celda, id);
  };
  pieza(1);
  assert.deepEqual([racha.n, racha.texto], [1, '']);
  pieza(2);
  assert.deepEqual([racha.n, racha.texto], [2, 'Racha ×2']);
  pieza(1);
  assert.equal(racha.texto, 'Racha ×3');
  assert.equal(celda.puntaje, 3 * PUNTOS.pieza); // la racha no suma nada
  const antes = celda.puntaje;
  // Un error (intento bloqueado por el supervisor) la reinicia.
  ejecutar(celda, 'ir1'); reloj.avanzar(2); ejecutar(celda, 'abrir'); ejecutar(celda, 'meter');
  ejecutar(celda, 'fresar1'); // rojo
  assert.equal(racha.n, 0);
  assert.equal(racha.mejor, 3);
  assert.equal(celda.puntaje, antes + PUNTOS.intentoBloqueado);
});

test('botón rojo o gris: tooltip en 2 líneas, primero en palabras simples y debajo la razón formal (guía p. 20, punto 3)', () => {
  const { reloj, celda } = nueva();
  // Gris al empezar: palabras simples + δ.
  const abrir = describir(celda, 'abrir');
  assert.match(abrir.razon.simple, /^No puedes abrir la pinza: primero lleva el brazo a una CNC\.$/);
  assert.match(abrir.razon.formal, /^δ_Brazo\(Reposo, a\) no está definida\.$/);
  assert.equal(textoTooltip(abrir).split('\n').length, 2);
  assert.match(describir(celda, 'meter').razon.simple, /primero lleva el brazo a la CNC/);
  assert.match(describir(celda, 'fresar1').razon.simple, /No puedes fresar: la CNC 1 está vacía/);
  // Rojo: el ejemplo de la guía.
  ejecutar(celda, 'ir1'); reloj.avanzar(2); ejecutar(celda, 'abrir'); ejecutar(celda, 'meter');
  const rojo = describir(celda, 'fresar1');
  assert.equal(rojo.tipo, 'rojo');
  assert.equal(rojo.razon.simple, 'No puedes fresar: la pinza está abierta dentro de la CNC 1.');
  assert.match(rojo.razon.formal, /^¬\(CNC = Fresando ∧ Brazo = Mandril_Abierto\)/);
  assert.equal(textoTooltip(rojo), `${rojo.razon.simple}\n${rojo.razon.formal}`);
  // Verde: sin razón, el tooltip es el de siempre.
  const ir = describir(celda, 'cerrar');
  assert.equal(ir.tipo, 'verde');
  assert.equal(ir.razon, null);
  assert.equal(textoTooltip(ir), ir.tip);
  // Recurso de la red (AGV 2 sin robot: el brazo está en la CNC).
  const agv2 = describir(celda, 'agv2');
  assert.equal(agv2.tipo, 'gris');
  assert.match(agv2.razon.simple, /el robot está ocupado/);
  assert.match(agv2.razon.formal, /M < Pre en Robot_libre/);
  // Todos los verbos grises o rojos tienen las 2 líneas.
  for (const v of VERBOS) {
    const d = describir(celda, v.id);
    if (d.tipo === 'gris' || d.tipo === 'rojo') assert.ok(d.razon?.simple && d.razon?.formal, v.id);
  }
});
