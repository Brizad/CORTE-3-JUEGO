// Ayuda corta (docs/GDD.md, secciones 18.13 y 18.19). Dos páginas:
//  - «Cómo jugar»: la intro de 6 líneas y los atajos de teclado. Es la que sale antes del turno 1 y al pulsar "?".
//  - «Controles y colores»: la tabla de controles y la leyenda de colores y del radar.
// Se abre con "?" o desde el menú de pausa. Mientras está abierta (si no viene del menú) la simulación queda en pausa.

import { COLORES, TEXTO_HEX, TURNOS } from '../config.js';
import { CONTROLES, LEYENDA, LEYENDA_RADAR, ATAJOS, introLineas } from '../textos.js';
import { camaraLogica } from './camara.js';
import { resaltable } from './resaltar.js';

const PANEL = { x: 40, y: 24, ancho: 880, alto: 492 };

export class Ayuda extends Phaser.Scene {
  constructor() {
    super('Ayuda');
  }

  /** @param {{inicio?:boolean}} [datos] inicio: es la intro de antes del turno 1 (el botón dice «¡A jugar!»). */
  create(datos = {}) {
    camaraLogica(this);
    this.planta = this.scene.get('Planta');
    this.abierto = true;
    this.inicio = !!datos.inicio;
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

    this.paginas = { juego: this.add.container(0, 0), controles: this.add.container(0, 0) };
    this._paginaJuego(this.paginas.juego);
    this._paginaControles(this.paginas.controles);

    // Botones de abajo: cambiar de página y cerrar.
    const boton = (x, ancho, color, accion) => {
      const rect = resaltable(this.add.rectangle(x, PANEL.y + PANEL.alto - 56, ancho, 44, color).setOrigin(0).setInteractive({ useHandCursor: true }));
      const t = this.add.text(x + ancho / 2, PANEL.y + PANEL.alto - 34, '', { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
      rect.on('pointerup', () => { this.planta.sonidos.clic(); accion(); });
      return t;
    };
    this.txtCambiar = boton(PANEL.x + PANEL.ancho - 420, 240, COLORES.banda, () => this._mostrar(this.pagina === 'juego' ? 'controles' : 'juego'));
    boton(PANEL.x + PANEL.ancho - 170, 150, COLORES.operacion, () => this.cerrar()).setText(this.inicio ? '¡A jugar!' : 'Cerrar');
    this.add.text(PANEL.x + 20, PANEL.y + PANEL.alto - 26, '? o Esc: cerrar', { fontFamily: 'Arial', fontSize: '11px', color: '#8794a3' });
    this._mostrar('juego');
    this.events.once('shutdown', () => (this.abierto = false));
  }

  _texto(capa, x, y, t, estilo = {}) {
    const o = this.add.text(x, y, t, { fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto, ...estilo });
    capa.add(o);
    return o;
  }

  /** Página «Cómo se juega»: la intro (5 líneas como máximo) y los atajos. */
  _paginaJuego(capa) {
    const celda = this.planta.celda;
    const meta = this.planta.partida.tutorial ? TURNOS[0].meta : celda.turno.meta;
    const x = PANEL.x + 28;
    this._texto(capa, x, PANEL.y + 14, 'Cómo jugar', { fontSize: '24px', fontStyle: 'bold' });
    let y = PANEL.y + 62;
    introLineas(meta).forEach((linea, i) => {
      const punto = this.add.circle(x + 6, y + 10, 5, [COLORES.celda, COLORES.robot, COLORES.fallo, COLORES.agv, COLORES.espera, COLORES.operacion][i]);
      capa.add(punto);
      const t = this._texto(capa, x + 24, y, linea, { fontSize: '15px', wordWrap: { width: PANEL.ancho - 76 }, lineSpacing: 3 });
      y += t.height + 9;
    });
    y += 2;
    this._texto(capa, x, y, 'Teclas (cada una dispara un solo evento)', { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    y += 24;
    ATAJOS.forEach(([tecla, que], i) => {
      const cx = x + (i % 2) * 410;
      const cy = y + Math.floor(i / 2) * 28;
      const caja = this.add.rectangle(cx, cy, 78, 24, COLORES.banda).setOrigin(0).setStrokeStyle(1, COLORES.texto, 0.7);
      capa.add(caja);
      this._texto(capa, cx + 39, cy + 12, tecla, { fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
      this._texto(capa, cx + 88, cy + 5, que, { fontSize: '13px' });
    });
    y += Math.ceil(ATAJOS.length / 2) * 28 + 4;
    this._texto(capa, x, y, 'Haz clic en una máquina para ver su autómata. Verde = se puede, gris = ahora no, rojo = lo bloquea el supervisor (−15).', { fontSize: '12px', color: '#8794a3' });
  }

  /** Página «Controles y colores»: tabla de controles y leyenda de colores y del radar. */
  _paginaControles(capa) {
    this._texto(capa, PANEL.x + 20, PANEL.y + 12, 'Controles y colores', { fontSize: '22px', fontStyle: 'bold' });
    // Columna izquierda: controles.
    const xi = PANEL.x + 20;
    this._texto(capa, xi, PANEL.y + 46, 'Controles', { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    CONTROLES.forEach(([accion, mouse, tactil], i) => {
      const y = PANEL.y + 66 + i * 21;
      this._texto(capa, xi, y, accion, { fontSize: '10px', fontStyle: 'bold' });
      this._texto(capa, xi, y + 10, `${mouse}  ·  ${tactil}`, { fontSize: '9px', color: '#8794a3' });
    });

    // Columna derecha: leyenda de colores y del radar.
    const xd = PANEL.x + 450;
    const ancho = PANEL.ancho - 470;
    this._texto(capa, xd, PANEL.y + 46, 'Colores', { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    let y = PANEL.y + 68;
    const fila = ([clave, frase]) => {
      capa.add(this.add.rectangle(xd, y + 2, 14, 14, COLORES[clave]).setOrigin(0).setStrokeStyle(1, COLORES.texto, 0.8));
      const t = this._texto(capa, xd + 22, y, frase, { fontSize: '11px', wordWrap: { width: ancho - 22 }, lineSpacing: 2 });
      y += Math.max(24, t.height + 7);
    };
    LEYENDA.forEach(fila);
    y += 6;
    this._texto(capa, xd, y, 'Radar (arriba a la derecha)', { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    y += 22;
    LEYENDA_RADAR.forEach(fila);
  }

  _mostrar(pagina) {
    this.pagina = pagina;
    for (const [clave, capa] of Object.entries(this.paginas)) capa.setVisible(clave === pagina);
    this.txtCambiar.setText(pagina === 'juego' ? 'Controles y colores' : 'Cómo jugar');
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
    const enCuenta = this.scene.get('HUDGeneral')?.enCuenta; // la cuenta 3, 2, 1 reanuda el reloj al terminar
    if (!this._pausaPrevia && !desdeMenu && !enCuenta && !c.deadlock && !c.terminado) this.planta.reloj.reanudar();
    this.scene.stop('Ayuda');
  }
}
