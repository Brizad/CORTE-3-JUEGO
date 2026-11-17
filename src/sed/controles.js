// Controles paso a paso (docs/GDD.md, sección 18.20): cada botón de la barra de control y cada tecla dispara UN solo evento del
// autómata. Aquí se describe cada "verbo" de juego: qué evento pide, si ahora se puede (verde), si no (gris) o si lo inhibe el
// supervisor (rojo), y la razón formal. Nada cambia de estado aquí: `ejecutar` solo llama a Celda.solicitar (δ, supervisor y red).
// Sin motor gráfico ni DOM: se prueba con Node.

import { TIEMPOS } from '../config.js';

/** Verbos de la barra de control: grupo, texto, tecla, y código y nombre del evento del autómata. */
export const VERBOS = [
  { id: 'ir1', grupo: 'BRAZO', verbo: 'Ir a CNC 1', tecla: 'Z', codigo: 'm', nombre: 'mover' },
  { id: 'ir2', grupo: 'BRAZO', verbo: 'Ir a CNC 2', tecla: 'X', codigo: 'm', nombre: 'mover' },
  { id: 'abrir', grupo: 'BRAZO', verbo: 'Abrir pinza', tecla: 'A', codigo: 'a', nombre: 'abrir_mandril' },
  { id: 'meter', grupo: 'BRAZO', verbo: 'Meter bloque', tecla: 'C', codigo: 'c', nombre: 'cargar' },
  { id: 'sacar', grupo: 'BRAZO', verbo: 'Sacar pieza', tecla: 'D', codigo: 'd', nombre: 'descargar' },
  { id: 'cerrar', grupo: 'BRAZO', verbo: 'Cerrar pinza', tecla: 'E', codigo: 'e', nombre: 'cerrar_mandril' },
  { id: 'volver', grupo: 'BRAZO', verbo: 'Volver', tecla: 'V', codigo: 'm', nombre: 'mover' },
  { id: 'fresar1', grupo: 'CNC1', verbo: 'Fresar', tecla: 'F', codigo: 'i', nombre: 'iniciar_fresado' },
  { id: 'fresar2', grupo: 'CNC2', verbo: 'Fresar', tecla: 'G', codigo: 'i', nombre: 'iniciar_fresado' },
  { id: 'agv1', grupo: 'AGV', verbo: 'Atender AGV 1', tecla: 'Q', codigo: 'v', nombre: 'reservar' },
  { id: 'agv2', grupo: 'AGV', verbo: 'Atender AGV 2', tecla: 'W', codigo: 'v', nombre: 'reservar' },
];
const POR_ID = new Map(VERBOS.map((v) => [v.id, v]));
const NOMBRE = { CNC1: 'CNC 1', CNC2: 'CNC 2', AGV1: 'AGV 1', AGV2: 'AGV 2', BRAZO: 'brazo' };
const estado = (q) => q.replace(/_/g, ' ');

/** Verbos que van en el panel de cada máquina (pestaña «Acciones»): solo los eventos de SU autómata. */
export function verbosDe(maquina) {
  if (maquina === 'CNC1' || maquina === 'CNC2') return ['meter', `fresar${maquina.slice(3)}`, 'sacar'];
  if (maquina === 'BRAZO') return ['ir1', 'ir2', 'abrir', 'meter', 'sacar', 'cerrar', 'volver'];
  return [`agv${maquina.slice(3)}`];
}

/** Progreso del fresado de una CNC (0 a 1) y los segundos que lleva. */
export function progresoFresado(celda, cnc) {
  if (celda.estado(cnc) !== 'Fresando') return { fraccion: 0, segundos: 0 };
  let t0 = 0;
  for (let i = celda.bitacora.length - 1; i >= 0; i--) {
    const e = celda.bitacora[i];
    if (e.tipo === 'automata' && e.maquina === cnc && e.evento === 'iniciar_fresado') { t0 = e.t; break; }
  }
  const segundos = Math.max(0, celda.reloj.ahora - t0);
  return { fraccion: Math.min(1, segundos / TIEMPOS.fresado), segundos };
}

/**
 * Describe un verbo ahora mismo.
 * @param {import('./celda.js').Celda} celda
 * @param {string} id Id del verbo (ver VERBOS).
 * @param {{cnc?:string}} [contexto] cnc: para «Meter bloque» y «Sacar pieza» en el panel de una CNC (en la barra es la que atiende el brazo).
 * @returns {{id:string, grupo:string, verbo:string, tecla:string, codigo:string, tipo:'verde'|'gris'|'rojo'|'reparar', tip:string,
 *   maquina?:string, evento?:string, opciones?:object, cnc?:string, fresando?:boolean}}
 */
