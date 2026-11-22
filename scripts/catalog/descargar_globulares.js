// scripts/catalog/descargar_globulares.js
// Miembros de los cúmulos globulares de scripts/catalog/globulares.js, en data/raw/globulares/ (no se sube):
//  - clusters.zip de Vasiliev & Baumgardt 2021 (Zenodo 4891252, 118.940.646 bytes, md5 3a07093be9a1fcbfb0e3c545ca175c99),
//    del que se extrae catalogues/<cúmulo>.txt;
//  - los miembros de Hunt & Reffert 2023 (VizieR J/A+A/673/A114/members) de cada cúmulo, para el color que falte.
// Solo pide la red con la descarga (HOSHI_RED=descargar, o npm run descargar:red); sin ella exige los archivos.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DESCARGAR } from './red.js';
import { GLOBULARES, HUNT_MIEMBROS, VASILIEV_DIR, VASILIEV_ZIP } from './globulares.js';

const ZENODO = 'https://zenodo.org/records/4891252/files/clusters.zip?download=1';
const MD5 = '3a07093be9a1fcbfb0e3c545ca175c99';
// El espejo de VizieR en China respondía cuando el de CDS no (16/11/2026); CDS queda como alternativa.
const ESPEJOS = ['http://vizier.china-vo.org', 'https://vizier.cds.unistra.fr'];
const md5 = archivo => crypto.createHash('md5').update(fs.readFileSync(archivo)).digest('hex');

if (DESCARGAR) {
  fs.mkdirSync(VASILIEV_DIR, { recursive: true });
  if (!fs.existsSync(VASILIEV_ZIP) || md5(VASILIEV_ZIP) !== MD5) {
    // Zenodo entrega este archivo despacio: curl reanuda lo ya bajado.
    const r = spawnSync('curl', ['-s', '-L', '-C', '-', '--retry', '5', '-m', '3600', ZENODO, '-o', VASILIEV_ZIP], { stdio: 'inherit' });
    if (r.status !== 0 || md5(VASILIEV_ZIP) !== MD5) throw Error('No se pudo bajar completo clusters.zip de Zenodo 4891252');
  }
  for (const cumulo of GLOBULARES) {
    let texto = null;
    for (const espejo of ESPEJOS) {
      try {
        const r = await fetch(`${espejo}/viz-bin/asu-tsv?-source=J/A%2BA/673/A114/members&Name=${cumulo.hunt}&-out.max=unlimited&-out.all`, { signal: AbortSignal.timeout(900000) });
        const t = await r.text();
        if (r.ok && /\tGaiaDR3\t/.test(t)) { texto = t; break; }
      } catch { /* siguiente espejo */ }
    }
    if (texto === null) throw Error(`No respondió ningún espejo de VizieR con los miembros de ${cumulo.hunt}`);
    fs.writeFileSync(HUNT_MIEMBROS(cumulo), texto);
  }
}
for (const cumulo of GLOBULARES) {
  const archivo = `${VASILIEV_DIR}/catalogues/${cumulo.vasiliev}`;
  if (!fs.existsSync(archivo)) {
    if (!fs.existsSync(VASILIEV_ZIP)) throw Error(`Falta ${VASILIEV_ZIP}; corre: npm run descargar:red`);
    const r = spawnSync('unzip', ['-o', '-q', VASILIEV_ZIP, `catalogues/${cumulo.vasiliev}`, '-d', VASILIEV_DIR]);
    if (r.status !== 0) throw Error(`No se pudo extraer ${cumulo.vasiliev} de ${VASILIEV_ZIP}`);
  }
  if (!fs.existsSync(HUNT_MIEMBROS(cumulo))) throw Error(`Falta ${HUNT_MIEMBROS(cumulo)}; corre: npm run descargar:red`);
}
console.log(`✓ Cúmulos globulares: ${GLOBULARES.map(c => c.nombre).join(', ')} en ${VASILIEV_DIR}`);
