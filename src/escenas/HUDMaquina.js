// HUD de máquina (guía, p. 20): escena superpuesta que se lanza en paralelo a Planta (no pausa la simulación).
//  - Pestaña «Autómata» (la que abre): el grafo del autómata con las coordenadas del .jff, el estado actual iluminado, un botón
//    por cada evento de Γ(q) (verde, gris o rojo, con la razón formal) y los últimos 10 eventos.
//  - Pestaña «Acciones»: los mismos eventos de ESA máquina como botones grandes con ícono y verbo de juego. Con la CNC en
//    Falla, aquí va la consola de reparación. Las CNC tienen además la pestaña «Composición».
// En el panel de una CNC no hay botones del brazo, y en el del brazo no hay botones de las CNC (salvo los eventos compartidos c y d).
// Cada botón dispara UN solo evento: se lo pide a la Celda (δ, supervisor y red de Petri). Nada cambia de estado aquí.

import { COLORES, TEXTO_HEX } from '../config.js';
import { aspectoDe } from '../arte/estados.js';
import { MODELOS } from '../modelos.js';
import { ConsolaReparacion, COMANDOS } from '../sed/consola.js';
import { EXPRESION_TEXTO } from '../sed/lenguaje.js';
import { claveDe } from '../sed/composicion.js';
import { camaraLogica } from './camara.js';
import { PANEL_MAQUINA } from '../disposicion.js';
import { resaltable, fijarBorde } from './resaltar.js';
import { verbosDe, describir, progresoFresado } from '../sed/controles.js';

const PANEL = PANEL_MAQUINA; // termina en y = 396: no tapa la barra de control (y 400) // docs/arte.md, sección 7 y docs/GDD.md, sección 18.2
const ANCHO_UTIL = PANEL.ancho - 24; // ancho del contenido del panel
const GRAFO = { x: 12, y: 26, ancho: ANCHO_UTIL };
// Márgenes del grafo: sitio para la flecha de entrada, las etiquetas "código · nombre" y los nombres de los estados.
const MARGEN_IZQ = 56;
const MARGEN_DER = 120;
const MARGEN_SUP = 32;
const MARGEN_INF = 40;
const RADIO = 22; // nodos de 44 px
const BOTON = { ancho: 100, alto: 44, hueco: 8, y: 228 }; // táctil: 44 px como mínimo
const PARPADEO = 3; // s (reloj real) que parpadea la última transición: decisión del equipo (la guía dice 0,5 s), docs/GDD.md 18.18
const PERIODO_PARPADEO = 0.5; // 3 s / 0,5 s = 6 parpadeos
const DESTELLO_BOTON = 0.45; // s que destella en amarillo el botón pulsado
const HEX = (c) => `#${c.toString(16).padStart(6, '0')}`;
const ACC = { x: 12, y: 66, alto: 40, hueco: 6 }; // botones grandes de la pestaña «Acciones»
const NOMBRE_MAQUINA = { CNC1: 'CNC 1', CNC2: 'CNC 2', BRAZO: 'Brazo', AGV1: 'AGV 1', AGV2: 'AGV 2' };
const QUE_HACE = {
  CNC: 'Fresa los bloques (10 s). El brazo mete el bloque y saca la pieza.',
  BRAZO: 'Mete los bloques y saca las piezas de las CNC, un paso a la vez.',
  AGV: 'Trae metal. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo.',
};
const COLOR_VERBO = { verde: COLORES.operacion, gris: COLORES.banda, rojo: COLORES.fallo, reparar: COLORES.mantenimiento };

const MODELO_DE = { CNC: MODELOS.cnc, BRAZO: MODELOS.brazo, AGV: MODELOS.agv };
const tipoDe = (id) => id.replace(/\d$/, '');

export class HUDMaquina extends Phaser.Scene {
  constructor() {
    super('HUDMaquina');
  }

  create() {
    camaraLogica(this);
    this.abierto = false;
    this.maquinaId = null;
    this.celda = null;
    this._bajaCelda = null;
    this.panelX = PANEL.xDerecha;
    this.contenedor = this.add.container(PANEL.xDerecha, PANEL.y).setVisible(false);

    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.92);
    marco.fillRect(0, 0, PANEL.ancho, PANEL.alto);
    marco.lineStyle(2, COLORES.banda, 1);
    marco.strokeRect(0, 0, PANEL.ancho, PANEL.alto);

