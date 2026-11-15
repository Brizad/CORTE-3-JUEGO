// Lenguaje de reparación ^H(CT?)+R$: la RegExp y el DFA de JFLAP deben coincidir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarConRegExp, validarConDFA, ValidadorReparacion, EXPRESION_TEXTO } from '../src/sed/lenguaje.js';
import { cargarModelo } from './ayudas.js';

const dfa = cargarModelo('reparacion_dfa.json');

// 20 palabras: las 9 de docs/modelo/automatas.md (sección 7) y 11 más.
const PALABRAS = [
  ['HCTCR', true], ['HCR', true], ['HCTR', true], ['HCCTCR', true],
  ['HTCR', false], ['HR', false], ['CR', false], ['HCTTR', false], ['HCT', false],
  ['HCCR', true], ['HCTCTCR', true], ['HCCCR', true], ['HCTCCR', true],
  ['', false], ['H', false], ['R', false], ['HCRR', false], ['HHCR', false], ['HCRC', false], ['hcr', false],
];

test('el DFA exportado es la expresión ^H(CT?)+R$ de JFLAP', () => {
  assert.equal(dfa.expresion, '^H(CT?)+R$');
  assert.equal(dfa.expresionJflap, 'H(C(T+!))(C(T+!))*R');
  assert.equal(EXPRESION_TEXTO, '^H(CT?)+R$');
  assert.equal(dfa.estados.length, 5); // DFA mínimo
  assert.deepEqual(dfa.marcados, ['q4']);
});

test('la RegExp y el DFA coinciden en 20 palabras y dan el resultado esperado', () => {
  assert.equal(PALABRAS.length, 20);
  for (const [palabra, esperado] of PALABRAS) {
    assert.equal(validarConRegExp(palabra), esperado, `RegExp "${palabra}"`);
    assert.equal(validarConDFA(dfa, palabra), esperado, `DFA "${palabra}"`);
  }
});

test('HCTCR repara y HTCR no (criterios CA-01 y CA-02)', () => {
  const v = new ValidadorReparacion(dfa);
  for (const s of 'HCTCR') v.avanzar(s);
  assert.equal(v.esValida(), true);
  v.reiniciar();
  for (const s of 'HTCR') v.avanzar(s);
  assert.equal(v.esValida(), false);
});

test('avanzar muestra el progreso paso a paso', () => {
  const v = new ValidadorReparacion(dfa);
  let p = v.avanzar('H');
  assert.deepEqual([p.estado, p.aceptada, p.rechazada, p.siguientes], ['q1', false, false, ['C']]);
  p = v.avanzar('C');
  assert.equal(p.estado, 'q2');
  assert.deepEqual(p.siguientes.sort(), ['C', 'R', 'T']);
  p = v.avanzar('T');
  assert.equal(p.estado, 'q3');
  p = v.avanzar('R');
  assert.equal(p.estado, 'q4');
  assert.equal(p.aceptada, true);
  assert.equal(p.palabra, 'HCTR');
});

test('un símbolo fuera de lugar rechaza la palabra para siempre', () => {
  const v = new ValidadorReparacion(dfa);
  v.avanzar('H');
  const p = v.avanzar('T'); // H seguido de T no está definido
  assert.equal(p.rechazada, true);
  assert.equal(p.estado, null);
  for (const s of 'CR') v.avanzar(s); // aunque se siga tecleando, no se acepta
  assert.equal(v.esValida(), false);
});

test('después de la R la palabra ya no admite más símbolos', () => {
  const v = new ValidadorReparacion(dfa);
  for (const s of 'HCR') v.avanzar(s);
  assert.equal(v.esValida(), true);
  v.avanzar('C');
  assert.equal(v.esValida(), false);
});
