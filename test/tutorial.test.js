// Tutorial "Turno 0": la guía avanza con el estado del modelo y termina provocando el deadlock (docs/GDD.md, sección 18.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Celda } from '../src/sed/celda.js';
import { Reloj } from '../src/sed/reloj.js';
import { Partida } from '../src/sed/partida.js';
import { GuiaTutorial, PASOS } from '../src/sed/tutorial.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA, TURNO_0 } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const modelos = () => ({
  cnc: cargarModelo('cnc.json'), brazo: cargarModelo('brazo.json'), agv: cargarModelo('agv.json'),
  red: cargarModelo('red_agv.json'), redCorregida: cargarModelo('red_agv_corregida.json'),
  supervisor: cargarModelo('supervisor.json'), reparacion: cargarModelo('reparacion_dfa.json'),
});

function nueva() {
  const reloj = new Reloj();
  const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(SEMILLA), turno: new Partida({ tutorial: true }).parametros });
  celda.arrancar();
  return { reloj, celda };
}

test('el tutorial usa el Turno 0: sin límite de tiempo, sin meta, sin fallas y con pedidos que no vencen', () => {
  const p = new Partida({ tutorial: true });
  assert.equal(p.tutorial, true);
  assert.equal(p.parametros, TURNO_0);
  assert.equal(TURNO_0.probFalla, 0);
  assert.equal(TURNO_0.pedidosVencen, false);
  assert.equal(new Partida().tutorial, false);
});

test('en el tutorial los pedidos llegan pero no vencen ni restan puntos', () => {
  const { reloj, celda } = nueva();
  reloj.avanzar(200);
  assert.ok(celda.pedidos.length >= 7);
  assert.equal(celda.estadisticas.pedidosVencidos, 0);
  assert.equal(celda.puntaje, 0);
  assert.equal(celda.terminado, false); // no hay límite de tiempo
});

test('la guía recorre los 17 pasos con el estado real del modelo y termina en el deadlock', () => {
  const { reloj, celda } = nueva();
  const guia = new GuiaTutorial();
  const ctx = { hud: null };
  let ms = 0;
  const paso = () => PASOS[guia.indice].id;
  const avanzar = () => { ms += 100; return guia.avanzar(celda, ctx, ms) > 0; };
  const accion = (maquina, evento, opciones) => assert.deepEqual(celda.solicitar(maquina, evento, opciones), { ok: true }, `${maquina}.${evento} en el paso ${paso()}`);

  assert.equal(paso(), 'abrir_hud');
  assert.equal(avanzar(), false); // todavía no hay HUD abierto
  ctx.hud = 'CNC1';
  avanzar(); assert.equal(paso(), 'mover');
  accion('BRAZO', 'mover', { objetivo: 'CNC1' });
  avanzar(); assert.equal(paso(), 'llegar');
  reloj.avanzar(2);
  avanzar(); assert.equal(paso(), 'abrir');
  accion('BRAZO', 'abrir_mandril');
  avanzar(); assert.equal(paso(), 'cargar');
  accion('CNC1', 'cargar');
  avanzar(); assert.equal(paso(), 'cerrar');
  accion('BRAZO', 'cerrar_mandril'); // el brazo vuelve solo (tr_volver)
  avanzar(); assert.equal(paso(), 'volver');
  assert.equal(avanzar(), false); // el paso informativo se queda un mínimo de tiempo
  ms += 4000;
  avanzar(); assert.equal(paso(), 'fresar');
  accion('CNC1', 'iniciar_fresado');
  avanzar(); assert.equal(paso(), 'esperar');
  reloj.avanzar(10);
  avanzar(); assert.equal(paso(), 'mover2');
  accion('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  avanzar(); assert.equal(paso(), 'abrir2');
  accion('BRAZO', 'abrir_mandril');
  avanzar(); assert.equal(paso(), 'descargar');
  accion('CNC1', 'descargar');
  avanzar(); assert.equal(paso(), 'agv');
  accion('AGV1', 'reservar');
  avanzar(); assert.equal(paso(), 'ciclo');
  assert.equal(celda.radar.nivel, 'amarillo');
  reloj.avanzar(9);
  assert.equal(celda.radar.nivel, 'verde');
  avanzar(); assert.equal(paso(), 'deadlock1');
  accion('AGV1', 'reservar');
  avanzar(); assert.equal(paso(), 'deadlock2');
  accion('AGV2', 'reservar');
  avanzar(); assert.equal(paso(), 'fin');
  assert.equal(celda.deadlock, true);
  assert.deepEqual(celda.red.marcado(), [0, 0, 0, 0, 1, 1, 0, 0, 0]);
  assert.equal(guia.terminado, true);
  assert.equal(PASOS.length, 17);
  // Reintentar el final: vuelve al último verde y la guía regresa al paso del deadlock.
  celda.reintentarDesdeVerde();
  guia.irA('deadlock1', celda, ms);
  assert.equal(celda.deadlock, false);
  assert.equal(paso(), 'deadlock1');
});

test('cada paso señala algo: una máquina, un botón del HUD, un botón de la barra o nada', () => {
  const tipos = new Set(PASOS.map((p) => p.objetivo.tipo));
  assert.deepEqual([...tipos].sort(), ['barra', 'boton', 'maquina', 'ninguno']);
  for (const p of PASOS) assert.ok(p.mensaje.length > 10 && p.mensaje.length < 140, p.id);
});

test('un jugador rápido no se salta pasos: la guía consume la bitácora en orden y avanza varios de golpe', () => {
  const { reloj, celda } = nueva();
  const guia = new GuiaTutorial();
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  const n = guia.avanzar(celda, { hud: 'CNC1' }, 0);
  assert.ok(n >= 6, 'avanzó ' + n);
  assert.equal(PASOS[guia.indice].id, 'volver'); // se detiene en el paso informativo
});
