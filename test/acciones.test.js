// Acciones de juego: cada verbo encadena los eventos reales del autómata, uno por uno (docs/GDD.md, sección 18.19).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Celda } from '../src/sed/celda.js';
import { Acciones } from '../src/sed/acciones.js';
import { Reloj } from '../src/sed/reloj.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA, TURNOS } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const modelos = () => ({
  cnc: cargarModelo('cnc.json'), brazo: cargarModelo('brazo.json'), agv: cargarModelo('agv.json'),
  red: cargarModelo('red_agv.json'), redCorregida: cargarModelo('red_agv_corregida.json'),
  supervisor: cargarModelo('supervisor.json'), reparacion: cargarModelo('reparacion_dfa.json'),
});

function nueva(probFalla = 0) {
  const reloj = new Reloj();
  const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(SEMILLA), turno: { ...TURNOS[0], meta: 999, duracion: 100000, probFalla } });
  celda.arrancar();
  const acciones = new Acciones(celda);
  // Avanza el reloj de a 0,1 s y deja que la secuencia actúe, como hace la planta por cuadro.
  const correr = (s) => { for (let t = 0; t < s; t += 0.1) { reloj.avanzar(0.1); acciones.actualizar(); } };
  const eventos = (maquina) => celda.bitacora.filter((e) => e.tipo === 'automata' && (!maquina || e.maquina === maquina)).map((e) => `${e.maquina}.${e.evento}`);
  return { reloj, celda, acciones, correr, eventos };
}

test('"Cargar bloque" dispara m, l, a, c, e y la vuelta del brazo, en orden y uno por uno', () => {
  const { celda, acciones, correr, eventos } = nueva();
  assert.equal(acciones.describir('CNC1').etiqueta, 'Cargar bloque');
  assert.equal(acciones.ejecutar('CNC1'), true);
  correr(10);
  assert.deepEqual(eventos().slice(0, 7), ['BRAZO.mover', 'BRAZO.llegar', 'BRAZO.abrir_mandril', 'CNC1.cargar', 'BRAZO.cargar', 'BRAZO.cerrar_mandril', 'BRAZO.mover']);
  assert.equal(celda.estado('CNC1'), 'Cargado');
  assert.equal(celda.estado('BRAZO'), 'Reposo');
  assert.equal(acciones.activa, null);
  assert.equal(acciones.describir('CNC1').etiqueta, 'Fresar');
});

test('"Fresar" pide iniciar_fresado; mientras fresa no hay botón y hay progreso', () => {
  const { celda, acciones, correr } = nueva();
  acciones.ejecutar('CNC1'); correr(10);
  assert.equal(acciones.ejecutar('CNC1'), true); // Fresar
  assert.equal(celda.estado('CNC1'), 'Fresando');
  const d = acciones.describir('CNC1');
  assert.equal(d.tipo, 'progreso');
  assert.equal(d.habilitada, false);
  correr(5);
  assert.ok(Math.abs(acciones.progresoFresado('CNC1').fraccion - 0.5) < 0.06);
  correr(6);
  assert.equal(celda.estado('CNC1'), 'Terminado');
});

test('"Sacar pieza" hace la secuencia del brazo con d y suma la pieza por δ', () => {
  const { celda, acciones, correr, eventos } = nueva();
  acciones.ejecutar('CNC1'); correr(10);
  acciones.ejecutar('CNC1'); correr(12);
  assert.equal(acciones.describir('CNC1').etiqueta, 'Sacar pieza');
  const antes = eventos().length;
  acciones.ejecutar('CNC1'); correr(10);
  assert.deepEqual(eventos().slice(antes, antes + 5), ['BRAZO.mover', 'BRAZO.llegar', 'BRAZO.abrir_mandril', 'CNC1.descargar', 'BRAZO.descargar']);
  assert.equal(celda.estado('CNC1'), 'Libre');
  assert.equal(celda.estadisticas.piezas, 1);
  assert.equal(celda.estado('BRAZO'), 'Reposo');
});

