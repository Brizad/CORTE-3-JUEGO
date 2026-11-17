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
};
