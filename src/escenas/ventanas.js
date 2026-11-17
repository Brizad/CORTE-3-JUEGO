// Ventanas dentro del juego (docs/GDD.md, sección 18.21): ficha de un logro, confirmación y campo para el nombre del jugador.
// No se usan alert, confirm ni prompt del navegador. Todas son contenedores de Phaser con un velo que no deja pasar los clics.

import { COLORES, TEXTO_HEX, ANCHO, ALTO, RES } from '../config.js';
import { resaltable } from './resaltar.js';
import { fechaCorta, MAX_NOMBRE } from '../guardado.js';

const PROFUNDIDAD = 500;
const ESTILO = (extra = {}) => ({ fontFamily: 'Arial', fontSize: '13px', color: TEXTO_HEX.texto, ...extra });

/**
 * Ventana base: velo oscuro, marco centrado y botón X. Esc o la X la cierran (si `cerrable`).
 * @returns {{caja:Phaser.GameObjects.Container, x:number, y:number, ancho:number, alto:number, cerrar:()=>void}}
 */
function ventana(escena, ancho, alto, { color = COLORES.banda, cerrable = true, alCerrar, esc = true } = {}) {
  const x = Math.round((ANCHO - ancho) / 2);
  const y = Math.round((ALTO - alto) / 2);
  const caja = escena.add.container(0, 0).setDepth(PROFUNDIDAD);
  const velo = escena.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.65).setOrigin(0).setInteractive();
  const marco = escena.add.graphics();
  marco.fillStyle(COLORES.panel, 1);
  marco.fillRoundedRect(x, y, ancho, alto, 8);
  marco.lineStyle(3, color, 1);
  marco.strokeRoundedRect(x, y, ancho, alto, 8);
  // El marco también atrapa el clic (para que no cierre la ventana al tocar dentro).
  const fondo = escena.add.rectangle(x, y, ancho, alto, 0x000000, 0).setOrigin(0).setInteractive();
  caja.add([velo, marco, fondo]);
  let abierta = true;
  const teclaEsc = () => cerrable && cerrar();
  const cerrar = () => {
    if (!abierta) return;
    abierta = false;
    escena.input.keyboard?.off('keydown-ESC', teclaEsc);
    caja.destroy();
    alCerrar?.();
  };
  if (cerrable) {
    velo.on('pointerup', cerrar);
    const x0 = escena.add.text(x + ancho - 12, y + 8, 'X', ESTILO({ fontSize: '18px', fontStyle: 'bold', padding: { x: 10, y: 6 } })).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    x0.on('pointerover', () => x0.setColor(TEXTO_HEX.espera));
    x0.on('pointerout', () => x0.setColor(TEXTO_HEX.texto));
    x0.on('pointerup', cerrar);
    caja.add(x0);
    if (esc) escena.input.keyboard?.on('keydown-ESC', teclaEsc); // con esc: false, Esc lo atiende la escena
  }
  escena.events.once('shutdown', () => abierta && cerrar());
  return { caja, x, y, ancho, alto, cerrar, abierta: () => abierta };
}

/** Botón rectangular de 44 px de alto (táctil) dentro de una ventana. */
function boton(escena, caja, x, y, ancho, etiqueta, color, accion, alto = 44) {
  const rect = resaltable(escena.add.rectangle(x, y, ancho, alto, color).setOrigin(0).setInteractive({ useHandCursor: true }));
  const t = escena.add.text(x + ancho / 2, y + alto / 2, etiqueta, ESTILO({ fontSize: '14px', fontStyle: 'bold' })).setOrigin(0.5);
  rect.on('pointerup', accion);
  caja.add([rect, t]);
  return rect;
}

/**
 * Ficha de un logro: nombre, qué significa, cómo se gana (en palabras simples) y si ya está ganado (con fecha) o bloqueado.
 * @param {object} logro Un elemento de LOGROS.
 * @param {{ganado:boolean, fecha?:string, progreso?:string, alCerrar?:()=>void}} estado
 */
export function fichaLogro(escena, logro, { ganado, fecha = '', progreso = '', alCerrar, esc = true } = {}) {
  const v = ventana(escena, 560, 320, { color: ganado ? 0xd4af37 : COLORES.banda, alCerrar, esc });
  const { caja, x, y, ancho } = v;
  // Cada bloque va debajo del anterior (según su alto real): un texto largo nunca se encima con el siguiente.
  let cursor = y + 16;
  const t = (texto, estilo, despues = 4) => {
    const o = escena.add.text(x + 20, cursor, texto, ESTILO({ wordWrap: { width: ancho - 40 }, lineSpacing: 3, ...estilo }));
    caja.add(o);
    cursor += o.height + despues;
    return o;
  };
  t(`${ganado ? '★' : '☆'}  ${logro.nombre}`, { fontSize: '22px', fontStyle: 'bold', color: ganado ? '#d4af37' : TEXTO_HEX.texto }, 12);
  t('Qué significa', { fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.espera }, 2);
  t(logro.significa ?? logro.descripcion, { fontSize: '14px' }, 10);
  t('Cómo se gana', { fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.espera }, 2);
  t(`${logro.nombre}: ${(logro.comoSeGana ?? logro.descripcion).replace(/^./, (c) => c.toLowerCase())}`, { fontSize: '14px' }, 14);
  const estado = ganado
    ? `Ganado${fecha ? ` el ${fechaCorta(fecha)}` : ''}`
    : `Bloqueado: todavía no lo ganas${progreso ? ` (${progreso})` : ''}`;
  t(estado, { fontSize: '15px', fontStyle: 'bold', color: ganado ? TEXTO_HEX.operacion : '#8794a3' });
  boton(escena, caja, x + ancho / 2 - 70, Math.max(y + 240, cursor + 6), 140, 'Cerrar', COLORES.banda, v.cerrar);
  return v;
}

