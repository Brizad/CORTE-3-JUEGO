// Borde resaltado al pasar el mouse por algo clicable (docs/GDD.md, sección 18.19). El cursor de mano lo pone setInteractive({ useHandCursor: true }).
// El borde "de base" se guarda en el objeto: así el resaltado no pisa el borde que cada escena le da según su estado.

import { COLORES } from '../config.js';

const RESALTE = [3, COLORES.espera, 1];

/** Hace que un rectángulo (u otra forma con setStrokeStyle) se resalte con el puntero encima. base = [grosor, color, alfa]. */
export function resaltable(forma, base = [2, COLORES.texto, 0.9]) {
  forma._base = base;
  forma._encima = false;
  forma.setStrokeStyle(...base);
  forma.on('pointerover', () => {
    forma._encima = true;
    forma.setStrokeStyle(...RESALTE);
  });
  forma.on('pointerout', () => {
    forma._encima = false;
    forma.setStrokeStyle(...forma._base);
  });
  return forma;
}

/** Cambia el borde de base de una forma resaltable (se aplica enseguida si el puntero no está encima). */
export function fijarBorde(forma, grosor, color, alfa) {
  forma._base = [grosor, color, alfa];
  if (!forma._encima) forma.setStrokeStyle(grosor, color, alfa);
}
