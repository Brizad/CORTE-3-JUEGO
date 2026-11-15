// Inspector: escena superpuesta que se abre con la tecla I y PAUSA la simulación mientras está abierta.
// Pestaña "Matrices": Pre, Post y A = Post − Pre con los nombres de lugares y transiciones, las transiciones habilitadas
// resaltadas, la ecuación de estado M_k = M_{k−1} + Aᵀ·u_k con números y el botón "Probar disparo".
// Pestaña "Árbol": árbol de cobertura desde M0 y desde el marcado actual (profundidad 4).
// Solo muestra y calcula: no cambia el estado del juego.

import { COLORES, TEXTO_HEX } from '../config.js';
import { arbolCobertura, nombreMarcado } from '../sed/cobertura.js';

const PANEL = { x: 8, y: 58, ancho: 944, alto: 390 };
const CW = 24; // ancho de celda de las tablas
const CH = 15; // alto de celda
const ETIQUETA = 150; // ancho de la columna con los nombres de transición
const GAP = 18; // hueco entre tablas
const Y_CABECERA = 120; // las filas de las tablas empiezan aquí
const TEXTO = (extra = {}) => ({ fontFamily: 'Arial', fontSize: '10px', color: TEXTO_HEX.texto, ...extra });

export class Inspector extends Phaser.Scene {
  constructor() {
    super('Inspector');
  }

  create() {
    this.abierto = false;
    this.pestana = 'matrices';
    this.arbolDesde = 'm0'; // 'm0' o 'actual'
    this.seleccion = 't1a';
    this.probar = false;
    this.celda = null;
    this._baja = null;
    this._sucia = false;
    this.contenedor = this.add.container(PANEL.x, PANEL.y).setVisible(false);

    const marco = this.add.graphics();
    marco.fillStyle(COLORES.panel, 0.96);
    marco.fillRect(0, 0, PANEL.ancho, PANEL.alto);
    marco.lineStyle(2, COLORES.banda, 1);
    marco.strokeRect(0, 0, PANEL.ancho, PANEL.alto);
    this.titulo = this.add.text(12, 6, 'Inspector · simulación en pausa', TEXTO({ fontSize: '14px', fontStyle: 'bold' }));
    const cerrar = this.add
      .text(PANEL.ancho - 10, 4, 'X', TEXTO({ fontSize: '16px', fontStyle: 'bold', padding: { x: 8, y: 4 } }))
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    cerrar.on('pointerup', () => this.cerrar());
    this.pestanas = {};
    [['matrices', 'Matrices', 250, 80], ['arbol', 'Árbol', 334, 60]].forEach(([clave, etiqueta, x, ancho]) => {
      const rect = this.add.rectangle(x, 5, ancho, 20, COLORES.panel).setOrigin(0).setInteractive({ useHandCursor: true });
      const t = this.add.text(x + ancho / 2, 15, etiqueta, TEXTO({ fontStyle: 'bold' })).setOrigin(0.5);
      rect.on('pointerup', () => this._cambiarPestana(clave));
      this.pestanas[clave] = { rect, t };
    });
    this.dinamico = this.add.container(0, 0);
    this.contenedor.add([marco, this.titulo, cerrar, ...Object.values(this.pestanas).flatMap((p) => [p.rect, p.t]), this.dinamico]);
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
    this._reconstruir();
  }

  cerrar() {
    if (!this.abierto) return;
    this._soltar();
    this.contenedor.setVisible(false);
    this.abierto = false;
    // Reanuda solo si no estaba en pausa antes y la partida no terminó por deadlock.
    if (!this._pausaPrevia && !this.celda.deadlock) this.reloj.reanudar();
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
      p.rect.setFillStyle(activa ? COLORES.banda : COLORES.panel).setStrokeStyle(activa ? 2 : 1, activa ? COLORES.texto : COLORES.maquina);
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
    else this._arbol();
  }

