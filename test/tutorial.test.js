// Tutorial "Turno 0": la guía avanza con el estado del modelo y termina provocando el deadlock (docs/GDD.md, sección 18.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Celda } from '../src/sed/celda.js';
import { Reloj } from '../src/sed/reloj.js';
import { Partida } from '../src/sed/partida.js';
import { GuiaTutorial, PASOS } from '../src/sed/tutorial.js';
import { describir, ejecutar } from '../src/sed/controles.js';
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

test('la guía recorre los 16 pasos con un botón por paso (un evento cada uno) y termina en el deadlock', () => {
  const { reloj, celda } = nueva();
  const guia = new GuiaTutorial();
  const ctx = { hud: null };
  let ms = 0;
  const paso = () => PASOS[guia.indice];
  const avanzar = () => { ms += 100; return guia.avanzar(celda, ctx, ms) > 0; };
  // Pulsa el botón de la barra que señala el paso: debe estar en verde y disparar exactamente un evento por autómata.
  const pulsar = () => {
    const id = paso().objetivo.clave;
    assert.equal(describir(celda, id).tipo, 'verde', `${id} en el paso ${paso().id}`);
    const antes = celda.bitacora.filter((e) => e.tipo === 'automata').length;
    assert.equal(ejecutar(celda, id).ok, true, `${id} en el paso ${paso().id}`);
    return celda.bitacora.filter((e) => e.tipo === 'automata').length - antes;
  };
  const en = (id) => { avanzar(); assert.equal(paso().id, id); };

  en('ir'); pulsar();
  en('llegar'); reloj.avanzar(2);
  en('abrir'); assert.equal(pulsar(), 1);
  en('meter'); assert.equal(pulsar(), 2); // evento compartido: lo ejecutan la CNC y el brazo
  en('cerrar'); pulsar(); // e y la vuelta automática del brazo (tr_volver)
  en('fresar'); assert.equal(pulsar(), 1);
  en('panel');
  assert.equal(avanzar(), false); // hasta que se abre el panel de la CNC 1
  ctx.hud = 'CNC1';
  en('esperar'); reloj.avanzar(10);
  en('ir2'); pulsar(); reloj.avanzar(2);
  en('abrir2'); pulsar();
  en('sacar'); pulsar();
  assert.equal(celda.estadisticas.piezas, 1);
  en('agv'); assert.equal(pulsar(), 1);
  en('ciclo');
  assert.equal(celda.radar.nivel, 'amarillo');
  reloj.avanzar(9);
  assert.equal(celda.radar.nivel, 'verde');
  en('deadlock1'); pulsar();
  en('deadlock2'); pulsar();
  en('fin');
  assert.equal(celda.deadlock, true);
  assert.deepEqual(celda.red.marcado(), [0, 0, 0, 0, 1, 1, 0, 0, 0]);
  assert.equal(guia.terminado, true);
  assert.equal(PASOS.length, 16);
  // Reintentar el final: vuelve al último verde y la guía regresa al paso del deadlock.
  celda.reintentarDesdeVerde();
  guia.irA('deadlock1', celda, ms);
  assert.equal(celda.deadlock, false);
  assert.equal(paso().id, 'deadlock1');
});

test('cada paso señala algo: un botón de la barra de control, una máquina o nada; frases cortas', () => {
  const tipos = new Set(PASOS.map((p) => p.objetivo.tipo));
  assert.deepEqual([...tipos].sort(), ['barra', 'maquina', 'ninguno']);
  for (const p of PASOS) assert.ok(p.mensaje.length > 10 && p.mensaje.length <= 100, `${p.id}: ${p.mensaje.length}`);
  // Un botón por paso: los pasos con botón nombran su tecla.
  for (const p of PASOS.filter((q) => q.objetivo.tipo === 'barra')) assert.match(p.mensaje, /\([A-Z]\)|tecla [A-Z]/, p.id);
});

test('un jugador rápido no se salta pasos: la guía consume la bitácora en orden y avanza varios de golpe', () => {
  const { reloj, celda } = nueva();
  const guia = new GuiaTutorial();
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  const n = guia.avanzar(celda, { hud: null }, 0);
  assert.equal(n, 5, 'avanzó ' + n);
  assert.equal(PASOS[guia.indice].id, 'fresar');
});

test('los textos del tutorial no usan las palabras "pedido" ni "cliente"', () => {
  for (const p of PASOS) assert.ok(!/pedido|cliente/i.test(p.mensaje), p.id);
});
