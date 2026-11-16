// scripts/catalog/descargar_hunt2023.js
// Tabla de cúmulos de Hunt & Reffert 2023, A&A 673, A114 («Improving the open cluster census. II»; VizieR
// J/A+A/673/A114/clusters), con la edad de cada cúmulo en percentiles (logAge16, logAge50, logAge84). La usa
// process_cumulos.js para el rango de edad de los cúmulos sin estudio dedicado (scripts/catalog/edades_cumulos.js).
// Se guarda en data/raw/hunt2023/clusters.tsv (7 MB, no se sube). Solo pide la red con la descarga
// (HOSHI_RED=descargar, o npm run descargar:red); sin ella deja el archivo como está.
import fs from 'node:fs';
import { DESCARGAR } from './red.js';

export const HUNT2023 = './data/raw/hunt2023/clusters.tsv';
const CONSULTA = '-source=J/A%2BA/673/A114/clusters&-out.max=unlimited&-out.all';
// El espejo de VizieR en China respondía cuando el de CDS no (16/11/2026); CDS queda como alternativa.
const ESPEJOS = ['http://vizier.china-vo.org', 'https://vizier.cds.unistra.fr'];

if (DESCARGAR) {
  let texto = null;
  for (const espejo of ESPEJOS) {
    try {
      const r = await fetch(`${espejo}/viz-bin/asu-tsv?${CONSULTA}`, { signal: AbortSignal.timeout(600000) });
      const t = await r.text();
      if (r.ok && /\tlogAge50\t/.test(t)) { texto = t; break; }
    } catch { /* siguiente espejo */ }
  }
  if (texto === null) throw Error('No respondió ningún espejo de VizieR con J/A+A/673/A114/clusters');
  fs.mkdirSync('./data/raw/hunt2023', { recursive: true });
  if (!fs.existsSync(HUNT2023) || fs.readFileSync(HUNT2023, 'utf8') !== texto) fs.writeFileSync(HUNT2023, texto);
}
if (!fs.existsSync(HUNT2023)) throw Error(`Falta ${HUNT2023}; corre: npm run descargar:red`);
console.log(`✓ Hunt & Reffert 2023: ${HUNT2023}`);
