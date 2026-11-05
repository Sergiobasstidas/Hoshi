// Muestras de control de JPL Horizons con centro en el planeta (CENTER='500@599' y demás) a ± 5, 10,
// 20 y 30 días del máximo acercamiento de cada sobrevuelo, consultadas aparte de las curvas
// (fetch_flyby_curves.mjs), para comprobarlas punto a punto en los tests.
// Escribe scripts/probes/control_sobrevuelos.json. Uso: node scripts/probes/fetch_flyby_control.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { FLYBYS } from './fetch_flybys.mjs';

const quote = value => encodeURIComponent(`'${value}'`);
const control = [];
for (const flyby of FLYBYS) {
  const header = readFileSync(new URL(`../../data/probes/sobrevuelos/${flyby.code}-${flyby.planet}.csv`, import.meta.url), 'utf8');
  const tc = Number(header.match(/JD TDB ([\d.]+)/)[1]);
  const samples = [];
  for (const days of [-30, -20, -10, -5, 5, 10, 20, 30]) {
    const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES'
      + `&COMMAND=${quote(flyby.code)}&EPHEM_TYPE=VECTORS&CENTER=${quote(flyby.center)}&TIME_TYPE=TDB`
      + `&START_TIME=${quote(`JD${tc + days}`)}&STOP_TIME=${quote(`JD${tc + days + 1 / 1440}`)}&STEP_SIZE=${quote('1m')}`
      + '&VEC_TABLE=1&REF_PLANE=FRAME&OUT_UNITS=KM-S&CSV_FORMAT=YES';
    let result;
    for (let attempt = 0; !result; attempt++) {
      const response = await fetch(url);
      if (response.ok) ({ result } = await response.json());
      else if (attempt > 5) throw new Error(`HTTP ${response.status}`);
      else await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt));
    }
    const row = result.slice(result.indexOf('$$SOE') + 5).trim().split('\n')[0].split(',').map(cell => cell.trim());
    samples.push([Number(row[0]), ...row.slice(2, 5).map(Number)]);
  }
  control.push({ code: flyby.code, planet: flyby.planet, samples });
  console.log(flyby.code, flyby.planet, samples.length);
}
writeFileSync(new URL('./control_sobrevuelos.json', import.meta.url), JSON.stringify({ source: 'https://ssd.jpl.nasa.gov/horizons/',
  frame: 'ICRF, centro en el planeta, km; filas: JD TDB, x, y, z', flybys: control }));