/** Confirmación dentro del juego (no se usa confirm del navegador). */
export function confirmar(escena, pregunta, alAceptar, { si = 'Sí, borrar', no = 'Cancelar', alCerrar } = {}) {
  const v = ventana(escena, 440, 180, { color: COLORES.fallo, alCerrar });
  const { caja, x, y, ancho } = v;
  caja.add(escena.add.text(x + ancho / 2, y + 50, pregunta, ESTILO({ fontSize: '15px', fontStyle: 'bold', align: 'center', wordWrap: { width: ancho - 60 } })).setOrigin(0.5));
  boton(escena, caja, x + 30, y + 110, 170, si, COLORES.fallo, () => { v.cerrar(); alAceptar(); });
  boton(escena, caja, x + ancho - 200, y + 110, 170, no, COLORES.banda, v.cerrar);
  return v;
}

/**
 * Pide el nombre del jugador con un campo de texto real (para que salga el teclado del celular), dibujado sobre el lienzo.
 * Máximo 16 caracteres y sin vacío. Enter o «Entrar» aceptan; Esc o la X cancelan solo si `cancelable`.
 * @param {(nombre:string)=>void} alAceptar Recibe el nombre ya validado por `validar`.
 * @param {{inicial?:string, cancelable?:boolean, validar:(s:string)=>string|null}} opciones
 */
export function pedirNombre(escena, alAceptar, { inicial = '', cancelable = false, validar, alCerrar }) {
  let campo = null;
  const quitar = () => {
    globalThis.removeEventListener?.('resize', colocar);
    campo?.remove();
    campo = null;
  };
  const v = ventana(escena, 480, 236, { color: COLORES.operacion, cerrable: cancelable, alCerrar: () => { quitar(); alCerrar?.(); } });
  const { caja, x, y, ancho } = v;
  caja.add(escena.add.text(x + 24, y + 18, '¿Cómo te llamas?', ESTILO({ fontSize: '22px', fontStyle: 'bold' })));
  caja.add(escena.add.text(x + 24, y + 52, `Tu nombre sale en «Mejores puntajes» y guarda tus logros (máx. ${MAX_NOMBRE} caracteres).`, ESTILO({ fontSize: '12px', color: '#8794a3', wordWrap: { width: ancho - 48 } })));
  const caj = { x: x + 24, y: y + 84, ancho: ancho - 48, alto: 44 };
  const borde = escena.add.graphics();
  borde.fillStyle(0x0d1117, 1).fillRect(caj.x, caj.y, caj.ancho, caj.alto);
  borde.lineStyle(2, COLORES.espera, 1).strokeRect(caj.x, caj.y, caj.ancho, caj.alto);
  const error = escena.add.text(x + 24, y + 134, '', ESTILO({ fontSize: '12px', fontStyle: 'bold', color: TEXTO_HEX.fallo }));
  caja.add([borde, error]);
  const aceptar = () => {
    const nombre = validar(campo?.value ?? '');
    if (!nombre) {
      error.setText('Escribe un nombre (de 1 a 16 caracteres).');
      campo?.focus();
      return;
    }
    v.cerrar();
    alAceptar(nombre);
  };
  boton(escena, caja, x + ancho / 2 - 80, y + 168, 160, 'Entrar', COLORES.operacion, aceptar);

  // Campo de texto HTML sobre el recuadro dibujado (se recoloca al cambiar el tamaño de la ventana).
  const doc = globalThis.document;
  const lienzo = escena.game.canvas;
  if (doc && lienzo) {
    campo = doc.createElement('input');
    campo.type = 'text';
    campo.maxLength = MAX_NOMBRE;
    campo.value = inicial;
    campo.autocomplete = 'off';
    campo.spellcheck = false;
    campo.setAttribute('aria-label', 'Nombre del jugador');
    campo.id = 'campo-nombre';
    Object.assign(campo.style, {
      position: 'fixed', zIndex: 5, background: 'transparent', border: 'none', outline: 'none', color: '#e6edf3',
      fontFamily: 'Arial, sans-serif', fontWeight: 'bold', padding: '0 10px', margin: 0, userSelect: 'text', webkitUserSelect: 'text',
    });
    // Las teclas del campo no llegan a los atajos del juego (T, C, Enter del título).
    campo.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') aceptar();
      if (e.key === 'Escape' && cancelable) v.cerrar();
    });
    campo.addEventListener('keyup', (e) => e.stopPropagation());
    campo.addEventListener('input', () => error.setText(''));
    doc.body.appendChild(campo);
    colocar();
    globalThis.addEventListener?.('resize', colocar);
    setTimeout(() => campo?.focus(), 50);
  }
  function colocar() {
    if (!campo) return;
    const r = lienzo.getBoundingClientRect();
    const k = r.width / (ANCHO * RES) * RES; // píxeles de pantalla por píxel lógico
    Object.assign(campo.style, {
      left: `${r.left + caj.x * k}px`, top: `${r.top + caj.y * k}px`, width: `${caj.ancho * k}px`, height: `${caj.alto * k}px`,
      fontSize: `${Math.max(16, 20 * k)}px`, // 16 px o más: así iOS no hace zoom al enfocar
    });
  }
  return { ...v, campo: () => campo, aceptar };
}
