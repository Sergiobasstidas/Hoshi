// scripts/catalog/auditoria/gaia_revisar.js
// Revisa las estrellas activas del registro HSB con gaia_revisar = 1 (sin Gaia DR3 porque el de AT-HYG estaba
// repetido o en duda): toma el Gaia DR3 que da SIMBAD para su HIP, HD o GJ y lo compara con la fila de AT-HYG v4.0.
// Calza si la posición de Gaia llevada a J2000 queda a ≤ MAX_SEP″, la V de Gaia (G y BP−RP) a ≤ MAX_DV mag de la de
// AT-HYG y el movimiento propio coincide (≤ 10 mas/año o 20 %). Una estrella variable de SIMBAD (V*) a ≤ 1″ y con el
// mismo movimiento propio calza aunque la V difiera (las de período largo cambian varias magnitudes). Si Gaia no
// tiene movimiento propio (solución de 2 parámetros), se lleva a J2000 con el de AT-HYG y no se compara. Si calza se propone el enlace (hsb_enlaces.csv,
// gaia_dr3) y, si ese Gaia era el de un número de lote, el igual_a del lote; si no calza o hay dudas, queda sin enlace.
// La paralaje no decide: solo se informa cuánto cambiaría la distancia. Solo se enlazan estrellas que se dibujan
// (data/processed/stars_15pc.json): una fila de AT-HYG v4.0 que no se dibuja perdió su Gaia por ser la misma estrella
// que otra del catálogo, y con un Gaia pasaría a dibujarse dos veces.
// Consultas por red.js: SIMBAD (simbad.harvard.edu) y Gaia DR3 (TAP de ARI Heidelberg), paso gaia_revisar.
//   HOSHI_RED=descargar node scripts/catalog/auditoria/gaia_revisar.js   baja las consultas
//   node scripts/catalog/auditoria/gaia_revisar.js [--escribir] [--informe <archivo.json>]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { DESCARGAR, pedir } from '../red.js';
import { vFromGaia } from '../photometry.js';
import { calzaSinTopeDeBrillo, movimientoCoincide } from '../criterios_enlace.js';
import { COLUMNAS_ENLACES, ENLACES_CSV, leerEnlaces } from '../enlaces_registro.js';

const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync', GAIA_TAP = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
const MAX_SEP = 2, MAX_DV = 0.75, LOTE = 400;
const celda = v => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const num = v => (v === '' || v === undefined || v === null ? NaN : Number(v));

async function tap(url, query, cabecera) {
  if (DESCARGAR) fs.mkdirSync('./data/raw/red/gaia_revisar', { recursive: true });
  const texto = await pedir('gaia_revisar', url, { method: 'POST', signal: AbortSignal.timeout(300000),
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query }), aceptar: (t, r) => r.ok && t.startsWith(cabecera), soloSiFalta: true });
  return parse(texto, { columns: true, skip_empty_lines: true });
}
// Formas de un GJ/Gl del registro como identificador de SIMBAD: «Gl 333.2A» → «GJ 333.2 A» y «GJ 333.2A».
const formasGj = gl => { const m = /^(?:GJ|Gl)\s*([\d.]+)\s*([A-Z]?)$/.exec(gl.trim()); if (!m) return []; return [...new Set([`GJ ${m[1]}${m[2] ? ` ${m[2]}` : ''}`, `GJ ${m[1]}${m[2]}`])]; };

