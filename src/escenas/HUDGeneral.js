// HUD de partida (escena superpuesta, no la afecta el zoom de la planta). Zonas de docs/GDD.md, sección 14, y docs/arte.md, sección 8:
//   Arriba izquierda  x 8–200,  y 8–48     Reloj del turno (s restantes), número de turno y velocidad actual
//   Arriba centro     x 394–630, y 8–48    Puntaje y barra de objetivo: "Piezas 2/5", progreso y tiempo restante
//   Arriba derecha    x 760–952, y 8–48    Radar del Árbol de Cobertura (calculado por la Celda con explorar(red, M, 1))
//   Abajo izquierda   x 8–420,  y 450–532  Fichas por lugar (p1..p9, y p10 con el Controlador)
//   Abajo derecha     x 540–952, y 450–532 Alertas (las dibuja Alertas.js en la planta)
// Además, los botones táctiles (velocidad, pausa e inspector) en los huecos de arriba y la columna de despacho
// (Despachar AGV1 y AGV2, Controlador de celda) en el hueco de abajo, entre las fichas y las alertas.
// No hay textos de ayuda fijos: las explicaciones salen solo al pasar el mouse o tocar un botón.

import { COLORES, TEXTO_HEX, PUNTOS, VELOCIDADES } from '../config.js';
import { nombreMarcado } from '../sed/cobertura.js';
import { dibujarFicha } from '../arte/tokens.js';
import { ACCIONES } from '../entrada/gestorEntrada.js';
import { Alertas } from '../entidades/Alertas.js';
import { camaraLogica } from './camara.js';
import { avisoTurno, TIP_RADAR, etiquetasPedidos, cuentaPedido } from '../textos.js';
import { resaltable, fijarBorde } from './resaltar.js';
import { ZONAS, BOTONES, BOTON_TACTIL } from '../disposicion.js';

const NIVELES = { verde: COLORES.operacion, amarillo: COLORES.espera, rojo: COLORES.fallo };
const ESTILO = (extra = {}) => ({ fontFamily: 'Arial', fontSize: '11px', color: TEXTO_HEX.texto, ...extra });

export class HUDGeneral extends Phaser.Scene {
  constructor() {
    super('HUDGeneral');
  }

  create() {
    camaraLogica(this);
    this.planta = this.scene.get('Planta');
    this.celda = this.planta.celda;
    this.partida = this.planta.partida;
    this.rects = []; // zonas que bloquean el clic hacia la planta
    this._sobre = null;
    this._claves = {};

    this._fondo();
    this._relojTurno();
    // Las alertas viven en esta escena (la de más arriba): ningún panel las tapa (docs/GDD.md, sección 18.3).
    this.alertas = new Alertas(this, this.celda);
    this._zona(ZONAS.alertas);
    this._puntaje();
    this._tarjetasPedidos();
    this._radar();
    this._panelFichas();
    this._botonesTactiles();
    this._columnaDespacho();
    this._tooltip();
    this._avisoLogro();
    this._avisoTurno();
    this._logros = [];
    this._bajaLogro = (logro) => this._logros.push(logro);
    this.planta.events.on('logro', this._bajaLogro);
    this.events.on('shutdown', () => {
      this.planta.events.off('logro', this._bajaLogro);
      this.alertas.destruir();
    });
  }

  /** Verdadero si el punto cae sobre el HUD (el clic no llega a la planta). */
  contiene(x, y) {
    return this.rects.some((r) => x >= r.x && x <= r.x + r.ancho && y >= r.y && y <= r.y + r.alto);
  }

  _zona(r) {
    this.rects.push(r);
  }

  _fondo() {
    const g = this.add.graphics();
    for (const z of [ZONAS.reloj, ZONAS.puntaje, ZONAS.radar, ZONAS.fichas]) {
      g.fillStyle(COLORES.panel, 0.85);
      g.fillRect(z.x, z.y, z.ancho, z.alto);
      g.lineStyle(1, COLORES.banda, 1);
      g.strokeRect(z.x, z.y, z.ancho, z.alto);
      this._zona(z);
    }
  }

  // ---- Arriba izquierda: reloj, turno y velocidad ----