test('con el brazo atendiendo a la otra CNC el botón dice "Brazo ocupado" y está deshabilitado', () => {
  const { acciones, correr } = nueva();
  acciones.ejecutar('CNC1');
  correr(1.2);
  const d = acciones.describir('CNC2');
  assert.equal(d.etiqueta, 'Brazo ocupado');
  assert.equal(d.habilitada, false);
  assert.equal(acciones.ejecutar('CNC2'), false);
  correr(10);
  assert.equal(acciones.describir('CNC2').etiqueta, 'Cargar bloque');
});

test('la secuencia nunca insiste contra el supervisor (sin intentos bloqueados) y respeta la red', () => {
  const { celda, acciones, correr } = nueva();
  acciones.ejecutar('CNC1'); correr(10);
  acciones.ejecutar('CNC1'); correr(12);
  acciones.ejecutar('CNC1'); correr(10);
  acciones.ejecutar('CNC2'); correr(10);
  assert.equal(celda.estadisticas.bloqueos, 0);
});

test('el brazo espera si un AGV tiene el robot (la red no habilita tr_ir) y luego sigue', () => {
  const { celda, acciones, correr, eventos } = nueva();
  celda.solicitar('AGV2', 'reservar'); // AGV2 toma Robot_libre
  assert.equal(acciones.describir('CNC1').etiqueta, 'Brazo ocupado');
  correr(20); // el AGV termina su ciclo (4 + 5 s) y devuelve el robot
  assert.equal(acciones.describir('CNC1').etiqueta, 'Cargar bloque');
  acciones.ejecutar('CNC1'); correr(10);
  assert.ok(eventos().includes('CNC1.cargar'));
});

test('despachar AGV usa el evento reservar de la Celda; tras un deadlock o el fin del turno no hay acciones', () => {
  const { celda, acciones } = nueva();
  assert.deepEqual(acciones.despachar('AGV1'), { ok: true });
  assert.equal(celda.estado('AGV1'), 'Viajando');
  acciones.despachar('AGV2');
  assert.equal(celda.deadlock, true);
  assert.equal(acciones.describir('CNC1').habilitada, false);
});

test('una falla de la CNC cancela la secuencia sin cambiar estados por su cuenta', () => {
  const { celda, acciones, correr } = nueva();
  acciones.ejecutar('CNC1'); correr(10);
  acciones.ejecutar('CNC1'); // fresa
  celda.forzarFalla();
  assert.equal(acciones.describir('CNC1').tipo, 'reparar');
  assert.equal(acciones.describir('CNC1').habilitada, false);
});

test('el historial de una CNC incluye los eventos del brazo mientras la atendía (m, l, a, e), en orden', () => {
  const { acciones, correr } = nueva();
  acciones.ejecutar('CNC1'); correr(10);
  assert.deepEqual(acciones.eventosDe('CNC1').map((h) => `${h.maquina}.${h.evento}`),
    ['BRAZO.mover', 'BRAZO.llegar', 'BRAZO.abrir_mandril', 'CNC1.cargar', 'BRAZO.cargar', 'BRAZO.cerrar_mandril', 'BRAZO.mover']);
  assert.deepEqual(acciones.eventosDe('CNC2'), []);
  assert.equal(acciones.eventosDe('BRAZO').length, 6);
});

test('la acción del AGV es despachar y, si no puede, dice qué hace', () => {
  const { celda, acciones, correr } = nueva();
  assert.deepEqual([acciones.describirAGV('AGV1').etiqueta, acciones.describirAGV('AGV1').habilitada], ['Despachar AGV 1', true]);
  acciones.despachar('AGV1');
  assert.deepEqual([acciones.describirAGV('AGV1').etiqueta, acciones.describirAGV('AGV1').habilitada], ['En camino…', false]);
  correr(4.5);
  assert.equal(celda.estado('AGV1'), 'Descargando');
  assert.equal(acciones.describirAGV('AGV1').etiqueta, 'Descargando…');
});
