// Celda de manufactura y piloto automático (docs/GDD.md, secciones 5, 6 y 15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Celda } from '../src/sed/celda.js';
import { Piloto } from '../src/sed/piloto.js';
import { Reloj } from '../src/sed/reloj.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA, TURNOS } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const modelos = () => ({
  cnc: cargarModelo('cnc.json'),
  brazo: cargarModelo('brazo.json'),
  agv: cargarModelo('agv.json'),
  red: cargarModelo('red_agv.json'),
  supervisor: cargarModelo('supervisor.json'),
  reparacion: cargarModelo('reparacion_dfa.json'),
});

function nueva(turno = TURNOS[0]) {
  const reloj = new Reloj();
  const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(SEMILLA), turno });
  celda.arrancar();
  return { reloj, celda };
}

// Invariantes P de petri.md, sección 7.
const INVARIANTES = [
  ['Mesa_libre', 'AGV1_con_mesa', 'AGV1_trabajando', 'AGV2_trabajando'],
  ['Robot_libre', 'AGV2_con_robot', 'AGV1_trabajando', 'AGV2_trabajando', 'Robot_en_CNC'],
  ['AGV1_listo', 'AGV1_con_mesa', 'AGV1_trabajando'],
  ['AGV2_listo', 'AGV2_con_robot', 'AGV2_trabajando'],
];

/** Corre la demostración t segundos de simulación en pasos de dt, vigilando las reglas del modelo. */
function correr(celda, reloj, piloto, t, dt = 0.25) {
  const vistos = { fresando: 0 };
  celda.alCambiar((e) => {
    // El estado prohibido nunca se alcanza para la CNC atendida y los invariantes P se conservan.
    if (celda.atendida) {
      const prohibido = celda.estado(celda.atendida) === 'Fresando' && celda.estado('BRAZO') === 'Mandril_Abierto';
      assert.equal(prohibido, false, `estado prohibido en t = ${e.t}`);
    }
    for (const inv of INVARIANTES) {
      assert.equal(inv.reduce((s, n) => s + celda.red.fichas(n), 0), 1, `invariante en t = ${e.t}`);
    }
    if (e.tipo === 'automata' && e.a === 'Fresando') vistos.fresando++;
  });
  piloto.activar();
  for (let i = 0; i < t / dt; i++) reloj.avanzar(dt);
  return vistos;
}

test('la demostración funciona 120 s sin errores, sin deadlock y sin intentos bloqueados', () => {
  const { reloj, celda } = nueva();
  const vistos = correr(celda, reloj, new Piloto(celda), 120);
  assert.equal(celda.deadlock, false);
  assert.ok(vistos.fresando >= 2, 'las CNC fresan');
  assert.ok(celda.estadisticas.piezas >= 1, 'se descargan piezas');
  assert.ok(celda.estadisticas.ciclosAGV >= 2, 'los AGV completan ciclos');
  assert.equal(celda.estadisticas.bloqueos, 0);
  assert.equal(celda.bitacora.filter((e) => e.tipo === 'rechazo').length, 0);
});

test('la demostración dura 600 s en los tres turnos sin errores ni deadlock', () => {
  for (const turno of TURNOS) {
    const { reloj, celda } = nueva({ ...turno, duracion: 600 });
    correr(celda, reloj, new Piloto(celda), 600);
    assert.equal(celda.deadlock, false);
  }
});

test('con la misma semilla, la demostración repite exactamente la misma bitácora', () => {
  const resumen = () => {
    const { reloj, celda } = nueva();
    correr(celda, reloj, new Piloto(celda), 120);
    return JSON.stringify(celda.bitacora.map((e) => [e.t, e.tipo, e.maquina, e.evento, e.transicion]));
  };
  assert.equal(resumen(), resumen());
});

