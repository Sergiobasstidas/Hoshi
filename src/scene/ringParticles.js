// Anillos de Saturno como partículas. Dato: la profundidad óptica normal τ por radio que midió
// Cassini UVIS (public/data/saturn_rings.json, scripts/rings/build_rings.js) y los límites,
// albedos y espesores de la ficha de NASA. Representación: cada punto no es una roca; los
// anillos tienen del orden de 10^16 a 10^18 partículas de centímetros a metros. Aquí se reparten
// RING_PARTICLES puntos de forma que la cantidad por radio siga la fracción de luz que el anillo
// intercepta, 1 − e^(−τ), multiplicada por la circunferencia. El espesor real (de unos 10 m en
// los anillos principales) es mucho menor que cualquier píxel: los puntos están en el plano.

// NASA, Saturnian Rings Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html
export const RING_FACTS_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html';
// Radios en km; albedo, centro del intervalo de la ficha; color ilustrativo.
export const RING_REGIONS = [
  { id: 'D', name: 'Anillo D', inner: 66900, outer: 74510, tau: '≈ 0,00001', albedo: 0.2, color: '#8f877c' },
  { id: 'C', name: 'Anillo C', inner: 74658, outer: 91975, tau: '0,05–0,35', albedo: 0.21, color: '#9e9384' },
  { id: 'B', name: 'Anillo B', inner: 91975, outer: 117507, tau: '0,4–2,5 (la ocultación llega a ≈ 10)', albedo: 0.5, color: '#dccaa6' },
  { id: 'Cassini', name: 'División de Cassini', inner: 117507, outer: 122340, tau: '0–0,1', albedo: 0.3, color: '#a69d8f' },
  { id: 'A', name: 'Anillo A', inner: 122340, outer: 136780, tau: '0,4–1,0', albedo: 0.5, color: '#cdc5b6' },
  { id: 'F', name: 'Anillo F', inner: 139826, outer: 140700, tau: '0,1', albedo: 0.6, color: '#d6d6d4' },
];
export const ENCKE_GAP_KM = 133589, KEELER_GAP_KM = 136505;
// 300.000: con 600.000 la llegada a Saturno se trababa en el equipo de Sergio (14/10/2026).
export const RING_PARTICLES = 300000;
// El anillo D tiene τ ≈ 1e-5: por su dato le corresponderían unos pocos puntos. Se dibuja con
// esta cantidad fija para que se vea; es un refuerzo declarado en la ficha.
export const D_RING_PARTICLES = 6000;

export const regionAt = radiusKm => RING_REGIONS.find(region => radiusKm >= region.inner && radiusKm < region.outer)
  || (radiusKm < RING_REGIONS[0].inner ? RING_REGIONS[0] : radiusKm < 139826 ? RING_REGIONS[4] : RING_REGIONS[5]);

// Generador reproducible (mulberry32): los anillos salen iguales en cada carga.
export function seededRandom(seed = 20260409) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fracción interceptada por cada muestra y área efectiva total (km²): Σ (1 − e^(−τ)) 2πr dr.
export function ringWeights({ r0, dr, tau }) {
  const weights = new Float64Array(tau.length);
  let area = 0;
  tau.forEach((value, i) => {
    const r = r0 + i * dr;
    weights[i] = (1 - Math.exp(-value)) * 2 * Math.PI * r * dr;
    area += weights[i];
  });
  return { weights, area };
}

// Posiciones (km, plano del anillo), τ local y brillo relativo de cada partícula.
export function sampleRingParticles(profile, count = RING_PARTICLES, random = seededRandom()) {
  const { weights, area } = ringWeights(profile);
  const cumulative = new Float64Array(weights.length);
  weights.reduce((sum, value, i) => (cumulative[i] = sum + value), 0);
  const total = count + D_RING_PARTICLES;
  const position = new Float32Array(total * 3), tau = new Float32Array(total), color = new Float32Array(total * 3);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const place = (k, radius, opticalDepth) => {
    const angle = random() * Math.PI * 2;
    position[k * 3] = radius * Math.cos(angle);
    position[k * 3 + 1] = radius * Math.sin(angle);
    tau[k] = opticalDepth;
    const region = regionAt(radius), variation = 0.8 + 0.4 * random();
    rgb(region.color).forEach((value, c) => { color[k * 3 + c] = value * Math.min(1, region.albedo * 1.8) * variation; });
  };
  // Orden aleatorio, anillo D incluido: así cualquier tramo inicial del arreglo es una muestra
  // representativa y SaturnRings.jsx puede dibujar solo una parte cuando el anillo se ve pequeño.
  const [inner, outer] = [RING_REGIONS[0].inner, RING_REGIONS[0].outer];
  let remainingD = D_RING_PARTICLES;
  for (let k = 0; k < total; k++) {
    if (random() * (total - k) < remainingD) {
      // Anillo D: reparto uniforme por área entre sus bordes.
      remainingD--;
      place(k, Math.sqrt(inner ** 2 + random() * (outer ** 2 - inner ** 2)), 0.00001);
      continue;
    }
    const target = random() * area;
    let low = 0, high = cumulative.length - 1;
    while (low < high) { const mid = (low + high) >> 1; if (cumulative[mid] < target) low = mid + 1; else high = mid; }
    place(k, profile.r0 + (low - 0.5 + random()) * profile.dr, profile.tau[low]);
  }
  return { position, tau, color, area, count: total };
}
