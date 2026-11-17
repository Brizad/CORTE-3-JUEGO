// Configuración global del juego. Sin dependencias: se puede importar desde Node y desde el navegador.
// Valores tomados de docs/arte.md y docs/GDD.md.

// Lienzo del juego (px). La escala FIT lo ajusta a la ventana.
export const ANCHO = 960;
export const ALTO = 540;

// Resolución de dibujo: el canvas mide ANCHO*RES x ALTO*RES y cada cámara usa zoom RES, de modo que todo el código
// sigue usando coordenadas lógicas de 960x540 pero se dibuja nítido al agrandar.
export const RES = 2;

// Rejilla isométrica 2:1: cada celda mide 64 x 32 px.
export const TILE_W = 64;
export const TILE_H = 32;

// Planta de 12 columnas (gx = 0..11) por 10 filas (gy = 0..9).
export const PLANTA = { columnas: 12, filas: 10 };

// Vértice superior de la celda (0, 0) en pantalla. La planta queda centrada en x = 480.
export const ORIGEN = { x: 448, y: 90 };

// Velocidades de simulación permitidas (botones x1, x2 y x4; la tecla V pasa de una a otra).
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
  S1: { x: 8, y: 3 },
  S2: { x: 8, y: 5 },
  D1: { x: 10, y: 1 },
  D2: { x: 10, y: 8 },
};

// Rutas de los AGV (docs/arte.md, sección 9.1): waypoints en celdas, del depósito a la estación.
export const RUTAS_AGV = {
  AGV1: [[10, 1], [10, 3], [8, 3]],
  AGV2: [[10, 8], [10, 5], [8, 5]],
};

// Alto de cada objeto en píxeles (docs/arte.md, sección 4).
export const ALTOS = { CNC: 40, BRAZO: 56, MESA: 12, AGV: 14, MURO: 24 };

// Tiempos del GDD (sección 6), en segundos de simulación.
export const TIEMPOS = {
  brazoLlegar: 2, // mover -> llegar
  fresado: 10, // iniciar_fresado -> fin_fresado
  fallaMin: 2, // falla_husillo: mínimo después de iniciar_fresado
  fallaMax: 8, // falla_husillo: máximo después de iniciar_fresado
  agvViaje: 4, // reservar -> llegar_estacion
  agvDescarga: 5, // iniciar_descarga -> fin_descarga
  pedidoVence: 30, // un pedido sin atender vence a los 30 s
};

// Turnos del GDD (secciones 6.1 y 7). Tiempos en s; probFalla es una probabilidad (0 a 1).
export const TURNOS = [
  { duracion: 180, meta: 3, probFalla: 0.1, intervaloPedidos: 25 },
  { duracion: 180, meta: 5, probFalla: 0.2, intervaloPedidos: 18 },
  { duracion: 180, meta: 6, probFalla: 0.3, intervaloPedidos: 12 },
];

// Turno 0 (tutorial, docs/GDD.md sección 18.5): sin límite de tiempo, sin meta, sin fallas y con pedidos que no vencen.
export const TURNO_0 = { duracion: 1e9, meta: 1e9, probFalla: 0, intervaloPedidos: 25, pedidosVencen: false };

// Puntaje del GDD (sección 8), en puntos. Los negativos restan.
export const PUNTOS = {
  pieza: 100,
  cicloAGV: 40,
  reparacion: 50,
  palabraInvalida: -30,
  ayuda: -20,
  intentoBloqueado: -15,
  pedidoVencido: -20,
  radarVerde: 25,
  controlador: -150,
  deadlock: -200,
};

// Segundos de simulación que se muestra la expresión regular tras "Pedir ayuda" (GDD, sección 8).
export const DURACION_AYUDA = 5;

// Enfriamiento del premio del radar de amarillo a verde (GDD, sección 8), en s de simulación.
export const ENFRIAMIENTO_RADAR = 20;
