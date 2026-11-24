import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { SALIDA, estrellasCapa } from './catalog/capa_nombres.js';
import { idsDesdeCapa } from './catalog/desde_capa.js';
import { ordenNombres, tipoNombre } from '../src/scene/capaNombres.js';
import { normalizeStarQuery } from '../src/scene/starSearch.js';

// Los archivos de la app se leen del disco, como si los pidiera el navegador.
globalThis.fetch = async url => ({ ok: fs.existsSync(`public${url}`), json: async () => JSON.parse(fs.readFileSync(`public${url}`, 'utf8')) });
const { buscarEnCapa, datosCapa, nombrePrincipal } = await import('../src/capaBusqueda.js');

const CARPETA = 'public/data/capa';
const leer = nombre => JSON.parse(fs.readFileSync(`${CARPETA}/${nombre}`, 'utf8'));
const archivos = prefijo => fs.readdirSync(CARPETA).filter(f => f.startsWith(prefijo)).sort((a, b) => Number(a.match(/\d+/)) - Number(b.match(/\d+/)));
const capa = estrellasCapa();
const indiceDe = new Map(capa.map((e, k) => [e.hsb, k]));
const filas = parse(zlib.gunzipSync(fs.readFileSync(SALIDA)).toString('utf8'), { columns: true }).map(f => ({ hsb: Number(f.hsb), gaia: f.gaia_dr3, nombres: f.nombres.split('|') }));
// Fuentes de la capa que pasaron al catálogo (miembros de cúmulos globulares y famosas; número de lote «igual a» la
// estrella nueva): siguen en su lugar, pero el buscador no las tiene (build_capa_busqueda.js).
const miembros = idsDesdeCapa();
const { leerEnlaces } = await import('./catalog/enlaces_registro.js');
const lotesOcultos = new Set(leerEnlaces().filter(f => f.campo === 'igual_a' && miembros.has(Number(f.valor))).map(f => Number(f.hsb)));
const oculta = k => lotesOcultos.has(capa[k].hsb);

test('los archivos del buscador de la capa calzan con hsb_capa_nombres.csv.gz y con la capa', () => {
  const m = leer('manifiesto.json');
  assert.equal(m.n, capa.length);
  // Datos en orden de Gaia DR3: source_id entero en la primera fila de cada trozo y diferencias después.
  const datos = archivos('datos-').flatMap(f => {
    const d = leer(f);
    let previo = 0n;
    return d.k.map((k, j) => {
      const v = d.s[j];
      const s = v === null ? null : String(previo = typeof v === 'string' || !j || previo === 0n ? BigInt(v) : previo + BigInt(v));
      if (v === null) previo = 0n;
      return { k, h: d.h[j], s, n: d.n[j] };
    });
  });
  assert.equal(datos.length, capa.length);
  assert.deepEqual(datos.map(d => d.k).sort((a, b) => a - b), capa.map((_, k) => k));
  for (const d of datos) { assert.equal(d.h, capa[d.k].hsb); assert.equal(d.s, oculta(d.k) ? null : capa[d.k].gaia); }
  const conGaia = datos.filter(d => d.s).map(d => BigInt(d.s));
  assert.ok(conGaia.every((s, j) => !j || s > conGaia[j - 1]), 'datos fuera del orden de Gaia DR3');
  archivos('datos-').forEach((f, j) => assert.equal(m.gaia[j], datos[j * m.porDatos].s || ''));
  const filaDe = new Map(datos.map((d, f) => [d.k, f]));
  const esperados = new Map(filas.filter(f => !lotesOcultos.has(f.hsb)).map(f => [indiceDe.get(f.hsb), ordenNombres(f.nombres).join('|')]));
  for (const d of datos) assert.equal(d.n, esperados.get(d.k) || '', `índice ${d.k}`);
  // Cada nombre está en su archivo de búsqueda con la fila de su estrella.
  const porNombre = new Map();
  for (const f of [...archivos('nombres-'), 'propios.json']) { const d = leer(f); d.n.forEach((n, k) => porNombre.set(n, d.i[k])); }
  const porTyc = new Map();
  for (const f of archivos('tyc-')) { const d = leer(f); d.t.forEach((t, k) => porTyc.set(`TYC ${t}`, d.i[k])); }
  let cuenta = 0;
  for (const f of filas.filter(f => !lotesOcultos.has(f.hsb))) for (const n of f.nombres) {
    assert.equal((tipoNombre(n) === 'TYC' ? porTyc : porNombre).get(n), filaDe.get(indiceDe.get(f.hsb)), n);
    cuenta++;
  }
  assert.equal(porNombre.size + porTyc.size, cuenta);
  // HSB de toda la capa (como diferencias), cada uno con su fila.
  const hsb = archivos('hsb-').flatMap(f => { const d = leer(f); let h = 0; return d.h.map((v, k) => [h += v, d.i[k]]); });
  assert.equal(hsb.length, capa.length);
  for (const [h, f] of hsb) assert.equal(f === -1 ? lotesOcultos.has(h) : datos[f].h === h, true, `HSB ${h}`);
  assert.ok(![...porNombre.keys(), ...porTyc.keys()].some(n => /^TIC\b/.test(n)));
});