    this.titulo = this.add.text(12, 6, '', { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: TEXTO_HEX.texto });
    this.cerrarBoton = this.add
      .text(PANEL.ancho - 8, 4, 'X', { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: TEXTO_HEX.texto, padding: { x: 8, y: 4 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.cerrarBoton.on('pointerup', () => this.cerrar());
    this.cerrarBoton.on('pointerover', () => this.cerrarBoton.setColor(TEXTO_HEX.espera));
    this.cerrarBoton.on('pointerout', () => this.cerrarBoton.setColor(TEXTO_HEX.texto));

    // Pestañas: Autómata (grafo y eventos, la que abre) y Acciones (los mismos eventos con verbos de juego). Las CNC tienen además Composición.
    this._pestana = 'automata';
    this.pestanas = {};
    for (const [clave, etiqueta, x, ancho] of [['automata', 'Autómata', 72, 58], ['acciones', 'Acciones', 134, 58], ['composicion', 'Composición', 196, 76]]) {
      const rect = resaltable(this.add.rectangle(x, 5, ancho, 18, COLORES.panel).setOrigin(0).setInteractive({ useHandCursor: true }), [1, COLORES.maquina, 1]);
      const t = this.add.text(x + ancho / 2, 14, etiqueta, { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
      rect.on('pointerup', () => { this.planta?.sonidos.clic(); this._cambiarPestana(clave); });
      this.pestanas[clave] = { rect, t, etiqueta };
    }
    // Capa de la pestaña «Acciones»: estado, un botón grande por evento de la máquina e historial de eventos.
    this.capaAcciones = this.add.container(0, 0);
    this.accEstado = this.add.text(30, 30, '', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: TEXTO_HEX.texto });
    this.accQueHace = this.add.text(12, 48, '', { fontFamily: 'Arial', fontSize: '10px', color: '#8794a3', wordWrap: { width: ANCHO_UTIL } });
    this.accPunto = this.add.graphics(); // punto con el color del estado
    this.accBoton = this.add.container(0, 0); // botón grande: se rehace cuando cambia la acción
    this.accProgreso = this.add.graphics(); // barra del fresado
    this.accCabecera = this.add.text(12, 210, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    this.accHistorial = this.add.text(12, 226, '', { fontFamily: 'Courier New, monospace', fontSize: '10px', color: TEXTO_HEX.texto, lineSpacing: 3 });
    this.capaAcciones.add([this.accPunto, this.accEstado, this.accQueHace, this.accBoton, this.accProgreso, this.accCabecera, this.accHistorial]);
    this._firmaAccion = '';
    this.capaComposicion = this.add.container(0, 0).setVisible(false);
    const fuente = { fontFamily: 'Arial', fontSize: '11px', color: TEXTO_HEX.texto, lineSpacing: 5, wordWrap: { width: ANCHO_UTIL } };
    this.capaComposicion.add([
      this.add.text(12, 36, '', fuente), // cifras: se rellenan en abrir()
      this.add.text(12, 112, 'Estado compuesto actual (esta CNC, Brazo):', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera }),
    ]);
    this.txtCompFijo = this.capaComposicion.list[0];
    this.txtCompEstado = this.add.text(12, 128, '', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    this.txtCompB = this.add.text(12, 166, '', fuente);
    this.capaComposicion.add([this.txtCompEstado, this.txtCompB]);

    this.gfxFijo = this.add.graphics(); // aristas y nodos sin iluminar
    this.gfxNodo = this.add.graphics(); // nodo del estado actual (relleno fuerte y borde grueso, sin filtros)
    this.gfxParpadeo = this.add.graphics(); // última transición
    this.gfxDestello = this.add.graphics(); // destello del botón pulsado
    this.capaTextos = this.add.container(0, 0);
    this.capaBotones = this.add.container(0, 0);
    this.capaConsola = this.add.container(0, 0).setVisible(false);
    // Historial en columnas alineadas: tiempo (a la derecha), código del evento y "origen → destino".
    const colTexto = (extra = {}) => this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '9px', color: TEXTO_HEX.texto, lineSpacing: 2, ...extra });
    this.columnas = [0, 1].map(() => ({ t: colTexto({ color: '#8794a3' }).setOrigin(1, 0), c: colTexto({ fontStyle: 'bold' }), f: colTexto() }));
    this.cabeceraLista = this.add.text(12, 0, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    this.cabeceraBrazo = this.add.text(12, 0, 'Brazo en esta CNC', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera }).setVisible(false);
    this.aviso = this.add.text(PANEL.ancho - 34, 8, '', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: TEXTO_HEX.operacion }).setOrigin(1, 0).setVisible(false);
    this.tip = this.add
      .text(8, PANEL.alto - 8, '', {
        fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, wordWrap: { width: PANEL.ancho - 28 },
        backgroundColor: HEX(COLORES.panel), padding: { x: 6, y: 4 },
      })
      .setOrigin(0, 1)
      .setVisible(false);

    this.contenedor.add([
      marco, this.titulo, this.cerrarBoton, this.gfxFijo, this.gfxNodo, this.gfxParpadeo, this.capaTextos,
      this.capaBotones, this.capaAcciones, this.gfxDestello, this.capaConsola, this.capaComposicion, ...Object.values(this.pestanas).flatMap((q) => [q.rect, q.t]), this.cabeceraBrazo, this.aviso, this.cabeceraLista, ...this.columnas.flatMap((c) => [c.t, c.c, c.f]), this.tip,
    ]);
    this.botones = [];
    this._firmaBotones = '';
    // Teclado de la consola de reparación (H, C, T, R, Retroceso y Enter).
    this._atendidas = new WeakSet();
    this.input.keyboard.on('keydown', this._alTecla, this);
    this._modoConsola = false;
    this._consolaLista = false;
    this.consola = new ConsolaReparacion(MODELOS.reparacion);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this._alTecla, this);
      this._soltarCelda();
    });
  }

  // ---- Abrir y cerrar ----

  /** Abre el panel para una máquina (CNC1, CNC2, BRAZO, AGV1 o AGV2) en la pestaña «Autómata»; con {consola: true}, en «Acciones». */
  abrir(id, nombre, opciones = {}) {
    const planta = this.scene.get('Planta');
    this._soltarCelda();
    this.celda = planta.celda;
    this.planta = planta;
    this.maquinaId = id;
    this.tipo = tipoDe(id);
    this.modelo = MODELO_DE[this.tipo];
    this.automata = this.celda.automatas[id];
    this.titulo.setText(NOMBRE_MAQUINA[id] ?? nombre ?? id);
    this.accQueHace.setText(QUE_HACE[this.tipo]);
    this._firmaAccion = '';
    // Cifras de la pestaña Composición (CNC ‖ Brazo y sistema supervisado).
    const sup = this.celda.supervisores[id];
    this.txtCompFijo?.setText(
      `CNC ‖ Brazo (planta): ${this.celda.composicion.estados.length} estados, ${this.celda.composicion.transiciones.length} transiciones
Sistema supervisado: ${sup ? sup.estados.length : '-'} estados, ${sup ? sup.transiciones.length : '-'} transiciones
Estado prohibido: (Fresando, Mandril_Abierto)
Regla: ${this.celda.razonSupervisor}`,
    );
    this._reiniciarPestanas(opciones.consola ? 'acciones' : 'automata'); // «Reparar» abre directo la consola

    // El panel se coloca junto a la máquina: a la izquierda si la máquina está en la mitad derecha.
    const entidad = planta.entidades.find((e) => e.id === id);
    const x = entidad ? entidad.silueta[0].x : 0;
    this.panelX = x > 480 ? PANEL.xIzquierda : PANEL.xDerecha;
    this.contenedor.setPosition(this.panelX, PANEL.y).setVisible(true);
    this.abierto = true;

    planta.piloto.bloqueadas.add(id); // el modo demostración no toca esta máquina
    this._modoConsola = false;
    this._consolaLista = false;
    this._mensaje = null;
    this.capaConsola.setVisible(false);
    this._bajaCelda = this.celda.alCambiar((e) => {
      this._sucia = true;
      // Evento de esta máquina (del jugador o automático): parpadea su flecha; el nuevo reemplaza al anterior.
      if (e.tipo === 'automata' && e.maquina === this.maquinaId) this._parpadeo = { de: e.de, evento: e.evento, a: e.a, inicio: this.time.now };
      // Los puntos de esta máquina (reparación válida, palabra inválida, ayuda) se avisan en la consola.
      if (e.tipo === 'puntos' && e.maquina === this.maquinaId) {
        const signo = e.puntos > 0 ? '+' : '';
        this._mensaje = { texto: `${signo}${e.puntos} puntos: ${e.motivo}`, color: e.puntos > 0 ? TEXTO_HEX.operacion : TEXTO_HEX.espera, hasta: this.time.now + 3500 };
      }
    });
    this._parpadeo = null;
    this._destello = null;
    this._dibujarGrafo();
    this._estadoNodo = null;
    this._firmaBotones = '';
    this._sucia = true;
  }

  /** Verdadero si la consola de reparación está a la vista: entonces C, T, H, R y Enter son de la consola. */
  get consolaAbierta() {
    return this.abierto && this._modoConsola && this._pestana === 'acciones';
  }

  /** Cierra el panel. */
  cerrar() {
    this._soltarCelda();
    this.contenedor?.setVisible(false);
    this.abierto = false;
  }

  _soltarCelda() {
    this._bajaCelda?.();
    this._bajaCelda = null;
    this.planta?.piloto?.bloqueadas.delete(this.maquinaId);
  }

  /** Verdadero si el punto (x, y) cae sobre el panel abierto. */
  contiene(x, y) {
    return this.abierto && x >= this.panelX && x <= this.panelX + PANEL.ancho && y >= PANEL.y && y <= PANEL.y + PANEL.alto;
  }

  // ---- Grafo ----

  /** Posición de cada estado en el panel: las coordenadas del .jff escaladas al área del grafo (dejando sitio a las etiquetas). */
  _posiciones() {
    const pos = this.modelo.posiciones;
    const xs = Object.values(pos).map((p) => p[0]);
    const ys = Object.values(pos).map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const sx = (GRAFO.ancho - MARGEN_IZQ - MARGEN_DER) / Math.max(1, x1 - x0);
    const sy = (this._altoGrafo - MARGEN_SUP - MARGEN_INF) / Math.max(1, y1 - y0);
    const salida = {};
    for (const [nombre, [x, y]] of Object.entries(pos)) {
      salida[nombre] = { x: GRAFO.x + MARGEN_IZQ + (x - x0) * sx, y: GRAFO.y + MARGEN_SUP + (y - y0) * sy };
    }
    return salida;
  }

  _dibujarGrafo() {
    const g = this.gfxFijo;
    g.clear();
    this.capaTextos.removeAll(true);
    // Las CNC llevan además la sección del brazo, así que su grafo es más bajo.
    this._altoGrafo = this.tipo === 'CNC' ? 170 : 184;
    this._yBotones = GRAFO.y + this._altoGrafo + 4;
    this.pos = this._posiciones();
    this.aristas = this._calcularAristas();

    // Aristas: curvas con flecha y la etiqueta "código · nombre". Los eventos no controlables van punteados.
    for (const a of this.aristas) {
      g.lineStyle(1.8, COLORES.maquina, 1);
      this._trazar(g, a.puntos, !a.controlable);
      g.fillStyle(COLORES.maquina, 1);
      g.fillPoints(a.flecha, true);
      const l = this._texto(a.rotulo.x, a.rotulo.y, a.etiqueta, { fontSize: '9px', fontStyle: 'bold', strokeThickness: 4 });
      l.setOrigin(a.origen.x, a.origen.y);
      a.texto = l;
    }
    // Estado inicial: flecha de entrada desde la izquierda.
    const ini = this.pos[this.modelo.inicial];
    const entrada = this._flecha({ x: ini.x - RADIO - 24, y: ini.y }, { x: ini.x - RADIO, y: ini.y });
    g.lineStyle(1.8, COLORES.maquina, 1);
    g.lineBetween(ini.x - RADIO - 24, ini.y, ini.x - RADIO - 4, ini.y);
    g.fillStyle(COLORES.maquina, 1);
    g.fillPoints(entrada, true);

    // Nodos: círculo con su nombre debajo; los marcados llevan doble círculo.
    for (const estado of this.modelo.estados) {
      const p = this.pos[estado];
      g.fillStyle(COLORES.panel, 1);
      g.fillCircle(p.x, p.y, RADIO);
      g.lineStyle(2, COLORES.maquina, 1);
      g.strokeCircle(p.x, p.y, RADIO);
      if (this.modelo.marcados.includes(estado)) g.strokeCircle(p.x, p.y, RADIO - 5);
      this._texto(p.x, p.y + RADIO + 2, estado, { fontSize: '10px' }).setOrigin(0.5, 0);
    }
  }

  /** Traza una polilínea; si es punteada, alterna 2 segmentos dibujados y 2 saltados. */
  _trazar(g, puntos, punteada) {
    if (!punteada) {
      g.strokePoints(puntos, false);
      return;
    }
    for (let i = 0; i + 1 < puntos.length; i++) {
      if (Math.floor(i / 2) % 2 === 0) g.lineBetween(puntos[i].x, puntos[i].y, puntos[i + 1].x, puntos[i + 1].y);
    }
  }

  _texto(x, y, contenido, estilo = {}) {
    const t = this.add.text(x, y, contenido, {
      fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, stroke: HEX(COLORES.panel), strokeThickness: 3, ...estilo,
    });
    this.capaTextos.add(t);
    return t;
  }

  /** Triángulo de flecha en `fin`, con la dirección de `desde` a `fin`. */
  _flecha(desde, fin) {
    const ang = Math.atan2(fin.y - desde.y, fin.x - desde.x);
    const punta = (a, r) => ({ x: fin.x + Math.cos(a) * r, y: fin.y + Math.sin(a) * r });
    return [fin, punta(ang + Math.PI - 0.4, 9), punta(ang + Math.PI + 0.4, 9)];
  }

  /**
   * Cada transición como una curva entre los bordes de sus nodos.
   * Entre el mismo par de estados, cada transición usa su propia curva, repartidas a ambos lados del eje (así las de
   * abrir_mandril, cerrar_mandril y descargar del brazo no se montan). Las autotransiciones se dibujan hacia afuera del grafo.
   */
  _calcularAristas() {
    const evento = new Map(this.modelo.eventos.map((e) => [e.id, e]));
    const estados = this.modelo.estados;
    const pares = new Map(); // "u|v" (u antes que v en la lista de estados) -> transiciones
    const bucles = [];
    for (const [de, ev, a] of this.modelo.transiciones) {
      if (de === a) {
        bucles.push({ de, ev, a });
        continue;
      }
      const [u, v] = estados.indexOf(de) < estados.indexOf(a) ? [de, a] : [a, de];
      const k = `${u}|${v}`;
      if (!pares.has(k)) pares.set(k, []);
      pares.get(k).push({ de, ev, a });
    }
    const info = (t) => {
      const e = evento.get(t.ev);
      return { de: t.de, ev: t.ev, a: t.a, codigo: e.codigo, controlable: e.controlable, etiqueta: `${e.codigo} · ${t.ev}` };
    };
    const salida = [];
    const borde = (c, h) => {
      const d = Math.hypot(h.x - c.x, h.y - c.y) || 1;
      return { x: c.x + ((h.x - c.x) / d) * RADIO, y: c.y + ((h.y - c.y) / d) * RADIO };
    };

    for (const [k, lista] of pares) {
      const [u, v] = k.split('|');
      const pu = this.pos[u];
      const pv = this.pos[v];
      const dx = pv.x - pu.x;
      const dy = pv.y - pu.y;
      const largo = Math.hypot(dx, dy) || 1;
      const normal = { x: -dy / largo, y: dx / largo }; // perpendicular al eje u → v
      // Las que van de u a v primero y las de v a u después: reparto simétrico alrededor del eje.
      const orden = [...lista].sort((p, q) => (p.de === u ? 0 : 1) - (q.de === u ? 0 : 1));
      const paso = Math.min(30, Math.max(18, largo * 0.26)); // px entre una curva y la siguiente
      orden.forEach((t, i) => {
        let desp = (i - (orden.length - 1) / 2) * paso;
        if (orden.length === 1) {
          // Una flecha sola: se prueba recta y con varias curvaturas a cada lado, y se elige la que deja su punto medio más
          // lejos de los demás nodos y de sus nombres (y dentro del área del grafo).
          const otros = estados.filter((e) => e !== u && e !== v);
          const medioEje = { x: (pu.x + pv.x) / 2, y: (pu.y + pv.y) / 2 };
          const holgura = (d) => {
            const c = { x: medioEje.x + normal.x * d, y: medioEje.y + normal.y * d }; // punto medio de la curva (Bézier cuadrática)
            let m = Infinity;
            for (const e of otros) {
              const q = this.pos[e];
              m = Math.min(m, Math.hypot(q.x - c.x, q.y - c.y), Math.hypot(q.x - c.x, q.y + RADIO + 8 - c.y) + 6);
              // y el tramo recto entre los extremos
            }
            const fuera = c.y > GRAFO.y + this._altoGrafo - 14 || c.y < GRAFO.y + 8 ? 40 : 0;
            return m - fuera;
          };
          const tramo = (e) => {
            const q = this.pos[e];
            const t = Math.max(0, Math.min(1, ((q.x - pu.x) * dx + (q.y - pu.y) * dy) / (largo * largo)));
            return Math.hypot(q.x - (pu.x + dx * t), q.y - (pu.y + dy * t));
          };
          const recta = Math.min(Infinity, ...otros.map(tramo));
          if (recta < RADIO + 16) {
            let mejor = 0;
            let mejorPuntaje = -Infinity;
            for (const d of [-60, -42, -26, 26, 42, 60]) {
              const puntaje = holgura(d);
              if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejor = d;
              }
            }
            desp = mejor / 1; // el punto medio de la curva queda a |mejor| px del eje
          }
        }
        const medio = { x: (pu.x + pv.x) / 2, y: (pu.y + pv.y) / 2 };
        const control = { x: medio.x + normal.x * desp * 2, y: medio.y + normal.y * desp * 2 };
        const p = this.pos[t.de];
        const q = this.pos[t.a];
        const inicio = borde(p, control);
        const fin = borde(q, control);
        const puntos = [];
        for (let j = 0; j <= 20; j++) {
          const s = j / 20;
          puntos.push({
            x: (1 - s) ** 2 * inicio.x + 2 * (1 - s) * s * control.x + s ** 2 * fin.x,
            y: (1 - s) ** 2 * inicio.y + 2 * (1 - s) * s * control.y + s ** 2 * fin.y,
          });
        }
        const cima = puntos[10];
        // Hacia afuera: el lado de la curva (o hacia arriba si es recta).
        let lado = desp === 0 ? { x: normal.x, y: normal.y } : { x: Math.sign(desp) * normal.x, y: Math.sign(desp) * normal.y };
        if (desp === 0) {
          // Curva recta: la etiqueta va del lado con más espacio libre (lejos de los nombres y de los nodos de otros estados).
          const libre = (l) => {
            const q = { x: cima.x + l.x * 12, y: cima.y + l.y * 12 };
            return Math.min(...estados.flatMap((e) => [
              Math.hypot(this.pos[e].x - q.x, this.pos[e].y - q.y),
              Math.hypot(this.pos[e].x - q.x, this.pos[e].y + RADIO + 8 - q.y),
            ]));
          };
          const otro = { x: -lado.x, y: -lado.y };
          if (libre(otro) > libre(lado) + 2) lado = otro;
        }
        // Una curva recta entre varias: su etiqueta va centrada sobre la línea, para no chocar con las de los lados.
        // Si la etiqueta quedaría debajo del área del grafo (tapada por los botones), va por el lado de adentro de la curva.
        if (cima.y + lado.y * 8 > GRAFO.y + this._altoGrafo - 8) lado = { x: -lado.x, y: -lado.y };
        const centrada = desp === 0 && orden.length > 1;
        salida.push({
          ...info(t),
          puntos,
          flecha: this._flecha(puntos[17], fin),
          rotulo: centrada ? { x: cima.x, y: cima.y } : { x: cima.x + lado.x * 8, y: cima.y + lado.y * 8 },
          origen: centrada ? { x: 0.5, y: 0.5 } : { x: 0.5 - 0.5 * lado.x, y: 0.5 - 0.5 * lado.y },
        });
      });
    }

    // Bucles: hacia el lado opuesto al resto de los estados.
    for (const t of bucles) {
      const p = this.pos[t.de];
      const otros = estados.filter((e) => e !== t.de).map((e) => this.pos[e]);
      const cx = otros.reduce((s, o) => s + o.x, 0) / Math.max(1, otros.length);
      const cy = otros.reduce((s, o) => s + o.y, 0) / Math.max(1, otros.length);
      // Horizontal, hacia el lado donde no hay otros estados (el nombre del estado queda debajo, libre).
      const dir = { x: p.x >= cx ? 1 : -1, y: 0 };
      void cy;
      const radioBucle = 11;
      const centro = { x: p.x + dir.x * (RADIO + radioBucle - 2), y: p.y + dir.y * (RADIO + radioBucle - 2) };
      const base = Math.atan2(dir.y, dir.x) + Math.PI; // hacia el nodo
      const puntos = [];
      for (let j = 0; j <= 20; j++) {
        const ang = base + 0.7 + ((2 * Math.PI - 1.4) * j) / 20;
        puntos.push({ x: centro.x + Math.cos(ang) * radioBucle, y: centro.y + Math.sin(ang) * radioBucle });
      }
      salida.push({
        ...info(t),
        puntos,
        flecha: this._flecha(puntos[18], puntos[20]),
        rotulo: { x: centro.x + dir.x * (radioBucle + 6), y: centro.y + dir.y * (radioBucle + 6) },
        origen: { x: 0.5 - 0.5 * dir.x, y: 0.5 - 0.5 * dir.y },
      });
    }
    return salida;
  }

  // ---- Por cuadro ----

  update() {
    if (!this.abierto) return;
    const ahora = this.celda.reloj.ahora;
    const estado = this.automata.estado;

    // Parpadeo de la última transición (3 s, dibujo plano): la flecha y su etiqueta en amarillo grueso y el nodo de destino pulsa.
    const b = this.gfxParpadeo;
    b.clear();
    const pq = this._parpadeo;
    const t = pq ? (this.time.now - pq.inicio) / 1000 : Infinity;
    const activo = t < PARPADEO;
    const encendido = activo && Math.floor(t / (PERIODO_PARPADEO / 2)) % 2 === 0;
    const arista = pq ? this.aristas.find((x) => x.de === pq.de && x.ev === pq.evento && x.a === pq.a) : null;
    for (const x of this.aristas) x.texto?.setColor(x === arista && encendido ? HEX(COLORES.espera) : TEXTO_HEX.texto);
    if (arista && encendido) {
      b.lineStyle(6, COLORES.espera, 1);
      b.strokePoints(arista.puntos, false);
      b.fillStyle(COLORES.espera, 1);
      b.fillPoints(arista.flecha, true);
    }
    // Nodo del estado actual: relleno con el color de su estado y borde grueso; durante el parpadeo pulsa de tamaño.
    const escala = activo ? 1 + 0.22 * Math.abs(Math.sin((Math.PI * t) / PERIODO_PARPADEO)) : 1;
    if (estado !== this._estadoNodo || escala !== this._escalaNodo) {
      this._estadoNodo = estado;
      this._escalaNodo = escala;
      const p = this.pos[estado];
      const g = this.gfxNodo;
      const r = RADIO * escala;
      g.clear();
      g.fillStyle(COLORES.texto, 0.25); // halo plano alrededor (sin filtro glow)
      g.fillCircle(p.x, p.y, r + 6);
      g.fillStyle(aspectoDe(this.tipo, estado).color, 1);
      g.fillCircle(p.x, p.y, r);
      g.lineStyle(5, COLORES.texto, 1);
      g.strokeCircle(p.x, p.y, r);
      if (this.modelo.marcados.includes(estado)) g.lineStyle(2, COLORES.panel, 1).strokeCircle(p.x, p.y, r - 6);
    }
    // Destello amarillo del botón pulsado.
    const d = this.gfxDestello;
    d.clear();
    if (this._destello) {
      const k = 1 - (this.time.now - this._destello.inicio) / 1000 / DESTELLO_BOTON;
      if (k > 0) {
        d.fillStyle(COLORES.espera, 0.85 * k);
        d.fillRect(this._destello.x, this._destello.y, this._destello.ancho, this._destello.alto);
      } else this._destello = null;
    }
    this.aviso.setText('Brazo en camino…').setVisible(this.celda.estado('BRAZO') === 'Moviendo');

    // Los botones y la lista solo se rehacen cuando algo cambió.
    if (this._sucia) {
      this._sucia = false;
      this._actualizarBotones();
      this._actualizarLista();
      this._firmaHistorial = '';
    }
    if (this._pestana !== 'automata') {
      // Fuera de la pestaña Autómata, nada del grafo se ve ni recibe clics.
      for (const o of [this.cabeceraBrazo, this.cabeceraLista]) o.setVisible(false);
      this._listaVisible(false);
    }
    if (this._pestana === 'composicion') {
      this.capaConsola.setVisible(false);
      this._refrescarComposicion();
    }
    if (this._pestana === 'acciones') this._actualizarAcciones();
    if (this.consolaAbierta && this._consolaLista) this._refrescarConsola();
  }

  /** Último evento de esta máquina en la bitácora de la Celda. */
  _ultimoEvento() {
    const bit = this.celda.bitacora;
    for (let i = bit.length - 1; i >= 0; i--) {
      if (bit[i].tipo === 'automata' && bit[i].maquina === this.maquinaId) return bit[i];
    }
    return null;
  }

  // ---- Botones ----

  /** Texto de un aviso cuando el evento no se puede ejecutar y por qué. */
  _explicar(motivo, cnc, falta = []) {
    const c = this.celda;
    if (motivo === 'supervisor') {
      return `Supervisor: ${c.razonSupervisor}. Estado (${c.estado(cnc)}, ${c.estado('BRAZO')}).`;
    }
    if (motivo === 'recurso') {
      return falta.length ? `Falta: ${falta.join(', ')} (la red de Petri no habilita la transición).` : 'Recurso ocupado: la red de Petri no habilita la transición.';
    }
    return 'Ahora no se puede.';
  }

  /** Qué falta para un evento compartido (cargar o descargar) de la CNC `cnc`. */
  _faltaCompartido(cnc, ev) {
    const c = this.celda;
    const brazo = c.estado('BRAZO');
    if (c.atendida !== cnc) {
      return c.atendida
        ? `El brazo atiende a ${c.atendida}, no a esta CNC.`
        : 'El brazo debe estar frente a esta CNC: muévelo con «Ir a CNC» (barra de control).';
    }
    if (brazo !== 'Mandril_Abierto') {
      const extra = brazo === 'Moviendo' ? ' (en camino)' : '';
      return `El brazo debe estar en Mandril_Abierto frente a esta CNC (ahora: ${brazo}${extra}).`;
    }
    const necesita = ev === 'cargar' ? 'Libre' : 'Terminado';
    return `La CNC debe estar en ${necesita} (ahora: ${c.estado(cnc)}).`;
  }

  /** Botones de la máquina: uno por cada evento de Γ(q) de SU autómata (en el panel de una CNC no hay botones del brazo). */
  _describirBotones() {
    const c = this.celda;
    const id = this.maquinaId;
    const principales = [];
    // Convierte el resultado de evaluar() en el tipo de botón y su explicación.
    const segun = (motivo, cnc, ev, falta = []) => {
      if (motivo === null) return { tipo: 'verde', tip: 'Ejecutar el evento (δ)' };
      if (motivo === 'celda') return { tipo: 'gris', tip: 'Controlador de celda activo: Celda_libre no tiene ficha (el otro AGV está en la celda).' };
      if (motivo === 'supervisor' || motivo === 'recurso') return { tipo: motivo === 'supervisor' ? 'rojo' : 'gris', tip: this._explicar(motivo, cnc, falta) };
      if (motivo === 'indefinido' && (ev === 'cargar' || ev === 'descargar')) return { tipo: 'gris', tip: this._faltaCompartido(cnc, ev) };
      return { tipo: 'gris', tip: 'Lo dispara el sistema.' };
    };

    for (const ev of this.automata.eventosActivos()) {
      const info = this.automata.eventos.get(ev);
      const etiqueta = `${info.codigo} · ${ev}`;
      if (!info.controlable) {
        principales.push({ etiqueta, tipo: 'gris', tip: 'No controlable: lo dispara el sistema (solo informativo).' });
      } else if (this.tipo === 'CNC') {
        if (ev === 'reset') {
          principales.push({ etiqueta, tipo: 'gris', consola: true, tip: 'r · reset exige una palabra de L = ^H(CT?)+R$: escríbela en la consola de la pestaña «Acciones» (clic aquí para abrirla).' });
        } else {
          principales.push({ etiqueta, maquina: id, evento: ev, ...segun(c.evaluar(id, ev), id, ev) });
        }
      } else if (this.tipo === 'BRAZO') {
        if (ev === 'mover') {
          if (this.automata.estado === 'Reposo') {
            for (const objetivo of ['CNC1', 'CNC2']) {
              principales.push({ etiqueta: `m → ${objetivo}`, maquina: 'BRAZO', evento: ev, opciones: { objetivo }, ...segun(c.evaluar('BRAZO', ev, { objetivo }), objetivo, ev, c.faltaPara('BRAZO', ev, { objetivo })) });
            }
          } else {
            principales.push({ etiqueta: 'm · volver', maquina: 'BRAZO', evento: 'volver', ...segun(c.evaluar('BRAZO', 'volver'), c.atendida, 'volver') });
          }
        } else if (ev === 'cargar' || ev === 'descargar') {
          const cnc = c.atendida;
          principales.push(cnc
            ? { etiqueta, maquina: cnc, evento: ev, ...segun(c.evaluar(cnc, ev), cnc, ev) }
            : { etiqueta, tipo: 'gris', tip: 'El brazo no atiende a ninguna CNC.' });
        } else {
          principales.push({ etiqueta, maquina: 'BRAZO', evento: ev, ...segun(c.evaluar('BRAZO', ev), c.atendida, ev) });
        }
      } else if (ev === 'reservar') {
        principales.push({ etiqueta: `v · reservar`, maquina: id, evento: ev, ...segun(c.evaluar(id, ev), id, ev, c.faltaPara(id, ev)) });
      } else {
        principales.push({ etiqueta, tipo: 'gris', tip: 'Transición automática de la red: se dispara sola cuando hay mesa y brazo.' });
      }
    }
    return { principales, brazo: [] };
  }

  /** Coloca una fila de botones (hasta 4) en la altura y. */
  _colocarFila(lista, y) {
    const n = lista.length;
    const ancho = Math.min(BOTON.ancho, (GRAFO.ancho - (n - 1) * BOTON.hueco) / Math.max(1, n));
    const colores = { verde: COLORES.operacion, gris: COLORES.banda, rojo: COLORES.fallo };
    lista.forEach((d, i) => {
      const x = GRAFO.x + i * (ancho + BOTON.hueco);
      const rect = this.add.rectangle(x, y, ancho, BOTON.alto, colores[d.tipo]).setOrigin(0);
      rect.setInteractive({ useHandCursor: d.tipo !== 'gris' });
      // Rojo relleno con borde claro grueso; todo lo clicable se resalta con el puntero encima.
      resaltable(rect, d.tipo === 'rojo' ? [3, COLORES.texto, 1] : [2, COLORES.texto, d.tipo === 'gris' ? 0.25 : 0.9]);
      const texto = this.add
        .text(x + ancho / 2, y + BOTON.alto / 2, d.etiqueta, {
          fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: d.tipo === 'gris' ? '#8794a3' : TEXTO_HEX.texto, align: 'center', wordWrap: { width: ancho - 8 },
        })
        .setOrigin(0.5);
      const boton = { rect, texto, d };
      rect.on('pointerover', () => this._mostrarTip(d.tip));
      rect.on('pointerout', () => this.tip.setVisible(false));
      rect.on('pointerup', () => this._pulsar(d, rect));
      this.capaBotones.add([rect, texto]);
      this.botones.push(boton);
    });
  }

  _actualizarBotones() {
    // CNC en Falla: la consola de reparación reemplaza a los botones.
    const enFalla = this.tipo === 'CNC' && this.celda.estado(this.maquinaId) === 'Falla';
    if (enFalla !== this._modoConsola) {
      this._modoConsola = enFalla;
      this._firmaBotones = '';
      this.tip.setVisible(false);
    }
    // La consola de reparación va en la pestaña «Acciones» (en «Autómata» el botón r · reset lleva a ella).
    const consola = enFalla && this._pestana === 'acciones';
    this.capaConsola.setVisible(consola);
    if (consola) {
      this.capaBotones.removeAll(true);
      this.botones = [];
      this.cabeceraBrazo.setVisible(false);
      if (!this._consolaLista) this._construirConsola();
      this._claveConsola = '';
      this._refrescarConsola();
      return;
    }
    this._consolaLista = false;
    if (this._pestana !== 'automata') {
      // Los botones de evento solo existen en la pestaña Autómata (en las otras no se ven ni reciben clics).
      this.capaBotones.removeAll(true);
      this.botones = [];
      this._firmaBotones = '';
      this.cabeceraBrazo.setVisible(false);
      return;
    }
    const { principales, brazo } = this._describirBotones();
    const firma = JSON.stringify([principales, brazo].map((l) => l.map((d) => [d.etiqueta, d.tipo, d.tip])));
    if (firma === this._firmaBotones) return;
    this._firmaBotones = firma;
    this.tip.setVisible(false); // los botones se rehicieron: el aviso anterior ya no corresponde
    this.capaBotones.removeAll(true);
    this.botones = [];
    const y1 = this._yBotones;
    this._colocarFila(principales, y1);
    this._yLista = y1 + BOTON.alto + 8;
    if (brazo.length > 0) {
      const yCab = y1 + BOTON.alto + 6;
      this.cabeceraBrazo.setPosition(12, yCab).setVisible(true);
      this._colocarFila(brazo, yCab + 14);
      this._yLista = yCab + 14 + BOTON.alto + 8;
    } else {
      this.cabeceraBrazo.setVisible(false);
    }
  }

  // ---- Consola de reparación (CNC en Falla) ----

  /** Crea la consola: campo con la palabra, estado del DFA, comandos H C T R y Borrar, Enviar, Ayuda. */
  _construirConsola() {
    this.capaConsola.removeAll(true);
    this.consola.limpiar();
    const y0 = ACC.y; // la consola ocupa el sitio de los botones de «Acciones»
    const texto = (x, y, t, estilo = {}) => {
      const o = this.add.text(x, y, t, { fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, ...estilo });
      this.capaConsola.add(o);
      return o;
    };
    texto(12, y0, 'Consola de reparación: la CNC está en Falla', { fontStyle: 'bold', color: TEXTO_HEX.espera });
    const campo = this.add.rectangle(12, y0 + 14, ANCHO_UTIL, 28, COLORES.panel).setOrigin(0).setStrokeStyle(2, COLORES.maquina);
    this.capaConsola.add(campo);
    const mono = { fontFamily: 'Courier New, monospace', fontSize: '18px', fontStyle: 'bold' };
    this.txtPalabra = texto(20, y0 + 17, '', mono);
    this.txtMala = texto(20, y0 + 17, '', { ...mono, color: TEXTO_HEX.fallo });
    this.txtVacio = texto(20, y0 + 21, 'w = escribe H, C, T, R y Enter', { color: '#8794a3' });
    this.txtEstado = texto(12, y0 + 46, '', { fontStyle: 'bold' });
    this.txtAviso = texto(12, y0 + 59, '', { wordWrap: { width: ANCHO_UTIL } });
    this._claveConsola = '';

    const boton = (x, y, ancho, etiqueta, color, accion, tip, colorTexto = TEXTO_HEX.texto) => {
      const rect = resaltable(this.add.rectangle(x, y, ancho, BOTON.alto, color).setOrigin(0).setInteractive({ useHandCursor: true }));
      const t = this.add.text(x + ancho / 2, y + BOTON.alto / 2, etiqueta, {
        fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: colorTexto, align: 'center',
      }).setOrigin(0.5);
      rect.on('pointerup', () => { if (this.consolaAbierta) { this.planta.sonidos.clic(); accion(); this._consolaSucia = true; } });
      rect.on('pointerover', () => this._mostrarTip(tip));
      rect.on('pointerout', () => this.tip.setVisible(false));
      this.capaConsola.add([rect, t]);
    };
    const fila1 = y0 + 88;
    const w4 = (ANCHO_UTIL - 3 * BOTON.hueco) / 4;
    [['H', 'home'], ['C', 'chequeo'], ['T', 'cambio'], ['R', 'reset']].forEach(([s, nombre], i) => {
      boton(12 + i * (w4 + BOTON.hueco), fila1, w4, `${s}\n${nombre}`, COLORES.mantenimiento, () => this.consola.escribir(s), `${s}: ${COMANDOS[s]}`);
    });
    const fila2 = fila1 + BOTON.alto + 4;
    const w3 = (ANCHO_UTIL - 2 * BOTON.hueco) / 3;
    boton(12, fila2, w3, '⌫ Borrar', COLORES.banda, () => this.consola.borrar(), 'Retroceso: quita el último comando');
    boton(12 + w3 + BOTON.hueco, fila2, w3, '↵ Enviar', COLORES.operacion, () => this._enviar(), 'Enter: valida la palabra con la RegExp y el DFA');
    boton(12 + 2 * (w3 + BOTON.hueco), fila2, w3, '? Ayuda (−20)', COLORES.espera, () => this.celda.pedirAyuda(this.maquinaId), 'Muestra la expresión regular 5 s y resta 20 puntos', '#161b22');
    this._consolaLista = true;
  }

  /** Envía la palabra: si w ∈ L la Celda ejecuta reset por δ (+50); si no, la CNC sigue en Falla (−30). */
  _enviar() {
    const w = this.consola.palabra;
    if (!w) {
      this._mensaje = { texto: 'Escribe una palabra antes de enviar.', color: TEXTO_HEX.espera, hasta: this.time.now + 2500 };
      return;
    }
    this.celda.solicitar(this.maquinaId, 'reset', { palabra: w });
    this.consola.limpiar(); // válida o no, la consola se borra
    this._sucia = true;
  }

  /** Teclado de la consola: H, C, T, R, Retroceso y Enter. */
  _alTecla(evento) {
    // En equipos lentos Phaser puede entregar varias veces el mismo evento de teclado: cada tecla se atiende una sola vez.
    if (this._atendidas.has(evento)) return;
    this._atendidas.add(evento);
    if (!this.consolaAbierta) return;
    const k = evento.key;
    if (k === 'Enter') this._enviar();
    else if (k === 'Backspace') {
      evento.preventDefault();
      this.consola.borrar();
    } else if (k.length === 1 && 'hctrHCTR'.includes(k)) this.consola.escribir(k);
    else return;
    this._consolaSucia = true;
  }

  /** Dibuja la palabra, el estado del DFA y el aviso (error, ayuda, mensaje o lo que se espera). */
  _refrescarConsola() {
    const c = this.consola;
    const ahora = this.celda.reloj.ahora;
    const ayuda = ahora < this.celda.ayudaHasta;
    const mensaje = this._mensaje && this._mensaje.hasta > this.time.now ? this._mensaje : null;
    const clave = [c.palabra, c.fallo?.indice, ayuda ? Math.ceil(this.celda.ayudaHasta - ahora) : '-', mensaje?.texto].join('|');
    if (clave === this._claveConsola) return;
    this._claveConsola = clave;

    // Desde el primer símbolo sin transición, el resto de la palabra se marca en rojo.
    const ok = c.fallo ? c.palabra.slice(0, c.fallo.indice) : c.palabra;
    this.txtPalabra.setText(ok);
    this.txtMala.setText(c.fallo ? c.palabra.slice(c.fallo.indice) : '').setX(this.txtPalabra.x + this.txtPalabra.width);
    this.txtVacio.setVisible(c.palabra === '');
    this.txtEstado
      .setText(c.fallo ? 'DFA: sin transición para ese símbolo ✗' : `DFA: ${c.estado}${c.aceptada ? '  (aceptada ✔)' : ''}   |   siguiente: ${c.esperados.join(', ') || '—'}`)
      .setColor(c.fallo ? TEXTO_HEX.fallo : c.aceptada ? TEXTO_HEX.operacion : TEXTO_HEX.texto);
    if (ayuda) this.txtAviso.setText(`Ayuda: la palabra debe cumplir ${EXPRESION_TEXTO}  (${Math.ceil(this.celda.ayudaHasta - ahora)} s)`).setColor(TEXTO_HEX.espera);
    else if (mensaje) this.txtAviso.setText(mensaje.texto).setColor(mensaje.color);
    else this.txtAviso.setText(c.sugerencia).setColor(c.fallo ? TEXTO_HEX.fallo : TEXTO_HEX.texto);
  }

  // ---- Pestañas: Autómata y Composición (solo en el HUD de las CNC) ----

  _cambiarPestana(pestana) {
    if (pestana === this._pestana || (pestana === 'composicion' && this.tipo !== 'CNC')) return;
    this._pestana = pestana;
    this._aplicarPestana();
  }

  /** Tab: pasa de «Autómata» a «Acciones» y al revés. */
  alternarPestana() {
    this._cambiarPestana(this._pestana === 'automata' ? 'acciones' : 'automata');
  }

  /** Muestra las capas de la pestaña actual y obliga a rehacer botones, consola, lista e historial. */
  _aplicarPestana() {
    const p = this._pestana;
    for (const o of [this.gfxFijo, this.gfxNodo, this.gfxParpadeo, this.capaTextos, this.capaBotones]) o.setVisible(p === 'automata');
    this.capaAcciones.setVisible(p === 'acciones');
    if (p !== 'acciones') {
      // Los botones grandes solo existen en «Acciones» (ocultos seguirían recibiendo el puntero).
      this.accBoton.removeAll(true);
      this.botonesAcc = [];
    }
    this.capaComposicion.setVisible(p === 'composicion');
    this.tip.setVisible(false);
    this._sucia = true;
    this._firmaBotones = '';
    this._firmaAccion = '';
    this._firmaHistorial = '';
    this._consolaLista = false;
    this._claveConsola = '';
    this._claveComp = '';
    this._estilizarPestanas();
  }

  _estilizarPestanas() {
    for (const [clave, p] of Object.entries(this.pestanas)) {
      const activa = clave === this._pestana;
      p.rect.setFillStyle(activa ? COLORES.banda : COLORES.panel);
      fijarBorde(p.rect, activa ? 2 : 1, activa ? COLORES.texto : COLORES.maquina, 1);
    }
  }

  /** Al abrir una máquina: pestaña «Autómata» (o la pedida); «Composición» solo existe en las CNC. */
  _reiniciarPestanas(pestana = 'automata') {
    this._pestana = pestana;
    this.pestanas.composicion.rect.setVisible(this.tipo === 'CNC');
    this.pestanas.composicion.t.setVisible(this.tipo === 'CNC');
    this._aplicarPestana();
  }

  // ---- Pestaña «Acciones»: los eventos de la máquina como botones grandes con verbo de juego ----

  /** Ícono sencillo de cada verbo (24 px) con centro en (cx, cy). */
  _iconoVerbo(g, id, cx, cy, color) {
    g.lineStyle(3, color, 1);
    g.fillStyle(color, 1);
    const flecha = (dx) => {
      g.lineBetween(cx - 9 * dx, cy, cx + 7 * dx, cy);
      g.fillTriangle(cx + 11 * dx, cy, cx + 3 * dx, cy - 6, cx + 3 * dx, cy + 6);
    };
    if (id === 'ir1' || id === 'ir2') flecha(1);
    else if (id === 'volver') flecha(-1);
    else if (id === 'abrir') {
      g.lineBetween(cx - 9, cy - 8, cx - 9, cy + 8); // dedos separados
      g.lineBetween(cx + 9, cy - 8, cx + 9, cy + 8);
      g.lineBetween(cx - 9, cy - 8, cx + 9, cy - 8);
    } else if (id === 'cerrar') {
      g.lineBetween(cx - 3, cy - 8, cx - 3, cy + 8); // dedos juntos
      g.lineBetween(cx + 3, cy - 8, cx + 3, cy + 8);
      g.lineBetween(cx - 9, cy - 8, cx + 9, cy - 8);
    } else if (id === 'meter') {
      g.fillRect(cx - 6, cy - 2, 12, 10); // bloque que baja
      g.fillTriangle(cx, cy - 4, cx - 6, cy - 11, cx + 6, cy - 11);
    } else if (id === 'sacar') {
      g.fillRect(cx - 6, cy, 12, 10); // pieza que sube
      g.fillTriangle(cx, cy - 12, cx - 6, cy - 4, cx + 6, cy - 4);
    } else if (id.startsWith('fresar')) {
      g.strokeRect(cx - 10, cy - 4, 20, 14); // CNC con husillo
      g.fillRect(cx - 3, cy - 12, 6, 12);
    } else {
      g.strokeRect(cx - 11, cy - 4, 22, 9); // AGV con su caja de metal
      g.fillRect(cx - 5, cy - 11, 10, 7);
      g.fillCircle(cx - 6, cy + 9, 3);
      g.fillCircle(cx + 6, cy + 9, 3);
    }
  }

  /** Clic en un botón grande: UN evento, por la misma vía que la barra de control. */
  _pulsarVerbo(d, rect) {
    if (this._pestana !== 'acciones') return;
    const r = this.planta.pulsarControl(d.id, this.tipo === 'CNC' ? { cnc: this.maquinaId } : {});
    if (!r) return;
    this._destello = { x: rect.x, y: rect.y, ancho: rect.width, alto: rect.height, inicio: this.time.now };
    this._sucia = true;
    if (!r.ok && !r.reparar) this._mostrarTip(r.tipo === 'rojo' ? `Bloqueado (−15 puntos). ${r.tip}` : r.tip);
  }

  /** Por cuadro en la pestaña «Acciones»: estado, botones (solo se rehacen si cambiaron), progreso del fresado e historial. */
  _actualizarAcciones() {
    const c = this.celda;
    const id = this.maquinaId;
    const estado = this.automata.estado;
    const consola = this._modoConsola; // CNC en Falla: la consola ocupa el sitio de los botones
    const contexto = this.tipo === 'CNC' ? { cnc: id } : {};
    const ds = consola ? [] : verbosDe(id).map((v) => describir(c, v, contexto));
    const columnas = ds.length > 3 ? 2 : 1;
    const ancho = (ANCHO_UTIL - (columnas - 1) * 8) / columnas;
    const lugar = (i) => ({ x: ACC.x + (i % columnas) * (ancho + 8), y: ACC.y + Math.floor(i / columnas) * (ACC.alto + ACC.hueco) });
    const firma = [estado, consola, ...ds.map((d) => `${d.verbo}|${d.tipo}|${d.tip}`)].join('#');
    if (firma !== this._firmaAccion) {
      this._firmaAccion = firma;
      const color = aspectoDe(this.tipo, estado).color;
      this.accPunto.clear().fillStyle(color, 1).fillCircle(19, 38, 6).lineStyle(1.5, COLORES.texto, 0.9).strokeCircle(19, 38, 6);
      this.accEstado.setText(`Estado: ${estado.replace(/_/g, ' ')}`);
      this.accQueHace.setVisible(!consola);
      this.accBoton.removeAll(true);
      this.botonesAcc = [];
      this.tip.setVisible(false);
      ds.forEach((d, i) => {
        const { x, y } = lugar(i);
        const activo = d.tipo !== 'gris';
        const rect = this.add.rectangle(x, y, ancho, ACC.alto, COLOR_VERBO[d.tipo]).setOrigin(0).setInteractive({ useHandCursor: activo });
        resaltable(rect, d.tipo === 'rojo' ? [3, COLORES.texto, 1] : [2, COLORES.texto, activo ? 0.9 : 0.25]);
        const tinta = activo ? COLORES.texto : COLORES.maquina;
        const icono = this.add.graphics();
        this._iconoVerbo(icono, d.id, x + 22, y + ACC.alto / 2, tinta);
        const colorTexto = activo ? TEXTO_HEX.texto : '#8794a3';
        const verbo = this.add.text(x + 44, y + 5, d.verbo, { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: colorTexto });
        const evento = this.add.text(x + 44, y + 22, `${d.codigo} · ${d.nombre}`, { fontFamily: 'Arial', fontSize: '9px', color: colorTexto });
        const tecla = this.add.text(x + ancho - 6, y + 4, d.tecla, { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: colorTexto, backgroundColor: 'rgba(22,27,34,0.55)', padding: { x: 4, y: 1 } }).setOrigin(1, 0);
        rect.on('pointerup', () => this._pulsarVerbo(d, rect));
        rect.on('pointerover', () => this._mostrarTip(d.tip));
        rect.on('pointerout', () => this.tip.setVisible(false));
        this.accBoton.add([rect, icono, verbo, evento, tecla]);
        this.botonesAcc.push({ rect, d });
      });
    }

    // CNC fresando: barra de progreso dentro del botón «Fresar» (el fin del fresado no es controlable).
    const g = this.accProgreso;
    g.clear();
    const iFresar = ds.findIndex((d) => d.fresando);
    if (iFresar >= 0) {
      const { x, y } = lugar(iFresar);
      const { fraccion } = progresoFresado(c, id);
      g.fillStyle(COLORES.panel, 0.7).fillRect(x + 4, y + ACC.alto - 6, ancho - 8, 4);
      g.fillStyle(COLORES.operacion, 1).fillRect(x + 4, y + ACC.alto - 6, (ancho - 8) * fraccion, 4);
    }

    // Historial: cada evento del autómata de esta máquina, uno por línea (los más nuevos abajo).
    const yH = consola ? 256 : ACC.y + Math.ceil(ds.length / columnas) * (ACC.alto + ACC.hueco) + 4;
    const lineas = Math.max(1, Math.floor((PANEL.alto - 26 - (yH + 16)) / 13));
    const firmaH = `${consola}|${yH}|${c.bitacora.length}`;
    if (firmaH !== this._firmaHistorial) {
      this._firmaHistorial = firmaH;
      const filas = c.bitacora.filter((e) => e.tipo === 'automata' && e.maquina === id).slice(-lineas);
      const codigo = new Map(this.modelo.eventos.map((e) => [e.id, e.codigo]));
      this.accCabecera.setPosition(12, yH).setText(filas.length ? `Últimos ${filas.length} eventos de ${NOMBRE_MAQUINA[id]} (los más nuevos abajo)` : 'Todavía no hay eventos en esta máquina');
      this.accHistorial.setPosition(12, yH + 16).setText(
        filas.map((h) => `${h.t.toFixed(1).padStart(6)} s  ${codigo.get(h.evento) ?? '?'}  ${h.evento.padEnd(16)} ${h.de} → ${h.a}`).join('\n'),
      );
    }
  }

  /** Pestaña Composición: tamaños de CNC ‖ Brazo y del sistema supervisado, y el estado compuesto actual. */
  _refrescarComposicion() {
    const c = this.celda;
    const id = this.maquinaId;
    const sup = c.supervisores[id];
    const [q, b] = c.estadoCompuesto(id);
    const clave = claveDe([q, b]);
    const atiende = c.atendida === id;
    const deshabilitados = c.deshabilitadosPorSupervisor(id);
    const codigo = new Map([...MODELOS.cnc.eventos, ...MODELOS.brazo.eventos].map((e) => [e.id, e.codigo]));
    const texto = [
      `Supervisor de esta CNC: ${atiende ? `ACTIVO (el brazo atiende a ${id})` : `INACTIVO (el brazo no atiende a ${id}: sin restricción)`}`,
      `¿En el sistema supervisado? ${sup.estados.includes(clave) ? 'sí ✔' : 'no ✗ (estado prohibido: solo ocurre porque el brazo atiende a la otra CNC)'}`,
      `Eventos deshabilitados ahora: ${deshabilitados.length ? deshabilitados.map((d) => `${codigo.get(d.evento)} · ${d.evento}`).join(', ') : 'ninguno'}`,
      `Intentos bloqueados en esta CNC: ${sup.bloqueos} (−15 puntos cada uno)`,
    ].join('\n');
    const total = `${q}|${b}|${texto}`;
    if (total === this._claveComp) return;
    this._claveComp = total;
    this.txtCompEstado.setText(`(${q}, ${b})`).setColor(sup.estados.includes(clave) ? TEXTO_HEX.espera : TEXTO_HEX.fallo);
    this.txtCompB.setText(texto);
  }

  _mostrarTip(texto) {
    this.tip.setText(texto).setVisible(true);
  }

  /** Clic en un botón: pide el evento a la Celda (δ y transición). Gris no hace nada. */
  _pulsar(d, rect) {
    if (this._pestana !== 'automata') return;
    if (d.consola) return this._cambiarPestana('acciones'); // r · reset: la palabra se escribe en la consola
    if (d.tipo === 'gris' || !d.maquina || !this.planta.juegoActivo()) return;
    this.planta.sonidos.clic();
    if (rect) this._destello = { x: rect.x, y: rect.y, ancho: rect.width, alto: rect.height, inicio: this.time.now };
    const r = this.celda.solicitar(d.maquina, d.evento, d.opciones);
    this._sucia = true;
    if (!r.ok) this._mostrarTip(`Rechazado (${r.motivo}). ${d.tip}`);
  }

  // ---- Lista de eventos ----

  /** Últimos 10 eventos de la máquina: su palabra observada. */
  _actualizarLista() {
    this._listaVisible(this._pestana === 'automata');
    if (this._pestana !== 'automata') return;
    const eventos = this.celda.bitacora.filter((e) => e.tipo === 'automata' && e.maquina === this.maquinaId).slice(-10);
    const codigo = new Map(this.modelo.eventos.map((e) => [e.id, e.codigo]));
    const palabra = eventos.map((e) => codigo.get(e.evento)).join(' ');
    const y = this._yLista ?? 300;
    this.cabeceraLista.setPosition(12, y).setText(`Últimos ${eventos.length} eventos (palabra observada: ${palabra || '—'})`);
    const filas = eventos.map((e) => ({ t: `${e.t.toFixed(1)} s`, c: codigo.get(e.evento), f: `${e.de} → ${e.a}` })).reverse();
    this.columnas.forEach((col, k) => {
      const x0 = 12 + k * 224;
      const trozo = filas.slice(k * 5, k * 5 + 5);
      col.t.setPosition(x0 + 32, y + 14).setText(trozo.map((r) => r.t).join('\n'));
      col.c.setPosition(x0 + 40, y + 14).setText(trozo.map((r) => r.c).join('\n'));
      col.f.setPosition(x0 + 54, y + 14).setText(trozo.map((r) => r.f).join('\n'));
    });
  }

  _listaVisible(v) {
    this.cabeceraLista.setVisible(v);
    for (const c of this.columnas) [c.t, c.c, c.f].forEach((o) => o.setVisible(v));
  }
}
