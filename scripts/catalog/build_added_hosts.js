// scripts/catalog/build_added_hosts.js
// Estrellas anfitrionas de exoplanetas que AT-HYG no incluye (TRAPPIST-1, Teegarden…),
// en el mismo formato que data/processed/stars_15pc.json para que scripts/process_stars.js
// las añada. Posición y distancia de Gaia DR3 cuando existen; si no, del NASA Exoplanet
// Archive. Cada registro declara de dónde sale cada valor.
// Uso: node scripts/catalog/build_added_hosts.js
// Requiere exoplanet_host_identity.json y exoplanet_systems.json actualizados.

import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { temperatureToBv, temperatureToRgb, vFromGaia } from './photometry.js';

const HOSTS_JSON = './data/catalog/exoplanet_host_identity.json';
const SYSTEMS_JSON = './data/exoplanets/exoplanet_systems.json';
const GAIA_HOSTS_CSV = './data/raw/gaia/gaia_dr3_exoplanet_hosts.csv';
const ATHYG_CSV = './data/raw/hyglike_from_athyg_v32.csv';
const OUTPUT_PATH = './data/catalog/added_hosts.json';

// Los ID de AT-HYG llegan a ~2,6 millones: este rango no colisiona.
export const ADDED_HOST_ID_BASE = 9000000;
// Paralaje Gaia fiable para fijar la distancia; si no, se usa sy_dist del archivo.
const MIN_PARALLAX_SNR = 10;
const GAIA_EPOCH = 2016, CATALOGUE_EPOCH = 2000;
// Solo los anfitriones cercanos llevan nombre visible (`n`), para no llenar la escena de
// etiquetas; el resto conserva el nombre en `h` y se encuentra con el buscador.
const NAMED_WITHIN_PC = 50;

