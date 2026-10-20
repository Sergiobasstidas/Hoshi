// Parámetros de la superficie estelar tomados de medidas solares publicadas y de sus
// leyes de escala. Donde no hay dato por estrella se indica que es una aproximación.
const SOLAR_TEMPERATURE_K = 5772;
const SOLAR_RADIUS_MM = 695.7;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (from, to, value) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
const validTemperature = value => Number.isFinite(value) && value > 0 ? value : SOLAR_TEMPERATURE_K;

// Escala dominante de la granulación solar: ≈ 1.000 km, con gránulos de 1.000–1.500 km.
export const SOLAR_GRANULE_MM = 1.3;
// Contraste rms de la granulación sin degradar por el telescopio: 14–16 % (simulaciones
// 3D contrastadas con Hinode, arXiv:0804.4230); Hinode mide 7 % por su resolución.
export const GRANULATION_RMS = 0.15;
// Vida de un gránulo ≈ 10 min. El tiempo se acelera para que el hervor sea visible.
export const GRANULE_LIFETIME_S = 600;
export const TIME_ACCELERATION = 60;
// Manchas: umbras de 1–20 Mm de diámetro, penumbra ≈ 4,7 veces el área de la umbra,
// latitudes dentro de ±35°. Intensidades relativas al disco en calma: el límite
// umbra/penumbra está en 0,655 y el de penumbra/fotosfera en 0,945 (arXiv:1402.2881).
export const SUNSPOT = { umbraRadiusMm: [1.5, 10], penumbraRadiusRatio: Math.sqrt(1 + 4.7),
  maxLatitudeDeg: 35, umbraIntensity: 0.3, penumbraIntensity: 0.8, umbraCoolingK: 1800 };

// Masa aproximada solo para escalar la granulación: relación de secuencia principal si
// el radio es compatible con ella; si la estrella es mucho mayor (evolucionada) se
// adopta 1,5 M☉ porque el catálogo no trae masa. No es una medición.
export function approximateMassSolar(temperatureK, radiusSolar) {
  const t = validTemperature(temperatureK) / SOLAR_TEMPERATURE_K;
  if (Number.isFinite(radiusSolar) && radiusSolar > 2.5 * t ** 1.33) return 1.5;
  return clamp(t ** 1.67, 0.1, 20);
}

// El tamaño del gránulo sigue la escala de altura de presión: d ∝ T·R²/M
// (Freytag et al. 1997; arXiv:1109.1194). Devuelve gránulos por radio estelar.
export function granulesPerRadius(temperatureK, radiusSolar) {
  const radius = Number.isFinite(radiusSolar) && radiusSolar > 0 ? radiusSolar : 1;
  const t = validTemperature(temperatureK) / SOLAR_TEMPERATURE_K;
  const relativeSize = t * radius / approximateMassSolar(temperatureK, radius);
  return clamp(SOLAR_RADIUS_MM / SOLAR_GRANULE_MM / relativeSize, 6, 4000);
}

// Las estrellas frías tienen envoltura convectiva y muestran granulación y manchas;
// por encima de unos 7.000–10.000 K la envoltura es radiativa y el disco es casi liso.
// La abundancia de manchas de otras estrellas no se conoce: se usa la solar.
export function surfaceActivity(temperatureK) {
  const temperature = validTemperature(temperatureK);
  const convection = 1 - 0.95 * smooth(6500, 9500, temperature);
  const spots = convection * (1 - 0.5 * smooth(4000, 6500, temperature));
  return { convection, spots };
}

// Coeficiente lineal de oscurecimiento del borde en banda visual, I(μ)/I(1) = 1 − u(1 − μ).
// El Sol tiene u ≈ 0,6; el resto son valores aproximados de tablas teóricas (Claret 2000).
const LIMB_TABLE = [[3500, 0.8], [4000, 0.76], [5772, 0.62], [8000, 0.48], [12000, 0.38], [20000, 0.3]];
export function limbDarkening(temperatureK) {
  const temperature = clamp(validTemperature(temperatureK), 3500, 20000);
  const upper = LIMB_TABLE.findIndex(([t]) => t >= temperature);
  if (upper <= 0) return LIMB_TABLE[0][1];
  const [t0, u0] = LIMB_TABLE[upper - 1], [t1, u1] = LIMB_TABLE[upper];
  return u0 + (u1 - u0) * (temperature - t0) / (t1 - t0);
}

// Generador determinista: la misma estrella muestra siempre las mismas regiones.
function sequence(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAX_ACTIVE_REGIONS = 12;
// Arcos de plasma: las protuberancias solares miden de 10 a algo más de 100 Mm de altura
// y de decenas a unos pocos cientos de megámetros de largo.
export const LOOP = { separationMm: [50, 220], heightRatio: [0.4, 0.85], maxHeightMm: 110 };

// Regiones activas compartidas por manchas, playas, abanicos coronales y arcos de plasma.
// Su número y posición son ilustrativos (no hay mapa magnético por estrella); tamaños y
// latitudes siguen los rangos solares de SUNSPOT y LOOP. El eje de giro es +Y.
export function activeRegions(temperatureK, radiusSolar = 1) {
  const { spots } = surfaceActivity(temperatureK);
  const random = sequence(Math.round(validTemperature(temperatureK)) * 31 + Math.round((radiusSolar || 1) * 1000));
  const count = Math.round(MAX_ACTIVE_REGIONS * spots);
  const mm = value => value / SOLAR_RADIUS_MM;
  return Array.from({ length: count }, (_, index) => {
    const latitude = (index % 2 ? -1 : 1) * (5 + random() * (SUNSPOT.maxLatitudeDeg - 5)) * Math.PI / 180;
    const longitude = random() * 2 * Math.PI;
    const size = random() ** 2;
    const [minUmbra, maxUmbra] = SUNSPOT.umbraRadiusMm;
    const loops = Array.from({ length: 2 + Math.floor(random() * 3) }, () => {
      const separation = mm(LOOP.separationMm[0] + random() * (LOOP.separationMm[1] - LOOP.separationMm[0]));
      return { azimuth: random() * Math.PI, separation,
        height: Math.min(mm(LOOP.maxHeightMm), separation * (LOOP.heightRatio[0] + random() * (LOOP.heightRatio[1] - LOOP.heightRatio[0]))),
        tilt: (random() - 0.5) * 0.9, phase: random() * 2 * Math.PI };
    });
    return { direction: [Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)],
      umbraRadius: mm(minUmbra + size * (maxUmbra - minUmbra)), loops };
  });
}
