// Textos del juego (docs/GDD.md, secciones 18.13, 18.19 y 18.20). Sin Phaser ni DOM: se prueban con Node.
// Los AGV traen ENTREGAS DE METAL: ningún texto visible usa las palabras "pedido" ni "cliente".

// Tabla de controles (docs/GDD.md, sección 13): acción, mouse y teclado, táctil.
export const CONTROLES = [
  ['Brazo: ir a CNC 1 o CNC 2', 'Z y X', 'Botones de la barra'],
  ['Brazo: abrir y cerrar la pinza', 'A y E', 'Botones de la barra'],
  ['Brazo: meter bloque y sacar pieza', 'C y D', 'Botones de la barra'],
  ['Brazo: volver a reposo', 'V', 'Botón de la barra'],
  ['Fresar en CNC 1 o CNC 2 (en Falla: reparar)', 'F y G', 'Botones de la barra'],
  ['Atender AGV 1 o AGV 2', 'Q y W', 'Botones de la barra'],
  ['Abrir el panel de una máquina (autómata)', 'Clic en la máquina', 'Toque en la máquina'],
  ['Cambiar entre «Autómata» y «Acciones»', 'Tab', 'Pestañas del panel'],
  ['Consola de reparación', 'H, C, T, R, Retroceso y Enter', 'Botones de comandos'],
  ['Velocidad x1, x2 y x4', '1, 2 y 4', 'Botones x1, x2, x4'],
  ['Pausa y menú', 'P', 'Botón de pausa'],
  ['Ayuda', '?', 'Botón "?"'],
  ['Inspector (ecuación de estado y árbol)', 'I', 'Botón "Insp."'],
  ['Vista de la red de Petri', 'R', 'Botón "Red"'],
  ['Cerrar un panel', 'Esc', 'Botón X'],
  ['Mover y acercar la cámara', 'Arrastrar y rueda', 'Arrastrar y pellizco'],
  ['Silenciar, pantalla completa y fps', 'M, L y F1', 'Botones del altavoz y ⛶'],
];

// Leyenda de colores: [color, significado]. El color se pinta con la paleta de config.js (clave de COLORES).
export const LEYENDA = [
  ['operacion', 'Verde: en marcha (la CNC fresa, el brazo se mueve, el AGV viaja) o botón que se puede pulsar.'],
  ['banda', 'Gris: botón que ahora no se puede pulsar o evento no controlable (el mensaje dice por qué).'],
  ['fallo', 'Rojo: falla del husillo, o botón que el supervisor bloquea (pulsarlo resta 15 puntos).'],
  ['robot', 'Naranja: la ficha del robot, o dos transiciones que compiten por la misma ficha (conflicto).'],
  ['espera', 'Amarillo: la máquina espera (libre, cargada, mandril abierto o AGV esperando).'],
  ['mantenimiento', 'Azul: consola de reparación abierta o botón activo en el panel.'],
];

export const LEYENDA_RADAR = [
  ['operacion', 'Radar verde: atender un AGV no lleva al bloqueo.'],
  ['espera', 'Radar amarillo (parpadea): un solo movimiento más lleva al bloqueo; la alerta dice cuál evitar.'],
  ['fallo', 'Radar rojo: interbloqueo. Termina el turno con −200 puntos.'],
];

/** Una frase corta de lo que hace cada máquina (se muestra al pasar el mouse o al tocar). */
export const DESCRIPCION_MAQUINA = {
  CNC1: 'CNC 1: fresa los bloques (10 s). Clic para ver su autómata. Fresar: tecla F.',
  CNC2: 'CNC 2: fresa los bloques (10 s). Clic para ver su autómata. Fresar: tecla G.',
  BRAZO: 'Brazo robótico: mete los bloques y saca las piezas de las CNC, un paso a la vez.',
  AGV1: 'AGV 1: trae metal. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.',
  AGV2: 'AGV 2: trae metal. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.',
};

