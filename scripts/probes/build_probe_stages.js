// Genera public/data/probe-stages.json: las etapas de Voyager 1 y 2 y Pioneer 10 y 11 para un panel
// didáctico (lanzamiento, sobrevuelos, heliopausa, fin del contacto y la fecha de la descarga, «hoy»), la serie de su rapidez
// respecto del Sol desde el lanzamiento y la rapidez de escape del Sol según la distancia.
// Lee data/probes/etapas/ (de fetch_probe_stages.mjs, estados de JPL Horizons); no descarga nada.
// Uso: node scripts/probes/build_probe_stages.js
import fs from 'node:fs';
import path from 'node:path';
import { AU_KM } from '../../src/scene/scale.js';
import { FLYBY_PLANETS } from '../../src/scene/probeFlybys.js';
import { PROBE_INFO } from '../../src/scene/probeTrajectories.js';
import { TODAY } from './fetch_probe_stages.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'public/data/probe-stages.json');
// Parámetro gravitacional del Sol (km³/s²): https://ssd.jpl.nasa.gov/astro_par.html
export const GM_SUN = 1.32712440018e11;
const DAY_LIGHT_KM = 299792.458 * 86400;

// Lanzamiento (UTC) y lugar: Cabo Cañaveral, Florida; Titan IIIE-Centaur (Voyager) y Atlas-Centaur (Pioneer).
// https://science.nasa.gov/mission/voyager/ · https://www.nasa.gov/missions/pioneer/
export const LAUNCHES = {
  [-31]: { utc: '1977-09-05T12:56Z', place: 'Cabo Cañaveral, Florida (complejo 41)', rocket: 'Titan IIIE-Centaur' },
  [-32]: { utc: '1977-08-20T14:29Z', place: 'Cabo Cañaveral, Florida (complejo 41)', rocket: 'Titan IIIE-Centaur' },
  [-23]: { utc: '1972-03-03T01:49Z', place: 'Cabo Cañaveral, Florida (complejo 36A)', rocket: 'Atlas-Centaur' },
  [-24]: { utc: '1973-04-06T02:11Z', place: 'Cabo Cañaveral, Florida (complejo 36B)', rocket: 'Atlas-Centaur' },
};
// Cruce de la heliopausa: valores publicados, no calculados. Burlaga et al. (2019), «Magnetic field and
// particle measurements made by Voyager 2 at and near the heliopause», Nature Astronomy 3, 1007
// (equipo del magnetómetro de NASA Goddard): Voyager 1 el 25/08/2012 a 121,6 UA y Voyager 2 el
// 05/11/2018 a ≈ 119,0 UA. La NASA los redondea a ≈ 122 y ≈ 119 UA.
export const HELIOPAUSE = {
  [-31]: { date: '2012-08-25', au: 121.6 },
  [-32]: { date: '2018-11-05', au: 119.0 },
};
export const HELIOPAUSE_SOURCE = 'https://doi.org/10.1038/s41550-019-0920-y';

// TDB − UTC = 32,184 s + (TAI − UTC); segundos intercalares desde 1972.
const LEAPS = [['1972-01-01', 10], ['1972-07-01', 11], ['1973-01-01', 12], ['1974-01-01', 13], ['1975-01-01', 14], ['1976-01-01', 15],
  ['1977-01-01', 16], ['1978-01-01', 17], ['1979-01-01', 18], ['1980-01-01', 19], ['1981-07-01', 20], ['1982-07-01', 21], ['1983-07-01', 22],
  ['1985-07-01', 23], ['1988-01-01', 24], ['1990-01-01', 25], ['1991-01-01', 26], ['1992-07-01', 27], ['1993-07-01', 28], ['1994-07-01', 29],
  ['1996-01-01', 30], ['1997-07-01', 31], ['1999-01-01', 32], ['2006-01-01', 33], ['2009-01-01', 34], ['2012-07-01', 35], ['2015-07-01', 36], ['2017-01-01', 37]];
export function utcFromTdb(jd) {
  const ms = (jd - 2440587.5) * 86400000;
  const leap = LEAPS.filter(([date]) => Date.parse(date) <= ms).at(-1)?.[1] ?? 10;
  return new Date(ms - (32.184 + leap) * 1000);
}

