import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { SALIDA, brilloCalza, clave, estrellasCapa } from './catalog/capa_nombres.js';
import { calzaSinTopeDeBrillo, movimientoCoincide } from './catalog/criterios_enlace.js';

const texto = zlib.gunzipSync(fs.readFileSync(SALIDA)).toString('utf8');
const datos = parse(texto, { columns: true }).map(f => ({ hsb: Number(f.hsb), gaia: f.gaia_dr3, nombres: f.nombres.split('|') }));

test('hsb_capa_nombres: cada fila es una estrella de la capa con su Gaia DR3', () => {
  assert.ok(texto.startsWith('hsb,gaia_dr3,nombres\n'));
  const capa = new Map(estrellasCapa().map(e => [e.hsb, e.gaia]));
  for (const { hsb, gaia } of datos) {
    assert.ok(capa.has(hsb), `HSB ${hsb} no está en la capa`);
    assert.equal(capa.get(hsb), gaia, `HSB ${hsb}`);
  }
  assert.equal(new Set(datos.map(d => d.hsb)).size, datos.length, 'HSB repetido');
  const orden = datos.map(d => d.hsb);
  assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
});

test('hsb_capa_nombres: ningún nombre se repite ni es de una estrella del catálogo principal', () => {
  const vistos = new Map();
  for (const { hsb, nombres } of datos) {
    assert.ok(nombres.length > 0 && nombres.every(Boolean), `HSB ${hsb} sin nombres`);
    for (const n of nombres) {
      assert.ok(!/^TIC\b/.test(n), `TIC en la capa: ${n}`);
      const k = clave(n);
      assert.ok(!vistos.has(k), `«${n}» en HSB ${vistos.get(k)} y ${hsb}`);
      vistos.set(k, hsb);
    }
  }
  for (const f of ['star-search.json', 'star-search-variables.json', 'star-search-numeros.json']) {
    for (const [i, alias] of JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8'))) {
      for (const a of alias) assert.ok(!vistos.has(clave(a)), `«${a}» es de la estrella ${i} del catálogo y de HSB ${vistos.get(clave(a))} en la capa`);
    }
  }
});

test('supergigantes rojas y variables: el nombre de SIMBAD se acepta a ≤ 1″ con el mismo movimiento propio, sin tope de ΔV', () => {
  const igualPm = movimientoCoincide([-1.5, -2.0], [-1.4, -2.1]);
  // UY Sct (variable, V SIMBAD 11,2 / V Gaia 9,43), KY Cyg (BP−RP 5,19, fuera de Riello et al. 2021) y SU Per.
  for (const caso of [{ vSimbad: 11.2, vGaia: 9.43, bpRp: 4.17, variable: true }, { vSimbad: 13.5, vGaia: 10.79, bpRp: 5.19, variable: true },
    { vSimbad: 13.5, vGaia: 10.79, bpRp: 5.19, variable: false }, { vSimbad: 9.4, vGaia: 7.51, bpRp: 3.0, variable: true }]) {
    assert.equal(brilloCalza({ ...caso, separacion: 0.3, unObjeto: true, dpm: igualPm.dpm, pmOk: igualPm.ok }), true, JSON.stringify(caso));
  }
  // Se sigue rechazando: no variable y dentro del rango; a más de 1″; otro movimiento propio; sin movimiento propio de
  // SIMBAD para comparar; dos objetos de SIMBAD.
  const base = { vSimbad: 11.2, vGaia: 9.43, bpRp: 4.17, separacion: 0.3, unObjeto: true, variable: true, dpm: igualPm.dpm, pmOk: igualPm.ok };
  const otroPm = movimientoCoincide([-1.5, -2.0], [40, 30]);
  for (const cambio of [{ variable: false }, { separacion: 1.4 }, { dpm: otroPm.dpm, pmOk: otroPm.ok }, { dpm: null, pmOk: true }, { unObjeto: false }]) {
    assert.equal(brilloCalza({ ...base, ...cambio }), false, JSON.stringify(cambio));
  }
  // Mismo criterio que la revisión de enlaces a Gaia (gaia_revisar.js): 10 mas/año o 20 %.
  assert.equal(movimientoCoincide([100, 0], [119, 0]).ok, true);
  assert.equal(movimientoCoincide([100, 0], [125, 0]).ok, false);
  assert.equal(movimientoCoincide([NaN, NaN], [5, 5]).dpm, null);
  assert.equal(calzaSinTopeDeBrillo({ separacion: 1, dpm: 2, pmOk: true }), true);
  // En los datos: KY Cyg y SU Per tienen su nombre en la capa (UY Sct pasó al catálogo, build_famosas.js).
  const filas = new Map(parse(zlib.gunzipSync(fs.readFileSync(SALIDA)).toString('utf8'), { columns: true }).map(f => [f.hsb, f]));
  for (const [hsb, nombre] of [['100282843', 'KY Cyg'], ['100079023', 'SU Per']]) {
    assert.ok(filas.get(hsb)?.nombres.split('|').includes(nombre), `${hsb}: ${filas.get(hsb)?.nombres}`);
  }
});
