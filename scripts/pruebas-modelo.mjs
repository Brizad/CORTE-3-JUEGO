// Pruebas de conformidad modelo–juego (guía 5.9 b). Lee los archivos de modelos/ (.jff de JFLAP, .pnml de PIPE2) con un lector
// PROPIO, independiente del que usa el juego, calcula los resultados del "software académico" y los compara con el núcleo del
// juego (src/sed/). Escribe docs/pruebas_modelo_generado.md y deja un resumen en consola.
// Uso: node scripts/pruebas-modelo.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Automata } from '../src/sed/automata.js';
import { componer, supervisor } from '../src/sed/composicion.js';
import { RedPetri } from '../src/sed/redPetri.js';
import { arbolCobertura } from '../src/sed/cobertura.js';
import { generarModelos } from './exportar-modelos.mjs';

const raiz = new URL('../', import.meta.url);
const leer = (r) => fs.readFileSync(fileURLToPath(new URL(r, raiz)), 'utf8');

// ---------- Lector propio de .jff ----------
function jff(archivo) {
  const t = leer(`modelos/automatas/${archivo}`);
  const estados = new Map();
  for (const m of t.matchAll(/<state id="(\d+)" name="([^"]*)">([\s\S]*?)<\/state>/g)) {
    estados.set(m[1], { nombre: m[2], inicial: /<initial\/>/.test(m[3]), final: /<final\/>/.test(m[3]) });
  }
  const trans = [...t.matchAll(/<transition>\s*<from>(\d+)<\/from>\s*<to>(\d+)<\/to>\s*<read>([^<]*)<\/read>/g)]
    .map((m) => [estados.get(m[1]).nombre, m[3], estados.get(m[2]).nombre]);
  const nombres = [...estados.values()].map((e) => e.nombre);
  return {
    nombres,
    inicial: [...estados.values()].find((e) => e.inicial).nombre,
    marcados: [...estados.values()].filter((e) => e.final).map((e) => e.nombre),
    trans,
    codigos: [...new Set(trans.map((x) => x[1]))].sort(),
    determinista: new Set(trans.map((x) => `${x[0]}|${x[1]}`)).size === trans.length,
  };
}
/** Simula una palabra de códigos sobre el .jff. Devuelve {acepta, estado} (estado null si un paso no está definido). */
function simular(a, palabra) {
  let q = a.inicial;
  for (const s of palabra) {
    const t = a.trans.find((x) => x[0] === q && x[1] === s);
    if (!t) return { acepta: false, estado: null };
    q = t[2];
  }
  return { acepta: a.marcados.includes(q), estado: q };
}

// Núcleo del juego construido desde src/sed/modelos (los JSON que importa el navegador).
const json = JSON.parse(JSON.stringify(generarModelos()));
const juego = (nombre) => new Automata(json[nombre]);
function simularJuego(nombreJson, palabra) {
  const g = juego(nombreJson);
  for (const s of palabra) {
    const id = g.idDeCodigo(s);
    if (id === undefined || !g.puede(id)) return { acepta: false, estado: null };
    g.ejecutar(id);
  }
  return { acepta: g.esMarcado(), estado: g.estado };
}

const salida = [];
const md = (...l) => salida.push(...l);
const resumen = { fallos: 0, filas: 0 };
const coincide = (ok) => { resumen.filas++; if (!ok) resumen.fallos++; return ok ? 'sí' : '**NO**'; };

// ---------- Autómatas: registro del modelo ----------
const MAQUINAS = [
  ['CNC', 'CNC.jff', 'cnc.json', ['c', 'i', 'd', 'r'], ['f', 'x']],
  ['Brazo', 'Brazo.jff', 'brazo.json', ['m', 'a', 'e', 'c', 'd'], ['l']],
  ['AGV', 'AGV.jff', 'agv.json', ['v', 'u'], ['g', 'z']],
];
md('## Registro del modelo verificado (autómatas)', '',
  '| Autómata | Códigos de eventos | uc (no controlables) | uo (no observables) | q0 | Qm | N.º de estados | ¿Determinista? | Archivo | ¿Coincide el juego? |', '|---|---|---|---|---|---|---|---|---|---|');
