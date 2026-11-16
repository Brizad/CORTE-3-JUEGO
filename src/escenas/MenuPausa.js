// Menú de pausa (docs/GDD.md, sección 18.14): Continuar, Reiniciar turno, Ayuda, Silenciar sonido y Volver al título.
// Se abre con P (o el botón de pausa) y detiene el reloj de simulación mientras está abierto. No cambia reglas ni modelo.

import { COLORES, TEXTO_HEX, ANCHO } from '../config.js';
import { camaraLogica } from './camara.js';

const PANEL = { ancho: 340, alto: 352, y: 78 };
const BOTON = { alto: 46, paso: 54 };

export class MenuPausa extends Phaser.Scene {
  constructor() {
    super('MenuPausa');
  }

  create() {
    camaraLogica(this);
    this.planta = this.scene.get('Planta');
    this.abierto = true;
    const reloj = this.planta.reloj;
    this._pausaPrevia = reloj.enPausa;
    reloj.pausar();

    const x0 = (ANCHO - PANEL.ancho) / 2;
    const velo = this.add.rectangle(0, 0, ANCHO, 540, 0x000000, 0.6).setOrigin(0).setInteractive();
    velo.on('pointerup', () => {});
    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.98);
    marco.fillRect(x0, PANEL.y, PANEL.ancho, PANEL.alto);
    marco.lineStyle(3, COLORES.espera, 1);
    marco.strokeRect(x0, PANEL.y, PANEL.ancho, PANEL.alto);
    this.add.text(ANCHO / 2, PANEL.y + 26, 'Pausa', { fontFamily: 'Arial', fontSize: '24px', fontStyle: 'bold', color: TEXTO_HEX.espera }).setOrigin(0.5);

    this.botones = [];
    const acciones = [
      ['Continuar', COLORES.operacion, () => this.cerrar()],
      ['Reiniciar turno', COLORES.mantenimiento, () => this._reiniciar()],
      ['Ayuda', COLORES.banda, () => this.planta.events.emit('ayuda')],
      [this._etiquetaSonido(), COLORES.banda, () => this._sonido()],
      ['Volver al título', COLORES.fallo, () => this._titulo()],
    ];
    acciones.forEach(([etiqueta, color, accion], i) => {
      const y = PANEL.y + 56 + i * BOTON.paso;
      const rect = this.add.rectangle(x0 + 20, y, PANEL.ancho - 40, BOTON.alto, color).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
      const texto = this.add.text(ANCHO / 2, y + BOTON.alto / 2, etiqueta, { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
      rect.on('pointerup', accion);
      this.botones.push({ rect, texto });
    });
    this.add.text(ANCHO / 2, PANEL.y + PANEL.alto - 14, 'P o Esc: continuar', { fontFamily: 'Arial', fontSize: '11px', color: '#8794a3' }).setOrigin(0.5);
    this.events.once('shutdown', () => (this.abierto = false));
  }

  /** Verdadero mientras el menú está abierto: bloquea los clics de abajo. */
  contiene() {
    return this.abierto;
  }

  _etiquetaSonido() {
    return this.planta.sonidos.silenciado ? 'Activar sonido' : 'Silenciar sonido';
  }

  _sonido() {
    this.planta.sonidos.alternarSilencio();
    this.botones[3].texto.setText(this._etiquetaSonido());
  }

  /** Cierra el menú y reanuda la simulación (si no estaba en pausa antes y el turno sigue en marcha). */
  cerrar() {
    if (!this.abierto) return;
    this.abierto = false;
    const c = this.planta.celda;
    if (!this._pausaPrevia && !c.deadlock && !c.terminado) this.planta.reloj.reanudar();
    this.scene.stop('Ayuda');
    this.scene.stop('MenuPausa');
  }

  /** Vuelve a empezar el turno actual con la misma semilla (el puntaje de antes del turno se conserva). */
  _reiniciar() {
    this.abierto = false;
    this.planta.scene.restart();
  }

  _titulo() {
    this.abierto = false;
    this.planta.scene.start('Titulo');
  }
}
