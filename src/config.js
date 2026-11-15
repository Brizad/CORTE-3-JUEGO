// Configuración global del juego. Sin dependencias: se puede importar desde Node y desde el navegador.
// Valores tomados de docs/arte.md y docs/GDD.md.

// Lienzo del juego (px). La escala FIT lo ajusta a la ventana.
export const ANCHO = 960;
export const ALTO = 540;

// Rejilla isométrica 2:1: cada celda mide 64 x 32 px.
export const TILE_W = 64;
export const TILE_H = 32;

// Planta de 12 columnas (gx = 0..11) por 10 filas (gy = 0..9).
export const PLANTA = { columnas: 12, filas: 10 };

// Vértice superior de la celda (0, 0) en pantalla. La planta queda centrada en x = 480.
export const ORIGEN = { x: 448, y: 90 };

// Velocidades de simulación permitidas (teclas 1, 2 y 4).
export const VELOCIDADES = [1, 2, 4];

// Semilla del generador pseudoaleatorio (docs/GDD.md, sección 6).
export const SEMILLA = 2026;

// Paleta de 14 colores (docs/arte.md, sección 2). No se añaden colores fuera de esta tabla.
export const COLORES = {
  operacion: 0x2e9e5b,
  espera: 0xe0b21b,
  fallo: 0xd64545,
  mantenimiento: 0x3b7dd8,
  mesa: 0xb07a3c,
  robot: 0xf08a24,
  agv: 0x3fa7d6,
  celda: 0xd4af37,
  suelo: 0x2b323c,
  muro: 0x4a5360,
  maquina: 0x8794a3,
  banda: 0x566170,
  panel: 0x161b22,
  texto: 0xe8edf2,
};

// Misma paleta en texto "#rrggbb" para los textos de Phaser.
export const TEXTO_HEX = {
  texto: '#e8edf2',
  espera: '#e0b21b',
  fallo: '#d64545',
  operacion: '#2e9e5b',
};

// Ubicación de las máquinas en la rejilla (docs/arte.md, sección 3).
export const POSICIONES = {
  CNC1: { x: 3, y: 2 },
  CNC2: { x: 3, y: 6 },
  BRAZO: { x: 5, y: 4 },
  MESA: { x: 7, y: 4 },
};
