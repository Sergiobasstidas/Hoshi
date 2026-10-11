import fs from 'node:fs';

const INPUT = './data/processed/stars_15pc.json';
const OUTPUT = './data/processed/milkyway_desi.json';

// Convertir parsecs a Mpc (1 Mpc = 1,000,000 pc... pero 1 Mpc = 3.086e22 m, 1 pc = 3.086e16 m → 1 pc = 1e-6 Mpc... wait)
// 1 Mpc = 1,000,000 pc → 1 pc = 0.000001 Mpc
const PC_TO_MPC = 1e-6;

const stars = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
console.log(`Total estrellas: ${stars.length}`);

const out = stars.map(s => ({
  x: s.x * PC_TO_MPC,
  y: s.y * PC_TO_MPC,
  z: s.z * PC_TO_MPC,
  r: s.rgb[0] / 255,
  g: s.rgb[1] / 255,
  b: s.rgb[2] / 255,
  m: s.m,  // magnitud absoluta para tamaño
}))

fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 0));
console.log(`Exportadas ${out.length} estrellas → ${OUTPUT}`);