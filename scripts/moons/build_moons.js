// Genera data/processed/moons.json: lunas de Júpiter y Saturno con órbita y tamaño.
// Uso: node scripts/moons/build_moons.js (lee data/moons/fuentes/, no descarga nada).
//
// Órbita: forma (a, e), plano (i, nodo, marco) y periodos de precesión de los elementos
// medios de JPL (https://ssd.jpl.nasa.gov/sats/elem/, época J2000). Propagados solos desde
// el año 2000 se apartan decenas de grados (periodo con 7 cifras, signo de las precesiones
// no publicado), así que se llevan a la época ANCHOR_JD y la fase y el movimiento medio se
// ajustan por mínimos cuadrados a 25 posiciones de JPL Horizons (vectores centrados en el
// planeta, ICRF, cada 15 días desde ANCHOR_JD durante un año: inner.json); también se elige así
// el signo de las precesiones, que la tabla no publica.
// Las lunas exteriores (a > 1,4 millones de km: Hiperión, Jápeto, Febe y todas las irregulares)
// no siguen bien una elipse media: la del Sol las perturba varios grados en semanas. Para ellas
// se guardan elementos osculadores de Horizons (centro del planeta, ICRF) cada 60 días entre
// 2026-09-01 y 2030-01-01, y la aplicación propaga como mucho 30 días desde el más cercano.
// Tamaño: radio medio de JPL (https://ssd.jpl.nasa.gov/sats/phys_par/) si existe; si no, el
// diámetro de la tabla de «Moons of Jupiter/Saturn» (Wikipedia, que recopila Grav et al.
// 2015, Thomas 2010 y el sitio de S. Sheppard), marcado como estimado cuando la tabla lo
// marca con «≈» (estimación por brillo con albedo supuesto).
import fs from 'node:fs';
import path from 'node:path';
import { moonOffsetKm as runtimeOffsetKm } from '../../src/scene/moonEphemeris.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'data/moons/fuentes');
const OUT = path.join(ROOT, 'public/data/moons.json');
// Lunas exteriores: elementos osculadores de Horizons cada 60 días (oscall.mjs).
const OUTER_KM = 1.4e6;
export const ANCHOR_JD = 2461327.5, CHECK_JD = 2461357.5, RATE_JD = 2461692.5;
const J2000_JD = 2451545.0;
const R = Math.PI / 180, OBLIQUITY = 23.43928 * R;
const read = name => JSON.parse(fs.readFileSync(path.join(SRC, name), 'utf8'));

// Nombres en español de las lunas con nombre tradicional; las demás conservan el de la IAU.
const SPANISH = { Io: 'Ío', Ganymede: 'Ganimedes', Callisto: 'Calisto', Amalthea: 'Amaltea', Thebe: 'Tebe',
  Enceladus: 'Encélado', Tethys: 'Tetis', Rhea: 'Rea', Titan: 'Titán', Hyperion: 'Hiperión', Iapetus: 'Jápeto',
  Phoebe: 'Febe', Janus: 'Jano', Epimetheus: 'Epimeteo', Helene: 'Helena', Calypso: 'Calipso', Prometheus: 'Prometeo',
  Methone: 'Metone', Pallene: 'Palene', Polydeuces: 'Pólux', Daphnis: 'Dafnis', Aegaeon: 'Egeón', Magaclite: 'Megaclite',
  Ymir: 'Ymir', Elara: 'Elara', Pasiphae: 'Pasífae', Sinope: 'Sinope', Lysithea: 'Lisitea', Carme: 'Carmé', Ananke: 'Ananké',
  Leda: 'Leda', Callirrhoe: 'Calírroe', Themisto: 'Temisto', Taygete: 'Taigete', Harpalyke: 'Harpálice' };
// Color ilustrativo aproximado de las lunas grandes; el resto, gris.
const COLORS = { Io: '#e6d27a', Europa: '#d9cdb4', Ganymede: '#a89c8c', Callisto: '#6f6455', Amalthea: '#a6574a',
  Titan: '#d9a35b', Enceladus: '#f2f2f2', Iapetus: '#a59a86', Phoebe: '#5b5550', Hyperion: '#b0a08a',
  Mimas: '#c7c7c2', Tethys: '#e3e3de', Dione: '#d6d6d0', Rhea: '#c9c6bf' };

