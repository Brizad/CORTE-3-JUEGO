// Pantalla de título. Un clic, un toque o Enter inician la planta.

import { COLORES, TEXTO_HEX, ANCHO, ALTO } from '../config.js';

export class Titulo extends Phaser.Scene {
  constructor() {
    super('Titulo');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORES.panel);

    this.add
      .text(ANCHO / 2, ALTO / 2 - 40, 'RoboCell Tycoon 2.5D', {
        fontFamily: 'Arial',
        fontSize: '48px',
        fontStyle: 'bold',
        color: TEXTO_HEX.texto,
      })
      .setOrigin(0.5);

    this.add
      .text(ANCHO / 2, ALTO / 2 + 10, 'Jefe de turno de una celda con 2 CNC, 1 brazo y 2 AGV', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: TEXTO_HEX.espera,
      })
      .setOrigin(0.5);

    const aviso = this.add
      .text(ANCHO / 2, ALTO / 2 + 80, 'Haz clic, toca la pantalla o pulsa Enter para empezar', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: TEXTO_HEX.texto,
      })
      .setOrigin(0.5);
    // Parpadeo suave del aviso.
    this.tweens.add({ targets: aviso, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });

    this.input.once('pointerup', () => this._iniciar());
    this.input.keyboard?.once('keydown-ENTER', () => this._iniciar());
  }

  _iniciar() {
    this.scene.start('Planta');
  }
}
