// Descarga de JPL Horizons los estados (posición y velocidad) con que se arma la tabla de etapas de
// cada sonda (build_probe_stages.js):
// · respecto del Sol (centro del Sol, ICRF, km y km/s): cada 10 días desde el lanzamiento hasta hoy,
//   y en cada sobrevuelo 10 días antes, el máximo acercamiento y 10 días después;
// · respecto del planeta en cada sobrevuelo: el máximo acercamiento y ± 30 días (asíntotas).
// El máximo acercamiento es el de data/probes/sobrevuelos/ (fetch_flyby_curves.mjs).
// Escribe data/probes/etapas/<código>.json. Uso: node scripts/probes/fetch_probe_stages.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FLYBYS } from './fetch_flybys.mjs';

export const TODAY = '2026-11-05';
export const START = { [-31]: '1977-09-05 14:00', [-32]: '1977-08-20 16:00', [-23]: '1972-03-03 03:00', [-24]: '1973-04-06 03:00' };
const quote = value => encodeURIComponent(`'${value}'`);

async function states(command, center, start, stop, step) {
  const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES'
    + `&COMMAND=${quote(command)}&EPHEM_TYPE=VECTORS&CENTER=${quote(center)}&TIME_TYPE=TDB`
    + `&START_TIME=${quote(start)}&STOP_TIME=${quote(stop)}&STEP_SIZE=${quote(step)}`
    + '&VEC_TABLE=2&REF_PLANE=FRAME&OUT_UNITS=KM-S&CSV_FORMAT=YES';
  let result;
  // Horizons limita las consultas seguidas: se reintenta con espera creciente.
  for (let attempt = 0; !result; attempt++) {
    const response = await fetch(url);
    if (response.ok) ({ result } = await response.json());
    else if (attempt > 5) throw new Error(`${command} ${center}: HTTP ${response.status}`);
    else await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt));
  }
  if (!result.includes('$$SOE')) throw new Error(`${command} ${center}: ${result.slice(-300)}`);
  return result.slice(result.indexOf('$$SOE') + 5, result.indexOf('$$EOE')).trim().split('\n')
    .map(line => line.split(',').map(cell => cell.trim())).map(cells => [Number(cells[0]), ...cells.slice(2, 8).map(Number)]);
}
const at = (command, center, jd) => states(command, center, `JD${jd}`, `JD${jd + 1 / 1440}`, '1m').then(rows => rows[0]);

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  mkdirSync(new URL('../../data/probes/etapas/', import.meta.url), { recursive: true });
  for (const code of [-31, -32, -23, -24]) {
    const series = await states(code, '500@10', START[code], TODAY, '10d');
    const flybys = [];
    for (const flyby of FLYBYS.filter(item => item.code === code)) {
      const header = readFileSync(new URL(`../../data/probes/sobrevuelos/${code}-${flyby.planet}.csv`, import.meta.url), 'utf8');
      const tc = Number(header.match(/JD TDB ([\d.]+)/)[1]);
      const sun = [], relative = [];
      for (const jd of [tc - 10, tc, tc + 10]) sun.push(await at(code, '500@10', jd));
      for (const jd of [tc - 30, tc, tc + 30]) relative.push(await at(code, flyby.center, jd));
      flybys.push({ planet: flyby.planet, closestJd: tc, sun, relative });
    }
    const today = await at(code, '500@10', Date.parse(`${TODAY}T00:00:00Z`) / 86400000 + 2440587.5);
    const earth = await at('399', '500@10', today[0]);
    writeFileSync(new URL(`../../data/probes/etapas/${code}.json`, import.meta.url), JSON.stringify({
      source: 'https://ssd.jpl.nasa.gov/horizons/', frame: 'ICRF; km y km/s; filas: JD TDB, x, y, z, vx, vy, vz',
      series, flybys, today, earth }));
    console.log(code, series.length, 'estados cada 10 días,', flybys.length, 'sobrevuelos');
  }
}
