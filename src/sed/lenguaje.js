// Lenguaje de reparación ^H(CT?)+R$  (H = home, C = chequeo, T = cambio de herramienta, R = reset).
// Se valida de dos maneras: con una RegExp anclada y con el DFA exportado de JFLAP.
// Sin motor gráfico ni DOM.

import { Automata } from './automata.js';

/** Expresión regular del lenguaje, anclada al inicio y al final. */
export const EXPRESION_REPARACION = /^H(CT?)+R$/;

/** Texto de la expresión, para el botón "Pedir ayuda". */
export const EXPRESION_TEXTO = '^H(CT?)+R$';

/** ¿La palabra pertenece al lenguaje? (RegExp anclada) */
export function validarConRegExp(palabra) {
  return EXPRESION_REPARACION.test(palabra);
}

/** ¿La palabra pertenece al lenguaje? (DFA mínimo de JFLAP; un paso sin definir rechaza). */
export function validarConDFA(dfaJson, palabra) {
  return new Automata(dfaJson).aceptaCodigos(palabra);
}

/**
 * Validador paso a paso para la consola de reparación.
 * Cada símbolo tecleado avanza el DFA. Si un paso no está definido, la palabra queda rechazada
 * (trampa implícita) y ya no puede aceptarse aunque se sigan tecleando símbolos.
 */
export class ValidadorReparacion {
  /** @param {object} dfaJson Contenido de reparacion_dfa.json. */
  constructor(dfaJson) {
    this.dfa = new Automata(dfaJson);
    this.reiniciar();
  }

  /** Empieza una palabra nueva. */
  reiniciar() {
    this.dfa.reiniciar();
    this.palabra = '';
    this.muerta = false; // true cuando ya no hay forma de aceptarla
  }

  /**
   * Avanza un símbolo (H, C, T o R).
   * @returns {{simbolo:string, estado:string|null, aceptada:boolean, rechazada:boolean,
   *            siguientes:string[], palabra:string}}
   */
  avanzar(simbolo) {
    this.palabra += simbolo;
    if (!this.muerta) {
      const evento = this.dfa.idDeCodigo(simbolo);
      if (evento !== undefined && this.dfa.puede(evento)) this.dfa.ejecutar(evento);
      else this.muerta = true;
    }
    return this.progreso(simbolo);
  }

  /** Estado actual del progreso. `siguientes` son los símbolos que aún pueden continuar la palabra. */
  progreso(simbolo = '') {
    return {
      simbolo,
      estado: this.muerta ? null : this.dfa.estado,
      aceptada: !this.muerta && this.dfa.esMarcado(),
      rechazada: this.muerta,
      siguientes: this.muerta ? [] : this.dfa.eventosActivos().map((e) => this.dfa.eventos.get(e).codigo),
      palabra: this.palabra,
    };
  }

  /** ¿La palabra tecleada hasta ahora es válida? (lo que se comprueba al pulsar Enter) */
  esValida() {
    return !this.muerta && this.dfa.esMarcado();
  }
}