/** Intro «Cómo jugar» (6 líneas como máximo, con las teclas): se muestra antes del turno 1 y con el botón «?». */
export function introLineas(meta = 6) {
  return [
    `Eres el jefe de turno: fabrica ${meta} piezas antes de 180 s.`,
    'Mueve el brazo a una CNC (Z, X), abre la pinza (A), mete el bloque (C), cierra (E), vuelve y fresa (F, G).',
    'Si una CNC falla, repárala con H C T C R.',
    'Los AGV traen metal: necesitan la mesa y el robot. Atiéndelos a tiempo (Q, W).',
    'Si atiendes los 2 AGV a la vez, cada uno toma un recurso y la celda se traba.',
    'Radar: verde = bien, amarillo = cuidado, rojo = trabado.',
  ];
}

/** Atajos de teclado que se muestran en el botón «?». */
export const ATAJOS = [
  ['Z · X', 'brazo: ir a CNC 1 · ir a CNC 2'],
  ['A · E', 'abrir · cerrar la pinza'],
  ['C · D', 'meter bloque · sacar pieza'],
  ['V', 'brazo: volver a reposo'],
  ['F · G', 'fresar (o reparar) CNC 1 · CNC 2'],
  ['Q · W', 'atender AGV 1 · AGV 2'],
  ['1 · 2 · 4', 'velocidad x1 · x2 · x4'],
  ['P · I · M', 'pausa · inspector · silencio'],
];

/** Texto del radar al pasar el mouse. */
export const TIP_RADAR = 'M6 = foto actual de las fichas. Verde: seguro. Amarillo: si atiendes otro AGV ahora, te trabas. Rojo: trabado.';

/** Qué espera un AGV en su estación, según las fichas que faltan para iniciar la descarga. */
export function textoEsperaAGV(faltan = []) {
  const robot = faltan.some((f) => f.startsWith('Robot'));
  const mesa = faltan.some((f) => f.startsWith('Mesa'));
  if (robot && mesa) return 'Espera el robot y la mesa';
  if (robot) return 'Espera el robot';
  if (mesa) return 'Espera la mesa';
  return '';
}

/**
 * Rótulo de cada entrega de metal pendiente: "AGV 1 trae metal" (el AGV está libre y hay que atenderlo), "AGV 2 en camino" (ya
 * salió) o "Metal en cola" (hay más entregas que AGV). El modelo no ata una entrega a un AGV: la más antigua la atiende el primer
 * AGV que termina, así que primero van los que ya están en camino y luego los libres.
 * @param {object[]} entregas Entregas pendientes, de la más antigua a la más nueva.
 * @param {{AGV1:string, AGV2:string}} estados Estado del autómata de cada AGV.
 * @returns {{agv:string|null, texto:string}[]}
 */
export function etiquetasEntregas(entregas, estados) {
  const agvs = ['AGV1', 'AGV2'];
  const orden = [
    ...agvs.filter((a) => estados[a] !== 'Libre').map((a) => [a, 'en camino']),
    ...agvs.filter((a) => estados[a] === 'Libre').map((a) => [a, 'trae metal']),
  ];
  return entregas.map((_, i) => (orden[i] ? { agv: orden[i][0], texto: `AGV ${orden[i][0].slice(3)} ${orden[i][1]}` } : { agv: null, texto: 'Metal en cola' }));
}

/**
 * Cuenta regresiva de una entrega: segundos que le quedan y su color (verde > amarillo > rojo).
 * @returns {{resto:number, fraccion:number, nivel:'operacion'|'espera'|'fallo'|'mantenimiento', texto:string}}
 */
export function cuentaEntrega(entrega, ahora, plazo, vence = true) {
  if (!vence) return { resto: Infinity, fraccion: 1, nivel: 'mantenimiento', texto: 'sin plazo' };
  const resto = Math.max(0, plazo - (ahora - entrega.t));
  const fraccion = resto / plazo;
  const nivel = entrega.vencido ? 'fallo' : fraccion > 1 / 2 ? 'operacion' : fraccion > 1 / 6 ? 'espera' : 'fallo';
  return { resto, fraccion, nivel, texto: entrega.vencido ? 'perdida' : `${Math.ceil(resto)} s` };
}

