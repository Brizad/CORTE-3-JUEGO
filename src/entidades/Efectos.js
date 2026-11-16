// Efectos de Phaser 4 de la planta (docs/GDD.md, sección 18.9). Ninguno cambia reglas: solo muestran lo que ya pasó en el modelo.
//  - Partículas: chispas en la CNC mientras fresa y humo en la CNC en Falla.
//  - Bloom de la cámara unos instantes al fallar el husillo y en el deadlock.
//  - Glow en la máquina seleccionada (la que tiene el HUD abierto).
// Phaser llega por CDN: aquí se usa el objeto global Phaser (nunca import).

import { COLORES, POSICIONES, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';

const CNCS = ['CNC1', 'CNC2'];

export class Efectos {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   * @param {() => object[]} entidades Función que devuelve las entidades de las máquinas.
   */
  constructor(escena, celda, entidades) {
    this.escena = escena;
    this.celda = celda;
    this.entidades = entidades;

    // Textura de un punto blanco para las partículas (se tiñe con tint).
    if (!escena.textures.exists('punto')) {
      const g = escena.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(5, 5, 5);
      g.generateTexture('punto', 10, 10);
      g.destroy();
    }
    this.emisores = {};
    for (const cnc of CNCS) {
      const p = POSICIONES[cnc];
      const c = aPantalla(p.x + 0.5, p.y + 0.5, ALTOS.CNC);
      const chispas = escena.add.particles(c.x, c.y - 14, 'punto', {
        speed: { min: 40, max: 110 }, angle: { min: -140, max: -40 }, gravityY: 260, lifespan: { min: 260, max: 520 },
        scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, tint: COLORES.espera, blendMode: 'ADD',
        frequency: 60, quantity: 2, emitting: false,
      }).setDepth(290);
      const humo = escena.add.particles(c.x, c.y - 10, 'punto', {
        speed: { min: 8, max: 22 }, angle: { min: -100, max: -80 }, lifespan: { min: 900, max: 1500 },
        scale: { start: 0.5, end: 1.6 }, alpha: { start: 0.55, end: 0 }, tint: COLORES.maquina,
        frequency: 140, quantity: 1, emitting: false,
      }).setDepth(289);
      this.emisores[cnc] = { chispas, humo };
    }

    // Los filtros se crean solo cuando hacen falta (un filtro encendido en cada cuadro cuesta mucho fps):
    // el bloom, durante el pulso; el glow, en la máquina seleccionada.
    this.bloom = null;
    this._bloomTween = null;
    this.seleccionada = null;
    // Modo reducido (docs/GDD.md, sección 18.9): sin partículas, bloom ni glow de piezas. Se activa solo si los fps bajan de 50
    // o con ?efectos=0 en la dirección.
    this.reducido = new URLSearchParams(globalThis.location?.search ?? '').get('efectos') === '0';
  }

  /** Reduce los efectos para ganar fps. */
  reducir() {
    if (this.reducido) return;
    this.reducido = true;
    this._quitarBloom();
    for (const { chispas, humo } of Object.values(this.emisores)) {
      chispas.stop();
      humo.stop();
    }
    console.debug('[efectos] modo reducido: sin partículas, bloom ni glow de piezas');
  }

  /** Bloom de la cámara durante `ms` milisegundos (sube y baja). */
  pulsoBloom(ms = 700) {
    if (this.reducido) return;
    this._quitarBloom();
    this.bloom = Phaser.Actions.AddEffectBloom(this.escena.cameras.main, { threshold: 0.5, blendAmount: 0, blurQuality: 0 })[0];
    const blend = this.bloom.parallelFilters.blend;
    const estado = { k: 0 };
    this._bloomTween = this.escena.tweens.add({
      targets: estado,
      k: 1,
      duration: ms,
      yoyo: true,
      ease: 'Sine.easeOut',
      onUpdate: () => { blend.amount = 0.9 * estado.k; },
      onComplete: () => this._quitarBloom(),
    });
  }

  _quitarBloom() {
    this._bloomTween?.remove();
    this._bloomTween = null;
    if (this.bloom) {
      this.bloom.parallelFilters.destroy();
      this.bloom = null;
    }
  }

  /** Por cuadro: partículas según el estado de cada CNC y glow de la máquina seleccionada. */
  actualizar(seleccionada) {
    const r = this.celda.reloj;
    const escala = r.enPausa ? 0 : r.velocidad;
    for (const cnc of CNCS) {
      const estado = this.celda.estado(cnc);
      const { chispas, humo } = this.emisores[cnc];
      this._emitir(chispas, !this.reducido && estado === 'Fresando');
      this._emitir(humo, !this.reducido && estado === 'Falla');
      chispas.timeScale = escala;
      humo.timeScale = escala;
    }
    // Glow en la máquina seleccionada: el filtro se crea al abrir su HUD y se quita al cerrarlo.
    // Contorno amarillo de la máquina seleccionada: un polígono plano (un filtro glow ralentizaba el juego al abrir el HUD).
    if (seleccionada !== this.seleccionada) {
      this.seleccionada = seleccionada;
      this.contorno ??= this.escena.add.graphics().setDepth(291);
      this.contorno.clear();
      const nueva = this.entidades().find((e) => e.id === seleccionada);
      if (nueva?.silueta) {
        this.contorno.lineStyle(3, COLORES.espera, 1);
        this.contorno.strokePoints(nueva.silueta, true);
      }
    }
  }

  _emitir(emisor, activo) {
    if (activo && !emisor.emitting) emisor.start();
    else if (!activo && emisor.emitting) emisor.stop();
  }

  destruir() {
    this._quitarBloom();
    for (const { chispas, humo } of Object.values(this.emisores)) {
      chispas.destroy();
      humo.destroy();
    }
  }
}
