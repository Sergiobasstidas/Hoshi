import { AU_TO_PC, ECLIPTIC_UP, KM_TO_PC, SUN_RADIUS_KM } from './scale.js';
import { BINARY_EPOCH, dateMjd, eccentricAnomaly } from './binaryOrbit.js';
import { temperatureColor } from './stellarPhysics.js';

// Órbitas de exoplanetas a partir de la tabla compuesta de la NASA. Marco: pc,
// ecuatorial J2000, Sol en el origen. Qué es medido y qué supuesto se declara por
// planeta en `s` (ver ASSUMPTIONS). Véase docs/exoplanets/SISTEMAS_PLANETARIOS.md.

// Radio ecuatorial terrestre nominal (IAU 2015), la unidad de pl_rade.
export const EARTH_RADIUS_KM = 6378.1;
// Mediana de la inclinación para orientaciones al azar (cos i uniforme).
export const ASSUMED_INCLINATION_DEG = 60;
// La tabla no trae la longitud del nodo ascendente: valor convencional para todos.
export const CONVENTIONAL_NODE_DEG = 0;
export const EXOPLANET_EPOCH = BINARY_EPOCH;
export const EXOPLANET_EPOCH_JD = dateMjd(EXOPLANET_EPOCH) + 2400000.5;
// Encuadre de llegada: no alejarse por una compañera fotografiada a miles de UA.
export const PLANET_FRAME_LIMIT_AU = 2500;

// Marcas de lo que no es una medida de la tabla. La clave es la letra guardada en `s`.
export const ASSUMPTIONS = {
  a: 'semieje calculado con la 3.ª ley de Kepler',
  P: 'período calculado con la 3.ª ley de Kepler',
  e: 'excentricidad sin publicar: órbita circular supuesta',
  c: 'excentricidad 0 en la tabla (suele ser un valor fijado)',
  i: `inclinación desconocida: ${ASSUMED_INCLINATION_DEG}° supuestos`,
  t: 'inclinación sin publicar: 90° por ser un tránsito',
  k: 'inclinación desconocida: se supone el plano de los planetas medidos del sistema',
  w: 'orientación de la elipse supuesta (ω = 0°)',
  f: 'posición en la órbita ilustrativa (sin fase medida)',
  r: 'radio estimado con una relación masa-radio',
  R: 'radio desconocido: marcador',
};

const radians = degrees => degrees * Math.PI / 180;

// 3.ª ley de Kepler con la masa de la estrella (M☉): a en UA, P en días.
export const keplerSemiMajorAu = (periodDays, starMass) => Math.cbrt(starMass * (periodDays / 365.25) ** 2);
export const keplerPeriodDays = (semiMajorAu, starMass) => 365.25 * Math.sqrt(semiMajorAu ** 3 / starMass);

// Completa los elementos de un planeta de exoplanet_systems.json y anota lo supuesto.
// Devuelve null si no hay con qué fijar el tamaño de la órbita.
// `systemInclination`: mediana de las inclinaciones medidas en el sistema, si las hay; los
// sistemas con varios planetas conocidos son casi coplanares.
export function resolvePlanet(planet, starMass = null, sharedPeriastron = false, systemInclination = null) {
  const s = [];
  let a = planet.a, P = planet.P;
  if (a === null && P !== null && starMass > 0) { a = keplerSemiMajorAu(P, starMass); s.push('a'); }
  if (a === null || !(a > 0)) return null;
  if (P === null && starMass > 0) { P = keplerPeriodDays(a, starMass); s.push('P'); }
  let e = planet.e;
  if (e === null) { e = 0; s.push('e'); } else if (e === 0) s.push('c');
  let inc = planet.inc;
  if (inc === null) {
    if (planet.f?.tr) { inc = 90; s.push('t'); }
    else if (systemInclination !== null) { inc = systemInclination; s.push('k'); }
    else { inc = ASSUMED_INCLINATION_DEG; s.push('i'); }
  }
  let w = planet.w;
  if (w === null) { w = 0; if (e > 0) s.push('w'); }
  // Fase: el tránsito central es la referencia más directa. Un «tiempo de periastro»
  // idéntico en varios planetas es la época de un ajuste dinámico, no un periastro.
  let t = null;
  if (P !== null && !s.includes('P')) {
    if (planet.t0 !== null && (planet.f?.tr || planet.tp === null || sharedPeriastron)) t = ['t0', planet.t0];
    else if (planet.tp !== null && !sharedPeriastron) t = ['tp', planet.tp];
    else if (planet.t0 !== null) t = ['t0', planet.t0];
  }
  if (!t) s.push('f');
  if (planet.r === null) s.push('R'); else if (planet.calc?.includes('pl_rade')) s.push('r');
  return { n: planet.n, a: Number(a.toPrecision(5)), P: P === null ? null : Number(P.toPrecision(8)), e, inc, w, t,
    r: planet.r, teq: planet.teq, m: planet.m, mp: planet.mp, s: s.join('') };
}

