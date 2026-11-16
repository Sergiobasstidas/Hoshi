import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nombreParaMostrar, rangoNombre, sumarVariablesEnOrden } from '../src/scene/nombresEstrella.js';
import { GENITIVOS, buildSearchIndex, searchStars } from '../src/scene/starSearch.js';

// Nombres como los arma el navegador (src/indiceBusqueda.js): la fila del buscador más sus nombres de variable.
const filas = JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8'));
const variables = new Map(JSON.parse(fs.readFileSync('public/data/star-search-variables.json', 'utf8')));
const nombres = new Map(filas.map(([i, alias, principales = 0]) => [i, variables.has(i) ? sumarVariablesEnOrden(alias, variables.get(i), principales) : alias]));
const titulo = i => nombres.get(i)[0];

test('el título sigue el orden propio, Bayer, Flamsteed, sistema de NASA, variable con letras, catálogos', () => {
  assert.equal(titulo(584955), 'Sirius'); // nombre propio
  assert.equal(titulo(1460), 'Tau Phe'); // Bayer antes que HIP 88
  assert.equal(titulo(2536), '29 Psc'); // Flamsteed antes que HIP 145
  assert.equal(titulo(130), 'Z Peg'); // variable con letras antes que HIP 8
  assert.equal(titulo(661), 'HIP 40'); // catálogo antes que V463 Cep
  assert.ok(nombres.get(661).includes('V463 Cep'));
});

test('61 Cygni, Kepler-90 y HR 8799 llevan su nombre conocido', () => {
  assert.equal(titulo(2276178), '61 Cyg'); // antes «V1803 Cyg»
  assert.equal(titulo(2276255), '61 Cyg B');
  assert.ok(nombres.get(2276178).includes('61 Cyg A') && nombres.get(2276178).indexOf('V1803 Cyg') > nombres.get(2276178).indexOf('HD 201091'));
  assert.equal(titulo(9000678), 'Kepler-90'); // NASA la llama KOI-351, pero sus planetas son Kepler-90
  assert.equal(titulo(2483067), 'HR 8799'); // antes «V342 Peg»
  const indice = buildSearchIndex([...nombres]);
  for (const consulta of ['61 Cygni', '61 Cyg', '61 Cyg A']) assert.equal(searchStars(indice, consulta)[0].id, 2276178, consulta);
  assert.equal(searchStars(indice, '61 Cyg B')[0].id, 2276255);
});

test('rango de cada tipo de nombre', () => {
  const contexto = { propios: new Set(['Sirius']), sistemas: new Set(['Kepler-90']) };
  const casos = [['Sirius', 0], ['alf Cen', 1], ['Alp CMa', 1], ['Mu Mus', 1], ['61 Cyg', 2], ['Kepler-90', 3], ['R Leo', 4], ['MU Mus', 4],
    ['HIP 1', 5], ['HD 1', 5], ['Gl 820A', 5], ['TYC 1-2-1', 5], ['V1803 Cyg', 6], ['KOI-351', 6], ['TOI-214', 6], ['AT-HYG 5', 7], ['HSB 1', 7]];
  for (const [nombre, rango] of casos) assert.equal(rangoNombre(nombre, contexto), rango, nombre);
});

test('el título se muestra con la letra griega y el genitivo completos; variables, catálogos y nombres propios no cambian', () => {
  const mostrar = nombre => nombreParaMostrar(nombre, GENITIVOS);
  assert.equal(mostrar(titulo(2276178)), '61 Cygni');
  assert.equal(mostrar(titulo(2276255)), '61 Cygni B');
  assert.equal(mostrar(titulo(130695)), 'Tau Ceti');
  assert.equal(mostrar(titulo(584955)), 'Sirius');
  for (const [corto, largo] of [['eps Eri', 'Epsilon Eridani'], ['Xi Sco', 'Xi Scorpii'], ['29 Psc', '29 Piscium'], ['Rho-2 Ari', 'Rho² Arietis'], ['alf CMa', 'Alpha Canis Majoris']]) assert.equal(mostrar(corto), largo);
  for (const igual of ['V1803 Cyg', 'YY Psc', 'R Leo', 'MU Mus', 'V463 Cep', 'HD 201091', 'HIP 40', 'Gl 820A', 'GJ 1018', 'TOI-244', 'HR 8799', 'Kepler-90']) assert.equal(mostrar(igual), igual);
  // La búsqueda con la forma corta sigue encontrándola.
  assert.equal(searchStars(buildSearchIndex([...nombres]), '61 Cyg')[0].id, 2276178);
});
