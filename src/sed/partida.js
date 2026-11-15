// Partida: 3 turnos de 180 s con metas, probabilidades de falla y pedidos crecientes (GDD, secciones 6 y 7).
// Guarda lo que dura toda la partida: turno actual, puntaje acumulado, logros y el estado del generador al empezar el turno.
// Sin motor gráfico ni DOM.

import { TURNOS } from '../config.js';
import { logrosPersistentes } from './logros.js';

export class Partida {
  constructor() {
    this.turno = 0; // índice del turno actual (0, 1 o 2)
    this.puntaje = 0; // puntaje acumulado al empezar el turno actual
    this.logros = logrosPersistentes();
    this.rngInicio = null; // estado del generador al empezar el turno (para reintentar con la misma semilla)
    this.historial = []; // resumen de cada turno jugado
  }

  /** Parámetros del turno actual. */
  get parametros() {
    return TURNOS[this.turno];
  }

  get esUltimo() {
    return this.turno === TURNOS.length - 1;
  }

  /**
   * Registra el final de un turno.
   * @param {object} resumen Resultado de Celda.resumen().
   */
  terminarTurno(resumen) {
    this.puntaje = resumen.puntaje;
    this.historial.push({ turno: this.turno + 1, ...resumen });
  }

  /** Pasa al turno siguiente (después de ganar). El generador sigue donde quedó. */
  siguienteTurno() {
    if (this.esUltimo) return false;
    this.turno++;
    this.rngInicio = null;
    return true;
  }

  /** Reintenta el turno: se conserva el puntaje (incluido lo perdido) y se restaura el generador del inicio del turno. */
  reintentarTurno() {
    // rngInicio se conserva: Planta lo restaura al crear la celda.
  }
}
