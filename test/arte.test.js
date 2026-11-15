// Cada estado de cada autómata y cada lugar de la red tiene su aspecto (docs/arte.md, secciones 5 y 6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { aspectoDe, estadosDe } from '../src/arte/estados.js';
import { FICHAS_DE_LUGAR } from '../src/arte/tokens.js';
import { COLORES } from '../src/config.js';
import { cargarModelo } from './ayudas.js';

const ESTADOS = { CNC: 'cnc.json', BRAZO: 'brazo.json', AGV: 'agv.json' };
const COLORES_DE_ESTADO = [COLORES.operacion, COLORES.espera, COLORES.fallo];

test('cada estado de CNC (5), brazo (4) y AGV (4) tiene color e ícono, y no sobra ninguno', () => {
  for (const [tipo, archivo] of Object.entries(ESTADOS)) {
    const modelo = cargarModelo(archivo);
    assert.deepEqual([...estadosDe(tipo)].sort(), [...modelo.estados].sort(), tipo);
    for (const estado of modelo.estados) {
      const a = aspectoDe(tipo, estado);
      assert.ok(COLORES_DE_ESTADO.includes(a.color), `${tipo}.${estado} usa un color fuera de la paleta de estados`);
      assert.ok(a.icono.length > 0);
    }
  }
});

test('los colores de estado coinciden con docs/arte.md, sección 5', () => {
  assert.equal(aspectoDe('CNC', 'Fresando').nombreColor, 'operacion');
  assert.equal(aspectoDe('CNC', 'Falla').nombreColor, 'fallo');
  assert.equal(aspectoDe('CNC', 'Fresando').icono, 'chispas');
  assert.equal(aspectoDe('CNC', 'Falla').icono, 'rayo');
  assert.equal(aspectoDe('BRAZO', 'Mandril_Abierto').nombreColor, 'espera');
  assert.equal(aspectoDe('BRAZO', 'Mandril_Cerrado').nombreColor, 'operacion');
  assert.equal(aspectoDe('AGV', 'Esperando').icono, 'relojArena');
  assert.throws(() => aspectoDe('CNC', 'Inventado'), /Sin aspecto/);
});

test('cada lugar de las dos redes tiene su ficha', () => {
  for (const archivo of ['red_agv.json', 'red_agv_corregida.json']) {
    for (const lugar of cargarModelo(archivo).lugares) {
      assert.ok(FICHAS_DE_LUGAR[lugar.nombre], `${archivo}: falta la ficha de ${lugar.nombre}`);
    }
  }
});
