// HUD de máquina: escena superpuesta que se lanza en paralelo a Planta (no pausa la simulación).
// Dibuja el grafo del autómata de la máquina elegida con las coordenadas del .jff, ilumina el estado actual,
// ofrece un botón por cada evento de Γ(q) y lista los últimos 10 eventos de la máquina.
// No cambia ningún estado por su cuenta: cada botón le pide el evento a la Celda (δ y red de Petri).

import { COLORES, TEXTO_HEX } from '../config.js';
import { aspectoDe } from '../arte/estados.js';
import { MODELOS } from '../modelos.js';
import { ConsolaReparacion, COMANDOS } from '../sed/consola.js';
import { EXPRESION_TEXTO } from '../sed/lenguaje.js';
import { claveDe } from '../sed/composicion.js';

const PANEL = { ancho: 340, alto: 392, y: 56, xDerecha: 612, xIzquierda: 8 }; // docs/arte.md, sección 7
const GRAFO = { x: 12, y: 26, ancho: 316, alto: 198, margen: 30 };
const RADIO = 18; // nodos de 36 px
const BOTON = { ancho: 100, alto: 44, hueco: 8, y: 228 }; // táctil: 44 px como mínimo
const PARPADEO = 0.5; // s de simulación que parpadea la última transición
const HEX = (c) => `#${c.toString(16).padStart(6, '0')}`;

const MODELO_DE = { CNC: MODELOS.cnc, BRAZO: MODELOS.brazo, AGV: MODELOS.agv };
const tipoDe = (id) => id.replace(/\d$/, '');

export class HUDMaquina extends Phaser.Scene {
  constructor() {
    super('HUDMaquina');
  }

