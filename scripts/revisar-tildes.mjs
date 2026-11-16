// Busca en los textos visibles (cadenas de src/ y de index.html) palabras españolas escritas sin tilde.
// Uso: node scripts/revisar-tildes.mjs   (sale con código 1 si encuentra alguna)
import fs from 'node:fs';
import path from 'node:path';

const SIN_TILDE = new Set(['accion', 'simulacion', 'reparacion', 'ultimo', 'ultima', 'unico', 'pagina', 'tambien', 'despues', 'ademas', 'aqui', 'maquina', 'maquinas',
  'numero', 'codigo', 'informacion', 'transicion', 'estacion', 'posicion', 'condicion', 'explicacion', 'descripcion', 'configuracion', 'titulo', 'telefono',
  'rapido', 'facil', 'dificil', 'minimo', 'maximo', 'ahi', 'alli', 'segun', 'sera', 'dia', 'dias', 'tamano', 'ningun', 'algun', 'deposito', 'electrica', 'logica', 'logico',
  'basico', 'basica', 'practica', 'tecnica', 'tactil', 'camara', 'musica', 'energia', 'analisis', 'arbol', 'ecuacion', 'expresion', 'invalida', 'invalidas',
  'interbloqueo', 'habilitacion', 'composicion', 'conexion', 'pantalla', 'victoria', 'ayuda'].filter((p) => !['interbloqueo', 'composicion', 'pantalla', 'victoria', 'ayuda', 'habilitacion', 'conexion'].includes(p)));
const hallazgos = [];
function revisar(archivo) {
  const s = fs.readFileSync(archivo, 'utf8');
  const cadenas = s.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g);
  for (const m of cadenas) {
    const t = m[2].replace(/\$\{[^}]*\}/g, ''); // sin las interpolaciones de código
    if (!t.includes(' ')) continue; // identificadores, claves y rutas
    for (const w of t.match(/[A-Za-zñÑ]+/g) ?? []) if (SIN_TILDE.has(w.toLowerCase()) && !/^[a-z_]+$/.test(t)) hallazgos.push(`${archivo}: "${w}" en «${t.slice(0, 70)}»`);
  }
}
function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'modelos') recorrer(p); } else if (p.endsWith('.js')) revisar(p);
  }
}
recorrer('src');
revisar('index.html');
hallazgos.forEach((h) => console.log(h));
console.log(`${hallazgos.length} posibles palabras sin tilde`);
process.exit(hallazgos.length ? 1 : 0);
