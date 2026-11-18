import { eccentricAnomaly } from './binaryOrbit.js';
import { MASAS_DINAMICAS } from './masasDinamicas.js';
import { estrellaDeComponente } from './visualBinary.js';

const DIAS_ANO = 365.25;
const mjdAAno = mjd => 2000 + (mjd - 51544.5) / DIAS_ANO;
export const AU_ANO_A_KMS = 4.740470463;

// ¿Tiene el par su órbita completa (ORB6: P, a, e, i, Ω, ω y T)? Las de grado 5 («indeterminadas») no cuentan.
const ELEMENTOS = ['p', 'a', 'e', 'i', 'node', 'w', 't'];
export const orbitaCompleta = pair => pair?.k === 'o' && ELEMENTOS.every(k => Number.isFinite(pair[k])) && pair.p > 0 && pair.a > 0 && pair.grade !== 5;
// Masas medidas de cada estrella: la lista curada (masasDinamicas.js) o las medidas que trae star_systems.json (publicadas
// o de SB9). Sin ellas, null: se anima la órbita relativa.
export function masasMedidas(pair) {
  if (MASAS_DINAMICAS[pair.pair]) return MASAS_DINAMICAS[pair.pair];
  return (pair.mc === 'pub' || pair.mc === 'sb9') && pair.m1 > 0 && pair.m2 > 0 ? [pair.m1, pair.m2] : null;
}

// El par con órbita de la estrella, por el nombre del par en ORB6 (`clave`; sin ella, el primero con órbita completa),
// con los nombres de las dos estrellas (`nombres`, los de la ficha). Se guarda por sistema y par para que la página no
// reinicie su animación en cada render.
const guardadas = new WeakMap();
export function parConOrbita(star, clave = null, nombres = null) {
  const sistema = star?.system || star?.sistemaDe;
  if (!sistema) return null;
  if (!guardadas.has(sistema)) guardadas.set(sistema, new Map());
  const pares = guardadas.get(sistema);
  if (!pares.has(clave)) pares.set(clave, crearPar(sistema, clave, nombres));
  return pares.get(clave);
}
function crearPar(sistema, clave, nombres) {
  const componente = sistema.components.find(c => orbitaCompleta(c.pair) && (clave === null || c.pair.pair === clave));
  if (!componente) return null;
  const { pair } = componente, primaria = sistema.star;
  const padre = pair.of === 'A' ? null : sistema.components.find(c => c.name === pair.of);
  const estrellaPrincipal = padre ? estrellaDeComponente(sistema, padre) : primaria;
  const nombrePrincipal = nombres?.[0] || estrellaPrincipal?.n || (padre ? `${primaria.n} ${pair.of}` : primaria.n) || 'Estrella principal';
  return {
    clave: `${primaria.i}:${pair.pair}`,
    primaria: { star: estrellaPrincipal, nombre: nombrePrincipal },
    companera: { star: componente.companion || estrellaDeComponente(sistema, componente), nombre: nombres?.[1] || componente.companion?.n || `${primaria.n} ${componente.name}` },
    periodo: pair.p / DIAS_ANO, periastro: mjdAAno(pair.t), e: pair.e, a: pair.a,
    masas: masasMedidas(pair), fuente: 'Sixth Catalog of Orbits of Visual Binary Stars (ORB6)',
  };
}

// Anomalía excéntrica en el año t (ecuación de Kepler).
export const anomaliaEn = (orbita, t) => eccentricAnomaly(2 * Math.PI * (t - orbita.periastro) / orbita.periodo, orbita.e);

// Posición de la compañera respecto de la primaria en el plano de la órbita (UA), con el periastro sobre +x.
export function relativa(orbita, E) {
  return [orbita.a * (Math.cos(E) - orbita.e), orbita.a * Math.sqrt(1 - orbita.e ** 2) * Math.sin(E)];
}

// Velocidad relativa (km/s) según la anomalía excéntrica.
export function velocidadRelativa(orbita, E) {
  const c = orbita.e * Math.cos(E);
  return 2 * Math.PI / orbita.periodo * orbita.a * Math.sqrt((1 + c) / (1 - c)) * AU_ANO_A_KMS;
}

// Las tres curvas son la órbita relativa a otra escala. q = m2 / (m1 + m2).
// k = 0: marco del centro de masa; k = 1: marco de la primaria.
export const escalas = (k, q) => ({ primaria: -(1 - k) * q, companera: 1 - q + k * q, centro: k * q });

// Próximo paso por el periastro (desfase 0) o el apoastro (desfase P/2) desde el año dado.
export function proximoPaso(orbita, desde, desfase = 0) {
  const base = orbita.periastro + desfase;
  return base + orbita.periodo * Math.ceil((desde - base) / orbita.periodo);
}

export function anoActual(fecha = new Date()) {
  const y = fecha.getUTCFullYear(), ini = Date.UTC(y, 0, 1), fin = Date.UTC(y + 1, 0, 1);
  return y + (fecha.getTime() - ini) / (fin - ini);
}

// Cruces de las dos elipses en el marco del centro de masa.
export function cruces(orbita, q, n = 240) {
  const a = [], b = [];
  for (let i = 0; i <= n; i++) {
    const r = relativa(orbita, i / n * 2 * Math.PI);
    a.push([-q * r[0], -q * r[1]]); b.push([(1 - q) * r[0], (1 - q) * r[1]]);
  }
  const salida = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const [p1, p2, p3, p4] = [a[i], a[i + 1], b[j], b[j + 1]];
    const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
    const v = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
    if (u >= 0 && u < 1 && v >= 0 && v < 1) salida.push([p1[0] + u * (p2[0] - p1[0]), p1[1] + u * (p2[1] - p1[1])]);
  }
  return salida;
}
