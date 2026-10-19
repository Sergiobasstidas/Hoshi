// Genera public/data/saturn_rings.json: profundidad óptica normal de los anillos de Saturno
// por radio, para repartir las partículas de SaturnRings.jsx.
// Uso: node scripts/rings/build_rings.js (lee data/rings/fuentes/, no descarga nada).
//
// Fuente: ocultación estelar de β Centauri observada por Cassini UVIS (HSP) el 18/08/2008,
// entrada, perfil binado a 10 km (PDS Ring-Moon Systems Node, COUVIS_8001,
// UVIS_HSP_2008_231_BETCEN_I_TAU10KM). Elevación del rayo sobre el plano: 66,7°, por lo que
// mide el anillo B hasta τ ≈ 10. Las muestras sin restricción (señal sin atenuar, en huecos y
// fuera de los anillos) valen −1 y se toman como τ = 0; los valores negativos por ruido, igual.
// El anillo D (66.900–74.510 km, τ ≈ 1e-5, NASA Saturnian Rings Fact Sheet) queda por debajo
// de lo que mide la ocultación y SaturnRings.jsx lo dibuja aparte, declarado como refuerzo.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SOURCE = path.join(ROOT, 'data/rings/fuentes/UVIS_HSP_2008_231_BETCEN_I_TAU10KM.TAB');
const OUT = path.join(ROOT, 'public/data/saturn_rings.json');
// Del borde interior del anillo C al exterior del F, con margen.
const INNER_KM = 74400, OUTER_KM = 140700, STEP_KM = 10;

export function buildProfile(text = fs.readFileSync(SOURCE, 'utf8')) {
  const rows = text.trim().split('\n').map(line => line.split(',').map(Number)).filter(row => row[0] >= INNER_KM && row[0] <= OUTER_KM);
  const r0 = rows[0][0];
  // El binado no es exactamente de 10 km (10,00–10,04): se reasigna al punto más cercano.
  const count = Math.round((rows.at(-1)[0] - r0) / STEP_KM) + 1;
  const tau = new Array(count).fill(0);
  for (const row of rows) tau[Math.round((row[0] - r0) / STEP_KM)] = Math.max(0, row[4]);
  return { r0: Math.round(r0 * 100) / 100, dr: STEP_KM, tau: tau.map(value => Math.round(value * 1000) / 1000) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const profile = buildProfile();
  fs.writeFileSync(OUT, JSON.stringify({
    source: 'https://pds-rings.seti.org/holdings/volumes/COUVIS_8xxx/COUVIS_8001/data/UVIS_HSP_2008_231_BETCEN_I_TAU10KM.LBL',
    description: 'Cassini UVIS HSP, ocultación de β Centauri (2008-08-18, entrada), profundidad óptica normal a 10 km',
    ...profile }));
  console.log(profile.tau.length, 'muestras desde', profile.r0, 'km');
}
