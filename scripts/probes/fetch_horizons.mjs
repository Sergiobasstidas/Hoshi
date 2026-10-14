// Descarga de JPL Horizons los vectores heliocéntricos de las cuatro sondas que salen del
// sistema solar: centro del Sol (500@10), marco ICRF, posición en UA, cada 2 días desde el
// lanzamiento hasta el final de la efeméride publicada. Escribe data/probes/fuentes/<código>.csv
// (JD TDB, x, y, z). Uso: node scripts/probes/fetch_horizons.mjs
import { writeFileSync } from 'node:fs';

// Primer instante con efeméride en Horizons (minuto siguiente) y último.
export const SOURCES = [
  { code: -31, name: 'Voyager 1', start: '1977-09-05 14:00', stop: '2049-12-31' },
  { code: -32, name: 'Voyager 2', start: '1977-08-20 15:33', stop: '2049-12-31' },
  { code: -23, name: 'Pioneer 10', start: '1972-03-03 02:05', stop: '2049-12-31' },
  { code: -24, name: 'Pioneer 11', start: '1973-04-06 02:26', stop: '2049-12-31' },
];

const quote = value => encodeURIComponent(`'${value}'`);

for (const source of SOURCES) {
  const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES'
    + `&COMMAND=${quote(source.code)}&EPHEM_TYPE=VECTORS&CENTER=${quote('500@10')}`
    + `&START_TIME=${quote(source.start)}&STOP_TIME=${quote(source.stop)}&STEP_SIZE=${quote('2d')}`
    + '&VEC_TABLE=1&REF_PLANE=FRAME&OUT_UNITS=AU-D&CSV_FORMAT=YES';
  const { result } = await (await fetch(url)).json();
  const body = result.slice(result.indexOf('$$SOE') + 5, result.indexOf('$$EOE')).trim().split('\n');
  const rows = body.map(line => line.split(',').map(cell => cell.trim()))
    .map(cells => [cells[0], cells[2], cells[3], cells[4]].join(','));
  const header = result.slice(0, result.indexOf('$$SOE')).split('\n')
    .filter(line => /Target body|Center body|Reference frame|Output units|Ephemeris \//.test(line))
    .map(line => `# ${line.trim()}`);
  writeFileSync(new URL(`../../data/probes/fuentes/${source.code}.csv`, import.meta.url),
    [...header, `# Consulta: ${url}`, 'jd_tdb,x_au,y_au,z_au', ...rows, ''].join('\n'));
  console.log(source.name, rows.length, 'filas');
}
