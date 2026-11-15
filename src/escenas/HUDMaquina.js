// HUD de máquina: escena superpuesta. Por ahora solo el marco vacío.
// Se llena en la fase del modelo (grafo del autómata, botones de eventos y consola de reparación).

import { COLORES, TEXTO_HEX } from '../config.js';

const PANEL = { x: 640, y: 96, ancho: 300, alto: 220 }; // docs/arte.md, sección 7

export class HUDMaquina extends Phaser.Scene {
  constructor() {
    super('HUDMaquina');
  }

  create() {
    this.abierto = false;
    this.contenedor = this.add.container(PANEL.x, PANEL.y).setVisible(false);

    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.9);
    marco.fillRect(0, 0, PANEL.ancho, PANEL.alto);
    marco.lineStyle(2, COLORES.banda, 1);
    marco.strokeRect(0, 0, PANEL.ancho, PANEL.alto);

    this.titulo = this.add.text(12, 10, '', {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: TEXTO_HEX.texto,
    });
    this.contenedor.add([marco, this.titulo]);
  }

  /** Abre el panel para una máquina. */
  abrir(id, nombre) {
    this.maquinaId = id;
    this.titulo.setText(nombre ?? id);
    this.contenedor.setVisible(true);
    this.abierto = true;
  }

  /** Cierra el panel. */
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
