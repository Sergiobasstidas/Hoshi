// Formato de public/data/estrellas.bin.gz (lo genera scripts/build_estrellas.js; se guarda con gzip y la app lo
// descomprime al bajarlo). Little-endian, versión 2:
//   0   4 bytes   firma ASCII «HSBE»
//   4   uint32    versión
//   8   uint32    largo de la cabecera JSON (con relleno hasta múltiplo de 8)
//   12  cabecera JSON: { nCatalogo, nCapa, nExtra, sp: [tipos espectrales], nombres: { hsb: nombre } }
//   Catálogo (N = nCatalogo), en columnas:
//     float64 × nExtra      valores que no caben como entero y decimales (en orden de aparición)
//     uint32 × N            número HSB
//     int32 × 4N            x, y, z, d como entero (mantisa); el valor es mantisa / 10^decimales
//     int16 × N             magnitud absoluta × 1000
//     int16 × N             B−V × 1000
//     uint16 × N            tipo espectral (índice en cabecera.sp; '' = sin tipo)
//     int8 × 4N             decimales de x, y, z, d (−128 = el valor está en la lista float64)
//     uint8 × 3N            color RGB
//   Celdas de la capa (solo las usa la capa, por eso van después del catálogo):
//     (relleno hasta múltiplo de 4)
//     uint32                largo del JSON de celdas (con relleno de espacios para que la capa empiece en un byte par)
//     JSON [[x0, y0, z0, lado, primera, cantidad], …]
//   Capa de fondo (G = nCapa: millón de Gaia DR3 y GCNS), ordenada por celdas:
//     uint16 × 3G           posición dentro de su celda: origen + q · lado / 65535 (pc)
//     uint8 × G             magnitud absoluta G cuantizada (como gaia-1m.bin, ver gaiaCapa.js)
//     uint8 × G             BP−RP cuantizado (255 = sin color)
// El catálogo va antes que la capa: la app puede empezar a dibujar con solo esa parte.

export const ESTRELLAS_URL = '/data/estrellas.bin.gz';
export const ESTRELLAS_FIRMA = 'HSBE';
export const ESTRELLAS_VERSION = 2;
export const MAX_POR_CELDA = 4096;
const MAX_DECIMALES = 12;

// [mantisa, decimales] tal que mantisa / 10^decimales === valor, o null si no cabe en int32.
export function codificarValor(valor) {
  if (!Number.isFinite(valor)) return null;
  for (let k = 0; k <= MAX_DECIMALES; k++) {
    const mantisa = Math.round(valor * 10 ** k);
    if (Math.abs(mantisa) > 2147483647) return null;
    if (mantisa / 10 ** k === valor) return [mantisa, k];
  }
  return null;
}

function cabeceraDe(buffer) {
  const vista = new DataView(buffer);
  const firma = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (firma !== ESTRELLAS_FIRMA || vista.getUint32(4, true) !== ESTRELLAS_VERSION) throw new Error(`estrellas.bin: formato inesperado (${firma})`);
  const largo = vista.getUint32(8, true);
  const cabecera = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, largo)).trimEnd());
  return { cabecera, inicio: 12 + largo };
}

// Bytes que ocupan la cabecera y el catálogo, hasta el fin del catálogo (para empezar antes de que llegue la capa).
export function largoHastaCapa(cabecera, inicio) {
  return inicio + 8 * cabecera.nExtra + cabecera.nCatalogo * (4 + 16 + 2 + 2 + 2 + 4 + 3);
}

// Estrellas del catálogo como objetos { i, n?, x, y, z, d, m, c, sp, rgb }, igual que stars_15pc.json.
export function leerCatalogo(buffer) {
  const { cabecera, inicio } = cabeceraDe(buffer);
  const n = cabecera.nCatalogo;
  let p = inicio;
  const tomar = (Tipo, cantidad) => { const a = new Tipo(buffer, p, cantidad); p += cantidad * Tipo.BYTES_PER_ELEMENT; return a; };
  const extra = tomar(Float64Array, cabecera.nExtra), hsb = tomar(Uint32Array, n), mant = tomar(Int32Array, 4 * n);
  const m = tomar(Int16Array, n), c = tomar(Int16Array, n), sp = tomar(Uint16Array, n), dec = tomar(Int8Array, 4 * n), rgb = tomar(Uint8Array, 3 * n);
  let e = 0;
  const valor = k => (dec[k] === -128 ? extra[e++] : mant[k] / 10 ** dec[k]);
  const estrellas = new Array(n);
  for (let k = 0; k < n; k++) {
    const i = hsb[k];
    const x = valor(4 * k), y = valor(4 * k + 1), z = valor(4 * k + 2), d = valor(4 * k + 3);
    const estrella = { i, n: cabecera.nombres[i] ?? null, x, y, z, d, m: m[k] / 1000, c: c[k] / 1000, sp: cabecera.sp[sp[k]] || null, rgb: [rgb[3 * k], rgb[3 * k + 1], rgb[3 * k + 2]] };
    estrellas[k] = estrella;
  }
  return { cabecera, estrellas, finCatalogo: p };
}

// Capa de fondo: celdas, posiciones cuantizadas y bytes de magnitud y color. finCatalogo: donde termina el catálogo.
export function leerCapa(buffer, cabecera, finCatalogo) {
  const g = cabecera.nCapa;
  const inicioCeldas = finCatalogo + ((4 - (finCatalogo % 4)) % 4);
  const largo = new DataView(buffer).getUint32(inicioCeldas, true);
  const celdas = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, inicioCeldas + 4, largo)).trimEnd());
  const inicioCapa = inicioCeldas + 4 + largo;
  // Copias propias: así el archivo completo (catálogo incluido) se puede soltar de la memoria.
  const q = new Uint16Array(buffer, inicioCapa, 3 * g).slice();
  const magnitudes = new Uint8Array(buffer, inicioCapa + 6 * g, g).slice();
  const colores = new Uint8Array(buffer, inicioCapa + 7 * g, g).slice();
  return { n: g, celdas, q, magnitudes, colores };
}

// Posiciones de la capa respecto de `origen` (pc), en doble precisión y luego float32.
export function posicionesCapa(capa, origen, destino = new Float32Array(3 * capa.n), desde = 0) {
  for (const [x0, y0, z0, lado, primera, cantidad] of capa.celdas) {
    const paso = lado / 65535, ox = x0 - origen[0], oy = y0 - origen[1], oz = z0 - origen[2];
    for (let k = primera; k < primera + cantidad; k++) {
      destino[desde + 3 * k] = ox + capa.q[3 * k] * paso;
      destino[desde + 3 * k + 1] = oy + capa.q[3 * k + 1] * paso;
      destino[desde + 3 * k + 2] = oz + capa.q[3 * k + 2] * paso;
    }
  }
  return destino;
}

export { cabeceraDe };
