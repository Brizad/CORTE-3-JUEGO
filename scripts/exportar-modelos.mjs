// Exporta los modelos de modelos/ (.jff y .pnml) a JSON en src/sed/modelos/.
// Los valores salen de los archivos de JFLAP y PIPE2: aquí no se inventa ni se cambia ninguno.
// Uso: npm run modelos   (el test test/modelos.test.js comprueba que los JSON siguen al día)
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = new URL('../', import.meta.url);
const ruta = (relativa) => fileURLToPath(new URL(relativa, RAIZ));

// Códigos de una letra de docs/modelo/automatas.md, sección 2: [código, id, controlable].
const EVENTOS = {
  'CNC.jff': [['c', 'cargar', true], ['i', 'iniciar_fresado', true], ['f', 'fin_fresado', false],
    ['d', 'descargar', true], ['x', 'falla_husillo', false], ['r', 'reset', true]],
  'Brazo.jff': [['m', 'mover', true], ['l', 'llegar', false], ['a', 'abrir_mandril', true],
    ['e', 'cerrar_mandril', true], ['c', 'cargar', true], ['d', 'descargar', true]],
  'AGV.jff': [['v', 'reservar', true], ['g', 'llegar_estacion', false], ['u', 'iniciar_descarga', true],
    ['z', 'fin_descarga', false]],
  // Lenguaje de reparación: los símbolos no son eventos de una máquina; se marcan controlables.
  'Reparacion_DFA.jff': [['H', 'home', true], ['C', 'chequeo', true], ['T', 'cambio_herramienta', true],
    ['R', 'reset', true]],
};

// Transiciones que dispara el jugador (docs/GDD.md). Las demás son automáticas.
const DISPARO_JUGADOR = new Set(['t1a', 't2a', 'tr_ir']);

// Nombre y evento de cada transición de la red (docs/modelo/petri.md, sección 3).
const TRANSICIONES = {
  t1a: ['reservar_AGV1', 'reservar'], t1b: ['iniciar_descarga_AGV1', 'iniciar_descarga'],
  t1c: ['fin_descarga_AGV1', 'fin_descarga'], t2a: ['reservar_AGV2', 'reservar'],
  t2b: ['iniciar_descarga_AGV2', 'iniciar_descarga'], t2c: ['fin_descarga_AGV2', 'fin_descarga'],
  tr_ir: ['brazo_ir', 'mover'], tr_volver: ['brazo_volver', 'mover'],
};

/** Lee un .jff y devuelve el autómata en el formato JSON del proyecto. */
function leerJff(archivo, nombre) {
  const texto = fs.readFileSync(ruta(`modelos/automatas/${archivo}`), 'utf8');
  const estados = new Map();
  const posiciones = {}; // coordenadas (x, y) de cada estado en JFLAP: el HUD usa la misma distribución
  let inicial = null;
  const marcados = [];
  for (const m of texto.matchAll(/<state id="(\d+)" name="([^"]*)">([\s\S]*?)<\/state>/g)) {
    estados.set(m[1], m[2]);
    const x = /<x>([-\d.]+)<\/x>/.exec(m[3]);
    const y = /<y>([-\d.]+)<\/y>/.exec(m[3]);
    if (x && y) posiciones[m[2]] = [Number(x[1]), Number(y[1])];
    if (/<initial\/>/.test(m[3])) inicial = m[2];
    if (/<final\/>/.test(m[3])) marcados.push(m[2]);
  }
  const porCodigo = new Map(EVENTOS[archivo].map(([codigo, id]) => [codigo, id]));
  const transiciones = [];
  for (const m of texto.matchAll(/<transition>\s*<from>(\d+)<\/from>\s*<to>(\d+)<\/to>\s*<read>([^<]*)<\/read>/g)) {
    if (!porCodigo.has(m[3])) throw new Error(`${archivo}: símbolo desconocido ${m[3]}`);
    transiciones.push([estados.get(m[1]), porCodigo.get(m[3]), estados.get(m[2])]);
  }
  return {
    nombre,
    estados: [...estados.values()],
    inicial,
    marcados,
    posiciones,
    eventos: EVENTOS[archivo].map(([codigo, id, controlable]) => ({ id, codigo, controlable, observable: true })),
    transiciones,
  };
}