export async function revisar() {
  const registro = parse(fs.readFileSync('data/catalog/hsb_registro.csv', 'utf8'), { columns: true });
  const filas = registro.filter(f => f.estado === 'activa' && f.gaia_revisar === '1');
  const stars = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));
  // Fila de AT-HYG v4.0 de cada una (posición J2000, movimiento propio, distancia y V).
  const quiero = new Set(filas.map(f => f.athyg_v40).filter(Boolean));
  const v40 = new Map();
  for (const r of parse(zlib.gunzipSync(fs.readFileSync('data/raw/athyg/v40/athyg_40.csv.gz')).toString('utf8'), { columns: true })) if (quiero.has(r.id)) v40.set(r.id, r);
  // SIMBAD: Gaia DR3 de cada identificador.
  const ids = new Map();
  for (const f of filas) {
    const lista = [f.hip && `HIP ${f.hip}`, f.hd && `HD ${f.hd}`, ...(f.gl ? formasGj(f.gl) : [])].filter(Boolean);
    ids.set(f.hsb, lista);
  }
  const todos = [...new Set([...ids.values()].flat())].sort();
  const gaiaDeId = new Map();
  for (let k = 0; k < todos.length; k += LOTE) {
    const query = `SELECT q.id AS buscado, b.main_id, g.id AS gaia FROM ident AS q JOIN basic AS b ON b.oid = q.oidref `
      + `LEFT JOIN ident AS g ON g.oidref = q.oidref AND g.id LIKE 'Gaia DR3 %' WHERE q.id IN (${todos.slice(k, k + LOTE).map(i => `'${i}'`).join(',')})`;
    for (const r of await tap(SIMBAD, query, 'buscado')) {
      const id = r.buscado.replace(/\s+/g, ' ');
      if (!gaiaDeId.has(id)) gaiaDeId.set(id, { main: r.main_id.replace(/\s+/g, ' '), gaia: new Set() });
      if (r.gaia) gaiaDeId.get(id).gaia.add(r.gaia.replace(/^Gaia DR3\s+/, ''));
    }
  }
  // Gaia DR3 de los candidatos.
  const candidatos = [...new Set([...gaiaDeId.values()].flatMap(e => [...e.gaia]))].sort();
  const gaia = new Map();
  for (let k = 0; k < candidatos.length; k += LOTE) {
    const query = `SELECT source_id, ra, dec, pmra, pmdec, parallax, parallax_error, phot_g_mean_mag, bp_rp, ruwe FROM gaiadr3.gaia_source WHERE source_id IN (${candidatos.slice(k, k + LOTE).join(',')})`;
    for (const g of await tap(GAIA_TAP, query, 'source_id')) gaia.set(g.source_id, g);
  }
  // Gaia ya usados por otra estrella activa del registro, y números de lote por Gaia.
  const usado = new Map(registro.filter(f => f.estado === 'activa' && f.gaia_dr3).map(f => [f.gaia_dr3, f.hsb]));
  const lote = new Map();
  for (const nombre of fs.readdirSync('data/catalog/hsb_gaia').filter(f => f.endsWith('.csv.gz'))) {
    for (const r of parse(zlib.gunzipSync(fs.readFileSync(`data/catalog/hsb_gaia/${nombre}`)).toString('utf8'), { columns: true })) if (!lote.has(r.gaia_dr3)) lote.set(r.gaia_dr3, { hsb: r.hsb, lote: nombre.replace('.csv.gz', '') });
  }
  const rad = Math.PI / 180, resultado = [];
  for (const f of filas) {
    const fila = { hsb: Number(f.hsb), nombre: f.nombre || (f.hip ? `HIP ${f.hip}` : f.hd ? `HD ${f.hd}` : f.gl), enCatalogo: stars.has(Number(f.hsb)), ids: ids.get(f.hsb) };
    if (!fila.enCatalogo) { resultado.push({ ...fila, estado: 'no se dibuja (fila de AT-HYG v4.0): no se enlaza' }); continue; }
    if (!fila.ids.length) { resultado.push({ ...fila, estado: 'sin identificador' }); continue; }
    const porId = fila.ids.map(i => [i, gaiaDeId.get(i)]).filter(([, e]) => e);
    const opciones = new Set(porId.flatMap(([, e]) => [...e.gaia]));
    if (!porId.length) { resultado.push({ ...fila, estado: 'no está en SIMBAD' }); continue; }
    if (!opciones.size) { resultado.push({ ...fila, estado: 'SIMBAD no da Gaia DR3', simbad: porId[0][1].main }); continue; }
    if (opciones.size > 1) { resultado.push({ ...fila, estado: 'dudosa: SIMBAD da más de un Gaia DR3', gaia: [...opciones].join(' / ') }); continue; }
    const id = [...opciones][0], g = gaia.get(id), a = v40.get(f.athyg_v40), s = stars.get(Number(f.hsb));
    const base = { ...fila, gaia: id, simbad: porId[0][1].main, via: porId.map(([i]) => i).join(', ') };
    if (usado.has(id) && usado.get(id) !== f.hsb) { resultado.push({ ...base, estado: `dudosa: el Gaia ya es de HSB ${usado.get(id)}` }); continue; }
    if (!g || !a) { resultado.push({ ...base, estado: g ? 'sin fila AT-HYG v4.0 para comparar' : 'Gaia sin datos en ARI' }); continue; }
    // Gaia (2016,0) llevado a J2000 con su movimiento propio, contra la posición de AT-HYG v4.0 (J2000).
    const gaiaConPm = Number.isFinite(num(g.pmra)) && Number.isFinite(num(g.pmdec));
    const dt = -16, pmra = gaiaConPm ? num(g.pmra) : num(a.pmra) || 0, pmdec = gaiaConPm ? num(g.pmdec) : num(a.pmdec) || 0;
    const dec0 = num(g.dec) + pmdec * dt / 3.6e6, ra0 = num(g.ra) + pmra * dt / 3.6e6 / Math.cos(num(g.dec) * rad);
    const raA = num(a.ra) * 15, decA = num(a.dec);
    const c = Math.sin(dec0 * rad) * Math.sin(decA * rad) + Math.cos(dec0 * rad) * Math.cos(decA * rad) * Math.cos((ra0 - raA) * rad);
    const sep = Math.acos(Math.min(1, c)) / rad * 3600;
    const vg = vFromGaia(num(g.phot_g_mean_mag), num(g.bp_rp)) ?? num(g.phot_g_mean_mag), dv = Math.abs(vg - num(a.mag));
    const { dpm, ok: pmOk } = movimientoCoincide(gaiaConPm ? [pmra, pmdec] : [NaN, NaN], [num(a.pmra), num(a.pmdec)]);
    const plx = num(g.parallax), plxE = num(g.parallax_error);
    const dGaia = plx > 0 ? 1000 / plx : null, dAhora = s ? s.d : num(a.dist);
    const medidas = { sep: +sep.toFixed(2), vAtHyg: num(a.mag), vGaia: +vg.toFixed(2), dv: +dv.toFixed(2), dpm: dpm === null ? null : +dpm.toFixed(1), plx: +plx.toFixed(4), plxErr: +plxE.toFixed(4),
      dAhora: dAhora ? +dAhora.toFixed(3) : null, dGaia: dGaia ? +dGaia.toFixed(3) : null, cambioD: dGaia && dAhora ? +((dGaia - dAhora) / dAhora * 100).toFixed(1) : null, lote: lote.get(id) || null };
    const variable = /^V\* /.test(base.simbad) && calzaSinTopeDeBrillo({ separacion: sep, dpm, pmOk });
    const calza = sep <= MAX_SEP && (dv <= MAX_DV || variable) && pmOk;
    const nota = [variable && dv > MAX_DV && `variable, ΔV ${dv.toFixed(2)}`, !gaiaConPm && 'Gaia sin movimiento propio'].filter(Boolean).join('; ');
    resultado.push({ ...base, ...medidas, nota, variable, estado: calza ? 'calza' : `no calza: ${[sep > MAX_SEP && `a ${sep.toFixed(1)}″`, dv > MAX_DV && `ΔV ${dv.toFixed(2)}`, !pmOk && `Δpm ${dpm.toFixed(0)} mas/año`].filter(Boolean).join(', ')}` });
  }
  return resultado;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const resultado = await revisar();
  const cuenta = {};
  for (const r of resultado) { const k = r.estado.replace(/HSB \d+/, 'HSB n').replace(/^no calza:.*/, 'no calza'); cuenta[k] = (cuenta[k] || 0) + 1; }
  console.log(JSON.stringify(cuenta));
  const enlazar = resultado.filter(r => r.estado === 'calza');
  if (args.includes('--informe')) fs.writeFileSync(args[args.indexOf('--informe') + 1], JSON.stringify(resultado, null, 1));
  if (args.includes('--escribir')) {
    const existentes = leerEnlaces(), ya = new Set(existentes.map(f => `${f.hsb}|${f.campo}`));
    // Un Gaia que la regla «más de 1,5 mag» quitó (fila gaia_dr3 vacía) solo se vuelve a poner en una estrella variable
    // a ≤ 1″ y con el mismo movimiento propio: su V cambia con el tiempo y esa regla no la distinguía.
    const ultimo = new Map(existentes.filter(f => f.campo === 'gaia_dr3').map(f => [Number(f.hsb), f.valor]));
    const nuevas = [];
    for (const r of enlazar) {
      const reponer = ultimo.get(r.hsb) === '' && r.variable;
      if (!ya.has(`${r.hsb}|gaia_dr3`) || reponer) nuevas.push({ hsb: r.hsb, campo: 'gaia_dr3', valor: r.gaia,
        motivo: `revisión gaia_revisar: SIMBAD da este Gaia DR3 para ${r.via} (${r.simbad}); a ${r.sep}″ de AT-HYG v4.0, ΔV ${r.dv}${r.dpm !== null ? `, Δpm ${r.dpm} mas/año` : ''}${r.nota ? `; ${r.nota}` : ''}${reponer ? '; estrella variable: se repone el Gaia que había quitado la regla de brillo' : ''}` });
      if (r.lote && !ya.has(`${r.lote.hsb}|igual_a`)) nuevas.push({ hsb: Number(r.lote.hsb), campo: 'igual_a', valor: r.hsb, motivo: `el Gaia ${r.gaia} del ${r.lote.lote} es el de HSB ${r.hsb} (revisión gaia_revisar)` });
    }
    const todas = [...existentes, ...nuevas];
    fs.writeFileSync(ENLACES_CSV, [COLUMNAS_ENLACES.join(','), ...todas.map(f => COLUMNAS_ENLACES.map(c => celda(f[c])).join(','))].join('\n') + '\n');
    console.log(`✓ ${ENLACES_CSV}: ${nuevas.length} filas nuevas (${enlazar.length} enlaces)`);
  }
}
