// Genera public/data/probes.json: trayectorias de Voyager 1 y 2 y Pioneer 10 y 11.
// Uso: node scripts/probes/build_probes.js (lee data/probes/fuentes/, no descarga nada;
// para volver a descargar: node scripts/probes/fetch_horizons.mjs).
//
// Fuente: vectores heliocéntricos de JPL Horizons (centro del Sol, ICRF, UA) cada 2 días desde
// el lanzamiento hasta 2049-12-31. Aquí se toma una fila de cada STRIDE (cada 8 días), que basta
// para que los pasos por Júpiter, Saturno, Urano y Neptuno se vean como el giro que son a escala
// del sistema solar, y se redondea a 1e-4 UA (≈ 15.000 km). Después de la pérdida de contacto
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

export function buildProbe(code, rows) {
  const kept = rows.filter((_, i) => i % STRIDE === 0);
  const stepDays = Math.round((kept[1][0] - kept[0][0]) * 1e6) / 1e6;
  return { code, startJd: kept[0][0], stepDays,
    xyz: kept.flatMap(row => row.slice(1).map(value => Math.round(value * 1e4) / 1e4)) };
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const probes = CODES.map(code => buildProbe(code, readHorizons(code)));
  fs.writeFileSync(OUT, JSON.stringify({
    source: 'https://ssd.jpl.nasa.gov/horizons/', frame: 'ICRF, centro del Sol', units: 'UA', probes }));
  for (const probe of probes) console.log(probe.code, probe.xyz.length / 3, 'puntos cada', probe.stepDays, 'días');
  console.log(OUT, fs.statSync(OUT).size, 'bytes');
}
