import { AU_TO_PC, KM_TO_PC } from './scale.js';

// Elementos keplerianos medios y sus tasas por siglo juliano, válidos de 1800 a 2050.
// JPL, «Approximate Positions of the Planets», tabla 1, consultada el 13/10/2026:
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
// Heliocéntricos, eclíptica y equinoccio medios J2000. Por fila: valor en J2000 y tasa de
// a (UA), e, I (°), L (°), longitud del perihelio ϖ (°) y longitud del nodo Ω (°).
// La fila de la Tierra es la del baricentro Tierra-Luna; planetPosition lo corrige con la Luna.
// Error declarado por JPL frente a la efeméride completa: de segundos a pocos minutos de arco.
export const ORBITAL_ELEMENTS_SOURCE = 'https://ssd.jpl.nasa.gov/planets/approx_pos.html';
const ELEMENTS = {
  Mercurio: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  Venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  Tierra: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  Marte: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  Júpiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  Saturno: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  Urano: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  Neptuno: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
};

const RAD = Math.PI / 180;
// La misma oblicuidad J2000 que usa scale.js para pasar de la eclíptica al marco del catálogo.
const OBLIQUITY = 23.43928 * RAD;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const CENTURY_MS = 36525 * 86400000;

// Los planetas se colocan en la fecha en que se abre la página y no avanzan después.
// Se toma la hora UTC como tiempo dinámico: la diferencia (≈ 69 s) mueve a Mercurio
// unos 3.000 km, muy por debajo del error de los elementos.
export const EPHEMERIS_DATE = new Date();

export function orbitalElements(name, date = EPHEMERIS_DATE) {
  const [base, rate] = ELEMENTS[name];
  const centuries = (date.getTime() - J2000_MS) / CENTURY_MS;
  const [a, e, inclination, meanLongitude, perihelion, node] = base.map((value, i) => value + rate[i] * centuries);
  return { a, e, inclinationDeg: inclination, nodeDeg: node, perihelionArgumentDeg: perihelion - node,
    meanAnomalyDeg: ((meanLongitude - perihelion) % 360 + 540) % 360 - 180 };
}

function eccentricAnomaly(meanAnomaly, e) {
  let E = meanAnomaly + e * Math.sin(meanAnomaly);
  for (let i = 0; i < 12; i++) {
    const step = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-13) break;
  }
  return E;
}

// Punto de la elipse con anomalía excéntrica E, en parsecs y en el marco ecuatorial J2000.
function ellipsePoint(elements, E) {
  const x = elements.a * (Math.cos(E) - elements.e);
  const y = elements.a * Math.sqrt(1 - elements.e ** 2) * Math.sin(E);
  const w = elements.perihelionArgumentDeg * RAD, node = elements.nodeDeg * RAD, inc = elements.inclinationDeg * RAD;
  const u = x * Math.cos(w) - y * Math.sin(w), v = x * Math.sin(w) + y * Math.cos(w);
  const eclipticX = u * Math.cos(node) - v * Math.sin(node) * Math.cos(inc);
  const eclipticY = u * Math.sin(node) + v * Math.cos(node) * Math.cos(inc);
  const eclipticZ = v * Math.sin(inc);
  return [eclipticX * AU_TO_PC,
    (eclipticY * Math.cos(OBLIQUITY) - eclipticZ * Math.sin(OBLIQUITY)) * AU_TO_PC,
    (eclipticY * Math.sin(OBLIQUITY) + eclipticZ * Math.cos(OBLIQUITY)) * AU_TO_PC];
}

// Posición geocéntrica de la Luna: serie de baja precisión del Astronomical Almanac
// (longitud y latitud eclípticas y paralaje horizontal; ≈ 0,3° y ≈ 0,2 radios terrestres),
// la misma que reproduce Montenbruck & Gill, «Satellite Orbits», apartado 3.3.2.
// La serie da la eclíptica de la fecha: se resta la precesión general (1,39697°/siglo)
// para llevar la longitud a J2000. Parsecs, marco ecuatorial J2000.
const EARTH_EQUATORIAL_RADIUS_KM = 6378.14;
// Masa de la Tierra entre masa de la Luna: https://ssd.jpl.nasa.gov/astro_par.html
const EARTH_MOON_MASS_RATIO = 81.30056;
const series = (terms, wave, T) => terms.reduce((sum, [amplitude, phase, rate]) => sum + amplitude * wave((phase + rate * T) * RAD), 0);
export function moonOffset(date = EPHEMERIS_DATE) {
  const T = (date.getTime() - J2000_MS) / CENTURY_MS;
  const longitude = (218.32 + 481267.881 * T - 1.39697 * T + series([[6.29, 135.0, 477198.87], [-1.27, 259.3, -413335.36],
    [0.66, 235.7, 890534.22], [0.21, 269.9, 954397.74], [-0.19, 357.5, 35999.05], [-0.11, 186.5, 966404.03]], Math.sin, T)) * RAD;
  const latitude = series([[5.13, 93.3, 483202.02], [0.28, 228.2, 960400.89], [-0.28, 318.3, 6003.15], [-0.17, 217.6, -407332.21]], Math.sin, T) * RAD;
  const parallax = (0.9508 + series([[0.0518, 135.0, 477198.87], [0.0095, 259.3, -413335.36], [0.0078, 235.7, 890534.22], [0.0028, 269.9, 954397.74]], Math.cos, T)) * RAD;
  const distance = EARTH_EQUATORIAL_RADIUS_KM / Math.sin(parallax) * KM_TO_PC;
  const x = distance * Math.cos(latitude) * Math.cos(longitude), y = distance * Math.cos(latitude) * Math.sin(longitude), z = distance * Math.sin(latitude);
  return [x, y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY), y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)];
}

// La Tierra se separa del baricentro Tierra-Luna (hasta ≈ 4.700 km) en sentido opuesto a la Luna.
export function planetPosition(name, date = EPHEMERIS_DATE) {
  const elements = orbitalElements(name, date);
  const position = ellipsePoint(elements, eccentricAnomaly(elements.meanAnomalyDeg * RAD, elements.e));
  if (name !== 'Tierra') return position;
  const moon = moonOffset(date);
  return position.map((value, i) => value - moon[i] / (1 + EARTH_MOON_MASS_RATIO));
}

export function moonPosition(date = EPHEMERIS_DATE) {
  const earth = planetPosition('Tierra', date), moon = moonOffset(date);
  return earth.map((value, i) => value + moon[i]);
}

// Elipse cerrada con el Sol en un foco: la órbita osculadora de esa fecha.
export function planetOrbit(name, date = EPHEMERIS_DATE, segments = 1024) {
  const elements = orbitalElements(name, date);
  const points = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) points.set(ellipsePoint(elements, i / segments * Math.PI * 2), i * 3);
  return points;
}