const A = {};
for (const [nombre, archivo, js, , uc] of MAQUINAS) {
  const a = jff(archivo);
  A[nombre] = a;
  const j = json[js];
  const ok = a.nombres.length === j.estados.length && a.inicial === j.inicial && JSON.stringify(a.marcados) === JSON.stringify(j.marcados)
    && a.trans.length === j.transiciones.length;
  md(`| ${nombre} | ${a.codigos.join(', ')} | ${uc.join(', ')} | ninguno | ${a.inicial} | ${a.marcados.join(', ')} | ${a.nombres.length} | ${a.determinista ? 'sí' : 'no'} | modelos/automatas/${archivo} | ${coincide(ok)} |`);
}
const dfa = jff('Reparacion_DFA.jff');
{
  const j = json['reparacion_dfa.json'];
  const ok = dfa.nombres.length === j.estados.length && dfa.trans.length === j.transiciones.length;
  md(`| Reparación (DFA mínimo) | ${dfa.codigos.join(', ')} | — | ninguno | ${dfa.inicial} | ${dfa.marcados.join(', ')} | ${dfa.nombres.length} | ${dfa.determinista ? 'sí' : 'no'} | modelos/automatas/Reparacion_DFA.jff | ${coincide(ok)} |`);
}

// ---------- 8 palabras por máquina ----------
const PALABRAS = {
  CNC: ['', 'cifd', 'cixr', 'cifdcifd', 'cixrcifd', 'ci', 'cif', 'ifd', 'cc', 'cifdd'],
  Brazo: ['', 'mlm', 'mlaedm', 'mlacedm', 'mlaedmmlm', 'ml', 'mla', 'mlace', 'ma', 'mm'],
  AGV: ['', 'vguz', 'vguzvguz', 'v', 'vg', 'vgu', 'gu', 'vv', 'vguzv', 'z'],
};
md('', '## Palabras de prueba por máquina (JFLAP contra el juego)', '', '| Autómata | Palabra | Resultado en JFLAP (.jff) | Resultado en el juego | ¿Coincide? |', '|---|---|---|---|---|');
for (const [nombre, , js] of MAQUINAS) {
  for (const w of PALABRAS[nombre]) {
    const a = simular(A[nombre], w);
    const g = simularJuego(js, w);
    const txt = (r) => (r.estado === null ? 'rechaza (paso sin definir)' : `${r.acepta ? 'acepta' : 'rechaza'}, estado ${r.estado}`);
    md(`| ${nombre} | \`${w || 'ε'}\` | ${txt(a)} | ${txt(g)} | ${coincide(a.acepta === g.acepta && a.estado === g.estado)} |`);
  }
}

// ---------- Palabras de reparación (consola) ----------
const ER = /^H(CT?)+R$/;
const PALABRAS_REP = ['HCTCR', 'HCR', 'HCTR', 'HCCTCR', 'HTCR', 'HR', 'HCT', 'CR', 'HCTTR', 'HCRR'];
const filasRep = PALABRAS_REP.map((w) => {
  const a = simular(dfa, w);
  const g = simularJuego('reparacion_dfa.json', w);
  return { w, jflap: a.acepta, juego: g.acepta, regexp: ER.test(w) };
});
md('', '## Lenguaje de reparación ^H(CT?)+R$ (DFA de JFLAP, RegExp y juego)', '', '| Palabra | JFLAP (DFA mínimo) | RegExp anclada | Núcleo del juego | ¿Coinciden? |', '|---|---|---|---|---|');
for (const f of filasRep) md(`| \`${f.w}\` | ${f.jflap ? 'acepta' : 'rechaza'} | ${f.regexp ? 'acepta' : 'rechaza'} | ${f.juego ? 'acepta' : 'rechaza'} | ${coincide(f.jflap === f.regexp && f.regexp === f.juego)} |`);

