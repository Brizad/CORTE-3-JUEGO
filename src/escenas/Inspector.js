// Inspector: escena superpuesta que se abre con la tecla I. Por ahora solo el marco vacío.
// Después mostrará el marcado M, las transiciones habilitadas, los autómatas y el árbol de cobertura.

import { COLORES, TEXTO_HEX } from '../config.js';

const PANEL = { x: 20, y: 96, ancho: 300, alto: 260 };

export class Inspector extends Phaser.Scene {
  constructor() {
    super('Inspector');
  }

  create() {
    this.abierto = false;
    this.contenedor = this.add.container(PANEL.x, PANEL.y).setVisible(false);

    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.9);
    marco.fillRect(0, 0, PANEL.ancho, PANEL.alto);
    marco.lineStyle(2, COLORES.banda, 1);
    marco.strokeRect(0, 0, PANEL.ancho, PANEL.alto);

    const titulo = this.add.text(12, 10, 'Inspector', {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: TEXTO_HEX.texto,
    });
    this.contenedor.add([marco, titulo]);
  }

  /** Abre o cierra el panel. */
  alternar() {
    if (this.abierto) this.cerrar();
    else this.abrir();
  }

  abrir() {
    this.contenedor.setVisible(true);
    this.abierto = true;
  }

  cerrar() {
    this.contenedor.setVisible(false);
    this.abierto = false;
  }

  /** Verdadero si el punto (x, y) cae sobre el panel abierto. */
  contiene(x, y) {
    return (
      this.abierto &&
      x >= PANEL.x && x <= PANEL.x + PANEL.ancho &&
      y >= PANEL.y && y <= PANEL.y + PANEL.alto
    );
  }
}
