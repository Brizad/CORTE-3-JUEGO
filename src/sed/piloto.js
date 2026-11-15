// Piloto automático del modo demostración (tecla D). Hace de jugador: una acción por turno de decisión.
// Solo usa la API pública de la Celda (evaluar y solicitar), así que todo pasa por δ y por la red de Petri.
//
// Reglas de orden seguro:
//   - Nunca pide un evento que el supervisor inhibe ni uno que no está definido (no hay intentos bloqueados).
//   - Despacha un AGV solo si los dos están libres: nunca t1a y t2a juntos, así que no hay deadlock.
//   - El brazo hace un trabajo a la vez: ir, abrir, cargar o descargar, cerrar (y vuelve solo).

import { CNCS } from './celda.js';

const PALABRA_REPARACION = 'HCTCR'; // pertenece a ^H(CT?)+R$

export class Piloto {
  /**
   * @param {import('./celda.js').Celda} celda
   * @param {{periodo?:number}} [opciones] periodo: segundos de simulación entre acciones (1 s, como el
   *   supuesto de clic del GDD, sección 15).
   */
  constructor(celda, { periodo = 1 } = {}) {
    this.celda = celda;
    this.reloj = celda.reloj;
    this.periodo = periodo;
    this.activo = false;
    this.acciones = 0;
    this._pendiente = null;
    this._ciclosDespachados = 0;
    this.bloqueadas = new Set(); // máquinas con el HUD abierto: el piloto no las toca
  }

  /** Después de restaurar el reloj (reintento), vuelve a programar el próximo turno de decisión. */
  reprogramar() {
    this._pendiente = null;
    if (this.activo) this._programar();
  }

  activar() {
    if (this.activo) return;
    this.activo = true;
    this._programar();
  }

  desactivar() {
    this.activo = false;
    if (this._pendiente !== null) this.reloj.cancelar(this._pendiente);
    this._pendiente = null;
  }

  alternar() {
    if (this.activo) this.desactivar();
    else this.activar();
    return this.activo;
  }

  _programar() {
    this._pendiente = this.reloj.programarEn(this.periodo, () => {
      this._pendiente = null;
      if (!this.activo) return;
      if (!this.celda.deadlock && !this.celda.terminado) this.decidir();
      this._programar();
    });
  }

  /** Elige una acción y la ejecuta. Devuelve la descripción de la acción o null si no hace nada. */
  decidir() {
    const accion = this._elegir();
    if (!accion) return null;
    const [maquina, evento, opciones] = accion;
    const r = this.celda.solicitar(maquina, evento, opciones);
    if (!r.ok) throw new Error(`El piloto pidió ${maquina}.${evento} y fue rechazado: ${r.motivo}`);
    this.acciones++;
    if (maquina.startsWith('AGV')) this._ciclosDespachados++;
    return accion;
  }

  /** ¿La acción tocaría una máquina con el HUD abierto? (la CNC y el brazo se afectan entre sí) */
  _ocupada(maquina, evento, opciones = {}) {
    const involucradas = new Set([maquina]);
    if (CNCS.includes(maquina) && (evento === 'cargar' || evento === 'descargar')) involucradas.add('BRAZO');
    if (maquina === 'BRAZO') {
      if (opciones.objetivo) involucradas.add(opciones.objetivo);
      if (this.celda.atendida) involucradas.add(this.celda.atendida);
    }
    return [...involucradas].some((m) => this.bloqueadas.has(m));
  }

  /** Primera acción posible, en orden de prioridad. */
  _elegir() {
    const c = this.celda;
    const posible = (maquina, evento, opciones) =>
      !this._ocupada(maquina, evento, opciones) && c.evaluar(maquina, evento, opciones) === null;

    // 1. Reparar una CNC en Falla con una palabra válida de la consola.
    for (const cnc of CNCS) {
      if (c.estado(cnc) === 'Falla' && !this._ocupada(cnc, 'reset')) return [cnc, 'reset', { palabra: PALABRA_REPARACION }];
    }
    // 2. Iniciar el fresado de una CNC cargada (si el supervisor lo permite).
    for (const cnc of CNCS) {
      if (c.estado(cnc) === 'Cargado' && posible(cnc, 'iniciar_fresado')) return [cnc, 'iniciar_fresado'];
    }
    // 3. Despachar un AGV si hay un pedido y los dos AGV están libres. Se alternan.
    if (c.pedidos.length > 0 && c.estado('AGV1') === 'Libre' && c.estado('AGV2') === 'Libre') {
      const orden = this._ciclosDespachados % 2 === 0 ? ['AGV1', 'AGV2'] : ['AGV2', 'AGV1'];
      for (const agv of orden) if (posible(agv, 'reservar')) return [agv, 'reservar'];
    }
    // 4. Trabajo del brazo.
    const estadoBrazo = c.estado('BRAZO');
    const cnc = c.atendida;
    if (estadoBrazo === 'Reposo') {
      // Primero una pieza terminada; si no hay, una CNC libre para cargar.
      for (const quiero of ['Terminado', 'Libre']) {
        for (const objetivo of CNCS) {
          if (c.estado(objetivo) === quiero && posible('BRAZO', 'mover', { objetivo })) return ['BRAZO', 'mover', { objetivo }];
        }
      }
      return null;
    }
    if (estadoBrazo === 'Mandril_Cerrado' && cnc) {
      if (['Terminado', 'Libre'].includes(c.estado(cnc)) && posible('BRAZO', 'abrir_mandril')) return ['BRAZO', 'abrir_mandril'];
      return null;
    }
    if (estadoBrazo === 'Mandril_Abierto' && cnc) {
      const q = c.estado(cnc);
      if (q === 'Terminado' && posible(cnc, 'descargar')) return [cnc, 'descargar'];
      if (q === 'Libre' && posible(cnc, 'cargar')) return [cnc, 'cargar'];
      if (q === 'Cargado' && posible('BRAZO', 'cerrar_mandril')) return ['BRAZO', 'cerrar_mandril'];
    }
    return null;
  }
}