// Del plano de la órbita (x hacia el periastro) al marco ecuatorial. Misma transformación
// que relativeOrbitAu de binaryOrbit.js: ángulo de posición desde el norte hacia el este y
// línea de visión positiva alejándose del Sol. `omegaDeg` es el argumento del periastro
// del cuerpo cuya posición se dibuja.
export function orbitalPlaneToEquatorial(x, y, { omegaDeg, nodeDeg, inclinationDeg, raDeg, decDeg }) {
  const w = radians(omegaDeg), node = radians(nodeDeg), inc = radians(inclinationDeg);
  const u = x * Math.cos(w) - y * Math.sin(w), v = x * Math.sin(w) + y * Math.cos(w);
  const north = u * Math.cos(node) - v * Math.sin(node) * Math.cos(inc);
  const east = u * Math.sin(node) + v * Math.cos(node) * Math.cos(inc);
  const away = v * Math.sin(inc);
  const ra = radians(raDeg), dec = radians(decDeg);
  return [
    -east * Math.sin(ra) - north * Math.sin(dec) * Math.cos(ra) + away * Math.cos(dec) * Math.cos(ra),
    east * Math.cos(ra) - north * Math.sin(dec) * Math.sin(ra) + away * Math.cos(dec) * Math.sin(ra),
    north * Math.cos(dec) + away * Math.sin(dec),
  ];
}

// Dirección del sistema desde su posición en pc.
export function skyDirection([x, y, z]) {
  return { raDeg: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, decDeg: Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI };
}

// Posición del planeta respecto de su estrella (UA) en la anomalía excéntrica E. La
// tabla da el argumento del periastro de la órbita de la estrella (convención de
// velocidad radial); el del planeta difiere en 180°.
export function planetOffsetAu(E, planet, sky) {
  const x = planet.a * (Math.cos(E) - planet.e);
  const y = planet.a * Math.sqrt(1 - planet.e ** 2) * Math.sin(E);
  return orbitalPlaneToEquatorial(x, y, { omegaDeg: planet.w + 180, nodeDeg: planet.node ?? CONVENTIONAL_NODE_DEG,
    inclinationDeg: planet.inc, raDeg: sky.raDeg, decDeg: sky.decDeg });
}

// Anomalía excéntrica del tránsito: el punto de la órbita cuya dirección queda más cerca
// de la del Sol. Se busca numéricamente sobre la geometría dibujada para no depender de
// la convención de ω. En una órbita vista de frente no hay tránsito: se usa la conjunción.
export function transitEccentricAnomaly(planet, sky) {
  const length = Math.hypot(sky.x, sky.y, sky.z);
  const towardSun = [-sky.x / length, -sky.y / length, -sky.z / length];
  const alignment = E => {
    const p = planetOffsetAu(E, planet, sky);
    return (p[0] * towardSun[0] + p[1] * towardSun[1] + p[2] * towardSun[2]) / Math.hypot(...p);
  };
  if (Math.abs(Math.sin(radians(planet.inc))) < 1e-6) {
    const nu = radians(90 - planet.w);
    return 2 * Math.atan2(Math.sqrt(1 - planet.e) * Math.sin(nu / 2), Math.sqrt(1 + planet.e) * Math.cos(nu / 2));
  }
  const samples = 720;
  let best = 0, bestValue = -Infinity;
  for (let i = 0; i < samples; i++) {
    const value = alignment(i / samples * 2 * Math.PI);
    if (value > bestValue) { bestValue = value; best = i; }
  }
  // Sección áurea alrededor de la mejor muestra.
  let low = (best - 1) / samples * 2 * Math.PI, high = (best + 1) / samples * 2 * Math.PI;
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const c = high - ratio * (high - low), d = low + ratio * (high - low);
    if (alignment(c) > alignment(d)) high = d; else low = c;
  }
  return (low + high) / 2;
}