export function describir(celda, id, contexto = {}) {
  const v = POR_ID.get(id);
  if (!v) throw new Error(`Verbo desconocido: ${id}`);
  const c = celda;
  const brazo = c.estado('BRAZO');
  const base = { ...v };
  const gris = (tip, extra = {}) => ({ ...base, ...extra, tipo: 'gris', tip });
  if (c.terminado) return gris('El turno terminó.');
  if (c.deadlock) return gris('Interbloqueo: ninguna transición está habilitada.');
  const rojo = (cnc) => `Supervisor: ${c.razonSupervisor}. Estado (${c.estado(cnc)}, ${brazo}). Intentarlo resta 15 puntos.`;
  // Resultado común para un evento que se pide a la Celda.
  const pedir = (maquina, evento, opciones, cnc, verde, indefinido) => {
    const motivo = c.evaluar(maquina, evento, opciones);
    const datos = { ...base, maquina, evento, opciones, cnc };
    if (motivo === null) return { ...datos, tipo: 'verde', tip: verde };
    if (motivo === 'supervisor') return { ...datos, tipo: 'rojo', tip: rojo(cnc) };
    if (motivo === 'celda') return { ...datos, tipo: 'gris', tip: 'Controlador de celda activo: falta Celda_libre (el otro AGV está en la celda).' };
    if (motivo === 'recurso') {
      const falta = c.faltaPara(maquina, evento, opciones ?? {});
      return { ...datos, tipo: 'gris', tip: `La red de Petri no habilita la transición: falta ${falta.join(', ') || 'un recurso'}.` };
    }
    return { ...datos, tipo: 'gris', tip: indefinido };
  };

  switch (id) {
    case 'ir1':
    case 'ir2': {
      const objetivo = `CNC${id.slice(2)}`;
      const donde = c.atendida ? `, atendiendo a la ${NOMBRE[c.atendida]}` : '';
      return pedir('BRAZO', 'mover', { objetivo }, objetivo, `Evento m · mover (transición tr_ir): el brazo va a la ${NOMBRE[objetivo]} y llega en 2 s.`,
        `δ no está definida: el brazo debe estar en Reposo (ahora: ${estado(brazo)}${donde}).`);
    }
    case 'abrir':
      return pedir('BRAZO', 'abrir_mandril', undefined, c.atendida, 'Evento a · abrir_mandril: abre la pinza.',
        `δ no está definida: el brazo debe estar en Mandril Cerrado frente a una CNC (ahora: ${estado(brazo)}).`);
    case 'cerrar':
      return pedir('BRAZO', 'cerrar_mandril', undefined, c.atendida, 'Evento e · cerrar_mandril: cierra la pinza y el brazo vuelve solo a reposo.',
        `δ no está definida: el brazo debe estar en Mandril Abierto (ahora: ${estado(brazo)}).`);
    case 'volver':
      return pedir('BRAZO', 'volver', undefined, c.atendida, 'Evento m · mover (transición tr_volver): el brazo vuelve a reposo.',
        `δ no está definida: solo desde Mandril Cerrado frente a una CNC (ahora: ${estado(brazo)}). Tras cerrar la pinza el brazo vuelve solo.`);
    case 'meter':
    case 'sacar': {
      const evento = id === 'meter' ? 'cargar' : 'descargar';
      const necesita = id === 'meter' ? 'Libre' : 'Terminado';
      const cnc = contexto.cnc ?? c.atendida;
      if (!cnc) return gris('El brazo no está en ninguna CNC: muévelo primero con «Ir a CNC 1» o «Ir a CNC 2».');
      if (c.atendida !== cnc) {
        return gris(c.atendida ? `El brazo atiende a la ${NOMBRE[c.atendida]}, no a esta CNC.` : 'El brazo debe estar frente a esta CNC: muévelo con «Ir a CNC».', { cnc });
      }
      const verde = id === 'meter'
        ? `Evento c · cargar (compartido: la ${NOMBRE[cnc]} y el brazo lo ejecutan a la vez).`
        : `Evento d · descargar (compartido): saca la pieza de la ${NOMBRE[cnc]} y suma 100 puntos.`;
      const falta = brazo !== 'Mandril_Abierto'
        ? `δ no está definida: el brazo debe estar en Mandril Abierto frente a la ${NOMBRE[cnc]} (ahora: ${estado(brazo)}).`
        : `δ no está definida: la ${NOMBRE[cnc]} debe estar en ${necesita} (ahora: ${estado(c.estado(cnc))}).`;
      return pedir(cnc, evento, undefined, cnc, verde, falta);
    }
    case 'fresar1':
    case 'fresar2': {
      const cnc = `CNC${id.slice(6)}`;
      const q = c.estado(cnc);
      if (q === 'Falla') return { ...base, verbo: 'Reparar', cnc, tipo: 'reparar', tip: `La ${NOMBRE[cnc]} está en Falla: abre su consola y escribe H C T C R y Enter.` };
      if (q === 'Fresando') return gris('Fresando: el evento f · fin_fresado lo dispara el reloj a los 10 s (no es controlable).', { cnc, fresando: true });
      return pedir(cnc, 'iniciar_fresado', undefined, cnc, `Evento i · iniciar_fresado: la ${NOMBRE[cnc]} fresa 10 s.`,
        `δ no está definida: la ${NOMBRE[cnc]} debe estar en Cargado (ahora: ${estado(q)}).`);
    }
    case 'agv1':
    case 'agv2': {
      const agv = `AGV${id.slice(3)}`;
      const recurso = agv === 'AGV1' ? 'la mesa' : 'el robot';
      return pedir(agv, 'reservar', undefined, null, `Evento v · reservar (transición t${agv.slice(3)}a): el ${NOMBRE[agv]} toma ${recurso} y trae el metal.`,
        `δ no está definida: el ${NOMBRE[agv]} debe estar Libre (ahora: ${estado(c.estado(agv))}).`);
    }
    default:
      return gris('');
  }
}

/**
 * Pulsa un verbo: pide SU evento a la Celda. Verde lo ejecuta; rojo lo intenta (el supervisor lo bloquea y resta 15);
 * gris no hace nada; «Reparar» no dispara ningún evento (solo pide abrir la consola).
 * @returns {{ok:boolean, tipo:string, tip:string, reparar?:string, motivo?:string}}
 */
export function ejecutar(celda, id, contexto = {}) {
  const d = describir(celda, id, contexto);
  if (d.tipo === 'reparar') return { ok: false, tipo: d.tipo, tip: d.tip, reparar: d.cnc };
  if (d.tipo === 'gris') return { ok: false, tipo: d.tipo, tip: d.tip, motivo: 'gris' };
  const r = celda.solicitar(d.maquina, d.evento, d.opciones);
  return { ...r, tipo: d.tipo, tip: d.tip };
}