test('los tiempos del GDD: brazo 2 s, AGV viaja 4 s y descarga 5 s', () => {
  const { reloj, celda } = nueva();
  const hecho = (maquina, evento) => celda.bitacora.find((e) => e.tipo === 'automata' && e.maquina === maquina && e.evento === evento);
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' }); // t = 0
  celda.solicitar('AGV1', 'reservar');
  reloj.avanzar(1.999);
  assert.equal(hecho('BRAZO', 'llegar'), undefined);
  reloj.avanzar(0.002);
  assert.equal(hecho('BRAZO', 'llegar').t, 2);
  reloj.avanzar(10);
  assert.equal(hecho('AGV1', 'llegar_estacion').t, 4);
  // t1b necesita Robot_libre: el brazo sigue fuera, así que el AGV espera.
  assert.equal(celda.estado('AGV1'), 'Esperando');
  celda.solicitar('BRAZO', 'abrir_mandril'); // la CNC1 está Libre: se puede
  celda.solicitar('BRAZO', 'cerrar_mandril'); // cierra y vuelve solo (tr_volver), liberando el robot
  const t0 = reloj.ahora;
  assert.equal(hecho('AGV1', 'iniciar_descarga').t, t0); // t1b se dispara apenas Robot_libre tiene ficha
  reloj.avanzar(5);
  assert.equal(hecho('AGV1', 'fin_descarga').t, t0 + 5);
});

test('el fresado dura 10 s si no falla (probabilidad de falla 0)', () => {
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 0 });
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  celda.solicitar('CNC1', 'iniciar_fresado');
  const t0 = reloj.ahora;
  reloj.avanzar(9.99);
  assert.equal(celda.estado('CNC1'), 'Fresando');
  reloj.avanzar(0.02);
  assert.equal(celda.estado('CNC1'), 'Terminado');
  assert.equal(celda.bitacora.find((e) => e.evento === 'fin_fresado').t, t0 + 10);
});

test('el supervisor rechaza i con el mandril abierto y a con la CNC fresando', () => {
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 0 });
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  assert.deepEqual(celda.solicitar('CNC1', 'cargar'), { ok: true });
  assert.deepEqual(celda.solicitar('CNC1', 'iniciar_fresado'), { ok: false, motivo: 'supervisor' });
  assert.equal(celda.estado('CNC1'), 'Cargado');
  assert.equal(celda.estadisticas.bloqueos, 1);
  celda.solicitar('BRAZO', 'cerrar_mandril');
  assert.deepEqual(celda.solicitar('CNC1', 'iniciar_fresado'), { ok: true });
  // Con la CNC fresando, el brazo vuelve a ir y no puede abrir el mandril.
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  assert.equal(celda.evaluar('BRAZO', 'abrir_mandril'), 'supervisor');
});

test('la otra CNC no tiene restricción del supervisor (Doble husillo)', () => {
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 0 });
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  celda.solicitar('CNC1', 'iniciar_fresado');
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC2' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC2', 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  assert.equal(celda.estado('CNC1'), 'Fresando');
  assert.equal(celda.evaluar('CNC2', 'iniciar_fresado'), null);
});

test('t1a y luego t2a: marcado muerto [0,0,0,0,1,1,0,0,0] y deadlock', () => {
  const { celda } = nueva();
  assert.deepEqual(celda.solicitar('AGV1', 'reservar'), { ok: true });
  assert.deepEqual(celda.solicitar('AGV2', 'reservar'), { ok: true });
  assert.deepEqual(celda.red.marcado(), [0, 0, 0, 0, 1, 1, 0, 0, 0]);
  assert.equal(celda.deadlock, true);
  assert.equal(celda.bitacora.filter((e) => e.tipo === 'deadlock').length, 1);
});

test('los eventos sin δ o sin recurso se rechazan sin cambiar el estado', () => {
  const { celda } = nueva();
  assert.deepEqual(celda.solicitar('CNC1', 'cargar'), { ok: false, motivo: 'indefinido' }); // el brazo no atiende
  assert.deepEqual(celda.solicitar('CNC1', 'fin_fresado'), { ok: false, motivo: 'no_controlable' });
  celda.solicitar('AGV2', 'reservar');
  assert.deepEqual(celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' }), { ok: false, motivo: 'recurso' }); // t2a tomó el robot
  assert.equal(celda.estado('BRAZO'), 'Reposo');
});

test('reparar exige una palabra del lenguaje: HCTCR repara y HTCR no', () => {
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 1 }); // todo fresado falla
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  celda.solicitar('CNC1', 'iniciar_fresado');
  reloj.avanzar(8.5);
  assert.equal(celda.estado('CNC1'), 'Falla');
  assert.deepEqual(celda.solicitar('CNC1', 'reset', { palabra: 'HTCR' }), { ok: false, motivo: 'palabra_invalida' });
  assert.equal(celda.estado('CNC1'), 'Falla');
  assert.deepEqual(celda.solicitar('CNC1', 'reset', { palabra: 'HCTCR' }), { ok: true });
  assert.equal(celda.estado('CNC1'), 'Libre');
});