  create() {
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

    // Pestañas del HUD de las CNC: Autómata y Composición.
    this._pestana = 'automata';
    this.pestanas = {};
    for (const [clave, etiqueta, x, ancho] of [['automata', 'Autómata', 70, 56], ['composicion', 'Composición', 130, 74]]) {
      const rect = this.add.rectangle(x, 5, ancho, 18, COLORES.panel).setOrigin(0).setStrokeStyle(1, COLORES.maquina).setInteractive({ useHandCursor: true });
      const t = this.add.text(x + ancho / 2, 14, etiqueta, { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.texto }).setOrigin(0.5);
      rect.on('pointerup', () => this._cambiarPestana(clave));
      this.pestanas[clave] = { rect, t };
    }
    this.capaComposicion = this.add.container(0, 0).setVisible(false);
    const fuente = { fontFamily: 'Arial', fontSize: '11px', color: TEXTO_HEX.texto, lineSpacing: 5, wordWrap: { width: 316 } };
    this.capaComposicion.add([
      this.add.text(12, 36, '', fuente), // cifras: se rellenan en abrir()
      this.add.text(12, 112, 'Estado compuesto actual (esta CNC, Brazo):', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera }),
    ]);
    this.txtCompFijo = this.capaComposicion.list[0];
    this.txtCompEstado = this.add.text(12, 128, '', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    this.txtCompB = this.add.text(12, 166, '', fuente);
    this.capaComposicion.add([this.txtCompEstado, this.txtCompB]);

    this.gfxFijo = this.add.graphics(); // aristas y nodos sin iluminar
    this.gfxNodo = this.add.graphics(); // nodo del estado actual (con glow)
    this.gfxNodo.enableFilters();
    // setPaddingOverride(null): Phaser 4 no da margen al filtro por defecto y el borde del nodo se estira por la pantalla.
    this.glow = this.gfxNodo.filters.internal.addGlow(COLORES.texto, 4, 0).setPaddingOverride(null);
    this.gfxParpadeo = this.add.graphics(); // última transición
    this.capaTextos = this.add.container(0, 0);
    this.capaBotones = this.add.container(0, 0);
    this.capaConsola = this.add.container(0, 0).setVisible(false);
    this.listaIzq = this.add.text(12, 0, '', { fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, lineSpacing: 2 });
    this.listaDer = this.add.text(12 + 160, 0, '', { fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, lineSpacing: 2 });
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
      this.capaBotones, this.capaConsola, this.capaComposicion, ...Object.values(this.pestanas).flatMap((q) => [q.rect, q.t]), this.cabeceraBrazo, this.aviso, this.cabeceraLista, this.listaIzq, this.listaDer, this.tip,
    ]);
    this.botones = [];
    this._firmaBotones = '';
    // Teclado de la consola de reparación (H, C, T, R, Retroceso y Enter).
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

  /** Abre el panel para una máquina (CNC1, CNC2, BRAZO, AGV1 o AGV2). */
  abrir(id, nombre) {
    const planta = this.scene.get('Planta');
    this._soltarCelda();
    this.celda = planta.celda;
    this.planta = planta;
    this.maquinaId = id;
    this.tipo = tipoDe(id);
    this.modelo = MODELO_DE[this.tipo];
    this.automata = this.celda.automatas[id];
    this.titulo.setText(this.tipo === 'CNC' ? `${nombre ?? id}` : `${nombre ?? id}   (${this.modelo.nombre})`);
    // Cifras de la pestaña Composición (CNC ‖ Brazo y sistema supervisado).
    const sup = this.celda.supervisores[id];
    this.txtCompFijo?.setText(
      `CNC ‖ Brazo (planta): ${this.celda.composicion.estados.length} estados, ${this.celda.composicion.transiciones.length} transiciones
Sistema supervisado: ${sup ? sup.estados.length : '-'} estados, ${sup ? sup.transiciones.length : '-'} transiciones
Estado prohibido: (Fresando, Mandril_Abierto)
Regla: ${this.celda.razonSupervisor}`,
    );
    this._reiniciarPestanas();

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
      // Los puntos de esta máquina (reparación válida, palabra inválida, ayuda) se avisan en la consola.
      if (e.tipo === 'puntos' && e.maquina === this.maquinaId) {
        const signo = e.puntos > 0 ? '+' : '';
        this._mensaje = { texto: `${signo}${e.puntos} puntos: ${e.motivo}`, color: e.puntos > 0 ? TEXTO_HEX.operacion : TEXTO_HEX.espera, hasta: this.time.now + 3500 };
      }
    });
    this._dibujarGrafo();
    this._estadoNodo = null;
    this._firmaBotones = '';
    this._sucia = true;
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

  /** Posición de cada estado en el panel: las coordenadas del .jff escaladas al área del grafo. */
  _posiciones() {
    const pos = this.modelo.posiciones;
    const xs = Object.values(pos).map((p) => p[0]);
    const ys = Object.values(pos).map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const sx = (GRAFO.ancho - 2 * GRAFO.margen) / Math.max(1, x1 - x0);
    const sy = (this._altoGrafo - 2 * this._margenY) / Math.max(1, y1 - y0);
    const salida = {};
    for (const [nombre, [x, y]] of Object.entries(pos)) {
      salida[nombre] = { x: GRAFO.x + GRAFO.margen + (x - x0) * sx, y: GRAFO.y + this._margenY + (y - y0) * sy };
    }
    return salida;
  }

  _dibujarGrafo() {
    const g = this.gfxFijo;
    g.clear();
    this.capaTextos.removeAll(true);
    // Las CNC llevan además la sección del brazo, así que su grafo es más bajo.
    this._altoGrafo = this.tipo === 'CNC' ? 150 : GRAFO.alto;
    this._margenY = this.tipo === 'CNC' ? 22 : GRAFO.margen;
    this._yBotones = GRAFO.y + this._altoGrafo + 4;
    this.pos = this._posiciones();
    this.aristas = this._calcularAristas();

    // Aristas con flecha y el código del evento.
    for (const a of this.aristas) {
      g.lineStyle(1.5, COLORES.maquina, 1);
      g.strokePoints(a.puntos, false);
      g.fillStyle(COLORES.maquina, 1);
      g.fillPoints(a.flecha, true);
      this._texto(a.rotulo.x, a.rotulo.y, a.codigo, { fontSize: '11px', fontStyle: 'bold' }).setOrigin(0.5);
    }
    // Estado inicial: flecha de entrada desde la izquierda.
    const ini = this.pos[this.modelo.inicial];
    const entrada = this._flecha({ x: ini.x - RADIO - 22, y: ini.y }, { x: ini.x - RADIO, y: ini.y });
    g.lineStyle(1.5, COLORES.maquina, 1);
    g.lineBetween(ini.x - RADIO - 22, ini.y, ini.x - RADIO - 4, ini.y);
    g.fillStyle(COLORES.maquina, 1);
    g.fillPoints(entrada, true);

    // Nodos: círculo con su nombre debajo; los marcados llevan doble círculo.
    for (const estado of this.modelo.estados) {
      const p = this.pos[estado];
      g.fillStyle(COLORES.panel, 1);
      g.fillCircle(p.x, p.y, RADIO);
      g.lineStyle(2, COLORES.maquina, 1);
      g.strokeCircle(p.x, p.y, RADIO);
      if (this.modelo.marcados.includes(estado)) g.strokeCircle(p.x, p.y, RADIO - 4);
      this._texto(p.x, p.y + RADIO + 2, estado, { fontSize: '9px' }).setOrigin(0.5, 0);
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
    return [fin, punta(ang + Math.PI - 0.4, 8), punta(ang + Math.PI + 0.4, 8)];
  }

  /** Cada transición como una curva entre los bordes de sus nodos (con bucles para las autotransiciones). */
  _calcularAristas() {
    const evento = new Map(this.modelo.eventos.map((e) => [e.id, e]));
    const grupos = new Map();
    for (const [de, ev, a] of this.modelo.transiciones) {
      const k = `${de}>${a}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push({ de, ev, a });
    }
    const salida = [];
    for (const [k, lista] of grupos) {
      const [de, a] = k.split('>');
      const hayInversa = grupos.has(`${a}>${de}`);
      lista.forEach((t, i) => {
        const codigo = evento.get(t.ev).codigo;
        const base = { de: t.de, ev: t.ev, a: t.a, codigo };
        const p = this.pos[de];
        const q = this.pos[a];
        if (de === a) {
          // Bucle: arco sobre el nodo.
          const cy = p.y - RADIO - 8;
          const puntos = [];
          for (let j = 0; j <= 16; j++) {
            const ang = Math.PI * 0.15 + (Math.PI * 1.7 * j) / 16 + Math.PI * 0.5 + Math.PI;
            puntos.push({ x: p.x + Math.cos(ang) * 9, y: cy + Math.sin(ang) * 9 });
          }
          salida.push({ ...base, puntos, flecha: this._flecha(puntos[puntos.length - 2], puntos[puntos.length - 1]), rotulo: { x: p.x, y: cy - 16 } });
          return;
        }
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const largo = Math.hypot(dx, dy);
        const normal = { x: -dy / largo, y: dx / largo };
        const desplazamiento = ((hayInversa ? 0.2 : 0) + (i - (lista.length - 1) / 2) * 0.3) * largo;
        const control = { x: (p.x + q.x) / 2 + normal.x * desplazamiento * 2, y: (p.y + q.y) / 2 + normal.y * desplazamiento * 2 };
        const borde = (c, h) => {
          const d = Math.hypot(h.x - c.x, h.y - c.y);
          return { x: c.x + ((h.x - c.x) / d) * RADIO, y: c.y + ((h.y - c.y) / d) * RADIO };
        };
        const inicio = borde(p, control);
        const fin = borde(q, control);
        const puntos = [];
        for (let j = 0; j <= 16; j++) {
          const t2 = j / 16;
          puntos.push({
            x: (1 - t2) ** 2 * inicio.x + 2 * (1 - t2) * t2 * control.x + t2 ** 2 * fin.x,
            y: (1 - t2) ** 2 * inicio.y + 2 * (1 - t2) * t2 * control.y + t2 ** 2 * fin.y,
          });
        }
        const medio = puntos[8];
        const empuje = { x: normal.x * 7 * Math.sign(desplazamiento || 1), y: normal.y * 7 * Math.sign(desplazamiento || 1) };
        salida.push({ ...base, puntos, flecha: this._flecha(puntos[14], fin), rotulo: { x: medio.x + empuje.x, y: medio.y + empuje.y } });
      });
    }
    return salida;
  }

  // ---- Por cuadro ----

  update() {
    if (!this.abierto) return;
    const ahora = this.celda.reloj.ahora;
    const estado = this.automata.estado;

    // Nodo del estado actual: relleno con el color de su estado, borde claro y glow que pulsa.
    if (estado !== this._estadoNodo) {
      this._estadoNodo = estado;
      const p = this.pos[estado];
      const g = this.gfxNodo;
      g.clear();
      g.fillStyle(aspectoDe(this.tipo, estado).color, 1);
      g.fillCircle(p.x, p.y, RADIO);
      g.lineStyle(3, COLORES.texto, 1);
      g.strokeCircle(p.x, p.y, RADIO);
      if (this.modelo.marcados.includes(estado)) g.strokeCircle(p.x, p.y, RADIO - 4);
    }
    this.glow.outerStrength = 4 + 3 * Math.sin(this.time.now / 250);
    this.aviso.setText('Brazo en camino…').setVisible(this.celda.estado('BRAZO') === 'Moviendo');

    // Última transición recorrida: parpadea PARPADEO s de simulación.
    const b = this.gfxParpadeo;
    b.clear();
    const ultimo = this._ultimoEvento();
    if (ultimo && ahora - ultimo.t < PARPADEO && Math.floor((ahora - ultimo.t) / 0.125) % 2 === 0) {
      const a = this.aristas.find((x) => x.de === ultimo.de && x.ev === ultimo.evento && x.a === ultimo.a);
      if (a) {
        b.lineStyle(4, COLORES.espera, 1);
        b.strokePoints(a.puntos, false);
      }
    }

    // Los botones y la lista solo se rehacen cuando algo cambió.
    if (this._sucia) {
      this._sucia = false;
      this._actualizarBotones();
      this._actualizarLista();
    }
    if (this._pestana === 'composicion') {
      // Pestaña Composición: nada de lo del autómata se ve ni recibe clics.
      for (const o of [this.capaConsola, this.cabeceraBrazo, this.cabeceraLista, this.listaIzq, this.listaDer]) o.setVisible(false);
      this._refrescarComposicion();
    }
    if (this._modoConsola && this._consolaLista && this._pestana === 'automata') this._refrescarConsola();
    // Los botones rojos pulsan.
    for (const bt of this.botones) if (bt.glow) bt.glow.outerStrength = 3 + 3 * Math.sin(this.time.now / 200);
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
  _explicar(motivo, cnc) {
    const c = this.celda;
    if (motivo === 'supervisor') {
      return `Supervisor: ${c.razonSupervisor}. Estado (${c.estado(cnc)}, ${c.estado('BRAZO')}).`;
    }
    if (motivo === 'recurso') return 'Recurso ocupado: la red de Petri no habilita la transición (Robot_libre o Mesa_libre sin ficha).';
    return 'Ahora no se puede.';
  }

  /** Qué falta para un evento compartido (cargar o descargar) de la CNC `cnc`. */
  _faltaCompartido(cnc, ev) {
    const c = this.celda;
    const brazo = c.estado('BRAZO');
    if (c.atendida !== cnc) {
      return c.atendida
        ? `El brazo atiende a ${c.atendida}, no a esta CNC. Usa "volver" y luego "mover".`
        : 'El brazo debe estar frente a esta CNC: usa "mover" en "Brazo en esta CNC".';
    }
    if (brazo !== 'Mandril_Abierto') {
      const extra = brazo === 'Moviendo' ? ' (en camino)' : '';
      return `El brazo debe estar en Mandril_Abierto frente a esta CNC (ahora: ${brazo}${extra}).`;
    }
    const necesita = ev === 'cargar' ? 'Libre' : 'Terminado';
    return `La CNC debe estar en ${necesita} (ahora: ${c.estado(cnc)}).`;
  }

  /** Botones del brazo que sirven para la CNC `cnc`: mover, abrir_mandril, cerrar_mandril y volver. */
  _botonesBrazoEnCnc(cnc) {
    const c = this.celda;
    const brazo = c.estado('BRAZO');
    const frente = c.atendida === cnc;
    const gris = (etiqueta, tip) => ({ etiqueta, tipo: 'gris', tip });
    const ejecutable = (etiqueta, evento, opciones, motivo, faltaSiIndefinido) => {
      if (motivo === null) return { etiqueta, maquina: 'BRAZO', evento, opciones, tipo: 'verde', tip: 'Ejecutar el evento (δ del brazo)' };
      if (motivo === 'supervisor') return { etiqueta, maquina: 'BRAZO', evento, opciones, tipo: 'rojo', tip: this._explicar(motivo, cnc) };
      return gris(etiqueta, motivo === 'indefinido' ? faltaSiIndefinido : this._explicar(motivo, cnc));
    };
    const ocupado = c.atendida ? `El brazo atiende a ${c.atendida}.` : 'El brazo no está en esta CNC: usa "mover".';
    const op = { objetivo: cnc };
    return [
      ejecutable('m · mover', 'mover', op, c.evaluar('BRAZO', 'mover', op),
        `El brazo debe estar en Reposo (ahora: ${brazo}${c.atendida ? `, atendiendo a ${c.atendida}` : ''}). Usa "volver" primero.`),
      frente
        ? ejecutable('a · abrir', 'abrir_mandril', undefined, c.evaluar('BRAZO', 'abrir_mandril'), `El brazo debe estar en Mandril_Cerrado (ahora: ${brazo}).`)
        : gris('a · abrir', ocupado),
      frente
        ? ejecutable('e · cerrar', 'cerrar_mandril', undefined, c.evaluar('BRAZO', 'cerrar_mandril'), `El brazo debe estar en Mandril_Abierto (ahora: ${brazo}).`)
        : gris('e · cerrar', ocupado),
      frente
        ? ejecutable('m · volver', 'volver', undefined, c.evaluar('BRAZO', 'volver'), `El brazo debe estar en Mandril_Cerrado (ahora: ${brazo}).`)
        : gris('m · volver', ocupado),
    ];
  }

  /** Botones de la máquina: uno por cada evento de Γ(q) y, en las CNC, la sección del brazo. */
  _describirBotones() {
    const c = this.celda;
    const id = this.maquinaId;
    const principales = [];
    // Convierte el resultado de evaluar() en el tipo de botón y su explicación.
    const segun = (motivo, cnc, ev) => {
      if (motivo === null) return { tipo: 'verde', tip: 'Ejecutar el evento (δ)' };
      if (motivo === 'supervisor' || motivo === 'recurso') return { tipo: motivo === 'supervisor' ? 'rojo' : 'gris', tip: this._explicar(motivo, cnc) };
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
          principales.push({ etiqueta, tipo: 'gris', tip: 'Reparar exige la palabra de la consola (H, C, T, R): aún no está disponible.' });
        } else {
          principales.push({ etiqueta, maquina: id, evento: ev, ...segun(c.evaluar(id, ev), id, ev) });
        }
      } else if (this.tipo === 'BRAZO') {
        if (ev === 'mover') {
          if (this.automata.estado === 'Reposo') {
            for (const objetivo of ['CNC1', 'CNC2']) {
              principales.push({ etiqueta: `m → ${objetivo}`, maquina: 'BRAZO', evento: ev, opciones: { objetivo }, ...segun(c.evaluar('BRAZO', ev, { objetivo }), objetivo, ev) });
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
        principales.push({ etiqueta: `v · Despachar ${id}`, maquina: id, evento: ev, ...segun(c.evaluar(id, ev), id, ev) });
      } else {
        principales.push({ etiqueta, tipo: 'gris', tip: 'Transición automática de la red: se dispara sola cuando hay mesa y brazo.' });
      }
    }
    const brazo = this.tipo === 'CNC' ? this._botonesBrazoEnCnc(id) : [];
    return { principales, brazo };
  }

  /** Coloca una fila de botones (hasta 4) en la altura y. */
  _colocarFila(lista, y) {
    const n = lista.length;
    const ancho = Math.min(BOTON.ancho, (GRAFO.ancho - (n - 1) * BOTON.hueco) / Math.max(1, n));
    const colores = { verde: COLORES.operacion, gris: COLORES.banda, rojo: COLORES.fallo };
    lista.forEach((d, i) => {
      const x = GRAFO.x + i * (ancho + BOTON.hueco);
      const rect = this.add.rectangle(x, y, ancho, BOTON.alto, colores[d.tipo]).setOrigin(0).setStrokeStyle(2, COLORES.texto, d.tipo === 'gris' ? 0.25 : 0.9);
      rect.setInteractive({ useHandCursor: d.tipo !== 'gris' });
      const texto = this.add
        .text(x + ancho / 2, y + BOTON.alto / 2, d.etiqueta, {
          fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: d.tipo === 'gris' ? '#8794a3' : TEXTO_HEX.texto, align: 'center', wordWrap: { width: ancho - 8 },
        })
        .setOrigin(0.5);
      const boton = { rect, texto, d, glow: null };
      if (d.tipo === 'rojo') {
        rect.enableFilters();
        boton.glow = rect.filters.internal.addGlow(COLORES.fallo, 4, 0).setPaddingOverride(null);
      }
      rect.on('pointerover', () => this._mostrarTip(d.tip));
      rect.on('pointerout', () => this.tip.setVisible(false));
      rect.on('pointerup', () => this._pulsar(d));
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
    this.capaConsola.setVisible(enFalla);
    if (enFalla) {
      this.capaBotones.removeAll(true);
      this.botones = [];
      this.cabeceraBrazo.setVisible(false);
      if (!this._consolaLista) this._construirConsola();
      this._claveConsola = '';
      this._refrescarConsola();
      return;
    }
    this._consolaLista = false;
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
    const y0 = this._yBotones;
    const texto = (x, y, t, estilo = {}) => {
      const o = this.add.text(x, y, t, { fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, ...estilo });
      this.capaConsola.add(o);
      return o;
    };
    texto(12, y0, 'Consola de reparación: la CNC está en Falla', { fontStyle: 'bold', color: TEXTO_HEX.espera });
    const campo = this.add.rectangle(12, y0 + 14, 316, 28, COLORES.panel).setOrigin(0).setStrokeStyle(2, COLORES.maquina);
    this.capaConsola.add(campo);
    const mono = { fontFamily: 'Courier New, monospace', fontSize: '18px', fontStyle: 'bold' };
    this.txtPalabra = texto(20, y0 + 17, '', mono);
    this.txtMala = texto(20, y0 + 17, '', { ...mono, color: TEXTO_HEX.fallo });
    this.txtVacio = texto(20, y0 + 21, 'w = escribe H, C, T, R y Enter', { color: '#8794a3' });
    this.txtEstado = texto(12, y0 + 46, '', { fontStyle: 'bold' });
    this.txtAviso = texto(12, y0 + 59, '', { wordWrap: { width: 316 } });
    this._claveConsola = '';

    const boton = (x, y, ancho, etiqueta, color, accion, tip, colorTexto = TEXTO_HEX.texto) => {
      const rect = this.add.rectangle(x, y, ancho, BOTON.alto, color).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.9);
      rect.setInteractive({ useHandCursor: true });
      const t = this.add.text(x + ancho / 2, y + BOTON.alto / 2, etiqueta, {
        fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: colorTexto, align: 'center',
      }).setOrigin(0.5);
      rect.on('pointerup', () => { if (this._pestana === 'automata') { accion(); this._consolaSucia = true; } });
      rect.on('pointerover', () => this._mostrarTip(tip));
      rect.on('pointerout', () => this.tip.setVisible(false));
      this.capaConsola.add([rect, t]);
    };
    const fila1 = y0 + 88;
    const w4 = (316 - 3 * BOTON.hueco) / 4;
    [['H', 'home'], ['C', 'chequeo'], ['T', 'cambio'], ['R', 'reset']].forEach(([s, nombre], i) => {
      boton(12 + i * (w4 + BOTON.hueco), fila1, w4, `${s}\n${nombre}`, COLORES.mantenimiento, () => this.consola.escribir(s), `${s}: ${COMANDOS[s]}`);
    });
    const fila2 = fila1 + BOTON.alto + 4;
    const w3 = (316 - 2 * BOTON.hueco) / 3;
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
    if (!this.abierto || !this._modoConsola || this._pestana !== 'automata') return;
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
    if (this.tipo !== 'CNC' || pestana === this._pestana) return;
    this._pestana = pestana;
    const automata = pestana === 'automata';
    for (const o of [this.gfxFijo, this.gfxNodo, this.gfxParpadeo, this.capaTextos, this.capaBotones]) o.setVisible(automata);
    this.capaComposicion.setVisible(!automata);
    this._sucia = true; // al volver, los botones, la consola y la lista se rehacen
    this._firmaBotones = '';
    this._claveConsola = '';
    this._claveComp = '';
    this._estilizarPestanas();
  }

  _estilizarPestanas() {
    for (const [clave, p] of Object.entries(this.pestanas)) {
      const activa = clave === this._pestana;
      p.rect.setFillStyle(activa ? COLORES.banda : COLORES.panel).setStrokeStyle(activa ? 2 : 1, activa ? COLORES.texto : COLORES.maquina);
    }
  }

  /** Restaura la pestaña Autómata y muestra las pestañas solo si la máquina es una CNC. */
  _reiniciarPestanas() {
    this._pestana = 'automata';
    for (const o of [this.gfxFijo, this.gfxNodo, this.gfxParpadeo, this.capaTextos, this.capaBotones]) o.setVisible(true);
    this.capaComposicion.setVisible(false);
    for (const p of Object.values(this.pestanas)) {
      p.rect.setVisible(this.tipo === 'CNC');
      p.t.setVisible(this.tipo === 'CNC');
    }
    this._claveComp = '';
    this._estilizarPestanas();
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
  _pulsar(d) {
    if (d.tipo === 'gris' || !d.maquina || this._pestana !== 'automata') return;
    const r = this.celda.solicitar(d.maquina, d.evento, d.opciones);
    this._sucia = true;
    if (!r.ok) this._mostrarTip(`Rechazado (${r.motivo}). ${d.tip}`);
  }

  // ---- Lista de eventos ----

  /** Últimos 10 eventos de la máquina: su palabra observada. */
  _actualizarLista() {
    // La consola de reparación ocupa el lugar de la lista mientras la CNC está en Falla.
    for (const t of [this.cabeceraLista, this.listaIzq, this.listaDer]) t.setVisible(!this._modoConsola);
    if (this._modoConsola) return;
    const eventos = this.celda.bitacora.filter((e) => e.tipo === 'automata' && e.maquina === this.maquinaId).slice(-10);
    const codigo = new Map(this.modelo.eventos.map((e) => [e.id, e.codigo]));
    const palabra = eventos.map((e) => codigo.get(e.evento)).join(' ');
    const y = this._yLista ?? 300;
    this.cabeceraLista.setPosition(12, y).setText(`Palabra observada (últimos 10): ${palabra || '—'}`);
    const lineas = eventos.map((e) => `${e.t.toFixed(1).padStart(5)} s  ${codigo.get(e.evento)}  ${e.de} → ${e.a}`).reverse();
    this.listaIzq.setPosition(12, y + 14).setText(lineas.slice(0, 5).join('\n'));
    this.listaDer.setPosition(12 + 160, y + 14).setText(lineas.slice(5).join('\n'));
  }
}
