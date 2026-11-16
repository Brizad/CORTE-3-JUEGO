// HUD de partida (escena superpuesta, no la afecta el zoom de la planta). Zonas de docs/GDD.md, sección 14, y docs/arte.md, sección 8:
//   Arriba izquierda  x 8–200,  y 8–48     Reloj del turno (s restantes), número de turno y velocidad actual
//   Arriba centro     x 330–630, y 8–48    Puntaje y piezas / meta
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

const ZONAS = {
  reloj: { x: 8, y: 8, ancho: 182, alto: 40 },
  puntaje: { x: 330, y: 8, ancho: 300, alto: 40 },
  radar: { x: 770, y: 8, ancho: 182, alto: 40 },
  fichas: { x: 8, y: 450, ancho: 412, alto: 82 },
};
const BOTON_TACTIL = 44; // mínimo táctil
const NIVELES = { verde: COLORES.operacion, amarillo: COLORES.espera, rojo: COLORES.fallo };
const ESTILO = (extra = {}) => ({ fontFamily: 'Arial', fontSize: '11px', color: TEXTO_HEX.texto, ...extra });

export class HUDGeneral extends Phaser.Scene {
  constructor() {
    super('HUDGeneral');
  }

  create() {
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
    this._zona({ x: 540, y: 450, ancho: 412, alto: 82 });
    this._puntaje();
    this._tarjetasPedidos();
    this._radar();
    this._panelFichas();
    this._botonesTactiles();
    this._columnaDespacho();
    this._tooltip();
    this._avisoLogro();
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
    for (const z of Object.values(ZONAS)) {
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
  }

  // ---- Arriba centro: puntaje y piezas / meta ----

  _puntaje() {
    const z = ZONAS.puntaje;
    this.add.text(z.x + 75, z.y + 3, 'Puntaje', ESTILO({ fontSize: '9px', color: '#8794a3' })).setOrigin(0.5, 0);
    this.add.text(z.x + 225, z.y + 3, 'Piezas / meta', ESTILO({ fontSize: '9px', color: '#8794a3' })).setOrigin(0.5, 0);
    this.txtPuntaje = this.add.text(z.x + 75, z.y + 14, '', ESTILO({ fontSize: '20px', fontStyle: 'bold' })).setOrigin(0.5, 0);
    this.txtPiezas = this.add.text(z.x + 225, z.y + 14, '', ESTILO({ fontSize: '20px', fontStyle: 'bold' })).setOrigin(0.5, 0);
  }

  // ---- Arriba al centro, debajo del puntaje: pedidos como tarjetas con barra de tiempo (docs/GDD.md, sección 18.7) ----

  _tarjetasPedidos() {
    this.tarjetas = [0, 1, 2].map((i) => {
      const x = 330 + i * 102;
      return {
        x, g: this.add.graphics(),
        titulo: this.add.text(x + 6, 55, '', ESTILO({ fontSize: '10px', fontStyle: 'bold' })),
        tiempo: this.add.text(x + 96, 55, '', ESTILO({ fontSize: '10px' })).setOrigin(1, 0),
        clave: '',
      };
    });
    this.masPedidos = this.add.text(636, 62, '', ESTILO({ fontSize: '11px', fontStyle: 'bold', color: TEXTO_HEX.espera }));
    this._zona({ x: 330, y: 52, ancho: 300, alto: 34 });
  }

  _dibujarTarjetas() {
    const c = this.celda;
    const ahora = c.reloj.ahora;
    const vence = c.turno.pedidosVencen !== false;
    const limite = c.tiempos.pedidoVence;
    const lista = c.pedidos.slice(0, 3);
    this.tarjetas.forEach((t, i) => {
      const p = lista[i];
      const resto = p ? Math.max(0, limite - (ahora - p.t)) : 0;
      const frac = vence ? resto / limite : 1;
      const color = !vence ? COLORES.mantenimiento : p?.vencido ? COLORES.fallo : frac > 1 / 3 ? COLORES.operacion : frac > 1 / 6 ? COLORES.espera : COLORES.fallo;
      const clave = p ? `${p.id}|${Math.round(frac * 40)}|${p.vencido}` : '-';
      if (clave === t.clave) return;
      t.clave = clave;
      const g = t.g;
      g.clear();
      if (!p) {
        t.titulo.setText('');
        t.tiempo.setText('');
        return;
      }
      g.fillStyle(COLORES.panel, 0.9);
      g.fillRoundedRect(t.x, 52, 98, 34, 4);
      g.lineStyle(1.5, color, 1);
      g.strokeRoundedRect(t.x, 52, 98, 34, 4);
      // Barra del tiempo que le queda al pedido.
      g.fillStyle(COLORES.banda, 0.8);
      g.fillRect(t.x + 6, 74, 86, 7);
      g.fillStyle(color, 1);
      g.fillRect(t.x + 6, 74, 86 * Math.max(0.02, frac), 7);
      t.titulo.setText(`Pedido #${p.id}`);
      t.tiempo.setText(!vence ? 'sin límite' : p.vencido ? 'vencido' : `${Math.ceil(resto)} s`).setColor(p.vencido ? TEXTO_HEX.fallo : TEXTO_HEX.texto);
    });
    this.masPedidos.setText(c.pedidos.length > 3 ? `+${c.pedidos.length - 3}` : '');
  }

  // ---- Arriba derecha: radar ----

  _radar() {
    const z = ZONAS.radar;
    this.radarG = this.add.graphics();
    this.radarTitulo = this.add.text(z.x + 38, z.y + 3, 'Radar', ESTILO({ fontSize: '10px', fontStyle: 'bold' }));
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
    const rect = this.add.rectangle(x, y, ancho, alto, COLORES.banda).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.5);
    rect.setInteractive({ useHandCursor: true });
    const texto = this.add
      .text(x + ancho / 2, y + alto / 2, etiqueta, ESTILO({ fontSize: opciones.fuente ?? '12px', fontStyle: 'bold', align: 'center' }))
      .setOrigin(0.5);
    // Con el mouse la explicación dura mientras el puntero está encima; con un toque desaparece sola a los 2,5 s.
    rect.on('pointerover', (p) => { this._sobre = { texto: typeof tip === 'function' ? tip() : tip, hasta: p?.wasTouch ? this.time.now + 2500 : undefined }; });
    rect.on('pointerout', () => { this._sobre = null; });
    rect.on('pointerup', accion);
    this._zona({ x, y, ancho, alto });
    return { rect, texto };
  }