test('la falla llega entre 2 s y 8 s después de iniciar el fresado', () => {
  for (let semilla = 1; semilla <= 30; semilla++) {
    const reloj = new Reloj();
    const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(semilla), turno: { ...TURNOS[0], probFalla: 1 } });
    celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
    reloj.avanzar(2);
    celda.solicitar('BRAZO', 'abrir_mandril');
    celda.solicitar('CNC1', 'cargar');
    celda.solicitar('BRAZO', 'cerrar_mandril');
    const t0 = reloj.ahora;
    celda.solicitar('CNC1', 'iniciar_fresado');
    reloj.avanzar(10);
    const dt = celda.bitacora.find((e) => e.evento === 'falla_husillo').t - t0;
    assert.ok(dt >= 2 && dt <= 8, `falla a ${dt} s`);
  }
});

test('los pedidos llegan cada 25 s, vencen a los 30 s y un ciclo de AGV atiende el más antiguo', () => {
  const { reloj, celda } = nueva();
  reloj.avanzar(25);
  assert.equal(celda.pedidos.length, 1);
  reloj.avanzar(25);
  assert.deepEqual(celda.pedidos.map((p) => p.t), [25, 50]);
  reloj.avanzar(5); // t = 55: el primero cumplió 30 s
  assert.equal(celda.estadisticas.pedidosVencidos, 1);
  assert.equal(celda.pedidos[0].vencido, true);
  celda.solicitar('AGV1', 'reservar');
  reloj.avanzar(9);
  assert.equal(celda.pedidos.length, 1);
  assert.equal(celda.pedidos[0].t, 50);
});

test('el piloto no toca las máquinas con el HUD abierto (CNC1 bloqueada durante 100 s)', () => {
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 0 });
  const piloto = new Piloto(celda);
  piloto.bloqueadas.add('CNC1');
  celda.alCambiar(() => {});
  piloto.activar();
  for (let i = 0; i < 400; i++) reloj.avanzar(0.25);
  const tocadas = celda.bitacora.filter((e) => e.tipo === 'automata' && e.maquina === 'CNC1');
  assert.equal(tocadas.length, 0, 'CNC1 no cambió de estado');
  assert.equal(celda.estado('CNC1'), 'Libre');
  assert.ok(celda.estadisticas.piezas > 0, 'la CNC2 sí trabaja');
  // Al cerrar el HUD, el piloto vuelve a usarla.
  piloto.bloqueadas.delete('CNC1');
  for (let i = 0; i < 400; i++) reloj.avanzar(0.25);
  assert.ok(celda.bitacora.some((e) => e.tipo === 'automata' && e.maquina === 'CNC1'));
});

test('volver: el brazo regresa a reposo a mano (tr_volver) solo desde Mandril_Cerrado', () => {
  const { reloj, celda } = nueva();
  assert.deepEqual(celda.solicitar('BRAZO', 'volver'), { ok: false, motivo: 'indefinido' }); // en Reposo
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  assert.deepEqual(celda.solicitar('BRAZO', 'volver'), { ok: false, motivo: 'indefinido' }); // Moviendo
  reloj.avanzar(2);
  assert.equal(celda.red.fichas('Robot_en_CNC'), 1);
  assert.deepEqual(celda.solicitar('BRAZO', 'volver'), { ok: true });
  assert.equal(celda.estado('BRAZO'), 'Reposo');
  assert.equal(celda.atendida, null);
  assert.equal(celda.red.fichas('Robot_libre'), 1);
});

