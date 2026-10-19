// Descarga las últimas imágenes del Solar Dynamics Observatory (SDO) que usan los filtros
// del Sol y anota su fecha en public/textures/sdo/sdo.json. El SDO pide no pedir las
// imágenes «latest» más de una vez cada 15 minutos: el script se niega antes de ese plazo.
// También baja el vídeo de 48 h en 131 Å y, con ffmpeg, guarda una copia más liviana.
// Uso: node scripts/sdo/descargar_sdo.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'textures', 'sdo');
const SIZE = 2048;
const BASE = 'https://sdo.gsfc.nasa.gov/assets/img/latest/';
const MIN_INTERVAL_MS = 15 * 60 * 1000;
// Canales de los filtros: AIA 131, 171, 193, 211 y 304 Å, la composición 211/193/171 que
// publica el SDO, el magnetograma (HMIB) y la luz visible de HMI aplanada (HMIIF; el
// oscurecimiento del borde lo repone el sombreador según el ángulo de la cámara). La composición 304/211/171 no se publica en imagen fija: la arma
// sdoSolar.js con 0304, 0211 y 0171.
const CHANNELS = ['0131', '0171', '0193', '0211', '0304', '211193171', 'HMIB', 'HMIIF'];
// Vídeo de las últimas 48 h en 131 Å (1024 px, ≈ 70 MB) y copia reducida para la web.
const VIDEO = { canal: '0131', url: `${BASE}mpeg/latest_1024_0131.mp4`, archivo: '0131.mp4', ancho: 768 };

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

// Copia del vídeo: 768 px, H.264 sin audio, inicio rápido. El SDO no permite usarlo desde
// otra web (sin CORS), por eso se sirve desde public/.
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  const work = await mkdtemp(join(tmpdir(), 'sdo-'));
  const response = await fetch(VIDEO.url);
  if (!response.ok) throw new Error(`${VIDEO.url}: HTTP ${response.status}`);
  const original = join(work, 'original.mp4');
  await writeFile(original, Buffer.from(await response.arrayBuffer()));
  const output = join(OUT, VIDEO.archivo);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', original, '-an', '-vf', `scale=${VIDEO.ancho}:-2:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
  const bytes = await readFile(output);
  meta.video = { canal: VIDEO.canal, archivo: VIDEO.archivo, url: VIDEO.url, fecha: new Date(response.headers.get('last-modified') || Date.now()).toISOString(),
    horas: 48, ancho: VIDEO.ancho, bytes: (await stat(output)).size, sha256: createHash('sha256').update(bytes).digest('hex') };
  await rm(work, { recursive: true, force: true });
  console.log(`vídeo 0131: ${meta.video.bytes} bytes`);
} catch (error) {
  console.warn(`Sin vídeo de 131 Å (${error.message}); el filtro usará la imagen fija.`);
}
await writeFile(join(OUT, 'sdo.json'), `${JSON.stringify(meta, null, 2)}\n`);