test('el buscador encuentra una estrella de la capa por HD, BD con signo, TYC, Gaia DR3 y HSB', async () => {
  const fila = filas.find(f => f.nombres.some(n => /^HD \d+$/.test(n)) && f.nombres.some(n => /^BD[+-]/.test(n)) && f.nombres.some(n => /^TYC /.test(n)));
  const k = indiceDe.get(fila.hsb);
  const fil = (await buscarEnCapa(`HSB ${fila.hsb}`))[0].capa.fila;
  const primera = async consulta => (await buscarEnCapa(consulta))[0];
  for (const nombre of [fila.nombres.find(n => /^HD \d+$/.test(n)), fila.nombres.find(n => /^BD[+-]/.test(n)), fila.nombres.find(n => /^TYC /.test(n)), `Gaia DR3 ${fila.gaia}`, `HSB ${fila.hsb}`]) {
    const r = await primera(nombre);
    assert.equal(r?.capa.fila, fil, nombre);
    assert.equal(r.score, 0, nombre);
    // En la lista: en negrita el nombre principal de la ficha y debajo el que coincidió.
    assert.equal(r.aliases[0], ordenNombres(fila.nombres)[0], nombre);
    assert.equal(r.detalle, `${nombre} · Estrella de fondo`, nombre);
  }
  // Se escribe de otras formas y se sigue encontrando.
  const hd = fila.nombres.find(n => /^HD \d+$/.test(n)).slice(3);
  assert.equal((await primera(`hd${hd}`))?.capa.fila, fil);
  assert.equal((await primera(fila.gaia))?.capa.fila, fil);
  const datos = await datosCapa(fil);
  assert.equal(datos.indice, k);
  assert.equal(datos.hsb, fila.hsb);
  assert.equal(datos.gaia, fila.gaia);
  assert.ok(datos.paralaje > 0 && datos.paralajeError > 0 && Number.isFinite(datos.g));
  assert.equal(nombrePrincipal(datos), ordenNombres(fila.nombres)[0]);
});

test('BD+NN y BD−NN con el mismo número son estrellas distintas', async () => {
  const bd = new Map();
  for (const f of filas) for (const n of f.nombres) if (/^BD[+-]\d/.test(n)) bd.set(n, f.hsb);
  const par = [...bd.keys()].find(n => n.startsWith('BD+') && bd.has(n.replace('BD+', 'BD-')));
  assert.ok(par, 'no hay un par BD+ / BD− para probar');
  const menos = par.replace('BD+', 'BD-');
  assert.notEqual(normalizeStarQuery(par), normalizeStarQuery(menos));
  const hsbDe = async consulta => (await datosCapa((await buscarEnCapa(consulta))[0].capa.fila)).hsb;
  assert.equal(await hsbDe(par), bd.get(par));
  assert.equal(await hsbDe(menos), bd.get(menos));
  assert.equal(await hsbDe(menos.replace('-', '−')), bd.get(menos));
});

