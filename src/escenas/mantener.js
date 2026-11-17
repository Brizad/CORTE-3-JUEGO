// Mantener presionado (táctil) para ver el tooltip de un botón (docs/GDD.md, sección 18.21): 0,5 s de tiempo REAL.
// Se mide con el reloj del navegador y no con el de la escena, que avanza por cuadros (si el juego va lento, tardaría más).

export const MANTENER_MS = 500;

/** Llama a `fn` si el dedo sigue apoyado tras `ms` milisegundos. Devuelve { remove } para cancelarlo al soltar. */
export function alMantener(escena, fn, ms = MANTENER_MS) {
  const id = setTimeout(() => {
    if (escena.sys.isActive()) fn();
  }, ms);
  return { remove: () => clearTimeout(id) };
}
