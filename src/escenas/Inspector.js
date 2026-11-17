// Inspector: escena superpuesta que se abre con la tecla I y PAUSA la simulación mientras está abierta.
// Ocupa TODA la pantalla (docs/GDD.md, sección 18.21): al abrirse oculta la barra de control, las fichas, la caja del tutorial y
// sus flechas (vuelven al cerrar). Pestaña "Matrices" en 2 zonas sin solapes: arriba Pre, Post y A = Post − Pre (con las
// transiciones habilitadas resaltadas); abajo a la izquierda la ecuación de estado M_k = M_{k−1} + Aᵀ·u_k con números y abajo
// a la derecha "Probar disparo" con su resultado. Pestañas "Árbol" (árbol de cobertura) y "Logros" (cada logro abre su ficha).
// Solo muestra y calcula: no cambia el estado del juego.

import { COLORES, TEXTO_HEX, ANCHO, ALTO } from '../config.js';
import { arbolCobertura, nombreMarcado } from '../sed/cobertura.js';
import { camaraLogica } from './camara.js';
import { resaltable, fijarBorde } from './resaltar.js';
import { fichaLogro } from './ventanas.js';
import { datosJugador } from '../guardado.js';
import { ZONAS_INSPECTOR, TABLAS_INSPECTOR } from '../disposicion.js';

const PANEL = { x: 0, y: 0, ancho: ANCHO, alto: ALTO };
const CW = TABLAS_INSPECTOR.celda; // ancho de celda de las tablas
const CH = TABLAS_INSPECTOR.alto; // alto de celda
const ETIQUETA = TABLAS_INSPECTOR.etiqueta; // ancho de la columna con los nombres de transición
const GAP = TABLAS_INSPECTOR.hueco; // hueco entre tablas
const Y_CABECERA = ZONAS_INSPECTOR.tablas.y + TABLAS_INSPECTOR.cabecera; // las filas empiezan aquí (encima, los nombres de lugar)
const TEXTO = (extra = {}) => ({ fontFamily: 'Arial', fontSize: '12px', color: TEXTO_HEX.texto, ...extra });

export class Inspector extends Phaser.Scene {
  constructor() {
    super('Inspector');
  }

  create() {
    camaraLogica(this);
    this.abierto = false;
    this.pestana = 'matrices';
    this.arbolDesde = 'm0'; // 'm0' o 'actual'
    this.seleccion = 't1a';
    this.probar = false;
    this.celda = null;
    this._baja = null;
    this._sucia = false;
    this.contenedor = this.add.container(PANEL.x, PANEL.y).setVisible(false);

    // Fondo opaco a pantalla completa: atrapa todos los clics (nada de abajo se ve ni se pulsa).
    const fondo = this.add.rectangle(0, 0, PANEL.ancho, PANEL.alto, COLORES.panel, 1).setOrigin(0).setInteractive();
    const marco = this.add.graphics();
    marco.fillStyle(0x0d1117, 1);
    marco.fillRect(0, 0, PANEL.ancho, ZONAS_INSPECTOR.cabecera.alto);
    marco.lineStyle(2, COLORES.banda, 1);
    marco.strokeRect(1, 1, PANEL.ancho - 2, PANEL.alto - 2);
    marco.lineBetween(0, ZONAS_INSPECTOR.cabecera.alto, PANEL.ancho, ZONAS_INSPECTOR.cabecera.alto);
    this.titulo = this.add.text(12, 7, 'Inspector · simulación en pausa', TEXTO({ fontSize: '14px', fontStyle: 'bold' }));
    // Línea pequeña del tutorial (solo si hay tutorial): arriba, sin tapar nada.
    this.lineaTutorial = this.add.text(ZONAS_INSPECTOR.tutorial.x, ZONAS_INSPECTOR.tutorial.y, '', TEXTO({ fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera }));
    const cerrar = this.add
      .text(PANEL.ancho - 6, 0, 'X  Cerrar (I)', TEXTO({ fontSize: '13px', fontStyle: 'bold', padding: { x: 10, y: 7 } }))
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    cerrar.on('pointerup', () => this.cerrar());
    cerrar.on('pointerover', () => cerrar.setColor(TEXTO_HEX.espera));
    cerrar.on('pointerout', () => cerrar.setColor(TEXTO_HEX.texto));
    this.pestanas = {};
    [['matrices', 'Matrices', 262, 96], ['arbol', 'Árbol', 362, 80], ['logros', 'Logros', 446, 80]].forEach(([clave, etiqueta, x, ancho]) => {
      const rect = resaltable(this.add.rectangle(x, 3, ancho, 24, COLORES.panel).setOrigin(0).setInteractive({ useHandCursor: true }), [1, COLORES.maquina, 1]);
      const t = this.add.text(x + ancho / 2, 15, etiqueta, TEXTO({ fontStyle: 'bold', fontSize: '13px' })).setOrigin(0.5);
      rect.on('pointerup', () => this._cambiarPestana(clave));
      this.pestanas[clave] = { rect, t };
    });
    this.dinamico = this.add.container(0, 0);
    this.contenedor.add([fondo, marco, this.titulo, this.lineaTutorial, cerrar, ...Object.values(this.pestanas).flatMap((p) => [p.rect, p.t]), this.dinamico]);
    this._estilizarPestanas();
    this.events.on('shutdown', () => this._soltar());
  }

