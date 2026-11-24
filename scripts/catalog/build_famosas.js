// scripts/catalog/build_famosas.js
// Estrellas famosas de scripts/catalog/famosas.js como estrellas añadidas al catálogo, en el formato de
// data/processed/stars_15pc.json, en data/catalog/added_famosas.json (como los miembros de cúmulos globulares,
// build_globulares.js). Las aplica catalog_patches.js; process_gaia.js no las saca de la capa y build_estrellas.js deja su
// punto de la capa en su lugar, oculto; build_hsb.js las da de alta en el registro por su Gaia DR3.
// Número HSB: el que ya tenga en el registro como «famosa»; si no, el siguiente libre por encima del registro, los lotes y
// las añadidas (build_hsb.js lo registra tal cual). El número de lote que tenía en la capa queda «igual a» el nuevo, y su
// Gaia DR3 queda enlazado en data/catalog/hsb_enlaces.csv (los agrega este script si faltan).
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { temperatureToRgb, bvToTemperature, vDeGaiaConRango } from './photometry.js';
import { DISTANCIAS_FAMOSAS } from './distancias_curadas.js';
import { pedir } from './red.js';
import { HSB_NUEVO_BASE, REGISTRO_CSV, leerLotes, leerRegistro } from './build_hsb.js';
import { equatorialToCartesian, propagateToJ2000 } from './build_added_hosts.js';
import { ADDED_FAMOSAS_JSON, FAMOSAS } from './famosas.js';
import { ADDED_GLOBULARES_JSON } from './globulares.js';
import { bvDesdeBpRp } from '../../src/scene/gaiaCapa.js';
import { ENLACES_CSV, leerEnlaces } from './enlaces_registro.js';

const leerJson = (ruta, clave) => { if (!fs.existsSync(ruta)) return []; const datos = JSON.parse(fs.readFileSync(ruta, 'utf8')); return clave ? datos[clave] : datos; };

const registro = leerRegistro(fs.existsSync(REGISTRO_CSV) ? fs.readFileSync(REGISTRO_CSV, 'utf8') : '');
const lotes = leerLotes();
const porGaia = new Map(registro.filter(f => f.gaia_dr3 && f.origen === 'famosa').map(f => [f.gaia_dr3, f.hsb]));
const usados = new Set([...registro.map(f => f.hsb), ...lotes.map(f => f.hsb), ...leerJson('./data/catalog/added_hosts.json', 'stars').map(s => s.i),
  ...leerJson(ADDED_GLOBULARES_JSON, 'stars').map(s => s.i)]);
let siguiente = HSB_NUEVO_BASE;
for (const u of usados) if (u >= siguiente) siguiente = u + 1;
const numero = gaia => porGaia.get(gaia) ?? siguiente++;

// Gaia DR3 de cada una, del TAP de ARI Heidelberg por medio de red.js (data/raw/red/famosas; sin red se usa lo guardado).
const GAIA_TAP = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
const consulta = `SELECT source_id,ra,dec,parallax,parallax_error,pmra,pmdec,ruwe,phot_g_mean_mag,bp_rp FROM gaiadr3.gaia_source WHERE source_id IN (${FAMOSAS.map(f => f.gaia).join(',')})`;
fs.mkdirSync('./data/raw/red/famosas', { recursive: true });
const texto = await pedir('famosas', GAIA_TAP, { method: 'POST', signal: AbortSignal.timeout(300000),
  body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query: consulta }), aceptar: (t, r) => r.ok && t.startsWith('source_id') });
const gaia = new Map(parse(texto, { columns: true, skip_empty_lines: true }).map(r => [r.source_id, r]));
const catalogo = new Map(leerJson('./data/processed/stars_15pc.json', null).map(s => [s.i, s]));
const num = v => (v === '' || v === undefined || v === null ? NaN : Number(v));

