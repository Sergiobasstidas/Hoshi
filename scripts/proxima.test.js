import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIGHT_YEAR_PC, starLabelOpacity } from '../src/scene/scale.js';
import { PROXIMA_HSB, nombreEnModo, nombreVisible } from '../src/scene/modosBrillo.js';

const datos = JSON.parse(readFileSync(new URL('../data/processed/stars_15pc.json', import.meta.url)));
const stars = Array.isArray(datos) ? datos : datos.stars;
const proxima = stars.find(star => star.i === PROXIMA_HSB);
const barnard = stars.find(star => star.n === "Barnard's Star");
const OJO = 6;

test('Proxima (HSB 1436975, HIP 70890) es la del catálogo', () => {
  assert.equal(proxima.n, 'Proxima Centauri');
});

test('en Ojo humano, Proxima se nombra con la cámara a 3 años luz y Barnard no', () => {
  assert.equal(nombreEnModo(proxima, 3 * LIGHT_YEAR_PC, OJO), 1);
  assert.equal(nombreEnModo(barnard, 3 * LIGHT_YEAR_PC, OJO), 0);
});

test('visto desde el Sol nada cambia: ninguna estrella cambia de regla y los nombres siguen apagados', () => {
  for (const star of stars) if (star.i !== PROXIMA_HSB && star.d > 0) {
    assert.equal(nombreEnModo(star, star.d, OJO), nombreVisible(star.m, star.d, OJO));
  }
  assert.equal(starLabelOpacity(1 / 206265), 0);
});