const designation = name => name.replace(/^S(\d{4})_([JS])_(\d+)$/, 'S/$1 $2 $3');
const strip = value => value.replace(/\{\{(?:dsv|sort)\|([^|}]*)[^}]*\}\}\|?/g, '$1 ').replace(/&thinsp;|&nbsp;/g, ' ');

// La tabla de JPL corta los nombres a 12 letras («Philophrosyn»): si la fila de tamaños trae el
// mismo nombre más largo, se usa ese.
const fullName = (label, size) => size && size.id.length > label.length && size.id.startsWith(label) ? size.id : label;

function wikiSizes(planet) {
  const text = fs.readFileSync(path.join(SRC, `wiki_${planet}.txt`), 'utf8');
  // Las filas de las lunas irregulares llevan `id`; las de las regulares de Saturno, `{{hid|Nombre}}`.
  return text.split(/\n\|-/).filter(row => /^ id="|\{\{hid\|/.test(row.split('\n')[1] || '') || /^ id="/.test(row)).map(row => {
    const id = row.match(/^ id="([^"]+)"/)?.[1] || row.match(/\{\{hid\|([^}]+)\}\}/)[1];
    const cells = row.slice(row.indexOf('\n') + 1).split('\n\n')[0].replace(/\n\|/g, '||').replace(/^\|/, '').split('||').map(c => c.trim());
    const a = Number(cells[7]?.match(/val\|(\d+)/)?.[1]);
    const H = Number(cells[4]);
    const sizeCell = cells[5] || '';
    const diameter = Number(strip(sizeCell).match(/\d+(?:\.\d+)?/)?.[0]);
    return { id, a, H: Number.isFinite(H) ? H : null, diameterKm: Number.isFinite(diameter) ? diameter : null,
      estimated: sizeCell.includes('≈') };
  });
}

// Base del marco de referencia de los elementos, en ICRF.
function frameBasis(row) {
  if (row.frame === 'ecliptic') return [[1, 0, 0], [0, Math.cos(OBLIQUITY), Math.sin(OBLIQUITY)], [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)]];
  const A = row.poleRa * R, D = row.poleDec * R;
  const X = [-Math.sin(A), Math.cos(A), 0], Z = [Math.cos(D) * Math.cos(A), Math.cos(D) * Math.sin(A), Math.sin(D)];
  return [X, [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]], Z];
}
const toFrame = (basis, v) => basis.map(axis => axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]);
const fromFrame = (basis, p) => [0, 1, 2].map(k => p[0] * basis[0][k] + p[1] * basis[1][k] + p[2] * basis[2][k]);
const wrap = deg => ((deg % 360) + 540) % 360 - 180;

// Posición (km, ICRF, centrada en el planeta) con elementos en una época y sus ritmos (°/día).
export function moonOffsetKm(m, jd) {
  const dt = jd - m.epoch;
  const w = (m.w + m.dw * dt) * R, node = (m.node + m.dnode * dt) * R, inc = m.i * R, M = (m.M + m.n * dt) * R;
  let E = M + m.e * Math.sin(M);
  for (let k = 0; k < 30; k++) { const step = (E - m.e * Math.sin(E) - M) / (1 - m.e * Math.cos(E)); E -= step; if (Math.abs(step) < 1e-14) break; }
  const x = m.a * (Math.cos(E) - m.e), y = m.a * Math.sqrt(1 - m.e ** 2) * Math.sin(E);
  const u = x * Math.cos(w) - y * Math.sin(w), v = x * Math.sin(w) + y * Math.cos(w);
  const p = [u * Math.cos(node) - v * Math.sin(node) * Math.cos(inc), u * Math.sin(node) + v * Math.cos(node) * Math.cos(inc), v * Math.sin(inc)];
  return fromFrame(m.basis, p);
}

