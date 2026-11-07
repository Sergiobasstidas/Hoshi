import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { COLUMNAS, HSB_NUEVO_BASE, REGISTRO_CSV, conciliar, leerRegistro, quitarGaiaRepetidos, serializarRegistro } from './catalog/build_hsb.js';
import { numeradorDeAnfitrionas } from './catalog/build_added_hosts.js';

const contenido = fs.readFileSync(REGISTRO_CSV, 'utf8');
const registro = leerRegistro(contenido);
const activas = registro.filter(f => f.estado === 'activa');
const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));

test('cada estrella de Hoshi tiene su número HSB igual a su i', () => {
  const porHsb = new Map(activas.map(f => [f.hsb, f]));
  assert.equal(activas.length, stars.length);
  for (const s of stars) {
    const f = porHsb.get(s.i);
    assert.ok(f, `la estrella ${s.i} no está activa en el registro`);
    assert.equal(f.origen, s.dataOrigin === 'exoplanet-host' ? 'anfitriona' : 'athyg');
  }
});

test('ningún número HSB repetido y el registro va ordenado', () => {
  assert.equal(new Set(registro.map(f => f.hsb)).size, registro.length);
  assert.ok(registro.every((f, k) => Number.isInteger(f.hsb) && (k === 0 || registro[k - 1].hsb < f.hsb)));
  assert.ok(registro.every(f => ['athyg', 'anfitriona'].includes(f.origen) && ['activa', 'retirada'].includes(f.estado)));
});

test('ningún Gaia DR3 en dos estrellas activas', () => {
  const gaia = activas.map(f => f.gaia_dr3).filter(Boolean);
  assert.equal(new Set(gaia).size, gaia.length);
  const lista = [{ i: 1, gaia_dr3: '7' }, { i: 2, gaia_dr3: '7' }, { i: 3, gaia_dr3: '8' }];
  assert.equal(quitarGaiaRepetidos(lista).length, 1);
  assert.deepEqual(lista.map(s => s.gaia_dr3), ['', '', '8']);
});

test('volver a conciliar el registro consigo mismo da el mismo archivo', () => {
  const estrellas = activas.map(f => ({ ...f, i: f.hsb }));
  const { filas, nuevas, retiradas } = conciliar(registro, estrellas, { fecha: '2099-01-01' });
  assert.equal(nuevas.length, 0);
  assert.equal(retiradas.length, 0);
  assert.equal(serializarRegistro(filas), contenido);
});

test('nuevas desde 100 000 000, retiradas sin borrar y sin renumerar', () => {
  const base = [
    { i: 5, origen: 'athyg', athyg_v32: '5', hip: '10', hd: '20', tyc: '1-2-1', gaia_dr3: '99', nombre: 'Uno' },
    { i: 6, origen: 'athyg', athyg_v32: '6', hip: '11', hd: '', tyc: '', gaia_dr3: '', nombre: '' },
  ];
  const primera = conciliar([], base, { fecha: '2026-11-07' }).filas;
  assert.deepEqual(primera.map(f => f.hsb), [5, 6]);
  // Otra versión: la estrella 5 cambia de id pero conserva HIP; la 6 desaparece; llega una nueva.
  const despues = [
    { i: 700, origen: 'athyg', athyg_v32: '700', hip: '10', hd: '20', tyc: '1-2-1', gaia_dr3: '99', nombre: 'Uno' },
    { i: 701, origen: 'athyg', athyg_v32: '701', hip: '', hd: '', tyc: '3-4-1', gaia_dr3: '', nombre: '' },
  ];
  const { filas, nuevas, retiradas } = conciliar(primera, despues, { fecha: '2026-12-01' });
  assert.deepEqual(filas.map(f => [f.hsb, f.estado]), [[5, 'activa'], [6, 'retirada'], [HSB_NUEVO_BASE, 'activa']]);
  assert.equal(nuevas.length, 1);
  assert.equal(retiradas.length, 1);
  assert.equal(filas[0].alta, '2026-11-07');
  const texto = serializarRegistro(filas);
  const otra = conciliar(leerRegistro(texto), despues, { fecha: '2027-01-01' });
  assert.equal(serializarRegistro(otra.filas), texto);
  assert.equal(texto.split('\n')[0], COLUMNAS.join(','));
});

test('las anfitrionas toman su número del registro', () => {
  const added = JSON.parse(fs.readFileSync('data/catalog/added_hosts.json', 'utf8')).stars;
  const numero = numeradorDeAnfitrionas(registro);
  for (const s of added) assert.equal(numero({ h: s.h, gaia: s.gaia }), s.i, s.h);
  assert.equal(numero({ h: 'Anfitriona nueva', gaia: null }), Math.max(HSB_NUEVO_BASE, ...registro.slice(-1).map(f => f.hsb + 1)));
});

test('el registro solo crece respecto de la versión commiteada', () => {
  let anterior;
  try {
    anterior = execFileSync('git', ['show', `HEAD:${REGISTRO_CSV.replace(/^\.\//, '')}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return; // aún no hay versión commiteada
  }
  const actual = new Map(registro.map(f => [f.hsb, f]));
  for (const f of leerRegistro(anterior)) {
    const g = actual.get(f.hsb);
    assert.ok(g, `el número ${f.hsb} desapareció del registro`);
    assert.equal(g.alta, f.alta, `cambió la fecha de alta de ${f.hsb}`);
    if (f.estado === 'retirada') assert.ok(['retirada', 'activa'].includes(g.estado));
  }
});
