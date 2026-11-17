// Resultados del turno (GDD, secciones 4.3 y 11): piezas, fallas reparadas, intentos bloqueados, pedidos vencidos,
// deadlocks evitados y puntaje. Botón "Siguiente turno" si se ganó, "Reintentar" si se perdió y, tras ganar el
// turno 3, la pantalla de victoria de la partida. Es una escena superpuesta: la simulación ya está detenida.

import { COLORES, TEXTO_HEX, ANCHO, TURNOS } from '../config.js';
import { LOGROS } from '../sed/logros.js';
import { Partida } from '../sed/partida.js';
import { camaraLogica } from './camara.js';
import { fraseJefe } from '../textos.js';
import { resaltable } from './resaltar.js';

const PANEL = { ancho: 620, alto: 456 };

export class Resultados extends Phaser.Scene {
  constructor() {
    super('Resultados');
  }

  create() {
    camaraLogica(this);
    this.cameras.main.fadeIn(300, 22, 27, 34);
    const planta = this.scene.get('Planta');
    this.planta = planta;
    this.abierto = true;
    const partida = planta.partida;
    const celda = planta.celda;
    const r = celda.resumen();
    const victoria = r.resultado === 'victoria';
    const final = victoria && partida.esUltimo;
    const x0 = (ANCHO - PANEL.ancho) / 2;
    const y0 = 50;

    const velo = this.add.rectangle(0, 0, ANCHO, 540, 0x000000, 0.6).setOrigin(0).setInteractive();
    velo.on('pointerup', () => {});
    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.98);
    marco.fillRect(x0, y0, PANEL.ancho, PANEL.alto);
    marco.lineStyle(3, victoria ? COLORES.operacion : COLORES.fallo, 1);
    marco.strokeRect(x0, y0, PANEL.ancho, PANEL.alto);

    const texto = (x, y, t, estilo = {}) =>
      this.add.text(x0 + x, y0 + y, t, { fontFamily: 'Arial', fontSize: '13px', color: TEXTO_HEX.texto, ...estilo });

    const titulo = final
      ? '¡Victoria de la partida!'
      : victoria
        ? `Turno ${partida.turno + 1} ganado`
        : celda.deadlock
          ? `Turno ${partida.turno + 1} perdido`
          : `Turno ${partida.turno + 1} perdido: se acabó el tiempo`;
    texto(20, 14, titulo, { fontSize: '24px', fontStyle: 'bold', color: victoria ? TEXTO_HEX.operacion : TEXTO_HEX.fallo });
    // Frase corta del jefe de planta y, al lado, el resumen de la meta.
    texto(20, 44, `«${fraseJefe(r)}»`, { fontSize: '15px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    texto(20, 66, victoria ? `Meta cumplida: ${r.piezas} de ${r.meta} piezas en ${Math.round(r.tiempo)} s.` : `Meta: ${r.piezas} de ${r.meta} piezas en ${Math.round(r.tiempo)} s.`, { fontSize: '11px', color: '#8794a3' });

    const filas = [
      ['Piezas descargadas', `${r.piezas} / ${r.meta}`],
      ['Fallas reparadas', `${r.fallasReparadas} de ${r.fallas}`],
      ['Intentos bloqueados por el supervisor', String(r.intentosBloqueados)],
      ['Pedidos vencidos', String(r.pedidosVencidos)],
      ['Deadlocks evitados (radar de amarillo a verde)', String(r.deadlocksEvitados)],
      ['Deadlocks sufridos', String(r.deadlocks)],
      ['Ciclos de AGV', String(r.ciclosAGV)],
      ['Puntaje de este turno', `${r.puntajeTurno >= 0 ? '+' : ''}${r.puntajeTurno}`],
      ['Puntaje total', String(r.puntaje)],
    ];
    filas.forEach(([nombre, valor], i) => {
      const y = 84 + i * 22;
      const destacado = i >= filas.length - 2;
      texto(24, y, nombre, { fontStyle: destacado ? 'bold' : 'normal' });
      texto(PANEL.ancho - 24, y, valor, { fontStyle: 'bold', fontSize: destacado ? '15px' : '13px' }).setOrigin(1, 0);
    });

    // Logros: los 6, con los ganados en este turno resaltados.
    const nuevos = planta.logrosDelTurno ?? [];
    texto(24, 290, `Logros (${partida.logros.ganados.size} de ${LOGROS.length})`, { fontStyle: 'bold', color: TEXTO_HEX.espera });
    LOGROS.forEach((l, i) => {
      const ganado = partida.logros.ganados.has(l.id);
      const nuevo = nuevos.includes(l.id);
      const x = 24 + (i % 2) * 300;
      const y = 312 + Math.floor(i / 2) * 20;
      texto(x, y, `${ganado ? '★' : '☆'} ${l.nombre}${nuevo ? '  (nuevo)' : ''}`, {
        fontSize: '12px', color: ganado ? '#d4af37' : '#566170', fontStyle: nuevo ? 'bold' : 'normal',
      });
    });

    // Botones.
    const boton = (x, ancho, etiqueta, color, accion) => {
      const rect = resaltable(this.add.rectangle(x0 + x, y0 + 390, ancho, 46, color).setOrigin(0).setInteractive({ useHandCursor: true }));
      this.add.text(x0 + x + ancho / 2, y0 + 413, etiqueta, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
      rect.on('pointerup', accion);
    };
    if (final) boton(20, 270, 'Jugar de nuevo', COLORES.operacion, () => this._reiniciar(true));
    else if (victoria) boton(20, 270, `Siguiente turno (${partida.turno + 2} de ${TURNOS.length})`, COLORES.operacion, () => {
      partida.siguienteTurno();
      this._reiniciar(false);
    });
    else boton(20, 270, 'Reintentar', COLORES.mantenimiento, () => this._reiniciar(false));
    if (!victoria) boton(300, 300, 'Reiniciar la partida', COLORES.banda, () => this._reiniciar(true));
  }

  /** Bloquea todos los clics de abajo mientras la pantalla está abierta. */
  contiene() {
    return this.abierto;
  }

  /** Vuelve a crear la planta: con el turno que dejó la Partida, o con una Partida nueva. */
  _reiniciar(partidaNueva) {
    if (partidaNueva) this.registry.set('partida', new Partida());
    this.abierto = false;
    // Fundido de salida y luego se vuelve a crear la planta (que entra con un fundido).
    this.cameras.main.fadeOut(250, 22, 27, 34);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('Resultados');
      this.planta.scene.restart();
    });
  }
}