  // ---- Abrir y cerrar (pausa la simulación) ----

  alternar() {
    if (this.abierto) this.cerrar();
    else this.abrir();
  }

  abrir() {
    const planta = this.scene.get('Planta');
    this.celda = planta.celda;
    this.reloj = this.celda.reloj;
    this._pausaPrevia = this.reloj.enPausa;
    this.reloj.pausar();
    this._soltar();
    this._baja = this.celda.alCambiar(() => {
      this._sucia = true;
    });
    this.contenedor.setVisible(true);
    this.abierto = true;
    // Encima de todo: oculta la barra de control, las fichas, el tutorial y sus flechas (vuelven al cerrar).
    this.scene.bringToTop();
    this._ocultarDebajo(true);
    this._lineaTutorial();
    this._reconstruir();
  }

  /** Oculta (o devuelve) lo que el Inspector taparía: HUD general (barra, fichas, tarjetas, tooltip) y el tutorial. */
  _ocultarDebajo(ocultar) {
    this.scene.get('HUDGeneral')?.modoInspector?.(ocultar);
    this.scene.get('Tutorial')?.modoInspector?.(ocultar);
  }

  /** Si hay tutorial, su paso va como una línea pequeña arriba (no tapa nada). */
  _lineaTutorial() {
    const tut = this.scene.get('Tutorial');
    const activo = tut?.scene.isActive() && tut.activo && tut.guia;
    this.lineaTutorial.setText(activo ? `Tutorial · ${tut.guia.paso.mensaje.replace(/\s+/g, ' ')}` : '').setVisible(!!activo);
  }

  /** Cierra la ficha de logro abierta (Esc). Devuelve true si había una. */
  cerrarFicha() {
    if (!this._ficha) return false;
    this._ficha.cerrar();
    return true;
  }

  cerrar() {
    if (!this.abierto) return;
    this._soltar();
    this.cerrarFicha();
    this.contenedor.setVisible(false);
    this.abierto = false;
    this._ocultarDebajo(false);
    this.scene.moveBelow('HUDGeneral'); // vuelve a su lugar (debajo del HUD general, como al empezar)
    // Reanuda solo si no estaba en pausa antes y la partida no terminó por deadlock.
    if (!this._pausaPrevia && !this.celda.deadlock && !this.celda.terminado) this.reloj.reanudar();
  }

  _soltar() {
    this._baja?.();
    this._baja = null;
  }

  /** Verdadero si el punto (x, y) cae sobre el panel abierto. */
  contiene(x, y) {
    return this.abierto && x >= PANEL.x && x <= PANEL.x + PANEL.ancho && y >= PANEL.y && y <= PANEL.y + PANEL.alto;
  }

  update() {
    if (this.abierto && this._sucia) {
      this._sucia = false;
      this._reconstruir();
    }
  }

  _cambiarPestana(p) {
    this.pestana = p;
    this._estilizarPestanas();
    this._reconstruir();
  }

  _estilizarPestanas() {
    for (const [clave, p] of Object.entries(this.pestanas)) {
      const activa = clave === this.pestana;
      p.rect.setFillStyle(activa ? COLORES.banda : COLORES.panel);
      fijarBorde(p.rect, activa ? 2 : 1, activa ? COLORES.texto : COLORES.maquina, 1);
    }
  }

  // ---- Construcción ----