  _botonesTactiles() {
    const emitir = (accion, datos) => () => this.planta.entrada.emisor.emit(accion, datos);
    this.botonesVelocidad = {};
    VELOCIDADES.forEach((v, i) => {
      this.botonesVelocidad[v] = this._boton(192 + i * BOTON_TACTIL, 4, BOTON_TACTIL, BOTON_TACTIL, `x${v}`, emitir(ACCIONES.VELOCIDAD, { valor: v }), `Velocidad x${v}`);
    });
    this.botonPausa = this._boton(634, 4, BOTON_TACTIL, BOTON_TACTIL, '', emitir(ACCIONES.PAUSA), () => (this.celda.reloj.enPausa ? 'Reanudar' : 'Pausa'));
    this.iconoPausa = this.add.graphics();
    this.botonInspector = this._boton(678, 4, BOTON_TACTIL, BOTON_TACTIL, 'Insp.', emitir(ACCIONES.INSPECTOR), 'Inspector (pausa la simulación)', { fuente: '10px' });
    this.botonRed = this._boton(722, 4, BOTON_TACTIL, BOTON_TACTIL, 'Red', emitir(ACCIONES.RED_PETRI), 'Vista de la red de Petri (R)', { fuente: '11px' });
    this.botonPantalla = this._boton(908, 52, BOTON_TACTIL, BOTON_TACTIL, '⛶', emitir(ACCIONES.PANTALLA_COMPLETA), 'Pantalla completa (G)', { fuente: '22px' });
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
    const cx = 634 + BOTON_TACTIL / 2;
    const cy = 4 + BOTON_TACTIL / 2;
    if (r.enPausa) g.fillTriangle(cx - 6, cy - 9, cx - 6, cy + 9, cx + 9, cy);
    else {
      g.fillRect(cx - 8, cy - 9, 5, 18);
      g.fillRect(cx + 3, cy - 9, 5, 18);
    }
    this.botonPausa.rect.setFillStyle(r.enPausa ? COLORES.espera : COLORES.banda);
    const insp = this.scene.get('Inspector')?.abierto;
    this.botonInspector.rect.setFillStyle(insp ? COLORES.mantenimiento : COLORES.banda);
    this.botonRed.rect.setFillStyle(this.planta.vistaRed?.activa ? COLORES.mantenimiento : COLORES.banda);
  }

  // ---- Abajo, entre las fichas y las alertas: despacho de AGV y Controlador ----

