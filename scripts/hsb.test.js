import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'csv-parse/sync';
import {
  COLUMNAS, COMPANERAS_CSV, HSB_NUEVO_BASE, REGISTRO_CSV, asignarV40, conPrefijoGl, conciliar, leerRegistro,
  partesGl, quitarGaiaRepetidos, quitarNumerosTomados, serializarRegistro,
} from './catalog/build_hsb.js';
import { numeradorDeAnfitrionas } from './catalog/build_added_hosts.js';

const contenido = fs.readFileSync(REGISTRO_CSV, 'utf8');
const registro = leerRegistro(contenido);
const activas = registro.filter(f => f.estado === 'activa');
const porHsb = new Map(registro.map(f => [f.hsb, f]));
const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));
// Primera versión del registro (solo AT-HYG v3.2 y anfitrionas).
const PRIMERA_VERSION = 'ae0565b';

const registroDe = commit => {
  try {
    return leerRegistro(execFileSync('git', ['show', `${commit}:${REGISTRO_CSV.replace(/^\.\//, '')}`],
      { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return null; // sin historial disponible
  }
};

test('cada estrella de Hoshi tiene su número HSB igual a su i', () => {
  for (const s of stars) {
    const f = porHsb.get(s.i);
    assert.ok(f && f.estado === 'activa', `la estrella ${s.i} no está activa en el registro`);
    assert.equal(f.origen, s.dataOrigin === 'exoplanet-host' ? 'anfitriona' : 'athyg');
  }
  // El resto de las activas son las filas que entraron desde AT-HYG v4.0.
  assert.ok(activas.filter(f => f.origen === 'athyg_v40').length + stars.length === activas.length);
});

test('ningún número HSB repetido y el registro va ordenado', () => {
  assert.equal(new Set(registro.map(f => f.hsb)).size, registro.length);
  assert.ok(registro.every((f, k) => Number.isInteger(f.hsb) && (k === 0 || registro[k - 1].hsb < f.hsb)));
  assert.ok(registro.every(f => ['athyg', 'anfitriona', 'athyg_v40'].includes(f.origen) && ['activa', 'retirada'].includes(f.estado)));
  assert.equal(contenido.split('\n')[0], COLUMNAS.join(','));
});

test('ningún par de estrellas activas comparte athyg_v40 ni Gaia DR3', () => {
  for (const c of ['athyg_v40', 'gaia_dr3']) {
    const valores = activas.map(f => f[c]).filter(Boolean);
    assert.equal(new Set(valores).size, valores.length, c);
  }
  const lista = [{ i: 1, gaia_dr3: '7' }, { i: 2, gaia_dr3: '7' }, { i: null, nueva: true, gaia_dr3: '8' }, { i: 3, gaia_dr3: '8' }];
  quitarGaiaRepetidos(lista);
  assert.deepEqual(lista.map(s => s.gaia_dr3), ['', '', '', '8']);
  assert.deepEqual(lista.map(s => s.gaia_revisar || ''), ['1', '1', '1', '']);
});

test('AT-HYG v4.0: Betelgeuse, casos especiales y anfitrionas enlazadas', () => {
  assert.equal(porHsb.get(463434).athyg_v40, '464934');
  // p Eridani: cada componente con la fila de su TYC, Gaia y letra de Gliese.
  assert.equal(porHsb.get(125360).athyg_v40, '125781');
  assert.equal(porHsb.get(125364).athyg_v40, '125782');
  // Gl 277A está dos veces en la v3.2: la fila con HIP y TYC se queda la de la v4.0.
  assert.equal(porHsb.get(727498).athyg_v40, '729466');
  assert.equal(porHsb.get(727499).athyg_v40, '');
  assert.equal(porHsb.get(1788330).athyg_v40, '');
  assert.equal(porHsb.get(1788330).estado, 'activa');
  assert.equal(porHsb.get(1246557).estado, 'activa');
  for (const [a, filaA, filaB] of [[1272607, '1275907', '1275913'], [1971943, '1977080', '1977081'], [2430418, '2436523', '2436524']]) {
    assert.equal(porHsb.get(a).athyg_v40, filaA);
    const b = activas.find(f => f.athyg_v40 === filaB);
    assert.ok(b && b.hsb >= HSB_NUEVO_BASE && b.primaria_hsb === String(a), `compañera de ${a}`);
  }
  assert.equal(porHsb.get(9000017).athyg_v40, '932163');
  assert.equal(porHsb.get(9000105).athyg_v40, '1711650');
  const siriusB = activas.find(f => f.athyg_v40 === '586689');
  assert.ok(siriusB.hsb >= HSB_NUEVO_BASE && siriusB.gl === 'Gl 244B' && siriusB.comp === 'B' && siriusB.primaria_hsb === '584955');
});

test('las estrellas nuevas van desde 100 000 000 y traen fila v4.0', () => {
  const nuevas = registro.filter(f => f.origen === 'athyg_v40');
  assert.ok(nuevas.length > 0);
  assert.ok(nuevas.every(f => f.hsb >= HSB_NUEVO_BASE && f.athyg_v40 && !f.athyg_v32));
  assert.ok(registro.filter(f => f.origen !== 'athyg_v40').every(f => f.hsb < HSB_NUEVO_BASE));
});

test('ningún número de la primera versión cambió ni desapareció', () => {
  const primera = registroDe(PRIMERA_VERSION);
  if (!primera) return;
  for (const f of primera) {
    const g = porHsb.get(f.hsb);
    assert.ok(g, `el número ${f.hsb} desapareció del registro`);
    assert.equal(g.origen, f.origen);
    assert.equal(g.athyg_v32, f.athyg_v32, `cambió la estrella de AT-HYG del número ${f.hsb}`);
    assert.equal(g.alta, f.alta);
  }
});

test('el registro solo crece respecto de la versión commiteada', () => {
  const anterior = registroDe('HEAD');
  if (!anterior) return;
  for (const f of anterior) {
    const g = porHsb.get(f.hsb);
    assert.ok(g, `el número ${f.hsb} desapareció del registro`);
    assert.equal(g.alta, f.alta, `cambió la fecha de alta de ${f.hsb}`);
  }
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
  // Otra versión: la estrella 5 cambia de id pero conserva HIP; la 6 desaparece; llega una nueva sin `i`.
  const despues = [
    { i: 700, origen: 'athyg', athyg_v32: '700', hip: '10', hd: '20', tyc: '1-2-1', gaia_dr3: '99', nombre: 'Uno' },
    { i: null, origen: 'athyg_v40', athyg_v40: '701', hip: '', hd: '', tyc: '3-4-1', gaia_dr3: '', nombre: '' },
  ];
  const { filas, nuevas, retiradas } = conciliar(primera, despues, { fecha: '2026-12-01' });
  assert.deepEqual(filas.map(f => [f.hsb, f.estado]), [[5, 'activa'], [6, 'retirada'], [HSB_NUEVO_BASE, 'activa']]);
  assert.equal(nuevas.length, 1);
  assert.equal(retiradas.length, 1);
  assert.equal(filas[0].alta, '2026-11-07');
  const texto = serializarRegistro(filas);
  const otra = conciliar(leerRegistro(texto), despues, { fecha: '2027-01-01' });
  assert.equal(serializarRegistro(otra.filas), texto);
});

test('la fila v4.0 se elige por números propios de cada componente', () => {
  // Como p Eridani: la v4.0 pasó el HIP a la otra componente; mandan TYC, Gaia, HD y Gliese.
  const a = { i: 1, origen: 'athyg', hip: '7751', hd: '10360', tyc: '8-1-2', gaia_v32: '632', gl: 'Gl 66B', pos: { ra: 0, dec: 0 } };
  const b = { i: 2, origen: 'athyg', hip: '', hd: '10361', tyc: '8-1-1', gaia_v32: '760', gl: 'Gl 66A', pos: { ra: 0, dec: 0 } };
  const f1 = { id: 11, hip: '', hd: '10360', tyc: '8-1-2', gaia: '632', gl: '66B', pos: { ra: 0, dec: 0 }, mag: 5 };
  const f2 = { id: 12, hip: '7751', hd: '10361', tyc: '8-1-1', gaia: '760', gl: '66A', pos: { ra: 0, dec: 0 }, mag: 5 };
  const asignacion = asignarV40([a, b], [f1, f2]);
  assert.equal(asignacion.get(a), f1);
  assert.equal(asignacion.get(b), f2);
  assert.deepEqual(partesGl('GJ 3727A'), { numero: '3727', comp: 'A' });
  assert.equal(conPrefijoGl('66B'), 'Gl 66B');
  assert.equal(conPrefijoGl('3728B'), 'GJ 3728B');
  const nueva = { hip: '7751', tyc: '9-9-2', gaia_dr3: '5' };
  quitarNumerosTomados([a], [nueva], new Set(['5']));
  assert.deepEqual([nueva.hip, nueva.tyc, nueva.gaia_dr3, nueva.gaia_revisar], ['', '9-9-2', '', '1']);
});

test('las compañeras dibujadas apuntan a estrellas nuevas del registro', () => {
  const filas = parse(fs.readFileSync(COMPANERAS_CSV, 'utf8'), { columns: true });
  const sistemas = JSON.parse(fs.readFileSync('data/processed/star_systems.json', 'utf8'));
  assert.ok(filas.length > 1000);
  for (const f of filas.filter(f => f.hsb_nuevo)) {
    const g = porHsb.get(Number(f.hsb_nuevo));
    assert.ok(g && g.origen === 'athyg_v40' && g.athyg_v40 === f.athyg_v40, f.hsb_nuevo);
  }
  const sirio = filas.find(f => f.sistema_hsb === '584955' && f.companera === 'B');
  assert.equal(porHsb.get(Number(sirio.hsb_nuevo)).gl, 'Gl 244B');
  assert.ok(filas.filter(f => f.companera).every(f => sistemas[f.sistema_hsb]?.comps.some(c => c.n === f.companera && c.cid === undefined)));
});

test('las anfitrionas toman su número del registro', () => {
  const added = JSON.parse(fs.readFileSync('data/catalog/added_hosts.json', 'utf8')).stars;
  const numero = numeradorDeAnfitrionas(registro);
  for (const s of added) assert.equal(numero({ h: s.h, gaia: s.gaia }), s.i, s.h);
  assert.equal(numero({ h: 'Anfitriona nueva', gaia: null }), registro[registro.length - 1].hsb + 1);
});
