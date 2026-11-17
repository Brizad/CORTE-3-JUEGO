// Disposición del HUD general (docs/arte.md, sección 8): zonas y botones de la barra, en píxeles lógicos de 960 x 540.
// Sin Phaser: la prueba test/disposicion.test.js comprueba que nada se encima, que todo cabe y que los botones miden al menos 44 px.

export const ANCHO_LOGICO = 960;
export const ALTO_LOGICO = 540;
export const BOTON_TACTIL = 44; // mínimo táctil

export const ZONAS = {
  reloj: { x: 8, y: 8, ancho: 116, alto: 40 },
  puntaje: { x: 394, y: 8, ancho: 236, alto: 40 }, // puntaje y barra de objetivo (piezas, progreso y tiempo)
  radar: { x: 770, y: 8, ancho: 182, alto: 40 },
  fichas: { x: 8, y: 450, ancho: 412, alto: 82 },
  alertas: { x: 540, y: 450, ancho: 412, alto: 82 },
  tarjetas: { x: 300, y: 52, ancho: 366, alto: 34 }, // 3 tarjetas de 118 px
};

const boton = (x, y, ancho = BOTON_TACTIL, alto = BOTON_TACTIL) => ({ x, y, ancho, alto });

export const BOTONES = {
  pantalla: boton(126, 4),
  ayuda: boton(170, 4),
  silencio: boton(214, 4),
  vel1: boton(258, 4),
  vel2: boton(302, 4),
  vel4: boton(346, 4),
  pausa: boton(634, 4),
  inspector: boton(678, 4),
  red: boton(722, 4),
  despachoAGV1: boton(424, 450, 54, 44),
  despachoAGV2: boton(482, 450, 54, 44),
  controlador: boton(424, 496, 112, 44),
  // Barra de control fija (docs/GDD.md, sección 18.20), en y 400–446, justo encima de las fichas y las alertas:
  // el brazo a la izquierda (7 botones), las dos CNC a la derecha y los AGV en el centro de abajo (los 3 de arriba).
  // En el hueco del medio (x 428–596) se sigue viendo la punta de la planta con la base del AGV 2.
  ir1: boton(8, 400, 56, 46),
  ir2: boton(68, 400, 56, 46),
  abrir: boton(128, 400, 56, 46),
  meter: boton(188, 400, 56, 46),
  sacar: boton(248, 400, 56, 46),
  cerrar: boton(308, 400, 56, 46),
  volver: boton(368, 400, 56, 46),
  fresar1: boton(600, 400, 174, 46),
  fresar2: boton(778, 400, 174, 46),
};

// Botón de la barra de control de cada verbo (ids de src/sed/controles.js).
export const BOTON_DE_VERBO = {
  ir1: 'ir1', ir2: 'ir2', abrir: 'abrir', meter: 'meter', sacar: 'sacar', cerrar: 'cerrar', volver: 'volver',
  fresar1: 'fresar1', fresar2: 'fresar2', agv1: 'despachoAGV1', agv2: 'despachoAGV2',
};

// Panel de la máquina seleccionada (HUDMaquina): a la izquierda o a la derecha, de y = 56 a y = 396. No tapa la barra de control.
export const PANEL_MAQUINA = { y: 56, alto: 340, ancho: 460, xIzquierda: 8, xDerecha: 492 };
