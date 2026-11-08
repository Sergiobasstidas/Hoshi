// scripts/catalog/fusion.js
// Elige cada dato de cada estrella con una regla fija y anota de dónde sale (plan del catálogo HSB,
// «De dónde sale cada dato»). La usa scripts/process_stars.js después de los parches del catálogo.
//
//  Distancia (regla D-014: 1/paralaje, nunca distancias de modelos):
//    1. curada (scripts/catalog/distancias_curadas.js);
//    2. Gaia DR3 del registro HSB, sin gaia_revisar, con error de paralaje ≤ 10 % y G ≥ 4 (en las más
//       brillantes Gaia satura y la paralaje no es fiable aunque su error formal sea chico);
//    3. Hipparcos (van Leeuwen 2007) con error ≤ 10 %;
//    4. la que ya tenía (AT-HYG, o la de la anfitriona añadida).
//  Color (B−V): Gaia BP−RP convertido con bvDesdeBpRp (una sola conversión para todas), con G ≥ 4; si no,
//    el B−V de Hipparcos/Tycho que trae AT-HYG.
//  Tipo espectral: SIMBAD (por HIP y luego por GJ) → el que ya tenía (AT-HYG o NASA).
//  La posición en el cielo y el brillo aparente V no cambian: la magnitud absoluta se recalcula con la
//  distancia nueva.
//
// Las estrellas que entraron al registro desde AT-HYG v4.0 y CNS5 se agregan con i = su número HSB, solo
// si tienen una paralaje medida con error ≤ 10 % (Gaia, Hipparcos o la de CNS5).

import { applyDistance } from './catalog_patches.js';
import { DISTANCIAS_CURADAS } from './distancias_curadas.js';
import { vFromGaia } from './photometry.js';
import { bvDesdeBpRp } from '../../src/scene/gaiaCapa.js';

export const ERROR_PARALAJE_MAX = 0.1;
export const G_SATURA = 4;
const FUENTE = { gaia: 'Gaia DR3', hip: 'Hipparcos (van Leeuwen 2007)', cns5: 'CNS5' };

const num = v => (v === undefined || v === null || v === '' ? null : Number(v));
const glClave = gl => {
  const m = String(gl || '').match(/^(?:[A-Za-z]+\s*)?(\d+(?:\.\d+)?)\s*([A-Za-z]*)$/);
  return m ? m[1] + m[2] : '';
};

// Fila de Gaia útil para distancia (o para color si `paraColor`).
export function gaiaUtil(g, { paraColor = false } = {}) {
  if (!g) return false;
  const plx = num(g.parallax), err = num(g.parallax_error), G = num(g.phot_g_mean_mag);
  if (G === null || G < G_SATURA) return false;
  if (paraColor) return num(g.bp_rp) !== null;
  return plx > 0 && err > 0 && err / plx <= ERROR_PARALAJE_MAX;
}
const hipUtil = h => h && num(h.plx) > 0 && num(h.e_plx) > 0 && num(h.e_plx) / num(h.plx) <= ERROR_PARALAJE_MAX;

// Paralaje medida de una estrella del registro, con la misma prioridad que la distancia: Gaia DR3, Hipparcos y,
// para las de CNS5, la de CNS5. Solo con error ≤ 10 %. Devuelve { plx, err, fuente } o null.
export function paralajeMedida(r, { gaia, hip, cns5 }) {
  const g = r.gaia_dr3 && !r.gaia_revisar ? gaia.get(r.gaia_dr3) : null;
  if (gaiaUtil(g)) return { plx: num(g.parallax), err: num(g.parallax_error), fuente: FUENTE.gaia };
  const h = r.hip ? hip.get(r.hip) : null;
  if (hipUtil(h)) return { plx: num(h.plx), err: num(h.e_plx), fuente: FUENTE.hip };
  const c5 = r.origen === 'cns5' && cns5 ? (r.gaia_dr3 && cns5.porGaia.get(r.gaia_dr3)) || cns5.porGl.get(glClave(r.gl)) : null;
  if (c5 && num(c5.parallax) > 0 && num(c5.parallax_error) > 0 && num(c5.parallax_error) / num(c5.parallax) <= ERROR_PARALAJE_MAX)
    return { plx: num(c5.parallax), err: num(c5.parallax_error), fuente: FUENTE.cns5 };
  return null;
}

