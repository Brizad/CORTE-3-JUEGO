// Tutorial "Turno 0" (docs/GDD.md, sección 18.5): pasos guiados. Cada paso avanza cuando el ESTADO del modelo cumple su condición
// (no cuando se hace clic): así la guía nunca se adelanta a lo que de verdad pasó en los autómatas y en la red.
// Sin motor gráfico ni DOM.

/**
 * Cada paso pide UN botón (un evento del autómata) con una frase corta. Las pistas del siguiente paso solo existen aquí, en el tutorial.
 * objetivo: qué señala la flecha. {tipo:'barra', clave} (botón de la barra de control: id del verbo de src/sed/controles.js) |
 *           {tipo:'maquina', id} | {tipo:'ninguno'}.
 * evento: [máquina, evento]: el paso se cumple cuando ese evento ocurre en el modelo DESPUÉS del paso anterior (se consulta la
 *   bitácora de la Celda en orden; así un jugador rápido no se salta pasos y la guía puede avanzar varios de golpe).
 * hecho(celda, ctx): condición por estado, para los pasos sin evento. ctx = {hud: id de la máquina con el HUD abierto o null}.
 * minimo: milisegundos que el mensaje se queda aunque la condición ya se cumpla (para pasos que solo informan).
 */
export const PASOS = [
  { id: 'ir', mensaje: 'Manda el brazo a la CNC 1: pulsa «Ir a CNC 1» (tecla Z).', objetivo: { tipo: 'barra', clave: 'ir1' }, evento: ['BRAZO', 'mover'] },
  { id: 'llegar', mensaje: 'El brazo viaja 2 s. Espera a que llegue.', objetivo: { tipo: 'ninguno' }, evento: ['BRAZO', 'llegar'] },
  { id: 'abrir', mensaje: 'Abre la pinza (A).', objetivo: { tipo: 'barra', clave: 'abrir' }, evento: ['BRAZO', 'abrir_mandril'] },
  { id: 'meter', mensaje: 'Mete el bloque (C).', objetivo: { tipo: 'barra', clave: 'meter' }, evento: ['CNC1', 'cargar'] },
  { id: 'cerrar', mensaje: 'Cierra la pinza (E). El brazo vuelve solo a reposo.', objetivo: { tipo: 'barra', clave: 'cerrar' }, evento: ['BRAZO', 'cerrar_mandril'] },
  { id: 'fresar', mensaje: 'Fresa en la CNC 1 (F).', objetivo: { tipo: 'barra', clave: 'fresar1' }, evento: ['CNC1', 'iniciar_fresado'] },
  { id: 'panel', mensaje: 'Mientras fresa (10 s), haz clic en la CNC 1: su panel muestra el autómata.', objetivo: { tipo: 'maquina', id: 'CNC1' }, hecho: (c, x) => x.hud === 'CNC1' || c.estado('CNC1') !== 'Fresando' },
  { id: 'esperar', mensaje: 'Espera a que termine de fresar. El nodo iluminado es el estado actual.', objetivo: { tipo: 'ninguno' }, evento: ['CNC1', 'fin_fresado'] },
  { id: 'ir2', mensaje: 'Pieza lista. Manda el brazo otra vez a la CNC 1 (Z).', objetivo: { tipo: 'barra', clave: 'ir1' }, evento: ['BRAZO', 'mover'] },
  { id: 'abrir2', mensaje: 'Cuando llegue, abre la pinza (A).', objetivo: { tipo: 'barra', clave: 'abrir' }, evento: ['BRAZO', 'abrir_mandril'] },
  { id: 'sacar', mensaje: 'Saca la pieza (D). ¡Son 100 puntos!', objetivo: { tipo: 'barra', clave: 'sacar' }, evento: ['CNC1', 'descargar'] },
  { id: 'agv', mensaje: 'Llegó metal. Atiende el AGV 1 (Q).', objetivo: { tipo: 'barra', clave: 'agv1' }, evento: ['AGV1', 'reservar'] },
  { id: 'ciclo', mensaje: 'El AGV descarga con la mesa y el robot. Mira el radar: amarillo y otra vez verde.', objetivo: { tipo: 'ninguno' }, evento: ['AGV1', 'fin_descarga'] },
  { id: 'deadlock1', mensaje: 'Ahora traba la celda a propósito. Atiende el AGV 1 (Q)…', objetivo: { tipo: 'barra', clave: 'agv1' }, evento: ['AGV1', 'reservar'] },
  { id: 'deadlock2', mensaje: '…y sin esperar, atiende el AGV 2 (W). Cada uno toma un recurso.', objetivo: { tipo: 'barra', clave: 'agv2' }, hecho: (c) => c.deadlock },
  { id: 'fin', mensaje: '¡Celda trabada! Radar en rojo. Pulsa R para ver la red: las barras rojas no se pueden disparar.', objetivo: { tipo: 'ninguno' }, hecho: () => false },
];

