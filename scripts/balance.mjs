// Balance de los 3 turnos (GDD, sección 15): simula el turno con el piloto automático a distintos ritmos de decisión
// (un clic cada p segundos de simulación) y varias semillas. NO cambia ningún valor del GDD: solo mide.
// Uso: node scripts/balance.mjs [semillas=40]
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

function turno(indice, semilla, periodo) {
  const reloj = new Reloj();
  const celda = new Celda({ modelos: modelos(), reloj, aleatorio: crearAleatorio(semilla), turno: TURNOS[indice] });
  celda.arrancar();
  const piloto = new Piloto(celda, { periodo });
  piloto.activar();
  let guardia = 0;
  while (!celda.terminado && !celda.deadlock && guardia++ < 4000) reloj.avanzar(0.25);
  const r = celda.resumen();
  return { victoria: r.resultado === 'victoria', piezas: r.piezas, meta: r.meta, tiempo: r.tiempo, puntaje: r.puntajeTurno, fallas: r.fallas, vencidos: r.pedidosVencidos, deadlock: celda.deadlock };
}

const SEMILLAS = Number(process.argv[2] ?? 40);
const PERIODOS = [1, 2, 3, 4, 6];
const salida = [];
console.log('turno | periodo | victorias | piezas medias | tiempo medio (s) | puntaje medio | pedidos vencidos (medio)');
for (let i = 0; i < TURNOS.length; i++) {
  for (const p of PERIODOS) {
    const res = Array.from({ length: SEMILLAS }, (_, k) => turno(i, 2026 + k, p));
    const media = (f) => res.reduce((a, r) => a + f(r), 0) / res.length;
    const fila = {
      turno: i + 1, periodo: p, victorias: res.filter((r) => r.victoria).length, de: SEMILLAS,
      piezas: +media((r) => r.piezas).toFixed(2), meta: TURNOS[i].meta, tiempo: +media((r) => r.tiempo).toFixed(1),
      puntaje: Math.round(media((r) => r.puntaje)), vencidos: +media((r) => r.vencidos).toFixed(2), deadlocks: res.filter((r) => r.deadlock).length,
    };
    salida.push(fila);
    console.log(`${fila.turno} | ${p} s | ${fila.victorias}/${SEMILLAS} | ${fila.piezas}/${fila.meta} | ${fila.tiempo} | ${fila.puntaje} | ${fila.vencidos}`);
  }
}
fs.mkdirSync('docs/datos', { recursive: true });
fs.writeFileSync('docs/datos/balance.json', JSON.stringify(salida, null, 1));
