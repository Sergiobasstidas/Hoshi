// scripts/catalog/capa_nombres.js
// Nombres oficiales de las estrellas de la capa de fondo (Gaia DR3 y GCNS), con su número HSB:
// data/catalog/hsb_capa_nombres.csv.gz (hsb, gaia_dr3, nombres separados por «|»), solo las que tienen alguno.
//  - SIMBAD (espejo simbad.harvard.edu): el objeto cuyo identificador es «Gaia DR3 <source_id>», su posición, su V y
//    sus nombres HD, HR, SAO, BD, CD, CPD, TYC, HIP, GJ/Gl, WDS, de estrella variable (V*) y propios (NAME). Se
//    guardan en data/raw/red/capa_simbad.
//  - Gaia DR3 (TAP de ARI Heidelberg): el cruce oficial con Tycho-2 (gaiadr3.tycho2tdsc_merge_best_neighbour), en
//    data/raw/red/capa_tycho. Si SIMBAD da otro TYC, manda el de Gaia.
// No se guarda ningún TIC.
// Revisión de identidad (lo dudoso queda sin nombre y va al informe):
//  - posición: SIMBAD a más de 2″ de la posición de Gaia llevada a J2000 (DR3 es de época 2016,0);
//  - brillo: la V de SIMBAD difiere en más de 1,5 mag de la V que da Gaia (G y BP−RP, vFromGaia), salvo variables conocidas
//    y estrellas de color fuera del rango de esa relación a ≤ 1″ con el mismo movimiento propio en SIMBAD (brilloCalza);
//    en esos dos casos la estrella pierde los nombres de SIMBAD (el TYC del cruce de Gaia se queda);
//  - un mismo nombre en dos estrellas de la capa: no queda en ninguna;
//  - un nombre que ya usa una estrella del catálogo principal (public/data/star-search*.json): no queda. Un nombre
//    con letra de componente («HD 1234 B») sirve aunque el catálogo tenga «HD 1234».
// Las consultas van por tandas fijas, para que se puedan repetir sin red aunque la capa cambie: SIMBAD pide todos los
// Gaia de los lotes (data/catalog/hsb_gaia, que solo crecen), por zona del cielo (HEALPix nivel 2 del source_id, 192
// zonas) en grupos de hasta 5.000 source_id ordenados; Gaia, por rango de source_id (HEALPix nivel 1, 48 rangos), toda
// la tabla de Tycho-2. Los pocos de la capa que no vienen de un lote son estrellas del registro: sus nombres salen de
// su fila (HD, HIP, HR, GJ y nombre), sin consulta, así una corrección del registro no cambia ninguna consulta.
//   HOSHI_RED=descargar node scripts/catalog/capa_nombres.js      baja las consultas y escribe el archivo
//   node scripts/catalog/capa_nombres.js [--informe <carpeta>]    sin red; con --informe, además informe.md y .json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { DESCARGAR, pedir } from './red.js';
import { vFromGaia } from './photometry.js';
import { SEP_SIN_TOPE_DV, calzaSinTopeDeBrillo, movimientoCoincide } from './criterios_enlace.js';
import { NOMBRES_CAPA } from './nombres_curados.js';

const REGISTRO = './data/catalog/hsb_registro.csv', LOTES = './data/catalog/hsb_gaia', CAPA_HSB = './public/data/estrellas-hsb.bin';
const GAIA_1M = './data/raw/gaia/gaia_dr3_1m.csv.gz', GCNS = './data/raw/gcns/gcns_main.csv.gz';
const BUSCADOR = ['star-search.json', 'star-search-variables.json', 'star-search-numeros.json'].map(f => `./public/data/${f}`);
export const SALIDA = './data/catalog/hsb_capa_nombres.csv.gz';
const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync', GAIA_TAP = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
const POR_TANDA = 5000, MAX_SEP = 2, MAX_DV = 1.5;
// Supergigantes rojas y otras variables (UY Sct, KY Cyg, SU Per): la V de SIMBAD es de una sola época y su color puede
// quedar fuera del rango de la relación G−V de Riello et al. (2021, tabla C.2: −0,5 ≤ BP−RP ≤ 5,0), así que la V que da
// Gaia puede diferir más de MAX_DV aunque sea el mismo objeto. Se aceptan con el mismo criterio que los enlaces a Gaia de
// la auditoría (criterios_enlace.js): a ≤ 1″, con el movimiento propio de SIMBAD comparado y coincidente y un solo objeto
// de SIMBAD; sin tope de ΔV. El movimiento propio evita pegarle el nombre a una vecina en campos densos (Scutum, Cygnus).
const RANGO_RIELLO = [-0.5, 5.0];
export const fueraDeRiello = bpRp => Number.isFinite(bpRp) && (bpRp < RANGO_RIELLO[0] || bpRp > RANGO_RIELLO[1]);

