// Descarga las últimas imágenes del Solar Dynamics Observatory (SDO) que usan los filtros
// del Sol y anota su fecha en public/textures/sdo/sdo.json. El SDO pide no pedir las
// imágenes «latest» más de una vez cada 15 minutos: el script se niega antes de ese plazo.
// También baja el vídeo de 48 h de cada filtro y, con ffmpeg, guarda una copia más liviana.
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
// Vídeos de las últimas 48 h de cada filtro (1024 px). Se recomprimen sin cambiar la resolución y
// con la mitad de los cuadros, para que cada uno reciba más datos: dos pasadas de ffmpeg aprovechan casi todo el tope.
const VIDEOS = ['0131', '0171', '0193', '0304', '211193171', '304211171', 'HMIB', 'HMIIF'];
const CUADROS_POR_SEGUNDO = 10;
const TOPE_BYTES = 5e6;

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

// Copia del vídeo: 1024 px, H.264 sin audio, inicio rápido. El SDO no permite usarlo desde
// otra web (sin CORS), por eso se sirve desde public/.
meta.videos = {};
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  const work = await mkdtemp(join(tmpdir(), 'sdo-'));
  for (const canal of VIDEOS) {
    const url = `${BASE}mpeg/latest_1024_${canal}.mp4`;
    const response = await fetch(url);
    if (!response.ok) { console.warn(`${url}: HTTP ${response.status}; el filtro usará la imagen fija.`); continue; }
    const original = join(work, 'original.mp4');
    await writeFile(original, Buffer.from(await response.arrayBuffer()));
    const archivo = `${canal}.mp4`, output = join(OUT, archivo);
    const segundos = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', original], { encoding: 'utf8' }));
    const bitrate = Math.floor(TOPE_BYTES * 0.97 * 8 / segundos);
    const pasada = (numero, salida) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', original, '-an', '-vf', `fps=${CUADROS_POR_SEGUNDO}`, '-c:v', 'libx264', '-preset', 'slow', '-b:v', String(bitrate),
      '-pass', String(numero), '-passlogfile', join(work, 'pasada'), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ...salida]);
    pasada(1, ['-f', 'null', '/dev/null']);
    pasada(2, [output]);
    const bytes = await readFile(output);
    meta.videos[canal] = { archivo, url, fecha: new Date(response.headers.get('last-modified') || Date.now()).toISOString(),
      horas: 48, ancho: 1024, bitrate, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    console.log(`vídeo ${canal}: ${bytes.length} bytes, ${Math.round(bitrate / 1000)} kbps`);
  }
  await rm(work, { recursive: true, force: true });
} catch (error) {
  console.warn(`Sin vídeos (${error.message}); los filtros usarán la imagen fija.`);
}
await writeFile(join(OUT, 'sdo.json'), `${JSON.stringify(meta, null, 2)}\n`);
