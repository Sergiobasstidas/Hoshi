// scripts/catalog/distancia_sistemas.js
// Una sola distancia por sistema cuando sus compañeras son estrellas propias del registro HSB.
// Cada estrella trae su propia paralaje y, con el error de medida, las componentes de un par ancho quedaban a
// fracciones de pársec unas de otras (y la app ya no las unía con su línea). Para los sistemas de
// star_systems.json con alguna compañera nueva del registro (i ≥ 100 000 000), todas las componentes con
// estrella propia pasan a la distancia de la paralaje común: el promedio de sus paralajes medidas con error
// ≤ 10 %, ponderado por el inverso del error al cuadrado (si solo una sirve, esa). Solo entran las paralajes que
// concuerdan con la de la primaria (diferencia de hasta 3 veces el error combinado o 10 %); una componente que
// no concuerda conserva su distancia. Si la primaria satura a Gaia (G < 4, o V < 4 sin G) y tiene distancia propia
// confiable, no entra la paralaje de Gaia de una compañera a menos de 30″, que su brillo contamina: el sistema toma
// la de la primaria. Es una medición combinada,
// no un modelo (regla D-014). Si una componente tiene distancia curada, el sistema usa esa. Cada estrella
// conserva su posición en el cielo; la magnitud absoluta se recalcula. Las separaciones del sistema en UA
// (semieje `a` de las órbitas, con su masa dinámica, y `rho` de los pares anchos) se escalan con la distancia de la primaria, para que
// la separación angular medida no cambie.
// Corre después de scripts/process_binaries.js y reescribe stars_15pc.json, star_systems.json y hsb_fuentes.csv.gz.

import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { applyDistance } from './catalog_patches.js';
import { DISTANCIAS_CURADAS } from './distancias_curadas.js';
import { paralajeMedida } from './fusion.js';

const HSB_NUEVO_BASE = 100_000_000;
export const FUENTE_SISTEMA = 'sistema (paralaje común)';
const G_SATURA = 4, CONTAMINACION_ARCSEC = 30;
const separacionArcsec = (a, b) => Math.acos(Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)))) * 648000 / Math.PI;
const STARS = './data/processed/stars_15pc.json', SISTEMAS = './data/processed/star_systems.json';
const REGISTRO = './data/catalog/hsb_registro.csv', FUENTES = './data/catalog/hsb_fuentes.csv.gz';
const GAIA = './data/raw/gaia/gaia_dr3_registro.csv.gz', HIP = './data/raw/hipparcos/hipparcos_2007.csv.gz', CNS5 = './data/raw/cns5/cns5_main.csv';

// Paralaje común ponderada por 1/σ². medidas: [{ plx, err }].
export function paralajeComun(medidas) {
  const utiles = medidas.filter(m => m && m.plx > 0 && m.err > 0);
  if (!utiles.length) return null;
  const pesos = utiles.map(m => 1 / m.err ** 2);
  const suma = pesos.reduce((a, b) => a + b, 0);
  return { plx: utiles.reduce((a, m, k) => a + m.plx * pesos[k], 0) / suma, err: 1 / Math.sqrt(suma), n: utiles.length };
}

// ¿Concuerdan dos paralajes? Diferencia de hasta 3σ combinados o 10 %.
export const concuerdan = (a, b) => Math.abs(a.plx - b.plx) <= Math.max(3 * Math.hypot(a.err, b.err), 0.1 * Math.max(a.plx, b.plx));

