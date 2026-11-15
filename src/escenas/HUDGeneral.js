// HUD general (escena superpuesta, no la afecta el zoom de la planta).
// - Barra de despacho abajo a la izquierda: "Despachar AGV1" (t1a), "Despachar AGV2" (t2a) y "Controlador de celda" (−150).
// - Radar del Árbol de Cobertura arriba a la derecha (docs/arte.md, sección 8): círculo verde, amarillo parpadeante o rojo
//   y un mini-grafo con los últimos marcados. El nivel lo calcula la Celda con explorar(red, M, 1) tras cada disparo.

import { COLORES, TEXTO_HEX, PUNTOS } from '../config.js';
import { nombreMarcado } from '../sed/cobertura.js';

const BARRA = { x: 8, y: 450, ancho: 412, alto: 82 }; // zona abajo a la izquierda
const BOTON = { alto: 44, y: 484 };
const RADAR = { x: 760, y: 8, ancho: 192, alto: 40 }; // zona arriba a la derecha
const NIVELES = { verde: COLORES.operacion, amarillo: COLORES.espera, rojo: COLORES.fallo };
const NOMBRE_NIVEL = { verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' };

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
    fondo.fillStyle(COLORES.panel, 0.85);
    fondo.fillRect(RADAR.x, RADAR.y, RADAR.ancho, RADAR.alto);
    fondo.lineStyle(1, COLORES.banda, 1);
    fondo.strokeRect(RADAR.x, RADAR.y, RADAR.ancho, RADAR.alto);

    this.titulo = this.add.text(BARRA.x + 8, BARRA.y + 6, '', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: TEXTO_HEX.texto, wordWrap: { width: BARRA.ancho - 16 },
    });
    this.botones = {};
    const crear = (clave, x, ancho, etiqueta, accion) => {
      const rect = this.add.rectangle(x, BOTON.y, ancho, BOTON.alto, COLORES.banda).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.3);
      rect.setInteractive({ useHandCursor: true });
      const texto = this.add
        .text(x + ancho / 2, BOTON.y + BOTON.alto / 2, etiqueta, { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#8794a3', align: 'center' })
        .setOrigin(0.5);
      rect.on('pointerover', () => { this._sobre = clave; });
      rect.on('pointerout', () => { this._sobre = null; });
      rect.on('pointerup', accion);
      this.botones[clave] = { rect, texto, clave: '' };
    };
    crear('AGV1', BARRA.x + 4, 132, 'Despachar AGV1', () => this._despachar('AGV1'));
    crear('AGV2', BARRA.x + 4 + 136, 132, 'Despachar AGV2', () => this._despachar('AGV2'));
    crear('CONTROLADOR', BARRA.x + 4 + 272, 132, 'Controlador\nde celda (−150)', () => this._comprarControlador());
    this._sobre = null;
    this._mensaje = null;

    // Radar.
    this.radarG = this.add.graphics();
    this.radarTitulo = this.add.text(RADAR.x + 38, RADAR.y + 3, 'Radar', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto });
    this.radarMini = this.add.graphics();
    this.radarNombres = [];
    this._claveRadar = '';
  }

  /** Verdadero si el punto (x, y) cae sobre la barra (el clic no llega a la planta). */
  contiene(x, y) {
    return (
      (x >= BARRA.x && x <= BARRA.x + BARRA.ancho && y >= BARRA.y && y <= BARRA.y + BARRA.alto) ||
      (x >= RADAR.x && x <= RADAR.x + RADAR.ancho && y >= RADAR.y && y <= RADAR.y + RADAR.alto)
    );
  }

  /** Texto que explica por qué un AGV no se puede despachar (AND-join: qué ficha falta). */
  _explicar(agv) {
    const c = this.celda;
    const motivo = c.evaluar(agv, 'reservar');
    if (motivo === null) return `${agv} puede salir: consume AGV${agv.slice(-1)}_listo y ${agv === 'AGV1' ? 'Mesa_libre' : 'Robot_libre'}.`;
    if (motivo === 'indefinido') return `${agv} no está Libre (ahora: ${c.estado(agv)}).`;
    if (motivo === 'celda') return 'Controlador de celda activo: falta Celda_libre (el otro AGV está en la celda).';
    const falta = c.faltaPara(agv, 'reservar');
    return `${agv} no puede salir: falta ${falta.join(', ') || 'un recurso'}.`;
  }

  _despachar(agv) {
    const r = this.celda.solicitar(agv, 'reservar');
    if (!r.ok) this._mensaje = { texto: this._explicar(agv), hasta: this.time.now + 3000 };
  }

  _comprarControlador() {
    const r = this.celda.comprarControlador();
    if (!r.ok) this._mensaje = { texto: this._explicarControlador(), hasta: this.time.now + 3000 };
  }

  _explicarControlador() {
    const c = this.celda;
    if (c.controlador) return 'Controlador de celda activo: Celda_libre deja pasar a un solo AGV a la vez. Dura solo este turno.';
    if (c.deadlock) return 'No se puede comprar en el marcado muerto.';
    return `Controlador de celda: agrega el lugar monitor Celda_libre (p10). Cuesta ${PUNTOS.controlador} puntos y dura solo este turno.`;
  }

  update() {
    const c = this.celda;
    const pedidos = c.pedidos.length;
    const masAntiguo = pedidos ? Math.floor(c.reloj.ahora - c.pedidos[0].t) : 0;
    let texto = `Pedidos pendientes: ${pedidos}${pedidos ? ` (el más antiguo: ${masAntiguo} s de 30 s)` : ''}`;
    if (this._sobre === 'CONTROLADOR') texto = this._explicarControlador();
    else if (this._sobre) texto = this._explicar(this._sobre);
    else if (this._mensaje && this._mensaje.hasta > this.time.now) texto = this._mensaje.texto;
    this.titulo.setText(texto);

    for (const [clave, b] of Object.entries(this.botones)) {
      const posible = clave === 'CONTROLADOR' ? !c.controlador && !c.deadlock : c.evaluar(clave, 'reservar') === null;
      const activo = clave === 'CONTROLADOR' && c.controlador;
      const estado = `${posible}|${activo}`;
      if (estado === b.clave) continue;
      b.clave = estado;
      b.rect.setFillStyle(activo ? COLORES.mantenimiento : posible ? COLORES.operacion : COLORES.banda).setStrokeStyle(2, COLORES.texto, posible || activo ? 0.9 : 0.3);
      b.texto.setColor(posible || activo ? TEXTO_HEX.texto : '#8794a3');
      if (clave === 'CONTROLADOR') b.texto.setText(activo ? 'Controlador\nactivo' : 'Controlador\nde celda (−150)');
    }
    this._dibujarRadar();
  }

  /** Radar: círculo de 32 px (verde fijo, amarillo a 2 Hz, rojo fijo) y el mini-grafo de los últimos marcados. */
  _dibujarRadar() {
    const c = this.celda;
    const nivel = c.radar.nivel;
    const parpadeo = nivel === 'amarillo' ? Math.floor(this.time.now / 250) % 2 === 0 : true; // 2 Hz
    const cx = RADAR.x + 22;
    const cy = RADAR.y + RADAR.alto / 2;
    const g = this.radarG;
    g.clear();
    g.fillStyle(NIVELES[nivel], parpadeo ? 1 : 0.25);
    g.fillCircle(cx, cy, 16);
    g.lineStyle(2, COLORES.texto, 0.9);
    g.strokeCircle(cx, cy, 16);
    this.radarTitulo.setText(`Radar: ${NOMBRE_NIVEL[nivel]}`);

    // Mini-grafo de los últimos 5 marcados: cada nodo con el color del radar en ese marcado.
    const ultimos = c.historialMarcados.slice(-5);
    const clave = ultimos.map((h) => `${h.M.join('')}${h.nivel}`).join('|');
    if (clave !== this._claveRadar) {
      this._claveRadar = clave;
      this.radarNombres.forEach((t) => t.destroy());
      this.radarNombres = [];
      const m = this.radarMini;
      m.clear();
      const x0 = RADAR.x + 44;
      const paso = 29;
      ultimos.forEach((h, i) => {
        const x = x0 + i * paso;
        const y = RADAR.y + 28;
        if (i > 0) {
          m.lineStyle(1.5, COLORES.maquina, 1);
          m.lineBetween(x - paso + 11, y, x - 3, y);
          m.fillStyle(COLORES.maquina, 1);
          m.fillTriangle(x - 3, y, x - 8, y - 3, x - 8, y + 3);
        }
        m.fillStyle(NIVELES[h.nivel], 1);
        m.fillRoundedRect(x - 11, y - 7, 22, 14, 3);
        if (i === ultimos.length - 1) {
          m.lineStyle(2, COLORES.texto, 1);
          m.strokeRoundedRect(x - 11, y - 7, 22, 14, 3);
        }
        const t = this.add.text(x, y, nombreMarcado(h.M) ?? '·', { fontFamily: 'Arial', fontSize: '8px', fontStyle: 'bold', color: '#161b22' }).setOrigin(0.5);
        this.radarNombres.push(t);
      });
    }
  }
}
