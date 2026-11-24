import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apparentPosition, besselianYearToMjd } from '../src/scene/visualBinary.js';

// Todas las órbitas de star_systems.json contra las efemérides publicadas de ORB6 (2026.0).
const sistemas = JSON.parse(readFileSync(new URL('../data/processed/star_systems.json', import.meta.url), 'utf8'));
const raw = name => readFileSync(new URL(`../data/raw/multiplicity/${name}`, import.meta.url), 'utf8').split('\n');
const codigo = texto => texto.replace(/\s+/g, ' ').trim();
const clave = (wds, nombre, ref) => `${wds}|${codigo(nombre).replace(/\s*[A-Za-z,]*$/, '').replace(/(\d)[A-Za-z,]+$/, '$1')}|${ref.trim()}`;

// Semieje en segundos de arco de cada órbita (para pasar de UA a segundos de arco).
const semiejes = new Map();
for (const linea of raw('orb6orbits.txt')) {
  if (!/^\d{6}\.\d{2}[+-]\d{6}/.test(linea)) continue;
  const a = Number(linea.slice(105, 114)), unidad = linea[114];
  const k = clave(linea.slice(19, 29).trim(), linea.slice(30, 37), linea.slice(237, 245));
  if (!semiejes.has(k)) semiejes.set(k, []);
  semiejes.get(k).push(a * ({ a: 1, m: 0.001, M: 60 }[unidad] ?? NaN));
}
const efemerides = new Map();
for (const linea of raw('orb6ephem.txt')) {
  if (!/^\d{5}[+-]\d{4} /.test(linea)) continue;
  const wds = linea.slice(0, 10), nombre = linea.slice(11, 27), ref = linea.slice(34, 46);
  // Columnas de 2025.0, 2026.0, ...: se toma 2026.0 (tercer y cuarto número).
  const numeros = linea.slice(46).trim().split(/\s+/).map(Number), theta = numeros[2], rho = numeros[3];
  const k = clave(wds, nombre.replace(/\s+[A-Za-z,]+\s*$/, '').replace(/(\d)[A-Za-z,]+\s*$/, '$1'), ref);
  if (!efemerides.has(k)) efemerides.set(k, []);
  efemerides.get(k).push({ theta, rho });
}

// Precesión del ángulo de posición desde J2000: Δθ = 0,00557°·sen α·sec δ·Δt.
function precesion(wds, anos) {
  const ra = (Number(wds.slice(0, 2)) + Number(wds.slice(2, 5)) / 600) * 15 * Math.PI / 180;
  const dec = (wds[5] === '-' ? -1 : 1) * (Number(wds.slice(6, 8)) + Number(wds.slice(8, 10)) / 60) * Math.PI / 180;
  return 0.00557 * Math.sin(ra) * anos / Math.cos(dec);
}

test('Cada órbita del catálogo calza con la efeméride de ORB6 para 2026.0', () => {
  // Las efemérides son para el año besseliano 2026,0 (importa en los pares de pocos días).
  const mjd = besselianYearToMjd(2026);
  const fallas = [];
  let revisadas = 0;
  for (const sistema of Object.values(sistemas)) for (const par of sistema.comps.filter(c => c.k === 'o')) {
    const k = clave(sistema.wds, par.pair, par.ref);
    const candidatas = efemerides.get(k), as = semiejes.get(k);
    if (!candidatas || !as) continue;
    revisadas++;
    const { theta, rho } = apparentPosition(par, mjd);
    const ok = as.some(aArcsec => candidatas.some(e => {
      const dTheta = Math.abs(((theta + precesion(sistema.wds, 26) - e.theta + 540) % 360) - 180);
      const rhoArcsec = rho * aArcsec / par.a;
      // El catálogo redondea a 0,001": en los pares más cerrados ese redondeo pesa más que el 3 % o los 2°.
      const holgura = 0.0006;
      // Un subpar guardado al revés (Keid: B en torno a C, con ω + 180°) apunta al lado opuesto.
      const giro = par.of > par.n ? Math.abs(dTheta - 180) : dTheta;
      return giro < Math.max(2, Math.atan(holgura / e.rho) * 180 / Math.PI) && Math.abs(rhoArcsec - e.rho) < Math.max(0.03 * e.rho, holgura);
    }));
    // Polaris (02319+8915): su efeméride usa otra solución; se deja como excepción conocida.
    if (!ok && sistema.wds !== '02319+8915') fallas.push(`${sistema.wds} ${par.pair} ${par.of}>${par.n}`);
  }
  assert.ok(revisadas > 1000, `solo ${revisadas} órbitas con efeméride`);
  assert.deepEqual(fallas, []);
});
