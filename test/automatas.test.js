// Palabras de prueba de docs/modelo/automatas.md (secciones 3 a 8): deben dar lo mismo que JFLAP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Automata } from '../src/sed/automata.js';
import { cargarModelo } from './ayudas.js';

// [palabra con códigos de una letra, ¿se acepta?]. '' es la palabra vacía (ε).
const PALABRAS = {
  'cnc.json': [
    ['cifd', true], ['cixr', true], ['cifdcixr', true], ['cifdcifd', true],
    ['ci', false], ['cif', false], ['cid', false], ['cx', false],
  ],
  'brazo.json': [
    ['mlm', true], ['mlacdm', true], ['mlaem', true], ['mlaccdm', true],
    ['mla', false], ['ml', false], ['mlad', false], ['am', false],
  ],
  'agv.json': [
    ['vguz', true], ['vguzvguz', true], ['vguzvguzvguz', true], ['', true],
    ['v', false], ['vgu', false], ['uvgz', false], ['vguzu', false],
  ],
};

for (const [archivo, palabras] of Object.entries(PALABRAS)) {
  test(`${archivo}: las 8 palabras de prueba dan el resultado de JFLAP`, () => {
    const modelo = cargarModelo(archivo);
    assert.equal(palabras.length, 8);
    for (const [palabra, esperado] of palabras) {
      assert.equal(new Automata(modelo).aceptaCodigos(palabra), esperado, `"${palabra || 'ε'}"`);
    }
  });
}

test('cada máquina tiene q0 = Qm y los estados de la ficha', () => {
  const esperado = {
    'cnc.json': ['Libre', 'Cargado', 'Fresando', 'Terminado', 'Falla'],
    'brazo.json': ['Reposo', 'Moviendo', 'Mandril_Cerrado', 'Mandril_Abierto'],
    'agv.json': ['Libre', 'Viajando', 'Esperando', 'Descargando'],
  };
  for (const [archivo, estados] of Object.entries(esperado)) {
    const g = new Automata(cargarModelo(archivo));
    assert.deepEqual(g.estados, estados);
    assert.deepEqual([...g.marcados], [g.inicial]);
  }
});

test('Σuo = ∅ y los eventos no controlables son los de la ficha', () => {
  const nc = (archivo) => cargarModelo(archivo).eventos.filter((e) => !e.controlable).map((e) => e.codigo);
  assert.deepEqual(nc('cnc.json'), ['f', 'x']);
  assert.deepEqual(nc('brazo.json'), ['l']);
  assert.deepEqual(nc('agv.json'), ['g', 'z']);
  for (const archivo of ['cnc.json', 'brazo.json', 'agv.json']) {
    assert.ok(cargarModelo(archivo).eventos.every((e) => e.observable));
  }
});

test('ejecutar usa solo δ y lanza un error si δ(q, σ) no está definida', () => {
  const cnc = new Automata(cargarModelo('cnc.json'));
  assert.deepEqual(cnc.eventosActivos(), ['cargar']);
  assert.equal(cnc.puede('iniciar_fresado'), false);
  assert.throws(() => cnc.ejecutar('iniciar_fresado'), /no está definida/);
  assert.equal(cnc.estado, 'Libre'); // el error no cambia el estado
  assert.equal(cnc.esMarcado(), true);

  cnc.ejecutar('cargar');
  cnc.ejecutar('iniciar_fresado');
  assert.equal(cnc.estado, 'Fresando');
  assert.deepEqual(cnc.eventosActivos().sort(), ['falla_husillo', 'fin_fresado']);
  assert.equal(cnc.esMarcado(), false);
  assert.deepEqual(cnc.historial, [
    { de: 'Libre', evento: 'cargar', a: 'Cargado' },
    { de: 'Cargado', evento: 'iniciar_fresado', a: 'Fresando' },
  ]);
});

test('una instancia por máquina: dos CNC no comparten estado', () => {
  const modelo = cargarModelo('cnc.json');
  const cnc1 = new Automata(modelo);
  const cnc2 = new Automata(modelo);
  cnc1.ejecutar('cargar');
  assert.equal(cnc1.estado, 'Cargado');
  assert.equal(cnc2.estado, 'Libre');
});

test('un autómata no determinista se rechaza al construirlo', () => {
  const modelo = cargarModelo('cnc.json');
  modelo.transiciones.push(['Libre', 'cargar', 'Falla']);
  assert.throws(() => new Automata(modelo), /no determinista/);
});
