// Tutorial "Turno 0" (docs/GDD.md, sección 18.5): pasos guiados. Cada paso avanza cuando el ESTADO del modelo cumple su condición
// (no cuando se hace clic): así la guía nunca se adelanta a lo que de verdad pasó en los autómatas y en la red.
// Sin motor gráfico ni DOM.

/**
 * objetivo: qué señala la flecha. {tipo:'maquina', id} | {tipo:'boton', etiqueta, alterna} (botón del HUD de máquina: el botón
 *           grande de «Acciones», una pestaña o, con `alterna`, el botón de evento equivalente de «Autómata») |
 *           {tipo:'barra', clave} (botón de la barra de despacho) | {tipo:'ninguno'}.
 * evento: [máquina, evento]: el paso se cumple cuando ese evento ocurre en el modelo DESPUÉS del paso anterior (se consulta la
 *   bitácora de la Celda en orden; así un jugador rápido no se salta pasos y la guía puede avanzar varios de golpe).
 * hecho(celda, ctx): condición por estado, para los pasos sin evento. ctx = {hud: id de la máquina con el HUD abierto o null,
 *   pestana: pestaña abierta del HUD ('acciones', 'automata' o 'composicion')}.
 * minimo: milisegundos que el mensaje se queda aunque la condición ya se cumpla (para pasos que solo informan).
 */
export const PASOS = [
  { id: 'abrir_hud', mensaje: 'Haz clic en la CNC 1 (o pulsa la tecla 1) para abrir su panel.', objetivo: { tipo: 'maquina', id: 'CNC1' }, hecho: (c, x) => x.hud === 'CNC1' || c.atendida === 'CNC1' },
  { id: 'cargar', mensaje: 'Pulsa «Cargar bloque» (o Espacio). El brazo hace solo sus eventos: m, l, a, c, e. Míralos en el historial.', objetivo: { tipo: 'boton', etiqueta: 'Cargar bloque', alterna: 'm · mover' }, evento: ['CNC1', 'cargar'] },
  { id: 'volver', mensaje: 'La pieza ya está en la CNC. El brazo cierra la pinza (e) y vuelve solo a reposo (m).', objetivo: { tipo: 'ninguno' }, evento: ['BRAZO', 'mover'], minimo: 3000 },
  { id: 'automata', mensaje: 'Abre la pestaña «Autómata» (o Tab): es el grafo de la CNC. Verde se puede, gris aún no, rojo lo bloquea el supervisor.', objetivo: { tipo: 'boton', etiqueta: 'Autómata' }, hecho: (c, x) => x.pestana === 'automata' || c.estado('CNC1') !== 'Cargado' },
  { id: 'fresar', mensaje: 'Inicia el fresado: «i · iniciar_fresado» aquí, o «Fresar» en la pestaña «Acciones».', objetivo: { tipo: 'boton', etiqueta: 'Fresar', alterna: 'i · iniciar_fresado' }, evento: ['CNC1', 'iniciar_fresado'] },
  { id: 'esperar', mensaje: 'El fresado dura 10 s (f). Espera a que la CNC quede Terminada.', objetivo: { tipo: 'ninguno' }, evento: ['CNC1', 'fin_fresado'] },
  { id: 'sacar', mensaje: 'Vuelve a «Acciones» y pulsa «Sacar pieza»: el brazo hace m, l, a y d. ¡Es tu primera pieza!', objetivo: { tipo: 'boton', etiqueta: 'Sacar pieza', alterna: 'm · mover' }, evento: ['CNC1', 'descargar'] },
  { id: 'agv', mensaje: 'Ahora despacha el AGV 1 con el botón «Despachar AGV1» de abajo (o la tecla Q).', objetivo: { tipo: 'barra', clave: 'AGV1' }, evento: ['AGV1', 'reservar'] },
  { id: 'ciclo', mensaje: 'El AGV viaja 4 s y descarga 5 s. Mira el radar: pasa a amarillo y vuelve a verde.', objetivo: { tipo: 'ninguno' }, evento: ['AGV1', 'fin_descarga'] },
  { id: 'deadlock1', mensaje: 'Ahora provoca un deadlock a propósito. Despacha el AGV 1 otra vez (Q).', objetivo: { tipo: 'barra', clave: 'AGV1' }, evento: ['AGV1', 'reservar'] },
  { id: 'deadlock2', mensaje: 'Y sin esperar, despacha también el AGV 2 (W). Cada uno tomará un recurso y esperará el otro.', objetivo: { tipo: 'barra', clave: 'AGV2' }, hecho: (c) => c.deadlock },
  { id: 'fin', mensaje: '¡Interbloqueo! El radar está en rojo. Pulsa R (o «Red») para ver la red: las barras en rojo no se pueden disparar.', objetivo: { tipo: 'ninguno' }, hecho: () => false },
];

export class GuiaTutorial {
  constructor() {
    this.indice = 0;
    this._desde = null; // ms en que se mostró el paso actual
    this._cursor = 0; // posición de la bitácora ya consumida
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
      n++;
    }
    return n;
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
