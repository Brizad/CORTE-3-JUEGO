// Árbol de cobertura de Karp y Miller y exploración para el radar.
// Sin motor gráfico ni DOM.

/** Clave de un marcado; ω (Infinity) se escribe "ω". */
export function claveMarcado(M) {
  return M.map((v) => (v === Infinity ? 'ω' : v)).join(',');
}

/**
 * Árbol de cobertura desde M0 (Karp y Miller).
 * - Se recorre por anchura. Cada transición habilitada genera un nodo hijo.
 * - Un nodo cuyo marcado ya apareció antes es "duplicado": cuenta como nodo pero no se expande.
 * - Si el marcado hijo cubre (>=) y es distinto del de un ancestro, las posiciones que crecieron pasan a ω.
 * - Un nodo sin transiciones habilitadas es "muerto".
 *
 * @param {import('./redPetri.js').RedPetri} red
 * @param {number[]} [M0] Marcado inicial (por defecto el M0 de la red).
 * @param {number} [maxNodos=2000] Límite de nodos; si se alcanza, `truncado` es true.
 * @param {number} [profundidad=Infinity] Niveles a expandir (los nodos del último nivel no se expanden).
 * @returns {{nodos:object[], aristas:object[], muertos:number[][], marcadosDistintos:number,
 *            acotada:boolean, truncado:boolean}}
 */
export function arbolCobertura(red, M0 = red.m0, maxNodos = 2000, profundidad = Infinity) {
  const nodos = [{ id: 0, marcado: [...M0], padre: null, transicion: null, tipo: 'nuevo', nivel: 0 }];
  const aristas = [];
  const vistos = new Map([[claveMarcado(M0), 0]]);
  const cola = [0];
  let truncado = false;

  while (cola.length > 0) {
    const nodo = nodos[cola.shift()];
    const habilitadas = red.habilitadasEn(nodo.marcado);
    if (habilitadas.length === 0) {
      nodo.tipo = 'muerto';
      continue;
    }
    if (nodo.nivel >= profundidad) continue; // frontera: se dibuja pero no se expande
    for (const t of habilitadas) {
      if (nodos.length >= maxNodos) {
        truncado = true;
        break;
      }
      let M = red.sucesor(nodo.marcado, t);

      // Aceleración a ω: comparar con todos los ancestros (incluido el nodo actual).
      for (let a = nodo; a !== null; a = a.padre === null ? null : nodos[a.padre]) {
        const cubre = M.every((v, j) => v >= a.marcado[j]);
        const distinto = M.some((v, j) => v !== a.marcado[j]);
        if (cubre && distinto) M = M.map((v, j) => (v > a.marcado[j] ? Infinity : v));
      }

      const clave = claveMarcado(M);
      const hijo = { id: nodos.length, marcado: M, padre: nodo.id, transicion: t, tipo: 'nuevo', nivel: nodo.nivel + 1 };
      nodos.push(hijo);
      aristas.push({ de: nodo.id, transicion: t, a: hijo.id });
      if (vistos.has(clave)) hijo.tipo = 'duplicado';
      else {
        vistos.set(clave, hijo.id);
        cola.push(hijo.id);
      }
    }
    if (truncado) break;
  }

  const muertos = nodos.filter((n) => n.tipo === 'muerto').map((n) => n.marcado);
  return {
    nodos,
    aristas,
    muertos,
    marcadosDistintos: vistos.size,
    acotada: nodos.every((n) => n.marcado.every(Number.isFinite)),
    truncado,
  };
}

/**
 * Explora los marcados alcanzables desde M hasta cierta profundidad (para el radar).
 *
 * nivel:
 *  - "rojo": M es un marcado muerto.
 *  - "amarillo": algún marcado muerto se alcanza en 1 a `profundidad` disparos.
 *  - "verde": ningún marcado muerto se alcanza dentro de la profundidad.
 * Con profundidad 1 es la regla del GDD: amarillo si un disparo habilitado lleva a un marcado muerto.
 *
 * @returns {{nivel:string, alcanzables:{marcado:number[], camino:string[]}[],
 *            muertosAlcanzables:{marcado:number[], camino:string[]}[]}}
 */
export function explorar(red, M, profundidad = 1) {
  const inicial = [...M];
  if (red.esMuertoEn(inicial)) return { nivel: 'rojo', alcanzables: [], muertosAlcanzables: [] };

  const vistos = new Set([claveMarcado(inicial)]);
  const alcanzables = [];
  const muertosAlcanzables = [];
  let frontera = [{ marcado: inicial, camino: [] }];
  for (let nivel = 0; nivel < profundidad; nivel++) {
    const siguiente = [];
    for (const { marcado, camino } of frontera) {
      for (const t of red.habilitadasEn(marcado)) {
        const m = red.sucesor(marcado, t);
        const clave = claveMarcado(m);
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        const entrada = { marcado: m, camino: [...camino, t] };
        alcanzables.push(entrada);
        if (red.esMuertoEn(m)) muertosAlcanzables.push(entrada);
        else siguiente.push(entrada);
      }
    }
    frontera = siguiente;
  }
  return { nivel: muertosAlcanzables.length > 0 ? 'amarillo' : 'verde', alcanzables, muertosAlcanzables };
}

/** Nombres M0…M7 de los marcados de la red original (docs/modelo/petri.md, sección 6.2). */
export const NOMBRES_MARCADOS = new Map([
  [[1, 1, 1, 1, 0, 0, 0, 0, 0], 'M0'],
  [[0, 1, 0, 1, 1, 0, 0, 0, 0], 'M1'],
  [[1, 0, 1, 0, 0, 1, 0, 0, 0], 'M2'],
  [[1, 0, 1, 1, 0, 0, 0, 0, 1], 'M3'],
  [[0, 0, 0, 1, 0, 0, 1, 0, 0], 'M4'],
  [[0, 0, 0, 0, 1, 1, 0, 0, 0], 'M5'],
  [[0, 0, 0, 1, 1, 0, 0, 0, 1], 'M6'],
  [[0, 0, 1, 0, 0, 0, 0, 1, 0], 'M7'],
].map(([m, n]) => [claveMarcado(m), n]));

/** Nombre del marcado (M0…M7) o null si no es uno de los de la red original. */
export function nombreMarcado(M) {
  return NOMBRES_MARCADOS.get(claveMarcado(M)) ?? null;
}
