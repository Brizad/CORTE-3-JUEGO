// Zona de alertas del HUD general: abajo a la derecha, x 540 a 952 y y 450 a 532 (docs/arte.md, sección 8).
// Muestra los últimos avisos del núcleo (falla del husillo, puntos de la reparación, ayuda...).

import { COLORES, TEXTO_HEX } from '../config.js';

const ZONA = { x: 540, y: 450, ancho: 412, alto: 82 };
const LINEAS = 4;
const DURACION = 9000; // ms de reloj de pared que dura cada aviso en pantalla

export class Alertas {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   */
  constructor(escena, celda) {
    this.escena = escena;
    this.celda = celda;
    this.avisos = []; // {texto, color, hasta}
    this.fondo = escena.add.graphics().setDepth(90).setScrollFactor(0);
    this.fondo.fillStyle(COLORES.panel, 0.75);
    this.fondo.fillRect(ZONA.x, ZONA.y, ZONA.ancho, ZONA.alto);
    this.fondo.lineStyle(1, COLORES.banda, 1);
    this.fondo.strokeRect(ZONA.x, ZONA.y, ZONA.ancho, ZONA.alto);
    this.textos = [];
    for (let i = 0; i < LINEAS; i++) {
      this.textos.push(
        escena.add
          .text(ZONA.x + 8, ZONA.y + 5 + i * 19, '', { fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto })
          .setDepth(91)
          .setScrollFactor(0),
      );
    }
    this._baja = celda.alCambiar((e) => this._alEvento(e));
  }

  /** Agrega un aviso. color: 'texto', 'espera', 'fallo' u 'operacion'. */
  avisar(texto, color = 'texto') {
    this.avisos.push({ texto, color: TEXTO_HEX[color] ?? TEXTO_HEX.texto, hasta: this.escena.time.now + DURACION });
    if (this.avisos.length > LINEAS) this.avisos.shift();
  }

  _alEvento(e) {
    if (e.tipo === 'automata' && e.evento === 'falla_husillo') {
      this.avisar(`${e.maquina}: falla del husillo. Abre su HUD y repárala (H, C, T, R).`, 'fallo');
    } else if (e.tipo === 'puntos') {
      const signo = e.puntos > 0 ? '+' : '';
      this.avisar(`${e.maquina ? `${e.maquina}: ` : ''}${signo}${e.puntos} puntos (${e.motivo})`, e.puntos > 0 ? 'operacion' : 'espera');
    } else if (e.tipo === 'rechazo' && e.motivo === 'supervisor') {
      this.avisar(`Bloqueado: ${this.celda.razonSupervisor}`, 'fallo');
    } else if (e.tipo === 'deadlock') {
      this.avisar('DEADLOCK: ninguna transición está habilitada.', 'fallo');
    }
  }

  /** Por cuadro: quita los avisos vencidos y dibuja el resto. */
  actualizar() {
    const ahora = this.escena.time.now;
    this.avisos = this.avisos.filter((a) => a.hasta > ahora);
    this.textos.forEach((t, i) => {
      const a = this.avisos[i];
      t.setText(a ? a.texto : '');
      if (a) t.setColor(a.color);
    });
  }

  destruir() {
    this._baja();
    this.fondo.destroy();
    this.textos.forEach((t) => t.destroy());
  }
}
