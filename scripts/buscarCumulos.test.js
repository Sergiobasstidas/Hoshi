import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buscarCumulos } from '../src/scene/buscarCumulos.js';

const datos = JSON.parse(fs.readFileSync('public/data/cumulos.json', 'utf8'));
const primero = consulta => buscarCumulos(datos, consulta)[0]?.cumulo.id;

test('el buscador encuentra los cúmulos por su nombre, catálogo y nombres de uso común', () => {
  for (const [consulta, id] of [['pleyades', 'pleiades'], ['Pléyades', 'pleiades'], ['M45', 'pleiades'], ['M 45', 'pleiades'], ['Messier 45', 'pleiades'],
    ['Melotte 22', 'pleiades'], ['siete cabritas', 'pleiades'], ['hiades', 'hyades'], ['Hyades', 'hyades'], ['pesebre', 'ngc2632'], ['Praesepe', 'ngc2632'],
    ['colmena', 'ngc2632'], ['Pléyades del Sur', 'ic2602'], ['pozo de los deseos', 'ngc3532']]) assert.equal(primero(consulta), id, consulta);
  // La coincidencia exacta va primero: «pléyades» da las Pléyades antes que IC 2602 (Pléyades del Sur).
  assert.deepEqual(buscarCumulos(datos, 'pléyades').map(f => f.cumulo.id).slice(0, 2), ['pleiades', 'ic2602']);
});

test('solo entran los cúmulos que Hoshi muestra', () => {
  for (const fila of buscarCumulos(datos, 'ocsn', 50)) assert.ok(fila.cumulo.ids.length >= 8);
  assert.deepEqual(buscarCumulos(datos, 'p'), []);
});
