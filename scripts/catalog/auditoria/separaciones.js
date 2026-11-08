// scripts/catalog/auditoria/separaciones.js
// Separaciones angulares medidas de los pares que dibuja Hoshi, leídas igual que scripts/process_binaries.js:
// semieje de ORB6, rho de la última medida de WDS y separación del MSC. Clave → [″]: «orb6|par|ancla>componente» y
// «wds|par|ancla>componente» con el código de descubridor del par (process_binaries puede sumar a un sistema pares de
// otra entrada WDS cercana), y «msc|WDS|ancla>componente».
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parseComponents } from '../../multiplicity.js';

const field = (line, start, length) => line.slice(start - 1, start - 1 + length).trim();
const number = text => (text === '' || text === '.' ? null : Number(text));

export function separacionesMedidas() {
  const mapa = new Map();
  const poner = (clave, v) => { if (!(v > 0)) return; if (!mapa.has(clave)) mapa.set(clave, []); mapa.get(clave).push(v); };
  for (const line of fs.readFileSync('data/raw/multiplicity/orb6orbits.txt', 'utf8').split('\n')) {
    if (!/^\d{6}\.\d{2}[+-]\d{6}/.test(line)) continue;
    const axis = number(field(line, 106, 9)), unidad = { a: 1, m: 0.001, M: 60 }[line[114]], comps = parseComponents(line.slice(37, 44));
    if (axis && unidad && comps) poner(`orb6|${line.slice(30, 37).replace(/\s+/g, ' ').trim()}|${comps[0][0]}>${comps[1]}`, axis * unidad);
  }
  for (const line of fs.readFileSync('data/raw/multiplicity/wdsweb_summ2.txt', 'utf8').split('\n')) {
    if (!/^\d{5}[+-]\d{4}/.test(line)) continue;
    const comps = parseComponents(line.slice(17, 22));
    if (comps) poner(`wds|${line.slice(10, 17).replace(/\s+/g, ' ').trim()}|${comps[0][0]}>${comps[1]}`, number(field(line, 53, 5)));
  }
  const ARCSEC = { '"': 1, "'": 60, m: 0.001 };
  for (const line of zlib.gunzipSync(fs.readFileSync('data/raw/multiplicity/msc/systems.dat.gz')).toString('latin1').split('\n')) {
    const cols = line.split('|');
    // Solo pares anchos con separación medida (tipos C, c, v), como process_binaries; en las órbitas el MSC da el semieje.
    if (cols.length < 18 || !cols[1].trim() || !cols[2].trim() || !/[Ccv]/.test(cols[4].trim())) continue;
    poner(`msc|${cols[0].trim()}|${cols[1].trim()[0]}>${cols[2].trim()}`, Number(cols[7]) * (ARCSEC[cols[8].trim()] || 0));
  }
  return mapa;
}
