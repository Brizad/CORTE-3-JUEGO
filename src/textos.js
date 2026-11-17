// Textos de ayuda del juego (docs/GDD.md, sección 18.13). Sin Phaser ni DOM: se prueban con Node.

// Tabla de controles (docs/GDD.md, sección 13): acción, mouse y teclado, táctil.
export const CONTROLES = [
  ['Abrir el HUD de una máquina', 'Clic en la máquina', 'Toque en la máquina'],
  ['Acción de la máquina (Cargar bloque, Fresar...)', 'Clic en el botón grande o Espacio', 'Toque en el botón'],
  ['Elegir CNC 1 o CNC 2', '1 y 2', 'Toque en la máquina'],
  ['Despachar AGV 1 o AGV 2', 'Q y W', 'Botones de abajo'],
  ['Cambiar entre «Acciones» y «Autómata»', 'Tab', 'Pestañas del panel'],
  ['Disparar un evento o una transición', 'Clic en su botón (pestaña Autómata)', 'Toque en su botón'],
  ['Pausa y menú', 'P', 'Botón de pausa'],
  ['Ayuda', '?', 'Botón "?"'],
  ['Inspector (ecuación de estado y árbol)', 'I', 'Botón "Insp."'],
  ['Vista de la red de Petri', 'R', 'Botón "Red"'],
  ['Velocidad x1, x2 y x4', 'V (cambia de una a otra)', 'Botones x1, x2, x4'],
  ['Consola de reparación', 'H, C, T, R, Retroceso y Enter', 'Botones de comandos'],
  ['Cerrar un panel', 'Esc', 'Botón X'],
  ['Mover la cámara', 'Arrastrar', 'Arrastrar con un dedo'],
  ['Acercar y alejar', 'Rueda del mouse', 'Pellizco con dos dedos'],
  ['Pantalla completa', 'G', 'Botón ⛶'],
  ['Silenciar, contador de fps y demostración', 'M, F1, D', 'Botón del altavoz'],
];

// Leyenda de colores: [color, significado]. El color se pinta con la paleta de config.js (clave de COLORES).
export const LEYENDA = [
  ['operacion', 'Verde: en marcha (la CNC fresa, el brazo se mueve, el AGV viaja) o botón que se puede pulsar.'],
  ['banda', 'Gris: botón que todavía no se puede pulsar (falta una condición, el mensaje dice cuál).'],
  ['fallo', 'Rojo: falla del husillo, o botón que el supervisor bloquea (pulsarlo resta 15 puntos).'],
  ['robot', 'Naranja: la ficha del robot, o dos transiciones que compiten por la misma ficha (conflicto).'],
  ['espera', 'Amarillo: la máquina espera (libre, cargada, mandril abierto o AGV esperando).'],
  ['mantenimiento', 'Azul: consola de reparación abierta o botón activo en el panel.'],
];

export const LEYENDA_RADAR = [
  ['operacion', 'Radar verde: ningún despacho lleva al bloqueo.'],
  ['espera', 'Radar amarillo (parpadea): un solo movimiento más lleva al bloqueo; la alerta dice cuál evitar.'],
  ['fallo', 'Radar rojo: interbloqueo. Termina el turno con −200 puntos.'],
];

/** Una frase corta de lo que hace cada máquina (se muestra al pasar el mouse o al tocar). */
export const DESCRIPCION_MAQUINA = {
  CNC1: 'CNC 1: fresa las piezas (10 s). Clic (o tecla 1) para ver sus acciones: cargar, fresar y sacar la pieza.',
  CNC2: 'CNC 2: fresa las piezas (10 s). Clic (o tecla 2) para ver sus acciones: cargar, fresar y sacar la pieza.',
  BRAZO: 'Brazo robótico: carga y descarga las CNC. Se maneja desde el panel de cada CNC.',
  AGV1: 'AGV 1: trae material. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.',
  AGV2: 'AGV 2: trae material. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.',
};

/** Intro corta de la partida (5 líneas como máximo): se muestra antes del turno 1 y con el botón «?». */
export function introLineas(meta = 3) {
  return [
    `Eres el jefe de turno. Meta: fabrica ${meta} piezas con las 2 CNC antes de 180 s.`,
    'El brazo carga y descarga las CNC. Si una CNC falla, repárala con H C T C R.',
    'Los carritos (AGV) piden la mesa y el robot. Despáchalos antes de 30 s o pierdes 20.',
    'Si los 2 carritos salen a la vez, cada uno toma un recurso y la fábrica se traba.',
    'El radar avisa: verde = bien, amarillo = cuidado, rojo = trabado.',
  ];
}

