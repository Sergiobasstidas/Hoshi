import { AU_TO_PC, ECLIPTIC_UP } from './scale.js';
import { HELIOSPHERE_VIEW_DISTANCE_PC } from './heliosphereScale.js';

// Forma de la heliopausa en el marco ecuatorial J2000 del catálogo (UA, Sol en el origen).
// Medido: los dos cruces de las Voyager y la dirección del viento interestelar.
// De modelo: todo lo demás, tomado de dos cortes publicados del «croissant» de Opher.
// Fuentes, cifras y debate: docs/HELIOSPHERE.md.

const DEG = Math.PI / 180;
const OBLIQUITY = 23.43928 * DEG;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => { const length = Math.hypot(...v); return v.map(c => c / length); };
const mix = (a, b, ka, kb) => a.map((v, i) => v * ka + b[i] * kb);

function eclipticDirection(longitudeDeg, latitudeDeg) {
  const l = longitudeDeg * DEG, b = latitudeDeg * DEG;
  const x = Math.cos(b) * Math.cos(l), y = Math.cos(b) * Math.sin(l), z = Math.sin(b);
  return [x, y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY), y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)];
}

// Helio neutro interestelar visto por IBEX (Bzowski et al. 2015, ApJS 220, 28):
// llega desde λ = 255,8° ± 0,5°, β = 5,16° ± 0,10° (eclíptica J2000) a 25,8 ± 0,4 km/s.
export const INTERSTELLAR_FLOW = { longitudeDeg: 255.8, latitudeDeg: 5.16, speedKmS: 25.8 };
// «Nariz»: dirección desde la que llega el viento interestelar.
export const HELIOSPHERE_NOSE = eclipticDirection(INTERSTELLAR_FLOW.longitudeDeg, INTERSTELLAR_FLOW.latitudeDeg);
// Polo norte de rotación solar (IAU): α = 286,13°, δ = 63,87°. Los lóbulos del modelo
// siguen el eje del campo magnético solar, al norte y al sur.
const SOLAR_NORTH = [Math.cos(63.87 * DEG) * Math.cos(286.13 * DEG), Math.cos(63.87 * DEG) * Math.sin(286.13 * DEG), Math.sin(63.87 * DEG)];
// Norte solar perpendicular al viento y tercer eje (flancos).
export const HELIOSPHERE_NORTH = unit(mix(SOLAR_NORTH, HELIOSPHERE_NOSE, 1, -dot(SOLAR_NORTH, HELIOSPHERE_NOSE)));
export const HELIOSPHERE_FLANK = cross(HELIOSPHERE_NOSE, HELIOSPHERE_NORTH);

// Posiciones heliocéntricas ICRF de JPL Horizons (consulta del 13/10/2026) en las
// fechas de cruce publicadas. Choque de terminación: Stone et al. (2005, 2008);
// heliopausa: Gurnett et al. (2013), Stone et al. (2019).
export const VOYAGER_CROSSINGS = [
  { probe: 'Voyager 1', shockYear: 2004, shockAu: 94.0, year: 2012, date: '25/08/2012', au: 121.6,
    position: [-26.00241375675, -115.9909301730447, 25.63484206567949] },
  { probe: 'Voyager 2', shockYear: 2007, shockAu: 83.7, year: 2018, date: '05/11/2018', au: 119.0,
    position: [32.84406348757506, -54.28543390491618, -100.6950619909854] },
];

