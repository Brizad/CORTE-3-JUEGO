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
