// Racha (docs/GDD.md, sección 18.20): piezas seguidas sin errores. Es SOLO visual: no suma ni resta puntos.
// Sube con cada pieza descargada y vuelve a 0 con un error del jugador: intento bloqueado por el supervisor, palabra de
// reparación inválida, entrega de metal perdida o interbloqueo. Sin motor gráfico ni DOM.

const ERRORES = new Set(['intento bloqueado por el supervisor', 'palabra de reparación inválida', 'entrega perdida', 'deadlock']);

export class Racha {
  /** @param {import('./celda.js').Celda} celda */
  constructor(celda) {
    this.n = 0; // piezas seguidas sin errores
    this.mejor = 0;
    this._baja = celda.alCambiar((e) => {
      if (e.tipo !== 'puntos') return;
      if (e.motivo === 'pieza descargada') {
        this.n++;
        this.mejor = Math.max(this.mejor, this.n);
      } else if (ERRORES.has(e.motivo)) this.n = 0;
    });
  }

  /** Texto para mostrar ("Racha ×3"), o '' si todavía no hay racha (menos de 2 piezas seguidas). */
  get texto() {
    return this.n >= 2 ? `Racha ×${this.n}` : '';
  }

  destruir() {
    this._baja();
  }
}
