// Balance de los 3 turnos (GDD, secciones 7, 15 y 18.20): simula cada turno con jugadores que operan PASO A PASO (el piloto
// automático: un evento por decisión, sin errores) a tres ritmos y con varias semillas.
//   experto: 1 decisión cada 0,8 s   ·   bueno: cada 1,2 s   ·   lento: cada 2 s
// Para cada casilla dice cuántas partidas gana y cuántas piezas haría en los 180 s si el turno no terminara al llegar a la meta
// (el "margen" sobre la meta). No cambia ningún valor: solo mide. Uso: node scripts/balance.mjs [semillas=20]
import fs from 'node:fs';
import { Celda } from '../src/sed/celda.js';
import { Piloto } from '../src/sed/piloto.js';
import { Reloj } from '../src/sed/reloj.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { TURNOS } from '../src/config.js';

const cargar = (a) => JSON.parse(fs.readFileSync(new URL(`../src/sed/modelos/${a}`, import.meta.url), 'utf8'));
const modelos = () => ({
  cnc: cargar('cnc.json'), brazo: cargar('brazo.json'), agv: cargar('agv.json'), red: cargar('red_agv.json'),
  redCorregida: cargar('red_agv_corregida.json'), supervisor: cargar('supervisor.json'), reparacion: cargar('reparacion_dfa.json'),
});

export const JUGADORES = [['experto', 0.8], ['bueno', 1.2], ['lento', 2]];

function turno(parametros, semilla, periodo) {
  const reloj = new Reloj();
  const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(semilla), turno: parametros });
  celda.arrancar();
  const piloto = new Piloto(celda, { periodo });
  piloto.activar();
  let guardia = 0;
  while (!celda.terminado && !celda.deadlock && guardia++ < 4000) reloj.avanzar(0.25);
  const r = celda.resumen();
  return { victoria: r.resultado === 'victoria', piezas: r.piezas, tiempo: r.tiempo, puntaje: r.puntajeTurno, perdidas: r.pedidosVencidos, bloqueos: r.intentosBloqueados, deadlock: celda.deadlock };
}

const SEMILLAS = Number(process.argv[2] ?? 20);
const salida = [];
console.log('turno | jugador | victorias | piezas en 180 s sin tope (mín–mediana–máx) | margen (mediana − meta) | tiempo medio al ganar (s) | puntaje medio | entregas perdidas (media)');
TURNOS.forEach((parametros, i) => {
  for (const [jugador, periodo] of JUGADORES) {
    const res = Array.from({ length: SEMILLAS }, (_, k) => turno(parametros, 2026 + k, periodo));
    const libre = Array.from({ length: SEMILLAS }, (_, k) => turno({ ...parametros, meta: 999 }, 2026 + k, periodo).piezas).sort((a, b) => a - b);
    const media = (xs, f) => (xs.length ? xs.reduce((a, r) => a + f(r), 0) / xs.length : 0);
    const ganadas = res.filter((r) => r.victoria);
    const fila = {
      turno: i + 1, jugador, periodo, meta: parametros.meta, victorias: ganadas.length, de: SEMILLAS,
      piezasMin: libre[0], piezasMediana: libre[Math.floor(SEMILLAS / 2)], piezasMax: libre[SEMILLAS - 1],
      margen: libre[Math.floor(SEMILLAS / 2)] - parametros.meta,
      tiempoAlGanar: +media(ganadas, (r) => r.tiempo).toFixed(1), puntaje: Math.round(media(res, (r) => r.puntaje)),
      entregasPerdidas: +media(res, (r) => r.perdidas).toFixed(2), bloqueos: res.reduce((a, r) => a + r.bloqueos, 0), deadlocks: res.filter((r) => r.deadlock).length,
    };
    salida.push(fila);
    console.log(`${fila.turno} | ${jugador} (${periodo} s) | ${fila.victorias}/${SEMILLAS} | ${fila.piezasMin}–${fila.piezasMediana}–${fila.piezasMax} (meta ${fila.meta}) | ${fila.margen >= 0 ? '+' : ''}${fila.margen} | ${fila.tiempoAlGanar || '—'} | ${fila.puntaje} | ${fila.entregasPerdidas}`);
  }
});
fs.mkdirSync('docs/datos', { recursive: true });
fs.writeFileSync('docs/datos/balance.json', JSON.stringify(salida, null, 1));
