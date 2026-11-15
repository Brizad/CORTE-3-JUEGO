// Íconos de estado de 16 x 16 px dibujados en código (docs/arte.md, sección 5).
// Cada ícono va sobre un disco del color del panel para que se lea sobre cualquier fondo.

import { COLORES } from '../config.js';

const RADIO_FONDO = 10; // px: el ícono de 16 x 16 cabe en el disco

/**
 * Dibuja un ícono centrado en (cx, cy).
 * @param {Phaser.GameObjects.Graphics} g Objeto gráfico (ya limpio).
 * @param {string} nombre Nombre del ícono (ver estados.js).
 * @param {number} cx Centro x en pantalla.
 * @param {number} cy Centro y en pantalla.
 * @param {number} color Color del estado.
 * @param {number} t Tiempo de simulación (s): anima chispas y humo.
 */
export function dibujarIcono(g, nombre, cx, cy, color, t = 0) {
  g.fillStyle(COLORES.panel, 0.88);
  g.fillCircle(cx, cy, RADIO_FONDO);
  g.lineStyle(1.5, color, 1);
  g.strokeCircle(cx, cy, RADIO_FONDO);

  const p = (x, y) => ({ x: cx + x, y: cy + y });
  const linea = (x1, y1, x2, y2, ancho = 2) => {
    g.lineStyle(ancho, color, 1);
    g.lineBetween(cx + x1, cy + y1, cx + x2, cy + y2);
  };
  g.fillStyle(color, 1);
  g.lineStyle(2, color, 1);

  switch (nombre) {
    case 'circulo': // vacío
      g.strokeCircle(cx, cy, 4.5);
      break;
    case 'pieza': // caja
      g.fillRect(cx - 4.5, cy - 3, 9, 8);
      g.fillStyle(COLORES.panel, 0.55);
      g.fillRect(cx - 4.5, cy - 0.5, 9, 1.5);
      break;
    case 'chispas': // 3 puntos que saltan
      for (let i = 0; i < 3; i++) {
        const salto = Math.abs(Math.sin(t * 7 + i * 2.1));
        g.fillCircle(cx - 4.5 + i * 4.5, cy + 4 - salto * 8, 1.7);
      }
      break;
    case 'verificacion':
      g.lineStyle(2.5, color, 1);
      g.strokePoints([p(-5, 0), p(-1.5, 4), p(5, -4)], false);
      break;
    case 'rayo': // rayo; el humo sube desde el disco
      g.fillPoints([p(1.5, -7), p(-4.5, 1), p(-0.5, 1), p(-2, 7), p(4.5, -2), p(0.5, -2)], true);
      for (let i = 0; i < 3; i++) {
        const fase = (t * 0.8 + i / 3) % 1; // 0 a 1: el humo sube y se desvanece
        g.fillStyle(COLORES.maquina, 0.7 * (1 - fase));
        g.fillCircle(cx + Math.sin(fase * 6 + i) * 3 + (i - 1) * 3, cy - RADIO_FONDO - fase * 16, 2.5 + fase * 2);
      }
      break;
    case 'casa':
      g.fillPoints([p(-6, 0), p(0, -6), p(6, 0)], true);
      g.fillRect(cx - 4, cy, 8, 5);
      break;
    case 'flechas': // dobles
      g.lineStyle(2, color, 1);
      g.strokePoints([p(-6, -4), p(-2, 0), p(-6, 4)], false);
      g.strokePoints([p(0, -4), p(4, 0), p(0, 4)], false);
      break;
    case 'pinzaCerrada':
      linea(-2, -6, -2, 3, 3);
      linea(2, -6, 2, 3, 3);
      linea(0, 3, 0, 8, 2);
      break;
    case 'pinzaAbierta':
      linea(-7, -6, -3, 3, 3);
      linea(7, -6, 3, 3, 3);
      linea(0, 3, 0, 8, 2);
      break;
    case 'flecha':
      linea(-6, 0, 2, 0, 2.5);
      g.fillPoints([p(6, 0), p(1, -5), p(1, 5)], true);
      break;
    case 'relojArena':
      g.fillPoints([p(-5, -7), p(5, -7), p(0, 0)], true);
      g.lineStyle(1.5, color, 1);
      g.strokePoints([p(-5, 7), p(5, 7), p(0, 0)], true);
      break;
    case 'caja': // caja bajando
      g.lineStyle(2, color, 1);
      g.strokeRect(cx - 5, cy + 0.5, 10, 6.5);
      linea(0, -8, 0, -2, 2);
      g.fillPoints([p(0, 0), p(-3.5, -3.5), p(3.5, -3.5)], true);
      break;
    default:
      throw new Error(`Ícono desconocido: ${nombre}`);
  }
}