  _relojTurno() {
    const z = ZONAS.reloj;
    this.txtTurno = this.add.text(z.x + 8, z.y + 3, '', ESTILO({ fontStyle: 'bold' }));
    this.txtTiempo = this.add.text(z.x + 8, z.y + 15, '', ESTILO({ fontSize: '12px', fontStyle: 'bold' }));
    this.txtVelocidad = this.add.text(z.x + 8, z.y + 28, '', ESTILO({ fontSize: '9px', color: '#8794a3' }));
    // F1: fps y tiempo de simulación, debajo del panel del turno y solo mientras está activo.
    this.txtFps = this.add
      .text(8, 104, '', ESTILO({ fontSize: '11px', color: TEXTO_HEX.espera, backgroundColor: 'rgba(22,27,34,0.8)', padding: { x: 5, y: 3 } }))
      .setDepth(50)
      .setVisible(false);
  }

  // ---- Arriba centro: puntaje y piezas / meta ----

  _puntaje() {
    const z = ZONAS.puntaje;
    this.add.text(z.x + 35, z.y + 3, 'Puntaje', ESTILO({ fontSize: '9px', color: '#8794a3' })).setOrigin(0.5, 0);
    this.txtPuntaje = this.add.text(z.x + 35, z.y + 15, '', ESTILO({ fontSize: '18px', fontStyle: 'bold' })).setOrigin(0.5, 0);
    // Barra de objetivo: "Piezas 2/5", el tiempo que queda y el progreso hacia la meta.
    this.txtPiezas = this.add.text(z.x + 78, z.y + 4, '', ESTILO({ fontSize: '13px', fontStyle: 'bold' }));
    this.txtResta = this.add.text(z.x + z.ancho - 8, z.y + 6, '', ESTILO({ fontSize: '11px' })).setOrigin(1, 0);
    this.barraObjetivo = this.add.graphics();
    this._claveObjetivo = '';
  }

  _dibujarObjetivo() {
    const c = this.celda;
    const z = ZONAS.puntaje;
    const tutorial = this.partida.tutorial;
    const piezas = c.estadisticas.piezas;
    const meta = tutorial ? Math.max(1, piezas) : c.turno.meta;
    const clave = `${piezas}|${meta}`;
    if (clave === this._claveObjetivo) return;
    this._claveObjetivo = clave;
    const g = this.barraObjetivo;
    const [x, y, ancho, alto] = [z.x + 78, z.y + 24, z.ancho - 86, 10];
    g.clear();
    g.lineStyle(1, COLORES.banda, 1);
    g.lineBetween(z.x + 70, z.y + 4, z.x + 70, z.y + z.alto - 4);
    g.fillStyle(COLORES.banda, 0.8);
    g.fillRect(x, y, ancho, alto);
    g.fillStyle(piezas >= meta ? COLORES.celda : COLORES.operacion, 1);
    g.fillRect(x, y, ancho * Math.min(1, piezas / meta), alto);
    g.lineStyle(1, COLORES.panel, 1);
    for (let i = 1; i < meta; i++) g.lineBetween(x + (ancho * i) / meta, y, x + (ancho * i) / meta, y + alto); // una división por pieza
    g.lineStyle(1, COLORES.texto, 0.6);
    g.strokeRect(x, y, ancho, alto);
  }

  // ---- Arriba al centro, debajo del puntaje: pedidos como tarjetas con barra de tiempo (docs/GDD.md, sección 18.7) ----

  _tarjetasPedidos() {
    this.tarjetas = [0, 1, 2].map((i) => {
      const x = ZONAS.tarjetas.x + i * 122;
      return {
        x, g: this.add.graphics(),
        titulo: this.add.text(x + 59, 56, '', ESTILO({ fontSize: '10px', fontStyle: 'bold' })).setOrigin(0.5, 0),
        clave: '',
      };
    });
    this.masPedidos = this.add.text(ZONAS.tarjetas.x + ZONAS.tarjetas.ancho + 4, 62, '', ESTILO({ fontSize: '11px', fontStyle: 'bold', color: TEXTO_HEX.espera }));
    // Contenedor: se desplaza hacia el lado libre cuando el HUD de una máquina está abierto (no tapa su título ni sus pestañas).
    this.contTarjetas = this.add.container(0, 0, [...this.tarjetas.flatMap((t) => [t.g, t.titulo]), this.masPedidos]);
    this._zona(ZONAS.tarjetas);
  }

