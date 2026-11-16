// Punto de entrada. Phaser 4.2.1 llega por CDN (objeto global Phaser); no se importa desde npm.

import { ANCHO, ALTO, RES } from './config.js';
import { Arranque } from './escenas/Arranque.js';
import { Titulo } from './escenas/Titulo.js';
import { Planta } from './escenas/Planta.js';
import { HUDMaquina } from './escenas/HUDMaquina.js';
import { Inspector } from './escenas/Inspector.js';
import { HUDGeneral } from './escenas/HUDGeneral.js';
import { GameOver } from './escenas/GameOver.js';
import { Tutorial } from './escenas/Tutorial.js';
import { Resultados } from './escenas/Resultados.js';
import { MenuPausa } from './escenas/MenuPausa.js';
import { Ayuda } from './escenas/Ayuda.js';

// Textos nítidos al agrandar: resolución del texto = densidad de pantalla (mínimo 2).
const RESOLUCION_TEXTO = RES;
const crearTexto = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, texto, estilo) {
  return crearTexto.call(this, x, y, texto, { resolution: RESOLUCION_TEXTO, ...estilo });
};

const configuracion = {
  type: Phaser.WEBGL, // WebGL: necesario para los filtros de Phaser 4
  width: ANCHO * RES,
  height: ALTO * RES,
  render: { antialias: true, roundPixels: false },
  parent: 'game-container',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT, // se ajusta a la ventana conservando la proporción
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // El orden importa: las escenas de la derecha se dibujan encima (HUD e Inspector sobre la planta).
  scene: [Arranque, Titulo, Planta, HUDMaquina, Inspector, HUDGeneral, Tutorial, GameOver, Resultados, MenuPausa, Ayuda],
};

// Se deja accesible para las pruebas en el navegador (consola y scripts de verificación).
window.juego = new Phaser.Game(configuracion);
