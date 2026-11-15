// HUD de máquina: escena superpuesta que se lanza en paralelo a Planta (no pausa la simulación).
// Dibuja el grafo del autómata de la máquina elegida con las coordenadas del .jff, ilumina el estado actual,
// ofrece un botón por cada evento de Γ(q) y lista los últimos 10 eventos de la máquina.
// No cambia ningún estado por su cuenta: cada botón le pide el evento a la Celda (δ y red de Petri).

import { COLORES, TEXTO_HEX } from '../config.js';
import { aspectoDe } from '../arte/estados.js';
import { MODELOS } from '../modelos.js';

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

    this.gfxFijo = this.add.graphics(); // aristas y nodos sin iluminar
    this.gfxNodo = this.add.graphics(); // nodo del estado actual (con glow)
    this.gfxNodo.enableFilters();
    this.glow = this.gfxNodo.filters.internal.addGlow(COLORES.texto, 4, 0);
    this.gfxParpadeo = this.add.graphics(); // última transición
    this.capaTextos = this.add.container(0, 0);
    this.capaBotones = this.add.container(0, 0);
    this.listaIzq = this.add.text(12, 0, '', { fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, lineSpacing: 2 });
    this.listaDer = this.add.text(12 + 160, 0, '', { fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, lineSpacing: 2 });
    this.cabeceraLista = this.add.text(12, 0, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    this.tip = this.add
      .text(8, PANEL.alto - 8, '', {
        fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, wordWrap: { width: PANEL.ancho - 28 },
        backgroundColor: HEX(COLORES.panel), padding: { x: 6, y: 4 },
      })
      .setOrigin(0, 1)
      .setVisible(false);

    this.contenedor.add([
      marco, this.titulo, this.cerrarBoton, this.gfxFijo, this.gfxNodo, this.gfxParpadeo, this.capaTextos,
      this.capaBotones, this.cabeceraLista, this.listaIzq, this.listaDer, this.tip,
    ]);
    this.botones = [];
    this._firmaBotones = '';
    this.events.on('shutdown', () => this._soltarCelda());
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
    this.titulo.setText(`${nombre ?? id}   (${this.modelo.nombre})`);

    // El panel se coloca junto a la máquina: a la izquierda si la máquina está en la mitad derecha.
    const entidad = planta.entidades.find((e) => e.id === id);
    const x = entidad ? entidad.silueta[0].x : 0;
    this.panelX = x > 480 ? PANEL.xIzquierda : PANEL.xDerecha;
    this.contenedor.setPosition(this.panelX, PANEL.y).setVisible(true);
    this.abierto = true;

    planta.piloto.bloqueadas.add(id); // el modo demostración no toca esta máquina
    this._bajaCelda = this.celda.alCambiar(() => {
      this._sucia = true;
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
    const sy = (GRAFO.alto - 2 * GRAFO.margen) / Math.max(1, y1 - y0);
    const salida = {};
    for (const [nombre, [x, y]] of Object.entries(pos)) {
      salida[nombre] = { x: GRAFO.x + GRAFO.margen + (x - x0) * sx, y: GRAFO.y + GRAFO.margen + (y - y0) * sy };
    }
    return salida;
  }

  _dibujarGrafo() {
    const g = this.gfxFijo;
    g.clear();
    this.capaTextos.removeAll(true);
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

  /** Un botón por cada evento de Γ(q). */
  _describirBotones() {
    const c = this.celda;
    const id = this.maquinaId;
    const lista = [];
    const razonSupervisor = (cnc) =>
      `Supervisor: ${c.supervisor.razon}. Estado (${c.estado(cnc)}, ${c.estado('BRAZO')}).`;
    // Convierte el resultado de evaluar() en el tipo de botón y su explicación.
    const segun = (motivo, cnc) => {
      if (motivo === null) return { tipo: 'verde', tip: 'Ejecutar el evento (δ)' };
      if (motivo === 'supervisor') return { tipo: 'rojo', tip: razonSupervisor(cnc) };
      if (motivo === 'recurso') return { tipo: 'gris', tip: 'Recurso ocupado: la red de Petri no habilita la transición.' };
      if (motivo === 'indefinido') return { tipo: 'gris', tip: 'Ahora no se puede: el brazo no atiende a esta CNC.' };
      return { tipo: 'gris', tip: 'Lo dispara el sistema.' };
    };

    for (const ev of this.automata.eventosActivos()) {
      const info = this.automata.eventos.get(ev);
      const etiqueta = `${info.codigo} · ${ev}`;
      if (!info.controlable) {
        lista.push({ etiqueta, tipo: 'gris', tip: 'No controlable: lo dispara el sistema (solo informativo).' });
      } else if (this.tipo === 'CNC') {
        if (ev === 'reset') {
          lista.push({ etiqueta, tipo: 'gris', tip: 'Reparar exige la palabra de la consola (H, C, T, R): aún no está disponible.' });
        } else {
          lista.push({ etiqueta, maquina: id, evento: ev, ...segun(c.evaluar(id, ev), id) });
        }
      } else if (this.tipo === 'BRAZO') {
        if (ev === 'mover') {
          if (this.automata.estado === 'Reposo') {
            for (const objetivo of ['CNC1', 'CNC2']) {
              lista.push({ etiqueta: `m → ${objetivo}`, maquina: 'BRAZO', evento: ev, opciones: { objetivo }, ...segun(c.evaluar('BRAZO', ev, { objetivo }), objetivo) });
            }
          } else {
            lista.push({ etiqueta, tipo: 'gris', tip: 'El brazo vuelve solo (tr_volver) después de e o d.' });
          }
        } else if (ev === 'cargar' || ev === 'descargar') {
          const cnc = c.atendida;
          lista.push(cnc
            ? { etiqueta, maquina: cnc, evento: ev, ...segun(c.evaluar(cnc, ev), cnc) }
            : { etiqueta, tipo: 'gris', tip: 'El brazo no atiende a ninguna CNC.' });
        } else {
          lista.push({ etiqueta, maquina: 'BRAZO', evento: ev, ...segun(c.evaluar('BRAZO', ev), c.atendida) });
        }
      } else if (ev === 'reservar') {
        lista.push({ etiqueta: `v · Despachar ${id}`, maquina: id, evento: ev, ...segun(c.evaluar(id, ev), id) });
      } else {
        lista.push({ etiqueta, tipo: 'gris', tip: 'Transición automática de la red: se dispara sola cuando hay mesa y brazo.' });
      }
    }
    // Mandar el brazo a esta CNC (GDD 14.1): evento m y transición tr_ir.
    if (this.tipo === 'CNC' && this.celda.estado('BRAZO') === 'Reposo') {
      const op = { objetivo: id };
      lista.push({ etiqueta: 'm · Mandar brazo', maquina: 'BRAZO', evento: 'mover', opciones: op, ...segun(c.evaluar('BRAZO', 'mover', op), id) });
    }
    return lista;
  }

  _actualizarBotones() {
    const descripcion = this._describirBotones();
    const firma = JSON.stringify(descripcion.map((d) => [d.etiqueta, d.tipo, d.tip]));
    if (firma === this._firmaBotones) return;
    this._firmaBotones = firma;
    this._filas = Math.max(1, Math.ceil(descripcion.length / 3));
    this.tip.setVisible(false); // los botones se rehicieron: el aviso anterior ya no corresponde
    this.capaBotones.removeAll(true);
    this.botones = [];
    const colores = { verde: COLORES.operacion, gris: COLORES.banda, rojo: COLORES.fallo };
    descripcion.forEach((d, i) => {
      const x = GRAFO.x + (i % 3) * (BOTON.ancho + BOTON.hueco);
      const y = BOTON.y + Math.floor(i / 3) * (BOTON.alto + 4);
      const rect = this.add.rectangle(x, y, BOTON.ancho, BOTON.alto, colores[d.tipo]).setOrigin(0).setStrokeStyle(2, COLORES.texto, d.tipo === 'gris' ? 0.25 : 0.9);
      rect.setInteractive({ useHandCursor: d.tipo !== 'gris' });
      const texto = this.add
        .text(x + BOTON.ancho / 2, y + BOTON.alto / 2, d.etiqueta, {
          fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: d.tipo === 'gris' ? '#8794a3' : TEXTO_HEX.texto, align: 'center', wordWrap: { width: BOTON.ancho - 8 },
        })
        .setOrigin(0.5);
      const boton = { rect, texto, d, glow: null };
      if (d.tipo === 'rojo') {
        rect.enableFilters();
        boton.glow = rect.filters.internal.addGlow(COLORES.fallo, 4, 0);
      }
      rect.on('pointerover', () => this._mostrarTip(d.tip));
      rect.on('pointerout', () => this.tip.setVisible(false));
      rect.on('pointerup', () => this._pulsar(d));
      this.capaBotones.add([rect, texto]);
      this.botones.push(boton);
    });
  }

  _mostrarTip(texto) {
    this.tip.setText(texto).setVisible(true);
  }

  /** Clic en un botón: pide el evento a la Celda (δ y transición). Gris no hace nada. */
  _pulsar(d) {
    if (d.tipo === 'gris' || !d.maquina) return;
    const r = this.celda.solicitar(d.maquina, d.evento, d.opciones);
    this._sucia = true;
    if (!r.ok) this._mostrarTip(`Rechazado (${r.motivo}). ${d.tip}`);
  }

  // ---- Lista de eventos ----

  /** Últimos 10 eventos de la máquina: su palabra observada. */
  _actualizarLista() {
    const eventos = this.celda.bitacora.filter((e) => e.tipo === 'automata' && e.maquina === this.maquinaId).slice(-10);
    const codigo = new Map(this.modelo.eventos.map((e) => [e.id, e.codigo]));
    const palabra = eventos.map((e) => codigo.get(e.evento)).join(' ');
    const y = BOTON.y + (this._filas ?? 1) * (BOTON.alto + 4) + 8;
    this.cabeceraLista.setPosition(12, y).setText(`Palabra observada (últimos 10): ${palabra || '—'}`);
    const lineas = eventos.map((e) => `${e.t.toFixed(1).padStart(5)} s  ${codigo.get(e.evento)}  ${e.de} → ${e.a}`).reverse();
    this.listaIzq.setPosition(12, y + 14).setText(lineas.slice(0, 5).join('\n'));
    this.listaDer.setPosition(12 + 160, y + 14).setText(lineas.slice(5).join('\n'));
  }
}