  /** Pestaña Matrices: Pre, Post, A, la ecuación de estado y la prueba de disparo. */
  _matrices() {
    const c = this.celda;
    const red = c.red;
    const nP = red.lugares.length;
    const nT = red.transiciones.length;
    const habilitadas = new Set(red.habilitadas());
    const g = this.add.graphics();
    this.dinamico.add(g);

    const xTabla = (n) => 12 + ETIQUETA + n * (nP * CW + GAP); // 0 = Pre, 1 = Post, 2 = A
    const yFila = (i) => Y_CABECERA + i * CH;
    const colX = (n, j) => xTabla(n) + j * CW;
    const idx = this.seleccion ? red.indiceT(this.seleccion) : -1;

    // Marcado actual y último disparo (M_{k−1} = M_k − Aᵀ·u_k).
    const k = red.historial.length;
    const M = red.marcado();
    const ultima = k > 0 ? red.historial[k - 1] : null;
    const filaU = ultima ? red.A[red.indiceT(ultima)] : null;
    const Mprev = filaU ? M.map((v, j) => v - filaU[j]) : null;

    // Fila resaltada: transiciones habilitadas (verde) y la elegida para probar (borde amarillo).
    red.transiciones.forEach((t, i) => {
      const y = yFila(i);
      if (habilitadas.has(t.id)) {
        g.fillStyle(COLORES.operacion, 0.25);
        g.fillRect(12, y, xTabla(2) + nP * CW - 12, CH);
      }
      if (i === idx) {
        g.lineStyle(2, COLORES.espera, 1);
        g.strokeRect(12, y, xTabla(2) + nP * CW - 12, CH);
      }
    });

    // Títulos de las tablas y nombres de lugar (rotados).
    ['Pre', 'Post', 'A = Post − Pre'].forEach((nombre, n) => this._texto(xTabla(n), 34, nombre, { fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.espera }));
    this._texto(12, 34, 'Transición', { fontStyle: 'bold' });
    for (let n = 0; n < 3; n++) {
      red.lugares.forEach((l, j) => {
        // Rotado: se lee de abajo hacia arriba y termina justo encima de la columna.
        const t = this._texto(colX(n, j) + CW / 2, Y_CABECERA - 3, l.nombre, { fontSize: '8px' });
        t.setOrigin(0, 0.5).setAngle(-90);
      });
    }
    // Filas: nombre de la transición y los números de cada tabla.
    red.transiciones.forEach((t, i) => {
      const y = yFila(i);
      const color = habilitadas.has(t.id) ? TEXTO_HEX.operacion : TEXTO_HEX.texto;
      this._texto(14, y + 3, `${t.id}  ${t.nombre}`, { fontStyle: habilitadas.has(t.id) ? 'bold' : 'normal', color });
      const zona = this.add.rectangle(12, y, xTabla(2) + nP * CW - 12, CH, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      zona.on('pointerup', () => {
        this.seleccion = t.id;
        this._reconstruir();
      });
      this.dinamico.add(zona);
      for (let j = 0; j < nP; j++) {
        const pre = red.pre[i][j];
        const post = red.post[i][j];
        const a = red.A[i][j];
        const celda = (n, v, color) => this._texto(colX(n, j) + CW / 2, y + 3, String(v), { color: v === 0 ? '#566170' : color }).setOrigin(0.5, 0);
        celda(0, pre, TEXTO_HEX.texto);
        celda(1, post, TEXTO_HEX.texto);
        celda(2, a > 0 ? `+${a}` : a, a > 0 ? TEXTO_HEX.operacion : TEXTO_HEX.fallo);
      }
    });
    // Rejillas.
    g.lineStyle(1, COLORES.banda, 0.6);
    for (let n = 0; n < 3; n++) {
      g.strokeRect(xTabla(n), Y_CABECERA, nP * CW, nT * CH);
      for (let j = 1; j < nP; j++) g.lineBetween(colX(n, j), Y_CABECERA, colX(n, j), Y_CABECERA + nT * CH);
    }
    for (let i = 1; i < nT; i++) g.lineBetween(12, yFila(i), xTabla(2) + nP * CW, yFila(i));

    // ---- Ecuación de estado con números ----
    const y0 = Y_CABECERA + nT * CH + 12;
    this._texto(12, y0, 'Ecuación de estado', { fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.espera });
    const u = red.transiciones.map((t) => (t.id === ultima ? 1 : 0));
    this._texto(
      12,
      y0 + 16,
      ultima
        ? `k = ${k}   u_k = [${u.join(', ')}]ᵀ  (dispara ${ultima})\nM_k = M_{k−1} + Aᵀ·u_k`
        : 'k = 0: todavía no hubo disparos.\nM_0 es el marcado inicial.',
      { lineSpacing: 3 },
    );
    const filas = [
      ['M_{k−1}', Mprev, false],
      ['+ Aᵀ·u_k', filaU, true],
      ['= M_k', M, false],
    ];
    const xN = (j) => 12 + ETIQUETA + j * CW + CW / 2;
    const yE = y0 + 50;
    red.lugares.forEach((l, j) => this._texto(xN(j), yE - 12, l.id, { fontSize: '9px', color: '#8794a3' }).setOrigin(0.5, 0));
    filas.forEach(([nombre, v, esSuma], n) => {
      const y = yE + n * CH;
      this._texto(14, y + 3, nombre, { fontStyle: 'bold' });
      red.lugares.forEach((l, j) => {
        const val = v ? v[j] : '·';
        const t = this._texto(xN(j), y + 3, esSuma && v && v[j] > 0 ? `+${v[j]}` : String(val), {
          color: !v ? '#566170' : esSuma ? (v[j] > 0 ? TEXTO_HEX.operacion : v[j] < 0 ? TEXTO_HEX.fallo : '#566170') : TEXTO_HEX.texto,
          fontStyle: n === 2 ? 'bold' : 'normal',
        });
        t.setOrigin(0.5, 0);
      });
    });
    g.lineStyle(1, COLORES.banda, 0.6);
    g.strokeRect(12 + ETIQUETA, yE, nP * CW, 3 * CH);
    g.lineBetween(12 + ETIQUETA, yE + 2 * CH, 12 + ETIQUETA + nP * CW, yE + 2 * CH);

    // ---- Probar disparo ----
    const xP = 12 + ETIQUETA + nP * CW + 30;
    this._boton(xP, y0, 190, 26, this.probar ? 'Probar disparo: activado' : 'Probar disparo', this.probar ? COLORES.mantenimiento : COLORES.banda, () => {
      this.probar = !this.probar;
      this._reconstruir();
    });
    this._texto(xP + 198, y0 + 6, this.seleccion ? `Transición elegida: ${this.seleccion}` : 'Elige una transición', { color: TEXTO_HEX.espera });
    if (this.probar && idx >= 0) this._prueba(g, xP, y0 + 34, idx, M, red, colX, yFila);
    else this._texto(xP, y0 + 34, 'Pulsa una fila de la tabla para elegir una transición y\n"Probar disparo" para ver el marcado que resultaría sin aplicarlo.', { color: '#8794a3', lineSpacing: 3 });
  }

  /** Marcado que resultaría de disparar la transición elegida; señala los lugares que no alcanzan. */
  _prueba(g, xP, y, idx, M, red, colX, yFila) {
    const t = red.transiciones[idx];
    const fila = red.A[idx];
    const resultado = M.map((v, j) => v + fila[j]);
    const habilitada = red.habilitada(idx);
    const falta = red.faltantes(M, t.id); // nombres de lugar (con " (llena)")
    const malos = new Set(falta.map((n) => red.indiceP(n.replace(' (llena)', ''))));
    const nP = red.lugares.length;
    const w = 15; // ancho de celda de la prueba
    this._texto(xP, y, `${t.id} ${t.nombre}: ${habilitada ? 'habilitada (M ≥ Pre y cabe en k)' : 'NO habilitada'}`, {
      fontStyle: 'bold',
      color: habilitada ? TEXTO_HEX.operacion : TEXTO_HEX.fallo,
    });
    const filas = [['M', M], ['+ Aᵀ·u', fila], ["= M'", resultado]];
    const x0 = xP + 56;
    red.lugares.forEach((l, j) => this._texto(x0 + j * (w + 2) + w / 2, y + 16, l.id, { fontSize: '8px', color: '#8794a3' }).setOrigin(0.5, 0));
    filas.forEach(([nombre, v], n) => {
      const yy = y + 28 + n * CH;
      this._texto(xP, yy + 3, nombre, { fontStyle: 'bold' });
      v.forEach((val, j) => {
        const mal = malos.has(j);
        if (mal) {
          g.fillStyle(COLORES.fallo, 0.35);
          g.fillRect(x0 + j * (w + 2), yy, w + 2, CH);
        }
        const txt = n === 1 && val > 0 ? `+${val}` : String(val);
        this._texto(x0 + j * (w + 2) + w / 2, yy + 3, txt, { color: val < 0 ? TEXTO_HEX.fallo : TEXTO_HEX.texto, fontStyle: mal ? 'bold' : 'normal' }).setOrigin(0.5, 0);
      });
    });
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
      xP,
      y + 28 + 3 * CH + 6,
      habilitada ? 'Es el marcado que resultaría. No se aplicó nada.' : `No alcanza: ${detalle.join('; ')}.\nEl marcado de arriba es solo el cálculo, no es alcanzable.`,
      { color: habilitada ? TEXTO_HEX.texto : TEXTO_HEX.fallo, wordWrap: { width: 470 }, lineSpacing: 3 },
    );
  }