// Contorno de la heliopausa digitalizado de dos cortes publicados del modelo de Boston
// (el «croissant» de Opher), Kornbleuth et al. 2021, ApJ 923, 179
// (https://doi.org/10.3847/1538-4357/ac2fa6): figura 2 (plano meridional, densidad de
// H neutro) y figura 10 (plano ecuatorial, temperatura). Línea blanca exterior, leída
// cada 5° desde el Sol; error de lectura ≈ ±6 UA (meridional) y ±3 UA (ecuatorial).
// Distancia Sol-heliopausa en UA para ángulos de −180° a 180° medidos desde la nariz.
// Es una instantánea de una simulación, no una medida. Procedimiento: docs/HELIOSPHERE.md.
// Meridional: ángulos positivos hacia el norte solar.
const MERIDIONAL_AU = [370, 762, 792, 798, 764, 666, 534, 490, 398, 366, 306, 290, 264, 238, 216, 197, 181, 170, 166, 160, 156, 149, 146, 146, 144, 141, 130, 130, 124, 120, 116, 111, 110, 108, 105, 104, 104, 104, 105, 104, 108, 111, 113, 116, 124, 126, 130, 137, 137, 139, 140, 140, 143, 150, 156, 166, 178, 188, 203, 218, 242, 274, 286, 300, 319, 338, 425, 444, 468, 498, 510, 485, 370];
// Ecuatorial: ángulos positivos hacia +Y de la simulación (nariz × norte). Seis lecturas
// que el trazado no resolvió se interpolaron entre sus vecinas (−145°, −135°, 45°, 135°, 145°, 160°).
const EQUATORIAL_AU = [364, 366, 370, 378, 377, 361, 342, 318, 295, 268, 242, 222, 200, 183, 172, 160, 152, 143, 137, 134, 128, 124, 121, 119, 116, 112, 111, 110, 108, 106, 106, 104, 103, 104, 103, 103, 103, 104, 104, 106, 108, 110, 112, 115, 120, 122, 124, 130, 135, 140, 149, 155, 164, 175, 187, 200, 216, 234, 252, 270, 288, 308, 320, 332, 344, 352, 360, 362, 361, 360, 362, 362, 364];
const PROFILE_STEP_DEG = 5;

// Interpolación cúbica (Catmull-Rom) de un perfil; angleDeg entre −180 y 180.
function profileAu(profile, angleDeg) {
  const position = (angleDeg + 180) / PROFILE_STEP_DEG;
  const index = Math.min(profile.length - 2, Math.floor(position));
  const t = position - index;
  const at = k => profile[Math.max(0, Math.min(profile.length - 1, k))];
  const p0 = at(index - 1), p1 = at(index), p2 = at(index + 1), p3 = at(index + 2);
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

// Relieve ilustrativo solo en los chorros, donde las simulaciones son turbulentas
// (más allá de ≈300–400 UA). Nariz, flancos y cruces de las Voyager quedan intactos.
const TURBULENCE_START_AU = 300;
const TURBULENCE_FULL_AU = 520;
const TURBULENCE_AMPLITUDE = 0.12;

// Ruido de valores 3D determinista (sin dependencias) para el relieve estático.
function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  const fx = ease(x - x0), fy = ease(y - y0), fz = ease(z - z0);
  const lerp = (a, b, t) => a + (b - a) * t;
  const plane = dz => lerp(
    lerp(hash(x0, y0, z0 + dz), hash(x0 + 1, y0, z0 + dz), fx),
    lerp(hash(x0, y0 + 1, z0 + dz), hash(x0 + 1, y0 + 1, z0 + dz), fx), fy);
  return lerp(plane(0), plane(1), fz) * 2 - 1;
}
function turbulence(direction) {
  let value = 0, weight = 0.5, frequency = 7;
  for (let octave = 0; octave < 4; octave++) {
    value += weight * valueNoise(direction[0] * frequency + 11.3, direction[1] * frequency + 5.7, direction[2] * frequency + 2.9);
    weight *= 0.55;
    frequency *= 2.1;
  }
  return value;
}

// Los dos cortes se unen girando alrededor del eje del viento: entre el plano meridional
// y el ecuatorial se interpola con pesos cos² y sen². Esa unión es una elección de
// esta figura; solo los dos planos proceden del artículo.
function sectionsAu(direction) {
  const nose = Math.max(-1, Math.min(1, dot(direction, HELIOSPHERE_NOSE)));
  const north = dot(direction, HELIOSPHERE_NORTH);
  const flank = dot(direction, HELIOSPHERE_FLANK);
  const angle = Math.acos(nose) / DEG;
  const across = Math.hypot(north, flank);
  const c = across > 1e-9 ? north / across : 1;
  const s = across > 1e-9 ? flank / across : 0;
  return c * c * profileAu(MERIDIONAL_AU, c >= 0 ? angle : -angle) + s * s * profileAu(EQUATORIAL_AU, s >= 0 ? angle : -angle);
}

function modelAu(direction) {
  const au = sectionsAu(direction);
  const t = Math.max(0, Math.min(1, (au - TURBULENCE_START_AU) / (TURBULENCE_FULL_AU - TURBULENCE_START_AU)));
  return au * (1 + TURBULENCE_AMPLITUDE * t * t * (3 - 2 * t) * turbulence(direction));
}

