// Textos de ayuda del juego (docs/GDD.md, sección 18.13). Sin Phaser ni DOM: se prueban con Node.

// Tabla de controles (docs/GDD.md, sección 13): acción, mouse y teclado, táctil.
export const CONTROLES = [
  ['Abrir el HUD de una máquina', 'Clic en la máquina', 'Toque en la máquina'],
  ['Disparar un evento o una transición', 'Clic en su botón', 'Toque en su botón'],
  ['Pausa y menú', 'P', 'Botón de pausa'],
  ['Ayuda', '?', 'Botón "?"'],
  ['Inspector (ecuación de estado y árbol)', 'I', 'Botón "Insp."'],
  ['Vista de la red de Petri', 'R', 'Botón "Red"'],
  ['Velocidad x1, x2 y x4', '1, 2, 4', 'Botones x1, x2, x4'],
  ['Consola de reparación', 'H, C, T, R, Retroceso y Enter', 'Botones de comandos'],
  ['Cerrar un panel', 'Esc', 'Botón X'],
  ['Mover la cámara', 'Arrastrar', 'Arrastrar con un dedo'],
  ['Acercar y alejar', 'Rueda del mouse', 'Pellizco con dos dedos'],
  ['Pantalla completa', 'G', 'Botón ⛶'],
  ['Sonidos, contador de fps y demostración', 'M, F1, D', '—'],
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
  CNC1: 'CNC 1: fresa las piezas (10 s). Clic para abrir su HUD, su consola y sus eventos.',
  CNC2: 'CNC 2: fresa las piezas (10 s). Clic para abrir su HUD, su consola y sus eventos.',
  BRAZO: 'Brazo robótico: carga y descarga las CNC y deja la pieza en la mesa. Clic para abrir su HUD.',
  AGV1: 'AGV 1: lleva la pieza de la mesa al pedido. Clic para abrir su HUD.',
  AGV2: 'AGV 2: lleva la pieza de la mesa al pedido. Clic para abrir su HUD.',
};

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
