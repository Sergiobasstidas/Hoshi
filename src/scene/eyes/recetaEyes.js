// Aspecto ilustrativo de cada exoplaneta, el mismo que le da Eyes on Exoplanets de NASA/JPL-Caltech
// (https://eyes.nasa.gov/apps/exo/; texturas en public/textures/eyes-exoplanetas/).
// Cada planeta tiene un tipo de aspecto (tiposEyes.json: gigante caliente, tipo Neptuno, lava, desierto, hielo…). Su mapa
// de color se pinta con un mapa base (o dos, mezclados), cuyos canales rojo, verde y azul se reemplazan por tres colores,
// y encima de una a tres capas de detalle con su color; los rocosos llevan además un mapa normal. Qué mapas, en qué
// proporción y con qué colores lo decide una sucesión de números al azar fija para cada planeta: la semilla es el hash
// de su nombre en Eyes. Las mismas elecciones, en el mismo orden, dan los mismos colores que allí
// (scripts/eyes.test.js compara con resultados de Eyes guardados en scripts/fixtures/eyes_esperado.json).
// 16 planetas tienen un mapa propio pintado a mano (PROPIAS).
import TIPOS from './tiposEyes.json' with { type: 'json' };

export { TIPOS };
export const TEXTURAS_EYES = '/textures/eyes-exoplanetas/';

// Planetas con mapa propio, con su mapa especular si lo tiene. `sincronica`: eje de la esfera que mira siempre a la
// estrella. Los que en Eyes son modelos 3D (KOI-55 b, PSR B1257+12 b, AU Mic b, TrES-2 b, WASP-12 b y 55 Cnc e) se
// pintan con la receta de su tipo.
export const PROPIAS = {
  GJ_504_b: { color: 'GJ_504_b.jpg' },
  'HAT-P-11_b': { color: 'HAT-P-11_b.jpg' },
  HD_189733_b: { color: 'HD_189733_b.jpg' },
  'Kepler-7_b': { color: 'Kepler-7_b.jpg', sincronica: [0, 1, 0] },
  'Kepler-22_b': { color: 'Kepler-22_b.jpg', especular: 'Kepler-22_b_specular.jpg' },
  'Kepler-452_b': { color: 'Kepler-452_b.jpg' },
  'OGLE-2005-BLG-390L_b': { color: 'OGLE-2005-BLG-390L_b.jpg', especular: 'OGLE-2005-BLG-390L_b_specular.jpg' },
  Proxima_Cen_b: { color: 'Proxima_Cen_b.jpg' },
  'TRAPPIST-1_b': { color: 'TRAPPIST-1_b.jpg', especular: 'TRAPPIST-1_b_specular.jpg' },
  'TRAPPIST-1_c': { color: 'TRAPPIST-1_c.jpg', especular: 'TRAPPIST-1_c_specular.jpg' },
  'TRAPPIST-1_d': { color: 'TRAPPIST-1_d.jpg', especular: 'TRAPPIST-1_d_specular.jpg' },
  'TRAPPIST-1_e': { color: 'TRAPPIST-1_e.jpg' },
  'TRAPPIST-1_f': { color: 'TRAPPIST-1_f.jpg', sincronica: [1, 0, 0] },
  'TRAPPIST-1_g': { color: 'TRAPPIST-1_g.jpg', especular: 'TRAPPIST-1_g_specular.jpg' },
  'TRAPPIST-1_h': { color: 'TRAPPIST-1_h.jpg' },
  YZ_Cet_d: { color: 'YZ_Cet_d.jpg' },
};

// Nombre del planeta en Eyes: el de la NASA con guiones bajos en vez de espacios (así calzan los 6147 cruzados).
export const idEyes = nombre => nombre.replace(/ /g, '_');

// --- Azar reproducible ---
// Semilla: hash de 32 bits del texto (cada carácter suma al hash anterior multiplicado por 31).
export function semillaDeTexto(texto) {
  let hash = 0;
  for (let k = 0; k < texto.length; k++) hash = Math.imul(hash, 31) + texto.charCodeAt(k) | 0;
  return hash;
}
// Generador de Lehmer con multiplicador 16807 y módulo 2³¹ − 1 (el «estándar mínimo» de Park y Miller, 1988);
// devuelve números en [0, 1).
const MODULO = 2147483647;
export function crearAzar(semilla) {
  let estado = semilla % MODULO;
  if (estado <= 0) estado += MODULO;
  return () => { estado = estado * 16807 % MODULO; return (estado - 1) / (MODULO - 1); };
}