// Sistemas a unificar: los que tienen alguna compañera nueva del registro. Miembros: la primaria y las
// compañeras con estrella propia.
export function sistemasConEstrellaNueva(sistemas) {
  return Object.entries(sistemas).filter(([, s]) => s.comps.some(c => c.cid >= HSB_NUEVO_BASE))
    .map(([clave, s]) => [Number(clave), ...s.comps.filter(c => c.cid !== undefined).map(c => c.cid)]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const csvGz = ruta => parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'), { columns: true, skip_empty_lines: true });
  const stars = JSON.parse(fs.readFileSync(STARS, 'utf8'));
  const sistemas = JSON.parse(fs.readFileSync(SISTEMAS, 'utf8'));
  const registro = new Map(parse(fs.readFileSync(REGISTRO, 'utf8'), { columns: true }).map(r => [Number(r.hsb), r]));
  const gaia = new Map(csvGz(GAIA).map(g => [g.source_id, g]));
  const hip = new Map(csvGz(HIP).map(h => [h.hip, h]));
  const filasCns5 = parse(fs.readFileSync(CNS5, 'utf8'), { columns: true });
  const cns5 = { porGaia: new Map(filasCns5.filter(r => r.gaia_edr3_id).map(r => [r.gaia_edr3_id, r])), porGl: new Map(filasCns5.map(r => [`${r.gj_id}${r.component_id}`, r])) };
  const curada = new Map(DISTANCIAS_CURADAS.map(c => [c.i, c]));
  const fuentes = new Map(csvGz(FUENTES).map(f => [Number(f.hsb), f]));
  const porId = new Map(stars.map((s, k) => [s.i, k]));
  let primariaBrillante = 0, unificados = 0, sinParalaje = 0, conCurada = 0, movidas = 0, discordantes = 0, contaminadas = 0;
  const vistos = new Set();
  for (const miembros of sistemasConEstrellaNueva(sistemas)) {
    const primaria = miembros[0], dPrimaria = porId.has(primaria) ? stars[porId.get(primaria)].d : null;
    const ids = [...new Set(miembros)].filter(i => porId.has(i) && !vistos.has(i));
    if (ids.length < 2) continue;
    let d;
    const cur = ids.map(i => curada.get(i)).find(Boolean);
    if (cur) { d = cur.dNueva; conCurada++; }
    else {
      const medida = new Map(ids.map(i => [i, registro.get(i) ? paralajeMedida(registro.get(i), { gaia, hip, cns5 }) : null]));
      // Primaria brillante con distancia propia confiable (curada, o paralaje con error ≤ 10 %): fuera las paralajes de
      // Gaia de compañeras cercanas. Si la primaria no la tiene, la de la compañera es la única medición buena y se usa.
      const p = porId.has(primaria) ? stars[porId.get(primaria)] : null, gp = registro.get(primaria)?.gaia_dr3 && gaia.get(registro.get(primaria).gaia_dr3);
      const G = gp && gp.phot_g_mean_mag !== '' ? Number(gp.phot_g_mean_mag) : p && p.d > 0 ? p.m + 5 * Math.log10(p.d / 10) : Infinity;
      if (p && G < G_SATURA && medida.get(primaria)) {
        for (const i of ids) {
          if (i === primaria || medida.get(i)?.fuente !== 'Gaia DR3') continue;
          if (separacionArcsec(p, stars[porId.get(i)]) < CONTAMINACION_ARCSEC) { medida.set(i, null); contaminadas++; }
        }
      }
      // La referencia es la primaria; sin paralaje propia, la de menor error del sistema.
      const ref = medida.get(primaria) || [...medida.values()].filter(Boolean).sort((a, b) => a.err - b.err)[0];
      // Primaria brillante sin paralaje propia útil: el sistema toma la distancia que ya tiene la primaria.
      if (!ref && p && G < G_SATURA && p.d > 0) { d = p.d; primariaBrillante++; }
      else if (!ref) { sinParalaje++; continue; }
      else {
      const fuera = ids.filter(i => medida.get(i) && !concuerdan(medida.get(i), ref));
      discordantes += fuera.length;
      for (const i of fuera) ids.splice(ids.indexOf(i), 1);
      if (ids.length < 2) continue;
      const comun = paralajeComun(ids.map(i => medida.get(i)));
      d = Number((1000 / comun.plx).toPrecision(7));
      }
    }
    unificados++;
    if (dPrimaria > 0 && d !== dPrimaria) {
      const f = d / dPrimaria;
      for (const c of sistemas[primaria].comps) {
        // La masa dinámica de una órbita es a³/P²: escala con el cubo.
        if (c.k === 'o') { c.a = Number((c.a * f).toPrecision(6)); if (c.mass) c.mass = Number((c.mass * f ** 3).toPrecision(3)); }
        else c.rho = Number((c.rho * f).toPrecision(5));
      }
    }
    for (const i of ids) {
      vistos.add(i);
      const k = porId.get(i);
      if (stars[k].d === d) continue;
      const fuenteAnterior = stars[k].ds;
      stars[k] = applyDistance(stars[k], d, cur ? cur.fuente : FUENTE_SISTEMA);
      // Igual que process_stars.js: `ds` solo se conserva en las anfitrionas añadidas y en las curadas.
      if (stars[k].dataOrigin !== 'exoplanet-host' && stars[k].dataOrigin !== 'curated' && !curada.has(i)) delete stars[k].ds;
      else if (fuenteAnterior && curada.has(i)) stars[k].ds = fuenteAnterior;
      const f = fuentes.get(i);
      if (f && !curada.has(i)) Object.assign(f, { d, fuente_d: cur ? cur.fuente : FUENTE_SISTEMA });
      movidas++;
    }
  }
  stars.sort((a, b) => a.d - b.d || a.i - b.i);
  fs.writeFileSync(STARS, JSON.stringify(stars));
  fs.writeFileSync(SISTEMAS, JSON.stringify(sistemas));
  const columnas = ['hsb', 'd', 'fuente_d', 'c', 'fuente_c', 'sp', 'fuente_sp'];
  const celda = v => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const filas = [...fuentes.values()].sort((a, b) => Number(a.hsb) - Number(b.hsb));
  fs.writeFileSync(FUENTES, zlib.gzipSync([columnas.join(','), ...filas.map(f => columnas.map(c => celda(f[c])).join(','))].join('\n') + '\n', { level: 9 }));
  console.log(`✓ Sistemas con distancia común: ${unificados} (${conCurada} con distancia curada); sin paralaje útil: ${sinParalaje}; con la distancia de su primaria brillante: ${primariaBrillante}; componentes con paralaje que no concuerda (conservan la suya): ${discordantes}; paralajes de Gaia junto a una primaria brillante que no entran: ${contaminadas}; estrellas movidas: ${movidas}`);
}
