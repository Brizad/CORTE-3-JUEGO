// Pantalla de título. Un clic, un toque o Enter inician la planta.

import { COLORES, TEXTO_HEX, ANCHO, ALTO } from '../config.js';
import { Partida } from '../sed/partida.js';

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

    // Tutorial "Turno 0" (opcional).
    const rect = this.add.rectangle(ANCHO / 2, ALTO / 2 + 140, 300, 46, COLORES.mantenimiento).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
    this.add
      .text(ANCHO / 2, ALTO / 2 + 140, 'Tutorial (Turno 0)', { fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: TEXTO_HEX.texto })
      .setOrigin(0.5);
    this.add
      .text(ANCHO / 2, ALTO / 2 + 176, 'Aprende paso a paso, sin tiempo ni puntos', { fontFamily: 'Arial', fontSize: '12px', color: '#8794a3' })
      .setOrigin(0.5);
    this._tutorial = false;
    rect.on('pointerup', () => {
      this._tutorial = true;
      this._iniciar(true);
    });
    // Un clic en cualquier otro lado inicia la partida normal (se espera un instante por si fue el botón del tutorial).
    this.input.on('pointerup', () => this.time.delayedCall(20, () => { if (!this._tutorial) this._iniciar(false); }));
    this.input.keyboard?.once('keydown-ENTER', () => this._iniciar(false));
    this.input.keyboard?.once('keydown-T', () => this._iniciar(true));
  }

  _iniciar(tutorial) {
    if (this._ya) return;
    this._ya = true;
    this.registry.set('partida', new Partida({ tutorial }));
    this.scene.start('Planta');
  }
}