test('3 intentos de llegar al estado prohibido: ninguno se ejecuta y cada uno resta 15 puntos', () => {
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 0 });
  const prohibido = () => celda.estado('CNC1') === 'Fresando' && celda.estado('BRAZO') === 'Mandril_Abierto';
  // Intentos 1 y 2: iniciar el fresado con el mandril abierto (CNC Cargada).
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  assert.deepEqual(celda.deshabilitadosPorSupervisor('CNC1').map((d) => d.evento), ['iniciar_fresado']);
  for (let intento = 1; intento <= 2; intento++) {
    const antes = celda.puntaje;
    assert.deepEqual(celda.solicitar('CNC1', 'iniciar_fresado'), { ok: false, motivo: 'supervisor' });
    assert.equal(celda.puntaje - antes, -15);
    assert.equal(celda.estado('CNC1'), 'Cargado');
    assert.equal(prohibido(), false);
  }
  // Intento 3: abrir el mandril con la CNC fresando.
  celda.solicitar('BRAZO', 'cerrar_mandril');
  celda.solicitar('CNC1', 'iniciar_fresado');
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  const antes = celda.puntaje;
  assert.deepEqual(celda.solicitar('BRAZO', 'abrir_mandril'), { ok: false, motivo: 'supervisor' });
  assert.equal(celda.puntaje - antes, -15);
  assert.equal(celda.estado('BRAZO'), 'Mandril_Cerrado');
  assert.equal(prohibido(), false);
  assert.equal(celda.estadisticas.bloqueos, 3);
  assert.equal(celda.supervisores.CNC1.bloqueos, 3);
  assert.equal(celda.supervisores.CNC2.bloqueos, 0);
  assert.equal(celda.puntaje, -45);
  assert.equal(celda.bitacora.filter((e) => e.tipo === 'rechazo' && e.motivo === 'supervisor').length, 3);
});

test('un evento no definido o sin recurso NO es un intento bloqueado (no resta puntos)', () => {
  const { celda } = nueva();
  celda.solicitar('AGV2', 'reservar'); // el robot queda tomado: tr_ir sin ficha
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' }); // 'recurso'
  celda.solicitar('CNC1', 'cargar'); // 'indefinido'
  assert.equal(celda.estadisticas.bloqueos, 0);
  assert.equal(celda.puntaje, 0);
});

test('10 000 eventos aleatorios pedidos a la Celda nunca llegan al estado prohibido (en ninguna CNC atendida)', () => {
  const azar = crearAleatorio(SEMILLA);
  const { reloj, celda } = nueva({ ...TURNOS[2], probFalla: 0.3 });
  const elegir = (lista) => lista[Math.floor(azar.siguiente() * lista.length)];
  let rechazos = 0;
  let ejecutados = 0;
  celda.alCambiar(() => {
    if (celda.atendida) {
      const [q, b] = celda.estadoCompuesto(celda.atendida);
      assert.equal(q === 'Fresando' && b === 'Mandril_Abierto', false, `estado prohibido en t = ${reloj.ahora}`);
    }
  });
  const acciones = [
    ...['CNC1', 'CNC2'].flatMap((c) => ['cargar', 'descargar', 'iniciar_fresado'].map((e) => [c, e])),
    ['BRAZO', 'abrir_mandril'], ['BRAZO', 'cerrar_mandril'], ['BRAZO', 'volver'],
    ['BRAZO', 'mover', { objetivo: 'CNC1' }], ['BRAZO', 'mover', { objetivo: 'CNC2' }],
  ];
  for (let i = 0; i < 10000; i++) {
    const [m, e, o] = elegir(acciones);
    const r = celda.solicitar(m, e, o);
    if (r.ok) ejecutados++;
    else if (r.motivo === 'supervisor') rechazos++;
    if (celda.deadlock) break;
    reloj.avanzar(azar.entre(0, 1.5));
    if (['Falla'].includes(celda.estado('CNC1'))) celda.solicitar('CNC1', 'reset', { palabra: 'HCR' });
    if (['Falla'].includes(celda.estado('CNC2'))) celda.solicitar('CNC2', 'reset', { palabra: 'HCR' });
  }
  assert.ok(ejecutados > 500, `ejecutados ${ejecutados}`);
  assert.ok(rechazos > 20, `la prueba debe poner a prueba al supervisor (rechazos ${rechazos})`);
  assert.equal(celda.estadisticas.bloqueos, rechazos);
  assert.equal(celda.supervisores.CNC1.bloqueos + celda.supervisores.CNC2.bloqueos, rechazos);
});
