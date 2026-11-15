// Color e ícono de cada estado de cada autómata (docs/arte.md, sección 5).
// Solo datos: el estado lo decide el autómata, aquí se traduce a cómo se ve.

import { COLORES } from '../config.js';

// [color del estado, ícono]. Los colores son los 4 fijos de la paleta.
const TABLA = {
  CNC: {
    Libre: ['espera', 'circulo'],
    Cargado: ['espera', 'pieza'],
    Fresando: ['operacion', 'chispas'],
    Terminado: ['espera', 'verificacion'],
    Falla: ['fallo', 'rayo'],
  },
  BRAZO: {
    Reposo: ['espera', 'casa'],
    Moviendo: ['operacion', 'flechas'],
    Mandril_Cerrado: ['operacion', 'pinzaCerrada'],
    Mandril_Abierto: ['espera', 'pinzaAbierta'],
  },
  AGV: {
    Libre: ['espera', 'circulo'],
    Viajando: ['operacion', 'flecha'],
    Esperando: ['espera', 'relojArena'],
    Descargando: ['operacion', 'caja'],
  },
};

/**
 * Aspecto de un estado.
 * @param {'CNC'|'BRAZO'|'AGV'} tipo Tipo de máquina.
 * @param {string} estado Nombre del estado del autómata.
 * @returns {{color:number, nombreColor:string, icono:string}}
 */
export function aspectoDe(tipo, estado) {
  const fila = TABLA[tipo]?.[estado];
  if (!fila) throw new Error(`Sin aspecto para ${tipo} en el estado ${estado}`);
  return { color: COLORES[fila[0]], nombreColor: fila[0], icono: fila[1] };
}

/** Estados que tiene cada tipo (para comprobar que no falta ninguno). */
export function estadosDe(tipo) {
  return Object.keys(TABLA[tipo]);
}
