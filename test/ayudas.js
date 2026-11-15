// Funciones comunes de las pruebas (no contiene pruebas propias).
import fs from 'node:fs';

/** Lee un modelo de src/sed/modelos/ (por ejemplo "cnc.json"). */
export function cargarModelo(archivo) {
  const url = new URL(`../src/sed/modelos/${archivo}`, import.meta.url);
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}
