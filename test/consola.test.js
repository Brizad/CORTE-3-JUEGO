// Consola de reparación: teclear, DFA paso a paso, validación al enviar y puntaje (GDD, secciones 8 y 14.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ConsolaReparacion } from '../src/sed/consola.js';
import { Celda } from '../src/sed/celda.js';
import { Reloj } from '../src/sed/reloj.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA, TURNOS } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const dfa = cargarModelo('reparacion_dfa.json');
const teclear = (palabra) => {
  const c = new ConsolaReparacion(dfa);
  for (const s of palabra) c.escribir(s);
  return c;
};

test('HCTCR recorre q0 q1 q2 q3 q2 q4 y queda aceptada', () => {
  const c = new ConsolaReparacion(dfa);
  const estados = [c.estado];
  for (const s of 'HCTCR') {
    c.escribir(s);
    estados.push(c.estado);
  }
  assert.deepEqual(estados, ['q0', 'q1', 'q2', 'q3', 'q2', 'q4']);
  assert.equal(c.aceptada, true);
  assert.equal(c.fallo, null);
});

test('un símbolo sin transición se marca y explica qué se esperaba', () => {
  const c = teclear('HT');
  assert.equal(c.palabra, 'HT');
  assert.equal(c.estado, null);
  assert.equal(c.fallo.simbolo, 'T');
  assert.equal(c.fallo.mensaje, 'Después de H se espera C (chequeo de herramienta).');
  assert.equal(teclear('HR').fallo.mensaje, 'Después de H se espera C (chequeo de herramienta).');
  assert.equal(teclear('C').fallo.mensaje, 'Al empezar se espera H (home de ejes).');
  assert.equal(teclear('HCTT').fallo.mensaje, 'Después de T se espera C o R.');
  assert.match(teclear('HCRC').fallo.mensaje, /Después de R no se espera nada/); // tras R no hay transiciones
});

test('tras un error se sigue tecleando (el primero queda marcado); Retroceso lo quita y rehace el DFA', () => {
  const c = teclear('HT');
  assert.equal(c.escribir('C'), true);
  assert.equal(c.palabra, 'HTC');
  assert.equal(c.fallo.indice, 1); // el error sigue siendo la T
  c.borrar();
  c.borrar();
  assert.equal(c.palabra, 'H');
  assert.equal(c.estado, 'q1');
  assert.equal(c.fallo, null);
  c.escribir('c');
  assert.equal(c.palabra, 'HC');
  assert.equal(c.escribir('x'), false); // no es un comando
  assert.deepEqual(c.esperados.sort(), ['C', 'R', 'T']);
});

// Celda con una CNC fresando para probar el envío y el puntaje.
function celdaConFalla() {
  const reloj = new Reloj();
  const modelos = {
    cnc: cargarModelo('cnc.json'), brazo: cargarModelo('brazo.json'), agv: cargarModelo('agv.json'),
    red: cargarModelo('red_agv.json'), supervisor: cargarModelo('supervisor.json'), reparacion: dfa,
  };
  const celda = new Celda({ modelos, reloj, aleatorio: crearAleatorio(SEMILLA), turno: { ...TURNOS[0], probFalla: 0 } });
  const preparar = () => {
    celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
    reloj.avanzar(2);
    celda.solicitar('BRAZO', 'abrir_mandril');
    celda.solicitar('CNC1', 'cargar');
    celda.solicitar('BRAZO', 'cerrar_mandril');
    celda.solicitar('CNC1', 'iniciar_fresado');
    assert.equal(celda.forzarFalla(), 'CNC1');
  };
  return { reloj, celda, preparar };
}

test('2 palabras válidas (HCTCR, HCR) reparan y suman +50; 3 inválidas (HTCR, HR, HCT) no y restan −30', () => {
  const { celda, preparar } = celdaConFalla();
  for (const w of ['HCTCR', 'HCR']) {
    preparar();
    assert.equal(celda.estado('CNC1'), 'Falla');
    const antes = celda.puntaje;
    assert.deepEqual(celda.solicitar('CNC1', 'reset', { palabra: w }), { ok: true }, w);
    assert.equal(celda.estado('CNC1'), 'Libre');
    assert.equal(celda.puntaje - antes, 50, w);
  }
  preparar();
  for (const w of ['HTCR', 'HR', 'HCT']) {
    const antes = celda.puntaje;
    assert.deepEqual(celda.solicitar('CNC1', 'reset', { palabra: w }), { ok: false, motivo: 'palabra_invalida' }, w);
    assert.equal(celda.estado('CNC1'), 'Falla', w);
    assert.equal(celda.puntaje - antes, -30, w);
  }
  assert.equal(celda.puntaje, 100 - 90);
});

test('pedir ayuda muestra la expresión 5 s y resta 20 cada vez', () => {
  const { reloj, celda } = celdaConFalla();
  assert.equal(celda.pedirAyuda('CNC1'), '^H(CT?)+R$');
  assert.equal(celda.puntaje, -20);
  assert.equal(celda.ayudaHasta, reloj.ahora + 5);
  celda.pedirAyuda('CNC1');
  assert.equal(celda.puntaje, -40);
});

test('forzarFalla cancela el fin_fresado: no hay error después de 10 s', () => {
  const { reloj, celda, preparar } = celdaConFalla();
  preparar();
  reloj.avanzar(30);
  assert.equal(celda.estado('CNC1'), 'Falla');
  assert.equal(celda.estadisticas.fallas, 1);
  assert.equal(celda.forzarFalla(), null); // nadie fresando
});
