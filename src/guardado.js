// Guardado local (docs/GDD.md, secciones 18.14 y 18.21): jugadores, sus logros (con fecha) y su mejor puntaje, y la tabla
// "Mejores puntajes" (top 10) en localStorage. Sin servidor.
// Todo va dentro de try/catch: si el almacenamiento no existe, está lleno o está bloqueado (incógnito, ZIP del aula virtual),
// el juego funciona igual sin guardar y sin mostrar errores. Mientras tanto, lo de esta sesión vive en memoria.
// Sin Phaser: el almacenamiento se puede pasar como argumento (las pruebas usan uno falso).

export const CLAVE_GUARDADO = 'robocell-tycoon-2.5d';
export const MAX_NOMBRE = 16;
export const MAX_PUNTAJES = 10;

const VACIO = () => ({ version: 2, ultimo: null, jugadores: {}, puntajes: [] });

// Copia en memoria por almacén: si escribir falla, el jugador y sus logros siguen durante la sesión.
const memoria = new WeakMap();
const SIN_ALMACEN = {};
const claveMemoria = (almacen) => (almacen && typeof almacen === 'object' ? almacen : SIN_ALMACEN);

function almacenPorDefecto() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // el acceso mismo puede lanzar un error (modo privado, cookies bloqueadas)
  }
}

/** Nombre válido: sin espacios a los lados, de 1 a 16 caracteres. Devuelve null si queda vacío. */
export function validarNombre(nombre) {
  if (typeof nombre !== 'string') return null;
  const limpio = nombre.replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE).trim();
  return limpio || null;
}

function normalizarJugador(j) {
  const logros = {};
  if (j && typeof j.logros === 'object' && j.logros) {
    for (const [id, fecha] of Object.entries(j.logros)) if (typeof fecha === 'string') logros[id] = fecha;
  }
  return { mejorPuntaje: Number.isFinite(j?.mejorPuntaje) ? j.mejorPuntaje : 0, logros };
}

function normalizarPuntaje(p) {
  if (!p || typeof p !== 'object') return null;
  const nombre = validarNombre(p.nombre);
  if (!nombre || !Number.isFinite(p.puntaje)) return null;
  return {
    id: typeof p.id === 'string' ? p.id : `${nombre}-${p.fecha ?? ''}`,
    nombre,
    puntaje: p.puntaje,
    turno: Number.isFinite(p.turno) ? p.turno : 1,
    fecha: typeof p.fecha === 'string' ? p.fecha : '',
  };
}

function ordenar(lista) {
  return lista.sort((a, b) => b.puntaje - a.puntaje || b.turno - a.turno || a.fecha.localeCompare(b.fecha)).slice(0, MAX_PUNTAJES);
}

/** Lee lo guardado. Nunca lanza: ante cualquier problema devuelve lo de la sesión (o el guardado vacío). */
export function leerGuardado(almacen = almacenPorDefecto()) {
  const enMemoria = memoria.get(claveMemoria(almacen));
  if (enMemoria?.fallo) return structuredClone(enMemoria.g); // la última escritura falló: manda lo de la sesión
  let d = null;
  try {
    const crudo = almacen?.getItem(CLAVE_GUARDADO);
    d = crudo ? JSON.parse(crudo) : null;
  } catch {
    d = null;
  }
  if (!d || typeof d !== 'object') return structuredClone(enMemoria?.g ?? VACIO());
  const g = VACIO();
  g.ultimo = validarNombre(d.ultimo);
  if (d.jugadores && typeof d.jugadores === 'object') {
    for (const [nombre, j] of Object.entries(d.jugadores)) {
      const n = validarNombre(nombre);
      if (n) g.jugadores[n] = normalizarJugador(j);
    }
  }
  if (Array.isArray(d.puntajes)) g.puntajes = ordenar(d.puntajes.map(normalizarPuntaje).filter(Boolean));
  // Guardado de la versión anterior (sin jugadores): su mejor puntaje y sus logros pasan al jugador "Jugador".
  if (!d.version && (Number.isFinite(d.mejorPuntaje) || Array.isArray(d.logros))) {
    const logros = {};
    for (const id of Array.isArray(d.logros) ? d.logros : []) if (typeof id === 'string') logros[id] = '';
    g.jugadores.Jugador = { mejorPuntaje: Number.isFinite(d.mejorPuntaje) ? d.mejorPuntaje : 0, logros };
  }
  return g;
}

