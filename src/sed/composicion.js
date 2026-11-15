// Composición síncrona de autómatas y síntesis del supervisor.
// Sin motor gráfico ni DOM.

/** Clave de un estado compuesto: "Cargado|Mandril_Abierto". */
export function claveDe(componentes) {
  return componentes.join('|');
}

/**
 * Producto síncrono G1 ‖ G2: los eventos comunes (mismo id) ocurren a la vez en los dos
 * autómatas y los eventos privados ocurren por separado. Solo se generan los estados alcanzables.
 * @param {object} g1 Modelo JSON del primer autómata.
 * @param {object} g2 Modelo JSON del segundo autómata.
 * @returns {object} Modelo JSON de la composición (se puede pasar a new Automata()), con
 *   `componentes`: clave -> [estado de g1, estado de g2].
 */
export function componer(g1, g2) {
  const ev1 = new Map(g1.eventos.map((e) => [e.id, e]));
  const ev2 = new Map(g2.eventos.map((e) => [e.id, e]));
  const delta = (g) => {
    const t = new Map();
    for (const [o, e, d] of g.transiciones) {
      if (!t.has(o)) t.set(o, new Map());
      t.get(o).set(e, d);
    }
    return t;
  };
  const d1 = delta(g1);
  const d2 = delta(g2);

  // Alfabeto de la composición. Un evento común es controlable solo si lo es en los dos.
  const eventos = [];
  for (const e of g1.eventos) {
    const otro = ev2.get(e.id);
    eventos.push({
      ...e,
      controlable: otro ? e.controlable && otro.controlable : e.controlable,
      observable: otro ? e.observable && otro.observable : e.observable,
    });
  }
  for (const e of g2.eventos) if (!ev1.has(e.id)) eventos.push({ ...e });

  const componentes = {};
  const transiciones = [];
  const inicial = claveDe([g1.inicial, g2.inicial]);
  const cola = [[g1.inicial, g2.inicial]];
  componentes[inicial] = [g1.inicial, g2.inicial];

  while (cola.length > 0) {
    const [q1, q2] = cola.shift();
    for (const { id } of eventos) {
      const en1 = ev1.has(id);
      const en2 = ev2.has(id);
      const s1 = en1 ? d1.get(q1)?.get(id) : q1;
      const s2 = en2 ? d2.get(q2)?.get(id) : q2;
      if (s1 === undefined || s2 === undefined) continue; // algún autómata no lo permite
      const origen = claveDe([q1, q2]);
      const destino = claveDe([s1, s2]);
      transiciones.push([origen, id, destino]);
      if (!(destino in componentes)) {
        componentes[destino] = [s1, s2];
        cola.push([s1, s2]);
      }
    }
  }

  const estados = Object.keys(componentes);
  const marcados = estados.filter(
    (k) => g1.marcados.includes(componentes[k][0]) && g2.marcados.includes(componentes[k][1]),
  );
  return { nombre: `${g1.nombre} || ${g2.nombre}`, estados, inicial, marcados, eventos, transiciones, componentes };
}

/**
 * Sintetiza el supervisor que impide entrar a los estados prohibidos.
 * Estados malos = los prohibidos y los que llegan a ellos por eventos NO controlables
 * (el supervisor no puede evitar esos eventos, así que hay que evitar el estado de origen).
 * En cada estado bueno deshabilita los eventos controlables que llevan a un estado malo.
 *
 * El supervisor no guarda estado: se le pregunta con el estado actual de la CNC y del brazo.
 * En el juego hay una instancia por CNC (la que el brazo atiende).
 *
 * @param {object} composicion Resultado de componer().
 * @param {string[][]} prohibidos Lista de estados prohibidos, por ejemplo [["Fresando", "Mandril_Abierto"]].
 * @param {{razon?:string}} [opciones] Texto que se muestra al jugador.
 */
export function supervisor(composicion, prohibidos, opciones = {}) {
  const razon = opciones.razon ?? 'estado prohibido';
  const controlable = new Map(composicion.eventos.map((e) => [e.id, e.controlable]));
  const claves = new Set(prohibidos.map(claveDe));

  // 1. Estados prohibidos.
  const malos = new Set(composicion.estados.filter((k) => claves.has(k)));
  // 2. Cierre hacia atrás por eventos no controlables.
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const [origen, evento, destino] of composicion.transiciones) {
      if (!malos.has(origen) && malos.has(destino) && !controlable.get(evento)) {
        malos.add(origen);
        cambio = true;
      }
    }
  }
  if (malos.has(composicion.inicial)) {
    throw new Error('El estado inicial es malo: no existe supervisor');
  }

  // 3. Eventos controlables deshabilitados en cada estado bueno.
  const deshabilitados = new Map();
  for (const [origen, evento, destino] of composicion.transiciones) {
    if (malos.has(origen) || !malos.has(destino)) continue;
    if (!deshabilitados.has(origen)) deshabilitados.set(origen, []);
    deshabilitados.get(origen).push({ evento, razon, destino });
  }

  // 4. Sistema supervisado: estados alcanzables desde q0 sin pasar por estados malos.
  const permitida = ([o, e, d]) => !malos.has(o) && !malos.has(d);
  const alcanzables = new Set([composicion.inicial]);
  const cola = [composicion.inicial];
  while (cola.length > 0) {
    const q = cola.shift();
    for (const t of composicion.transiciones) {
      if (t[0] === q && permitida(t) && !alcanzables.has(t[2])) {
        alcanzables.add(t[2]);
        cola.push(t[2]);
      }
    }
  }
  const transicionesSupervisadas = composicion.transiciones.filter((t) => permitida(t) && alcanzables.has(t[0]));

  return {
    razon,
    malos,
    estados: [...alcanzables],
    transiciones: transicionesSupervisadas,
    deshabilitados,
    /** Eventos controlables deshabilitados en un estado compuesto: [{evento, razon, destino}]. */
    deshabilitadosEn(estado) {
      return deshabilitados.get(estado) ?? [];
    },
    /** ¿El supervisor permite el evento en ese estado? (los eventos no definidos en δ no cuentan). */
    permite(estado, evento) {
      return !(deshabilitados.get(estado) ?? []).some((d) => d.evento === evento);
    },
  };
}