// --- Colores ---
const entre01 = v => Math.min(1, Math.max(0, v));
// RGBA (0–1) a tono, saturación, brillo y opacidad.
function aTsb([r, g, b, a]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), rango = max - min;
  if (rango === 0) return [0, 0, max, a];
  const [nr, ng, nb] = [r, g, b].map(v => (v - min) / rango);
  let tono = max === r ? (ng - nb) / 6 : max === g ? (2 + nb - nr) / 6 : (4 + nr - ng) / 6;
  if (tono < 0) tono += 1;
  return [tono, rango / max, max, a];
}
// Cómo se reparten croma (c) y componente intermedia (x) entre R, G y B en cada sexto del círculo de tono. El segundo
// sexto repite el reparto del primero, como en Eyes; un tono de 1 queda gris.
const REPARTO = [['c', 'x', 0], ['c', 'x', 0], [0, 'c', 'x'], [0, 'x', 'c'], ['x', 0, 'c'], ['c', 0, 'x']];
function deTsb([tono, saturacion, brillo, a]) {
  if (saturacion === 0) return [brillo, brillo, brillo, a];
  const c = brillo * saturacion, sexto = 6 * tono, x = c * (1 - Math.abs(sexto % 2 - 1));
  const reparto = REPARTO[Math.floor(sexto)] || [0, 0, 0];
  return [...reparto.map(k => brillo - c + (k === 'c' ? c : k === 'x' ? x : 0)), a].map(entre01);
}
// Color de la receta (en 0–255 o 0–1) movido al azar en tono, saturación, brillo y opacidad, cada uno hasta ± su
// variación (cuatro números al azar, en ese orden).
function colorVariado(color, variacion, azar) {
  const tsb = aTsb(color.map(v => v > 1 ? v / 255 : v));
  return deTsb(tsb.map((v, k) => entre01(v + variacion[k] * (2 * azar() - 1))));
}
// Orden al azar: cada elemento cambia de lugar con uno de los anteriores (o consigo mismo).
function mezclar(lista, azar) {
  const r = [...lista];
  r.forEach((_, k) => { const j = Math.floor(azar() * (k + 1)); [r[k], r[j]] = [r[j], r[k]]; });
  return r;
}

// Receta del mapa de un planeta: archivos y valores con que pintarMapa compone su mapa de color.
export function recetaEyes(id, tipo) {
  const azar = crearAzar(semillaDeTexto(id));
  // HD 209458 b no tiene receta de su tipo en Eyes y se pinta con la de «Unknown».
  const tipoReceta = TIPOS[tipo] && id !== 'HD_209458_b' ? tipo : 'Unknown';
  const { baseMaps, baseColors, normMaps = [], normalScale = null, detailCount: [minDetalles, maxDetalles], detailMaps, detailColors } = TIPOS[tipoReceta];
  const sorteoNormal = azar();
  const normal = normMaps.length ? `norm${normMaps[Math.min(normMaps.length - 1, Math.round(sorteoNormal * normMaps.length))]}.png` : null;
  const bases = baseMaps.slice(0, 2).map(n => `base${n}.jpg`);
  const pesoBase1 = bases.length > 1 ? 1 - azar() : 0;
  const canales = baseColors.map(([color, variacion]) => colorVariado(color, variacion, azar));
  const cuantos = minDetalles + Math.floor(azar() * (maxDetalles - minDetalles + 1));
  const mapas = cuantos ? mezclar(detailMaps, azar).slice(0, cuantos) : [];
  const detalles = detailColors.slice(0, cuantos).map(([color, variacion], k) => ({ archivo: `detail${mapas[k]}.png`, color: colorVariado(color, variacion, azar) }));
  return { normal, escalaNormal: normalScale, bases, pesoBase1, canales, detalles };
}

// Mapa de color (RGBA de 8 bits): el primer mapa base más el segundo por su peso; el rojo, el verde y el azul de esa
// mezcla pesan cada uno su color de canal; cada capa de detalle tapa con su color según su opacidad. `imagenes`: los
// píxeles de cada archivo de la receta, del mismo tamaño.
export function pintarMapa(receta, imagenes, ancho, alto) {
  // Con números sueltos y no arreglos por píxel (crearlos bloqueaba el hilo principal 90–230 ms por planeta); las cuentas
  // son las mismas y en el mismo orden, así que el resultado es idéntico.
  const salida = new Uint8ClampedArray(ancho * alto * 4);
  const [base0, base1] = receta.bases.map(f => imagenes[f]), [c0, c1, c2] = receta.canales;
  const peso = base1 ? receta.pesoBase1 : 0;
  const capas = receta.detalles.map(d => ({ pixeles: imagenes[d.archivo], r: d.color[0], g: d.color[1], b: d.color[2] }));
  for (let p = 0; p < salida.length; p += 4) {
    const m0 = (base0[p] + (base1 ? peso * base1[p] : 0)) / 255;
    const m1 = (base0[p + 1] + (base1 ? peso * base1[p + 1] : 0)) / 255;
    const m2 = (base0[p + 2] + (base1 ? peso * base1[p + 2] : 0)) / 255;
    let r = m0 * c0[0] + m1 * c1[0] + m2 * c2[0];
    let g = m0 * c0[1] + m1 * c1[1] + m2 * c2[1];
    let b = m0 * c0[2] + m1 * c1[2] + m2 * c2[2];
    for (let k = 0; k < capas.length; k++) {
      const capa = capas[k], opacidad = capa.pixeles[p + 3] / 255;
      r = r + (capa.r - r) * opacidad;
      g = g + (capa.g - g) * opacidad;
      b = b + (capa.b - b) * opacidad;
    }
    salida[p] = r * 255; salida[p + 1] = g * 255; salida[p + 2] = b * 255; salida[p + 3] = 255;
  }
  return salida;
}