// Anomalía media que pone la luna en la dirección observada, proyectada sobre su plano.
function meanAnomalyAt(m, jd, observed) {
  const dt = jd - m.epoch;
  const node = (m.node + m.dnode * dt) * R, inc = m.i * R, w = m.w + m.dw * dt;
  const p = toFrame(m.basis, observed);
  const x1 = p[0] * Math.cos(node) + p[1] * Math.sin(node), y1 = -p[0] * Math.sin(node) + p[1] * Math.cos(node);
  const y2 = y1 * Math.cos(inc) + p[2] * Math.sin(inc);
  const nu = (Math.atan2(y2, x1) / R - w) * R;
  const E = 2 * Math.atan2(Math.sqrt(1 - m.e) * Math.sin(nu / 2), Math.sqrt(1 + m.e) * Math.cos(nu / 2));
  return (E - m.e * Math.sin(E)) / R;
}

const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)))) / R;

function fit(row, hz, series) {
  const base = { a: row.a, e: row.e, i: row.i, frame: row.frame, poleRa: row.poleRa, poleDec: row.poleDec, basis: frameBasis(row) };
  const t0 = ANCHOR_JD - J2000_JD;
  const tableRate = 360 / row.P;
  const at = jd => hz?.find(entry => Math.abs(entry[0] - jd) < 1e-6)?.slice(1);
  const anchor = at(ANCHOR_JD), check = at(CHECK_JD), later = at(RATE_JD), start = at(J2000_JD);
  let best = null;
  for (const sw of [1, -1]) for (const sn of [1, -1]) {
    // En órbitas casi circulares (e ≤ 0,005) el periápside no cambia la posición y algunos periodos
    // de la tabla son absurdos (Tetis: 0,005 años): se deja fijo.
    const dw = row.Papsis && (row.e > 0.005 || !series) ? sw * 360 / (row.Papsis * 365.25) : 0, dnode = row.Pnode ? sn * 360 / (row.Pnode * 365.25) : 0;
    const m = { ...base, epoch: ANCHOR_JD, dw, dnode, w: (row.w + dw * t0) % 360, node: (row.node + dnode * t0) % 360, n: tableRate, M: 0 };
    if (!anchor) {
      // Sin efeméride en Horizons: elementos medios propagados desde J2000 (anomalía a 360/P).
      m.M = (row.M + tableRate * t0) % 360;
      if (sw === 1 && sn === -1) best = { m, score: 0, anchored: false };
      continue;
    }
    m.M = meanAnomalyAt(m, ANCHOR_JD, anchor);
    if (series) {
      // Lunas interiores: ajuste por mínimos cuadrados de M0 y n a 25 posiciones de Horizons
      // (cada 15 días durante un año), con las vueltas contadas paso a paso.
      const step = series[1][0] - series[0][0];
      // La anomalía media de la tabla avanza a 360/P (comprobado con Ío, Ganimedes y Calisto), con
      // precisión de 1e-6: se cuentan las vueltas con ese ritmo, sin la ambigüedad de ±24°/día que
      // dejaría el muestreo de 15 días. El signo de las precesiones lo decide el residuo.
      const solve = trial => {
        const observedM = series.map(entry => meanAnomalyAt(trial, entry[0], entry.slice(1)));
        const unwrapped = [observedM[0]];
        for (let k = 1; k < observedM.length; k++) {
          const predicted = unwrapped[k - 1] + tableRate * step;
          unwrapped.push(predicted + wrap(observedM[k] - predicted));
        }
        const t = series.map(entry => entry[0] - ANCHOR_JD);
        const meanT = t.reduce((a, b) => a + b) / t.length, meanM = unwrapped.reduce((a, b) => a + b) / t.length;
        const n = t.reduce((sum, value, k) => sum + (value - meanT) * (unwrapped[k] - meanM), 0) / t.reduce((sum, value) => sum + (value - meanT) ** 2, 0);
        const candidate = { ...trial, n, M: meanM - n * meanT };
        const residual = series.reduce((sum, entry) => {
          const p = moonOffsetKm(candidate, entry[0]);
          return sum + ((p[0] - entry[1]) ** 2 + (p[1] - entry[2]) ** 2 + (p[2] - entry[3]) ** 2) / row.a ** 2;
        }, 0);
        return { candidate, residual };
      };
      // El nodo y el periápside de la tabla, propagados 27 años con periodos de 3–4 cifras, pueden
      // estar desfasados decenas de grados: se ajustan también (rejilla de 2° y después de 0,25°).
      let current = solve(m);
      const scan = (key, offsets) => {
        const origin = current.candidate[key];
        for (const offset of offsets) {
          const trial = solve({ ...current.candidate, [key]: (origin + offset + 360) % 360 });
          if (trial.residual < current.residual) current = trial;
        }
      };
      const grid = Array.from({ length: 180 }, (_, k) => k * 2), fine = Array.from({ length: 17 }, (_, k) => (k - 8) * 0.25);
      if (row.i > 0) scan('node', grid);
      if (row.e > 0.005) scan('w', grid);
      if (row.i > 0) scan('node', fine);
      if (row.e > 0.005) scan('w', fine);
      if (!best || current.residual < best.score) best = { m: current.candidate, score: current.residual, anchored: true };
      continue;
    }
    // Vueltas entre el ancla y +30 d: el periodo de JPL las cuenta salvo por las precesiones
    // rápidas de signo desconocido; se prueban las cuentas posibles y decide el residuo.
    const at30 = meanAnomalyAt(m, CHECK_JD, check), at365 = meanAnomalyAt(m, RATE_JD, later);
    const base30 = tableRate * 30 + wrap(at30 - (m.M + tableRate * 30));
    const spread = Math.ceil((2 * Math.abs(dw) + 2 * Math.abs(dnode)) * 30 / 360) + 1;
    for (let turns = -spread; turns <= spread; turns++) {
      const candidate = { ...m };
      const predicted = m.M + (base30 + 360 * turns) / 30 * 365;
      candidate.n = (predicted + wrap(at365 - predicted) - m.M) / 365;
      const residual = [anchor, check, later].reduce((sum, v, k) => {
        const p = moonOffsetKm(candidate, [ANCHOR_JD, CHECK_JD, RATE_JD][k]);
        return sum + ((p[0] - v[0]) ** 2 + (p[1] - v[1]) ** 2 + (p[2] - v[2]) ** 2) / row.a ** 2;
      }, 0);
      if (!best || residual < best.score) best = { m: candidate, score: residual, anchored: true };
    }
  }
  const { m } = best;
  const quality = best.anchored ? { checkDeg: angle(moonOffsetKm(m, CHECK_JD), check), rateDeg: angle(moonOffsetKm(m, RATE_JD), later) } : null;
  // Error de los elementos medios propagados sin ancla, como referencia: posición en J2000.
  if (start) {
    const mean = { ...base, epoch: J2000_JD, w: row.w, node: row.node, M: row.M, n: 0, dw: 0, dnode: 0 };
    quality && (quality.j2000MeanDeg = angle(moonOffsetKm(mean, J2000_JD), start));
  }
  return { m, anchored: best.anchored, quality };
}

