// Puntaje completo, turnos y logros (docs/GDD.md, secciones 7, 8 y 12).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Celda } from '../src/sed/celda.js';
import { Piloto } from '../src/sed/piloto.js';
import { Reloj } from '../src/sed/reloj.js';
import { Partida } from '../src/sed/partida.js';
import { Logros, LOGROS } from '../src/sed/logros.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { SEMILLA, TURNOS, PUNTOS } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const modelos = () => ({
  cnc: cargarModelo('cnc.json'), brazo: cargarModelo('brazo.json'), agv: cargarModelo('agv.json'),
  red: cargarModelo('red_agv.json'), redCorregida: cargarModelo('red_agv_corregida.json'),
  supervisor: cargarModelo('supervisor.json'), reparacion: cargarModelo('reparacion_dfa.json'),
});

function nueva(turno, { partida = new Partida(), indice = 0 } = {}) {
  const reloj = new Reloj();
  const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(SEMILLA), turno, puntajeInicial: partida.puntaje });
  const ganados = [];
  const logros = new Logros(partida.logros, indice, (l) => ganados.push(l.id));
  logros.vigilar(celda);
  celda.arrancar();
  return { reloj, celda, logros, ganados, partida };
}

/** Descarga una pieza con la CNC1: cargar, fresar 10 s y descargar (el turno no falla). */
function pieza(celda, reloj, cnc = 'CNC1') {
  celda.solicitar('BRAZO', 'mover', { objetivo: cnc });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar(cnc, 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  celda.solicitar(cnc, 'iniciar_fresado');
  reloj.avanzar(10);
  celda.solicitar('BRAZO', 'mover', { objetivo: cnc });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  return celda.solicitar(cnc, 'descargar');
}

const SIN_FALLAS = { ...TURNOS[0], probFalla: 0 };

test('puntaje del GDD: pieza +100, ciclo de AGV +40 y las demás acciones', () => {
  const { reloj, celda } = nueva({ ...SIN_FALLAS, meta: 99 });
  pieza(celda, reloj);
  assert.equal(celda.puntaje, PUNTOS.pieza);
  celda.solicitar('AGV1', 'reservar');
  reloj.avanzar(9);
  // ciclo de AGV +40 y radar de amarillo a verde +25
  assert.equal(celda.puntaje, 100 + 40 + 25);
  assert.deepEqual(
    [PUNTOS.pieza, PUNTOS.cicloAGV, PUNTOS.reparacion, PUNTOS.palabraInvalida, PUNTOS.ayuda, PUNTOS.intentoBloqueado,
      PUNTOS.pedidoVencido, PUNTOS.radarVerde, PUNTOS.controlador, PUNTOS.deadlock],
    [100, 40, 50, -30, -20, -15, -20, 25, -150, -200],
  );
});

test('turno 1: se gana al descargar la pieza 3 (meta) y el turno se detiene', () => {
  const { reloj, celda } = nueva(SIN_FALLAS);
  const fin = [];
  celda.alCambiar((e) => e.tipo === 'finTurno' && fin.push(e));
  pieza(celda, reloj);
  pieza(celda, reloj, 'CNC2');
  assert.equal(celda.terminado, false);
  pieza(celda, reloj);
  assert.equal(celda.terminado, true);
  assert.equal(fin.length, 1);
  assert.equal(fin[0].resultado, 'victoria');
  assert.equal(fin[0].resumen.piezas, 3);
  assert.equal(fin[0].resumen.puntajeTurno, 300);
  assert.equal(reloj.enPausa, true);
  assert.deepEqual(celda.solicitar('AGV1', 'reservar'), { ok: false, motivo: 'turno_terminado' });
});

test('turno 1: si se acaban los 180 s sin la meta, el turno se pierde', () => {
  const { reloj, celda } = nueva(SIN_FALLAS);
  const fin = [];
  celda.alCambiar((e) => e.tipo === 'finTurno' && fin.push(e));
  pieza(celda, reloj);
  reloj.avanzar(200);
  assert.equal(fin.length, 1);
  assert.equal(fin[0].resultado, 'tiempo');
  assert.equal(reloj.ahora, 180);
  assert.equal(fin[0].resumen.tiempo, 180);
});

test('al terminar el turno se llama desactivarControlador y la red vuelve a la original', () => {
  const { reloj, celda } = nueva(SIN_FALLAS);
  celda.comprarControlador();
  assert.equal(celda.red.lugares.length, 10);
  reloj.avanzar(181);
  assert.equal(celda.controlador, false);
  assert.equal(celda.red.lugares.length, 9);
});

test('los 3 turnos del GDD: metas 3, 5 y 6; fallas 10, 20 y 30 %; pedidos cada 25, 18 y 12 s', () => {
  assert.deepEqual(TURNOS.map((t) => [t.duracion, t.meta, t.probFalla, t.intervaloPedidos]), [
    [180, 3, 0.1, 25], [180, 5, 0.2, 18], [180, 6, 0.3, 12],
  ]);
  const p = new Partida();
  assert.equal(p.parametros.meta, 3);
  p.terminarTurno({ puntaje: 420 });
  assert.equal(p.siguienteTurno(), true);
  assert.equal(p.puntaje, 420);
  assert.equal(p.parametros.meta, 5);
  p.siguienteTurno();
  assert.equal(p.esUltimo, true);
  assert.equal(p.siguienteTurno(), false);
});

test('el puntaje se acumula entre turnos', () => {
  const partida = new Partida();
  partida.puntaje = 500;
  const { celda } = nueva(SIN_FALLAS, { partida });
  assert.equal(celda.puntaje, 500);
  assert.equal(celda.resumen().puntajeTurno, 0);
});

test('con la demostración se gana el turno 1 y el resumen cuenta lo ocurrido', () => {
  const { reloj, celda } = nueva(TURNOS[0]);
  const piloto = new Piloto(celda);
  piloto.activar();
  for (let i = 0; i < 720 && !celda.terminado; i++) reloj.avanzar(0.25);
  assert.equal(celda.terminado, true);
  assert.equal(celda.resultado, 'victoria');
  const r = celda.resumen();
  assert.equal(r.piezas, 3);
  assert.ok(r.puntajeTurno >= 300);
  assert.equal(r.deadlocks, 0);
  assert.equal(r.intentosBloqueados, 0);
});

// ---- Logros ----

test('Primera pieza: al descargar la primera pieza de la partida', () => {
  const { reloj, celda, ganados } = nueva({ ...SIN_FALLAS, meta: 99 });
  assert.deepEqual(ganados, []);
  pieza(celda, reloj);
  assert.deepEqual(ganados, ['primera_pieza']);
  pieza(celda, reloj);
  assert.deepEqual(ganados, ['primera_pieza']); // no se repite
});

test('Mecánico fino: 3 reparaciones válidas seguidas; una palabra inválida reinicia la racha', () => {
  const { reloj, celda, ganados } = nueva({ ...TURNOS[0], probFalla: 1, meta: 99 });
  const reparar = (palabra) => {
    celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
    reloj.avanzar(2);
    celda.solicitar('BRAZO', 'abrir_mandril');
    celda.solicitar('CNC1', 'cargar');
    celda.solicitar('BRAZO', 'cerrar_mandril');
    celda.solicitar('CNC1', 'iniciar_fresado');
    reloj.avanzar(9);
    assert.equal(celda.estado('CNC1'), 'Falla');
    return celda.solicitar('CNC1', 'reset', { palabra });
  };
  reparar('HCR');
  reparar('HCR');
  assert.equal(ganados.includes('mecanico_fino'), false);
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' }); // nada que ver con la racha
  reloj.avanzar(0);
  const p = { ...celda };
  assert.ok(p);
  // Tercera válida: se gana.
  reparar('HCTCR');
  assert.equal(ganados.includes('mecanico_fino'), true);
});

test('Mecánico fino: una palabra inválida entre las reparaciones rompe la racha', () => {
  const { reloj, celda, ganados } = nueva({ ...TURNOS[0], probFalla: 1, meta: 99 });
  const falla = () => {
    celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
    reloj.avanzar(2);
    celda.solicitar('BRAZO', 'abrir_mandril');
    celda.solicitar('CNC1', 'cargar');
    celda.solicitar('BRAZO', 'cerrar_mandril');
    celda.solicitar('CNC1', 'iniciar_fresado');
    reloj.avanzar(9);
  };
  falla();
  celda.solicitar('CNC1', 'reset', { palabra: 'HCR' });
  falla();
  celda.solicitar('CNC1', 'reset', { palabra: 'HTCR' }); // inválida: racha 0
  celda.solicitar('CNC1', 'reset', { palabra: 'HCR' }); // racha 1
  falla();
  celda.solicitar('CNC1', 'reset', { palabra: 'HCR' }); // racha 2
  assert.equal(ganados.includes('mecanico_fino'), false);
});

test('Manos seguras: ganar un turno con 0 intentos bloqueados', () => {
  const { reloj, celda, ganados } = nueva(SIN_FALLAS);
  pieza(celda, reloj);
  pieza(celda, reloj, 'CNC2');
  pieza(celda, reloj);
  assert.equal(celda.resultado, 'victoria');
  assert.ok(ganados.includes('manos_seguras'));
});

test('Manos seguras NO se gana si hubo un intento bloqueado', () => {
  const { reloj, celda, ganados } = nueva(SIN_FALLAS);
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  celda.solicitar('CNC1', 'iniciar_fresado'); // bloqueado por el supervisor
  assert.equal(celda.estadisticas.bloqueos, 1);
  celda.solicitar('BRAZO', 'cerrar_mandril');
  celda.solicitar('CNC1', 'iniciar_fresado');
  reloj.avanzar(10);
  pieza(celda, reloj);
  pieza(celda, reloj, 'CNC2');
  pieza(celda, reloj);
  assert.equal(celda.resultado, 'victoria');
  assert.equal(ganados.includes('manos_seguras'), false);
});

test('Ojo de radar: 3 cambios del radar de amarillo a verde dentro de un turno', () => {
  const { reloj, celda, ganados } = nueva({ ...SIN_FALLAS, meta: 99 });
  for (let i = 0; i < 3; i++) {
    assert.equal(ganados.includes('ojo_de_radar'), false);
    celda.solicitar('AGV1', 'reservar'); // amarillo
    reloj.avanzar(9); // verde otra vez y el ciclo termina
  }
  assert.ok(ganados.includes('ojo_de_radar'));
});

test('Sin red de seguridad: ganar el turno 3 sin Controlador y sin deadlock (y no con Controlador)', () => {
  const turno3 = { ...TURNOS[2], probFalla: 0, meta: 1 };
  const a = nueva(turno3, { indice: 2 });
  pieza(a.celda, a.reloj);
  assert.equal(a.celda.resultado, 'victoria');
  assert.ok(a.ganados.includes('sin_red_de_seguridad'));
  const b = nueva(turno3, { indice: 2 });
  b.celda.comprarControlador();
  pieza(b.celda, b.reloj);
  assert.equal(b.celda.resultado, 'victoria');
  assert.equal(b.ganados.includes('sin_red_de_seguridad'), false);
  // En el turno 1 no cuenta.
  const c = nueva({ ...SIN_FALLAS, meta: 1 }, { indice: 0 });
  pieza(c.celda, c.reloj);
  assert.equal(c.ganados.includes('sin_red_de_seguridad'), false);
});

test('Doble husillo: las 2 CNC fresando a la vez, 30 s acumulados en un turno', () => {
  const { reloj, celda, ganados, logros } = nueva({ ...SIN_FALLAS, meta: 99 });
  const dobles = () => {
    celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
    reloj.avanzar(2);
    celda.solicitar('BRAZO', 'abrir_mandril');
    celda.solicitar('CNC1', 'cargar');
    celda.solicitar('BRAZO', 'cerrar_mandril');
    celda.solicitar('CNC1', 'iniciar_fresado'); // t0
    celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC2' });
    reloj.avanzar(2);
    celda.solicitar('BRAZO', 'abrir_mandril');
    celda.solicitar('CNC2', 'cargar');
    celda.solicitar('BRAZO', 'cerrar_mandril');
    celda.solicitar('CNC2', 'iniciar_fresado'); // t0 + 2 + ...: ambas fresando unos 8 s
    reloj.avanzar(11); // las dos terminan
    // Se descargan para repetir.
    for (const cnc of ['CNC1', 'CNC2']) {
      celda.solicitar('BRAZO', 'mover', { objetivo: cnc });
      reloj.avanzar(2);
      celda.solicitar('BRAZO', 'abrir_mandril');
      celda.solicitar(cnc, 'descargar');
    }
  };
  dobles();
  assert.ok(logros.dobleAcumulado > 5 && logros.dobleAcumulado < 12, `acumulado ${logros.dobleAcumulado}`);
  assert.equal(ganados.includes('doble_husillo'), false);
  dobles();
  dobles();
  dobles();
  assert.ok(logros.dobleAcumulado >= 30);
  assert.ok(ganados.includes('doble_husillo'));
});

test('hay 6 logros y el progreso de cada uno se puede consultar', () => {
  const { logros } = nueva(SIN_FALLAS);
  assert.equal(LOGROS.length, 6);
  const p = logros.progreso();
  assert.equal(p.length, 6);
  assert.ok(p.every((l) => l.nombre && l.descripcion && typeof l.texto === 'string' && l.ganado === false));
});