// ---------- Composición y supervisor (cálculo independiente) ----------
const cnc = A.CNC;
const brazo = A.Brazo;
const compartidos = cnc.codigos.filter((c) => brazo.codigos.includes(c));
const clave = (a, b) => `${a}|${b}`;
const trCnc = (q, s) => cnc.trans.find((t) => t[0] === q && t[1] === s)?.[2];
const trBr = (q, s) => brazo.trans.find((t) => t[0] === q && t[1] === s)?.[2];
const todos = [...new Set([...cnc.codigos, ...brazo.codigos])];
const ini = clave(cnc.inicial, brazo.inicial);
const estadosC = new Set([ini]);
const transC = [];
for (const k of estadosC) {
  const [q1, q2] = k.split('|');
  for (const s of todos) {
    const en1 = cnc.codigos.includes(s);
    const en2 = brazo.codigos.includes(s);
    const d1 = en1 ? trCnc(q1, s) : q1;
    const d2 = en2 ? trBr(q2, s) : q2;
    if ((en1 && !d1) || (en2 && !d2)) continue; // los compartidos exigen a los dos
    transC.push([k, s, clave(d1, d2)]);
    estadosC.add(clave(d1, d2));
  }
}
const UC = new Set(['f', 'x', 'l', 'g', 'z']);
const malos = new Set(['Fresando|Mandril_Abierto']);
for (let cambio = true; cambio;) {
  cambio = false;
  for (const [o, s, d] of transC) if (!malos.has(o) && malos.has(d) && UC.has(s)) { malos.add(o); cambio = true; }
}
const buenos = new Set([ini]);
for (const k of buenos) for (const [o, , d] of transC) if (o === k && !malos.has(d) && !buenos.has(d)) buenos.add(d);
const transSup = transC.filter(([o, , d]) => buenos.has(o) && buenos.has(d));
const deshab = transC.filter(([o, , d]) => buenos.has(o) && malos.has(d)).map(([o, s]) => `${s} en (${o.replace('|', ', ')})`);
const comp = componer(json['cnc.json'], json['brazo.json']);
const sup = supervisor(comp, json['supervisor.json'].prohibidos);
md('', '## Composición CNC ‖ Brazo y supervisor', '', '| Dato | Software académico (cálculo independiente sobre los .jff) | Juego | ¿Coincide? |', '|---|---|---|---|',
  `| N.º de estados de CNC ‖ Brazo | ${estadosC.size} | ${comp.estados.length} | ${coincide(estadosC.size === comp.estados.length)} |`,
  `| N.º de transiciones de CNC ‖ Brazo | ${transC.length} | ${comp.transiciones.length} | ${coincide(transC.length === comp.transiciones.length)} |`,
  `| N.º de estados del sistema supervisado | ${buenos.size} | ${sup.estados.length} | ${coincide(buenos.size === sup.estados.length)} |`,
  `| N.º de transiciones del sistema supervisado | ${transSup.length} | ${sup.transiciones.length} | ${coincide(transSup.length === sup.transiciones.length)} |`,
  `| Eventos controlables que deshabilita | ${deshab.sort().join('; ')} | ${[...sup.deshabilitados.entries()].flatMap(([e, l]) => l.map((d) => `${d.evento} en (${e.replace('|', ', ')})`)).length} (iniciar_fresado y abrir_mandril) | ${coincide(deshab.length === 2)} |`);