  _dibujarTarjetas() {
    const c = this.celda;
    const ahora = c.reloj.ahora;
    const vence = c.turno.pedidosVencen !== false;
    const limite = c.tiempos.pedidoVence;
    const lista = c.pedidos.slice(0, 3);
    // "AGV 1 espera · 12 s": qué carrito despachar y cuánto le queda al pedido (verde > amarillo > rojo).
    const rotulos = etiquetasPedidos(lista, { AGV1: c.estado('AGV1'), AGV2: c.estado('AGV2') });
    this.tarjetas.forEach((t, i) => {
      const p = lista[i];
      const cuenta = p ? cuentaPedido(p, ahora, limite, vence) : null;
      const clave = p ? `${p.id}|${rotulos[i].texto}|${cuenta.texto}|${Math.round(cuenta.fraccion * 40)}` : '-';
      if (clave === t.clave) return;
      t.clave = clave;
      const g = t.g;
      g.clear();
      if (!p) {
        t.titulo.setText('');
        return;
      }
      const color = COLORES[cuenta.nivel];
      g.fillStyle(COLORES.panel, 0.9);
      g.fillRoundedRect(t.x, 52, 118, 34, 4);
      g.lineStyle(1.5, color, 1);
      g.strokeRoundedRect(t.x, 52, 118, 34, 4);
      // Barra del tiempo que le queda al pedido.
      g.fillStyle(COLORES.banda, 0.8);
      g.fillRect(t.x + 6, 74, 106, 7);
      g.fillStyle(color, 1);
      g.fillRect(t.x + 6, 74, 106 * Math.max(0.02, cuenta.fraccion), 7);
      t.titulo.setText(`${rotulos[i].texto} · ${cuenta.texto}`).setColor(cuenta.nivel === 'fallo' ? TEXTO_HEX.fallo : cuenta.nivel === 'espera' ? TEXTO_HEX.espera : TEXTO_HEX.texto);
    });
    this.masPedidos.setText(c.pedidos.length > 3 ? `+${c.pedidos.length - 3}` : '');
  }

  // ---- Arriba derecha: radar ----

