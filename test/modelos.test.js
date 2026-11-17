// Los JSON de src/sed/modelos/ salen de modelos/ sin cambiar ningún valor, y src/sed/ no depende del motor gráfico.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generarModelos, aTexto } from '../scripts/exportar-modelos.mjs';
import { cargarModelo } from './ayudas.js';

test('los JSON exportados coinciden con los archivos de modelos/ (.jff y .pnml)', () => {
  for (const [archivo, datos] of Object.entries(generarModelos())) {
    const url = new URL(`../src/sed/modelos/${archivo}`, import.meta.url);
    // Git en Windows (core.autocrlf) puede dejar los JSON con CRLF: se compara el contenido, no el tipo de salto de línea.
    assert.equal(fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n'), aTexto(datos), `${archivo} está desactualizado: ejecuta npm run modelos`);
  }
});

test('el supervisor prohíbe (Fresando, Mandril_Abierto) con la razón del GDD', () => {
  const s = cargarModelo('supervisor.json');
  assert.deepEqual(s.prohibidos, [['Fresando', 'Mandril_Abierto']]);
  assert.equal(s.razon, '¬(CNC = Fresando ∧ Brazo = Mandril_Abierto)');
});

test('src/sed/ no menciona el motor gráfico ni usa el DOM', () => {
  const carpeta = new URL('../src/sed/', import.meta.url);
  for (const archivo of fs.readdirSync(carpeta).filter((f) => f.endsWith('.js'))) {
    const texto = fs.readFileSync(new URL(archivo, carpeta), 'utf8');
    assert.ok(!/phaser/i.test(texto), `${archivo} menciona Phaser`);
    assert.ok(!/\b(document|window|navigator)\b/.test(texto), `${archivo} usa el DOM`);
  }
});
