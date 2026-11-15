// Reloj de simulación: calendario de eventos futuros con cola de prioridad (montículo binario).
// Sin motor gráfico ni DOM: se prueba con Node.
// El tiempo es siempre "segundos de simulación". Con tiempos iguales se respeta el orden de programación.

export class Reloj {
  /**
   * @param {{velocidades?:number[]}} [opciones] Velocidades permitidas (por defecto 1, 2 y 4).
   */
  constructor(opciones = {}) {
    this.velocidades = opciones.velocidades ?? [1, 2, 4];
    this.ahora = 0; // tiempo de simulación actual (s)
    this.velocidad = 1; // factor de velocidad; lo usa quien llama a avanzar()
    this.enPausa = false;
    this.alDisparar = null; // función opcional (evento, t, id) llamada tras cada disparo
    this._monticulo = []; // entradas {t, sec, id, evento}
    this._secuencia = 0; // desempata eventos con el mismo tiempo
    this._canceladas = new Set();
  }

  /**
   * Programa un evento en el tiempo absoluto t (s). Si t ya pasó, se dispara en el próximo avanzar().
   * @param {number} t Tiempo absoluto de simulación.
   * @param {Function|{ejecutar:Function}|object} evento Función, objeto con ejecutar() o dato libre.
   * @returns {number} Identificador para cancelar el evento.
   */
  programar(t, evento) {
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      throw new TypeError('El tiempo del evento debe ser un número finito');
    }
    const id = ++this._secuencia;
    this._insertar({ t: Math.max(t, this.ahora), sec: id, id, evento });
    return id;
  }

  /** Programa un evento dentro de dt segundos desde ahora. */
  programarEn(dt, evento) {
    return this.programar(this.ahora + dt, evento);
  }

  /** Cancela un evento programado. Devuelve true si todavía estaba pendiente. */
  cancelar(id) {
    const pendiente = this._monticulo.some((e) => e.id === id) && !this._canceladas.has(id);
    if (pendiente) this._canceladas.add(id);
    return pendiente;
  }

  /**
   * Avanza el reloj dt segundos de simulación y dispara, en orden de tiempo, los eventos vencidos.
   * Los eventos que se programen dentro de un disparo y caigan en la ventana también se disparan.
   * Si el reloj está en pausa no avanza.
   * @param {number} dt Segundos de simulación (ya multiplicados por la velocidad).
   * @returns {{id:number,t:number,evento:any}[]} Eventos disparados, en orden.
   */
  avanzar(dt) {
    const disparados = [];
    if (this.enPausa || !(dt > 0)) return disparados;
    const objetivo = this.ahora + dt;
    for (;;) {
      const cima = this._cima();
      if (!cima || cima.t > objetivo) break;
      this._extraer();
      this.ahora = Math.max(this.ahora, cima.t);
      this._ejecutar(cima);
      disparados.push({ id: cima.id, t: cima.t, evento: cima.evento });
      if (this.enPausa) return disparados; // un evento pausó el reloj (deadlock o fin de turno): se queda en ese instante
    }
    this.ahora = objetivo;
    return disparados;
  }

  /** Pone el reloj en pausa. */
  pausar() {
    this.enPausa = true;
  }

  /** Reanuda el reloj. */
  reanudar() {
    this.enPausa = false;
  }

  /** Alterna entre pausa y marcha. Devuelve el nuevo estado de pausa. */
  alternarPausa() {
    this.enPausa = !this.enPausa;
    return this.enPausa;
  }

  /** Cambia la velocidad. Solo acepta las velocidades permitidas. Devuelve true si cambió. */
  cambiarVelocidad(v) {
    if (!this.velocidades.includes(v)) return false;
    this.velocidad = v;
    return true;
  }

  /** Tiempo del próximo evento pendiente, o null si no hay. */
  proximoTiempo() {
    const cima = this._cima();
    return cima ? cima.t : null;
  }

  /** Cantidad de eventos pendientes (sin contar los cancelados). */
  pendientes() {
    return this._monticulo.filter((e) => !this._canceladas.has(e.id)).length;
  }

  /** Vuelve al tiempo 0 y borra el calendario. Conserva la velocidad. */
  reiniciar() {
    this.ahora = 0;
    this.enPausa = false;
    this._monticulo = [];
    this._secuencia = 0;
    this._canceladas.clear();
  }

  // ---- Interno ----

  /** Ejecuta el evento: función, objeto con ejecutar() o dato libre (solo avisa a alDisparar). */
  _ejecutar(entrada) {
    const { evento, t, id } = entrada;
    if (typeof evento === 'function') evento(this, t);
    else if (evento && typeof evento.ejecutar === 'function') evento.ejecutar(this, t);
    if (this.alDisparar) this.alDisparar(evento, t, id);
  }

  /** Primer evento no cancelado, sin extraerlo. */
  _cima() {
    while (this._monticulo.length > 0 && this._canceladas.has(this._monticulo[0].id)) {
      this._canceladas.delete(this._monticulo[0].id);
      this._extraer();
    }
    return this._monticulo[0] ?? null;
  }

  _menor(a, b) {
    return a.t < b.t || (a.t === b.t && a.sec < b.sec);
  }

  _insertar(entrada) {
    const m = this._monticulo;
    m.push(entrada);
    let i = m.length - 1;
    while (i > 0) {
      const padre = (i - 1) >> 1;
      if (!this._menor(m[i], m[padre])) break;
      [m[i], m[padre]] = [m[padre], m[i]];
      i = padre;
    }
  }

  _extraer() {
    const m = this._monticulo;
    const primero = m[0];
    const ultimo = m.pop();
    if (m.length > 0) {
      m[0] = ultimo;
      let i = 0;
      for (;;) {
        const izq = 2 * i + 1;
        const der = izq + 1;
        let menor = i;
        if (izq < m.length && this._menor(m[izq], m[menor])) menor = izq;
        if (der < m.length && this._menor(m[der], m[menor])) menor = der;
        if (menor === i) break;
        [m[i], m[menor]] = [m[menor], m[i]];
        i = menor;
      }
    }
    return primero;
  }
}
