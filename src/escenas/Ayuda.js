// Ayuda corta (docs/GDD.md, sección 18.13): controles y leyenda de colores y del radar. Se abre con "?" o desde el menú de pausa.
// Mientras está abierta (si no viene del menú) la simulación queda en pausa.

import { COLORES, TEXTO_HEX } from '../config.js';
import { CONTROLES, LEYENDA, LEYENDA_RADAR } from '../textos.js';
import { camaraLogica } from './camara.js';

const PANEL = { x: 40, y: 24, ancho: 880, alto: 492 };

export class Ayuda extends Phaser.Scene {
  constructor() {
    super('Ayuda');
  }

  create() {
    camaraLogica(this);
    this.planta = this.scene.get('Planta');
    this.abierto = true;
    const reloj = this.planta.reloj;
    this._pausaPrevia = reloj.enPausa;
    reloj.pausar();

    const velo = this.add.rectangle(0, 0, 960, 540, 0x000000, 0.7).setOrigin(0).setInteractive();
    velo.on('pointerup', () => {});
    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.98);
    marco.fillRect(PANEL.x, PANEL.y, PANEL.ancho, PANEL.alto);
    marco.lineStyle(3, COLORES.mantenimiento, 1);
    marco.strokeRect(PANEL.x, PANEL.y, PANEL.ancho, PANEL.alto);

    const texto = (x, y, t, estilo = {}) => this.add.text(x, y, t, { fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto, ...estilo });
    texto(PANEL.x + 20, PANEL.y + 12, 'Ayuda', { fontSize: '22px', fontStyle: 'bold' });

    // Columna izquierda: controles.
    const xi = PANEL.x + 20;
    texto(xi, PANEL.y + 50, 'Controles', { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    CONTROLES.forEach(([accion, mouse, tactil], i) => {
      const y = PANEL.y + 74 + i * 29;
      texto(xi, y, accion, { fontStyle: 'bold' });
      texto(xi, y + 13, `${mouse}  ·  ${tactil}`, { fontSize: '11px', color: '#8794a3' });
    });

    // Columna derecha: leyenda de colores y del radar.
    const xd = PANEL.x + 450;
    const ancho = PANEL.ancho - 470;
    texto(xd, PANEL.y + 50, 'Colores', { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    let y = PANEL.y + 74;
    const fila = ([clave, frase]) => {
      this.add.rectangle(xd, y + 2, 14, 14, COLORES[clave]).setOrigin(0).setStrokeStyle(1, COLORES.texto, 0.8);
      const t = texto(xd + 22, y, frase, { wordWrap: { width: ancho - 22 }, lineSpacing: 2 });
      y += Math.max(26, t.height + 8);
    };
    LEYENDA.forEach(fila);
    y += 8;
    texto(xd, y, 'Radar (arriba a la derecha)', { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    y += 24;
    LEYENDA_RADAR.forEach(fila);

    const cerrar = this.add.rectangle(PANEL.x + PANEL.ancho - 160, PANEL.y + PANEL.alto - 56, 140, 44, COLORES.operacion).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
    this.add.text(PANEL.x + PANEL.ancho - 90, PANEL.y + PANEL.alto - 34, 'Cerrar', { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
    cerrar.on('pointerup', () => this.cerrar());
    texto(xd, PANEL.y + PANEL.alto - 34, '? o Esc: cerrar', { fontSize: '11px', color: '#8794a3' });
    this.events.once('shutdown', () => (this.abierto = false));
  }

  contiene() {
    return this.abierto;
  }

  /** Cierra la ayuda y devuelve la simulación a como estaba. */
  cerrar() {
    if (!this.abierto) return;
    this.abierto = false;
    const c = this.planta.celda;
    const menu = this.scene.get('MenuPausa');
    const desdeMenu = menu?.scene.isActive() && menu.abierto;
    if (!this._pausaPrevia && !desdeMenu && !c.deadlock && !c.terminado) this.planta.reloj.reanudar();
    this.scene.stop('Ayuda');
  }
}