/** Atajos de teclado que se muestran en el botón «?». */
export const ATAJOS = [
  ['1 y 2', 'elegir CNC 1 y CNC 2'],
  ['Espacio', 'acción principal de la máquina elegida'],
  ['Q y W', 'despachar AGV 1 y AGV 2'],
  ['Tab', 'cambiar entre «Acciones» y «Autómata»'],
  ['M', 'silenciar o activar el sonido'],
];

/** Texto del radar al pasar el mouse. */
export const TIP_RADAR = 'M6 = foto actual de las fichas. Verde: seguro. Amarillo: si despachas otro AGV ahora, te trabas. Rojo: trabado.';

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
 * Rótulo de cada pedido pendiente: "AGV 1 espera" (el carrito está libre y hay que despacharlo), "AGV 2 en camino" (ya salió
 * a atenderlo) o "Pedido en cola" (hay más pedidos que carritos). El modelo no ata un pedido a un AGV: el más antiguo lo
 * atiende el primer AGV que termina, así que primero van los que ya están en camino y luego los libres.
 * @param {object[]} pedidos Pedidos pendientes, del más antiguo al más nuevo.
 * @param {{AGV1:string, AGV2:string}} estados Estado del autómata de cada AGV.
 * @returns {{agv:string|null, texto:string}[]}
 */
export function etiquetasPedidos(pedidos, estados) {
  const agvs = ['AGV1', 'AGV2'];
  const orden = [
    ...agvs.filter((a) => estados[a] !== 'Libre').map((a) => [a, 'en camino']),
    ...agvs.filter((a) => estados[a] === 'Libre').map((a) => [a, 'espera']),
  ];
  return pedidos.map((_, i) => (orden[i] ? { agv: orden[i][0], texto: `AGV ${orden[i][0].slice(3)} ${orden[i][1]}` } : { agv: null, texto: 'Pedido en cola' }));
}

/**
 * Cuenta regresiva de un pedido: segundos que le quedan y su color (verde > amarillo > rojo).
 * @returns {{resto:number, fraccion:number, nivel:'operacion'|'espera'|'fallo'|'mantenimiento', texto:string}}
 */
export function cuentaPedido(pedido, ahora, limite, vence = true) {
  if (!vence) return { resto: Infinity, fraccion: 1, nivel: 'mantenimiento', texto: 'sin límite' };
  const resto = Math.max(0, limite - (ahora - pedido.t));
  const fraccion = resto / limite;
  const nivel = pedido.vencido ? 'fallo' : fraccion > 1 / 2 ? 'operacion' : fraccion > 1 / 6 ? 'espera' : 'fallo';
  return { resto, fraccion, nivel, texto: pedido.vencido ? 'vencido' : `${Math.ceil(resto)} s` };
}

/** Frase corta del jefe de planta al terminar el turno. */
export function fraseJefe(r) {
  if (r.resultado === 'victoria') return '¡Turno cumplido!';
  if (r.deadlocks > 0) return 'La fábrica se trabó: mira el radar antes de despachar.';
  const faltan = Math.max(0, r.meta - r.piezas);
  const piezas = faltan === 1 ? '1 pieza' : `${faltan} piezas`;
  if (r.pedidosVencidos > 0) return `Faltaron ${piezas}, ojo con los pedidos vencidos.`;
  if (r.fallas > r.fallasReparadas) return `Faltaron ${piezas}, repara las fallas más rápido.`;
  return `Faltaron ${piezas}: mantén las dos CNC fresando todo el tiempo.`;
}

const NOMBRE_AGV = { t1a: 'AGV1', t2a: 'AGV2' };

/** "Turno 2: 5 piezas, fallas 20 %, pedidos cada 18 s" (aviso de 3 s al empezar cada turno). */
export function avisoTurno(parametros, indice, tutorial = false) {
  if (tutorial) return 'Turno 0 (tutorial): sin límite de tiempo, sin meta y sin fallas. Prueba cada botón con calma.';
  const falla = Math.round(parametros.probFalla * 100);
  const piezas = parametros.meta === 1 ? '1 pieza' : `${parametros.meta} piezas`;
  return `Turno ${indice + 1}: ${piezas}, fallas ${falla} %, pedidos cada ${parametros.intervaloPedidos} s`;
}

/**
 * Por qué el radar pasó a amarillo: a partir de los marcados muertos alcanzables en un paso.
 * @param {{muertosAlcanzables:{camino:string[]}[]}} radar
 */
export function razonRadarAmarillo(radar) {
  const t = radar?.muertosAlcanzables?.[0]?.camino?.[0];
  if (!t) return 'Radar amarillo: un movimiento más puede bloquear la celda.';
  const agv = NOMBRE_AGV[t];
  if (agv) return `Radar amarillo: si despachas ${agv} ahora, la celda se bloquea.`;
  return `Radar amarillo: si se dispara ${t} ahora, la celda se bloquea.`;
}