export class GuiaTutorial {
  constructor() {
    this.indice = 0;
    this._desde = null; // ms en que se mostró el paso actual
    this._cursor = 0; // posición de la bitácora ya consumida
    this._inicios = [{ indice: 0, t: 0 }]; // segundo de simulación en que empezó cada paso (para retomar tras un reintento)
  }

  get paso() {
    return PASOS[this.indice];
  }

  get terminado() {
    return this.paso.id === 'fin';
  }

  /** ¿Se cumple el paso actual? Devuelve la posición de la bitácora que consumió (o la última consumida), o -2 si no se cumple. */
  _cumple(celda, ctx) {
    const p = this.paso;
    if (p.evento) {
      const [maquina, evento] = p.evento;
      const bit = celda.bitacora;
      for (let i = this._cursor; i < bit.length; i++) {
        if (bit[i].tipo === 'automata' && bit[i].maquina === maquina && bit[i].evento === evento) return i;
      }
      return -2;
    }
    return p.hecho(celda, ctx) ? this._cursor - 1 : -2;
  }

  /**
   * Avanza los pasos cuya condición ya se cumplió (respetando el tiempo mínimo de los pasos informativos).
   * @returns {number} cuántos pasos avanzó.
   */
  avanzar(celda, ctx, ahoraMs = 0) {
    if (this._desde === null) this._desde = ahoraMs;
    let n = 0;
    while (this.indice < PASOS.length - 1) {
      const p = this.paso;
      const donde = this._cumple(celda, ctx);
      if (donde === -2) break;
      if (ahoraMs - this._desde < (p.minimo ?? 0)) break;
      this._cursor = Math.max(this._cursor, donde + 1);
      this.indice++;
      this._desde = ahoraMs;
      this._inicios.push({ indice: this.indice, t: celda.reloj?.ahora ?? 0 });
      n++;
    }
    return n;
  }

  /**
   * Retoma la guía después de «Reintentar desde el último marcado verde» (game over por interbloqueo).
   * Si el paso pedía provocar el deadlock (la guía ya está en «fin»), sigue con el paso siguiente: se queda en «fin».
   * Si el deadlock fue sin querer, vuelve al paso que estaba activo en el segundo `tVerde` del marcado restaurado.
   * Lo ocurrido antes del reintento no cuenta para los pasos.
   * @returns {string} id del paso en que queda la guía.
   */
  trasReintentar(tVerde, celda, ahoraMs = 0) {
    if (!this.terminado) {
      const previos = this._inicios.filter((x) => x.t <= tVerde);
      const destino = previos.length ? previos[previos.length - 1].indice : 0;
      this._inicios = this._inicios.filter((x) => x.t <= tVerde);
      this.indice = destino;
    }
    this._desde = ahoraMs;
    this._cursor = celda.bitacora.length;
    return this.paso.id;
  }

  /** Vuelve a un paso por su id (por ejemplo, para reintentar el final); lo ya ocurrido no cuenta. */
  irA(id, celda, ahoraMs = 0) {
    const i = PASOS.findIndex((p) => p.id === id);
    if (i < 0) return;
    this.indice = i;
    this._desde = ahoraMs;
    this._cursor = celda.bitacora.length;
  }
}
