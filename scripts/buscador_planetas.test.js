import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSearchIndex, searchStars } from '../src/scene/starSearch.js';
import { buscarAnfitrionas, buscarPlanetas, indicesDePlanetas, ordenPorLetra } from '../src/scene/buscarPlanetas.js';
import { addCuratedSearchRows } from '../src/scene/curatedStars.js';

// Índice de estrellas como el del navegador (indiceBusqueda.js), con los nombres de variable al final.
const variables = new Map(JSON.parse(fs.readFileSync('./public/data/star-search-variables.json', 'utf8')));
const estrellas = buildSearchIndex(addCuratedSearchRows(JSON.parse(fs.readFileSync('./public/data/star-search.json', 'utf8'))
  .map(([id, nombres]) => [id, [...nombres, ...(variables.get(id) || [])]])));
const datos = JSON.parse(fs.readFileSync('./public/data/planet-search.json', 'utf8'));
const indices = indicesDePlanetas(datos, estrellas);
const primero = consulta => buscarPlanetas(indices, consulta)[0];

test('el índice de planetas tiene cada exoplaneta que dibuja Hoshi, con sus nombres y los de su estrella', () => {
  const nombres = JSON.parse(fs.readFileSync('./public/data/exoplanets.json', 'utf8')).systems.flatMap(s => s.p.map(p => p.n));
  assert.equal(indices.planetaDe.size, nombres.length);
  for (const n of nombres) assert.ok(indices.planetaDe.has(`planeta-${n}`), n);
  const gj436 = indices.planetas.find(f => f.id === 'planeta-GJ 436 b');
  for (const n of ['GJ 436 b', 'Noquisi b', 'Ross 905 b', 'HIP 57087 b']) assert.ok(gj436.aliases.includes(n), n);
  assert.deepEqual(indices.planetaDe.get('planeta-GJ 436 b'), { nombre: 'GJ 436 b', estrellaId: 1208459, estrella: 'Noquisi' });
});

test('cada planeta se encuentra por su nombre, sus nombres propios y los de su estrella con su letra', () => {
  const ejemplos = [['GJ 436 b', 'GJ 436 b'], ['Gliese 436 b', 'GJ 436 b'], ['Ross 905 b', 'GJ 436 b'], ['HIP 57087 b', 'GJ 436 b'],
    ['TIC 138819293 b', 'GJ 436 b'], ['Próxima Centauri b', 'Proxima Cen b'], ['KOI-7016.01', 'Kepler-452 b'], ['K2-112 e', 'TRAPPIST-1 e']];
  // Los nombres IAU de planetas los trae el servicio de alias de la NASA (scripts/exoplanets/build_planet_search.js).
  if (datos.some(([, , planetas]) => planetas.some(([, , propios]) => propios.includes('Awohali')))) ejemplos.push(['Awohali', 'GJ 436 b'], ['Dimidium', '51 Peg b']);
  for (const [consulta, planeta] of ejemplos) {
    for (const forma of [consulta, consulta.replace(/ ([a-z])$/, (_, l) => ` ${l.toUpperCase()}`)]) {
      const r = primero(forma);
      assert.equal(r?.planeta.nombre, planeta, forma);
      assert.equal(r.score, 0, forma);
    }
  }
});

test('el nombre de una estrella sigue mostrando primero la estrella, y sus nombres nuevos también la encuentran', () => {
  const estrella = searchStars(estrellas, 'GJ 436')[0], planeta = primero('GJ 436');
  assert.equal(estrella.id, 1208459);
  assert.ok(estrella.score < planeta.score);
  assert.equal(buscarAnfitrionas(indices, 'Ross 905')[0]?.id, 1208459);
});

// Lista combinada como en StarSearch.jsx: una mayúscula sola al final pone primero la estrella y una minúscula el planeta.
const lista = consulta => {
  const orden = ordenPorLetra(consulta);
  return [...searchStars(estrellas, consulta, 3).map(r => ({ nombre: r.aliases[0], score: r.score + orden.estrella })),
    ...buscarPlanetas(indices, consulta, 3).map(r => ({ nombre: `planeta ${r.planeta.nombre}`, score: r.score + orden.planeta }))]
    .sort((a, b) => a.score - b.score).map(r => r.nombre);
};

test('una mayúscula al final es una componente estelar y una minúscula un planeta', () => {
  // GJ 229 B no tiene fila propia en el buscador: lleva a su sistema, GJ 229, antes que al planeta.
  assert.deepEqual(lista('GJ 229 B').slice(0, 2), ['GJ 229', 'planeta GJ 229 b']);
  assert.equal(lista('GJ 229 b')[0], 'planeta GJ 229 b');
  assert.equal(lista('Alpha Centauri B')[0], 'Toliman');
  // En Hoshi, HD 41004 A y B son una sola estrella, que se muestra como «HD 41004 A».
  assert.equal(lista('HD 41004 B')[0], 'HD 41004 A');
  assert.equal(lista('HD 41004 B b')[0], 'planeta HD 41004 B b');
  assert.equal(lista('HD 41004 A b')[0], 'planeta HD 41004 A b');
  assert.ok(!lista('HD 41004 B b').includes('planeta HD 41004 A b'));
  // Sin componente con ese nombre, el planeta sale igual.
  assert.equal(lista('Proxima Centauri B')[0], 'planeta Proxima Cen b');
});