// ¿Calza el brillo de SIMBAD con el de Gaia? `variable`: SIMBAD la nombra «V* …»; `dpm`, `pmOk`: movimientoCoincide.
export function brilloCalza({ vSimbad, vGaia, bpRp, separacion: sep, unObjeto, variable, dpm = null, pmOk = false }) {
  if (Math.abs(vSimbad - vGaia) <= MAX_DV) return true;
  return unObjeto && (variable || fueraDeRiello(bpRp)) && calzaSinTopeDeBrillo({ separacion: sep, dpm, pmOk });
}

// Tipos de nombre, en el orden en que se guardan.
const TIPOS = [
  ['NAME', /^NAME (.+)$/], ['HR', /^HR \d+/], ['HD', /^HD \d+/], ['HIP', /^HIP \d+/], ['GJ', /^GJ /], ['Gl', /^Gl /],
  ['V*', /^V\* (.+)$/], ['BD', /^BD[+-]\d/], ['CD', /^CD-\d/], ['CPD', /^CPD-\d/], ['SAO', /^SAO \d+/], ['TYC', /^TYC \d+-\d+-\d+$/], ['WDS', /^WDS J/],
];
const LIKES = ['HD %', 'HR %', 'SAO %', 'BD%', 'CD%', 'CPD%', 'TYC %', 'HIP %', 'GJ %', 'Gl %', 'WDS %', 'V* %', 'NAME %'];

// Tipo y forma guardada de un identificador de SIMBAD (espacios simples; sin «NAME » ni «V* »), o null.
export function nombreDe(id) {
  const limpio = id.trim().replace(/\s+/g, ' ');
  for (const [tipo, re] of TIPOS) {
    const m = re.exec(limpio);
    if (m) return { tipo, nombre: m[1] ?? limpio };
  }
  return null;
}
// Clave para comparar nombres: sin espacios, en mayúsculas y con GJ = Gl. Distingue BD+ de BD−.
export const clave = n => n.replace(/\s+/g, '').toUpperCase().replace(/^GJ/, 'GL');
const tieneLetra = n => /\d ?[A-Z][a-z]?$/.test(n);

const leerCsvGz = ruta => parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'), { columns: true, skip_empty_lines: true });

// Los cuatro lotes de la primera carga (07–08/11/2026) se consultan juntos, por zona; cada lote posterior, aparte
// (también por zona), así un lote nuevo solo agrega consultas y no cambia las guardadas.
const LOTES_BASE = new Set(['lote-2026-11-07.csv.gz', 'lote-2026-11-07-2.csv.gz', 'lote-2026-11-08.csv.gz', 'lote-2026-11-08-2.csv.gz']);
function gruposDeLotes() {
  const grupos = new Map(), vistos = new Set();
  for (const nombre of fs.readdirSync(LOTES).filter(f => f.endsWith('.csv.gz')).sort()) {
    const grupo = LOTES_BASE.has(nombre) ? 'base' : nombre;
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    for (const r of leerCsvGz(`${LOTES}/${nombre}`)) if (r.gaia_dr3 && !vistos.has(r.gaia_dr3)) { vistos.add(r.gaia_dr3); grupos.get(grupo).push(r.gaia_dr3); }
  }
  return [...grupos.values()];
}

// Gaia DR3 de cada número de lote.
function gaiaDeLotes() {
  const gaiaDe = new Map();
  for (const nombre of fs.readdirSync(LOTES).filter(f => f.endsWith('.csv.gz')).sort()) {
    for (const r of leerCsvGz(`${LOTES}/${nombre}`)) if (r.gaia_dr3 && !gaiaDe.has(Number(r.hsb))) gaiaDe.set(Number(r.hsb), r.gaia_dr3);
  }
  return gaiaDe;
}