test('UY Scuti está en el catálogo, no en la capa, y en «Estrella en lugar del Sol» con su radio publicado', async () => {
  const { buildSearchIndex, searchStars } = await import('../src/scene/starSearch.js');
  const { definirCandidatas, destacadas, estadoComparacion } = await import('../src/scene/comparacionSol.js');
  const UY = 101351417;
  const filasCatalogo = JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8'));
  assert.equal(filasCatalogo.filter(([i]) => i === UY).length, 1);
  const indice = buildSearchIndex(filasCatalogo);
  for (const consulta of ['UY Scuti', 'UY Sct', 'uy sct', 'BD-12 5055', `HSB ${UY}`]) {
    assert.equal(searchStars(indice, consulta)[0]?.id, UY, consulta);
    // La capa ya no la tiene: su fuente quedó oculta y sin nombres.
    assert.ok(!(await buscarEnCapa(consulta)).some(r => r.capa?.nombre?.startsWith('UY')), `${consulta} en la capa`);
  }
  assert.equal((await buscarEnCapa('Gaia DR3 4152993273702130432')).length, 0);
  // En la comparación, entre VY Canis Majoris y Betelgeuse.
  const oficiales = JSON.parse(fs.readFileSync('data/processed/stellar_official.json', 'utf8'));
  const estrellas = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => ({ ...s, datos: oficiales[s.i] }));
  definirCandidatas(estrellas);
  const { candidatas } = estadoComparacion();
  const uy = candidatas.find(c => c.id === UY);
  assert.deepEqual([uy.nombre, uy.radiusSolar, uy.temperatureK], ['UY Scuti', 1140, 3365]);
  assert.match(uy.fuente, /Arroyo-Torres et al\. 2013/);
  assert.deepEqual(destacadas(candidatas).slice(0, 3).map(c => c.nombre), ['VY Canis Majoris', 'UY Scuti', 'Betelgeuse']);
  // RS Persei: cuarta por radio, sin estar entre las destacadas.
  assert.deepEqual(candidatas.slice(0, 4).map(c => c.nombre), ['VY Canis Majoris', 'UY Scuti', 'Betelgeuse', 'RS Persei']);
  assert.ok(!destacadas(candidatas).some(c => c.nombre === 'RS Persei'));
});

test('la ficha de UY Scuti: tipo espectral, texto propio, catálogos y «Datos:» sin repetir la cita', async () => {
  const { fuentesSinRepetir } = await import('../src/fuentesFicha.js');
  const { tipoEstelar } = await import('../src/tipoEstelar.js');
  const uy = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).find(s => s.i === 101351417);
  assert.equal(uy.sp, 'M4Iae');
  assert.equal(tipoEstelar(uy.sp).clase, 'M');
  const textos = JSON.parse(fs.readFileSync('public/data/textos-fichas.json', 'utf8'));
  assert.match(textos.estrellas['UY Scuti'], /1\.140 veces/);
  const alias = JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8')).find(([i]) => i === 101351417)[1];
  for (const a of ['BD-12 5055', 'IRC -10422', 'Gaia DR3 4152993273702130432']) assert.ok(alias.includes(a), a);
  const oficiales = JSON.parse(fs.readFileSync('data/processed/stellar_official.json', 'utf8'));
  // VY CMa (700584) y UY Scuti: la cita de la temperatura es el comienzo de la del radio.
  for (const id of ['700584', '101351417']) {
    const f = oficiales[id].fuentes, lista = fuentesSinRepetir([f.temperatureK, f.radiusSolar].filter(Boolean));
    assert.deepEqual(lista, [f.radiusSolar], id);
  }
  assert.deepEqual(fuentesSinRepetir(['SIMBAD', 'Gaia DR3', 'SIMBAD']), ['SIMBAD', 'Gaia DR3']);
});
