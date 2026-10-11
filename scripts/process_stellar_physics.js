// Preserve missing B-V values: the legacy compact catalogue converted them to 0.
// Small sidecar, original catalogue positions and identifiers remain untouched.
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { estimateStellarPhysics } from '../src/scene/stellarPhysics.js';
const rows = parse(fs.readFileSync('data/raw/hyglike_from_athyg_v32.csv', 'utf8'), { columns: true });
const data = {};
for (const row of rows) {
  if (!row.proper || row.proper === 'Sol') continue;
  const numeric = value => value.trim() === '' ? null : Number(value);
  const physics = estimateStellarPhysics({ bv: numeric(row.ci), mv: numeric(row.absmag), spectrum: row.spect });
  if (physics) data[row.id] = physics;
}
fs.writeFileSync('data/processed/stellar_physics.json', JSON.stringify(data, null, 2) + '\n');
console.log(`${Object.keys(data).length} estimaciones; los registros no compatibles conservan su marcador.`);
