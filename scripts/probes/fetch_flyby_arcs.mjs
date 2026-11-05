// Descarga de JPL Horizons la trayectoria real de cada planeta alrededor de cada sobrevuelo: vectores
// heliocéntricos (centro del Sol, ICRF, UA) una vez al día durante ± ARC_DAYS del máximo acercamiento
// (el de data/probes/sobrevuelos/, de fetch_flyby_curves.mjs). Con ella se dibuja el arco de órbita
// que pasa por el planeta de entonces (ProbeTrails.jsx).
// Escribe data/probes/sobrevuelos/<código>-<planeta>-arco.csv.
// Uso: node scripts/probes/fetch_flyby_arcs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { FLYBYS } from './fetch_flybys.mjs';

export const ARC_DAYS = 60;
const PLANET_CODES = { jupiter: '599', saturno: '699', urano: '799', neptuno: '899' };
const quote = value => encodeURIComponent(`'${value}'`);

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  for (const flyby of FLYBYS) {
    const header = readFileSync(new URL(`../../data/probes/sobrevuelos/${flyby.code}-${flyby.planet}.csv`, import.meta.url), 'utf8');
    const closest = Number(header.match(/JD TDB ([\d.]+)/)[1]);
    const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES'
      + `&COMMAND=${quote(PLANET_CODES[flyby.planet])}&EPHEM_TYPE=VECTORS&CENTER=${quote('500@10')}&TIME_TYPE=TDB`
      + `&START_TIME=${quote(`JD${closest - ARC_DAYS}`)}&STOP_TIME=${quote(`JD${closest + ARC_DAYS}`)}&STEP_SIZE=${quote('1d')}`
      + '&VEC_TABLE=1&REF_PLANE=FRAME&OUT_UNITS=AU-D&CSV_FORMAT=YES';
    const { result } = await (await fetch(url)).json();
    if (!result.includes('$$SOE')) throw new Error(`${flyby.code} ${flyby.planet}: ${result.slice(-300)}`);
    const rows = result.slice(result.indexOf('$$SOE') + 5, result.indexOf('$$EOE')).trim().split('\n')
      .map(line => line.split(',').map(cell => cell.trim())).map(cells => [cells[0], cells[2], cells[3], cells[4]]);
    writeFileSync(new URL(`../../data/probes/sobrevuelos/${flyby.code}-${flyby.planet}-arco.csv`, import.meta.url), [
      `# Planeta cada día durante ± ${ARC_DAYS} días del máximo acercamiento (JD TDB ${closest}): ${url}`,
      'jd_tdb,x_au,y_au,z_au', ...rows.map(row => row.join(',')), ''].join('\n'));
    console.log(flyby.code, flyby.planet, rows.length, 'días');
  }
}
