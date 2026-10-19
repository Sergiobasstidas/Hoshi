// Vectores de Horizons cada 15 días durante un año para las lunas interiores (a < 1,4 millones
// de km), centrados en el planeta, ICRF, km. Uso: node data/moons/fuentes/inner.mjs (desde la raíz).
import fs from 'fs';
const dir = 'data/moons/fuentes/';
const rows = JSON.parse(fs.readFileSync(dir + 'elem.json')).filter(r => (r[1] === 'Jupiter' || r[1] === 'Saturn') && +r[7] <= 1.4e6);
const out = {};
for (const r of rows) {
  const center = r[1] === 'Jupiter' ? '500@599' : '500@699';
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='${r[3]}'&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=VECTORS&CENTER='${center}'&REF_PLANE=FRAME&VEC_TABLE=1&CSV_FORMAT=YES&START_TIME='JD 2461327.5'&STOP_TIME='JD 2461687.5'&STEP_SIZE='15 d'&OUT_UNITS=KM-S`;
  const text = await (await fetch(url)).text();
  const body = text.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!body) { out[r[3]] = { error: text.slice(0, 200) }; continue; }
  out[r[3]] = body.trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => [+c[0], +c[2], +c[3], +c[4]]);
}
fs.writeFileSync(dir + 'inner.json', JSON.stringify(out));
console.log(Object.keys(out).length, Object.values(out)[0].length);
