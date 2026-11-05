// Genera public/data/probe-flybys.json: la curva de cada sonda alrededor de cada planeta que
// visitó, con centro en el planeta (src/scene/probeFlybys.js).
// Uso: node scripts/probes/build_flyby_curves.js (lee data/probes/sobrevuelos/, no descarga nada;
// para volver a descargar: node scripts/probes/fetch_flyby_curves.mjs).
// Cada 2 horas durante ± 30 días, cada 10 minutos durante ± 3 días y cada minuto durante ± 12 horas,
// en decenas de km.
import fs from 'node:fs';
import path from 'node:path';
import { ARC_UNIT_KM, FLYBY_UNIT_KM, encodeDeltas } from '../../src/scene/probeFlybys.js';
import { AU_KM } from '../../src/scene/scale.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'data/probes/sobrevuelos');
const OUT = path.join(ROOT, 'public/data/probe-flybys.json');

// Trayectoria real del planeta ± 60 días (fetch_flyby_arcs.mjs), respecto de su posición en el
// máximo acercamiento: así el arco pasa exactamente por el planeta de entonces. Cada día, en
// centenas de km y como diferencias entre muestras seguidas.
export function readArc(name, closestJd) {
  const rows = fs.readFileSync(path.join(SRC, name.replace('.csv', '-arco.csv')), 'utf8').split('\n')
    .filter(line => /^\d/.test(line)).map(line => line.split(',').map(Number));
  const center = rows.findIndex(row => Math.abs(row[0] - closestJd) < 1e-6);
  if (center < 0) throw new Error(`${name}: el arco no pasa por el máximo acercamiento`);
  return { startJd: rows[0][0], stepDays: 1, center,
    xyz: encodeDeltas(rows.flatMap(row => [1, 2, 3].map(axis => Math.round((row[axis] - rows[center][axis]) * AU_KM / ARC_UNIT_KM)))) };
}

export function readFlybyCurve(name) {
  const text = fs.readFileSync(path.join(SRC, name), 'utf8');
  const [, closestJd, closestKm] = text.match(/JD TDB ([\d.]+), (\d+) km/);
  // El planeta de la efeméride actual de Horizons, la misma de sus órbitas (planetEphemeris.json): así
  // queda sobre su línea de órbita. En Urano y Neptuno difiere en 5.000–14.000 km del que implica la
  // trayectoria de la sonda (calculada con efemérides de entonces); a la distancia en que se ve la ruta
  // heliocéntrica (≥ 0,006 UA) es menos de un 1 %.
  const planetAu = text.match(/instante \(centro del Sol, ICRF, UA\): ([^\n]+)/)[1].split(',').map(Number);
  const rows = kind => text.split('\n').filter(line => line.startsWith(`${kind},`)).map(line => line.split(',').slice(1).map(Number));
  const core = rows('1m'), wideAll = rows('10m');
  const outside = (row, list) => row[0] < list[0][0] - 1e-6 || row[0] > list.at(-1)[0] + 1e-6;
  const wide = wideAll.filter(row => outside(row, core));
  const outer = rows('2h').filter(row => outside(row, wideAll));
  const all = [...outer, ...wide, ...core].sort((a, b) => a[0] - b[0]);
  const [code, planet] = name.replace('.csv', '').match(/^(-\d+)-(\w+)$/).slice(1);
  return { code: Number(code), planet, closestJd: Number(closestJd), closestKm: Number(closestKm), planetAu,
    startJd: all[0][0], minutes: all.map((row, i) => i ? Math.round((row[0] - all[i - 1][0]) * 1440) : 0),
    xyz: encodeDeltas(all.flatMap(row => row.slice(1).map(value => Math.round(value / FLYBY_UNIT_KM)))), arc: readArc(name, Number(closestJd)) };
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const flybys = fs.readdirSync(SRC).filter(name => name.endsWith('.csv') && !name.endsWith('-arco.csv')).sort().map(readFlybyCurve);
  fs.writeFileSync(OUT, JSON.stringify({ source: 'https://ssd.jpl.nasa.gov/horizons/',
    frame: 'ICRF, centro en el planeta', units: `${FLYBY_UNIT_KM} km, diferencias entre muestras`, flybys }));
  for (const flyby of flybys) console.log(flyby.code, flyby.planet, flyby.minutes.length, 'muestras', flyby.closestKm, 'km');
  console.log(OUT, fs.statSync(OUT).size, 'bytes', ':', 'gzip', (await import('node:zlib')).gzipSync(fs.readFileSync(OUT)).length);
}
