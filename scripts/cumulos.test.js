import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { encuadreDeCumulo, rangoEdad } from '../src/scene/datosCumulos.js';

const { cumulos, fuente } = JSON.parse(fs.readFileSync('public/data/cumulos.json', 'utf8'));
const estrellas = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));

test('los cúmulos conocidos están, con miembros de Hoshi y su fuente', () => {
  assert.match(fuente, /Perren et al\. 2023/);
  const por = nombre => cumulos.find(c => c.nombre === nombre);
  for (const nombre of ['Híades', 'Pléyades', 'Pesebre', 'Cúmulo de Coma Berenices', 'Cúmulo de Alfa Persei']) assert.ok(por(nombre)?.ids.length >= 10, nombre);
  const pleyades = por('Pléyades');
  assert.ok(pleyades.ids.some(id => estrellas.get(id)?.n === 'Maia'));
  assert.ok(Math.abs(pleyades.d - 136) < 5);
  assert.ok(cumulos.every(c => c.ids.length >= 3 && c.ids.every(id => estrellas.has(id))));
});

test('el encuadre deja la cámara fuera del cúmulo, del lado del Sol', () => {
  for (const nombre of ['Híades', 'Pléyades', 'IC 2391 (Omicron Velorum)']) {
    const c = cumulos.find(x => x.nombre === nombre);
    const { distance, direction } = encuadreDeCumulo(c, estrellas);
    const camara = [c.x + direction[0] * distance, c.y + direction[1] * distance, c.z + direction[2] * distance];
    const dentro = c.ids.some(id => { const s = estrellas.get(id); return Math.hypot(s.x - camara[0], s.y - camara[1], s.z - camara[2]) < distance * 0.2; });
    assert.ok(!dentro && Math.hypot(...camara) < Math.hypot(c.x, c.y, c.z), nombre);
  }
});

test('la edad va como rango: estudios dedicados y, si no, Hunt & Reffert 2023', () => {
  const pleyades = cumulos.find(c => c.id === 'pleiades');
  assert.match(pleyades.fuenteEdad, /Stauffer et al\. 1998/);
  assert.equal(rangoEdad(pleyades.edadMinMyr, pleyades.edadMaxMyr), '110–130');
  assert.equal(rangoEdad(1000, 1500), '1.000–1.500');
  const sinEstudio = cumulos.find(c => c.id === 'ngc3532');
  assert.match(sinEstudio.fuenteEdad, /Hunt & Reffert 2023/);
  assert.ok(sinEstudio.edadMinMyr < sinEstudio.edadMaxMyr);
});

test('Omega Centauri (NGC 5139): globular, con sus miembros a la distancia del cúmulo y en el buscador', async () => {
  const { buscarCumulos } = await import('../src/scene/buscarCumulos.js');
  const omega = cumulos.find(c => c.id === 'ngc5139');
  assert.equal(omega?.tipo, 'globular');
  assert.ok(omega.ids.length >= 4000, `${omega.ids.length} miembros`);
  assert.equal(omega.constelacion, 'Cen');
  assert.equal(omega.d, 5250);
  assert.deepEqual([omega.edadMinMyr, omega.edadMaxMyr], [10000, 13000]);
  assert.equal(omega.metalicidad, null);
  assert.equal(omega.radioEnFicha, false);
  // En 3D: cada miembro a su profundidad, centrados en la distancia del cúmulo.
  const distancias = omega.ids.map(id => estrellas.get(id).d).sort((a, b) => a - b);
  const mediana = distancias[distancias.length >> 1];
  assert.ok(Math.abs(mediana - omega.d) < 0.005 * omega.d, `mediana ${mediana}`);
  assert.ok(distancias.at(-1) - distancias[0] > 20, `rango ${distancias[0]}–${distancias.at(-1)}`);
  for (const q of ['Omega Centauri', 'ω Centauri', 'Omega Cen', 'NGC 5139', 'Caldwell 80', 'Omega Centauro', 'ω Cen', 'Melotte 118', 'Mel 118', 'GCl 24']) {
    assert.equal(buscarCumulos({ cumulos }, q)[0]?.cumulo.id, 'ngc5139', q);
  }
});