  _columnaDespacho() {
    this.despacho = {};
    const crear = (clave, x, y, ancho, alto, etiqueta, accion) => {
      const b = this._boton(x, y, ancho, alto, etiqueta, accion, () => this._explicar(clave), { fuente: '9px' });
      this.despacho[clave] = { ...b, clave: '' };
    };
    crear('AGV1', 424, 450, 54, 44, 'Despachar\nAGV1', () => this._despachar('AGV1'));
    crear('AGV2', 482, 450, 54, 44, 'Despachar\nAGV2', () => this._despachar('AGV2'));
    crear('CONTROLADOR', 424, 498, 112, 40, 'Controlador\nde celda (−150)', () => this._comprarControlador());
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
    const r = this.celda.solicitar(agv, 'reservar');
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
      b.rect.setStrokeStyle(2, COLORES.texto, posible || activo ? 0.9 : 0.3);
      b.texto.setColor(posible || activo ? TEXTO_HEX.texto : '#8794a3');
      if (clave === 'CONTROLADOR') b.texto.setText(activo ? 'Controlador\nactivo' : 'Controlador\nde celda (−150)');
    }
  }

  // ---- Explicación al pasar el mouse (no hay textos fijos) ----

  _tooltip() {
    this.tip = this.add
      .text(8, 440, '', {
        fontFamily: 'Arial', fontSize: '11px', color: TEXTO_HEX.texto, backgroundColor: '#161b22', padding: { x: 8, y: 5 }, wordWrap: { width: 520 },
      })
      .setOrigin(0, 1)
      .setDepth(50)
      .setVisible(false);
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
    this.txtTiempo.setText(tutorial ? `t = ${Math.floor(r.ahora)} s` : `${restante} s`).setColor(!tutorial && restante <= 20 ? TEXTO_HEX.espera : TEXTO_HEX.texto);
    this.txtVelocidad.setText(`Velocidad x${r.velocidad}${r.enPausa ? ' · pausa' : ''}`);
    this.txtPuntaje.setText(String(c.puntaje)).setColor(c.puntaje < 0 ? TEXTO_HEX.fallo : TEXTO_HEX.texto);
    this.txtPiezas.setText(tutorial ? String(c.estadisticas.piezas) : `${c.estadisticas.piezas} / ${c.turno.meta}`);

    this.alertas.actualizar();
    this._dibujarTarjetas();
    this._dibujarFichas();
    this._dibujarTactiles();
    this._dibujarDespacho();
    this._dibujarRadar();

    // Explicación solo mientras el puntero está sobre algo (o unos segundos tras un rechazo).
    const sobre = this._sobre && (!this._sobre.hasta || this._sobre.hasta > this.time.now) ? this._sobre.texto : '';
    this.tip.setText(sobre).setVisible(sobre !== '');
    if (!this._mostrando && this._logros.length > 0) this._siguienteLogro();
  }

  /** Radar: círculo de 32 px (verde fijo, amarillo a 2 Hz, rojo fijo) y el mini-grafo de los últimos marcados. */
  _dibujarRadar() {
    const z = ZONAS.radar;
    const c = this.celda;
    const nivel = c.radar.nivel;
    const parpadeo = nivel === 'amarillo' ? Math.floor(this.time.now / 250) % 2 === 0 : true; // 2 Hz
    const cx = z.x + 22;
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
    g.fillCircle(cx, cy, 16 * escala);
    g.lineStyle(2, COLORES.texto, 0.9);
    g.strokeCircle(cx, cy, 16 * escala);
    this.radarTitulo.setText(`Radar: ${nivel}`);

    const ultimos = c.historialMarcados.slice(-5);
    const clave = ultimos.map((h) => `${h.M.join('')}${h.nivel}`).join('|');
    if (clave === this._claveRadar) return;
    this._claveRadar = clave;
    this.radarNombres.forEach((t) => t.destroy());
    this.radarNombres = [];
    const m = this.radarMini;
    m.clear();
    const x0 = z.x + 44;
    const paso = 27;
    ultimos.forEach((h, i) => {
      const x = x0 + i * paso;
      const y = z.y + 28;
      if (i > 0) {
        m.lineStyle(1.5, COLORES.maquina, 1);
        m.lineBetween(x - paso + 11, y, x - 3, y);
        m.fillStyle(COLORES.maquina, 1);
        m.fillTriangle(x - 3, y, x - 8, y - 3, x - 8, y + 3);
      }
      m.fillStyle(NIVELES[h.nivel], 1);
      m.fillRoundedRect(x - 11, y - 7, 22, 14, 3);
      if (i === ultimos.length - 1) {
        m.lineStyle(2, COLORES.texto, 1);
        m.strokeRoundedRect(x - 11, y - 7, 22, 14, 3);
      }
      this.radarNombres.push(this.add.text(x, y, nombreMarcado(h.M) ?? '·', { fontFamily: 'Arial', fontSize: '8px', fontStyle: 'bold', color: '#161b22' }).setOrigin(0.5));
    });
  }
}
