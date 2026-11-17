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
  if (c.terminado) return gris('El turno terminó.', { razon: razones(c, { motivo: 'turno_terminado' }) });
  if (c.deadlock) return gris('Interbloqueo: ninguna transición está habilitada.', { razon: razones(c, { motivo: 'deadlock' }) });
  const rojo = (cnc) => `Supervisor: ${c.razonSupervisor}. Estado (${c.estado(cnc)}, ${brazo}). Intentarlo resta 15 puntos.`;
  // Resultado común para un evento que se pide a la Celda.
  const pedir = (maquina, evento, opciones, cnc, verde, indefinido) => {
    const motivo = c.evaluar(maquina, evento, opciones);
    const datos = { ...base, maquina, evento, opciones, cnc, razon: razones(c, { maquina, evento, opciones, motivo, cnc }) };
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
      if (!cnc) return gris('El brazo no está en ninguna CNC: muévelo primero con «Ir a CNC 1» o «Ir a CNC 2».', { razon: razones(c, { evento, motivo: 'sin_cnc' }) });
      if (c.atendida !== cnc) {
        return gris(c.atendida ? `El brazo atiende a la ${NOMBRE[c.atendida]}, no a esta CNC.` : 'El brazo debe estar frente a esta CNC: muévelo con «Ir a CNC».', {
          cnc, razon: razones(c, { evento, cnc, motivo: c.atendida ? 'otra_cnc' : 'sin_cnc' }),
        });
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
      if (q === 'Fresando') {
        return gris('Fresando: el evento f · fin_fresado lo dispara el reloj a los 10 s (no es controlable).', {
          cnc, fresando: true,
          razon: { simple: `No puedes fresar otra vez: la ${NOMBRE[cnc]} ya está fresando y termina sola.`, formal: 'δ_CNC(Fresando, i) no está definida; f · fin_fresado es no controlable (reloj, 10 s).' },
        });
      }
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
  if (d.tipo === 'gris') return { ok: false, tipo: d.tipo, tip: d.tip, motivo: 'gris', razon: d.razon };
  const r = celda.solicitar(d.maquina, d.evento, d.opciones);
  return { ...r, tipo: d.tipo, tip: d.tip, razon: r.ok ? null : d.razon };
}

// ---- Razón de un botón bloqueado en 2 líneas (guía p. 20, punto 3; docs/GDD.md, sección 18.21) ----

const CODIGO = { mover: 'm', volver: 'm', abrir_mandril: 'a', cargar: 'c', descargar: 'd', cerrar_mandril: 'e', iniciar_fresado: 'i', reservar: 'v' };
const LUGAR_SIMPLE = { Mesa_libre: 'la mesa', Robot_libre: 'el robot', Celda_libre: 'la celda' };
const BRAZO_SIMPLE = {
  Reposo: 'está en reposo', Moviendo: 'va en camino', Mandril_Cerrado: 'tiene la pinza cerrada', Mandril_Abierto: 'tiene la pinza abierta dentro de la CNC',
};
const CNC_SIMPLE = { Libre: 'está vacía', Cargado: 'tiene un bloque sin fresar', Fresando: 'está fresando', Terminado: 'tiene una pieza terminada', Falla: 'está en Falla' };
const ACCION_SIMPLE = {
  mover: 'mover el brazo', volver: 'volver', abrir_mandril: 'abrir la pinza', cerrar_mandril: 'cerrar la pinza', cargar: 'meter el bloque',
  descargar: 'sacar la pieza', iniciar_fresado: 'fresar', reservar: 'atender este AGV',
};

/**
 * Explica por qué un evento no se puede pedir ahora, en 2 líneas: primero en palabras simples y debajo la razón formal.
 * @param {import('./celda.js').Celda} celda
 * @param {{maquina?:string, evento?:string, opciones?:object, motivo:string|null, cnc?:string|null, codigo?:string}} datos
 *   motivo: el de Celda.evaluar ('indefinido', 'recurso', 'supervisor', 'celda', 'turno_terminado'), 'deadlock',
 *   'no_controlable', 'sin_cnc' (el brazo no atiende a ninguna CNC) u 'otra_cnc' (atiende a otra).
 * @returns {{simple:string, formal:string}|null} null si el evento se puede pedir (motivo null).
 */
export function razones(celda, { maquina, evento, opciones = {}, motivo, cnc = null, codigo: codigoDado }) {
  if (!motivo) return null;
  const c = celda;
  const brazo = c.estado('BRAZO');
  const accion = ACCION_SIMPLE[evento] ?? 'hacer eso';
  const codigo = codigoDado ?? CODIGO[evento] ?? evento;
  const quien = cnc ?? (maquina?.startsWith('CNC') ? maquina : c.atendida);
  const nombreCnc = quien ? NOMBRE[quien] : 'la CNC';
  switch (motivo) {
    case 'turno_terminado':
      return { simple: 'El turno ya terminó.', formal: 'Fin del turno: la Celda ya no acepta eventos.' };
    case 'deadlock':
      return { simple: 'La celda está trabada: ya no se puede mover nada.', formal: 'Marcado muerto: ninguna transición está habilitada.' };
    case 'no_controlable':
      return { simple: 'Esto ocurre solo; no se pulsa.', formal: `Evento no controlable (Σ_u): ${codigo} · ${evento}.` };
    case 'sin_cnc':
      return { simple: `No puedes ${accion}: primero lleva el brazo a la CNC.`, formal: `${codigo} · ${evento} es compartido (CNC ‖ Brazo) y el brazo no atiende a ninguna CNC.` };
    case 'otra_cnc':
      return { simple: `No puedes ${accion} aquí: el brazo está en la ${NOMBRE[c.atendida]}.`, formal: `${codigo} · ${evento} es compartido: el brazo atiende a ${c.atendida}, no a ${quien}.` };
    case 'supervisor': {
      const simple = evento === 'iniciar_fresado'
        ? `No puedes fresar: la pinza está abierta dentro de la ${nombreCnc}.`
        : evento === 'abrir_mandril'
          ? `No puedes abrir la pinza: la ${nombreCnc} está fresando.`
          : `No puedes ${accion}: la ${nombreCnc} fresaría con la pinza abierta dentro.`;
      return { simple, formal: `${c.razonSupervisor}  ·  estado (${quien ? c.estado(quien) : '?'}, ${brazo})` };
    }
    case 'celda':
      return {
        simple: 'No puedes atender este AGV: el otro AGV está en la celda y el Controlador deja pasar a uno solo.',
        formal: 'Pre pide 1 ficha en Celda_libre (p10) y M(p10) = 0.',
      };
    case 'recurso': {
      const falta = c.faltaPara(maquina, evento, opciones);
      const cosas = falta.map((n) => LUGAR_SIMPLE[n.replace(' (llena)', '')] ?? n.replace(/_/g, ' '));
      const simple = cosas.length ? `No puedes ${accion}: ${cosas.join(' y ')} ${cosas.length > 1 ? 'están ocupados' : 'está ocupado'}.` : `No puedes ${accion}: falta un recurso.`;
      return { simple: simple.replace('la mesa está ocupado', 'la mesa está ocupada').replace('la celda está ocupado', 'la celda está ocupada'), formal: `Red de Petri: M < Pre en ${falta.join(', ') || 'un lugar'} (la transición no está habilitada).` };
    }
    default: {
      // 'indefinido': δ no está definida en el estado actual.
      const propio = maquina === 'BRAZO' || evento === 'mover' || evento === 'volver' || evento === 'abrir_mandril' || evento === 'cerrar_mandril';
      const q = maquina && c.automatas?.[maquina] ? c.estado(maquina) : null;
      let simple;
      if (propio) {
        if (evento === 'abrir_mandril' && brazo === 'Reposo') simple = 'No puedes abrir la pinza: primero lleva el brazo a una CNC.';
        else simple = `No puedes ${accion}: el brazo ${BRAZO_SIMPLE[brazo] ?? brazo}.`;
        return { simple, formal: `δ_Brazo(${brazo}, ${codigo}) no está definida.` };
      }
      if (evento === 'cargar' || evento === 'descargar') {
        const qc = c.estado(quien);
        simple = brazo !== 'Mandril_Abierto'
          ? `No puedes ${accion}: primero abre la pinza dentro de la ${nombreCnc}.`
          : `No puedes ${accion}: la ${nombreCnc} ${CNC_SIMPLE[qc] ?? qc}.`;
        return { simple, formal: `δ_CNC(${qc}, ${codigo}) o δ_Brazo(${brazo}, ${codigo}) no está definida.` };
      }
      if (evento === 'reservar') {
        return { simple: `No puedes ${accion}: el ${NOMBRE[maquina]} ya está ocupado (${String(q).replace(/_/g, ' ')}).`, formal: `δ_${maquina}(${q}, v) no está definida.` };
      }
      simple = `No puedes ${accion}: la ${nombreCnc} ${CNC_SIMPLE[q] ?? q}.`;
      return { simple, formal: `δ_${maquina}(${q}, ${codigo}) no está definida.` };
    }
  }
}

/** Texto del tooltip de un botón: verde = su tip; rojo o gris = las 2 líneas (simple y formal). */
export function textoTooltip(d) {
  if (d.razon) return `${d.razon.simple}\n${d.razon.formal}`;
  return d.tip;
}