// Color RGB desde B−V: Ballesteros (2012) y Tanner Helland, igual que process_stars.js.
function bvToTemperature(bv) { return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)); }
export function rgbDesdeBv(bv) {
  if (!Number.isFinite(bv)) return [255, 255, 255];
  const t = bvToTemperature(bv) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  return [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))));
}

function espectroSimbad(r, espectros) {
  if (r.hip && espectros.hip[r.hip]) return espectros.hip[r.hip];
  const gl = glClave(r.gl);
  return gl && espectros.gj[gl] ? espectros.gj[gl] : null;
}

// Posición de Gaia (época ref_epoch) llevada a J2000 con su movimiento propio. Grados.
function posicionGaiaJ2000(g) {
  const anos = 2000 - (num(g.ref_epoch) ?? 2016), dec = num(g.dec);
  return { ra: num(g.ra) + (num(g.pmra) || 0) * anos / 3.6e6 / Math.cos(dec * Math.PI / 180), dec: dec + (num(g.pmdec) || 0) * anos / 3.6e6 };
}
function cartesianas(raDeg, decDeg, d) {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180, c = v => Number((d * v).toPrecision(7));
  return { x: c(Math.cos(dec) * Math.cos(ra)), y: c(Math.cos(dec) * Math.sin(ra)), z: c(Math.sin(dec)) };
}

// stars: catálogo con parches; registro: Map hsb → fila; gaia: Map source_id → fila de gaia_source;
// hip: Map hip → fila de Hipparcos; espectros: data/catalog/espectros_simbad.json.
// Devuelve { estrellas, fuentes } (fuentes: una fila por estrella con el origen de cada dato).
export function fusionarBase(stars, { registro, gaia, hip, espectros }) {
  const curadas = new Set(DISTANCIAS_CURADAS.map(c => c.i));
  const fuentes = [];
  const estrellas = stars.map(s => {
    const r = registro.get(s.i);
    if (!r || s.dataOrigin === 'curated') { fuentes.push({ hsb: s.i, d: s.d, fuente_d: s.ds || 'AT-HYG', c: s.c, fuente_c: 'AT-HYG', sp: s.sp, fuente_sp: 'AT-HYG' }); return s; }
    let out = s, fd = s.ds || (r.origen === 'anfitriona' ? 'anfitriona' : 'AT-HYG');
    const g = r.gaia_dr3 && !r.gaia_revisar ? gaia.get(r.gaia_dr3) : null, h = r.hip ? hip.get(r.hip) : null;
    if (curadas.has(s.i)) fd = s.ds;
    else if (gaiaUtil(g)) { out = applyDistance(out, Number((1000 / num(g.parallax)).toPrecision(7)), FUENTE.gaia); fd = FUENTE.gaia; }
    else if (hipUtil(h)) { out = applyDistance(out, Number((1000 / num(h.plx)).toPrecision(7)), FUENTE.hip); fd = FUENTE.hip; }
    let fc = r.origen === 'anfitriona' ? 'anfitriona' : 'Hipparcos/Tycho (AT-HYG)';
    if (gaiaUtil(g, { paraColor: true })) {
      const c = Number(bvDesdeBpRp(num(g.bp_rp)).toFixed(3));
      out = { ...out, c, rgb: rgbDesdeBv(c) }; fc = 'Gaia DR3 BP−RP';
    }
    let fe = r.origen === 'anfitriona' ? 'anfitriona' : 'AT-HYG';
    const sp = espectroSimbad(r, espectros);
    if (sp) { out = { ...out, sp }; fe = 'SIMBAD'; }
    fuentes.push({ hsb: s.i, d: out.d, fuente_d: fd, c: out.c, fuente_c: fc, sp: out.sp, fuente_sp: fe });
    return out;
  });
  return { estrellas, fuentes };
}

