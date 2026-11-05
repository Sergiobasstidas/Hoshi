// Descarga de JPL Horizons los tramos densos de los pasos por Júpiter, Saturno, Urano y Neptuno.
// Para cada encuentro: 1) busca el máximo acercamiento en vectores centrados en el planeta, cada
// 10 minutos durante ± 1 día de la fecha publicada por la NASA; 2) descarga los vectores
// heliocéntricos (centro del Sol, ICRF, UA) cada hora durante ± WIDE_DAYS y cada 10 minutos durante
// ± CORE_DAYS alrededor de ese instante. Escribe data/probes/fuentes/<código>-<planeta>.csv.
// Uso: node scripts/probes/fetch_flybys.mjs
import { writeFileSync } from 'node:fs';

export const WIDE_DAYS = 6, CORE_DAYS = 1;
// Sonda, planeta, centro de Horizons del planeta y fecha publicada del máximo acercamiento.
export const FLYBYS = [
  { code: -23, planet: 'jupiter', center: '500@599', date: '1973-12-04' },
  { code: -24, planet: 'jupiter', center: '500@599', date: '1974-12-03' },
  { code: -24, planet: 'saturno', center: '500@699', date: '1979-09-01' },
  { code: -31, planet: 'jupiter', center: '500@599', date: '1979-03-05' },
  { code: -31, planet: 'saturno', center: '500@699', date: '1980-11-12' },
  { code: -32, planet: 'jupiter', center: '500@599', date: '1979-07-09' },
  { code: -32, planet: 'saturno', center: '500@699', date: '1981-08-26' },
  { code: -32, planet: 'urano', center: '500@799', date: '1986-01-24' },
  { code: -32, planet: 'neptuno', center: '500@899', date: '1989-08-25' },
];

const quote = value => encodeURIComponent(`'${value}'`);
const calendar = jd => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 16).replace('T', ' ');

async function vectors(code, center, start, stop, step) {
  const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES'
    + `&COMMAND=${quote(code)}&EPHEM_TYPE=VECTORS&CENTER=${quote(center)}&TIME_TYPE=TDB`
    + `&START_TIME=${quote(start)}&STOP_TIME=${quote(stop)}&STEP_SIZE=${quote(step)}`
    + '&VEC_TABLE=1&REF_PLANE=FRAME&OUT_UNITS=AU-D&CSV_FORMAT=YES';
  const { result } = await (await fetch(url)).json();
  if (!result.includes('$$SOE')) throw new Error(`${code} ${center}: ${result.slice(-300)}`);
  const rows = result.slice(result.indexOf('$$SOE') + 5, result.indexOf('$$EOE')).trim().split('\n')
    .map(line => line.split(',').map(cell => cell.trim())).map(cells => [cells[0], cells[2], cells[3], cells[4]]);
  return { url, rows };
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  for (const flyby of FLYBYS) {
    const day = Date.parse(`${flyby.date}T12:00:00Z`) / 86400000 + 2440587.5;
    const near = await vectors(flyby.code, flyby.center, calendar(day - 1), calendar(day + 1), '10m');
    const closest = near.rows.map(row => ({ jd: Number(row[0]), au: Math.hypot(...row.slice(1).map(Number)) }))
      .reduce((best, row) => row.au < best.au ? row : best);
    const wide = await vectors(flyby.code, '500@10', calendar(closest.jd - WIDE_DAYS), calendar(closest.jd + WIDE_DAYS), '1h');
    const core = await vectors(flyby.code, '500@10', calendar(closest.jd - CORE_DAYS), calendar(closest.jd + CORE_DAYS), '10m');
    writeFileSync(new URL(`../../data/probes/fuentes/${flyby.code}-${flyby.planet}.csv`, import.meta.url), [
      `# Máximo acercamiento (muestras de 10 min centradas en ${flyby.center}): JD TDB ${closest.jd}, ${(closest.au * 149597870.7).toFixed(0)} km del centro`,
      `# Consulta del acercamiento: ${near.url}`,
      `# Tramo cada hora: ${wide.url}`,
      `# Tramo cada 10 minutos: ${core.url}`,
      'tramo,jd_tdb,x_au,y_au,z_au',
      ...wide.rows.map(row => ['hora', ...row].join(',')),
      ...core.rows.map(row => ['10m', ...row].join(',')), ''].join('\n'));
    console.log(flyby.code, flyby.planet, calendar(closest.jd), (closest.au * 149597870.7).toFixed(0), 'km', wide.rows.length, core.rows.length);
  }
}
