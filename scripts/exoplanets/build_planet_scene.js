// scripts/exoplanets/build_planet_scene.js
// JSON ligero de sistemas planetarios para la escena: solo anfitrionas presentes en el
// catálogo de Hoshi (AT-HYG o añadidas) y solo los campos que se dibujan. Se sirve desde
// public/data/ y la app lo pide aparte; no entra en el bundle.
// Uso: node scripts/exoplanets/build_planet_scene.js
// Requiere exoplanet_systems.json, exoplanet_host_identity.json y added_hosts.json.

import fs from 'node:fs';
import { resolvePlanet } from '../../src/scene/exoplanetOrbit.js';

const SYSTEMS_JSON = './data/exoplanets/exoplanet_systems.json';
const HOSTS_JSON = './data/catalog/exoplanet_host_identity.json';
const ADDED_JSON = './data/catalog/added_hosts.json';
const STARS_JSON = './data/processed/stars_15pc.json';
const OUTPUT_PATH = './public/data/exoplanets.json';
const REPORT_PATH = './data/exoplanets/planet_scene_report.json';

const systems = JSON.parse(fs.readFileSync(SYSTEMS_JSON, 'utf8')).systems;
const starIds = new Set(JSON.parse(fs.readFileSync(STARS_JSON, 'utf8')).map(s => s.i));
const hostId = new Map(JSON.parse(fs.readFileSync(HOSTS_JSON, 'utf8')).hosts.filter(h => h.i !== null).map(h => [h.h, h.i]));
for (const star of JSON.parse(fs.readFileSync(ADDED_JSON, 'utf8')).stars) for (const host of star.hosts) hostId.set(host, star.i);

const out = [], undrawn = [], absent = [];
const marks = {};
for (const system of systems) {
  const id = hostId.get(system.h);
  if (id === undefined || !starIds.has(id)) { absent.push(system.h); continue; }
  // Un mismo «tiempo de periastro» en varios planetas es la época de un ajuste dinámico.
  const periastra = system.p.map(p => p.tp).filter(tp => tp !== null);
  const shared = tp => tp !== null && periastra.filter(other => other === tp).length > 1;
  // Mediana de las inclinaciones medidas: plano supuesto para los planetas sin inclinación.
  const measured = system.p.map(p => p.inc).filter(inc => inc !== null).sort((a, b) => a - b);
  const systemInclination = measured.length ? measured[Math.floor((measured.length - 1) / 2)] : null;
  const planets = [];
  for (const planet of system.p) {
    const resolved = resolvePlanet(planet, system.st.m, shared(planet.tp), systemInclination);
    if (!resolved) { undrawn.push(planet.n); continue; }
    for (const key of resolved.s) marks[key] = (marks[key] || 0) + 1;
    planets.push(resolved);
  }
  if (!planets.length) continue;
  out.push({
    i: id, h: system.h,
    // Radio (R☉), temperatura (K) y sus incertidumbres publicadas; masa (M☉).
    st: { r: system.st.r, rE: system.st.rE, teff: system.st.teff, teffE: system.st.teffE, m: system.st.m },
    ns: system.ns,
    ...(system.p.some(p => p.f.cb) ? { cb: 1 } : {}),
    p: planets,
  });
}

const total = out.reduce((n, s) => n + s.p.length, 0);
fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
  meta: {
    fuente: 'NASA Exoplanet Archive, tabla pscomppars (parámetros compuestos)',
    unidades: { a: 'UA', P: 'días', inc: '°', w: '° (argumento del periastro de la estrella)', t: 'JD de tránsito (t0) o periastro (tp)', r: 'R⊕', teq: 'K', m: 'M⊕' },
    supuestos: 's: letras de ASSUMPTIONS en src/scene/exoplanetOrbit.js; Ω no está en la tabla y es convencional en todos',
  },
  systems: out,
}));
const ids = out.map(s => s.i);
const report = {
  generado: new Date().toISOString(),
  sistemas: out.length, planetas: total,
  anfitrionaAusente: absent.length,
  planetasSinOrbitaDibujable: undrawn,
  puntosCompartidos: [...new Set(ids.filter((id, k) => ids.indexOf(id) !== k))].map(id => out.filter(s => s.i === id).map(s => s.h).join(' / ')),
  circumbinarios: out.filter(s => s.cb).length,
  anfitrionaEnSistemaMultiple: out.filter(s => s.ns > 1).length,
  marcas: marks,
  conFaseMedida: total - (marks.f || 0),
  conRadioMedido: total - (marks.r || 0) - (marks.R || 0),
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`✓ ${OUTPUT_PATH}: ${out.length} sistemas, ${total} planetas (${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(0)} KB)`);
console.log(`✓ Sin anfitriona en Hoshi: ${absent.length} sistemas; sin órbita dibujable: ${undrawn.length} planetas; marcas: ${JSON.stringify(marks)}`);