const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Posición (grados) llevada de la época de Gaia a J2000 con el movimiento propio (mas/año;
// pmra incluye cos δ). Aproximación lineal, suficiente para 16 años.
export function propagateToJ2000(raDeg, decDeg, pmra, pmdec, epoch = GAIA_EPOCH) {
  const years = CATALOGUE_EPOCH - epoch;
  const dec = decDeg + (pmdec || 0) * years / 3.6e6;
  const ra = raDeg + (pmra || 0) * years / 3.6e6 / Math.cos(decDeg * Math.PI / 180);
  return [(ra % 360 + 360) % 360, dec];
}

export function equatorialToCartesian(raDeg, decDeg, dist) {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  const coordinate = value => Number((dist * value).toPrecision(7));
  return [coordinate(Math.cos(dec) * Math.cos(ra)), coordinate(Math.cos(dec) * Math.sin(ra)), coordinate(Math.sin(dec))];
}

// Construye el registro de una anfitriona o devuelve { skip: motivo }.
export function buildHost({ host, system, gaia }) {
  const planets = system?.p || [];
  const onlyMicrolensing = planets.length > 0 && planets.every(p => p.dm === 'Microlensing');
  if (onlyMicrolensing && !gaia) return { skip: 'microlente sin estrella catalogada' };
  const src = {};
  let ra, dec;
  if (gaia && num(gaia.ra) !== null && num(gaia.dec) !== null) {
    [ra, dec] = propagateToJ2000(num(gaia.ra), num(gaia.dec), num(gaia.pmra), num(gaia.pmdec), num(gaia.ref_epoch) ?? GAIA_EPOCH);
    src.pos = num(gaia.pmra) !== null ? 'Gaia DR3, propagada a J2000' : 'Gaia DR3 (época 2016, sin movimiento propio)';
  } else if (system && num(system.ra) !== null && num(system.dec) !== null) {
    [ra, dec] = [system.ra, system.dec];
    src.pos = 'NASA Exoplanet Archive (sin propagar)';
  } else return { skip: 'sin posición' };

  const plx = gaia && num(gaia.parallax), plxE = gaia && num(gaia.parallax_error);
  let d;
  if (plx > 0 && plxE > 0 && plx / plxE > MIN_PARALLAX_SNR) { d = 1000 / plx; src.d = 'paralaje Gaia DR3'; }
  else if (system && system.dNasa > 0) { d = system.dNasa; src.d = 'NASA sy_dist'; }
  else return { skip: 'sin distancia fiable' };

  const g = gaia && num(gaia.phot_g_mean_mag), bpRp = gaia && num(gaia.bp_rp);
  let v = vFromGaia(g, bpRp);
  if (v !== null) src.v = 'G y BP−RP de Gaia (Riello et al. 2021)';
  else if (system && num(system.v) !== null) { v = system.v; src.v = 'NASA sy_vmag'; }
  else if (g !== null) { v = g; src.v = 'G de Gaia usada como V (sin color)'; }
  else return { skip: 'sin magnitud' };

  const teffNasa = system?.st?.teff ?? null, teffGaia = gaia ? num(gaia.teff_gspphot) : null;
  const teff = teffNasa ?? teffGaia;
  const bv = teff ? temperatureToBv(teff) : null;
  // Sin temperatura no hay color: igual que el generador base, B−V = 0 y blanco, declarado.
  src.c = bv !== null ? `inversa de Ballesteros (2012) desde Teff ${teffNasa ? 'NASA' : 'Gaia'}` : 'sin temperatura: sin color medido';

  const [x, y, z] = equatorialToCartesian(ra, dec, d);
  return {
    n: d <= NAMED_WITHIN_PC ? host.h : null,
    x, y, z,
    d: Number(d.toPrecision(7)),
    m: Number((v - 5 * Math.log10(d / 10)).toFixed(3)),
    c: bv ?? 0,
    sp: system?.st?.sp || host.simbad?.sp || null,
    rgb: bv !== null ? temperatureToRgb(teff) : [255, 255, 255],
    h: host.h,
    dataOrigin: 'exoplanet-host',
    gaia: host.gaia,
    src,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const read = file => parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true });
  const hosts = JSON.parse(fs.readFileSync(HOSTS_JSON, 'utf8')).hosts;
  const systems = new Map(JSON.parse(fs.readFileSync(SYSTEMS_JSON, 'utf8')).systems.map(s => [s.h, s]));
  const gaiaBySource = new Map(read(GAIA_HOSTS_CSV).map(g => [g.source_id, g]));
  const maxAthygId = Math.max(...read(ATHYG_CSV).map(r => Number(r.id)));
  if (maxAthygId >= ADDED_HOST_ID_BASE) throw new Error(`El rango ${ADDED_HOST_ID_BASE} colisiona con AT-HYG (máx. ${maxAthygId})`);

  const added = [], skipped = {}, shared = [];
  const byGaia = new Map();
  const missing = hosts.filter(h => h.i === null).sort((a, b) => a.h < b.h ? -1 : a.h > b.h ? 1 : 0);
  for (const host of missing) {
    // Dos anfitriones con la misma fuente Gaia (componentes sin resolver) comparten estrella.
    if (host.gaia && byGaia.has(host.gaia)) {
      const first = byGaia.get(host.gaia);
      first.hosts.push(host.h);
      shared.push(`${first.h} / ${host.h}`);
      continue;
    }
    const record = buildHost({ host, system: systems.get(host.h), gaia: host.gaia ? gaiaBySource.get(host.gaia) : null });
    if (record.skip) { (skipped[record.skip] ||= []).push(host.h); continue; }
    const star = { i: ADDED_HOST_ID_BASE + added.length + 1, ...record, hosts: [host.h],
      alias: [...new Set([host.h, ...host.alias.map(a => a.replace(/^NAME /, ''))])] };
    added.push(star);
    if (host.gaia) byGaia.set(host.gaia, star);
  }
  const tally = key => added.reduce((o, s) => ({ ...o, [s.src[key]]: (o[s.src[key]] || 0) + 1 }), {});
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    meta: {
      descripcion: 'Anfitrionas de exoplanetas ausentes de AT-HYG, en el formato de stars_15pc.json',
      marco: 'pc, ecuatorial J2000, Sol en el origen',
      ids: `${ADDED_HOST_ID_BASE} + n, por orden alfabético del anfitrión; cambian si cambia la tabla de la NASA`,
      generado: new Date().toISOString(),
      total: added.length, conNombreVisible: added.filter(s => s.n).length,
      procedencia: { posicion: tally('pos'), distancia: tally('d'), magnitud: tally('v'), color: tally('c') },
      excluidos: Object.fromEntries(Object.entries(skipped).map(([k, v]) => [k, v.length])),
      fuenteGaiaCompartida: shared,
    },
    stars: added,
    excluidos: skipped,
  }));
  console.log(`✓ Anfitrionas añadidas: ${added.length} de ${missing.length} ausentes (${added.filter(s => s.n).length} con nombre visible)`);
  console.log(`✓ Excluidas: ${JSON.stringify(Object.fromEntries(Object.entries(skipped).map(([k, v]) => [k, v.length])))}; fuente compartida: ${shared.length}`);
}
