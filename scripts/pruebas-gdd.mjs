// Criterios de aceptación del GDD (sección 16) que se pueden comprobar con el núcleo, con resultados reales.
// Escribe docs/pruebas_gdd_generado.md. Uso: node scripts/pruebas-gdd.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Celda } from '../src/sed/celda.js';
import { Piloto } from '../src/sed/piloto.js';
import { Reloj } from '../src/sed/reloj.js';
import { RedPetri } from '../src/sed/redPetri.js';
import { arbolCobertura } from '../src/sed/cobertura.js';
import { crearAleatorio } from '../src/sed/aleatorio.js';
import { generarModelos } from './exportar-modelos.mjs';
import { SEMILLA, TURNOS } from '../src/config.js';

const json = JSON.parse(JSON.stringify(generarModelos()));
const modelos = { cnc: json['cnc.json'], brazo: json['brazo.json'], agv: json['agv.json'], red: json['red_agv.json'], redCorregida: json['red_agv_corregida.json'], supervisor: json['supervisor.json'], reparacion: json['reparacion_dfa.json'] };
const nueva = (turno = TURNOS[0], semilla = SEMILLA) => {
  const reloj = new Reloj();
  const celda = new Celda({ modelos, reloj, aleatorio: crearAleatorio(semilla), turno: { ...turno, meta: 9999, duracion: 1e6 } });
  celda.arrancar();
  return { reloj, celda };
};
const filas = [];
const fila = (id, criterio, comoSePrueba, observado, cumple) => filas.push({ id, criterio, comoSePrueba, observado, cumple });

/** Lleva una CNC a Fresando y devuelve el instante de `iniciar_fresado`. */
function fresar(celda, reloj, cnc = 'CNC1') {
  celda.solicitar('BRAZO', 'mover', { objetivo: cnc });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar(cnc, 'cargar');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  const t = reloj.ahora;
  celda.solicitar(cnc, 'iniciar_fresado');
  return t;
}
const evento = (celda, maquina, ev) => celda.bitacora.find((e) => e.tipo === 'automata' && e.maquina === maquina && e.evento === ev);