export function build() {
  const elements = read('elem.json').filter(row => row[1] === 'Jupiter' || row[1] === 'Saturn');
  const physical = new Map(read('phys.json').slice(2).map(row => [row[2], Number(row[4].split(' ')[0])]));
  const horizons = read('hz.json');
  const osculating = read('osc.json');
  const inner = read('inner.json');
  const sizes = { Jupiter: wikiSizes('Jupiter'), Saturn: wikiSizes('Saturn') };
  const moons = [], report = [];
  for (const cells of elements) {
    const [, planet, name, code, ephemeris, frame] = cells;
    const [a, e, w, M, i, node, P, Papsis, Pnode, poleRa, poleDec] = cells.slice(7, 18).map(Number);
    const row = { a, e, w, M, i, node, P, Papsis, Pnode, poleRa, poleDec, frame };
    const hz = Array.isArray(horizons[code]) ? horizons[code] : null;
    const series = Array.isArray(inner[code]) ? inner[code] : null;
    const { m, anchored, quality } = fit(row, hz, series);
    const sets = a > OUTER_KM && Array.isArray(osculating[code]) ? osculating[code]
      // Una luna muy excéntrica (S/2023 S 38, e ≈ 0,9) sale hiperbólica en un conjunto: se descarta.
      .filter(set => set[1] < 1 && set[7] > 0).map(set => [set[0], +set[1].toFixed(6),
      +set[2].toFixed(4), +set[3].toFixed(4), +set[4].toFixed(4), +set[5].toPrecision(9), +set[6].toFixed(4), +set[7].toPrecision(7)]) : null;
    const label = designation(name);
    const size = sizes[planet].find(s => Math.abs(s.a - a) < 0.5 && (s.id === label || s.id.includes(label) || label.includes(s.id)))
      || sizes[planet].find(s => s.id === label || s.id === name) || sizes[planet].find(s => Math.abs(s.a - a) < 0.5);
    const jplRadius = physical.get(code);
    let radiusKm = null, size_status = 'unknown';
    if (Number.isFinite(jplRadius)) { radiusKm = jplRadius; size_status = 'jpl'; }
    else if (size?.diameterKm) { radiusKm = size.diameterKm / 2; size_status = size.estimated ? 'estimated' : 'published'; }
    const moon = {
      planet: planet === 'Jupiter' ? 'Júpiter' : 'Saturno', name: SPANISH[name] || fullName(label, size), iau: label, code: Number(code), ephemeris,
      ...(sets ? { sets } : { frame, epoch: m.epoch, a: m.a, e: m.e, i: m.i,
        node: +m.node.toFixed(6), w: +m.w.toFixed(6), M: +((m.M % 360 + 360) % 360).toFixed(6),
        n: +m.n.toFixed(9), dnode: +m.dnode.toFixed(9), dw: +m.dw.toFixed(9),
        ...(frame !== 'ecliptic' && { poleRa, poleDec }), anchored }),
      radiusKm, size: size_status, ...(size?.H != null && { H: size.H }),
      color: COLORS[name] || (a > 5e6 ? '#77726b' : '#a7a49d'),
    };
    // Comprobación con lo que calculará la aplicación: ángulo visto desde el planeta frente a
    // Horizons en el ancla, +30 d y +365 d (en las exteriores, +30 d y +365 d no se ajustaron).
    const checks = hz ? hz.slice(1).map(entry => angle(runtimeOffsetKm(moon, entry[0]), entry.slice(1))) : null;
    if (checks) moon.errDeg = +Math.max(...checks).toFixed(2);
    moons.push(moon);
    report.push({ name: label, code, model: sets ? 'osculating' : anchored ? 'mean+anchor' : 'mean', checks, ...quality, size: size_status, matched: Boolean(size) });
  }
  moons.sort((x, y) => x.planet.localeCompare(y.planet) || x.a - y.a);
  return { moons, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { moons, report } = build();
  const output = { anchorJd: ANCHOR_JD, source: { elements: 'https://ssd.jpl.nasa.gov/sats/elem/', physical: 'https://ssd.jpl.nasa.gov/sats/phys_par/', horizons: 'https://ssd.jpl.nasa.gov/horizons/' }, moons };
  fs.writeFileSync(OUT, JSON.stringify(output));
  fs.writeFileSync(path.join(ROOT, 'data/moons/build_report.json'), JSON.stringify(report, null, 1));
  const worst = [...report].filter(r => r.checks).sort((x, y) => Math.max(...y.checks) - Math.max(...x.checks)).slice(0, 10);
  console.log(`${moons.length} lunas`, Object.fromEntries(Object.entries(Object.groupBy(report, r => r.model)).map(([k, v]) => [k, v.length])),
    Object.fromEntries(Object.entries(Object.groupBy(report, r => r.size)).map(([k, v]) => [k, v.length])));
  console.log('mayor error (ancla, +30 d, +365 d):', worst.map(r => `${r.name} ${r.checks.map(v => v.toFixed(2)).join('/')}`).join(', '));
  console.log('sin tamaño:', report.filter(r => r.size === 'unknown').map(r => r.name).join(', '));
}