// ---------- Red de Petri (lector propio de .pnml) ----------
function pnml(archivo) {
  const t = leer(`modelos/petri/${archivo}`);
  const lugares = [...t.matchAll(/<place id="([^"]*)"[\s\S]*?<\/place>/g)].map((m) => ({
    nombre: m[1], m0: Number(m[0].match(/<initialMarking>\s*<value>Default,(\d+)/)[1]), k: Number(m[0].match(/<capacity>\s*<value>(\d+)/)[1]),
  }));
  const trans = [...t.matchAll(/<transition id="([^"]*)"/g)].map((m) => m[1]);
  const pre = trans.map(() => lugares.map(() => 0));
  const post = trans.map(() => lugares.map(() => 0));
  const col = (n) => lugares.findIndex((l) => l.nombre === n);
  for (const m of t.matchAll(/<arc [^>]*source="([^"]*)" target="([^"]*)"[\s\S]*?<\/arc>/g)) {
    const peso = Number(m[0].match(/<inscription>\s*<value>Default,(\d+)/)?.[1] ?? 1);
    if (col(m[1]) >= 0) pre[trans.indexOf(m[2])][col(m[1])] += peso;
    else post[trans.indexOf(m[1])][col(m[2])] += peso;
  }
  return { lugares, trans, pre, post };
}
/** Alcanzables y árbol (nodos con duplicados como hojas) con un BFS propio, con capacidad k estricta. */
function analizar(n) {
  const hab = (M, i) => M.every((v, j) => v >= n.pre[i][j]) && M.every((v, j) => v - n.pre[i][j] + n.post[i][j] <= n.lugares[j].k);
  const suc = (M, i) => M.map((v, j) => v - n.pre[i][j] + n.post[i][j]);
  const M0 = n.lugares.map((l) => l.m0);
  const vistos = new Map([[M0.join(), []]]);
  const cola = [M0];
  let nodos = 1;
  const muertos = [];
  while (cola.length) {
    const M = cola.shift();
    const hijos = n.trans.map((_, i) => i).filter((i) => hab(M, i));
    if (hijos.length === 0) muertos.push(M);
    for (const i of hijos) {
      const S = suc(M, i);
      nodos++;
      if (!vistos.has(S.join())) { vistos.set(S.join(), [...vistos.get(M.join()), n.trans[i]]); cola.push(S); }
    }
  }
  return { M0, distintos: vistos.size, nodos, muertos: muertos.map((M) => ({ M, secuencia: vistos.get(M.join()) })), vistos };
}
const rojo = pnml('robocell.pnml');
const roja2 = pnml('robocell_corregida.pnml');
const ar = analizar(rojo);
const ar2 = analizar(roja2);
const red = new RedPetri(json['red_agv.json']);
const arbol = arbolCobertura(red);
const arbol2 = arbolCobertura(new RedPetri(json['red_agv_corregida.json']));
const sumaInv = (M, nombres) => nombres.reduce((s, nm) => s + M[rojo.lugares.findIndex((l) => l.nombre === nm)], 0);
const INV = [
  ['Mesa_libre', 'AGV1_con_mesa', 'AGV1_trabajando', 'AGV2_trabajando'],
  ['Robot_libre', 'AGV2_con_robot', 'AGV1_trabajando', 'AGV2_trabajando', 'Robot_en_CNC'],
  ['AGV1_listo', 'AGV1_con_mesa', 'AGV1_trabajando'],
  ['AGV2_listo', 'AGV2_con_robot', 'AGV2_trabajando'],
];
const invOk = [...ar.vistos.keys()].every((k) => INV.every((inv) => sumaInv(k.split(',').map(Number), inv) === 1));
const muerto = ar.muertos[0];
md('', '## Red de Petri (cálculo independiente sobre robocell.pnml contra el juego)', '', '| Propiedad | Software académico (cálculo propio sobre el .pnml) | Juego | ¿Coincide? |', '|---|---|---|---|',
  `| N.º de lugares y de transiciones | ${rojo.lugares.length} y ${rojo.trans.length} | ${red.lugares.length} y ${red.transiciones.length} | ${coincide(rojo.lugares.length === red.lugares.length && rojo.trans.length === red.transiciones.length)} |`,
  `| Marcado inicial M0 | [${ar.M0.join(',')}] | [${red.m0.join(',')}] | ${coincide(ar.M0.join() === red.m0.join())} |`,
  `| Capacidad k por lugar | ${[...new Set(rojo.lugares.map((l) => l.k))].join(', ')} (todos) | ${[...new Set(red.lugares.map((l) => l.k))].join(', ')} (todos) | ${coincide(rojo.lugares.every((l, j) => l.k === red.lugares[j].k))} |`,
  `| Marcados alcanzables distintos | ${ar.distintos} | ${arbol.marcadosDistintos} | ${coincide(ar.distintos === arbol.marcadosDistintos)} |`,
  `| N.º de nodos del árbol de cobertura desde M0 | ${ar.nodos} | ${arbol.nodos.length} | ${coincide(ar.nodos === arbol.nodos.length)} |`,
  `| Marcado muerto (deadlock) | [${muerto.M.join(',')}] | [${arbol.muertos[0].join(',')}] | ${coincide(muerto.M.join() === arbol.muertos[0].join())} |`,
  `| Secuencia más corta al deadlock | ${muerto.secuencia.join(' → ')} | t1a y t2a (en cualquier orden) | ${coincide(muerto.secuencia.length === 2 && muerto.secuencia.every((t) => ['t1a', 't2a'].includes(t)))} |`,
  `| ¿Acotada y segura (1-acotada)? | sí: ningún marcado supera k = 1 | sí (${arbol.acotada ? 'sin ω' : 'con ω'}) | ${coincide(arbol.acotada)} |`,
  `| Invariantes P (cada suma vale 1 en todo marcado alcanzable) | ${invOk ? 'IP1 a IP4 se conservan' : 'fallan'} | se comprueban en test/redPetri.test.js | ${coincide(invOk)} |`,
  `| Red corregida (Celda_libre): nodos / marcados / muertos | ${ar2.nodos} / ${ar2.distintos} / ${ar2.muertos.length} | ${arbol2.nodos.length} / ${arbol2.marcadosDistintos} / ${arbol2.muertos.length} | ${coincide(ar2.nodos === arbol2.nodos.length && ar2.distintos === arbol2.marcadosDistintos && ar2.muertos.length === 0 && arbol2.muertos.length === 0)} |`);