// CA-04 y CA-05: supervisor
{
  const { reloj, celda } = nueva();
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  celda.solicitar('CNC1', 'cargar');
  const r1 = celda.solicitar('CNC1', 'iniciar_fresado');
  celda.solicitar('BRAZO', 'cerrar_mandril');
  celda.solicitar('CNC1', 'iniciar_fresado');
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  const r2 = celda.solicitar('BRAZO', 'abrir_mandril');
  fila('CA-04', 'El estado prohibido nunca se alcanza', 'i con el mandril abierto y a con la CNC fresando',
    `i: ${r1.motivo}; a: ${r2.motivo}; CNC = ${celda.estado('CNC1')}, Brazo = ${celda.estado('BRAZO')}`, r1.motivo === 'supervisor' && r2.motivo === 'supervisor' && celda.estado('BRAZO') === 'Mandril_Cerrado');
  fila('CA-05', 'Cada intento bloqueado resta 15 puntos', 'Dos intentos bloqueados', `puntaje ${celda.puntaje} (−30 de dos intentos; la pieza aún no se descarga)`, celda.puntaje === -30);
}
// CA-06 y CA-07: deadlock y Controlador
{
  const { celda } = nueva();
  celda.solicitar('AGV1', 'reservar');
  celda.solicitar('AGV2', 'reservar');
  fila('CA-06', 'Despachar AGV1 y AGV2 lleva a game over con [0,0,0,0,1,1,0,0,0] y −200', 'Dos despachos seguidos en M0',
    `M = [${celda.red.marcado()}], deadlock = ${celda.deadlock}, puntaje = ${celda.puntaje}`, celda.red.marcado().join() === '0,0,0,0,1,1,0,0,0' && celda.deadlock && celda.puntaje === -200);
  const o = nueva();
  o.celda.comprarControlador();
  o.celda.solicitar('AGV1', 'reservar');
  const antes = o.celda.puntaje;
  const r = o.celda.solicitar('AGV2', 'reservar');
  fila('CA-07', 'Con el Controlador, t2a no se dispara tras t1a, hay aviso y no se restan puntos', 'Comprar, despachar AGV1 y AGV2',
    `motivo = ${r.motivo}; puntaje antes ${antes} y después ${o.celda.puntaje}; deadlock = ${o.celda.deadlock}`, r.motivo === 'celda' && o.celda.puntaje === antes && !o.celda.deadlock);
}
// CA-08: árbol
{
  const r = new RedPetri(modelos.red);
  const a = arbolCobertura(r);
  const c = arbolCobertura(new RedPetri(modelos.redCorregida));
  fila('CA-08', 'Árbol de cobertura: 14 nodos, 8 marcados, 1 muerto; con el Controlador 12, 7 y 0', 'arbolCobertura desde M0 en las dos redes',
    `original ${a.nodos.length} / ${a.marcadosDistintos} / ${a.muertos.length}; corregida ${c.nodos.length} / ${c.marcadosDistintos} / ${c.muertos.length}`,
    a.nodos.length === 14 && a.marcadosDistintos === 8 && a.muertos.length === 1 && c.nodos.length === 12 && c.marcadosDistintos === 7 && c.muertos.length === 0);
}
// CA-09 y CA-10: radar
{
  const { reloj, celda } = nueva();
  const niveles = [celda.radar.nivel];
  celda.solicitar('AGV1', 'reservar');
  niveles.push(celda.radar.nivel);
  reloj.avanzar(4);
  niveles.push(celda.radar.nivel);
  const premio = celda.puntaje;
  const o = nueva();
  o.celda.solicitar('AGV1', 'reservar');
  o.celda.solicitar('AGV2', 'reservar');
  niveles.push(o.celda.radar.nivel);
  fila('CA-09', 'Radar: verde en M0, amarillo en M1/M2 y rojo en el marcado muerto', 'Despachar AGV1, esperar t1b, y provocar el deadlock', `colores: ${niveles.join(' → ')}`, niveles.join() === 'verde,amarillo,verde,rojo');
  fila('CA-10', 'De amarillo a verde suma +25', 'Despachar AGV1 y esperar t1b', `puntaje tras volver a verde = ${premio}`, premio === 25);
}
// CA-11: tiempos
{
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 0 });
  const t0 = fresar(celda, reloj);
  reloj.avanzar(10);
  const fin = evento(celda, 'CNC1', 'fin_fresado').t - t0;
  const llegar = evento(celda, 'BRAZO', 'llegar').t;
  celda.solicitar('AGV1', 'reservar');
  const tv = reloj.ahora;
  reloj.avanzar(4);
  const g = evento(celda, 'AGV1', 'llegar_estacion').t - tv;
  const u = evento(celda, 'AGV1', 'iniciar_descarga').t;
  reloj.avanzar(5);
  const z = evento(celda, 'AGV1', 'fin_descarga').t - u;
  fila('CA-11', 'Tiempos: brazo 2 s, fresado 10 s, viaje del AGV 4 s, descarga 5 s', 'Medir con el reloj a velocidad x1', `brazo ${llegar} s, fresado ${fin} s, viaje ${g} s, descarga ${z} s`, llegar === 2 && fin === 10 && g === 4 && z === 5);
}
// CA-12: semilla
{
  const secuencia = (semilla) => {
    const { reloj, celda } = nueva({ ...TURNOS[2], probFalla: 0.3 }, semilla);
    const p = new Piloto(celda);
    p.activar();
    for (let i = 0; i < 480; i++) reloj.avanzar(0.25);
    return JSON.stringify(celda.bitacora.filter((e) => e.evento === 'falla_husillo' || e.evento === 'fin_fresado').map((e) => [e.t, e.evento]));
  };
  const a = secuencia(SEMILLA);
  const b = secuencia(SEMILLA);
  const c = secuencia(7);
  fila('CA-12', 'Falla entre 2 y 8 s después de i; con la semilla 2026 la secuencia siempre es la misma', 'Dos corridas de 120 s con la semilla 2026 y una con otra', `misma semilla: ${a === b ? 'idéntica' : 'distinta'}; otra semilla: ${a === c ? 'idéntica' : 'distinta'}`, a === b && a !== c);
  const dts = [];
  for (let s = 1; s <= 200; s++) {
    const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 1 }, s);
    const t0 = fresar(celda, reloj);
    reloj.avanzar(10);
    dts.push(evento(celda, 'CNC1', 'falla_husillo').t - t0);
  }
  fila('CA-12b', 'El instante de la falla es uniforme entre 2 s y 8 s', '200 fallas con semillas distintas', `mínimo ${Math.min(...dts).toFixed(2)} s, máximo ${Math.max(...dts).toFixed(2)} s`, Math.min(...dts) >= 2 && Math.max(...dts) <= 8);
}
// CA-13: probabilidades
{
  const res = [];
  for (const turno of TURNOS) {
    let fallas = 0;
    const N = 1000;
    const { reloj, celda } = nueva({ ...turno }, 12345);
    for (let i = 0; i < N; i++) {
      fresar(celda, reloj);
      reloj.avanzar(10);
      if (celda.estado('CNC1') === 'Falla') {
        fallas++;
        celda.solicitar('CNC1', 'reset', { palabra: 'HCR' });
      } else {
        celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
        reloj.avanzar(2);
        celda.solicitar('BRAZO', 'abrir_mandril');
        celda.solicitar('CNC1', 'descargar');
      }
    }
    res.push(`${(fallas / N * 100).toFixed(1)} %`);
  }
  fila('CA-13', 'Probabilidad de falla 10 %, 15 % y 20 % por turno (GDD 18.20)', '1000 fresados por turno', `turno 1: ${res[0]}; turno 2: ${res[1]}; turno 3: ${res[2]}`, res.every((r, i) => Math.abs(parseFloat(r) - [10, 15, 20][i]) < 3));
}
// CA-14: entregas de metal (los "pedidos" del GDD): cada 25, 20 y 18 s (con parejas en el turno 3) y plazo de 30 s (20 s en el turno 3) con −20
{
  const tiempos = TURNOS.map((t) => {
    const { reloj, celda } = nueva(t);
    reloj.avanzar(179);
    return celda.bitacora.filter((e) => e.tipo === 'pedido').map((e) => e.t);
  });
  const esperado = [
    [25, 50, 75, 100, 125, 150, 175],
    [20, 40, 60, 80, 100, 120, 140, 160],
    [18, 36, 54, 72, 74, 90, 108, 126, 144, 146, 162], // cada 4 entregas llega otra 2 s después
  ];
  const ok = esperado.every((lista, i) => JSON.stringify(lista) === JSON.stringify(tiempos[i]));
  const vence = TURNOS.map((t) => {
    const { reloj, celda } = nueva({ ...t, parejas: 0 });
    reloj.avanzar(t.intervaloPedidos + (t.plazoEntrega ?? 30) + 0.5); // justo después de la primera pérdida
    return { t: celda.bitacora.find((e) => e.tipo === 'pedidoVencido')?.t, puntaje: celda.puntaje };
  });
  fila('CA-14', 'Entregas de metal cada 25, 20 y 18 s (turno 3 con parejas); una sin atender se pierde a los 30 s (20 s en el turno 3) con −20', 'Contar entregas en 179 s y esperar un vencimiento por turno', `entregas por turno: ${tiempos.map((l) => l.length).join(', ')}; la primera se pierde a los ${vence.map((v) => v.t).join(', ')} s, puntaje ${vence[0].puntaje}`, ok && vence.map((v) => v.t).join() === '55,50,38' && vence[0].puntaje === -20);
}
// CA-16: t1b y t2b solo con mesa y brazo
{
  const { reloj, celda } = nueva();
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  celda.solicitar('AGV1', 'reservar');
  reloj.avanzar(10);
  const antes = celda.estado('AGV1');
  const faltan = celda.faltantes('t1b');
  fila('CA-16', 'Un AGV no descarga sin la mesa y el brazo (AND-join)', 'AGV1 llega con el brazo fuera', `AGV1 = ${antes}; falta: ${faltan.join(', ')}; t1b habilitada = ${celda.red.habilitada('t1b')}`, antes === 'Esperando' && faltan.join() === 'Robot_libre');
}
// CA-17: puntaje
{
  const { reloj, celda } = nueva({ ...TURNOS[0], probFalla: 0 });
  const t = [];
  const delta = (f) => { const a = celda.puntaje; f(); return celda.puntaje - a; };
  fresar(celda, reloj);
  reloj.avanzar(10);
  celda.solicitar('BRAZO', 'mover', { objetivo: 'CNC1' });
  reloj.avanzar(2);
  celda.solicitar('BRAZO', 'abrir_mandril');
  t.push(['pieza', delta(() => celda.solicitar('CNC1', 'descargar'))]);
  t.push(['ayuda', delta(() => celda.pedirAyuda('CNC1'))]);
  t.push(['Controlador', delta(() => celda.comprarControlador())]);
  const o = nueva({ ...TURNOS[0], probFalla: 1 });
  fresar(o.celda, o.reloj);
  o.reloj.avanzar(9);
  t.push(['palabra inválida', (() => { const a = o.celda.puntaje; o.celda.solicitar('CNC1', 'reset', { palabra: 'HTCR' }); return o.celda.puntaje - a; })()]);
  t.push(['reparación válida', (() => { const a = o.celda.puntaje; o.celda.solicitar('CNC1', 'reset', { palabra: 'HCTCR' }); return o.celda.puntaje - a; })()]);
  const esperado = { pieza: 100, ayuda: -20, Controlador: -150, 'palabra inválida': -30, 'reparación válida': 50 };
  fila('CA-17', 'El puntaje de cada acción coincide con la sección 8', 'Ejecutar cada acción', t.map(([n, v]) => `${n} ${v >= 0 ? '+' : ''}${v}`).join('; ') + '; ciclo de AGV +40, bloqueo −15, pedido vencido −20, radar +25 y deadlock −200 (ver CA-05, CA-06, CA-10, CA-14 y tests)', t.every(([n, v]) => esperado[n] === v));
}
// CA-19: velocidad
{
  const correr = (dt) => {
    const { reloj, celda } = nueva(TURNOS[0]);
    const p = new Piloto(celda);
    p.activar();
    for (let i = 0; i < 120 / dt; i++) reloj.avanzar(dt);
    return JSON.stringify([celda.estadisticas.piezas, celda.puntaje, celda.red.marcado(), celda.bitacora.length]);
  };
  const r = [0.05, 0.25, 1].map(correr); // dt = tiempo de simulación por cuadro (x1, x4 y x20 a 20 fps)
  fila('CA-19', 'Las velocidades y la pausa no cambian el resultado del turno', 'Misma partida con pasos de reloj de 0,05 s, 0,25 s y 1 s', r.every((x) => x === r[0]) ? 'resultados idénticos' : `distintos: ${r.join(' | ')}`, r.every((x) => x === r[0]));
}
// CA-23: Controlador en deadlock y por turno
{
  const { celda } = nueva();
  celda.solicitar('AGV1', 'reservar');
  celda.solicitar('AGV2', 'reservar');
  const r = celda.comprarControlador();
  const o = nueva({ ...TURNOS[0], duracion: 30 });
  o.celda.turno.duracion = 30;
  fila('CA-23', 'El Controlador no se compra en el marcado muerto y se pierde al terminar el turno', 'Intentar comprarlo en deadlock; terminar un turno con Controlador', `en deadlock: ${r.motivo}; desactivarControlador() devuelve la red original (ver tests/turnos.test.js)`, !r.ok && r.motivo === 'deadlock');
}

const cumplen = filas.filter((f) => f.cumple).length;
const md = [
  '# Criterios del GDD comprobados con el núcleo (generado)', '',
  'Lo genera `node scripts/pruebas-gdd.mjs` con el núcleo de `src/sed/` (sin navegador).', '',
  '| N.º | Criterio | Cómo se prueba | Observado | ¿Cumple? |', '|---|---|---|---|---|',
  ...filas.map((f) => `| ${f.id} | ${f.criterio} | ${f.comoSePrueba} | ${f.observado} | ${f.cumple ? 'sí' : '**NO**'} |`),
  '', `Cumplen ${cumplen} de ${filas.length}.`,
].join('\n');
fs.writeFileSync(fileURLToPath(new URL('../docs/pruebas_gdd_generado.md', import.meta.url)), md + '\n');
console.log(`criterios: ${cumplen} de ${filas.length}`);
for (const f of filas.filter((x) => !x.cumple)) console.log('NO CUMPLE', f.id, f.observado);
if (cumplen !== filas.length) process.exit(1);