  _boton(x, y, ancho, alto, etiqueta, color, accion) {
    const rect = this.add.rectangle(x, y, ancho, alto, color).setOrigin(0).setStrokeStyle(2, COLORES.texto, 0.9).setInteractive({ useHandCursor: true });
    const t = this.add.text(x + ancho / 2, y + alto / 2, etiqueta, TEXTO({ fontStyle: 'bold', fontSize: '11px' })).setOrigin(0.5);
    rect.on('pointerup', accion);
    this.dinamico.add([rect, t]);
  }

  // ---- Árbol de cobertura ----

  _arbol() {
    const c = this.celda;
    const red = c.red;
    const desdeActual = this.arbolDesde === 'actual';
    const raiz = desdeActual ? red.marcado() : red.m0;
    const arbol = arbolCobertura(red, raiz, 2000, desdeActual ? 4 : Infinity);

    this._boton(12, 32, 150, 24, 'Desde M0', this.arbolDesde === 'm0' ? COLORES.mantenimiento : COLORES.banda, () => { this.arbolDesde = 'm0'; this._reconstruir(); });
    this._boton(168, 32, 230, 24, 'Desde el marcado actual (prof. 4)', desdeActual ? COLORES.mantenimiento : COLORES.banda, () => { this.arbolDesde = 'actual'; this._reconstruir(); });
    const muertos = arbol.nodos.filter((n) => n.tipo === 'muerto').length;
    this._texto(
      410,
      38,
      `Nodos: ${arbol.nodos.length}   ·   marcados distintos: ${arbol.marcadosDistintos}   ·   muertos: ${muertos}   ·   ${arbol.acotada ? 'acotada' : 'no acotada (ω)'}${arbol.truncado ? '   (truncado)' : ''}`,
      { fontSize: '12px', fontStyle: 'bold', color: muertos > 0 ? TEXTO_HEX.fallo : TEXTO_HEX.operacion },
    );

    // Distribución por niveles.
    const niveles = [];
    for (const n of arbol.nodos) (niveles[n.nivel] ??= []).push(n);
    const ancho = PANEL.ancho - 24;
    const yNivel = (l) => 84 + l * Math.min(56, 290 / Math.max(1, niveles.length - 1));
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
      PANEL.alto - 18,
      'Rojo: marcado muerto (ninguna transición habilitada). Gris: marcado repetido (no se expande). Borde amarillo: el marcado actual.',
      { color: '#8794a3' },
    );
  }
}