const norm = v => Math.hypot(...v);
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const angle = (a, b) => Math.acos(Math.min(1, Math.max(-1, a.reduce((sum, v, i) => sum + v * b[i], 0) / norm(a) / norm(b)))) * 180 / Math.PI;
export const escapeSpeed = au => Math.sqrt(2 * GM_SUN / (au * AU_KM));

export function buildStages(code, data) {
  const stages = [{ kind: 'lanzamiento', utc: LAUNCHES[code].utc, place: LAUNCHES[code].place, rocket: LAUNCHES[code].rocket }];
  for (const flyby of data.flybys) {
    const [before, , after] = flyby.sun.map(row => norm(row.slice(4, 7)));
    const [inbound, closest, outbound] = flyby.relative;
    stages.push({ kind: 'sobrevuelo', planet: FLYBY_PLANETS[flyby.planet], closestJd: flyby.closestJd,
      utc: utcFromTdb(flyby.closestJd).toISOString().slice(0, 16) + 'Z',
      closestKm: Math.round(norm(closest.slice(1, 4))), sunAu: round(norm(flyby.sun[1].slice(1, 4)) / AU_KM, 2),
      // Rapidez respecto del Sol 10 días antes y 10 días después, y lo que ganó (o perdió) en el paso.
      sunSpeedBefore: round(before, 2), sunSpeedAfter: round(after, 2), gain: round(after - before, 2),
      // Rapidez respecto del planeta en el máximo acercamiento y lejos de él (± 30 días).
      planetSpeed: round(norm(closest.slice(4, 7)), 2), approachSpeed: round(norm(inbound.slice(4, 7)), 2),
      // Desvío de la trayectoria respecto del planeta: ángulo entre la velocidad 30 días antes y 30 días después.
      deflectionDeg: round(angle(inbound.slice(4, 7), outbound.slice(4, 7)), 1) });
  }
  if (HELIOPAUSE[code]) stages.push({ kind: 'heliopausa', date: HELIOPAUSE[code].date, au: HELIOPAUSE[code].au, source: HELIOPAUSE_SOURCE });
  if (PROBE_INFO[code].contactLost) stages.push({ kind: 'fin del contacto', date: PROBE_INFO[code].contactLost.split('/').reverse().join('-') });
  const today = data.today, earth = data.earth;
  stages.push({ kind: 'hoy', date: TODAY, au: round(norm(today.slice(1, 4)) / AU_KM, 2),
    sunSpeed: round(norm(today.slice(4, 7)), 2), escapeSpeed: round(escapeSpeed(norm(today.slice(1, 4)) / AU_KM), 2),
    earthLightDays: round(norm(today.slice(1, 4).map((v, i) => v - earth[i + 1])) / DAY_LIGHT_KM, 3) });
  // Rapidez respecto del Sol cada 10 días desde el lanzamiento (km/s, centésimas) y distancia (UA, centésimas).
  const series = { startJd: data.series[0][0], stepDays: 10,
    speed: data.series.map(row => round(norm(row.slice(4, 7)), 2)), au: data.series.map(row => round(norm(row.slice(1, 4)) / AU_KM, 2)) };
  return { code, name: PROBE_INFO[code].name, stages, series };
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const probes = [-31, -32, -23, -24].map(code => buildStages(code,
    JSON.parse(fs.readFileSync(path.join(ROOT, 'data/probes/etapas', `${code}.json`), 'utf8'))));
  // Rapidez de escape del Sol (km/s) entre 0,5 y 200 UA, en escala logarítmica.
  const escape = Array.from({ length: 61 }, (_, i) => { const au = 0.5 * 400 ** (i / 60); return [round(au, 3), round(escapeSpeed(au), 2)]; });
  fs.writeFileSync(OUT, JSON.stringify({ source: 'https://ssd.jpl.nasa.gov/horizons/', units: 'km/s, UA, km, UTC', probes, escape }));
  for (const probe of probes) for (const stage of probe.stages) console.log(probe.name, JSON.stringify(stage));
  const zlib = await import('node:zlib');
  console.log(OUT, fs.statSync(OUT).size, 'bytes;', zlib.gzipSync(fs.readFileSync(OUT)).length, 'comprimido');
}