// Anclaje a lo medido: el contorno del modelo se retoca solo alrededor de cada cruce
// (campana de 30° de ancho) lo justo para pasar por los dos puntos de las Voyager.
// Lejos de ellos queda el contorno digitalizado sin cambios.
const ANCHOR_WIDTH = 30 * DEG;
const ANCHORS = VOYAGER_CROSSINGS.map(crossing => unit(crossing.position));
const anchorWeight = (direction, anchor) => {
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(direction, anchor))));
  return Math.exp(-((angle / ANCHOR_WIDTH) ** 2));
};
const ANCHOR_GAINS = (() => {
  const target = VOYAGER_CROSSINGS.map((crossing, k) => Math.hypot(...crossing.position) / modelAu(ANCHORS[k]) - 1);
  const cross12 = anchorWeight(ANCHORS[0], ANCHORS[1]);
  const determinant = 1 - cross12 * cross12;
  return [(target[0] - cross12 * target[1]) / determinant, (target[1] - cross12 * target[0]) / determinant];
})();
// Corrección relativa aplicada en cada cruce (Voyager 1, Voyager 2).
export const HELIOSPHERE_FIT = ANCHOR_GAINS;

// Distancia Sol-heliopausa (UA) en una dirección unitaria del marco del catálogo.
export function heliopauseAu(direction) {
  return modelAu(direction) * (1 + ANCHOR_GAINS[0] * anchorWeight(direction, ANCHORS[0]) + ANCHOR_GAINS[1] * anchorWeight(direction, ANCHORS[1]));
}

// Normal exterior de la superficie por diferencias finitas.
export function heliopauseNormal(direction) {
  const helper = Math.abs(direction[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const t1 = unit(cross(direction, helper));
  const t2 = cross(direction, t1);
  const point = d => { const u = unit(d); const r = heliopauseAu(u); return u.map(c => c * r); };
  const step = 1e-3;
  const p0 = point(direction);
  const p1 = point(mix(direction, t1, 1, step));
  const p2 = point(mix(direction, t2, 1, step));
  const normal = unit(cross(p1.map((c, i) => c - p0[i]), p2.map((c, i) => c - p0[i])));
  return dot(normal, direction) < 0 ? normal.map(c => -c) : normal;
}

const meridional = angleDeg => heliopauseAu(mix(HELIOSPHERE_NOSE, HELIOSPHERE_NORTH, Math.cos(angleDeg * DEG), Math.sin(angleDeg * DEG)));
export const HELIOSPHERE_NOSE_AU = heliopauseAu(HELIOSPHERE_NOSE);
// Extremos de los dos lóbulos en el corte meridional y fondo del hueco entre ellos.
export const HELIOSPHERE_NORTH_LOBE_AU = meridional(170);
export const HELIOSPHERE_SOUTH_LOBE_AU = meridional(-165);
export const HELIOSPHERE_TAIL_AU = heliopauseAu(HELIOSPHERE_NOSE.map(c => -c));

// Vista de presentación: de costado, con el viento llegando por la izquierda, la cola
// hacia la derecha y el plano de los planetas (eclíptica) horizontal en pantalla.
// Solo mueve la cámara; el catálogo no se gira.
const ECLIPTIC_SIDE = unit(cross(HELIOSPHERE_NOSE, ECLIPTIC_UP));
export const HELIOSPHERE_VIEW = {
  id: 'heliosphere', label: 'Heliosfera', distance: HELIOSPHERE_VIEW_DISTANCE_PC, up: ECLIPTIC_UP,
  direction: unit(ECLIPTIC_SIDE.map((c, i) => -c + 0.3 * HELIOSPHERE_NOSE[i] + 0.22 * ECLIPTIC_UP[i])),
};

const at = (direction, au) => direction.map(c => c * au * AU_TO_PC);
export const HELIOSPHERE_LABELS = [
  // Nombre sobre la parte alta (norte solar), que en la vista de la heliosfera queda arriba.
  { kind: 'heliosphere', text: 'Heliosfera', position: at(HELIOSPHERE_NORTH, heliopauseAu(HELIOSPHERE_NORTH) * 1.12), width: 90, color: '#80b6c0' },
];