// Estrellas de la capa, en el orden de estrellas-hsb.bin: [{ hsb, gaia, lote }].
export function estrellasCapa() {
  const lotes = gaiaDeLotes(), gaiaDe = new Map();
  for (const r of parse(fs.readFileSync(REGISTRO, 'utf8'), { columns: true })) if (r.gaia_dr3 && r.estado === 'activa') gaiaDe.set(Number(r.hsb), r.gaia_dr3);
  for (const [hsb, gaia] of lotes) if (!gaiaDe.has(hsb)) gaiaDe.set(hsb, gaia);
  const a = fs.readFileSync(CAPA_HSB);
  return [...new Uint32Array(a.buffer, a.byteOffset, a.byteLength / 4)].map(hsb => ({ hsb, gaia: gaiaDe.get(hsb) ?? null, lote: lotes.has(hsb) }));
}

const zona = (sid, nivel) => Number(BigInt(sid) >> BigInt(35 + 2 * (12 - nivel)));
const comparar = (a, b) => { const x = BigInt(a), y = BigInt(b); return x < y ? -1 : x > y ? 1 : 0; };

async function consultar(paso, url, query, cabecera) {
  if (DESCARGAR) fs.mkdirSync(`./data/raw/red/${paso}`, { recursive: true });
  return pedir(paso, url, { method: 'POST', signal: AbortSignal.timeout(600000),
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query }), aceptar: (t, r) => r.ok && t.startsWith(cabecera), soloSiFalta: true });
}

// SIMBAD: Map source_id → { oid, ra, dec, V, ids: [identificador] }.
async function bajarSimbad(porLote, tiempos) {
  const grupos = porLote.flatMap(ids => {
    const zonas = new Map();
    for (const id of ids) { const z = zona(id, 2); if (!zonas.has(z)) zonas.set(z, []); zonas.get(z).push(id); }
    return [...zonas.keys()].sort((a, b) => a - b).map(z => zonas.get(z));
  }).filter(l => l.length);
  const salida = new Map();
  const filtro = LIKES.map(l => `i.id LIKE '${l}'`).join(' OR ');
  for (const grupo of grupos) {
    const lista = [...new Set(grupo)].sort(comparar);
    for (let k = 0; k < lista.length; k += POR_TANDA) {
      const t = Date.now();
      const query = `SELECT g.id AS gaia, b.oid, b.ra, b.dec, a.V, i.id FROM ident AS g JOIN basic AS b ON b.oid = g.oidref `
        + `LEFT JOIN allfluxes AS a ON a.oidref = g.oidref JOIN ident AS i ON i.oidref = g.oidref `
        + `WHERE g.id IN (${lista.slice(k, k + POR_TANDA).map(s => `'Gaia DR3 ${s}'`).join(',')}) AND (${filtro})`;
      const texto = await consultar('capa_simbad', SIMBAD, query, 'gaia,');
      tiempos.simbad.push((Date.now() - t) / 1000);
      if (DESCARGAR && tiempos.simbad.length % 20 === 0) console.log(`  SIMBAD: ${tiempos.simbad.length} consultas`);
      for (const f of parse(texto, { columns: true, skip_empty_lines: true })) {
        const sid = f.gaia.replace(/^Gaia DR3\s+/, '');
        let e = salida.get(sid);
        if (!e) salida.set(sid, e = { oids: new Set(), ra: Number(f.ra), dec: Number(f.dec), V: f.V === '' ? null : Number(f.V), ids: new Set() });
        e.oids.add(f.oid); e.ids.add(f.id);
      }
    }
  }
  return salida;
}