const omitidas = [];
const estrellas = FAMOSAS.flatMap(f => {
  const g = gaia.get(f.gaia);
  if (!g) throw new Error(`${f.nombre}: Gaia DR3 ${f.gaia} no vino del TAP`);
  const plx = num(g.parallax), err = num(g.parallax_error), ruwe = num(g.ruwe), G = num(g.phot_g_mean_mag), bpRp = num(g.bp_rp);
  // Distancia: curada con su cita, la del sistema de su primaria o la de su propia paralaje si cumple la regla.
  let d, fuenteD;
  const curada = DISTANCIAS_FAMOSAS[f.gaia], primaria = f.distanciaDe !== undefined ? catalogo.get(f.distanciaDe) : null;
  if (curada) { d = curada.dNueva; fuenteD = curada.fuente; }
  else if (primaria) { d = primaria.d; fuenteD = `la de su sistema (${primaria.n}: ${primaria.ds || 'AT-HYG'})`; }
  else if (plx > 0 && err / plx <= 0.1 && ruwe < 1.4) { d = 1000 / plx; fuenteD = `Gaia DR3 ${f.gaia}: paralaje ${plx.toFixed(4)} ± ${err.toFixed(4)} mas, RUWE ${ruwe.toFixed(2)}`; }
  else { omitidas.push(`${f.nombre} (paralaje ${plx} ± ${err} mas, RUWE ${ruwe})`); return []; }
  const [raJ, deJ] = f.posicion ? [f.posicion.ra, f.posicion.dec] : propagateToJ2000(num(g.ra), num(g.dec), num(g.pmra) || 0, num(g.pmdec) || 0, 2016);
  const [x, y, z] = equatorialToCartesian(raJ, deJ, d);
  const fotometria = f.v ? { v: f.v.valor, fuente: f.v.fuente } : vDeGaiaConRango(G, bpRp);
  const bv = Number.isFinite(bpRp) ? bvDesdeBpRp(bpRp) : 0;
  return [{
    i: numero(f.gaia), n: f.nombre, x, y, z, d: Number(d.toPrecision(7)), m: Number((fotometria.v - 5 * Math.log10(d / 10)).toFixed(3)),
    c: Number(bv.toFixed(3)), sp: f.sp || null, rgb: temperatureToRgb(bvToTemperature(bv)), dataOrigin: 'famosa', gaia: f.gaia, ds: curada || primaria ? 'curada' : 'Gaia DR3',
    src: { pos: f.posicion ? f.posicion.fuente : 'Gaia DR3, propagada a J2000', d: fuenteD, v: fotometria.fuente, c: Number.isFinite(bpRp) ? 'B−V desde BP−RP (gaiaCapa.js)' : 'sin color de Gaia' },
    alias: [...f.alias, `Gaia DR3 ${f.gaia}`],
    ...(f.primaria ? { primaria: f.primaria, comp: f.comp } : {}),
  }];
});
// Enlaces: su Gaia DR3 y el número de lote que tenía en la capa, «igual a» el nuevo.
const enlaces = leerEnlaces();
const deLote = new Map(lotes.filter(f => f.gaia_dr3).map(f => [f.gaia_dr3, f.hsb]));
const nuevas = [];
for (const s of estrellas) {
  const nombre = FAMOSAS.find(f => f.gaia === s.gaia).nombre;
  if (!enlaces.some(e => Number(e.hsb) === s.i && e.campo === 'gaia_dr3')) nuevas.push(`${s.i},gaia_dr3,${s.gaia},"${nombre}: estrella famosa sumada al catálogo (famosas.js)"`);
  const lote = deLote.get(s.gaia);
  if (lote !== undefined && !enlaces.some(e => Number(e.hsb) === lote && e.campo === 'igual_a')) nuevas.push(`${lote},igual_a,${s.i},"${nombre}: pasó de la capa al catálogo (build_famosas.js)"`);
}
if (nuevas.length) fs.appendFileSync(ENLACES_CSV, `${nuevas.join('\n')}\n`);
const salida = JSON.stringify({ meta: { fuente: 'scripts/catalog/famosas.js; Gaia DR3 (TAP de ARI Heidelberg)' }, stars: estrellas });
if (!fs.existsSync(ADDED_FAMOSAS_JSON) || fs.readFileSync(ADDED_FAMOSAS_JSON, 'utf8') !== salida) fs.writeFileSync(ADDED_FAMOSAS_JSON, salida);
console.log(`✓ Famosas: ${estrellas.map(s => `${s.n} (HSB ${s.i}, ${s.d.toFixed(0)} pc)`).join(', ')}${nuevas.length ? `; ${nuevas.length} enlaces nuevos` : ''}`);
if (omitidas.length) console.log(`⚠ Famosas sin distancia que cumpla la regla, no entran: ${omitidas.join(', ')}`);
