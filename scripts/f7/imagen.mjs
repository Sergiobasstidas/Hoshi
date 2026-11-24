// Decodifica una imagen (JPEG o PNG) a RGB de 8 bits, fila 0 arriba, sin dependencias de npm:
// con ffmpeg si está instalado y, si no, con sips (viene con macOS) pasando por BMP.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function conFfmpeg(archivo) {
  const [ancho, alto] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', archivo])
    .toString().trim().split(',').map(Number);
  const datos = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', archivo, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  return { ancho, alto, rgb: new Uint8Array(datos.buffer, datos.byteOffset, datos.length) };
}
function conSips(archivo) {
  const tmp = path.join(os.tmpdir(), `f7-imagen-${process.pid}.bmp`);
  execFileSync('sips', ['-s', 'format', 'bmp', archivo, '--out', tmp], { stdio: 'ignore' });
  const b = fs.readFileSync(tmp); fs.unlinkSync(tmp);
  return leerBmp(b);
}
// BMP sin compresión de 24 bits (BGR) o de 32 bits (BI_RGB o BI_BITFIELDS), de abajo arriba o de arriba abajo.
export function leerBmp(b) {
  const inicio = b.readUInt32LE(10), ancho = b.readInt32LE(18), altoFirmado = b.readInt32LE(22);
  const bits = b.readUInt16LE(28), compresion = b.readUInt32LE(30);
  if (![24, 32].includes(bits) || ![0, 3, 6].includes(compresion)) throw new Error(`BMP no soportado: ${bits} bits, compresión ${compresion}`);
  const alto = Math.abs(altoFirmado), abajoArriba = altoFirmado > 0, bpp = bits / 8, fila = Math.ceil((ancho * bpp) / 4) * 4;
  let mascaras = [0x00ff0000, 0x0000ff00, 0x000000ff];
  if (compresion !== 0) mascaras = [b.readUInt32LE(54), b.readUInt32LE(58), b.readUInt32LE(62)];
  const corrimiento = m => { let s = 0; while (m && !(m & 1)) { m >>>= 1; s++; } return s; };
  const desp = mascaras.map(corrimiento);
  const rgb = new Uint8Array(ancho * alto * 3);
  for (let y = 0; y < alto; y++) {
    const origen = inicio + (abajoArriba ? alto - 1 - y : y) * fila;
    for (let x = 0; x < ancho; x++) {
      const o = origen + x * bpp, k = 3 * (y * ancho + x);
      if (bpp === 3) { rgb[k] = b[o + 2]; rgb[k + 1] = b[o + 1]; rgb[k + 2] = b[o]; }
      else { const p = b.readUInt32LE(o); for (let c = 0; c < 3; c++) rgb[k + c] = ((p & mascaras[c]) >>> desp[c]) & 255; }
    }
  }
  return { ancho, alto, rgb };
}
export function leerImagen(archivo) {
  try { return conFfmpeg(archivo); } catch (error) {
    if (process.platform !== 'darwin') throw error;
    return conSips(archivo);
  }
}
// Reduce por promedio de bloques k×k (k = ancho/n entero), en los valores codificados como hace un escalado común.
export function reducir({ ancho, alto, rgb }, n) {
  const k = ancho / n;
  if (!Number.isInteger(k) || alto / n !== k) throw new Error(`la imagen ${ancho}×${alto} no se reduce exacto a ${n}×${n}`);
  const salida = new Uint8Array(n * n * 3);
  for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += rgb[3 * ((v * k + j) * ancho + u * k + i) + c];
    salida[3 * (v * n + u) + c] = Math.round(s / (k * k));
  }
  return salida;
}