// Movimiento propio de SIMBAD (mas/año) de unas pocas estrellas: Map source_id → [pmra, pmdec].
async function bajarPmSimbad(ids) {
  const salida = new Map(), lista = [...new Set(ids)].sort(comparar);
  for (let k = 0; k < lista.length; k += POR_TANDA) {
    const query = `SELECT g.id AS gaia, b.pmra, b.pmdec FROM ident AS g JOIN basic AS b ON b.oid = g.oidref `
      + `WHERE g.id IN (${lista.slice(k, k + POR_TANDA).map(s => `'Gaia DR3 ${s}'`).join(',')})`;
    const texto = await consultar('capa_simbad', SIMBAD, query, 'gaia,');
    for (const f of parse(texto, { columns: true, skip_empty_lines: true })) {
      salida.set(f.gaia.replace(/^Gaia DR3\s+/, ''), [f.pmra === '' ? NaN : Number(f.pmra), f.pmdec === '' ? NaN : Number(f.pmdec)]);
    }
  }
  return salida;
}

// Cruce de Gaia con Tycho-2: Map source_id → «TYC n-n-n».
async function bajarTycho(tiempos) {
  const salida = new Map();
  for (let z = 0; z < 48; z++) {
    const t = Date.now();
    const desde = BigInt(z) << 57n, hasta = BigInt(z + 1) << 57n;
    const query = `SELECT source_id, original_ext_source_id FROM gaiadr3.tycho2tdsc_merge_best_neighbour WHERE source_id >= ${desde} AND source_id < ${hasta}`;
    const texto = await consultar('capa_tycho', GAIA_TAP, query, 'source_id');
    tiempos.tycho.push((Date.now() - t) / 1000);
    for (const f of parse(texto, { columns: true, skip_empty_lines: true })) salida.set(f.source_id, `TYC ${f.original_ext_source_id}`);
  }
  return salida;
}

// Astrometría y fotometría de Gaia para la capa: Map source_id → { ra, dec, pmra, pmdec, g, bpRp } (época 2016,0).
function leerAstrometria(ids) {
  const quiero = new Set(ids), salida = new Map();
  const num = v => (v === '' || v === undefined ? NaN : Number(v));
  for (const r of leerCsvGz(GAIA_1M)) if (quiero.has(r.source_id)) salida.set(r.source_id, { ra: num(r.ra), dec: num(r.dec), pmra: num(r.pmra), pmdec: num(r.pmdec), g: num(r.phot_g_mean_mag), bpRp: num(r.bp_rp) });
  for (const r of leerCsvGz(GCNS)) if (quiero.has(r.source_id) && !salida.has(r.source_id)) {
    salida.set(r.source_id, { ra: num(r.ra), dec: num(r.dec), pmra: num(r.pmra), pmdec: num(r.pmdec), g: num(r.phot_g_mean_mag), bpRp: num(r.phot_bp_mean_mag) - num(r.phot_rp_mean_mag) });
  }
  return salida;
}

// Separación (″) entre SIMBAD (J2000) y Gaia llevada de 2016,0 a 2000,0 con su movimiento propio.
function separacion(s, g) {
  const rad = Math.PI / 180, dt = -16;
  const pmra = Number.isFinite(g.pmra) ? g.pmra : 0, pmdec = Number.isFinite(g.pmdec) ? g.pmdec : 0;
  const dec = g.dec + (pmdec * dt) / 3.6e6;
  const ra = g.ra + (pmra * dt) / 3.6e6 / Math.cos(g.dec * rad);
  const c = Math.sin(dec * rad) * Math.sin(s.dec * rad) + Math.cos(dec * rad) * Math.cos(s.dec * rad) * Math.cos((ra - s.ra) * rad);
  return (Math.acos(Math.min(1, c)) / rad) * 3600;
}

