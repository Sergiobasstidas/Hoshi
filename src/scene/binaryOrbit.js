import { AU_TO_PC } from './scale.js';

// Thomas et al. 2021, Table 4, orbital-distance solution. See docs/WR140.md.
export const WR140_ORBIT = {
  periodDays: 2895, periastronMjd: 60636.23, eccentricity: 0.8993,
  semiMajorAu: 13.55, inclinationDeg: 119.07, nodeDeg: 353.87,
  omegaWrDeg: 227.44, massWr: 10.31, massO: 29.27,
  raHours: 20.34110434, decDeg: 43.85452155,
};
export const BINARY_EPOCH = '2026-09-18';
const radians = degrees => degrees * Math.PI / 180;
export const dateMjd = date => Date.parse(`${date}T00:00:00Z`) / 86400000 + 40587;

export function eccentricAnomaly(mean, e) {
  const m = ((mean + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  let E = m < 0 ? -Math.PI : Math.PI;
  for (let i = 0; i < 30; i++) {
    const step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-13) break;
  }
  return E;
}

// Relative O - WR orbit. Position angle is measured north through east;
// positive line-of-sight points away from the Sun. omega_WR needs +180°.
export function relativeOrbitAu(E, elements = WR140_ORBIT) {
  const o = elements;
  const x = o.semiMajorAu * (Math.cos(E) - o.eccentricity);
  const y = o.semiMajorAu * Math.sqrt(1 - o.eccentricity ** 2) * Math.sin(E);
  const w = radians(o.omegaWrDeg + 180), node = radians(o.nodeDeg), inc = radians(o.inclinationDeg);
  const u = x * Math.cos(w) - y * Math.sin(w), v = x * Math.sin(w) + y * Math.cos(w);
  const north = u * Math.cos(node) - v * Math.sin(node) * Math.cos(inc);
  const east = u * Math.sin(node) + v * Math.cos(node) * Math.cos(inc);
  const away = v * Math.sin(inc);
  const ra = radians(o.raHours * 15), dec = radians(o.decDeg);
  return [
    -east * Math.sin(ra) - north * Math.sin(dec) * Math.cos(ra) + away * Math.cos(dec) * Math.cos(ra),
    east * Math.cos(ra) - north * Math.sin(dec) * Math.sin(ra) + away * Math.cos(dec) * Math.sin(ra),
    north * Math.cos(dec) + away * Math.sin(dec),
  ];
}

export function binaryState(mjd = dateMjd(BINARY_EPOCH), elements = WR140_ORBIT) {
  const E = eccentricAnomaly(2 * Math.PI * (mjd - elements.periastronMjd) / elements.periodDays, elements.eccentricity);
  const relative = relativeOrbitAu(E, elements);
  const total = elements.massWr + elements.massO;
  return {
    separationAu: Math.hypot(...relative),
    wr: relative.map(x => -x * elements.massO / total * AU_TO_PC),
    o: relative.map(x => x * elements.massWr / total * AU_TO_PC),
  };
}

export function binaryOrbitPoints(component, samples = 512) {
  const factor = component === 'wr' ? -WR140_ORBIT.massO : WR140_ORBIT.massWr;
  return Array.from({ length: samples + 1 }, (_, i) => relativeOrbitAu(i / samples * Math.PI * 2)
    .map(x => x * factor / (WR140_ORBIT.massWr + WR140_ORBIT.massO) * AU_TO_PC));
}

export const BINARY_STATE = binaryState();
const axisA = relativeOrbitAu(0);
const axisB = relativeOrbitAu(Math.PI / 2);
const normal = [axisA[1] * axisB[2] - axisA[2] * axisB[1], axisA[2] * axisB[0] - axisA[0] * axisB[2], axisA[0] * axisB[1] - axisA[1] * axisB[0]];
export const BINARY_VIEW_DIRECTION = normal.map(x => x / Math.hypot(...normal));
