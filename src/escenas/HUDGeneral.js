// HUD general (escena superpuesta, no la afecta el zoom de la planta). Por ahora: la barra fija de despacho de AGV
// abajo a la izquierda (zona de "fichas por lugar", docs/arte.md sección 8) con "Despachar AGV1" y "Despachar AGV2".
// Los botones piden t1a / t2a (evento reservar) a la Celda: se ejecutan por δ y por la red solo si hay fichas.

import { COLORES, TEXTO_HEX } from '../config.js';

const BARRA = { x: 8, y: 450, ancho: 412, alto: 82 }; // zona abajo a la izquierda
const BOTON = { ancho: 200, alto: 44, y: 484 };

export class HUDGeneral extends Phaser.Scene {
  constructor() {
    super('HUDGeneral');
  }

  create() {
    this.planta = this.scene.get('Planta');
    this.celda = this.planta.celda;
    const fondo = this.add.graphics();
    fondo.fillStyle(COLORES.panel, 0.85);
    fondo.fillRect(BARRA.x, BARRA.y, BARRA.ancho, BARRA.alto);
    fondo.lineStyle(1, COLORES.banda, 1);
    fondo.strokeRect(BARRA.x, BARRA.y, BARRA.ancho, BARRA.alto);

    this.titulo = this.add.text(BARRA.x + 8, BARRA.y + 6, '', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: TEXTO_HEX.texto, wordWrap: { width: BARRA.ancho - 16 },
    });
    this.botones = {};
    ['AGV1', 'AGV2'].forEach((agv, i) => {
      const x = BARRA.x + 4 + i * (BOTON.ancho + 4);
      const rect = this.add.rectangle(x, BOTON.y, BOTON.ancho, BOTON.alto, COLORES.banda).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.3);
      rect.setInteractive({ useHandCursor: true });
      const texto = this.add
        .text(x + BOTON.ancho / 2, BOTON.y + BOTON.alto / 2, `Despachar ${agv}`, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#8794a3' })
        .setOrigin(0.5);
      rect.on('pointerover', () => { this._sobre = agv; });
      rect.on('pointerout', () => { this._sobre = null; });
      rect.on('pointerup', () => this._despachar(agv));
      this.botones[agv] = { rect, texto, clave: '' };
    });
    this._sobre = null;
    this._mensaje = null;
  }

  /** Verdadero si el punto (x, y) cae sobre la barra (el clic no llega a la planta). */
  contiene(x, y) {
    return x >= BARRA.x && x <= BARRA.x + BARRA.ancho && y >= BARRA.y && y <= BARRA.y + BARRA.alto;
  }

  /** Texto que explica por qué un AGV no se puede despachar (AND-join: qué ficha falta). */
  _explicar(agv) {
    const c = this.celda;
    const motivo = c.evaluar(agv, 'reservar');
    if (motivo === null) return `${agv} puede salir: consume AGV${agv.slice(-1)}_listo y ${agv === 'AGV1' ? 'Mesa_libre' : 'Robot_libre'}.`;
    if (motivo === 'indefinido') return `${agv} no está Libre (ahora: ${c.estado(agv)}).`;
    const falta = c.faltaPara(agv, 'reservar');
    return `${agv} no puede salir: falta ${falta.join(', ') || 'un recurso'}.`;
  }

  _despachar(agv) {
    const r = this.celda.solicitar(agv, 'reservar');
    if (!r.ok) this._mensaje = { texto: this._explicar(agv), hasta: this.time.now + 3000 };
  }

  update() {
    const c = this.celda;
    const pedidos = c.pedidos.length;
    const masAntiguo = pedidos ? Math.floor(c.reloj.ahora - c.pedidos[0].t) : 0;
    let texto = `Pedidos pendientes: ${pedidos}${pedidos ? ` (el más antiguo: ${masAntiguo} s de 30 s)` : ''}`;
    if (this._sobre) texto = this._explicar(this._sobre);
    else if (this._mensaje && this._mensaje.hasta > this.time.now) texto = this._mensaje.texto;
    this.titulo.setText(texto);

    for (const [agv, b] of Object.entries(this.botones)) {
      const posible = c.evaluar(agv, 'reservar') === null;
      const clave = String(posible);
      if (clave === b.clave) continue;
      b.clave = clave;
      b.rect.setFillStyle(posible ? COLORES.operacion : COLORES.banda).setStrokeStyle(2, COLORES.texto, posible ? 0.9 : 0.3);
      b.texto.setColor(posible ? TEXTO_HEX.texto : '#8794a3');
    }
  }
}
