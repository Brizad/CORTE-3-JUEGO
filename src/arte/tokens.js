// Fichas de la red de Petri dibujadas en código (docs/arte.md, sección 6).
// Mesa = tablero café, Robot = engranaje naranja, AGV = rombo azul, Celda = llave dorada.
// Tamaño base: 20 px de alto sobre la planta. Los lugares combinados se componen con los tokens base.

import { COLORES } from '../config.js';
import { oscurecer } from '../iso/formas.js';

/** Qué se dibuja en cada lugar de la red (por nombre de lugar) y su etiqueta, si tiene. */
export const FICHAS_DE_LUGAR = {
  Mesa_libre: { base: 'mesa' },
  Robot_libre: { base: 'robot' },
  AGV1_listo: { base: 'agv' },
  AGV2_listo: { base: 'agv' },
  AGV1_con_mesa: { base: 'agv', extras: ['mesa'], etiqueta: '1' },
  AGV2_con_robot: { base: 'agv', extras: ['robot'], etiqueta: '2' },
  AGV1_trabajando: { base: 'agv', extras: ['mesa', 'robot'], etiqueta: '1' },
  AGV2_trabajando: { base: 'agv', extras: ['mesa', 'robot'], etiqueta: '2' },
  Robot_en_CNC: { base: 'robot', extras: ['cnc'] },
  Celda_libre: { base: 'celda' },
};

/** Dibuja un token base centrado en (x, y). escala 1 = 20 px de alto; alfa para el "fantasma" de un lugar vacío. */
export function dibujarBase(g, tipo, x, y, escala = 1, alfa = 1) {
  const s = escala;
  switch (tipo) {
    case 'mesa': {
      // Tablero con patas.
      g.fillStyle(oscurecer(COLORES.mesa, 0.35), alfa);
      g.fillRect(x - 8 * s, y + 1 * s, 2.5 * s, 8 * s);
      g.fillRect(x + 5.5 * s, y + 1 * s, 2.5 * s, 8 * s);
      g.fillStyle(COLORES.mesa, alfa);
      g.fillRect(x - 10 * s, y - 5 * s, 20 * s, 6 * s);
      g.fillStyle(oscurecer(COLORES.mesa, 0.2), alfa);
      g.fillRect(x - 10 * s, y - 0.5 * s, 20 * s, 1.5 * s);
      break;
    }
    case 'robot': {
      // Engranaje de 8 dientes con un agujero.
      const puntos = [];
      for (let i = 0; i < 16; i++) {
        const radio = (i % 2 === 0 ? 10 : 7) * s;
        const ang = (i * Math.PI) / 8 - Math.PI / 16;
        puntos.push({ x: x + Math.cos(ang) * radio, y: y + Math.sin(ang) * radio });
      }
      g.fillStyle(COLORES.robot, alfa);
      g.fillPoints(puntos, true);
      g.fillStyle(COLORES.panel, alfa);
      g.fillCircle(x, y, 3 * s);
      break;
    }
    case 'agv': {
      // Rombo azul.
      const rombo = [{ x, y: y - 10 * s }, { x: x + 13 * s, y }, { x, y: y + 10 * s }, { x: x - 13 * s, y }];
      g.fillStyle(COLORES.agv, alfa);
      g.fillPoints(rombo, true);
      g.lineStyle(1.5, oscurecer(COLORES.agv, 0.35), alfa);
      g.strokePoints(rombo, true);
      break;
    }
    case 'celda': {
      // Llave dorada.
      g.lineStyle(3 * s, COLORES.celda, alfa);
      g.strokeCircle(x - 5.5 * s, y, 4.5 * s);
      g.lineBetween(x - 1 * s, y, x + 10 * s, y);
      g.lineBetween(x + 6 * s, y, x + 6 * s, y + 4.5 * s);
      g.lineBetween(x + 10 * s, y, x + 10 * s, y + 4.5 * s);
      break;
    }
    case 'cnc': {
      // CNC pequeña (prisma con ventana).
      g.fillStyle(oscurecer(COLORES.maquina, 0.2), alfa);
      g.fillRect(x - 5 * s, y - 3 * s, 10 * s, 8 * s);
      g.fillStyle(COLORES.maquina, alfa);
      g.fillRect(x - 5 * s, y - 5 * s, 10 * s, 2.5 * s);
      g.fillStyle(oscurecer(COLORES.maquina, 0.6), alfa);
      g.fillRect(x - 3 * s, y - 1 * s, 6 * s, 4 * s);
      break;
    }
    default:
      throw new Error(`Token desconocido: ${tipo}`);
  }
}

/**
 * Dibuja la ficha de un lugar, con su composición (AGV con mesa, etc.).
 * @param {string} lugar Nombre del lugar (por ejemplo "AGV1_con_mesa").
 */
export function dibujarFicha(g, lugar, x, y, alfa = 1, escala = 1) {
  const f = FICHAS_DE_LUGAR[lugar];
  if (!f) throw new Error(`Lugar sin ficha: ${lugar}`);
  dibujarBase(g, f.base, x, y, escala, alfa);
  if (f.base === 'robot' && f.extras?.[0] === 'cnc') {
    dibujarBase(g, 'cnc', x + 11 * escala, y + 6 * escala, 0.8 * escala, alfa);
    return;
  }
  const pequenos = f.extras ?? [];
  // Un extra va en la esquina superior derecha; dos, a los lados de la parte superior.
  const sitios = pequenos.length === 1 ? [[9, -7]] : [[-9, -8], [9, -8]];
  pequenos.forEach((tipo, i) => dibujarBase(g, tipo, x + sitios[i][0] * escala, y + sitios[i][1] * escala, 0.5 * escala, alfa));
}
