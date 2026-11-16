// Pantalla de título (docs/GDD.md, sección 18.8): nombre del juego, integrantes y los botones Jugar, Tutorial y Controles.
// La partida empieza solo con "Jugar" o con Enter; "Tutorial" abre el Turno 0 y "Controles" muestra la tabla de controles.

import { COLORES, TEXTO_HEX, ANCHO, ALTO } from '../config.js';
import { Partida } from '../sed/partida.js';

export const INTEGRANTES = ['Brian Acevedo', 'Brayan Amado', 'Manuel Carvajal'];

// Tabla de controles (docs/GDD.md, sección 13): acción, mouse y teclado, táctil.
export const CONTROLES = [
  ['Abrir el HUD de una máquina', 'Clic en la máquina', 'Toque en la máquina'],
  ['Disparar un evento o una transición', 'Clic en su botón', 'Toque en su botón'],
  ['Pausa', 'P', 'Botón de pausa'],
  ['Inspector (ecuación de estado y árbol)', 'I', 'Botón "Insp."'],
  ['Vista de la red de Petri', 'R', 'Botón "Red"'],
  ['Velocidad x1, x2 y x4', '1, 2, 4', 'Botones x1, x2, x4'],
  ['Consola de reparación', 'H, C, T, R, Retroceso y Enter', 'Botones de comandos'],
  ['Cerrar un panel', 'Esc', 'Botón X'],
  ['Mover la cámara', 'Arrastrar', 'Arrastrar con un dedo'],
  ['Acercar y alejar', 'Rueda del mouse', 'Pellizco con dos dedos'],
  ['Sonidos, contador de fps y demostración', 'M, F1, D', '—'],
];

export class Titulo extends Phaser.Scene {
  constructor() {
    super('Titulo');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORES.panel);
    this.cameras.main.fadeIn(350, 22, 27, 34);
    this._ya = false;
    const t = (x, y, texto, estilo = {}) =>
      this.add.text(x, y, texto, { fontFamily: 'Arial', color: TEXTO_HEX.texto, ...estilo }).setOrigin(0.5);

    t(ANCHO / 2, 120, 'RoboCell Tycoon 2.5D', { fontSize: '50px', fontStyle: 'bold' });
    t(ANCHO / 2, 176, 'Jefe de turno de una celda con 2 CNC, 1 brazo y 2 AGV', { fontSize: '18px', color: TEXTO_HEX.espera });
    t(ANCHO / 2, 238, 'Integrantes', { fontSize: '12px', color: '#8794a3' });
    INTEGRANTES.forEach((n, i) => t(ANCHO / 2, 262 + i * 22, n, { fontSize: '17px', fontStyle: 'bold' }));

    // Botones.
    const boton = (x, etiqueta, color, accion) => {
      const rect = this.add.rectangle(x, 400, 176, 50, color).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
      t(x, 400, etiqueta, { fontSize: '19px', fontStyle: 'bold' });
      rect.on('pointerover', () => rect.setStrokeStyle(3, COLORES.espera, 1));
      rect.on('pointerout', () => rect.setStrokeStyle(2, COLORES.texto, 0.9));
      rect.on('pointerup', accion);
      return rect;
    };
    this.botones = [
      boton(ANCHO / 2 - 196, 'Jugar', COLORES.operacion, () => this._iniciar(false)),
      boton(ANCHO / 2, 'Tutorial', COLORES.mantenimiento, () => this._iniciar(true)),
      boton(ANCHO / 2 + 196, 'Controles', COLORES.banda, () => this._controles(true)),
    ];
    t(ANCHO / 2, 450, 'Enter: jugar   ·   T: tutorial   ·   C: controles', { fontSize: '12px', color: '#8794a3' });

    this._panel();
    this.input.keyboard?.on('keydown-ENTER', () => !this.panel.visible && this._iniciar(false));
    this.input.keyboard?.on('keydown-T', () => !this.panel.visible && this._iniciar(true));
    this.input.keyboard?.on('keydown-C', () => this._controles(!this.panel.visible));
    this.input.keyboard?.on('keydown-ESC', () => this._controles(false));
    this.events.once('shutdown', () => this.input.keyboard?.removeAllListeners());
  }

  /** Panel con la tabla de controles (oculto hasta pulsar "Controles"). */
  _panel() {
    const x0 = 110;
    const y0 = 70;
    const ancho = ANCHO - 220;
    this.panel = this.add.container(0, 0).setVisible(false).setDepth(10);
    const fondo = this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.7).setOrigin(0).setInteractive();
    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 1);
    marco.fillRect(x0, y0, ancho, 380);
    marco.lineStyle(2, COLORES.banda, 1);
    marco.strokeRect(x0, y0, ancho, 380);
    const estilo = (extra = {}) => ({ fontFamily: 'Arial', fontSize: '13px', color: TEXTO_HEX.texto, ...extra });
    const objetos = [fondo, marco, this.add.text(x0 + 16, y0 + 12, 'Controles', estilo({ fontSize: '20px', fontStyle: 'bold' }))];
    ['Acción', 'Mouse y teclado', 'Táctil'].forEach((c, i) => objetos.push(this.add.text(x0 + 16 + [0, 300, 530][i], y0 + 48, c, estilo({ fontStyle: 'bold', color: TEXTO_HEX.espera }))));
    CONTROLES.forEach((fila, r) => fila.forEach((c, i) => objetos.push(this.add.text(x0 + 16 + [0, 300, 530][i], y0 + 76 + r * 24, c, estilo()))));
    const cerrar = this.add.rectangle(x0 + ancho / 2, y0 + 356, 140, 34, COLORES.banda).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
    cerrar.on('pointerup', () => this._controles(false));
    objetos.push(cerrar, this.add.text(x0 + ancho / 2, y0 + 356, 'Cerrar', estilo({ fontStyle: 'bold' })).setOrigin(0.5));
    this.panel.add(objetos);
  }

  _controles(ver) {
    this.panel.setVisible(ver);
  }

  /** Fundido de salida y paso a la planta (con una Partida nueva: normal o tutorial). */
  _iniciar(tutorial) {
    if (this._ya) return;
    this._ya = true;
    this.registry.set('partida', new Partida({ tutorial }));
    this.cameras.main.fadeOut(300, 22, 27, 34);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Planta'));
  }
}
