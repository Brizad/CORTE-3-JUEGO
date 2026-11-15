// Generador pseudoaleatorio mulberry32 con semilla.
// Sin motor gráfico ni DOM: se prueba con Node. Con la misma semilla produce siempre la misma secuencia.

/**
 * Crea un generador pseudoaleatorio.
 * @param {number} semilla Entero que fija la secuencia (por defecto 2026).
 * @returns {{siguiente:()=>number, entre:(min:number,max:number)=>number,
 *            enteroEntre:(min:number,max:number)=>number, obtenerEstado:()=>number,
 *            restaurarEstado:(estado:number)=>void}}
 */
export function crearAleatorio(semilla = 2026) {
  // Estado interno de 32 bits sin signo.
  let estado = semilla >>> 0;

  /** Devuelve un número en [0, 1). */
  function siguiente() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Número real uniforme en [min, max). */
  function entre(min, max) {
    return min + siguiente() * (max - min);
  }

  /** Entero uniforme en [min, max] (ambos incluidos). */
  function enteroEntre(min, max) {
    return Math.floor(entre(min, max + 1));
  }

  /** Guarda el estado para poder repetir un turno desde el mismo punto. */
  function obtenerEstado() {
    return estado;
  }

  /** Restaura un estado guardado con obtenerEstado(). */
  function restaurarEstado(nuevo) {
    estado = nuevo >>> 0;
  }

  return { siguiente, entre, enteroEntre, obtenerEstado, restaurarEstado };
}
