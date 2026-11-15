// Red de Petri N = (P, T, Pre, Post, M0) con capacidad k por lugar.
// Pre y Post son de tamaño |T| x |P| (una fila por transición). Incidencia A = Post − Pre.
// Ecuación de estado: M' = M + Aᵀ · u, con u one-hot (un solo disparo).
// Sin motor gráfico ni DOM.

export class RedPetri {
  /** @param {object} json Modelo con lugares, transiciones, pre y post (src/sed/modelos/red_*.json). */
  constructor(json) {
    this.nombre = json.nombre;
    this.lugares = json.lugares.map((l) => ({ ...l }));
    this.transiciones = json.transiciones.map((t) => ({ ...t }));
    this.pre = json.pre.map((fila) => [...fila]);
    this.post = json.post.map((fila) => [...fila]);
    if (this.pre.length !== this.transiciones.length || this.post.length !== this.transiciones.length) {
      throw new Error(`${this.nombre}: pre y post deben tener una fila por transición`);
    }
    for (const fila of [...this.pre, ...this.post]) {
      if (fila.length !== this.lugares.length) throw new Error(`${this.nombre}: cada fila debe tener |P| columnas`);
    }
    // Matriz de incidencia A = Post − Pre (|T| x |P|).
    this.A = this.post.map((fila, i) => fila.map((v, j) => v - this.pre[i][j]));
    this.m0 = this.lugares.map((l) => l.m0);
    this.M = [...this.m0]; // marcado actual
    this.historial = []; // transiciones disparadas
  }

  // ---- Consultas por nombre ----

  /** Índice de una transición a partir de su id (o el mismo número si ya es índice). */
  indiceT(t) {
    const i = typeof t === 'number' ? t : this.transiciones.findIndex((x) => x.id === t);
    if (i < 0 || i >= this.transiciones.length) throw new Error(`${this.nombre}: transición desconocida ${t}`);
    return i;
  }

  /** Índice de un lugar a partir de su id (p1) o de su nombre (Mesa_libre). */
  indiceP(p) {
    const i = typeof p === 'number' ? p : this.lugares.findIndex((l) => l.id === p || l.nombre === p);
    if (i < 0 || i >= this.lugares.length) throw new Error(`${this.nombre}: lugar desconocido ${p}`);
    return i;
  }

  /** Copia del marcado actual. */
  marcado() {
    return [...this.M];
  }

  /** Fichas de un lugar en el marcado actual. */
  fichas(lugar) {
    return this.M[this.indiceP(lugar)];
  }

  // ---- Funciones puras sobre un marcado cualquiera (las usa cobertura.js) ----

  /**
   * ¿La transición está habilitada en el marcado M? Exige M >= Pre(t) y, en lugares con
   * capacidad "estricta", que el marcado resultante no supere k. Un lugar con ω (Infinity) no se limita.
   */
  habilitadaEn(M, t) {
    const i = this.indiceT(t);
    for (let j = 0; j < this.lugares.length; j++) {
      if (M[j] < this.pre[i][j]) return false;
      const l = this.lugares[j];
      if (l.capacidad === 'estricta' && Number.isFinite(M[j]) && M[j] + this.A[i][j] > l.k) return false;
    }
    return true;
  }

  /** Marcado que resulta de disparar t en M: M' = M + Aᵀ · u (u one-hot). No cambia M. */
  sucesor(M, t) {
    const i = this.indiceT(t);
    return M.map((v, j) => v + this.A[i][j]);
  }

  /**
   * Qué impide disparar t en M (AND-join): los lugares con menos fichas que Pre(t) y los lugares llenos
   * (capacidad estricta) que no admitirían la ficha que produce. Vacío si t está habilitada.
   * @returns {string[]} Nombres de lugar; los llenos llevan " (llena)".
   */
  faltantes(M, t) {
    const i = this.indiceT(t);
    const lista = [];
    for (let j = 0; j < this.lugares.length; j++) {
      const l = this.lugares[j];
      if (M[j] < this.pre[i][j]) lista.push(l.nombre);
      else if (l.capacidad === 'estricta' && Number.isFinite(M[j]) && M[j] + this.A[i][j] > l.k) lista.push(`${l.nombre} (llena)`);
    }
    return lista;
  }

  /** Ids de las transiciones habilitadas en M. */
  habilitadasEn(M) {
    return this.transiciones.filter((_, i) => this.habilitadaEn(M, i)).map((t) => t.id);
  }

  /** ¿M es un marcado muerto (ninguna transición habilitada)? */
  esMuertoEn(M) {
    return this.habilitadasEn(M).length === 0;
  }

  // ---- Operaciones sobre el marcado actual ----

  /** ¿La transición está habilitada en el marcado actual? */
  habilitada(t) {
    return this.habilitadaEn(this.M, t);
  }

  /** Ids de las transiciones habilitadas ahora. */
  habilitadas() {
    return this.habilitadasEn(this.M);
  }

  /**
   * Dispara la transición: M' = M + Aᵀ · u. Lanza un error si no está habilitada.
   * @returns {number[]} El nuevo marcado.
   */
  disparar(t) {
    const i = this.indiceT(t);
    if (!this.habilitada(i)) {
      throw new Error(`${this.nombre}: ${this.transiciones[i].id} no está habilitada en [${this.M}]`);
    }
    // u es one-hot: Aᵀ·u es la fila i de A.
    const u = this.transiciones.map((_, k) => (k === i ? 1 : 0));
    this.M = this.M.map((v, j) => v + u.reduce((s, uk, k) => s + this.A[k][j] * uk, 0));
    this.historial.push(this.transiciones[i].id);
    return this.marcado();
  }

  /**
   * Conflictos: grupos de transiciones habilitadas que comparten un lugar de entrada.
   * @returns {{lugar:string, transiciones:string[]}[]}
   */
  conflictos() {
    const grupos = [];
    const habilitadas = this.habilitadas().map((id) => this.indiceT(id));
    for (let j = 0; j < this.lugares.length; j++) {
      const comparten = habilitadas.filter((i) => this.pre[i][j] > 0);
      if (comparten.length > 1) {
        grupos.push({ lugar: this.lugares[j].nombre, transiciones: comparten.map((i) => this.transiciones[i].id) });
      }
    }
    return grupos;
  }

  /** ¿El marcado actual es muerto? */
  esMuerto() {
    return this.esMuertoEn(this.M);
  }

  /** Vuelve a M0 (o a un marcado dado) y borra el historial. */
  reiniciar(marcado = this.m0) {
    this.M = [...marcado];
    this.historial = [];
  }
}
