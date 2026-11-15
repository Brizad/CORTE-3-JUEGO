// Game over por interbloqueo (GDD, sección 11): la simulación ya está detenida. Muestra el marcado muerto, la secuencia
// de disparos que llevó a él y la regla de prevención (lugar monitor Celda_libre). El jugador puede reintentar desde el
// último marcado verde (el puntaje, incluido el −200, se conserva) o reintentar y comprar el Controlador de celda.

import { COLORES, TEXTO_HEX, ANCHO, PUNTOS } from '../config.js';
import { nombreMarcado } from '../sed/cobertura.js';

const PANEL = { ancho: 560, alto: 360 };

export class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    const planta = this.scene.get('Planta');
    this.planta = planta;
    this.celda = planta.celda;
    this.abierto = true;
    const c = this.celda;
    const x0 = (ANCHO - PANEL.ancho) / 2;
    const y0 = 70;

    // El resto de la pantalla se oscurece y no recibe clics.
    const velo = this.add.rectangle(0, 0, ANCHO, 540, 0x000000, 0.55).setOrigin(0).setInteractive();
    velo.on('pointerup', () => {});
    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.98);
    marco.fillRect(x0, y0, PANEL.ancho, PANEL.alto);
    marco.lineStyle(3, COLORES.fallo, 1);
    marco.strokeRect(x0, y0, PANEL.ancho, PANEL.alto);

    const texto = (x, y, t, estilo = {}) =>
      this.add.text(x0 + x, y0 + y, t, { fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto, wordWrap: { width: PANEL.ancho - 2 * x }, lineSpacing: 3, ...estilo });

    texto(16, 12, 'Game over por interbloqueo', { fontSize: '22px', fontStyle: 'bold', color: TEXTO_HEX.fallo });
    const M = c.red.marcado();
    const nombre = nombreMarcado(M);
    texto(16, 48, `Marcado muerto: M = [${M.join(',')}]${nombre ? `  (${nombre})` : ''}`, { fontSize: '14px', fontStyle: 'bold' });

    const red = c.red;
    const secuencia = c.secuenciaDeadlock.map((id) => `${id} (${red.transiciones[red.indiceT(id)].nombre})`);
    texto(16, 74, `Secuencia de disparos que llevó a él:\n${secuencia.join('  →  ') || '—'}`);

    const esperas = ['AGV1', 'AGV2']
      .filter((agv) => c.estado(agv) !== 'Libre')
      .map((agv) => `${agv} espera: falta ${c.faltantes(agv === 'AGV1' ? 't1b' : 't2b').join(', ')}`);
    texto(16, 112, `Ninguna transición está habilitada. ${esperas.join('; ')}.\nCada AGV tomó un recurso y espera el que tiene el otro.`);

    texto(16, 156, 'Regla de prevención: lugar monitor Celda_libre (p10, k = 1).', { fontStyle: 'bold', color: TEXTO_HEX.espera });
    texto(
      16,
      174,
      't1a y t2a toman su ficha; t1c y t2c la devuelven. Invariante IP5: Celda_libre + p5 + p6 + p7 + p8 = 1.\n' +
        'Con ella, t2a no se dispara después de t1a y el interbloqueo deja de ser alcanzable. Es el Controlador de celda.',
    );
    texto(16, 258, `${PUNTOS.deadlock} puntos por el deadlock. Puntaje: ${c.puntaje}.`, { fontStyle: 'bold', color: TEXTO_HEX.espera });

    const boton = (x, y, ancho, etiqueta, color, accion) => {
      const rect = this.add.rectangle(x0 + x, y0 + y, ancho, 44, color).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
      this.add.text(x0 + x + ancho / 2, y0 + y + 22, etiqueta, { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.texto, align: 'center' }).setOrigin(0.5);
      rect.on('pointerup', accion);
    };
    boton(16, 298, 250, 'Reintentar desde el último\nmarcado verde', COLORES.operacion, () => this._reintentar(false));
    boton(278, 298, 266, `Reintentar y comprar el\nControlador de celda (${PUNTOS.controlador})`, COLORES.mantenimiento, () => this._reintentar(true));
  }

  /** Verdadero mientras la pantalla está abierta: bloquea todos los clics de abajo. */
  contiene() {
    return this.abierto;
  }

  _reintentar(conControlador) {
    const c = this.celda;
    if (!c.reintentarDesdeVerde()) return;
    if (conControlador) c.comprarControlador();
    this.planta.piloto.reprogramar();
    this.abierto = false;
    this.scene.stop('GameOver');
  }
}
