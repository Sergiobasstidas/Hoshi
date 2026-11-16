import { eccentricAnomaly } from './binaryOrbit.js';

// Pares con órbita que tienen animación de sus órbitas en la ficha, por nombre del par en ORB6.
// Las masas son las dinámicas publicadas con la órbita (Akeson et al. 2021, tabla 6).
export const ORBITAS_ANIMADAS = {
  'RHD 1': { masas: [1.0788, 0.9092], fuente: 'Akeson et al. 2021 (ORB6)' },
};

const DIAS_ANO = 365.25;
const mjdAAno = mjd => 2000 + (mjd - 51544.5) / DIAS_ANO;
export const AU_ANO_A_KMS = 4.740470463;

// El par con órbita animada del sistema de la estrella, con los nombres de las dos estrellas.
// Se guarda por sistema para que la página no reinicie su animación en cada render.
const guardadas = new WeakMap();
export function parConOrbita(star) {
  const sistema = star?.system || star?.sistemaDe;
  if (!sistema) return null;
  if (!guardadas.has(sistema)) guardadas.set(sistema, crearPar(sistema));
  return guardadas.get(sistema);
}
function crearPar(sistema) {
  const componente = sistema.components.find(c => c.pair.k === 'o' && ORBITAS_ANIMADAS[c.pair.pair]);
  if (!componente) return null;
  const { pair } = componente, extra = ORBITAS_ANIMADAS[pair.pair];
  const primaria = sistema.star;
  return {
    clave: `${primaria.i}:${pair.pair}`,
    primaria: { star: primaria, nombre: primaria.n },
    companera: { star: componente.companion, nombre: componente.companion?.n || `${primaria.n} ${componente.name}` },
    periodo: pair.p / DIAS_ANO, periastro: mjdAAno(pair.t), e: pair.e, a: pair.a,
    masas: extra.masas, fuente: extra.fuente,
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