function escribir(g, almacen) {
  let fallo = !almacen;
  try {
    almacen?.setItem(CLAVE_GUARDADO, JSON.stringify(g));
  } catch {
    fallo = true; // sin almacenamiento: no se guarda y ya (queda en memoria durante la sesión)
  }
  memoria.set(claveMemoria(almacen), { g: structuredClone(g), fallo });
  return !fallo;
}

/** Último jugador que entró (o null si nunca se pidió el nombre). */
export function jugadorActual(almacen = almacenPorDefecto()) {
  return leerGuardado(almacen).ultimo;
}

/** Fija el jugador actual (lo crea si no existe). Devuelve el nombre válido o null si el nombre no sirve. */
export function fijarJugador(nombre, almacen = almacenPorDefecto()) {
  const n = validarNombre(nombre);
  if (!n) return null;
  const g = leerGuardado(almacen);
  g.ultimo = n;
  g.jugadores[n] ??= normalizarJugador(null);
  escribir(g, almacen);
  return n;
}

/** Datos de un jugador: mejor puntaje y logros ganados { id: fecha ISO }. */
export function datosJugador(nombre, almacen = almacenPorDefecto()) {
  const n = validarNombre(nombre);
  return normalizarJugador(n ? leerGuardado(almacen).jugadores[n] : null);
}

/** Guarda los logros ganados por un jugador; los que ya tenía conservan su fecha. Devuelve sus logros. */
export function guardarLogros(nombre, ids, almacen = almacenPorDefecto(), fecha = new Date().toISOString()) {
  const n = validarNombre(nombre);
  if (!n) return {};
  const g = leerGuardado(almacen);
  const j = (g.jugadores[n] ??= normalizarJugador(null));
  for (const id of ids ?? []) if (typeof id === 'string' && !j.logros[id]) j.logros[id] = fecha;
  escribir(g, almacen);
  return j.logros;
}

/**
 * Registra el resultado de una partida en "Mejores puntajes" (top 10) y en el mejor puntaje del jugador.
 * Una partida ocupa UNA fila (por su id): si se reintenta un turno o se sigue jugando, la fila se actualiza.
 * @param {{id:string, nombre:string, puntaje:number, turno:number, fecha?:string}} datos
 * @returns {Array<{id,nombre,puntaje,turno,fecha}>} la tabla resultante
 */
export function registrarPuntaje(datos, almacen = almacenPorDefecto()) {
  const fila = normalizarPuntaje({ fecha: new Date().toISOString(), ...datos });
  const g = leerGuardado(almacen);
  if (!fila) return g.puntajes;
  const j = (g.jugadores[fila.nombre] ??= normalizarJugador(null));
  j.mejorPuntaje = Math.max(j.mejorPuntaje, fila.puntaje);
  g.puntajes = ordenar([...g.puntajes.filter((p) => p.id !== fila.id), fila]);
  escribir(g, almacen);
  return g.puntajes;
}

/** Tabla "Mejores puntajes" (hasta 10 filas, de mayor a menor). */
export function mejoresPuntajes(almacen = almacenPorDefecto()) {
  return leerGuardado(almacen).puntajes;
}

/** Borra la tabla de mejores puntajes y el mejor puntaje de cada jugador (los logros se conservan). */
export function borrarPuntajes(almacen = almacenPorDefecto()) {
  const g = leerGuardado(almacen);
  g.puntajes = [];
  for (const j of Object.values(g.jugadores)) j.mejorPuntaje = 0;
  escribir(g, almacen);
  return g;
}

/** Fecha corta para mostrar (dd/mm/aaaa) a partir de una fecha ISO; '' si no hay. */
export function fechaCorta(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}
