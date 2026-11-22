import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADDED_GLOBULARES_JSON, GLOBULARES, profundidadPlummer } from './catalog/globulares.js';
import { magnitudesFicha } from '../src/scene/magnitudesFicha.js';

// Profundidad de los miembros (build_globulares.js): z dado el radio proyectado R sigue el Plummer condicional,
// p(z|R) ∝ (a² + R² + z²)^(−5/2), sin sesgo de signo y siempre igual para el mismo source_id.
test('la profundidad de los miembros sigue el Plummer condicional, sin sesgo y determinista', () => {
  const a = 8.86;
  for (const R of [0, 5, 20]) {
    const zs = Array.from({ length: 20000 }, (_, k) => profundidadPlummer(R, a, `fuente-${k}`)).sort((x, y) => x - y);
    const b2 = a * a + R * R, acumulada = z => 0.5 + z * (2 * z * z + 3 * b2) / (4 * (b2 + z * z) ** 1.5);
    assert.ok(Math.abs(zs[zs.length >> 1]) < 0.05 * Math.sqrt(b2), `mediana con R = ${R}`);
    for (const z of [-3 * Math.sqrt(b2), -Math.sqrt(b2), Math.sqrt(b2), 3 * Math.sqrt(b2)]) {
      const empirica = zs.filter(x => x <= z).length / zs.length;
      assert.ok(Math.abs(empirica - acumulada(z)) < 0.015, `R = ${R}, z = ${z.toFixed(1)}: ${empirica} frente a ${acumulada(z)}`);
    }
  }
  assert.equal(profundidadPlummer(3, a, '6083704149848731520'), profundidadPlummer(3, a, '6083704149848731520'));
});

test('la ficha de un miembro usa la distancia del cúmulo para la distancia y la magnitud absoluta (magnitudesFicha)', () => {
  const omega = GLOBULARES.find(c => c.id === 'ngc5139'), cumulo = { d: omega.distanciaPc };
  // Una gigante de Omega Centauri tal como la guarda build_globulares.js: a su profundidad propia, con m = V − 5 log10(d / 10).
  const miembro = JSON.parse(fs.readFileSync(ADDED_GLOBULARES_JSON, 'utf8')).stars.find(s => s.gaia === '6083704149848731520');
  assert.ok(Math.abs(miembro.d - omega.distanciaPc) > 0.1, `profundidad ${miembro.d - omega.distanciaPc} pc`);
  const V = miembro.m + 5 * Math.log10(miembro.d / 10);
  const ficha = magnitudesFicha(miembro, cumulo);
  assert.equal(ficha.distanciaPc, omega.distanciaPc);
  assert.ok(Math.abs(ficha.aparente - V) < 1e-9);
  assert.ok(Math.abs(ficha.absoluta - (V - 5 * Math.log10(omega.distanciaPc / 10))) < 1e-9);
  assert.equal(ficha.absoluta.toFixed(2), '-2.02');
  // Sin cúmulo, la de la estrella.
  assert.equal(magnitudesFicha({ d: 10, m: 4.83 }).absoluta, 4.83);
});