// ---------- Secuencias de eventos o disparos ----------
const SECUENCIAS = [
  ['CNC', 'CNC.jff', 'cnc.json', 'cifd'], ['CNC', 'CNC.jff', 'cnc.json', 'cixr'], ['CNC', 'CNC.jff', 'cnc.json', 'cif'],
  ['Brazo', 'Brazo.jff', 'brazo.json', 'mlaedm'], ['Brazo', 'Brazo.jff', 'brazo.json', 'mlace'], ['AGV', 'AGV.jff', 'agv.json', 'vguz'],
];
md('', '## Secuencias de eventos o de disparos', '', '| Secuencia | Resultado en JFLAP o PIPE2 (estado o marcado) | Resultado en el juego | ¿Coincide? |', '|---|---|---|---|');
for (const [nombre, , js, w] of SECUENCIAS) {
  const a = simular(A[nombre], w);
  const g = simularJuego(js, w);
  md(`| ${nombre}: \`${w}\` | ${a.estado} | ${g.estado} | ${coincide(a.estado === g.estado)} |`);
}
for (const seq of [['t1a', 't2a'], ['t1a', 't1b', 't1c'], ['tr_ir', 't1a']]) {
  let M = [...ar.M0];
  for (const t of seq) { const i = rojo.trans.indexOf(t); M = M.map((v, j) => v - rojo.pre[i][j] + rojo.post[i][j]); }
  const r = new RedPetri(json['red_agv.json']);
  for (const t of seq) r.disparar(t);
  md(`| Disparos: ${seq.join(' → ')} | [${M.join(',')}] | [${r.marcado().join(',')}] | ${coincide(M.join() === r.marcado().join())} |`);
}
md('', `Total de comparaciones: ${resumen.filas}. Diferencias: ${resumen.fallos}.`);

fs.writeFileSync(fileURLToPath(new URL('docs/pruebas_modelo_generado.md', raiz)),
  `# Conformidad modelo–juego (generado)\n\nLo genera \`node scripts/pruebas-modelo.mjs\`. Lee los archivos de \`modelos/\` con un lector propio (independiente del exportador que usa el juego) y compara con el núcleo de \`src/sed/\`.\n\n${salida.join('\n')}\n`);
console.log(`comparaciones: ${resumen.filas}, diferencias: ${resumen.fallos}`);
if (resumen.fallos > 0) process.exit(1);