export async function armar() {
  const tiempos = { simbad: [], tycho: [] };
  const capa = estrellasCapa();
  const ids = capa.filter(e => e.gaia).map(e => e.gaia);
  const deLotes = [...new Set(gaiaDeLotes().values())];
  const enLotes = new Set(deLotes);
  const filaRegistro = new Map(parse(fs.readFileSync(REGISTRO, 'utf8'), { columns: true }).map(f => [Number(f.hsb), f]));
  const t0 = Date.now();
  const simbad = await bajarSimbad(gruposDeLotes(), tiempos);
  const tSimbad = (Date.now() - t0) / 1000;
  const t1 = Date.now();
  const tycho = await bajarTycho(tiempos);
  const tTycho = (Date.now() - t1) / 1000;
  const astro = leerAstrometria(ids);
  // Nombres del catálogo principal (todo lo que ya encuentra el buscador).
  const enCatalogo = new Set();
  for (const ruta of BUSCADOR) for (const [, alias] of JSON.parse(fs.readFileSync(ruta, 'utf8'))) for (const a of alias) enCatalogo.add(clave(a));

  // Movimiento propio de SIMBAD, solo para las que la regla de brillo descartaría y podrían calzar sin tope de ΔV.
  const esVariable = s => [...s.ids].some(id => /^V\* /.test(id.trim()));
  const candidatasPm = capa.filter(({ gaia }) => {
    const s = gaia && simbad.get(gaia), g = gaia && astro.get(gaia);
    if (!s || !g || s.oids.size > 1 || s.V === null || !(esVariable(s) || fueraDeRiello(g.bpRp))) return false;
    const vg = vFromGaia(g.g, g.bpRp);
    return vg !== null && Math.abs(s.V - vg) > MAX_DV && separacion(s, g) <= SEP_SIN_TOPE_DV;
  }).map(({ gaia }) => gaia);
  const pmSimbad = await bajarPmSimbad(candidatasPm);
  const dudosas = { posicion: [], brillo: [], varios_objetos: [], repetido: [], catalogo: [] };
  const conNombres = [];
  let tycDistinto = 0, sinAstrometria = 0;
  for (const { hsb, gaia } of capa) {
    if (!gaia) continue;
    const nombres = new Map(); // clave → { tipo, nombre }
    const s = simbad.get(gaia), g = astro.get(gaia);
    let simbadVale = Boolean(s);
    if (s && s.oids.size > 1) { simbadVale = false; dudosas.varios_objetos.push({ hsb, gaia, detalle: `${s.oids.size} objetos de SIMBAD` }); }
    if (simbadVale && !g) sinAstrometria++;
    if (simbadVale && g) {
      const sep = separacion(s, g);
      if (sep > MAX_SEP) { simbadVale = false; dudosas.posicion.push({ hsb, gaia, detalle: `${sep.toFixed(2)}″` }); }
      const vg = vFromGaia(g.g, g.bpRp);
      const pm = movimientoCoincide([g.pmra, g.pmdec], pmSimbad.get(gaia) || [NaN, NaN]);
      if (simbadVale && s.V !== null && vg !== null && !brilloCalza({ vSimbad: s.V, vGaia: vg, bpRp: g.bpRp, separacion: sep, unObjeto: s.oids.size === 1,
        variable: esVariable(s), dpm: pm.dpm, pmOk: pm.ok })) {
        simbadVale = false; dudosas.brillo.push({ hsb, gaia, detalle: `V SIMBAD ${s.V} / V Gaia ${vg.toFixed(2)}` });
      }
    }
    const tycGaia = tycho.get(gaia);
    // Estrella del registro (no de un lote): sus nombres son los de su fila.
    if (!enLotes.has(gaia) && filaRegistro.has(hsb)) {
      const f = filaRegistro.get(hsb);
      simbadVale = false;
      for (const id of [f.nombre && `NAME ${f.nombre}`, f.hr && `HR ${f.hr}`, f.hd && `HD ${f.hd}`, f.hip && `HIP ${f.hip}`, f.gl].filter(Boolean)) {
        const n = nombreDe(id);
        if (n) nombres.set(clave(n.nombre), n);
      }
    }
    if (simbadVale) for (const id of s.ids) {
      const n = nombreDe(id);
      if (!n) continue;
      if (n.tipo === 'TYC' && tycGaia) { if (clave(n.nombre) !== clave(tycGaia)) tycDistinto++; continue; }
      nombres.set(clave(n.nombre), n);
    }
    if (tycGaia) nombres.set(clave(tycGaia), { tipo: 'TYC', nombre: tycGaia });
    if (nombres.size) conNombres.push({ hsb, gaia, nombres });
  }
  // Nombres repetidos entre estrellas de la capa o ya usados por el catálogo principal.
  const usos = new Map();
  for (const e of conNombres) for (const k of e.nombres.keys()) usos.set(k, (usos.get(k) || 0) + 1);
  for (const e of conNombres) for (const [k, n] of [...e.nombres]) {
    if (usos.get(k) > 1) { e.nombres.delete(k); dudosas.repetido.push({ hsb: e.hsb, gaia: e.gaia, detalle: `${n.nombre} (en ${usos.get(k)} estrellas de la capa)` }); }
    else if (enCatalogo.has(k)) { e.nombres.delete(k); dudosas.catalogo.push({ hsb: e.hsb, gaia: e.gaia, detalle: `${n.nombre}${tieneLetra(n.nombre) ? '' : ' (sin letra)'}` }); }
  }
  // Nombres revisados a mano (nombres_curados.js, NOMBRES_CAPA): van primero, como nombre propio o de variable.
  for (const { hsb, nombres } of NOMBRES_CAPA) {
    const e = conNombres.find(x => x.hsb === hsb);
    if (!e) throw new Error(`NOMBRES_CAPA: HSB ${hsb} no tiene fila en la capa`);
    for (const n of nombres) e.nombres.set(clave(n), { tipo: /^(V\d+|[A-Z]{1,2}) [A-Z][A-Za-z]{2}$/.test(n) ? 'V*' : 'NAME', nombre: n });
  }
  const orden = new Map(TIPOS.map(([t], k) => [t, k]));
  const filas = conNombres.filter(e => e.nombres.size).sort((a, b) => a.hsb - b.hsb).map(e => ({
    hsb: e.hsb, gaia: e.gaia,
    nombres: [...e.nombres.values()].sort((a, b) => orden.get(a.tipo) - orden.get(b.tipo) || (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0)),
  }));
  const enCapa = new Set(ids);
  return { capa, filas, dudosas, tycDistinto, sinAstrometria, tiempos: { ...tiempos, tSimbad, tTycho }, conSimbad: simbad.size, conTycho: [...tycho.keys()].filter(k => enCapa.has(k)).length };
}

