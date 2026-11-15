// Proyección isométrica 2:1. Sin Phaser ni DOM.
// La celda (x, y) tiene su vértice superior en aPantalla(x, y). Las coordenadas pueden ser fraccionarias.

import { TILE_W, TILE_H, ORIGEN } from '../config.js';

/**
 * Convierte coordenadas de rejilla (x, y) y altura z (px) a pantalla.
 * @returns {{x:number, y:number}} Posición en píxeles del juego.
 */
export function aPantalla(x, y, z = 0) {
  return {
    x: ORIGEN.x + ((x - y) * TILE_W) / 2,
    y: ORIGEN.y + ((x + y) * TILE_H) / 2 - z,
  };
}

/**
 * Convierte un punto de pantalla (px, py) a la celda de la rejilla que lo contiene.
 * Devuelve la celda entera (x, y) y las coordenadas fraccionarias (fx, fy).
 */
export function aCelda(px, py) {
  const dx = (px - ORIGEN.x) / (TILE_W / 2);
  const dy = (py - ORIGEN.y) / (TILE_H / 2);
  const fx = (dy + dx) / 2;
  const fy = (dy - dx) / 2;
  return { x: Math.floor(fx), y: Math.floor(fy), fx, fy };
}

/**
 * Valor de profundidad para ordenar el dibujo: más grande se dibuja encima.
 * Se ordena por (x + y). La altura z solo desempata.
 */
export function profundidad(x, y, z = 0) {
  return x + y + z * 0.001;
}