  _radar() {
    const z = ZONAS.radar;
    this.radarG = this.add.graphics();
    this.radarNombre = this.add.text(z.x + 42, z.y + 2, '', ESTILO({ fontSize: '20px', fontStyle: 'bold' }));
    this.radarTitulo = this.add.text(z.x + 42, z.y + 26, 'Radar', ESTILO({ fontSize: '9px', color: '#8794a3' }));
    this.add.text(z.x + 139, z.y + 28, 'últimos estados', ESTILO({ fontSize: '8px', color: '#8794a3' })).setOrigin(0.5, 0);
    // Al pasar el mouse (o tocar): qué significa el nombre del marcado y cada color.
    const zona = this.add.rectangle(z.x, z.y, z.ancho, z.alto, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    zona.on('pointerover', (p) => {
      const h = this.celda.historialMarcados;
      const nombre = (h.length ? nombreMarcado(h[h.length - 1].M) : null) ?? 'M0';
      this._sobre = { texto: TIP_RADAR.replace('M6', nombre), hasta: p?.wasTouch ? this.time.now + 4000 : undefined };
    });
    zona.on('pointerout', () => { this._sobre = null; });
    this.radarMini = this.add.graphics();
    this.radarNombres = [];
    this._claveRadar = '';
  }

  // ---- Abajo izquierda: fichas por lugar ----

  _panelFichas() {
    const z = ZONAS.fichas;
    this.fichasG = this.add.graphics();
    this.celdasFichas = [];
    this._lugaresMostrados = 0;
    this.fichasTextos = [];
    this._zonaFichas = z;
  }

  /** Reconstruye las celdas si cambió la cantidad de lugares (con el Controlador hay p10). */
  _armarFichas() {
    const z = this._zonaFichas;
    this.fichasTextos.forEach((t) => t.destroy());
    this.celdasFichas.forEach((c) => c.zona.destroy());
    this.fichasTextos = [];
    this.celdasFichas = [];
    const lugares = this.celda.red.lugares;
    const ancho = 41; // 10 lugares caben en 412 px
    lugares.forEach((l, j) => {
      const x = z.x + 2 + j * ancho;
      this.fichasTextos.push(this.add.text(x + ancho / 2, z.y + 4, l.id, ESTILO({ fontSize: '9px', color: '#8794a3' })).setOrigin(0.5, 0));
      const contador = this.add.text(x + ancho / 2, z.y + 58, '', ESTILO({ fontSize: '11px', fontStyle: 'bold' })).setOrigin(0.5, 0);
      const nombre = this.add.text(x + ancho / 2, z.y + 70, l.nombre.replace(/_/g, ' ').slice(0, 9), ESTILO({ fontSize: '7px', color: '#8794a3' })).setOrigin(0.5, 0);
      this.fichasTextos.push(contador, nombre);
      const zona = this.add.rectangle(x, z.y, ancho, z.alto, 0xffffff, 0).setOrigin(0).setInteractive();
      zona.on('pointerover', (p) => { this._sobre = { texto: `${l.id} ${l.nombre}: ${this.celda.red.M[j]} de ${l.k} ficha${l.k === 1 ? '' : 's'}`, hasta: p?.wasTouch ? this.time.now + 2500 : undefined }; });
      zona.on('pointerout', () => { this._sobre = null; });
      this.celdasFichas.push({ j, x: x + ancho / 2, contador, zona, nombre: l.nombre });
    });
    this._lugaresMostrados = lugares.length;
  }

  _dibujarFichas() {
    const red = this.celda.red;
    if (this._lugaresMostrados !== red.lugares.length) this._armarFichas();
    const g = this.fichasG;
    g.clear();
    const z = this._zonaFichas;
    for (const c of this.celdasFichas) {
      const m = red.M[c.j];
      // Cada ficha con su forma y color (docs/arte.md, sección 6): 14 px de alto en este panel.
      dibujarFicha(g, c.nombre, c.x, z.y + 38, m > 0 ? 1 : 0.22, 0.7);
      c.contador.setText(`${m}/${red.lugares[c.j].k}`).setColor(m > 0 ? TEXTO_HEX.texto : '#566170');
    }
  }

  // ---- Botones táctiles: velocidad, pausa e inspector ----

  _boton(x, y, ancho, alto, etiqueta, accion, tip, opciones = {}) {
    const rect = this.add.rectangle(x, y, ancho, alto, COLORES.banda).setOrigin(0);
    rect.setInteractive({ useHandCursor: true });
    resaltable(rect, [2, COLORES.texto, 0.5]); // borde amarillo con el puntero encima
    const texto = this.add
      .text(x + ancho / 2, y + alto / 2, etiqueta, ESTILO({ fontSize: opciones.fuente ?? '12px', fontStyle: 'bold', align: 'center' }))
      .setOrigin(0.5);
    // Con el mouse la explicación dura mientras el puntero está encima; con un toque desaparece sola a los 2,5 s.
    rect.on('pointerover', (p) => { this._sobre = { texto: typeof tip === 'function' ? tip() : tip, hasta: p?.wasTouch ? this.time.now + 2500 : undefined }; });
    rect.on('pointerout', () => { this._sobre = null; });
    rect.on('pointerup', () => { this.planta.sonidos.clic(); accion(); });
    this._zona({ x, y, ancho, alto });
    return { rect, texto };
  }

  _botonesTactiles() {
    const emitir = (accion, datos) => () => this.planta.entrada.emisor.emit(accion, datos);
    this.botonesVelocidad = {};
    VELOCIDADES.forEach((v, i) => {
      this.botonesVelocidad[v] = this._boton(BOTONES[`vel${v}`].x, BOTONES[`vel${v}`].y, BOTON_TACTIL, BOTON_TACTIL, `x${v}`, emitir(ACCIONES.VELOCIDAD, { valor: v }), `Velocidad de la simulación x${v} (la tecla V cambia de velocidad)`);
    });
    this.botonPausa = this._boton(BOTONES.pausa.x, BOTONES.pausa.y, BOTON_TACTIL, BOTON_TACTIL, '', emitir(ACCIONES.PAUSA), 'Pausa y menú (P): continuar, reiniciar el turno, ayuda, sonido y título');
    this.iconoPausa = this.add.graphics();
    this.botonInspector = this._boton(BOTONES.inspector.x, BOTONES.inspector.y, BOTON_TACTIL, BOTON_TACTIL, 'Insp.', emitir(ACCIONES.INSPECTOR), 'Inspector (I): ecuación de estado y árbol de cobertura; pausa la simulación', { fuente: '10px' });
    this.botonRed = this._boton(BOTONES.red.x, BOTONES.red.y, BOTON_TACTIL, BOTON_TACTIL, 'Red', emitir(ACCIONES.RED_PETRI), 'Red de Petri (R): muestra las fichas y las transiciones sobre la planta', { fuente: '11px' });
    this.botonAyuda = this._boton(BOTONES.ayuda.x, BOTONES.ayuda.y, BOTON_TACTIL, BOTON_TACTIL, '?', emitir(ACCIONES.AYUDA), 'Ayuda: cómo se juega, atajos, controles y colores (?)', { fuente: '22px' });
    this.botonSilencio = this._boton(BOTONES.silencio.x, BOTONES.silencio.y, BOTON_TACTIL, BOTON_TACTIL, '', emitir(ACCIONES.SILENCIO), () => (this.planta.sonidos.silenciado ? 'Activar el sonido (M)' : 'Silenciar el sonido (M)'));
    this.iconoSilencio = this.add.graphics();
    this.botonPantalla = this._boton(BOTONES.pantalla.x, BOTONES.pantalla.y, BOTON_TACTIL, BOTON_TACTIL, '⛶', emitir(ACCIONES.PANTALLA_COMPLETA), 'Pantalla completa (G)', { fuente: '22px' });
  }

  _dibujarTactiles() {
    const r = this.celda.reloj;
    for (const [v, b] of Object.entries(this.botonesVelocidad)) {
      const activo = r.velocidad === Number(v);
      b.rect.setFillStyle(activo ? COLORES.operacion : COLORES.banda);
    }
    // Ícono de pausa (dos barras) o de reanudar (triángulo).
    const g = this.iconoPausa;
    g.clear();
    g.fillStyle(COLORES.texto, 1);
    const cx = BOTONES.pausa.x + BOTON_TACTIL / 2;
    const cy = BOTONES.pausa.y + BOTON_TACTIL / 2;
    if (r.enPausa) g.fillTriangle(cx - 6, cy - 9, cx - 6, cy + 9, cx + 9, cy);
    else {
      g.fillRect(cx - 8, cy - 9, 5, 18);
      g.fillRect(cx + 3, cy - 9, 5, 18);
    }
    this.botonPausa.rect.setFillStyle(r.enPausa ? COLORES.espera : COLORES.banda);
    // Altavoz: con ondas si suena, tachado si está en silencio.
    const mudo = this.planta.sonidos.silenciado;
    if (mudo !== this._mudo) {
      this._mudo = mudo;
      const s = this.iconoSilencio;
      const sx = BOTONES.silencio.x + BOTON_TACTIL / 2;
      const sy = BOTONES.silencio.y + BOTON_TACTIL / 2;
      s.clear();
      s.fillStyle(COLORES.texto, 1);
      s.fillRect(sx - 11, sy - 4, 6, 8);
      s.fillTriangle(sx - 5, sy - 4, sx + 2, sy - 10, sx + 2, sy + 10);
      s.fillTriangle(sx - 5, sy - 4, sx - 5, sy + 4, sx + 2, sy + 10);
      if (mudo) {
        s.lineStyle(3, COLORES.fallo, 1);
        s.lineBetween(sx + 5, sy - 6, sx + 13, sy + 6);
        s.lineBetween(sx + 13, sy - 6, sx + 5, sy + 6);
      } else {
        s.lineStyle(2, COLORES.texto, 1);
        s.beginPath();
        s.arc(sx + 3, sy, 6, -0.9, 0.9);
        s.strokePath();
        s.beginPath();
        s.arc(sx + 3, sy, 11, -0.9, 0.9);
        s.strokePath();
      }
      this.botonSilencio.rect.setFillStyle(mudo ? COLORES.fallo : COLORES.banda);
    }
    const insp = this.scene.get('Inspector')?.abierto;
    this.botonInspector.rect.setFillStyle(insp ? COLORES.mantenimiento : COLORES.banda);
    this.botonRed.rect.setFillStyle(this.planta.vistaRed?.activa ? COLORES.mantenimiento : COLORES.banda);
  }

  // ---- Abajo, entre las fichas y las alertas: despacho de AGV y Controlador ----

  _columnaDespacho() {
    this.despacho = {};
    const crear = (clave, { x, y, ancho, alto }, etiqueta, accion) => {
      const b = this._boton(x, y, ancho, alto, etiqueta, accion, () => this._explicar(clave), { fuente: '9px' });
      this.despacho[clave] = { ...b, clave: '' };
    };
    crear('AGV1', BOTONES.despachoAGV1, 'Despachar\nAGV1', () => this._despachar('AGV1'));
    crear('AGV2', BOTONES.despachoAGV2, 'Despachar\nAGV2', () => this._despachar('AGV2'));
    crear('CONTROLADOR', BOTONES.controlador, 'Controlador\nde celda (−150)', () => this._comprarControlador());
  }

  _explicar(clave) {
    const c = this.celda;
    if (clave === 'CONTROLADOR') {
      if (c.controlador) return 'Controlador de celda activo: Celda_libre deja pasar a un solo AGV a la vez. Dura solo este turno.';
      if (c.deadlock) return 'No se puede comprar en el marcado muerto.';
      return `Controlador de celda: agrega el lugar monitor Celda_libre (p10). Cuesta ${PUNTOS.controlador} puntos y dura solo este turno.`;
    }
    const motivo = c.evaluar(clave, 'reservar');
    if (motivo === null) return `${clave} puede salir: consume ${clave}_listo y ${clave === 'AGV1' ? 'Mesa_libre' : 'Robot_libre'}.`;
    if (motivo === 'turno_terminado') return 'El turno terminó.';
    if (motivo === 'indefinido') return `${clave} no está Libre (ahora: ${c.estado(clave)}).`;
    if (motivo === 'celda') return 'Controlador de celda activo: falta Celda_libre (el otro AGV está en la celda).';
    return `${clave} no puede salir: falta ${c.faltaPara(clave, 'reservar').join(', ') || 'un recurso'}.`;
  }

  _despachar(agv) {
    const r = this.planta.acciones.despachar(agv); // evento v · reservar (δ del AGV y t1a o t2a de la red)
    if (!r.ok) this._sobre = { texto: this._explicar(agv), hasta: this.time.now + 3000 };
  }

  _comprarControlador() {
    const r = this.celda.comprarControlador();
    if (!r.ok) this._sobre = { texto: this._explicar('CONTROLADOR'), hasta: this.time.now + 3000 };
  }

  _dibujarDespacho() {
    const c = this.celda;
    for (const [clave, b] of Object.entries(this.despacho)) {
      const posible = clave === 'CONTROLADOR' ? !c.controlador && !c.deadlock && !c.terminado : c.evaluar(clave, 'reservar') === null;
      const activo = clave === 'CONTROLADOR' && c.controlador;
      const estado = `${posible}|${activo}`;
      if (estado === b.clave) continue;
      b.clave = estado;
      b.rect.setFillStyle(activo ? COLORES.mantenimiento : posible ? COLORES.operacion : COLORES.banda);
      fijarBorde(b.rect, 2, COLORES.texto, posible || activo ? 0.9 : 0.3);
      b.texto.setColor(posible || activo ? TEXTO_HEX.texto : '#8794a3');
      if (clave === 'CONTROLADOR') b.texto.setText(activo ? 'Controlador\nactivo' : 'Controlador\nde celda (−150)');
    }
  }

  // ---- Explicación al pasar el mouse (no hay textos fijos) ----

  /** Muestra una frase corta unos segundos (toque sobre una máquina). */
  explicar(texto) {
    if (texto) this._sobre = { texto, hasta: this.time.now + 2500 };
  }

  _tooltip() {
    this.tip = this.add
      .text(8, 440, '', {
        fontFamily: 'Arial', fontSize: '11px', color: TEXTO_HEX.texto, backgroundColor: '#161b22', padding: { x: 8, y: 5 }, wordWrap: { width: 520 },
      })
      .setOrigin(0, 1)
      .setDepth(50)
      .setVisible(false);
  }

  // ---- Aviso de 3 s al empezar el turno: meta y dificultad ----

  _avisoTurno() {
    const texto = avisoTurno(this.celda.turno, this.partida.turno, this.partida.tutorial);
    const t = this.add
      .text(480, 128, texto, { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: TEXTO_HEX.texto, backgroundColor: 'rgba(22,27,34,0.92)', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 700 } })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: t, alpha: 0, delay: 2600, duration: 400, onComplete: () => t.destroy() }); // 3 s en total
  }

  // ---- Aviso animado de logro (tween) ----

  _avisoLogro() {
    this.avisoL = this.add.container(480, -80).setDepth(60);
    const fondo = this.add.graphics();
    fondo.fillStyle(COLORES.panel, 0.96);
    fondo.fillRoundedRect(-210, 0, 420, 62, 8);
    fondo.lineStyle(3, COLORES.celda, 1);
    fondo.strokeRoundedRect(-210, 0, 420, 62, 8);
    // Estrella dorada.
    const estrella = [];
    for (let i = 0; i < 10; i++) {
      const ang = (-90 + i * 36) * (Math.PI / 180);
      const r = i % 2 === 0 ? 16 : 7;
      estrella.push({ x: -180 + Math.cos(ang) * r, y: 31 + Math.sin(ang) * r });
    }
    fondo.fillStyle(COLORES.celda, 1);
    fondo.fillPoints(estrella, true);
    this.avisoTitulo = this.add.text(-150, 6, 'Logro desbloqueado', ESTILO({ fontSize: '10px', fontStyle: 'bold', color: '#d4af37' }));
    this.avisoNombre = this.add.text(-150, 20, '', ESTILO({ fontSize: '16px', fontStyle: 'bold' }));
    this.avisoDesc = this.add.text(-150, 42, '', ESTILO({ fontSize: '10px', color: '#8794a3', wordWrap: { width: 350 } }));
    this.avisoL.add([fondo, this.avisoTitulo, this.avisoNombre, this.avisoDesc]);
    this._mostrando = false;
  }

  /** Muestra el siguiente logro de la cola: entra con un rebote, se queda 3 s y sale. */
  _siguienteLogro() {
    const logro = this._logros.shift();
    if (!logro) return;
    this._mostrando = true;
    this.avisoNombre.setText(logro.nombre);
    this.avisoDesc.setText(logro.descripcion);
    this.avisoL.setPosition(480, -80).setScale(0.7).setAlpha(1);
    this.tweens.add({
      targets: this.avisoL,
      y: 58,
      scale: 1,
      duration: 450,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.avisoL,
          y: -80,
          alpha: 0,
          delay: 3000,
          duration: 350,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this._mostrando = false;
          },
        });
      },
    });
  }

  // ---- Por cuadro ----

  update() {
    const c = this.celda;
    const r = c.reloj;
    const restante = Math.max(0, Math.ceil(c.turno.duracion - r.ahora));
    const tutorial = this.partida.tutorial;
    this.txtTurno.setText(tutorial ? 'Turno 0 · tutorial' : `Turno ${this.partida.turno + 1} de 3`);
    // El tutorial no tiene límite de tiempo: se muestra el tiempo transcurrido.
    // En los últimos 30 s el reloj se pone rojo y parpadea (2 veces por segundo).
    const apuro = !tutorial && restante <= 30 && !c.terminado;
    const visible = !apuro || r.enPausa || Math.floor(this.time.now / 250) % 2 === 0;
    const tiempo = tutorial ? `t = ${Math.floor(r.ahora)} s` : `${restante} s`;
    this.txtTiempo.setText(tiempo).setColor(apuro ? TEXTO_HEX.fallo : TEXTO_HEX.texto).setAlpha(visible ? 1 : 0.25);
    this.txtResta.setText(tutorial ? 'sin límite' : `quedan ${restante} s`).setColor(apuro ? TEXTO_HEX.fallo : TEXTO_HEX.texto).setAlpha(visible ? 1 : 0.25);
    this.txtVelocidad.setText(`Vel. x${r.velocidad}${r.enPausa ? ' · pausa' : ''}`);
    this.txtPuntaje.setText(String(c.puntaje)).setColor(c.puntaje < 0 ? TEXTO_HEX.fallo : TEXTO_HEX.texto);
    this.txtPiezas.setText(tutorial ? `Piezas ${c.estadisticas.piezas}` : `Piezas ${c.estadisticas.piezas}/${c.turno.meta}`);
    this._dibujarObjetivo();

    this.alertas.actualizar();
    this._dibujarTarjetas();
    // Con el HUD de máquina abierto a la derecha (x 492..952) las tarjetas van a la izquierda; si está a la izquierda, a la derecha.
    // En el tutorial el cuadro de la guía ocupa arriba a la izquierda (x 8..418, y 56..126): las tarjetas lo esquivan.
    const hud = this.scene.get('HUDMaquina');
    const derecha = hud?.abierto && hud.panelX > 480;
    const izquierda = hud?.abierto && !derecha;
    this.contTarjetas.x = derecha ? -200 : izquierda ? 200 : tutorial ? 130 : 0;
    this.contTarjetas.y = tutorial && derecha ? 82 : 0;
    this._dibujarFichas();
    this._dibujarTactiles();
    this._dibujarDespacho();
    this._dibujarRadar();

    // Explicación solo mientras el puntero está sobre algo (o unos segundos tras un rechazo).
    let sobre = this._sobre && (!this._sobre.hasta || this._sobre.hasta > this.time.now) ? this._sobre.texto : '';
    if (!sobre && this.sobreMaquina) sobre = this.sobreMaquina; // frase de la máquina bajo el puntero
    this.tip.setText(sobre).setVisible(sobre !== '');
    if (!this._mostrando && this._logros.length > 0) this._siguienteLogro();
  }

  /** Radar: círculo de 32 px (verde fijo, amarillo a 2 Hz, rojo fijo) y el mini-grafo de los últimos marcados. */
  _dibujarRadar() {
    const z = ZONAS.radar;
    const c = this.celda;
    const nivel = c.radar.nivel;
    const parpadeo = nivel === 'amarillo' ? Math.floor(this.time.now / 250) % 2 === 0 : true; // 2 Hz
    const cx = z.x + 20;
    const cy = z.y + z.alto / 2;
    const g = this.radarG;
    g.clear();
    // Al cambiar de color, el círculo "late" con un tween.
    if (nivel !== this._nivelRadar) {
      if (this._nivelRadar !== undefined) {
        this.radarEscala = { k: 1 };
        this.tweens.add({ targets: this.radarEscala, k: 1.4, duration: 170, yoyo: true, ease: 'Sine.easeOut' });
      }
      this._nivelRadar = nivel;
    }
    const escala = this.radarEscala?.k ?? 1;
    g.fillStyle(NIVELES[nivel], parpadeo ? 1 : 0.25);
    g.fillCircle(cx, cy, 14 * escala);
    g.lineStyle(2, COLORES.texto, 0.9);
    g.strokeCircle(cx, cy, 14 * escala);
    this.radarTitulo.setText(`Radar: ${nivel}`);
    const ahoraM = c.historialMarcados[c.historialMarcados.length - 1];
    this.radarNombre.setText(ahoraM ? (nombreMarcado(ahoraM.M) ?? '·') : '');

    const ultimos = c.historialMarcados.slice(-3);
    const clave = ultimos.map((h) => `${h.M.join('')}${h.nivel}`).join('|');
    if (clave === this._claveRadar) return;
    this._claveRadar = clave;
    this.radarNombres.forEach((t) => t.destroy());
    this.radarNombres = [];
    const m = this.radarMini;
    m.clear();
    const x0 = z.x + 110;
    const paso = 29;
    ultimos.forEach((h, i) => {
      const x = x0 + i * paso;
      const y = z.y + 16;
      if (i > 0) {
        m.lineStyle(1.5, COLORES.maquina, 1);
        m.lineBetween(x - paso + 13, y, x - 5, y);
        m.fillStyle(COLORES.maquina, 1);
        m.fillTriangle(x - 5, y, x - 10, y - 3, x - 10, y + 3);
      }
      m.fillStyle(NIVELES[h.nivel], 1);
      m.fillRoundedRect(x - 13, y - 9, 26, 18, 3);
      if (i === ultimos.length - 1) {
        m.lineStyle(2, COLORES.texto, 1);
        m.strokeRoundedRect(x - 13, y - 9, 26, 18, 3);
      }
      this.radarNombres.push(this.add.text(x, y, nombreMarcado(h.M) ?? '·', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#161b22' }).setOrigin(0.5));
    });
  }
}
