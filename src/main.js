// Punto de entrada. Phaser 4.2.1 llega por CDN (objeto global Phaser); no se importa desde npm.

import { ANCHO, ALTO } from './config.js';
import { Arranque } from './escenas/Arranque.js';
import { Titulo } from './escenas/Titulo.js';
import { Planta } from './escenas/Planta.js';
import { HUDMaquina } from './escenas/HUDMaquina.js';
import { Inspector } from './escenas/Inspector.js';
import { HUDGeneral } from './escenas/HUDGeneral.js';
import { Resultados } from './escenas/Resultados.js';

const configuracion = {
  type: Phaser.WEBGL, // WebGL: necesario para los filtros de Phaser 4
  width: ANCHO,
  height: ALTO,
  parent: 'game-container',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT, // se ajusta a la ventana conservando la proporción
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // El orden importa: las escenas de la derecha se dibujan encima (HUD e Inspector sobre la planta).
  scene: [Arranque, Titulo, Planta, HUDMaquina, Inspector, HUDGeneral, Resultados],
};

// Se deja accesible para las pruebas en el navegador (consola y scripts de verificación).
window.juego = new Phaser.Game(configuracion);