// Estrellas del registro que entraron desde AT-HYG v4.0 o CNS5. v40: Map id → fila de AT-HYG v4.0;
// cns5: { porGaia, porGl } con filas de cns5.main.
export function estrellasNuevas(registro, { gaia, hip, espectros, v40, cns5 }) {
  const estrellas = [], fuentes = [], omitidas = {};
  const omitir = motivo => { omitidas[motivo] = (omitidas[motivo] || 0) + 1; };
  for (const r of registro.values()) {
    if (r.estado !== 'activa' || !['athyg_v40', 'cns5'].includes(r.origen)) continue;
    const g = r.gaia_dr3 && !r.gaia_revisar ? gaia.get(r.gaia_dr3) : null, h = r.hip ? hip.get(r.hip) : null;
    const f40 = r.athyg_v40 ? v40.get(Number(r.athyg_v40)) : null;
    const c5 = r.origen === 'cns5' ? (r.gaia_dr3 && cns5.porGaia.get(r.gaia_dr3)) || cns5.porGl.get(glClave(r.gl)) : null;
    let pos, d, v, fd;
    if (gaiaUtil(g)) {
      pos = posicionGaiaJ2000(g); d = 1000 / num(g.parallax); fd = FUENTE.gaia;
      v = vFromGaia(num(g.phot_g_mean_mag), num(g.bp_rp)) ?? num(f40?.mag);
    } else if (hipUtil(h) && f40) {
      pos = { ra: num(f40.ra) * 15, dec: num(f40.dec) }; d = 1000 / num(h.plx); fd = FUENTE.hip; v = num(f40.mag);
    } else if (c5 && num(c5.parallax) > 0 && num(c5.parallax_error) / num(c5.parallax) <= ERROR_PARALAJE_MAX) {
      const anos = 2000 - (num(c5.epoch) ?? 2000), dec = num(c5.dec);
      pos = { ra: num(c5.ra) + (num(c5.pmra) || 0) * anos / 3.6e6 / Math.cos(dec * Math.PI / 180), dec: dec + (num(c5.pmdec) || 0) * anos / 3.6e6 };
      d = 1000 / num(c5.parallax); fd = `${FUENTE.cns5} (${c5.parallax_bibcode})`;
      const bpRp = num(c5.bp_mag) !== null && num(c5.rp_mag) !== null ? num(c5.bp_mag) - num(c5.rp_mag) : null;
      v = vFromGaia(num(c5.g_mag), bpRp) ?? num(f40?.mag);
    } else { omitir('sin paralaje con error ≤ 10 %'); continue; }
    if (!Number.isFinite(v)) { omitir('sin magnitud'); continue; }
    d = Number(d.toPrecision(7));
    let c = num(f40?.ci), fc = f40?.ci ? 'AT-HYG v4.0' : 'sin color';
    if (gaiaUtil(g, { paraColor: true })) { c = Number(bvDesdeBpRp(num(g.bp_rp)).toFixed(3)); fc = 'Gaia DR3 BP−RP'; }
    else if (h && num(h.b_v) !== null) { c = num(h.b_v); fc = 'Hipparcos'; }
    const spSimbad = espectroSimbad(r, espectros);
    const sp = spSimbad || f40?.spect || null;
    const estrella = { i: r.hsb, n: r.nombre || null, ...cartesianas(((pos.ra % 360) + 360) % 360, pos.dec, d), d,
      m: Number((v - 5 * Math.log10(d / 10)).toFixed(3)), c: c ?? 0, sp, rgb: rgbDesdeBv(c ?? NaN), dataOrigin: r.origen, ds: fd };
    estrellas.push(estrella);
    fuentes.push({ hsb: r.hsb, d, fuente_d: fd, c: estrella.c, fuente_c: fc, sp, fuente_sp: spSimbad ? 'SIMBAD' : sp ? 'AT-HYG v4.0' : '' });
  }
  return { estrellas, fuentes, omitidas };
}
