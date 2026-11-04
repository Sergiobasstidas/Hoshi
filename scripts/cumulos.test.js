import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { encuadreDeCumulo } from '../src/scene/datosCumulos.js';

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
