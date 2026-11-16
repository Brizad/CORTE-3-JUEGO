// Escena de arranque: crea los servicios compartidos (reloj y aleatorio) y pasa al título.
// Las máquinas y los tokens se dibujan en código, así que no hay recursos que cargar.

import { COLORES, TEXTO_HEX, ANCHO, ALTO, SEMILLA, VELOCIDADES } from '../config.js';
import { Reloj } from '../sed/reloj.js';
import { crearAleatorio } from '../sed/aleatorio.js';
import { Partida } from '../sed/partida.js';
import { Sonidos } from '../audio/sonidos.js';
import { camaraLogica } from './camara.js';

export class Arranque extends Phaser.Scene {
  constructor() {
    super('Arranque');
  }

  create() {
    camaraLogica(this);
    // Servicios compartidos por todas las escenas (se guardan en el registro del juego).
    this.registry.set('reloj', new Reloj({ velocidades: VELOCIDADES }));
    this.registry.set('aleatorio', crearAleatorio(SEMILLA));
    this.registry.set('partida', new Partida()); // turno, puntaje acumulado y logros de toda la partida
    this.registry.set('sonidos', new Sonidos());

    this.cameras.main.setBackgroundColor(COLORES.panel);
    this.add
      .text(ANCHO / 2, ALTO / 2, 'Cargando…', { fontFamily: 'Arial', fontSize: '20px', color: TEXTO_HEX.texto })
      .setOrigin(0.5);

    this.scene.start('Titulo');
  }
}