  _texto(x, y, contenido, estilo = {}) {
    const t = this.add.text(x, y, contenido, TEXTO(estilo));
    this.dinamico.add(t);
    return t;
  }

  _reconstruir() {
    this.dinamico.removeAll(true);
    if (this.pestana === 'matrices') this._matrices();
    else if (this.pestana === 'arbol') this._arbol();
    else this._logros();
  }

  /** Pestaña Matrices: arriba Pre, Post y A; abajo a la izquierda la ecuación de estado y a la derecha "Probar disparo". */
  _matrices() {
    const c = this.celda;
    const red = c.red;
    const nP = red.lugares.length;
    const nT = red.transiciones.length;
    const habilitadas = new Set(red.habilitadas());
    const g = this.add.graphics();
    this.dinamico.add(g);
    const Z = ZONAS_INSPECTOR;

    const xTabla = (n) => Z.tablas.x + ETIQUETA + n * (nP * CW + GAP); // 0 = Pre, 1 = Post, 2 = A
    const yFila = (i) => Y_CABECERA + i * CH;
    const colX = (n, j) => xTabla(n) + j * CW;
    const finTablas = xTabla(2) + nP * CW;
    const idx = this.seleccion ? red.indiceT(this.seleccion) : -1;

    // Marcado actual y último disparo (M_{k−1} = M_k − Aᵀ·u_k).
    const k = red.historial.length;
    const M = red.marcado();
    const ultima = k > 0 ? red.historial[k - 1] : null;
    const filaU = ultima ? red.A[red.indiceT(ultima)] : null;
    const Mprev = filaU ? M.map((v, j) => v - filaU[j]) : null;

    // ---- Zona de arriba: Pre, Post y A ----
    // Fila resaltada: transiciones habilitadas (verde) y la elegida para probar (borde amarillo).
    red.transiciones.forEach((t, i) => {
      const y = yFila(i);
      if (habilitadas.has(t.id)) {
        g.fillStyle(COLORES.operacion, 0.25);
        g.fillRect(Z.tablas.x, y, finTablas - Z.tablas.x, CH);
      }
      if (i === idx) {
        g.lineStyle(2, COLORES.espera, 1);
        g.strokeRect(Z.tablas.x, y, finTablas - Z.tablas.x, CH);
      }
    });
    ['Pre', 'Post', 'A = Post − Pre'].forEach((nombre, n) => this._texto(xTabla(n), Z.tablas.y, nombre, { fontSize: '13px', fontStyle: 'bold', color: TEXTO_HEX.espera }));
    this._texto(Z.tablas.x, Z.tablas.y, 'Transición (clic = elegir)', { fontStyle: 'bold' });
    this._texto(Z.tablas.x, Z.tablas.y + 18, 'Verde: habilitada ahora', { fontSize: '10px', color: TEXTO_HEX.operacion });
    for (let n = 0; n < 3; n++) {
      red.lugares.forEach((l, j) => {
        // Rotado: se lee de abajo hacia arriba y termina justo encima de la columna.
        const t = this._texto(colX(n, j) + CW / 2, Y_CABECERA - 3, l.nombre, { fontSize: '10px' });
        t.setOrigin(0, 0.5).setAngle(-90);
      });
    }
    red.transiciones.forEach((t, i) => {
      const y = yFila(i);
      const color = habilitadas.has(t.id) ? TEXTO_HEX.operacion : TEXTO_HEX.texto;
      this._texto(Z.tablas.x + 2, y + 2, `${t.id}  ${t.nombre}`, { fontSize: '11px', fontStyle: habilitadas.has(t.id) ? 'bold' : 'normal', color });
      const zona = this.add.rectangle(Z.tablas.x, y, finTablas - Z.tablas.x, CH, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      zona.on('pointerup', () => {
        this.seleccion = t.id;
        this._reconstruir();
      });
      this.dinamico.add(zona);
      for (let j = 0; j < nP; j++) {
        const pre = red.pre[i][j];
        const post = red.post[i][j];
        const a = red.A[i][j];
        const celda = (n, v, color) => this._texto(colX(n, j) + CW / 2, y + 2, String(v), { color: v === 0 ? '#566170' : color, fontStyle: v === 0 ? 'normal' : 'bold' }).setOrigin(0.5, 0);
        celda(0, pre, TEXTO_HEX.texto);
        celda(1, post, TEXTO_HEX.texto);
        celda(2, a > 0 ? `+${a}` : a, a > 0 ? TEXTO_HEX.operacion : TEXTO_HEX.fallo);
      }
    });
    g.lineStyle(1, COLORES.banda, 0.6);
    for (let n = 0; n < 3; n++) {
      g.strokeRect(xTabla(n), Y_CABECERA, nP * CW, nT * CH);
      for (let j = 1; j < nP; j++) g.lineBetween(colX(n, j), Y_CABECERA, colX(n, j), Y_CABECERA + nT * CH);
    }
    for (let i = 1; i < nT; i++) g.lineBetween(Z.tablas.x, yFila(i), finTablas, yFila(i));
    // Separadores de las 2 zonas.
    g.lineStyle(1, COLORES.banda, 1);
    g.lineBetween(Z.tablas.x, Z.ecuacion.y - 4, ANCHO - 12, Z.ecuacion.y - 4);
    g.lineBetween(Z.probar.x - 6, Z.ecuacion.y - 4, Z.probar.x - 6, ALTO - 8);

    // ---- Abajo a la izquierda: ecuación de estado con números ----
    const E = Z.ecuacion;
    this._texto(E.x, E.y, 'Ecuación de estado', { fontSize: '13px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    const u = red.transiciones.map((t) => (t.id === ultima ? 1 : 0));
    this._texto(
      E.x,
      E.y + 20,
      ultima
        ? `k = ${k}   u_k = [${u.join(', ')}]ᵀ  (dispara ${ultima})\nM_k = M_{k−1} + Aᵀ·u_k`
        : 'k = 0: todavía no hubo disparos.\nM_0 es el marcado inicial.',
      { lineSpacing: 3, wordWrap: { width: E.ancho } },
    );
    this._vector(g, E.x, E.y + 70, [
      ['M_{k−1}', Mprev, false],
      ['+ Aᵀ·u_k', filaU, true],
      ['= M_k', M, false],
    ], red, new Set());
    this._texto(E.x, E.y + 70 + 16 + 3 * CH + 10, 'Verde suma fichas, rojo las quita. M_k es el marcado de ahora.', { fontSize: '10px', color: '#8794a3' });

    // ---- Abajo a la derecha: Probar disparo ----
    const P = Z.probar;
    this._boton(P.x, P.y - 2, 176, 28, this.probar ? 'Probar disparo: activado' : 'Probar disparo', this.probar ? COLORES.mantenimiento : COLORES.banda, () => {
      this.probar = !this.probar;
      this._reconstruir();
    });
    this._texto(P.x + 186, P.y + 5, this.seleccion ? `Transición elegida: ${this.seleccion}` : 'Elige una transición', { fontStyle: 'bold', color: TEXTO_HEX.espera });
    if (this.probar && idx >= 0) this._prueba(g, P, idx, M, red, colX, yFila);
    else this._texto(P.x, P.y + 40, 'Pulsa una fila de las tablas para elegir una transición y\n«Probar disparo» para ver el marcado que resultaría sin aplicarlo.', { color: '#8794a3', lineSpacing: 4, wordWrap: { width: P.ancho } });
  }

  /** Tabla pequeña de vectores (una fila por vector, una columna por lugar). `malos` = columnas en rojo. */
  _vector(g, x, y, filas, red, malos) {
    const nP = red.lugares.length;
    const x0 = x + 70;
    red.lugares.forEach((l, j) => this._texto(x0 + j * CW + CW / 2, y, l.id, { fontSize: '10px', color: '#8794a3' }).setOrigin(0.5, 0));
    filas.forEach(([nombre, v, esSuma], n) => {
      const yy = y + 16 + n * CH;
      this._texto(x, yy + 2, nombre, { fontStyle: 'bold' });
      red.lugares.forEach((_l, j) => {
        if (malos.has(j)) {
          g.fillStyle(COLORES.fallo, 0.35);
          g.fillRect(x0 + j * CW, yy, CW, CH);
        }
        const val = v ? v[j] : '·';
        const color = !v ? '#566170' : esSuma ? (v[j] > 0 ? TEXTO_HEX.operacion : v[j] < 0 ? TEXTO_HEX.fallo : '#566170') : v[j] < 0 ? TEXTO_HEX.fallo : TEXTO_HEX.texto;
        this._texto(x0 + j * CW + CW / 2, yy + 2, esSuma && v && v[j] > 0 ? `+${v[j]}` : String(val), { color, fontStyle: n === 2 || malos.has(j) ? 'bold' : 'normal' }).setOrigin(0.5, 0);
      });
    });
    g.lineStyle(1, COLORES.banda, 0.6);
    g.strokeRect(x0, y + 16, nP * CW, filas.length * CH);
    g.lineBetween(x0, y + 16 + (filas.length - 1) * CH, x0 + nP * CW, y + 16 + (filas.length - 1) * CH);
  }

  /** Marcado que resultaría de disparar la transición elegida; señala los lugares que no alcanzan. */
  _prueba(g, P, idx, M, red, colX, yFila) {
    const t = red.transiciones[idx];
    const fila = red.A[idx];
    const resultado = M.map((v, j) => v + fila[j]);
    const habilitada = red.habilitada(idx);
    const falta = red.faltantes(M, t.id); // nombres de lugar (con " (llena)")
    const malos = new Set(falta.map((n) => red.indiceP(n.replace(' (llena)', ''))));
    const y = P.y + 36;
    this._texto(P.x, y, `${t.id} ${t.nombre}: ${habilitada ? 'habilitada (M ≥ Pre y cabe en k)' : 'NO habilitada'}`, {
      fontStyle: 'bold',
      color: habilitada ? TEXTO_HEX.operacion : TEXTO_HEX.fallo,
    });
    this._vector(g, P.x, y + 20, [['M', M, false], ['+ Aᵀ·u', fila, true], ["= M'", resultado, false]], red, malos);
    // El lugar que no alcanza también se marca en la tabla Pre de arriba.
    for (const j of malos) {
      g.lineStyle(2, COLORES.fallo, 1);
      g.strokeRect(colX(0, j), yFila(idx), CW, CH);
    }
    const detalle = falta.map((n) => {
      const lleno = n.endsWith(' (llena)');
      const j = red.indiceP(n.replace(' (llena)', ''));
      return lleno
        ? `${red.lugares[j].nombre} está llena (k = ${red.lugares[j].k})`
        : `${red.lugares[j].nombre} tiene ${M[j]} y Pre pide ${red.pre[idx][j]}`;
    });
    this._texto(
      P.x,
      y + 20 + 16 + 3 * CH + 8,
      habilitada ? 'Es el marcado que resultaría. No se aplicó nada.' : `No alcanza: ${detalle.join('; ')}.\nEl marcado de arriba es solo el cálculo, no es alcanzable.`,
      { color: habilitada ? TEXTO_HEX.texto : TEXTO_HEX.fallo, wordWrap: { width: P.ancho }, lineSpacing: 3 },
    );
  }

  _boton(x, y, ancho, alto, etiqueta, color, accion) {
    const rect = resaltable(this.add.rectangle(x, y, ancho, alto, color).setOrigin(0).setInteractive({ useHandCursor: true }));
    const t = this.add.text(x + ancho / 2, y + alto / 2, etiqueta, TEXTO({ fontStyle: 'bold', fontSize: '11px' })).setOrigin(0.5);
    rect.on('pointerup', accion);
    this.dinamico.add([rect, t]);
  }

  // ---- Logros (GDD, sección 12) ----

  _logros() {
    const planta = this.scene.get('Planta');
    const progreso = planta.logros.progreso();
    const guardados = datosJugador(planta.jugador).logros;
    this._texto(12, 48, `Logros de ${planta.jugador}: progreso en esta partida`, { fontSize: '14px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    this._texto(PANEL.ancho - 12, 50, 'Toca un logro para ver qué significa y cómo se gana', { fontSize: '11px', color: '#8794a3' }).setOrigin(1, 0);
    progreso.forEach((l, i) => {
      const y = 76 + i * 74;
      const ganado = l.ganado || l.id in guardados;
      const rect = resaltable(this.add.rectangle(12, y, PANEL.ancho - 24, 66, ganado ? 0x3a2f10 : 0x0d1117).setOrigin(0).setInteractive({ useHandCursor: true }), [1, ganado ? 0xd4af37 : COLORES.banda, 1]);
      rect.on('pointerup', () => {
        if (this._ficha) return;
        this._ficha = fichaLogro(this, l, { ganado, fecha: guardados[l.id], progreso: l.texto, alCerrar: () => { this._ficha = null; }, esc: false });
      });
      this.dinamico.add(rect);
      this._texto(26, y + 8, `${ganado ? '★' : '☆'}  ${l.nombre}`, { fontSize: '16px', fontStyle: 'bold', color: ganado ? '#d4af37' : TEXTO_HEX.texto });
      this._texto(52, y + 34, l.comoSeGana, { fontSize: '12px', color: '#8794a3' });
      this._texto(PANEL.ancho - 26, y + 10, ganado ? 'conseguido' : l.texto, { fontSize: '12px', fontStyle: 'bold', color: ganado ? TEXTO_HEX.operacion : TEXTO_HEX.texto }).setOrigin(1, 0);
    });
  }

  // ---- Árbol de cobertura ----

  _arbol() {
    const c = this.celda;
    const red = c.red;
    const desdeActual = this.arbolDesde === 'actual';
    const raiz = desdeActual ? red.marcado() : red.m0;
    const arbol = arbolCobertura(red, raiz, 2000, desdeActual ? 4 : Infinity);

    this._boton(12, 46, 150, 26, 'Desde M0', this.arbolDesde === 'm0' ? COLORES.mantenimiento : COLORES.banda, () => { this.arbolDesde = 'm0'; this._reconstruir(); });
    this._boton(168, 46, 230, 26, 'Desde el marcado actual (prof. 4)', desdeActual ? COLORES.mantenimiento : COLORES.banda, () => { this.arbolDesde = 'actual'; this._reconstruir(); });
    const muertos = arbol.nodos.filter((n) => n.tipo === 'muerto').length;
    this._texto(
      410,
      52,
      `Nodos: ${arbol.nodos.length}   ·   marcados distintos: ${arbol.marcadosDistintos}   ·   muertos: ${muertos}   ·   ${arbol.acotada ? 'acotada' : 'no acotada (ω)'}${arbol.truncado ? '   (truncado)' : ''}`,
      { fontSize: '12px', fontStyle: 'bold', color: muertos > 0 ? TEXTO_HEX.fallo : TEXTO_HEX.operacion },
    );

    // Distribución por niveles.
    const niveles = [];
    for (const n of arbol.nodos) (niveles[n.nivel] ??= []).push(n);
    const ancho = PANEL.ancho - 24;
    const yNivel = (l) => 104 + l * Math.min(70, 384 / Math.max(1, niveles.length - 1));
    const pos = new Map();
    niveles.forEach((lista, l) => lista.forEach((n, i) => pos.set(n.id, { x: 12 + ((i + 0.5) * ancho) / lista.length, y: yNivel(l) })));
    const g = this.add.graphics();
    this.dinamico.add(g);
    const actual = red.marcado().join(',');
    for (const a of arbol.aristas) {
      const p = pos.get(a.de);
      const q = pos.get(a.a);
      g.lineStyle(1.5, COLORES.maquina, 1);
      g.lineBetween(p.x, p.y + 10, q.x, q.y - 10);
      this._texto((p.x + q.x) / 2 + 3, (p.y + q.y) / 2 - 5, a.transicion, { fontSize: '9px', color: '#8794a3' });
    }
    for (const n of arbol.nodos) {
      const p = pos.get(n.id);
      const muerto = n.tipo === 'muerto';
      const duplicado = n.tipo === 'duplicado';
      g.fillStyle(muerto ? COLORES.fallo : COLORES.panel, muerto ? 0.9 : 1);
      g.fillRoundedRect(p.x - 42, p.y - 10, 84, 20, 4);
      g.lineStyle(n.marcado.join(',') === actual ? 3 : 1.5, n.marcado.join(',') === actual ? COLORES.espera : duplicado ? COLORES.banda : COLORES.maquina, 1);
      g.strokeRoundedRect(p.x - 42, p.y - 10, 84, 20, 4);
      const nombre = nombreMarcado(n.marcado);
      this._texto(p.x, p.y, `${nombre ? `${nombre} ` : ''}${n.marcado.join('')}`, {
        fontSize: '9px', fontStyle: 'bold', color: duplicado ? '#8794a3' : TEXTO_HEX.texto,
      }).setOrigin(0.5);
    }
    this._texto(
      12,
      PANEL.alto - 22,
      'Rojo: marcado muerto (ninguna transición habilitada). Gris: marcado repetido (no se expande). Borde amarillo: el marcado actual.',
      { color: '#8794a3' },
    );
  }
}

