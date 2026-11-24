import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSearchIndex, lineaDeAlias, mismoNombre, searchStars } from '../src/scene/starSearch.js';
import { addCuratedSearchRows } from '../src/scene/curatedStars.js';
import { sumarVariablesEnOrden } from '../src/scene/nombresEstrella.js';

// El índice del buscador como lo arma la app (src/indiceBusqueda.js): catálogo, variables y filas curadas.
const leer = ruta => JSON.parse(fs.readFileSync(ruta, 'utf8'));
const variables = new Map(leer('public/data/star-search-variables.json'));
const filas = leer('public/data/star-search.json').map(([id, nombres, principales = 0]) =>
  [id, variables.has(id) ? sumarVariablesEnOrden(nombres, variables.get(id), principales) : nombres]);
const indice = buildSearchIndex(addCuratedSearchRows(filas));
const primeros = (consulta, n = 1) => searchStars(indice, consulta).slice(0, n).map(r => r.id);

test('estrellas famosas y nombres de la IAU: lo que sale primero en el buscador', () => {
  for (const consulta of ['Alfa Centauri', 'Alpha Centauri']) assert.deepEqual(new Set(primeros(consulta, 2)), new Set([1451193, 1451151]), consulta);
  assert.deepEqual(new Set(primeros('Zeta Reticuli', 2)), new Set([243770, 244224]));
  assert.deepEqual(new Set(primeros('Nu Draconis', 2)), new Set([1733422, 1733607]));
  assert.notEqual(primeros('Phi Cancri')[0], 886978); // φ Cnc antes que FI Cnc
  assert.deepEqual(primeros('Anser', 2), [2026703, 1561199]);
  const esperados = {
    'Alpha Herculis': 1699111, 'Gamma Velorum': 832325, 'WR 124': 1981748, 'UV Ceti': 100000432, 'VB 10': 100005331, '40 Eridani B': 100001079,
    'Matusalén': 1544149, 'Estrella de Barnard': 1789453, Mazaalai: 9000125, Mazalaai: 9000125, Phoenicia: 2153351, Orkaria: 1700255, Onkaria: 1700255,
    Absolutno: 9003620, Antinous: 2146295, Tiansi: 72768, Cih: 72768, 'Lang-Exster': 2406725, Yunu: 1062698, Dhanusaragra: 1808736, Bodu: 1799483,
    Pulcherrima: 101351419, 'Estrella de Tabby': 101351420, Boyajian: 101351420, 'V404 Cygni': 101351421, 'NML Cygni': 101351422, W26: 101351423,
    'Gaia BH1': 101351424, 'Gaia BH3': 101351426, 'LP 40-365': 101351427, 'Luhman 16': 100008153, 'V838 Mon': 101351429, Paloma: 101351430,
    'Estrella de Caffau': 101351431, 'Estrella de Scholz': 100007681, 'RS Persei': 101351418, 'Dust-Ball': 101351432,
  };
  for (const [consulta, id] of Object.entries(esperados)) assert.equal(primeros(consulta)[0], id, consulta);
  // Pulcherrima es la compañera, no Izar; Izar queda con los números de A y la compañera con los de B.
  const nombresDe = id => indice.find(item => item.id === id).aliases;
  assert.ok(!nombresDe(1458789).includes('Pulcherrima') && !nombresDe(1458789).includes('HD 129988') && nombresDe(1458789).includes('HD 129989'));
  assert.ok(nombresDe(101351419).includes('HD 129988') && nombresDe(101351419).includes('HR 5505'));
  // 95 Her: A con HD 164669 y HR 6730; B con HD 164668 y HR 6729.
  assert.ok(nombresDe(1799483).includes('HD 164669') && !nombresDe(1799483).includes('HD 164668'));
  assert.ok(nombresDe(100004947).includes('HR 6729'));
  // Sin prefijos de SIMBAD en los nombres.
  assert.ok(!indice.some(item => item.aliases.some(a => /^(NAME|NAME-IAU|HIDDEN NAME) /.test(a))));
});

test('el sistema de Izar dibuja a Pulcherrima como su compañera B', () => {
  const izar = leer('data/processed/star_systems.json')['1458789'];
  assert.equal(izar.comps.find(c => c.n === 'B').cid, 101351419);
});

test('ninguna sugerencia repite su título en la línea de alias', () => {
  for (const consulta of ['Absolutno', 'Dìwö', 'Diwo', 'Batsu', 'Tau Ceti', 'Rigil Kentaurus', 'Estrella de Tabby']) {
    for (const r of searchStars(indice, consulta)) assert.ok(!lineaDeAlias(r.aliases, r.matched).some(a => mismoNombre(a, r.aliases[0])), `${consulta}: ${r.aliases[0]}`);
  }
  assert.deepEqual(lineaDeAlias(['Dìwö', 'Diwo', 'WASP-17'], 'Diwo'), ['WASP-17']);
  assert.equal(lineaDeAlias(['Absolutno', 'XO-5'], 'Absolutno')[0], 'XO-5');
  // Las formas sin tildes siguen encontrando su estrella.
  assert.equal(primeros('Batsu')[0], 9002630);
  assert.equal(primeros('Diwo')[0], 9003498);
  // En los datos, ningún alias es el título salvo por mayúsculas.
  const filasDatos = leer('public/data/star-search.json');
  assert.equal(filasDatos.filter(([, n]) => n.slice(1).some(a => a.toLowerCase() === n[0].toLowerCase())).length, 0);
});
