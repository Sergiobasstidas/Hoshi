// Descarga de JPL Horizons los vectores heliocéntricos (centro del Sol, ICRF, UA y UA/día) de los
// ocho planetas, con que se generan sus posiciones y órbitas (build_planets.js).
// El centro de cada planeta, salvo la Tierra, que va como baricentro Tierra-Luna (a la Tierra la
// separa la Luna en solarEphemeris.js; así el ajuste es suave). El baricentro de los otros sistemas
// se aparta del centro del planeta hasta ≈ 1.200 km (Urano), por eso no se usa. Hasta 2060 más medio
// período orbital: así cabe una vuelta completa centrada en cualquier fecha hasta 2060. Desde 1970 la
// Tierra y los planetas exteriores (lanzamientos y sobrevuelos de las sondas); Mercurio, Venus y Marte
// desde 2000, porque solo se usan en la fecha de la escena.
// Aparte, PRUEBA: muestras en instantes que no caen en la malla del ajuste, para los tests.
// Escribe data/planets/fuentes/<planeta>.csv y scripts/planets/control.json.
// Uso: node scripts/planets/fetch_planets.mjs
import { writeFileSync } from 'node:fs';

export const PLANET_SOURCES = [
  { name: 'Mercurio', command: '199', periodDays: 87.97, stepDays: 0.5, startJd: 2451544.5 },
  { name: 'Venus', command: '299', periodDays: 224.70, stepDays: 1, startJd: 2451544.5 },
  { name: 'Tierra', command: '3', periodDays: 365.26, stepDays: 1 },
  { name: 'Marte', command: '499', periodDays: 686.98, stepDays: 2, startJd: 2451544.5 },
  { name: 'Júpiter', command: '599', periodDays: 4332.59, stepDays: 5 },
  { name: 'Saturno', command: '699', periodDays: 10759.22, stepDays: 10 },
  { name: 'Urano', command: '799', periodDays: 30688.5, stepDays: 20 },
  { name: 'Neptuno', command: '899', periodDays: 60182, stepDays: 20 },
];
export const START_JD = 2440587.5; // 01/01/1970
export const LAST_DATE_JD = 2473459.5; // 01/01/2060
// Con 1.100 días de margen al final: los tramos del ajuste (hasta 1.024 días) cubren todo el intervalo.
export const rangeOf = source => [source.startJd ?? START_JD, LAST_DATE_JD + source.periodDays / 2 + 1100];

const quote = value => encodeURIComponent(`'${value}'`);
async function vectors(command, start, stop, step) {
  const url = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES'
    + `&COMMAND=${quote(command)}&EPHEM_TYPE=VECTORS&CENTER=${quote('500@10')}&TIME_TYPE=TDB`
    + `&START_TIME=${quote(start)}&STOP_TIME=${quote(stop)}&STEP_SIZE=${quote(step)}`
    + '&VEC_TABLE=2&REF_PLANE=FRAME&OUT_UNITS=AU-D&CSV_FORMAT=YES';
  const { result } = await (await fetch(url)).json();
  if (!result.includes('$$SOE')) throw new Error(`${command}: ${result.slice(-300)}`);
  return { url, rows: result.slice(result.indexOf('$$SOE') + 5, result.indexOf('$$EOE')).trim().split('\n')
    .map(line => line.split(',').map(cell => cell.trim())).map(cells => [cells[0], ...cells.slice(2, 8)]) };
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const control = {};
  for (const source of PLANET_SOURCES) {
    const [start, stop] = rangeOf(source);
    // Horizons entrega hasta unas 90.000 filas por consulta: se pide en tramos de 60.000.
    const rows = [], urls = [];
    for (let from = start; from <= stop; from += 60000 * source.stepDays) {
      const to = Math.min(stop, from + (60000 - 1) * source.stepDays);
      const part = await vectors(source.command, `JD${from}`, `JD${to}`, source.stepDays < 1 ? `${source.stepDays * 24}h` : `${source.stepDays}d`);
      rows.push(...part.rows); urls.push(part.url);
    }
    writeFileSync(new URL(`../../data/planets/fuentes/${source.name}.csv`, import.meta.url),
      [...urls.map(url => `# ${url}`), 'jd_tdb,x,y,z,vx,vy,vz', ...rows.map(row => row.join(',')), ''].join('\n'));
    // Control: 400 instantes fuera de la malla (paso de 0,37 días desplazado), repartidos en el rango.
    const step = (stop - start) / 400;
    const check = await vectors(source.command, `JD${start + 0.37}`, `JD${stop - step}`, `${Math.max(1, Math.round(step * 24 * 60))}m`);
    control[source.name] = check.rows.filter((_, i) => i % Math.max(1, Math.floor(check.rows.length / 400)) === 0).slice(0, 400)
      .map(row => row.slice(0, 4).map(Number));
    console.log(source.name, rows.length, 'filas', control[source.name].length, 'de control');
  }
  writeFileSync(new URL('./control.json', import.meta.url), JSON.stringify({ source: 'https://ssd.jpl.nasa.gov/horizons/',
    frame: 'ICRF, centro del Sol, UA', note: 'Instantes fuera de la malla de muestras del ajuste', planets: control }));
}
