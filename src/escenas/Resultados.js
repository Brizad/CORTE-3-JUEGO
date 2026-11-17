// Resultados del turno (GDD, secciones 4.3 y 11): piezas, fallas reparadas, intentos bloqueados, pedidos vencidos,
// deadlocks evitados y puntaje. Botón "Siguiente turno" si se ganó, "Reintentar" si se perdió y, tras ganar el
// turno 3, la pantalla de victoria de la partida. Es una escena superpuesta: la simulación ya está detenida.

import { COLORES, TEXTO_HEX, ANCHO, TURNOS } from '../config.js';
import { LOGROS } from '../sed/logros.js';
import { Partida } from '../sed/partida.js';
import { camaraLogica } from './camara.js';
import { fraseJefe, estrellas } from '../textos.js';
import { resaltable } from './resaltar.js';
import { fichaLogro } from './ventanas.js';
import { datosJugador } from '../guardado.js';

const PANEL = { ancho: 620, alto: 460 };

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
    const y0 = 40;

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
    // Estrellas del turno (1 a 3 según las piezas sobre la meta): entran una por una con un rebote.
    const n = estrellas(r);
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics({ x: x0 + PANEL.ancho - 130 + i * 44, y: y0 + 34 });
      const puntos = [];
      for (let k = 0; k < 10; k++) {
        const ang = (-90 + k * 36) * (Math.PI / 180);
        const radio = k % 2 === 0 ? 18 : 8;
        puntos.push({ x: Math.cos(ang) * radio, y: Math.sin(ang) * radio });
      }
      g.fillStyle(i < n ? COLORES.celda : COLORES.banda, i < n ? 1 : 0.5);
      g.fillPoints(puntos, true);
      g.lineStyle(1.5, COLORES.texto, i < n ? 0.9 : 0.3);
      g.strokePoints(puntos, true);
      if (i < n) {
        g.setScale(0);
        this.tweens.add({ targets: g, scale: 1, delay: 350 + i * 260, duration: 380, ease: 'Back.easeOut' });
      }
    }
    // Frase corta del jefe de planta y, debajo, el resumen de la meta.
    texto(20, 44, `«${fraseJefe(r)}»`, { fontSize: '15px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    texto(20, 66, victoria ? `Meta cumplida: ${r.piezas} de ${r.meta} piezas en ${Math.round(r.tiempo)} s.` : `Meta: ${r.piezas} de ${r.meta} piezas en ${Math.round(r.tiempo)} s.`, { fontSize: '11px', color: '#8794a3' });

    const filas = [
      ['Piezas descargadas', `${r.piezas} / ${r.meta}`],
      ['Fallas reparadas', `${r.fallasReparadas} de ${r.fallas}`],
      ['Intentos bloqueados por el supervisor', String(r.intentosBloqueados)],
      ['Entregas de metal perdidas', String(r.pedidosVencidos)],
      ['Deadlocks evitados (radar de amarillo a verde)', String(r.deadlocksEvitados)],
      ['Deadlocks sufridos', String(r.deadlocks)],
      ['Entregas de metal recibidas', String(r.ciclosAGV)],
      ['Puntaje de este turno', `${r.puntajeTurno >= 0 ? '+' : ''}${r.puntajeTurno}`],
      ['Puntaje total', String(r.puntaje)],
    ];
    filas.forEach(([nombre, valor], i) => {
      const y = 84 + i * 22;
      const destacado = i >= filas.length - 2;
      texto(24, y, nombre, { fontStyle: destacado ? 'bold' : 'normal' });
      texto(PANEL.ancho - 24, y, valor, { fontStyle: 'bold', fontSize: destacado ? '15px' : '13px' }).setOrigin(1, 0);
    });

    // Logros: los 6, con los ganados en este turno resaltados. Cada uno es clicable y abre su ficha.
    const nuevos = planta.logrosDelTurno ?? [];
    const progreso = Object.fromEntries((planta.logros?.progreso?.() ?? []).map((p) => [p.id, p.texto]));
    const guardados = datosJugador(planta.jugador).logros;
    const tieneLogro = (id) => partida.logros.ganados.has(id) || id in guardados;
    texto(24, 286, `Logros de ${planta.jugador} (${LOGROS.filter((l) => tieneLogro(l.id)).length} de ${LOGROS.length}) · toca uno para ver su ficha`, { fontStyle: 'bold', color: TEXTO_HEX.espera });
    LOGROS.forEach((l, i) => {
      const ganado = tieneLogro(l.id);
      const nuevo = nuevos.includes(l.id);
      const x = 20 + (i % 2) * 292;
      const y = 306 + Math.floor(i / 2) * 26;
      const zona = resaltable(this.add.rectangle(x0 + x, y0 + y, 286, 24, ganado ? 0x3a2f10 : 0x0d1117).setOrigin(0).setInteractive({ useHandCursor: true }), [1, ganado ? 0xd4af37 : COLORES.banda, 0.8]);
      zona.on('pointerup', () => {
        if (this._ficha) return;
        this._ficha = fichaLogro(this, l, { ganado, fecha: guardados[l.id], progreso: progreso[l.id], alCerrar: () => { this._ficha = null; } });
      });
      texto(x + 8, y + 5, `${ganado ? '★' : '☆'} ${l.nombre}${nuevo ? '  (nuevo)' : ''}`, {
        fontSize: '12px', color: ganado ? '#d4af37' : '#8794a3', fontStyle: nuevo ? 'bold' : 'normal',
      });
    });

    // Botones.
    const boton = (x, ancho, etiqueta, color, accion) => {
      const rect = resaltable(this.add.rectangle(x0 + x, y0 + 394, ancho, 46, color).setOrigin(0).setInteractive({ useHandCursor: true }));
      this.add.text(x0 + x + ancho / 2, y0 + 417, etiqueta, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
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