/** Lee un .pnml de PIPE2 y devuelve la red en el formato JSON del proyecto (pre y post de |T| x |P|). */
function leerPnml(archivo, nombre) {
  const texto = fs.readFileSync(ruta(`modelos/petri/${archivo}`), 'utf8');
  const lugares = [];
  for (const m of texto.matchAll(/<place id="([^"]*)"[\s\S]*?<\/place>/g)) {
    const m0 = Number(m[0].match(/<initialMarking>\s*<value>Default,(\d+)/)[1]);
    const k = Number(m[0].match(/<capacity>\s*<value>(\d+)/)[1]);
    lugares.push({ id: `p${lugares.length + 1}`, nombre: m[1], m0, k, capacidad: 'estricta' });
  }
  const idsT = [...texto.matchAll(/<transition id="([^"]*)"/g)].map((m) => m[1]);
  const transiciones = idsT.map((id) => ({
    id,
    nombre: TRANSICIONES[id][0],
    disparo: DISPARO_JUGADOR.has(id) ? 'jugador' : 'automatica',
    evento: TRANSICIONES[id][1],
  }));
  const pre = idsT.map(() => lugares.map(() => 0));
  const post = idsT.map(() => lugares.map(() => 0));
  const col = (nombreLugar) => lugares.findIndex((l) => l.nombre === nombreLugar);
  for (const m of texto.matchAll(/<arc [^>]*source="([^"]*)" target="([^"]*)"[\s\S]*?<\/arc>/g)) {
    const peso = Number(m[0].match(/<inscription>\s*<value>Default,(\d+)/)?.[1] ?? 1);
    if (col(m[1]) >= 0) pre[idsT.indexOf(m[2])][col(m[1])] += peso; // lugar -> transición
    else post[idsT.indexOf(m[1])][col(m[2])] += peso; // transición -> lugar
  }
  return { nombre, lugares, transiciones, pre, post };
}

/** Genera todos los JSON: { 'cnc.json': {...}, ... }. */
export function generarModelos() {
  const dfa = leerJff('Reparacion_DFA.jff', 'Reparacion_DFA');
  dfa.expresion = '^H(CT?)+R$';
  dfa.expresionJflap = fs.readFileSync(ruta('modelos/automatas/Reparacion_ER.jff'), 'utf8')
    .match(/<expression>([^<]*)<\/expression>/)[1];
  return {
    'cnc.json': leerJff('CNC.jff', 'CNC'),
    'brazo.json': leerJff('Brazo.jff', 'Brazo'),
    'agv.json': leerJff('AGV.jff', 'AGV'),
    'reparacion_dfa.json': dfa,
    'supervisor.json': {
      nombre: 'Supervisor_CNC_Brazo',
      plantas: ['CNC', 'Brazo'],
      prohibidos: [['Fresando', 'Mandril_Abierto']],
      razon: '¬(CNC = Fresando ∧ Brazo = Mandril_Abierto)',
    },
    'red_agv.json': leerPnml('robocell.pnml', 'RoboCell_AGV'),
    'red_agv_corregida.json': leerPnml('robocell_corregida.pnml', 'RoboCell_AGV_corregida'),
  };
}

/** Texto JSON con indentación de 2 espacios y las listas de datos simples en una sola línea. */
export function aTexto(objeto) {
  return JSON.stringify(objeto, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, dentro) => `[${dentro.replace(/\s*\n\s*/g, ' ')}]`) + '\n';
}

// Al ejecutarlo directamente, escribe los archivos.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const salida = ruta('src/sed/modelos/');
  fs.mkdirSync(salida, { recursive: true });
  for (const [archivo, datos] of Object.entries(generarModelos())) {
    fs.writeFileSync(salida + archivo, aTexto(datos));
    console.log('escrito', archivo);
  }
}
