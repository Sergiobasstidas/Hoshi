// PNG RGB de 8 bits sin dependencias (zlib de Node). Sin fragmentos gAMA/iCCP: el navegador no corrige el color.
import { deflateSync } from 'node:zlib';
const TABLA = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = TABLA[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
// rgb: Uint8Array de ancho·alto·3, fila 0 arriba.
export function pngRgb(rgb, ancho, alto) {
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(ancho, 0); cab.writeUInt32BE(alto, 4); cab[8] = 8; cab[9] = 2; cab[10] = 0; cab[11] = 0; cab[12] = 0;
  const filas = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) { filas[y * (ancho * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * ancho * 3, ancho * 3).copy(filas, y * (ancho * 3 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('IDAT', deflateSync(filas, { level: 9 })), trozo('IEND', Buffer.alloc(0))]);
}
