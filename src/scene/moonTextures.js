import { bodyAxes } from './planetTextures.js';

// Mapas de superficie de las lunas grandes de Júpiter y Saturno (public/textures/usgs-lunas/README.md):
// mosaicos globales de USGS Astrogeology (Galileo, Voyager y Cassini) y el mapa de Mimas de NASA/JPL/SSI,
// de dominio público, reducidos a 2048 × 1024 en gris, con la longitud 0 en el centro y el este a la
// derecha, como los de planetTextures.js. Titán no lleva mapa: en luz visible se ve su neblina, no la
// superficie (como Venus, que usa sus nubes).
export const MOON_TEXTURE_ROOT = '/textures/usgs-lunas/';
export const MOON_TEXTURE_SOURCE = 'https://astrogeology.usgs.gov/search?pmi-target=jupiter';

// Polo (ascensión recta y declinación, grados) y meridiano cero W (grados) de IAU WGCCRE 2015
// (https://doi.org/10.1007/s10569-017-9805-5), con T en siglos y d en días desde J2000. En las de
// Júpiter se omiten los términos periódicos (de centésimas de grado); en Mimas, Tetis y Rea se incluyen
// los suyos, que llegan a decenas de grados (la libración de Mimas por su resonancia con Tetis).
const RAD = Math.PI / 180;
const saturno = T => ({ S3: (177.40 - 36505.5 * T) * RAD, S4: (300.00 - 7225.9 * T) * RAD, S5: (316.45 + 506.2 * T) * RAD,
  S6: (345.20 - 1016.3 * T) * RAD });
const MOONS = {
  501: { archivo: 'io.jpg', iau: (T, d) => [268.05 - 0.009 * T, 64.50 + 0.003 * T, 200.39 + 203.4889538 * d] },
  502: { archivo: 'europa.jpg', iau: (T, d) => [268.08 - 0.009 * T, 64.51 + 0.003 * T, 36.022 + 101.3747235 * d] },
  503: { archivo: 'ganimedes.jpg', iau: (T, d) => [268.20 - 0.009 * T, 64.57 + 0.003 * T, 44.064 + 50.3176081 * d] },
  504: { archivo: 'calisto.jpg', iau: (T, d) => [268.72 - 0.009 * T, 64.83 + 0.003 * T, 259.51 + 21.5710715 * d] },
  601: { archivo: 'mimas.jpg', iau: (T, d) => { const { S3, S5 } = saturno(T);
    return [40.66 - 0.036 * T + 13.56 * Math.sin(S3), 83.52 - 0.004 * T - 1.53 * Math.cos(S3),
      333.46 + 381.9945550 * d - 13.48 * Math.sin(S3) - 44.85 * Math.sin(S5)]; } },
  602: { archivo: 'encelado.jpg', iau: (T, d) => [40.66 - 0.036 * T, 83.52 - 0.004 * T, 6.32 + 262.7318996 * d] },
  603: { archivo: 'tetis.jpg', iau: (T, d) => { const { S4, S5 } = saturno(T);
    return [40.66 - 0.036 * T + 9.66 * Math.sin(S4), 83.52 - 0.004 * T - 1.09 * Math.cos(S4),
      8.95 + 190.6979085 * d - 9.60 * Math.sin(S4) + 2.23 * Math.sin(S5)]; } },
  604: { archivo: 'dione.jpg', iau: (T, d) => [40.66 - 0.036 * T, 83.52 - 0.004 * T, 357.6 + 131.5349316 * d] },
  605: { archivo: 'rea.jpg', iau: (T, d) => { const { S6 } = saturno(T);
    return [40.38 - 0.036 * T + 3.10 * Math.sin(S6), 83.55 - 0.004 * T - 0.35 * Math.cos(S6), 235.16 + 79.6900478 * d - 3.08 * Math.sin(S6)]; } },
  608: { archivo: 'japeto.jpg', iau: (T, d) => [318.16 - 3.949 * T, 75.03 - 1.143 * T, 355.2 + 4.5379572 * d] },
};

export const moonTextureUrl = code => MOONS[code] ? MOON_TEXTURE_ROOT + MOONS[code].archivo : null;

// Ejes de la esfera de la luna en la fecha (mismo convenio que bodyAxes de planetTextures.js).
export function moonAxes(code, date) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const [ra, dec, w] = MOONS[code].iau(d / 36525, d);
  return bodyAxes({ pole: [ra, dec], spin: [((w % 360) + 360) % 360, 0] }, date);
}
