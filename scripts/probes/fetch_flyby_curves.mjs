// Descarga de JPL Horizons la curva de cada sonda alrededor del planeta en sus sobrevuelos:
// vectores centrados en el planeta (ICRF, km) cada 2 horas durante ± 30 días, cada 10 minutos
// durante ± 3 días y cada minuto durante ± 12 horas del máximo acercamiento, y la posición heliocéntrica del planeta (UA) en ese
// instante, de su efeméride y según la trayectoria de la sonda. El máximo acercamiento de partida es el de los tramos de fetch_flybys.mjs.
// Escribe data/probes/sobrevuelos/<código>-<planeta>.csv.
// Uso: node scripts/probes/fetch_flyby_curves.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { FLYBYS } from './fetch_flybys.mjs';

export const WIDE_DAYS = 3, CORE_DAYS = 0.5, OUTER_DAYS = 30;
const PLANET_CODES = { '500@599': '599', '500@699': '699', '500@799': '799', '500@899': '899' };
const quote = value => encodeURIComponent(`'${value}'`);
const calendar = jd => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 16).replace('T', ' ');

async function vectors(command, center, start, stop, step, units) {
  const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES'
    + `&COMMAND=${quote(command)}&EPHEM_TYPE=VECTORS&CENTER=${quote(center)}&TIME_TYPE=TDB`
    + `&START_TIME=${quote(start)}&STOP_TIME=${quote(stop)}&STEP_SIZE=${quote(step)}`
    + `&VEC_TABLE=1&REF_PLANE=FRAME&OUT_UNITS=${units}&CSV_FORMAT=YES`;
  const { result } = await (await fetch(url)).json();
  if (!result.includes('$$SOE')) throw new Error(`${command} ${center}: ${result.slice(-300)}`);
  const rows = result.slice(result.indexOf('$$SOE') + 5, result.indexOf('$$EOE')).trim().split('\n')
    .map(line => line.split(',').map(cell => cell.trim())).map(cells => [cells[0], cells[2], cells[3], cells[4]]);
  return { url, rows };
}

for (const flyby of FLYBYS) {
  const header = readFileSync(new URL(`../../data/probes/fuentes/${flyby.code}-${flyby.planet}.csv`, import.meta.url), 'utf8');
  const start = Number(header.match(/JD TDB ([\d.]+)/)[1]);
  const wide = await vectors(flyby.code, flyby.center, calendar(start - WIDE_DAYS), calendar(start + WIDE_DAYS), '10m', 'KM-S');
  const core = await vectors(flyby.code, flyby.center, calendar(start - CORE_DAYS), calendar(start + CORE_DAYS), '1m', 'KM-S');
  // Más allá de ± 3 días, cada 2 horas hasta ± 30 días: de cerca los extremos de la curva quedan fuera de la vista.
  const outer = await vectors(flyby.code, flyby.center, calendar(start - OUTER_DAYS), calendar(start + OUTER_DAYS), '2h', 'KM-S');
  const closest = core.rows.map(row => ({ jd: Number(row[0]), km: Math.hypot(...row.slice(1).map(Number)) }))
    .reduce((best, row) => row.km < best.km ? row : best);
  const planet = await vectors(PLANET_CODES[flyby.center], '500@10', `JD${closest.jd}`, `JD${closest.jd + 1 / 1440}`, '1m', 'AU-D');
  // La sonda en el mismo instante, con centro en el Sol: restándole su posición respecto del planeta
  // queda el planeta de la efeméride con que Horizons calcula la sonda. En Urano y Neptuno difiere
  // en miles de km de la efeméride actual del planeta (mejorada con los datos de la propia Voyager 2).
  const probe = await vectors(flyby.code, '500@10', `JD${closest.jd}`, `JD${closest.jd + 1 / 1440}`, '1m', 'AU-D');
  const relative = core.rows.find(row => Number(row[0]) === closest.jd).slice(1).map(Number);
  const fromProbe = probe.rows[0].slice(1).map((value, i) => Number(value) - relative[i] / 149597870.7);
  writeFileSync(new URL(`../../data/probes/sobrevuelos/${flyby.code}-${flyby.planet}.csv`, import.meta.url), [
    `# Máximo acercamiento (muestras de 1 min centradas en ${flyby.center}): JD TDB ${closest.jd}, ${closest.km.toFixed(0)} km del centro`,
    `# Planeta en ese instante (centro del Sol, ICRF, UA): ${planet.rows[0].slice(1).join(',')}`,
    `# Planeta según la trayectoria de la sonda (UA): ${fromProbe.join(',')}`,
    `# Planeta: ${planet.url}`,
    `# Sonda: ${probe.url}`,
    `# Tramo cada 10 minutos (km): ${wide.url}`,
    `# Tramo cada minuto (km): ${core.url}`,
    `# Tramo cada 2 horas (km): ${outer.url}`,
    'tramo,jd_tdb,x_km,y_km,z_km',
    ...wide.rows.map(row => ['10m', ...row].join(',')),
    ...core.rows.map(row => ['1m', ...row].join(',')),
    ...outer.rows.map(row => ['2h', ...row].join(',')), ''].join('\n'));
  console.log(flyby.code, flyby.planet, calendar(closest.jd), closest.km.toFixed(0), 'km', wide.rows.length, core.rows.length);
}
