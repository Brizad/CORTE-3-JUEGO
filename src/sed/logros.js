// Los 6 logros del GDD (sección 12). Cada uno tiene una condición verificable que se comprueba con los eventos de la Celda.
// Sin motor gráfico ni DOM. El estado que dura toda la partida (logros ganados y racha de reparaciones) vive en `persistente`.

export const LOGROS = [
  {
    id: 'primera_pieza', nombre: 'Primera pieza', descripcion: 'Descarga tu primera pieza (evento d de una CNC).',
    significa: 'Completaste el ciclo de una CNC: meter el bloque, fresar y sacar la pieza terminada.',
    comoSeGana: 'Saca una pieza terminada de cualquier CNC (botón «Sacar pieza», tecla D).',
  },
  {
    id: 'mecanico_fino', nombre: 'Mecánico fino', descripcion: '3 reparaciones válidas seguidas, sin ninguna palabra inválida entre ellas.',
    significa: 'Sabes reparar una CNC en Falla escribiendo una palabra del lenguaje de reparación.',
    comoSeGana: 'Repara 3 fallas seguidas con palabras válidas (por ejemplo H C T C R) sin equivocarte entre una y otra.',
  },
  {
    id: 'manos_seguras', nombre: 'Manos seguras', descripcion: 'Termina un turno ganado con 0 intentos bloqueados por el supervisor.',
    significa: 'Jugaste un turno entero sin pedirle al supervisor nada prohibido.',
    comoSeGana: 'Gana un turno sin pulsar ni una vez un botón rojo.',
  },
  {
    id: 'ojo_de_radar', nombre: 'Ojo de radar', descripcion: '3 cambios del radar de amarillo a verde dentro de un mismo turno.',
    significa: 'Viste el peligro de interbloqueo a tiempo y lo evitaste.',
    comoSeGana: 'En un mismo turno, haz que el radar pase de amarillo a verde 3 veces (sin llegar a rojo).',
  },
  {
    id: 'sin_red_de_seguridad', nombre: 'Sin red de seguridad', descripcion: 'Gana el turno 3 sin comprar el Controlador de celda y sin deadlock.',
    significa: 'Terminaste la partida evitando el interbloqueo solo con tu cabeza.',
    comoSeGana: 'Gana el turno 3 sin comprar el Controlador de celda y sin que la celda se trabe.',
  },
  {
    id: 'doble_husillo', nombre: 'Doble husillo', descripcion: 'Las 2 CNC en Fresando a la vez, 30 s acumulados en un turno.',
    significa: 'Mantuviste las dos máquinas trabajando en paralelo.',
    comoSeGana: 'Ten las 2 CNC fresando al mismo tiempo durante 30 s en total (en un mismo turno).',
  },
];

const SEGUNDOS_DOBLE_HUSILLO = 30;

/** Estado que se conserva entre turnos. */
export function logrosPersistentes() {
  return { ganados: new Set(), racha: 0 };
}

export class Logros {
  /**
   * @param {object} persistente Resultado de logrosPersistentes() (se comparte entre turnos).
   * @param {number} indiceTurno 0, 1 o 2.
   * @param {(logro:object)=>void} alGanar Se llama una vez por cada logro nuevo.
   */
  constructor(persistente, indiceTurno, alGanar) {
    this.p = persistente;
    this.indiceTurno = indiceTurno;
    this.alGanar = alGanar;
    // Estado del turno actual.
    this.radarVerdes = 0;
    this.controladorComprado = false;
    this.deadlocks = 0;
    this.dobleAcumulado = 0; // s con las 2 CNC fresando
    this._dobleDesde = null;
    this._baja = null;
  }

  /** Empieza a vigilar la Celda. */
  vigilar(celda) {
    this.celda = celda;
    this._baja = celda.alCambiar((e) => this._evento(e));
  }

  detener() {
    this._baja?.();
    this._baja = null;
  }

  _ganar(id) {
    if (this.p.ganados.has(id)) return;
    this.p.ganados.add(id);
    this.alGanar(LOGROS.find((l) => l.id === id));
  }

  _evento(e) {
    const c = this.celda;
    switch (e.tipo) {
      case 'automata':
        if (e.maquina.startsWith('CNC') && e.evento === 'descargar') this._ganar('primera_pieza');
        this._actualizarDoble(e.t);
        break;
      case 'reparacion':
        if (e.valida) {
          this.p.racha++;
          if (this.p.racha >= 3) this._ganar('mecanico_fino');
        } else this.p.racha = 0;
        break;
      case 'radar':
        if (e.anterior === 'amarillo' && e.nivel === 'verde') {
          this.radarVerdes++;
          if (this.radarVerdes >= 3) this._ganar('ojo_de_radar');
        }
        break;
      case 'controlador':
        if (e.activo) this.controladorComprado = true;
        break;
      case 'deadlock':
        this.deadlocks++;
        break;
      case 'finTurno':
        if (e.resultado === 'victoria') {
          if (c.estadisticas.bloqueos === 0) this._ganar('manos_seguras');
          if (this.indiceTurno === 2 && !this.controladorComprado && this.deadlocks === 0) this._ganar('sin_red_de_seguridad');
        }
        break;
      default:
    }
  }

  /** Acumula los segundos con las 2 CNC fresando a la vez. */
  _actualizarDoble(t) {
    const c = this.celda;
    const ambas = c.estado('CNC1') === 'Fresando' && c.estado('CNC2') === 'Fresando';
    if (ambas && this._dobleDesde === null) this._dobleDesde = t;
    else if (!ambas && this._dobleDesde !== null) {
      this.dobleAcumulado += t - this._dobleDesde;
      this._dobleDesde = null;
    }
    if (this.dobleAcumulado >= SEGUNDOS_DOBLE_HUSILLO) this._ganar('doble_husillo');
  }

  /** Progreso de cada logro (para el Inspector). */
  progreso() {
    const doble = Math.min(SEGUNDOS_DOBLE_HUSILLO, this.dobleAcumulado + (this._dobleDesde !== null ? this.celda.reloj.ahora - this._dobleDesde : 0));
    const texto = {
      primera_pieza: this.p.ganados.has('primera_pieza') ? 'conseguido' : 'ninguna pieza descargada todavía',
      mecanico_fino: `racha de reparaciones válidas: ${Math.min(3, this.p.racha)} / 3`,
      manos_seguras: `intentos bloqueados en este turno: ${this.celda.estadisticas.bloqueos}`,
      ojo_de_radar: `amarillo a verde en este turno: ${Math.min(3, this.radarVerdes)} / 3`,
      sin_red_de_seguridad: `turno ${this.indiceTurno + 1}${this.controladorComprado ? ', Controlador comprado' : ''}${this.deadlocks ? `, ${this.deadlocks} deadlock` : ''}`,
      doble_husillo: `${doble.toFixed(0)} / ${SEGUNDOS_DOBLE_HUSILLO} s con las 2 CNC fresando`,
    };
    return LOGROS.map((l) => ({ ...l, ganado: this.p.ganados.has(l.id), texto: texto[l.id] }));
  }
}
