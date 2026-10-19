// Descarga las últimas imágenes del Solar Dynamics Observatory (SDO) que usan los filtros
// del Sol y anota su fecha en public/textures/sdo/sdo.json. El SDO pide no pedir las
// imágenes «latest» más de una vez cada 15 minutos: el script se niega antes de ese plazo.
// Uso: node scripts/sdo/descargar_sdo.mjs
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'textures', 'sdo');
const SIZE = 2048;
const BASE = 'https://sdo.gsfc.nasa.gov/assets/img/latest/';
const MIN_INTERVAL_MS = 15 * 60 * 1000;
// Canales: los cuatro filtros y la luz visible sin aplanar (intensitygram de HMI).
const CHANNELS = ['0171', '0193', '0304', 'HMIB', 'HMII'];

const previous = await readFile(join(OUT, 'sdo.json'), 'utf8').then(JSON.parse).catch(() => null);
if (previous && Date.now() - Date.parse(previous.descarga) < MIN_INTERVAL_MS) {
  console.error(`La última descarga fue ${previous.descarga}; el SDO pide esperar 15 minutos entre descargas.`);
  process.exit(1);
}
await mkdir(OUT, { recursive: true });
const meta = { descarga: new Date().toISOString(), fuente: BASE, credito: 'Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.', canales: {} };
for (const channel of CHANNELS) {
  const url = `${BASE}latest_${SIZE}_${channel}.jpg`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const file = `${channel}.jpg`;
  await writeFile(join(OUT, file), bytes);
  // La fecha de modificación del servidor es la de la imagen, con unos minutos de proceso.
  const fecha = new Date(response.headers.get('last-modified') || Date.now()).toISOString();
  meta.canales[channel] = { archivo: file, url, fecha, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  console.log(`${channel}: ${bytes.length} bytes, ${fecha}`);
}
await writeFile(join(OUT, 'sdo.json'), `${JSON.stringify(meta, null, 2)}\n`);