// Texto flotante de cada cambio de puntaje, según el motivo que da la Celda (los valores son los del GDD, sección 8).
const ETIQUETA_PUNTOS = {
  'pieza descargada': 'pieza',
  'ciclo de AGV': 'metal',
  'reparación válida': 'reparada',
  'intento bloqueado por el supervisor': 'bloqueado',
  'entrega perdida': 'entrega perdida',
  'palabra de reparación inválida': 'palabra inválida',
  'ayuda de reparación': 'ayuda',
  'radar de amarillo a verde': 'radar en verde',
  'Controlador de celda': 'controlador',
  deadlock: 'celda trabada',
};

/** "+100 pieza", "+40 metal", "−15 bloqueado", "−20 entrega perdida"... */
export function etiquetaPuntos(puntos, motivo) {
  const signo = puntos > 0 ? '+' : '−';
  return `${signo}${Math.abs(puntos)} ${ETIQUETA_PUNTOS[motivo] ?? motivo}`;
}

/** Motivo de un cambio de puntaje tal como se lee en la zona de alertas. */
export const motivoLegible = (motivo) => (motivo === 'ciclo de AGV' ? 'metal descargado' : motivo);

/** Estrellas del turno (1 a 3) según las piezas sobre la meta: 3 si se cumplió, 2 con la mitad o más, 1 con menos. */
export function estrellas(r) {
  if (r.resultado === 'victoria' || r.piezas >= r.meta) return 3;
  return r.piezas * 2 >= r.meta ? 2 : 1;
}

/** Frase corta del jefe de planta al terminar el turno. */
export function fraseJefe(r) {
  if (r.resultado === 'victoria') return '¡Turno cumplido!';
  if (r.deadlocks > 0) return 'La celda se trabó: mira el radar antes de atender el segundo AGV.';
  const faltan = Math.max(0, r.meta - r.piezas);
  const piezas = faltan === 1 ? 'Faltó 1 pieza' : `Faltaron ${faltan} piezas`;
  if (r.pedidosVencidos > 0) return `${piezas}: atiende el metal a tiempo.`;
  if (r.fallas > r.fallasReparadas) return `${piezas}: repara las fallas más rápido.`;
  return `${piezas}: mantén las dos CNC fresando todo el tiempo.`;
}

const NOMBRE_AGV = { t1a: 'AGV 1', t2a: 'AGV 2' };

/** Tarjeta de inicio del turno: "TURNO 1 · Meta 6 piezas · 180 s". */
export function tarjetaTurno(parametros, indice) {
  const piezas = parametros.meta === 1 ? '1 pieza' : `${parametros.meta} piezas`;
  return `TURNO ${indice + 1} · Meta ${piezas} · ${parametros.duracion} s`;
}

/** Segunda línea de la tarjeta de inicio: la dificultad del turno. */
export function avisoTurno(parametros, indice, tutorial = false) {
  if (tutorial) return 'Turno 0 (tutorial): sin límite de tiempo, sin meta y sin fallas. Sigue las pistas.';
  const falla = Math.round(parametros.probFalla * 100);
  const plazo = parametros.plazoEntrega ?? 30;
  const pareja = parametros.parejas ? ', a veces 2 juntas' : '';
  return `Fallas ${falla} % · metal cada ${parametros.intervaloPedidos} s${pareja} · plazo ${plazo} s`;
}

/**
 * Por qué el radar pasó a amarillo: a partir de los marcados muertos alcanzables en un paso.
 * @param {{muertosAlcanzables:{camino:string[]}[]}} radar
 */
export function razonRadarAmarillo(radar) {
  const t = radar?.muertosAlcanzables?.[0]?.camino?.[0];
  if (!t) return 'Radar amarillo: un movimiento más puede trabar la celda.';
  const agv = NOMBRE_AGV[t];
  if (agv) return `Radar amarillo: si atiendes el ${agv} ahora, la celda se traba.`;
  return `Radar amarillo: si se dispara ${t} ahora, la celda se traba.`;
}
