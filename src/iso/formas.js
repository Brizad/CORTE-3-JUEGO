// Formas isométricas dibujadas en código (docs/arte.md, secciones 2 y 4).
// Luz desde arriba a la izquierda: cara superior = color base, cara izquierda −20 %, cara derecha −35 %.

import { aPantalla } from './proyeccion.js';

/** Oscurece un color 0xRRGGBB. factor 0.2 = 20 % más oscuro. */
export function oscurecer(color, factor) {
  const k = 1 - factor;
  const r = Math.round(((color >> 16) & 0xff) * k);
  const g = Math.round(((color >> 8) & 0xff) * k);
  const b = Math.round((color & 0xff) * k);
  return (r << 16) | (g << 8) | b;
}

/** Aclara un color 0xRRGGBB mezclándolo con blanco. factor 0.2 = 20 % hacia el blanco. */
export function aclarar(color, factor) {
  const f = (c) => Math.round(c + (255 - c) * factor);
  return (f((color >> 16) & 0xff) << 16) | (f((color >> 8) & 0xff) << 8) | f(color & 0xff);
}

/**
 * Puntos de un prisma que ocupa [x, x+ancho] por [y, y+fondo] en la rejilla y mide alto px.
 * A es el vértice de atrás, B el derecho, C el de adelante y D el izquierdo (en la base).
 */
export function puntosPrisma(x, y, ancho, fondo, alto) {
  const A = aPantalla(x, y);
  const B = aPantalla(x + ancho, y);
  const C = aPantalla(x + ancho, y + fondo);
  const D = aPantalla(x, y + fondo);
  const sube = (p) => ({ x: p.x, y: p.y - alto });
  return { A, B, C, D, At: sube(A), Bt: sube(B), Ct: sube(C), Dt: sube(D) };
}

/**
 * Dibuja un prisma isométrico en un Graphics de Phaser.
 * @param {Phaser.GameObjects.Graphics} g Objeto gráfico.
 * @param {object} pr Resultado de puntosPrisma().
 * @param {number} color Color base (cara superior).
 */
export function dibujarPrisma(g, pr, color) {
  // Cara izquierda (mira hacia adelante-izquierda): −20 %.
  g.fillStyle(oscurecer(color, 0.2), 1);
  g.fillPoints([pr.D, pr.C, pr.Ct, pr.Dt], true);
  // Cara derecha (mira hacia adelante-derecha): −35 %.
  g.fillStyle(oscurecer(color, 0.35), 1);
  g.fillPoints([pr.C, pr.B, pr.Bt, pr.Ct], true);
  // Cara superior: color base.
  g.fillStyle(color, 1);
  g.fillPoints([pr.At, pr.Bt, pr.Ct, pr.Dt], true);
}

/** Silueta del prisma (hexágono) para detectar clics y dibujar el borde. */
export function siluetaPrisma(pr) {
  return [pr.At, pr.Bt, pr.B, pr.C, pr.D, pr.Dt];
}

/** Indica si el punto (px, py) cae dentro del polígono (algoritmo de cruce de rayos). */
export function puntoEnPoligono(px, py, puntos) {
  let dentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const a = puntos[i];
    const b = puntos[j];
    const cruza = a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}
