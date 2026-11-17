// Tutorial "Turno 0" (docs/GDD.md, sección 18.5): un mensaje corto y una flecha que rebota señalan cada paso.
// La guía (src/sed/tutorial.js) avanza con el estado real del modelo. Esta escena solo muestra el mensaje y la flecha.
// En el último paso (el deadlock provocado) ofrece reintentar el final o empezar el turno 1.

import { COLORES, TEXTO_HEX } from '../config.js';
import { GuiaTutorial, PASOS } from '../sed/tutorial.js';
import { Partida } from '../sed/partida.js';
import { camaraLogica } from './camara.js';
import { resaltable } from './resaltar.js';

const CAJA = { x: 8, y: 56, ancho: 410, alto: 70 };

export class Tutorial extends Phaser.Scene {
  constructor() {
    super('Tutorial');
  }

  create() {
    camaraLogica(this);
    this.planta = this.scene.get('Planta');
    this.celda = this.planta.celda;
    this.guia = new GuiaTutorial();
    this.activo = true;
    this._mensaje = '';

    const fondo = this.add.graphics();
    fondo.fillStyle(COLORES.panel, 0.94);
    fondo.fillRoundedRect(CAJA.x, CAJA.y, CAJA.ancho, CAJA.alto, 6);
    fondo.lineStyle(2, COLORES.espera, 1);
    fondo.strokeRoundedRect(CAJA.x, CAJA.y, CAJA.ancho, CAJA.alto, 6);
    this.titulo = this.add.text(CAJA.x + 10, CAJA.y + 6, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    this.texto = this.add.text(CAJA.x + 10, CAJA.y + 22, '', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: TEXTO_HEX.texto, wordWrap: { width: CAJA.ancho - 20 } });
    this.salir = this.add
      .text(CAJA.x + CAJA.ancho - 10, CAJA.y + 5, 'Salir del tutorial', { fontFamily: 'Arial', fontSize: '10px', color: '#8794a3', padding: { x: 4, y: 3 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.salir.on('pointerup', () => this._empezarTurno1());
    this.salir.on('pointerover', () => this.salir.setColor(TEXTO_HEX.espera));
    this.salir.on('pointerout', () => this.salir.setColor('#8794a3'));

    // Botones del último paso.
    this.botonesFin = [];
    const boton = (x, ancho, etiqueta, color, accion) => {
      const rect = resaltable(this.add.rectangle(CAJA.x + x, CAJA.y + CAJA.alto + 6, ancho, 44, color).setOrigin(0).setInteractive({ useHandCursor: true })).setVisible(false);
      const t = this.add.text(CAJA.x + x + ancho / 2, CAJA.y + CAJA.alto + 28, etiqueta, { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.texto, align: 'center' }).setOrigin(0.5).setVisible(false);
      rect.on('pointerup', accion);
      this.botonesFin.push(rect, t);
    };
    boton(0, 200, 'Reintentar el final', COLORES.banda, () => this._reintentarFinal());
    boton(208, 202, 'Empezar el turno 1', COLORES.operacion, () => this._empezarTurno1());

    // Flecha que rebota (tween) señalando el objetivo.
    this.flecha = this.add.graphics().setDepth(10);
    this.flecha.fillStyle(COLORES.espera, 1);
    this.flecha.fillTriangle(0, 0, -11, -18, 11, -18);
    this.flecha.fillRect(-4, -34, 8, 17);
    this.flecha.lineStyle(2, COLORES.panel, 1);
    this.flecha.strokeTriangle(0, 0, -11, -18, 11, -18);
    this.flecha.setVisible(false);
    this._rebote = 0;
    this.tweens.add({ targets: this, _rebote: 8, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Con el Inspector abierto esta escena se oculta y no recibe clics (docs/GDD.md, sección 18.21); vuelve al cerrarlo. */
  modoInspector(ocultar) {
    this.scene.setVisible(!ocultar);
    if (this.input) this.input.enabled = !ocultar;
  }

  /** Verdadero si el punto (x, y) cae sobre la caja o sus botones (el clic no llega a la planta). */
  contiene(x, y) {
    return this.activo && x >= CAJA.x && x <= CAJA.x + CAJA.ancho && y >= CAJA.y && y <= CAJA.y + CAJA.alto + (this.guia?.terminado ? 52 : 0);
  }

  /** Posición en pantalla del objetivo del paso actual (o null). */
  _objetivo() {
    const o = this.guia.paso.objetivo;
    const hud = this.scene.get('HUDMaquina');
    if (o.tipo === 'maquina') {
      const e = this.planta.entidades.find((q) => q.id === o.id);
      if (!e) return null;
      const p = e.silueta[0]; // vértice superior
      const q = this.planta.aPantallaLogica(p.x, p.y);
      return { x: q.x, y: q.y - 4 };
    }
    if (o.tipo === 'barra') return this.scene.get('HUDGeneral').posicionControl?.(o.clave) ?? null; // botón de la barra de control
    return null;
  }

  update(tiempo) {
    if (!this.activo) return;
    const hud = this.scene.get('HUDMaquina');
    const ctx = { hud: hud.abierto ? hud.maquinaId : null };
    this.guia.avanzar(this.celda, ctx, tiempo);
    const paso = this.guia.paso;
    const n = PASOS.indexOf(paso) + 1;
    if (paso.mensaje !== this._mensaje) {
      this._mensaje = paso.mensaje;
      this.titulo.setText(`TURNO 0 · PASO ${n} DE ${PASOS.length}`);
      this.texto.setText(paso.mensaje);
      this.texto.setAlpha(0.3);
      this.tweens.add({ targets: this.texto, alpha: 1, duration: 300 });
    }
    const fin = this.guia.terminado;
    this.botonesFin.forEach((o) => o.setVisible(fin));
    this.salir.setVisible(!fin);

    const objetivo = fin ? null : this._objetivo();
    this.flecha.setVisible(!!objetivo);
    if (objetivo) this.flecha.setPosition(objetivo.x, objetivo.y - this._rebote);
  }

  /** Reintentar el final: vuelve al último marcado verde y la guía al paso del deadlock. */
  _reintentarFinal() {
    if (!this.celda.reintentarDesdeVerde()) return;
    this.planta.vistaRed.activa && this.planta.vistaRed.alternar();
    this.guia.irA('deadlock1', this.celda, this.time.now);
    this._mensaje = '';
  }

  _empezarTurno1() {
    this.activo = false;
    this.registry.set('partida', new Partida());
    this.scene.stop('Tutorial');
    this.planta.scene.restart();
  }
}
