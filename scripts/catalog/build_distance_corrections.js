// scripts/catalog/build_distance_corrections.js
// Decide, estrella por estrella, si la distancia de AT-HYG se sustituye por la de
// Gaia DR3. No modifica el catálogo: escribe data/catalog/distance_corrections.json,
// que scripts/process_stars.js aplica (catalog_patches.js) conservando la dirección.
// Uso: node scripts/catalog/build_distance_corrections.js
// Requiere data/catalog/star_identity.json (scripts/catalog/build_star_identity.js).

import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { vFromGaia } from './photometry.js';

const ATHYG_CSV = './data/raw/hyglike_from_athyg_v32.csv';
const IDENTITY_JSON = './data/catalog/star_identity.json';
const OUTPUT_PATH = './data/catalog/distance_corrections.json';

// Criterio: paralaje Gaia con señal/ruido > 10, astrometría de estrella simple
// (RUWE < 1,4), no saturada (G > 5) y discrepancia con Hoshi mayor del 10 %.
export const MIN_PARALLAX_SNR = 10;
export const MAX_RUWE = 1.4;
export const MIN_G_MAG = 5;
export const MIN_DISCREPANCY = 0.1;
// Salvaguarda del enlace: la V predicha desde Gaia debe parecerse a la de AT-HYG y el
// enlace por HIP no puede ser dudoso (más de un vecino o más de 1″).
export const MAX_MAG_DIFFERENCE = 1;

// Devuelve { apply, dGaia, motivo } para una estrella con astrometría Gaia `g`.
export function decideDistance({ dHoshi, mag, g, via, gq }) {
  if (!g || !(g.plx > 0) || !(g.plxE > 0)) return null;
  const dGaia = 1000 / g.plx;
  const discrepancy = Math.abs(dHoshi - dGaia) / dGaia;
  if (!(discrepancy > MIN_DISCREPANCY)) return null;
  const fails = [];
  if (!(g.plx / g.plxE > MIN_PARALLAX_SNR)) fails.push(`paralaje/error = ${(g.plx / g.plxE).toFixed(1)} ≤ ${MIN_PARALLAX_SNR}`);
  if (!(g.ruwe < MAX_RUWE)) fails.push(`RUWE = ${g.ruwe ?? 'sin dato'} ≥ ${MAX_RUWE}`);
  if (!(g.G > MIN_G_MAG)) fails.push(`G = ${g.G ?? 'sin dato'} ≤ ${MIN_G_MAG} (saturación)`);
  if (via === 'hip' && gq && (gq.vecinos > 1 || gq.sep > 1)) fails.push(`enlace HIP→Gaia dudoso (${gq.vecinos} vecinos, ${gq.sep}″)`);
  if (via === 'posicion' && gq?.val === 'mag') fails.push('enlace por posición validado solo con magnitud');
  const v = vFromGaia(g.G, g.bpRp);
  if (v === null || !Number.isFinite(mag)) fails.push('sin magnitud comparable');
  else if (Math.abs(v - mag) > MAX_MAG_DIFFERENCE) fails.push(`V predicha desde Gaia ${v.toFixed(2)} frente a ${mag} en AT-HYG`);
  return { apply: fails.length === 0, dGaia, discrepancy, motivo: fails.join('; ') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const identity = JSON.parse(fs.readFileSync(IDENTITY_JSON, 'utf8')).stars;
  const athyg = new Map(parse(fs.readFileSync(ATHYG_CSV, 'utf8'), { columns: true, skip_empty_lines: true }).map(r => [Number(r.id), r]));
  const corrections = [], rejected = [];
  for (const s of identity) {
    const r = athyg.get(s.i);
    const dHoshi = Number(r.dist);
    const decision = decideDistance({ dHoshi, mag: parseFloat(r.mag), g: s.g, via: s.via, gq: s.gq });
    if (!decision) continue;
    const base = { i: s.i, n: r.proper || r.gl || (r.hip && `HIP ${r.hip}`) || `AT-HYG ${s.i}`, gaia: s.gaia,
      dAnterior: dHoshi, fuenteAnterior: r.dist_src || null, dGaia: Number(decision.dGaia.toPrecision(6)),
      discrepancia: Number(decision.discrepancy.toFixed(3)) };
    if (decision.apply) corrections.push({ ...base, dNueva: base.dGaia, fuente: 'Gaia DR3',
      motivo: `paralaje ${s.g.plx} ± ${s.g.plxE} mas, RUWE ${s.g.ruwe}, G ${s.g.G}; enlace ${s.via}` });
    else rejected.push({ ...base, motivo: decision.motivo });
  }
  corrections.sort((a, b) => a.i - b.i);
  rejected.sort((a, b) => b.discrepancia - a.discrepancia);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    meta: {
      descripcion: 'Distancias de AT-HYG sustituidas por la paralaje de Gaia DR3 (d = 1000 / paralaje en mas)',
      criterio: `paralaje/error > ${MIN_PARALLAX_SNR}, RUWE < ${MAX_RUWE}, G > ${MIN_G_MAG}, discrepancia > ${MIN_DISCREPANCY * 100} %, enlace no dudoso y magnitud coherente (±${MAX_MAG_DIFFERENCE})`,
      generado: new Date().toISOString(),
      aplicadas: corrections.length, noAplicadas: rejected.length,
    },
    correcciones: corrections,
    // Discrepan más del 10 % pero no cumplen el criterio: se mantiene la distancia de Hoshi.
    noAplicadas: rejected,
  }, null, 1));
  const count = list => list.reduce((o, c) => ({ ...o, [c.fuenteAnterior || '?']: (o[c.fuenteAnterior || '?'] || 0) + 1 }), {});
  console.log(`✓ Correcciones: ${corrections.length} ${JSON.stringify(count(corrections))}; no aplicadas: ${rejected.length} ${JSON.stringify(count(rejected))}`);
}