// Tipo de aspecto para un planeta que no está en la base de Eyes, con la regla que mejor reproduce sus tipos en los
// 6147 planetas cruzados (scripts/exoplanets/build_eyes.js). Masa en masas terrestres, radio en radios terrestres,
// semieje en UA y temperatura de equilibrio en K.
export function tipoPorRegla({ m = null, r = null, a = null, teq = null }) {
  let clase;
  if (m !== null && m > 0) clase = m < 2 ? 'rocoso' : m >= 38 ? 'gigante' : r !== null ? (r >= 2.1 ? 'neptuno' : 'rocoso') : m >= 5 ? 'neptuno' : 'rocoso';
  else if (r !== null) clase = r >= 6.9 ? 'gigante' : r >= 2.1 ? 'neptuno' : 'rocoso';
  else return 'NA';
  if (clase === 'neptuno') return 'Neptune-like';
  if (clase === 'gigante') return (teq !== null ? teq >= 277 : a !== null && a < 1.94) ? 'Hot Jupiter' : 'Gas Giant';
  if (a === null) return 'lavaAtmos';
  return a < 0.0302 ? 'lavaNoAtmos' : a < 0.3 ? 'lavaAtmos' : a < 1.3 ? 'desertAtmos' : a < 2 ? 'desertNoAtmos' : 'iceAtmos';
}

// --- Tipo de planeta de la ficha ---
// La ficha usa la misma clasificación que el aspecto, para que nunca se contradigan: gigante o tipo Neptuno según el
// tipo de aspecto, y entre los rocosos, «Planeta rocoso» si Eyes lo clasifica como terrestre (plType «Terrestrial»)
// y «Supertierra» si no. Cuando la masa publicada es solo un límite superior (pl_bmasselim = 1, como en Kepler-42 c),
// esa masa no dice de qué está hecho el planeta: el tipo sale de su radio y el aspecto, de ese tipo.
export const ROCOSOS = new Set(['lavaAtmos', 'lavaNoAtmos', 'desertAtmos', 'desertNoAtmos', 'iceAtmos']);
export const GASEOSOS = new Set(['Neptune-like', 'Gas Giant', 'Hot Jupiter']);
export const tipoPorRadio = r => r < 1.25 ? 'Planeta rocoso' : r < 2 ? 'Supertierra' : r < 6 ? 'Tipo Neptuno' : 'Gigante gaseoso';

// Aspecto de un planeta rocoso según su distancia a la estrella, y de uno gaseoso según su tipo (como tipoPorRegla).
function aspectoDeTipo(tipo, { a = null, teq = null }) {
  if (tipo === 'Tipo Neptuno') return 'Neptune-like';
  if (tipo === 'Gigante gaseoso') return (teq !== null ? teq >= 277 : a !== null && a < 1.94) ? 'Hot Jupiter' : 'Gas Giant';
  return tipoPorRegla({ m: 0.5, a });
}

// Tipo de la ficha y aspecto del planeta. `aspecto`: tipo de aspecto de Eyes (o de tipoPorRegla); `clase`: plType de Eyes;
// `masaLimite`: la masa es un límite superior; `r`, `a`, `teq`: radio (R⊕), semieje (UA) y temperatura (K).
export function clasificarPlaneta({ aspecto, clase = null, masaLimite = false, r = null, a = null, teq = null }) {
  if (masaLimite && r !== null) {
    const tipo = tipoPorRadio(r);
    return { tipo, aspecto: aspectoDeTipo(tipo, { a, teq }) };
  }
  if (aspecto === 'Hot Jupiter' || aspecto === 'Gas Giant') return { tipo: 'Gigante gaseoso', aspecto };
  if (aspecto === 'Neptune-like') return { tipo: 'Tipo Neptuno', aspecto };
  if (ROCOSOS.has(aspecto)) return { tipo: clase ? (clase === 'Terrestrial' ? 'Planeta rocoso' : 'Supertierra') : r !== null && r < 1.25 ? 'Planeta rocoso' : 'Supertierra', aspecto };
  return { tipo: r !== null ? tipoPorRadio(r) : null, aspecto };
}
