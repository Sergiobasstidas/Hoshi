import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { filaCns5, indiceCns5, paralajeMedida } from './catalog/fusion.js';

const fila = (gj, comp, extra = {}) => ({ gj_id: gj, component_id: comp, gaia_edr3_id: '', primary_flag: '1', ra: '10', dec: '20', epoch: '2000',
  parallax: '100', parallax_error: '0.5', parallax_bibcode: '2006AJ....132.2360H', ...extra });
// Estrella a 10 pc en (10°, 20°).
const en = (ra, dec, d = 10, m = 10) => {
  const a = ra * Math.PI / 180, b = dec * Math.PI / 180;
  return { x: d * Math.cos(b) * Math.cos(a), y: d * Math.cos(b) * Math.sin(a), z: d * Math.sin(b), d, m };
};

test('CNS5: enlace por nombre GJ, por el sistema que contiene la componente y por la primaria', () => {
  const cns5 = indiceCns5([fila('423', 'ABCD'), fila('423', 'E', { primary_flag: '0' }), fila('7', 'A'), fila('7', 'B', { primary_flag: '0', parallax: '90' })]);
  assert.equal(filaCns5({ gl: 'Gl 423A' }, cns5).component_id, 'ABCD');
  assert.equal(filaCns5({ gl: 'Gl 423B' }, cns5).component_id, 'ABCD');
  assert.equal(filaCns5({ gl: 'GJ 7B' }, cns5).component_id, 'B');
  assert.equal(filaCns5({ gl: 'GJ 7' }, cns5).component_id, 'A');
  assert.equal(filaCns5({ gl: 'Gl 423C' }, cns5).component_id, 'ABCD');
  assert.equal(filaCns5({ gl: 'Gl 424' }, cns5), null);
});

test('CNS5: no se usa lejos de la estrella, con un Gaia en duda ni con Gaia saturado', () => {
  const cns5 = indiceCns5([fila('423', 'ABCD'), fila('9', '', { gaia_edr3_id: '55', parallax_bibcode: '2020yCat.1350....0G' })]);
  const vacio = { gaia: new Map(), hip: new Map(), cns5 };
  assert.equal(paralajeMedida({ gl: 'Gl 423A' }, vacio, en(10, 20)).plx, 100);
  assert.equal(paralajeMedida({ gl: 'Gl 423A' }, vacio, en(10, 20.05)), null);
  assert.equal(paralajeMedida({ gl: 'GJ 9', gaia_revisar: '1' }, vacio, en(10, 20)), null);
  assert.equal(paralajeMedida({ gl: 'GJ 9' }, vacio, en(10, 20)).fuente, 'CNS5 (2020yCat.1350....0G)');
  assert.equal(paralajeMedida({ gl: 'GJ 9' }, vacio, en(10, 20, 10, 3)), null);
});

test('distancias de referencia: Alula Australis A y B, Sirio y α Centauri', () => {
  const stars = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));
  const fuentes = new Map(parse(zlib.gunzipSync(fs.readFileSync('data/catalog/hsb_fuentes.csv.gz')).toString('utf8'), { columns: true }).map(f => [Number(f.hsb), f]));
  const cerca = (i, d, tol) => assert.ok(Math.abs(stars.get(i).d - d) < tol, `${stars.get(i).n ?? i}: ${stars.get(i).d} pc`);
  for (const i of [1175645, 1175646]) { cerca(i, 8.73, 0.01); assert.match(fuentes.get(i).fuente_d, /^CNS5/); }
  const nombrada = n => [...stars.values()].find(s => s.n === n).i;
  cerca(nombrada('Sirius'), 2.639, 0.002);
  cerca(nombrada('Rigil Kentaurus'), 1.338, 0.002);
  // Ninguna distancia en uso sale de Gliese-Jahreiss si CNS5 tiene una paralaje medida con error ≤ 10 % (EZ Aqr: 866ABC).
  assert.match(fuentes.get(2439425).fuente_d, /^CNS5/);
});

test('las separaciones de Alula Australis siguen la distancia nueva (separación angular × distancia)', () => {
  const sistema = JSON.parse(fs.readFileSync('data/processed/star_systems.json', 'utf8'))['1175645'];
  const d = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).find(s => s.i === 1175645).d;
  const b = sistema.comps.find(c => c.n === 'B'), dd = sistema.comps.find(c => c.n === 'D');
  assert.ok(Math.abs(b.a / d - 2.5044) < 0.001, `a = ${b.a} UA`);
  assert.ok(Math.abs(dd.rho / d - 511.4) < 0.1, `rho = ${dd.rho} UA`);
});
