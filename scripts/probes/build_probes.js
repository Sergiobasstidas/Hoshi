// Genera public/data/probes.json: trayectorias de Voyager 1 y 2 y Pioneer 10 y 11.
// Uso: node scripts/probes/build_probes.js (lee data/probes/fuentes/, no descarga nada;
// para volver a descargar: node scripts/probes/fetch_horizons.mjs).
//
// Fuente: vectores heliocéntricos de JPL Horizons (centro del Sol, ICRF, UA) cada 2 días desde
// el lanzamiento hasta 2049-12-31. Aquí se toma una fila de cada STRIDE (cada 8 días), que basta
// a escala del sistema solar, y se redondea a 1e-4 UA (≈ 15.000 km). Los pasos por Júpiter, Saturno,
// Urano y Neptuno llevan además tramos densos de Horizons (scripts/probes/fetch_flybys.mjs): cada
// hora durante ± 6 días y cada 10 minutos durante ± 1 día del máximo acercamiento, redondeados a
// 1e-6 UA (≈ 150 km), para que el giro real se vea al acercarse. Después de la pérdida de contacto
// (Pioneer 10 en 2003, Pioneer 11 en 1995) y en el futuro, Horizons da trayectorias calculadas.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'data/probes/fuentes');
const OUT = path.join(ROOT, 'public/data/probes.json');
const STRIDE = 4;
const CODES = [-31, -32, -23, -24];

export function readHorizons(code) {
  return fs.readFileSync(path.join(SRC, `${code}.csv`), 'utf8').split('\n')
    .filter(line => /^\d/.test(line)).map(line => line.split(',').map(Number));
}

const round = (value, scale) => Math.round(value * scale) / scale;
// Tramo de paso fijo: primer instante, paso en días y posiciones x, y, z seguidas.
const segment = (rows, scale) => ({ startJd: rows[0][0], stepDays: round(rows[1][0] - rows[0][0], 1e8),
  xyz: rows.flatMap(row => row.slice(1).map(value => round(value, scale))) });

// Tramos densos de los pasos por planetas: un archivo <código>-<planeta>.csv por encuentro.
export function readFlybys(code) {
  return fs.readdirSync(SRC).filter(name => name.startsWith(`${code}-`)).sort().flatMap(name => {
    const lines = fs.readFileSync(path.join(SRC, name), 'utf8').split('\n').filter(line => /^(hora|10m),/.test(line));
    return ['hora', '10m'].map(kind => lines.filter(line => line.startsWith(`${kind},`))
      .map(line => line.split(',').slice(1).map(Number)));
  });
}

export function buildProbe(code, rows, flybys = []) {
  return { code, ...segment(rows.filter((_, i) => i % STRIDE === 0), 1e4),
    flybys: flybys.map(item => segment(item, 1e6)) };
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const probes = CODES.map(code => buildProbe(code, readHorizons(code), readFlybys(code)));
  fs.writeFileSync(OUT, JSON.stringify({
    source: 'https://ssd.jpl.nasa.gov/horizons/', frame: 'ICRF, centro del Sol', units: 'UA', probes }));
  for (const probe of probes) console.log(probe.code, probe.xyz.length / 3, 'puntos cada', probe.stepDays, 'días y',
    probe.flybys.reduce((sum, item) => sum + item.xyz.length / 3, 0), 'en', probe.flybys.length, 'tramos densos');
  console.log(OUT, fs.statSync(OUT).size, 'bytes');
}
