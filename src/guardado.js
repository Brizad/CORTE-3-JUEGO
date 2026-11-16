// Guardado local (docs/GDD.md, sección 18.14): mejor puntaje y logros ganados en localStorage.
// Todo va dentro de try/catch: si el almacenamiento no existe, está lleno o está bloqueado, el juego sigue funcionando.
// Sin Phaser: el almacenamiento se puede pasar como argumento (las pruebas usan uno falso).

export const CLAVE_GUARDADO = 'robocell-tycoon-2.5d';

const VACIO = () => ({ mejorPuntaje: 0, logros: [] });

function almacenPorDefecto() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // el acceso mismo puede lanzar un error (modo privado, cookies bloqueadas)
  }
}

/** Lee lo guardado. Nunca lanza: ante cualquier problema devuelve el guardado vacío. */
export function leerGuardado(almacen = almacenPorDefecto()) {
  try {
    const crudo = almacen?.getItem(CLAVE_GUARDADO);
    if (!crudo) return VACIO();
    const d = JSON.parse(crudo);
    return {
      mejorPuntaje: Number.isFinite(d?.mejorPuntaje) ? d.mejorPuntaje : 0,
      logros: Array.isArray(d?.logros) ? d.logros.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return VACIO();
  }
}

/**
 * Combina un resultado con lo guardado (el mejor puntaje y la unión de logros) y lo escribe.
 * @returns {{mejorPuntaje:number, logros:string[]}} el guardado resultante (aunque no se haya podido escribir)
 */
export function guardarResultado({ puntaje = 0, logros = [] } = {}, almacen = almacenPorDefecto()) {
  const actual = leerGuardado(almacen);
  const nuevo = {
    mejorPuntaje: Math.max(actual.mejorPuntaje, Number.isFinite(puntaje) ? puntaje : 0),
    logros: [...new Set([...actual.logros, ...logros])],
  };
  try {
    almacen?.setItem(CLAVE_GUARDADO, JSON.stringify(nuevo));
  } catch {
    /* sin almacenamiento: no se guarda y ya */
  }
  return nuevo;
}
