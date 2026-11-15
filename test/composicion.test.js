// Composición CNC || Brazo y supervisor (docs/modelo/automatas.md, sección 6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Automata } from '../src/sed/automata.js';
import { componer, supervisor, claveDe } from '../src/sed/composicion.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const cnc = cargarModelo('cnc.json');
const brazo = cargarModelo('brazo.json');
const config = cargarModelo('supervisor.json');
const composicion = componer(cnc, brazo);
const sup = supervisor(composicion, config.prohibidos, { razon: config.razon });

const PROHIBIDO = claveDe(['Fresando', 'Mandril_Abierto']);

test('CNC || Brazo tiene 20 estados y 43 transiciones', () => {
  assert.equal(composicion.estados.length, 20);
  assert.equal(composicion.transiciones.length, 43);
  assert.equal(composicion.inicial, claveDe(['Libre', 'Reposo']));
  assert.deepEqual(composicion.marcados, [composicion.inicial]);
});

test('los eventos comunes ocurren a la vez y los privados por separado', () => {
  const t = composicion.transiciones;
  // cargar y descargar son comunes: solo ocurren con el brazo en Mandril_Abierto.
  const cargar = t.filter(([, e]) => e === 'cargar');
  assert.deepEqual(cargar, [[claveDe(['Libre', 'Mandril_Abierto']), 'cargar', claveDe(['Cargado', 'Mandril_Abierto'])]]);
  const descargar = t.filter(([, e]) => e === 'descargar');
  assert.deepEqual(descargar, [[claveDe(['Terminado', 'Mandril_Abierto']), 'descargar', claveDe(['Libre', 'Mandril_Cerrado'])]]);
  // Un evento privado del CNC (iniciar_fresado) ocurre con cualquier estado del brazo.
  assert.equal(t.filter(([, e]) => e === 'iniciar_fresado').length, 4);
  // Conteo por tipo: 16 privadas del CNC + 25 privadas del Brazo + 2 comunes = 43.
  const privCnc = t.filter(([, e]) => ['iniciar_fresado', 'fin_fresado', 'falla_husillo', 'reset'].includes(e)).length;
  const privBrazo = t.filter(([, e]) => ['mover', 'llegar', 'abrir_mandril', 'cerrar_mandril'].includes(e)).length;
  assert.deepEqual([privCnc, privBrazo, cargar.length + descargar.length], [16, 25, 2]);
});

test('el supervisado tiene 19 estados y 38 transiciones', () => {
  assert.equal(sup.estados.length, 19);
  assert.equal(sup.transiciones.length, 38);
  assert.ok(!sup.estados.includes(PROHIBIDO));
  assert.deepEqual([...sup.malos], [PROHIBIDO]); // ningún evento no controlable llega al prohibido
});

test('se deshabilita iniciar_fresado en (Cargado, Mandril_Abierto) y abrir_mandril en (Fresando, Mandril_Cerrado)', () => {
  const todos = [...sup.deshabilitados.entries()].flatMap(([estado, lista]) => lista.map((d) => [estado, d.evento]));
  assert.deepEqual(todos.sort(), [
    [claveDe(['Cargado', 'Mandril_Abierto']), 'iniciar_fresado'],
    [claveDe(['Fresando', 'Mandril_Cerrado']), 'abrir_mandril'],
  ].sort());

  const d = sup.deshabilitadosEn(claveDe(['Cargado', 'Mandril_Abierto']));
  assert.equal(d.length, 1);
  assert.equal(d[0].razon, '¬(CNC = Fresando ∧ Brazo = Mandril_Abierto)');
  assert.equal(sup.permite(claveDe(['Cargado', 'Mandril_Abierto']), 'iniciar_fresado'), false);
  assert.equal(sup.permite(claveDe(['Cargado', 'Mandril_Cerrado']), 'iniciar_fresado'), true);
  assert.equal(sup.permite(claveDe(['Fresando', 'Mandril_Cerrado']), 'abrir_mandril'), false);
});

test('un evento no controlable que lleva al estado prohibido hace malo al estado de origen', () => {
  // Se prohíbe (Falla, Mandril_Abierto). falla_husillo (no controlable) llega ahí desde
  // (Fresando, Mandril_Abierto): el supervisor no puede impedir la falla, así que ese estado también es malo.
  const s = supervisor(composicion, [['Falla', 'Mandril_Abierto']]);
  assert.ok(s.malos.has(claveDe(['Falla', 'Mandril_Abierto'])));
  assert.ok(s.malos.has(claveDe(['Fresando', 'Mandril_Abierto'])));
});

test('las pruebas del supervisor de la sección 6.4 dan el resultado esperado', () => {
  const palabras = [
    ['mlm', true], ['mlaceifadm', true], ['mlaceixrm', true], ['mlaceifadmmlm', true],
    ['mlaci', false], ['mlaceia', false], ['mlac', false], ['mlaceif', false],
  ];
  const mapa = new Map([...cnc.eventos, ...brazo.eventos].map((e) => [e.codigo, e.id]));
  for (const [palabra, esperado] of palabras) {
    const g = new Automata(composicion);
    let ok = true;
    for (const letra of palabra) {
      const evento = mapa.get(letra);
      if (!g.puede(evento) || !sup.permite(g.estado, evento)) { ok = false; break; }
      g.ejecutar(evento);
    }
    assert.equal(ok && g.esMarcado(), esperado, `"${palabra}"`);
  }
});

test('10 000 eventos aleatorios del sistema supervisado nunca entran al estado prohibido', () => {
  const azar = crearAleatorio(SEMILLA);
  const g = new Automata(composicion);
  let bloqueos = 0; // veces que el supervisor tuvo que deshabilitar un evento
  for (let paso = 0; paso < 10000; paso++) {
    const activos = g.eventosActivos();
    const permitidos = activos.filter((e) => sup.permite(g.estado, e));
    bloqueos += activos.length - permitidos.length;
    assert.ok(permitidos.length > 0, `bloqueo en ${g.estado}`); // el supervisado nunca se queda sin eventos
    g.ejecutar(permitidos[Math.floor(azar.siguiente() * permitidos.length)]);
    assert.notEqual(g.estado, PROHIBIDO, `entró al estado prohibido en el paso ${paso}`);
    const [cncEstado, brazoEstado] = composicion.componentes[g.estado];
    assert.ok(!(cncEstado === 'Fresando' && brazoEstado === 'Mandril_Abierto'));
  }
  assert.equal(g.historial.length, 10000);
  assert.ok(bloqueos > 0, 'la prueba debe poner a prueba al supervisor al menos una vez');
});

test('sin supervisor, los eventos aleatorios sí llegan al estado prohibido', () => {
  const azar = crearAleatorio(SEMILLA);
  const g = new Automata(composicion);
  let llego = false;
  for (let paso = 0; paso < 10000 && !llego; paso++) {
    const activos = g.eventosActivos();
    g.ejecutar(activos[Math.floor(azar.siguiente() * activos.length)]);
    llego = g.estado === PROHIBIDO;
  }
  assert.equal(llego, true);
});
