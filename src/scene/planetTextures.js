// Solar System Scope / INOVE, CC BY 4.0. Mapas equirectangulares originales sin modificar.
// Son mapas de apariencia, no de elevación ni observaciones de una fecha concreta.
export const PLANET_TEXTURE_SOURCE = 'https://www.solarsystemscope.com/textures/';
export const PLANET_TEXTURE_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
const ROOT = '/textures/solar-system-scope/';
// `pole`: ascensión recta y declinación del polo norte de rotación en J2000; `spin`: ángulo del
// meridiano cero W = W0 + Ẇ·d (grados, d = días desde J2000), ambos de IAU WGCCRE 2015
// (https://doi.org/10.1007/s10569-017-9805-5; Luna y Marte sin sus pequeños términos periódicos).
// Con ellos cada esfera muestra la cara que de verdad mira al Sol en la fecha de carga: en la
// Tierra, el día y la noche de cada lugar; en la Luna, siempre la misma cara hacia la Tierra.
// Los mapas tienen la longitud 0 en el centro. En los planetas gaseosos el mapa de nubes no
// corresponde a una fecha: su giro es real, sus nubes no. Venus gira al revés (Ẇ negativo); su
// polo «norte» IAU es el del lado norte de la eclíptica, así que el mapa queda derecho.
export const PLANET_TEXTURES = {
  Luna: { url: `${ROOT}2k_moon.jpg`, description: 'Mapa de superficie lunar', pole: [269.9949, 66.5392], spin: [38.3213, 13.17635815] },
  Mercurio: { url: `${ROOT}2k_mercury.jpg`, description: 'Mapa de superficie', pole: [281.0103, 61.4155], spin: [329.5988, 6.1385108] },
  Venus: { url: `${ROOT}4k_venus_atmosphere.jpg`, description: 'Cubierta nubosa', pole: [272.76, 67.16], spin: [160.20, -1.4813688] },
  Tierra: { url: `${ROOT}2k_earth_daymap.jpg`, description: 'Mapa diurno de superficie', pole: [0, 90], spin: [190.147, 360.9856235] },
  Marte: { url: `${ROOT}2k_mars.jpg`, description: 'Mapa de superficie', pole: [317.269202, 54.432516], spin: [176.049863, 350.891982443297] },
  'Júpiter': { url: `${ROOT}2k_jupiter.jpg`, description: 'Mapa de nubes', pole: [268.056595, 64.495303], spin: [284.95, 870.536] },
  Saturno: { url: `${ROOT}2k_saturn.jpg`, description: 'Mapa de nubes', pole: [40.589, 83.537], spin: [38.90, 810.7939024] },
  Urano: { url: `${ROOT}2k_uranus.jpg`, description: 'Mapa de nubes', pole: [257.311, -15.175], spin: [203.81, -501.1600928] },
  Neptuno: { url: `${ROOT}2k_neptune.jpg`, description: 'Mapa de nubes', pole: [299.36, 43.46], spin: [249.978, 541.1397757] },
};

// Orientación de un cuerpo en la fecha: ejes de la esfera de three.js (X hacia la longitud 0 del
// centro del mapa, Y al polo norte, Z hacia la longitud 90° oeste) expresados en el marco
// ecuatorial J2000 de la escena.
const RAD = Math.PI / 180;
export function bodyAxes({ pole: [raDeg, decDeg], spin: [w0, rate] }, date) {
  const ra = raDeg * RAD, dec = decDeg * RAD;
  const days = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const w = ((w0 + rate * days) % 360) * RAD;
  const pole = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  // Nodo ascendente del ecuador del cuerpo sobre el ecuador J2000, origen de W.
  const node = [-Math.sin(ra), Math.cos(ra), 0];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const east = cross(pole, node);
  const meridian = node.map((value, i) => value * Math.cos(w) + east[i] * Math.sin(w));
  return { x: meridian, y: pole, z: cross(meridian, pole) };
}