// Anomalía media en la fecha juliana `jd`, o null si el planeta no tiene fase medida.
export function meanAnomalyAt(planet, sky, jd = EXOPLANET_EPOCH_JD) {
  if (!planet.t || planet.P === null) return null;
  const [kind, epoch] = planet.t;
  const advance = 2 * Math.PI * (jd - epoch) / planet.P;
  if (kind === 'tp') return advance;
  const E = transitEccentricAnomaly(planet, sky);
  return E - planet.e * Math.sin(E) + advance;
}

// Posición en la fecha (UA). Sin fase medida, el periastro: ilustrativa y marcada con 'f'.
export function planetStateAu(planet, sky, jd = EXOPLANET_EPOCH_JD) {
  const mean = meanAnomalyAt(planet, sky, jd);
  return planetOffsetAu(mean === null ? 0 : eccentricAnomaly(mean, planet.e), planet, sky);
}

export function planetOrbitPc(planet, sky, samples = 256) {
  const points = new Float32Array((samples + 1) * 3);
  for (let i = 0; i <= samples; i++) points.set(planetOffsetAu(i / samples * 2 * Math.PI, planet, sky).map(v => v * AU_TO_PC), i * 3);
  return points;
}

const normalize = v => { const length = Math.hypot(...v); return v.map(x => x / length); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Ángulo entre la mirada de llegada y la normal del plano orbital: las órbitas se ven
// en perspectiva, abiertas y con profundidad (eje menor/mayor ≈ cos 64° = 0,44), como en
// la captura de referencia de Sergio del 13/10/2026. Es solo la posición de la cámara.
export const ARRIVAL_TILT_DEG = 64;
// Distancia de llegada en múltiplos de la órbita mayor encuadrada: llena el ancho.
export const ARRIVAL_FRAME_FACTOR = 1.8;
// Vista de un planeta: altura de la cámara sobre el plano orbital y giro hacia un
// costado, medidos desde la prolongación de la línea estrella-planeta. La estrella
// queda detrás, arriba y a la derecha, fuera del disco del planeta (≈ 6° de radio a
// PLANET_VIEW_RADII radios), y el planeta muestra un filo iluminado.
export const PLANET_VIEW_ELEVATION_DEG = 13, PLANET_VIEW_AZIMUTH_DEG = 22, PLANET_VIEW_RADII = 10;

// Normal del plano orbital, del lado de la normal eclíptica (la vertical de la cámara).
export function orbitNormal(planet, sky) {
  const normal = normalize(cross(planetOffsetAu(0, planet, sky), planetOffsetAu(Math.PI / 2, planet, sky)));
  return dot3(normal, ECLIPTIC_UP) < 0 ? normal.map(v => -v) : normal;
}

// Dirección desde la estrella hacia la cámara al llegar: inclinada ARRIVAL_TILT_DEG
// respecto de la normal, hacia el lado del Sol para acortar el giro del viaje.
export function systemViewDirection(planet, sky) {
  const normal = orbitNormal(planet, sky);
  const sunward = normalize([-sky.x, -sky.y, -sky.z]);
  let inPlane = sunward.map((v, i) => v - dot3(sunward, normal) * normal[i]);
  if (Math.hypot(...inPlane) < 1e-6) inPlane = planetOffsetAu(0, planet, sky);
  inPlane = normalize(inPlane);
  const tilt = radians(ARRIVAL_TILT_DEG);
  return normal.map((v, i) => v * Math.cos(tilt) + inPlane[i] * Math.sin(tilt));
}

// Dirección desde el planeta hacia la cámara: del lado opuesto a la estrella, algo por
// encima del plano orbital. Con la normal como vertical, la estrella se ve arriba y a
// la derecha del planeta, y las órbitas abiertas detrás.
export function planetViewDirection(offset, normal) {
  const away = normalize(offset), side = cross(normal, away);
  const elevation = radians(PLANET_VIEW_ELEVATION_DEG), azimuth = radians(PLANET_VIEW_AZIMUTH_DEG);
  return away.map((v, i) => Math.cos(elevation) * (Math.cos(azimuth) * v + Math.sin(azimuth) * side[i]) + Math.sin(elevation) * normal[i]);
}

// Color neutro: gris con un leve matiz frío o cálido según la temperatura de equilibrio.
// Es ilustrativo; no hay color, albedo ni atmósfera medidos.
export function equilibriumColor(teq) {
  if (!(teq > 0)) return [0.66, 0.66, 0.66];
  const t = Math.min(1, Math.max(0, (Math.log10(teq) - 2) / (Math.log10(2000) - 2)));
  return [0.60 + 0.20 * t, 0.65 + 0.02 * t, 0.72 - 0.14 * t];
}

// Radio y temperatura de la anfitriona publicados en el archivo, con la forma de `physics`.
export function hostPhysics(st) {
  if (!st || !(st.r > 0) || !(st.teff > 0)) return null;
  return {
    radiusSolar: st.r, radiusUncertaintySolar: st.rE ?? null,
    radiusKm: st.r * SUN_RADIUS_KM, radiusPc: st.r * SUN_RADIUS_KM * KM_TO_PC,
    temperatureK: st.teff, temperatureUncertaintyK: st.teffE ?? null,
    status: 'published', source: 'https://exoplanetarchive.ipac.caltech.edu/',
    sourceLabel: 'NASA Exoplanet Archive · parámetros compuestos',
  };
}

// Lo que no es una medida publicada en la binaria anfitriona de un sistema circumbinario.
// La clave es la letra guardada en `bin.s` (scripts/exoplanets/circumbinary_hosts.js).
export const BINARY_ASSUMPTIONS = {
  a: 'semieje calculado con la 3.ª ley de Kepler y la masa total',
  c: 'órbita circular adoptada (binaria compacta)',
  i: 'inclinación aproximada: solo se publica un intervalo',
  w: 'orientación de la elipse supuesta (ω = 0°)',
  f: 'posición de las estrellas en su órbita ilustrativa',
  q: 'masas iguales supuestas: solo se publica la masa total',
};

const componentPhysics = (radius, temperature, bin) => !(radius > 0) || !(temperature > 0) ? null : {
  radiusSolar: radius, radiusUncertaintySolar: null, radiusKm: radius * SUN_RADIUS_KM, radiusPc: radius * SUN_RADIUS_KM * KM_TO_PC,
  temperatureK: temperature, temperatureUncertaintyK: null, status: 'published', source: bin.url, sourceLabel: bin.ref,
};

// Las dos estrellas de una binaria anfitriona en la fecha `jd`. El punto del catálogo es
// el par sin resolver y se toma como su centro de masas: A y B se colocan a cada lado en
// proporción inversa a sus masas, y los planetas siguen centrados en ese punto. `bin`
// lleva los elementos de la órbita de B respecto de A con la convención de `planetOffsetAu`.
// Cada componente es un registro estelar propio (posición, radio y temperatura) que
// comparte identificador con el del catálogo. Devuelve null si no hay órbita incorporada.
export function buildHostBinary(bin, star, sky, jd = EXOPLANET_EPOCH_JD) {
  if (!bin?.P) return null;
  const relative = planetStateAu(bin, sky, jd), curve = planetOrbitPc(bin, sky);
  const massRatio = bin.m[1] / (bin.m[0] + bin.m[1]);
  // Sin radio y temperatura propios, A hereda los de la anfitriona en el archivo.
  const physics = [componentPhysics(bin.r[0], bin.teff[0], bin) || (bin.r[0] === null && bin.teff[0] === null ? star.physics || null : null),
    componentPhysics(bin.r[1], bin.teff[1], bin)];
  // Reparto de la magnitud del par por luminosidad (R²·T⁴); solo ajusta el marcador.
  const light = physics.map(p => p ? p.radiusSolar ** 2 * p.temperatureK ** 4 : null);
  const components = [-massRatio, 1 - massRatio].map((factor, k) => {
    const offsetPc = relative.map(v => v * factor * AU_TO_PC);
    const position = [star.x + offsetPc[0], star.y + offsetPc[1], star.z + offsetPc[2]];
    const record = { ...star, n: bin.names[k], x: position[0], y: position[1], z: position[2], physics: physics[k],
      m: light[0] && light[1] ? star.m + 2.5 * Math.log10((light[0] + light[1]) / light[k]) : star.m,
      rgb: physics[k] && physics[k] !== star.physics ? temperatureColor(physics[k].temperatureK).map(v => Math.round(v * 255)) : star.rgb };
    return { name: bin.names[k], letter: k ? 'B' : 'A', massSolar: bin.m[k], physics: physics[k], offsetPc, star: record,
      orbit: curve.map(v => v * factor), color: catalogueTint(record.rgb),
      // Destino de navegación solo con radio: sin él no hay esfera a la que acercarse.
      body: physics[k] ? { kind: 'star', name: bin.names[k], star: record, position, radiusKm: physics[k].radiusKm, source: physics[k].source } : null };
  });
  const records = components.map(component => component.star);
  for (const record of [star, ...records]) record.components = records;
  return { ...bin, components, massRatio, separationAu: Math.hypot(...relative), apoapsisPc: bin.a * (1 + bin.e) * AU_TO_PC };
}
const catalogueTint = rgb => Array.isArray(rgb) ? rgb.map(v => v / 255) : [1, 1, 1];

// Une los sistemas de public/data/exoplanets.json con sus estrellas y calcula posiciones
// para la fecha de la escena. Varias anfitrionas pueden compartir un punto del catálogo.
export function buildPlanetarySystems(data, starsById, jd = EXOPLANET_EPOCH_JD) {
  if (!data) return [];
  return data.systems.flatMap(system => {
    const star = starsById.get(system.i);
    if (!star) return [];
    const position = [star.x, star.y, star.z];
    const sky = { ...skyDirection(position), x: star.x, y: star.y, z: star.z };
    const planets = system.p.map(planet => {
      const offsetAu = planetStateAu(planet, sky, jd);
      return { ...planet, offsetPc: offsetAu.map(v => v * AU_TO_PC), separationAu: Math.hypot(...offsetAu),
        apoapsisPc: planet.a * (1 + planet.e) * AU_TO_PC,
        radiusPc: planet.r === null ? null : planet.r * EARTH_RADIUS_KM * KM_TO_PC,
        color: equilibriumColor(planet.teq), assumptions: [...planet.s].map(key => ASSUMPTIONS[key]) };
    });
    const framed = planets.filter(p => p.apoapsisPc < PLANET_FRAME_LIMIT_AU * AU_TO_PC);
    // La llegada mira el plano del planeta más externo que cabe en el encuadre.
    const reference = framed.length ? framed.reduce((a, b) => b.apoapsisPc > a.apoapsisPc ? b : a) : planets[0];
    const result = { id: `${system.i}:${system.h}`, star, name: system.h, position, sky, planets, st: system.st,
      circumbinary: Boolean(system.cb), stars: system.ns,
      // Binaria anfitriona: con órbita, las dos estrellas en torno al centro de masas.
      binary: system.bin ? buildHostBinary(system.bin, star, sky, jd) || system.bin : null,
      viewDirection: systemViewDirection(reference, sky), viewUp: orbitNormal(reference, sky),
      rangePc: Math.max(...planets.map(p => p.apoapsisPc)),
      framePc: framed.length ? Math.max(...framed.map(p => p.apoapsisPc)) : 0 };
    // Destino de navegación de cada planeta con radio: el planeta en primer plano y su
    // estrella detrás. La vertical de la vista es la normal del plano orbital.
    for (const planet of planets) {
      if (planet.radiusPc === null) continue;
      const normal = orbitNormal(planet, sky);
      planet.body = { kind: 'exoplanet', name: planet.n, position: planet.offsetPc.map((v, i) => v + position[i]),
        radiusKm: planet.r * EARTH_RADIUS_KM, star, system: result, planet, companionViewDistance: planet.radiusPc * PLANET_VIEW_RADII,
        viewDirection: planetViewDirection(planet.offsetPc, normal), viewUp: normal,
        source: 'https://exoplanetarchive.ipac.caltech.edu/' };
    }
    return [result];
  });
}

// Textos de la ficha. `letter` abrevia «TRAPPIST-1 b» a «b» dentro de su sistema.
const letter = (planet, system) => planet.n.startsWith(`${system.name} `) ? planet.n.slice(system.name.length + 1) : planet.n;
const figure = value => value.toLocaleString('es-CL', { maximumSignificantDigits: 3 });
export function describePlanet(planet, system) {
  const period = planet.P === null ? '' : planet.P < 365.25 ? `, ${figure(planet.P)} días` : `, ${figure(planet.P / 365.25)} años`;
  const radius = planet.r === null ? 'radio desconocido' : `${planet.s.includes('r') ? '≈ ' : ''}${figure(planet.r)} R⊕`;
  return `${letter(planet, system)}: ${figure(planet.a)} UA${period}, ${radius}`;
}
// Agrupa lo supuesto: «b, c: radio estimado con una relación masa-radio».
export function describeAssumptions(system) {
  const groups = new Map();
  for (const planet of system.planets) for (const key of planet.s) groups.set(key, [...(groups.get(key) || []), letter(planet, system)]);
  return [...groups].map(([key, letters]) => `${letters.length === system.planets.length && letters.length > 1 ? 'todos' : letters.join(', ')}: ${ASSUMPTIONS[key]}`);
}

// Ficha de la binaria anfitriona de un sistema circumbinario: lo publicado, lo supuesto
// y lo que falta. Sin datos del par devuelve solo el aviso.
const masses = m => m[0] === null ? 'masas sin publicar' : m[1] === null ? `${figure(m[0])} M☉ la primaria; masa de la secundaria sin publicar` : `${figure(m[0])} y ${figure(m[1])} M☉`;
const binaryPeriod = days => days < 1 ? `${figure(days * 24)} horas` : days < 365.25 ? `${figure(days)} días` : `${figure(days / 365.25)} años`;
export function describeBinary(system) {
  const binary = system.binary;
  if (!binary) return ['Planetas circumbinarios · sin datos de las dos estrellas: se muestran como un solo punto, con las órbitas centradas en él'];
  const pair = `${binary.names[0]} y ${binary.names[1]}`;
  if (!binary.components) return [`Binaria anfitriona · ${pair} · ${masses(binary.m)} · ${binary.note}: las dos estrellas se muestran como un solo punto y las órbitas de los planetas se centran en él`];
  const missing = binary.components.filter(component => !component.physics).map(component =>
    `${component.letter}: ${binary.r[component.letter === 'A' ? 0 : 1] === null ? 'radio' : 'temperatura'} sin publicar, se dibuja como marcador`);
  return [`Binaria anfitriona · ${pair} · ${masses(binary.m)} · se orbitan cada ${binaryPeriod(binary.P)} a ${figure(binary.a)} UA (excentricidad ${figure(binary.e)}) · separadas ${figure(binary.separationAu)} UA en la fecha · estrellas y planetas giran en torno al centro de masas del par, situado en el punto del catálogo`,
    ...[...binary.s].map(key => BINARY_ASSUMPTIONS[key]), ...missing];
}
