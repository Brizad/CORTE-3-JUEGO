// Disposición del HUD (docs/arte.md, sección 8). Error real encontrado en la revisión: el botón "?" se había puesto en (144, 52) y
// tapaba el título del Inspector y el cuadro del tutorial. Esta prueba evita que vuelva a pasar: nada se encima y todo cabe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONAS, BOTONES, BOTON_TACTIL, ANCHO_LOGICO, ALTO_LOGICO } from '../src/disposicion.js';

const todos = [
  ...Object.entries(ZONAS).map(([nombre, r]) => ({ nombre: `zona ${nombre}`, ...r })),
  ...Object.entries(BOTONES).map(([nombre, r]) => ({ nombre: `botón ${nombre}`, ...r })),
];
const seEncima = (a, b) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

test('todas las zonas y botones caben en el lienzo de 960 x 540', () => {
  for (const r of todos) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.ancho <= ANCHO_LOGICO && r.y + r.alto <= ALTO_LOGICO, `${r.nombre} se sale del lienzo`);
  }
});

test('ninguna zona ni botón se encima con otro', () => {
  for (let i = 0; i < todos.length; i++) {
    for (let j = i + 1; j < todos.length; j++) {
      assert.ok(!seEncima(todos[i], todos[j]), `${todos[i].nombre} se encima con ${todos[j].nombre}`);
    }
  }
});

test('todos los botones miden al menos 44 px (mínimo táctil) en cada lado', () => {
  for (const [nombre, b] of Object.entries(BOTONES)) {
    assert.ok(b.ancho >= BOTON_TACTIL && b.alto >= BOTON_TACTIL, `${nombre} mide ${b.ancho}x${b.alto}`);
  }
});

test('los botones de la barra superior no tapan los paneles que se abren debajo (que empiezan en y = 52)', () => {
  for (const nombre of ['pantalla', 'ayuda', 'silencio', 'vel1', 'vel2', 'vel4', 'pausa', 'inspector', 'red']) {
    assert.ok(BOTONES[nombre].y + BOTONES[nombre].alto <= 52, `${nombre} baja de la barra superior`);
  }
});

test('Inspector a pantalla completa: sus zonas caben en 960 x 540 y no se enciman (18.21)', async () => {
  const { ZONAS_INSPECTOR, TABLAS_INSPECTOR } = await import('../src/disposicion.js');
  const zonas = Object.entries(ZONAS_INSPECTOR).map(([nombre, r]) => ({ nombre, ...r }));
  for (const r of zonas) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.ancho <= ANCHO_LOGICO && r.y + r.alto <= ALTO_LOGICO, `${r.nombre} se sale`);
  for (let i = 0; i < zonas.length; i++) for (let j = i + 1; j < zonas.length; j++) assert.ok(!seEncima(zonas[i], zonas[j]), `${zonas[i].nombre} con ${zonas[j].nombre}`);
  // Las 3 tablas con 10 lugares (con el Controlador) y 8 transiciones caben en la zona de arriba.
  const t = TABLAS_INSPECTOR;
  const z = ZONAS_INSPECTOR.tablas;
  assert.ok(t.etiqueta + 3 * 10 * t.celda + 2 * t.hueco <= z.ancho, 'las tablas no caben a lo ancho');
  assert.ok(t.cabecera + 8 * t.alto <= z.alto, 'las tablas no caben a lo alto');
  // Abajo: ecuación a la izquierda y «Probar disparo» a la derecha, lado a lado.
  assert.ok(ZONAS_INSPECTOR.ecuacion.x + ZONAS_INSPECTOR.ecuacion.ancho < ZONAS_INSPECTOR.probar.x);
  assert.ok(ZONAS_INSPECTOR.tablas.y + ZONAS_INSPECTOR.tablas.alto < ZONAS_INSPECTOR.ecuacion.y);
});

test('pantalla de título: la columna del juego y la de «Mejores puntajes» no se enciman (18.21)', async () => {
  const { ZONAS_TITULO } = await import('../src/disposicion.js');
  const { izquierda, puntajes } = ZONAS_TITULO;
  assert.ok(!seEncima(izquierda, puntajes));
  for (const r of [izquierda, puntajes]) assert.ok(r.x + r.ancho <= ANCHO_LOGICO && r.y + r.alto <= ALTO_LOGICO);
  // 10 filas de 36 px + cabecera (72) + botón «Borrar puntajes» (52) caben en la columna.
  assert.ok(72 + 10 * 36 + 52 <= puntajes.alto + 4);
});