export function aCsv(filas) {
  for (const f of filas) for (const n of f.nombres) if (/[|"\n]/.test(n.nombre)) throw new Error(`Nombre con un carácter reservado: ${n.nombre}`);
  // Entre comillas si lleva coma («WDS J03465+2415Aa,Ab»).
  const celda = t => (t.includes(',') ? `"${t}"` : t);
  return ['hsb,gaia_dr3,nombres', ...filas.map(f => `${f.hsb},${f.gaia},${celda(f.nombres.map(n => n.nombre).join('|'))}`)].join('\n') + '\n';
}

function informe({ capa, filas, dudosas, tycDistinto, sinAstrometria, conSimbad, conTycho }, bytes, carpeta) {
  const porTipo = {};
  for (const f of filas) for (const t of new Set(f.nombres.map(n => n.tipo))) porTipo[t] = (porTipo[t] || 0) + 1;
  const nombresPorTipo = {};
  for (const f of filas) for (const n of f.nombres) nombresPorTipo[n.tipo] = (nombresPorTipo[n.tipo] || 0) + 1;
  // Descarga según el índice de red.js: consultas, primera y última respuesta guardada, bytes.
  const descarga = paso => {
    const e = Object.values(JSON.parse(fs.readFileSync(`./data/raw/red/${paso}/indice.json`, 'utf8')));
    const f = e.map(x => x.fecha).sort();
    return { consultas: e.length, errores: e.filter(x => x.error).length, desde: f[0], hasta: f.at(-1), minutos: Number(((new Date(f.at(-1)) - new Date(f[0])) / 60000).toFixed(1)), bytes: e.reduce((t, x) => t + x.bytes, 0) };
  };
  const r = {
    capa: capa.length, conNombre: filas.length, conSimbad, conTycho, estrellasPorTipo: porTipo, nombresPorTipo, tycDistintoDeSimbad: tycDistinto,
    dudosas: Object.fromEntries(Object.entries(dudosas).map(([k, l]) => [k, { casos: l.length, estrellas: new Set(l.map(d => d.hsb)).size, ejemplos: l.slice(0, 5) }])),
    archivo: bytes,
    sinAstrometria, descargas: { simbad: descarga('capa_simbad'), tycho: descarga('capa_tycho') },
  };
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, 'capa_nombres.json'), JSON.stringify(r, null, 1) + '\n');
  // Todos los casos dudosos, para revisarlos uno por uno.
  const celda = t => (/[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const lista = Object.entries(dudosas).flatMap(([motivo, l]) => l.map(d => [motivo, d.hsb, d.gaia, d.detalle].map(String).map(celda).join(',')));
  fs.writeFileSync(path.join(carpeta, 'capa_nombres_dudosos.csv'), ['motivo,hsb,gaia_dr3,detalle', ...lista].join('\n') + '\n');
  const pct = n => `${((100 * n) / r.capa).toFixed(1)} %`;
  const md = [
    '# Nombres de la capa de fondo', '',
    `Archivo: \`data/catalog/hsb_capa_nombres.csv.gz\` (hsb, gaia_dr3, nombres separados por «|»), del paso \`scripts/catalog/capa_nombres.js\` de \`npm run catalogo\`.`, '',
    '## Resultado', '',
    `- Estrellas en la capa: ${r.capa.toLocaleString('es')}`,
    `- Con objeto en SIMBAD por su Gaia DR3: ${r.conSimbad.toLocaleString('es')}`,
    `- Con TYC en el cruce oficial de Gaia: ${r.conTycho.toLocaleString('es')}`,
    `- Con al menos un nombre: ${r.conNombre.toLocaleString('es')} (${pct(r.conNombre)})`,
    `- TYC de SIMBAD distinto del cruce de Gaia (se usa el de Gaia): ${r.tycDistintoDeSimbad}`,
    `- Con objeto en SIMBAD pero sin astrometría local de Gaia para revisar la posición: ${r.sinAstrometria}`, '',
    '| Tipo | Estrellas | Nombres |', '|---|---|---|',
    ...TIPOS.map(([t]) => `| ${t} | ${(porTipo[t] || 0).toLocaleString('es')} | ${(nombresPorTipo[t] || 0).toLocaleString('es')} |`), '',
    '## Casos dudosos (quedan sin ese nombre)', '', 'Lista completa en `capa_nombres_dudosos.csv`.', '',
    '| Motivo | Casos | Estrellas | Ejemplos |', '|---|---|---|---|',
    ...Object.entries(r.dudosas).map(([k, d]) => `| ${k} | ${d.casos.toLocaleString('es')} | ${d.estrellas.toLocaleString('es')} | ${d.ejemplos.map(e => `HSB ${e.hsb}: ${e.detalle}`).join('; ')} |`), '',
    'Posición y brillo: la estrella pierde los nombres de SIMBAD; el TYC del cruce de Gaia se queda. Repetido y catálogo: solo se quita ese nombre.', '',
    '## Archivo y descargas', '',
    `- Tamaño: ${(bytes.gzip / 1e6).toFixed(2)} MB con gzip, ${(bytes.texto / 1e6).toFixed(2)} MB sin comprimir.`,
    ...[['SIMBAD (simbad.harvard.edu)', r.descargas.simbad], ['Gaia DR3, cruce con Tycho-2 (ARI Heidelberg)', r.descargas.tycho]].map(([n, d]) =>
      `- ${n}: ${d.consultas} consultas (${d.errores} con error), ${(d.bytes / 1e6).toFixed(1)} MB, ${d.minutos} min (${d.desde} – ${d.hasta}).`), '',
    'Las respuestas quedan en `data/raw/red/capa_simbad` y `data/raw/red/capa_tycho` (ignorado); se bajan con `HOSHI_RED=descargar node scripts/catalog/capa_nombres.js` o con `npm run descargar:red`.', '',
  ].join('\n');
  fs.writeFileSync(path.join(carpeta, 'capa_nombres.md'), md);
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const resultado = await armar();
  const texto = aCsv(resultado.filas);
  const gz = zlib.gzipSync(texto, { level: 9 });
  if (!fs.existsSync(SALIDA) || !zlib.gunzipSync(fs.readFileSync(SALIDA)).equals(Buffer.from(texto))) fs.writeFileSync(SALIDA, gz);
  const dud = Object.entries(resultado.dudosas).map(([k, l]) => `${k} ${l.length}`).join(', ');
  if (args.includes('--informe')) informe(resultado, { texto: Buffer.byteLength(texto), gzip: gz.length }, args[args.indexOf('--informe') + 1]);
  console.log(`✓ ${SALIDA}: ${resultado.filas.length} de ${resultado.capa.length} estrellas de la capa con nombre; dudosos: ${dud}`);
}
