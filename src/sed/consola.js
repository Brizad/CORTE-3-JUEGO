// Lógica de la consola de reparación (GDD, sección 14.2): la palabra que teclea el jugador y el DFA paso a paso.
// Sin motor gráfico ni DOM. La interfaz solo dibuja lo que esta clase informa.

import { ValidadorReparacion } from './lenguaje.js';

/** Significado de cada comando del alfabeto de reparación. */
export const COMANDOS = {
  H: 'home de ejes',
  C: 'chequeo de herramienta',
  T: 'cambio de herramienta',
  R: 'reset',
};

export class ConsolaReparacion {
  /** @param {object} dfaJson Contenido de reparacion_dfa.json. */
  constructor(dfaJson) {
    this.dfaJson = dfaJson;
    this.limpiar();
  }

  /** Borra la palabra y vuelve al estado inicial del DFA. */
  limpiar() {
    this.palabra = '';
    this.fallo = null; // {simbolo, previo, esperados, mensaje} si el último símbolo no tiene transición
    this._validador = new ValidadorReparacion(this.dfaJson);
  }

  /**
   * Teclea un símbolo (H, C, T o R, en mayúscula o minúscula). Avanza el DFA.
   * Si el símbolo no tiene transición queda marcado como error (el primero); se puede seguir tecleando.
   * @returns {boolean} true si se escribió; false si no es un comando.
   */
  escribir(simbolo) {
    const s = String(simbolo).toUpperCase();
    if (!(s in COMANDOS)) return false;
    const esperados = this._validador.progreso().siguientes;
    const previo = this.palabra.slice(-1);
    const indice = this.palabra.length;
    const p = this._validador.avanzar(s);
    this.palabra += s;
    if (p.rechazada && !this.fallo) {
      this.fallo = { simbolo: s, indice, previo, esperados, mensaje: this._mensaje(previo, esperados) };
    }
    return true;
  }

  /** Retroceso: quita el último símbolo y rehace el DFA desde el inicio. */
  borrar() {
    const anterior = this.palabra.slice(0, -1);
    this.limpiar();
    for (const s of anterior) this.escribir(s);
  }

  /** Estado actual del DFA (q0…q4), o null si el último símbolo no tiene transición. */
  get estado() {
    return this.fallo ? null : this._validador.progreso().estado;
  }

  /** Símbolos que pueden seguir ahora (vacío si hay un error o la palabra ya terminó). */
  get esperados() {
    return this.fallo ? [] : this._validador.progreso().siguientes;
  }

  /** ¿La palabra tecleada ya está aceptada por el DFA? (termina en R) */
  get aceptada() {
    return this._validador.esValida();
  }

  /** Texto de ayuda con lo que se espera después del último símbolo. */
  get sugerencia() {
    if (this.fallo) return this.fallo.mensaje;
    return this._mensaje(this.palabra.slice(-1), this.esperados);
  }

  _mensaje(previo, esperados) {
    const lista = [...esperados].sort();
    const quien = previo ? `Después de ${previo}` : 'Al empezar';
    if (lista.length === 0) return `${quien} no se espera nada: la palabra está completa (Enter para enviar).`;
    if (lista.length === 1) return `${quien} se espera ${lista[0]} (${COMANDOS[lista[0]]}).`;
    return `${quien} se espera ${lista.slice(0, -1).join(', ')} o ${lista[lista.length - 1]}.`;
  }
}
