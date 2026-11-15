// Autómata de estado finito G = (Q, Σ, δ, q0, Qm). Una instancia por máquina.
// Sin motor gráfico ni DOM. El estado solo cambia por la tabla δ: si δ(q, σ) no está definida,
// ejecutar() lanza un error. No hay atajos.

export class Automata {
  /**
   * @param {object} json Modelo con nombre, estados, inicial, marcados, eventos y transiciones
   *   (formato de src/sed/modelos/*.json). Las transiciones son [origen, evento, destino].
   */
  constructor(json) {
    this.nombre = json.nombre;
    this.estados = [...json.estados];
    this.inicial = json.inicial;
    this.marcados = new Set(json.marcados);
    this.eventos = new Map(json.eventos.map((e) => [e.id, { ...e }]));
    this._porCodigo = new Map(json.eventos.map((e) => [e.codigo, e.id]));

    // Tabla δ: estado -> (evento -> destino). Debe ser determinista.
    this._delta = new Map(this.estados.map((q) => [q, new Map()]));
    for (const [origen, evento, destino] of json.transiciones) {
      if (!this._delta.has(origen) || !this._delta.has(destino)) {
        throw new Error(`${this.nombre}: la transición (${origen}, ${evento}, ${destino}) usa un estado desconocido`);
      }
      if (!this.eventos.has(evento)) {
        throw new Error(`${this.nombre}: el evento ${evento} no está declarado`);
      }
      if (this._delta.get(origen).has(evento)) {
        throw new Error(`${this.nombre}: δ(${origen}, ${evento}) está definida dos veces (no determinista)`);
      }
      this._delta.get(origen).set(evento, destino);
    }
    if (!this._delta.has(this.inicial)) throw new Error(`${this.nombre}: estado inicial desconocido`);

    this.estado = this.inicial;
    this.historial = []; // [{de, evento, a}]
  }

  /** Función de transición pura: δ(q, σ), o undefined si no está definida. */
  delta(estado, evento) {
    return this._delta.get(estado)?.get(evento);
  }

  /** Eventos activos Γ(q) del estado dado (por defecto el actual). */
  eventosActivos(estado = this.estado) {
    return [...(this._delta.get(estado)?.keys() ?? [])];
  }

  /** ¿Está definido δ(q, σ) en el estado actual? */
  puede(evento) {
    return this.delta(this.estado, evento) !== undefined;
  }

  /**
   * Ejecuta el evento con la tabla δ. Lanza un error si δ(q, σ) no está definida.
   * @returns {string} El nuevo estado.
   */
  ejecutar(evento) {
    const destino = this.delta(this.estado, evento);
    if (destino === undefined) {
      throw new Error(`${this.nombre}: δ(${this.estado}, ${evento}) no está definida`);
    }
    this.historial.push({ de: this.estado, evento, a: destino });
    this.estado = destino;
    return destino;
  }

  /** ¿El estado actual es marcado (Qm)? */
  esMarcado() {
    return this.marcados.has(this.estado);
  }

  /** ¿El evento es controlable (Σc)? */
  esControlable(evento) {
    return this.eventos.get(evento)?.controlable === true;
  }

  /** Id del evento a partir de su código de una letra. */
  idDeCodigo(codigo) {
    return this._porCodigo.get(codigo);
  }

  /** Vuelve al estado inicial y borra el historial. */
  reiniciar() {
    this.estado = this.inicial;
    this.historial = [];
  }

  /**
   * Comprueba, sin cambiar el estado actual, si una palabra (lista de ids de evento)
   * es aceptada: todos los pasos están definidos y termina en un estado marcado.
   */
  acepta(palabra) {
    let q = this.inicial;
    for (const evento of palabra) {
      q = this.delta(q, evento);
      if (q === undefined) return false;
    }
    return this.marcados.has(q);
  }

  /** Igual que acepta(), pero la palabra se escribe con los códigos de una letra ("cifd"). */
  aceptaCodigos(palabra) {
    const ids = [];
    for (const codigo of palabra) {
      const id = this.idDeCodigo(codigo);
      if (id === undefined) return false;
      ids.push(id);
    }
    return this.acepta(ids);
  }
}
