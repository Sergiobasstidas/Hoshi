import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { VEREDICTOS, UMBRAL } from './catalog/auditoria/chequeos.js';
import { leerTipo, rangoMv } from './catalog/auditoria/magnitudes.js';

const gz = ruta => parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'), { columns: true });
const difs = gz('data/catalog/hsb_auditoria.csv.gz');
const identidad = gz('data/catalog/hsb_identidad.csv.gz');
const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));
const porId = new Map(stars.map(s => [s.i, s]));

test('auditoría: ninguna diferencia queda sin veredicto', () => {
  assert.ok(difs.length > 0);
  const sin = difs.filter(d => !VEREDICTOS.includes(d.veredicto) || !d.regla || !d.tipo);
  assert.equal(sin.length, 0, sin.slice(0, 3).map(d => `${d.hsb} ${d.tipo}`).join('; '));
});

test('identidad: cada estrella tiene fila en cada fuente donde debería estar (enlazada o sin enlace con motivo)', () => {
  const filas = new Map();
  for (const r of identidad) { const k = `${r.hsb}|${r.fuente}`; filas.set(k, r); }
  const sistemas = JSON.parse(fs.readFileSync('data/processed/star_systems.json', 'utf8'));
  const dibujadas = new Set(Object.keys(sistemas).map(Number));
  for (const s of Object.values(sistemas)) for (const c of s.comps) if (c.cid !== undefined) dibujadas.add(c.cid);
  const faltan = [];
  for (const s of stars) {
    if (s.i === 0 || !(s.d > 0)) continue;
    const V = s.m + 5 * Math.log10(s.d / 10);
    if (V >= UMBRAL.esperaGaiaV[0] && V <= UMBRAL.esperaGaiaV[1] && s.i < 100_000_000 && !filas.has(`${s.i}|Gaia DR3`)) faltan.push(`${s.i} Gaia`);
    if (s.d < UMBRAL.esperaCns5Pc && !filas.has(`${s.i}|CNS5`)) faltan.push(`${s.i} CNS5`);
    if (dibujadas.has(s.i) && !filas.has(`${s.i}|WDS`)) faltan.push(`${s.i} WDS`);
  }
  assert.equal(faltan.length, 0, faltan.slice(0, 5).join('; '));
  for (const r of identidad) if (!r.id) assert.match(r.motivo, /^sin enlace: /, `${r.hsb} ${r.fuente}`);
});

test('distancias: ninguna de Gliese-Jahreiss u otra fuente vieja en uso si hay una medida directa mejor enlazada', () => {
  const viejas = difs.filter(d => d.tipo === 'DIST-ESCALERA' && /dist_src (GJ|N|OTHER)\)/.test(d.fuente_actual));
  assert.equal(viejas.length, 0, viejas.map(d => d.nombre).join(', '));
});

test('distancias de referencia: Alula Australis A y B, Sirio y α Centauri, sin diferencias de distancia', () => {
  const casos = [[1175645, 8.73, 0.01], [1175646, 8.73, 0.01], [584955, 2.639, 0.002], [1451193, 1.338, 0.002]];
  for (const [i, d, tol] of casos) {
    assert.ok(Math.abs(porId.get(i).d - d) < tol, `${i}: ${porId.get(i).d}`);
    assert.ok(!difs.some(x => Number(x.hsb) === i && /^DIST-(ESCALERA|SIN-MEDIDA)$/.test(x.tipo)), `${i} con diferencia de distancia`);
  }
});

test('derivados: x, y, z y magnitud absoluta coinciden con lo recalculado', () => {
  const malos = difs.filter(d => d.tipo === 'DERIVADO' && (d.dato === 'x, y, z' || d.dato === 'magnitud absoluta'));
  assert.equal(malos.length, 0, malos.slice(0, 3).map(d => `${d.nombre} ${d.dato}`).join('; '));
});

test('tabla de magnitudes típicas: tipos, clases y rangos', () => {
  assert.deepEqual(leerTipo('K0IV-V'), { letra: 'K', n: 0, clases: ['IV', 'V'] });
  assert.equal(leerTipo('gK0').clases[0], 'III');
  assert.deepEqual(rangoMv('DA2'), [9, 16]);
  const sol = rangoMv('G2V');
  assert.ok(sol[0] < 4.83 && 4.83 < sol[1]);
  // Sin clase: el rango cubre de supergigante a enana.
  const m3 = rangoMv('M3');
  assert.ok(m3[0] < -5 && m3[1] > 12);
});
