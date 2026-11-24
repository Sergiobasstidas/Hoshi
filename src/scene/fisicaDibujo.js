// Física para dibujar una estrella de cerca: esfera, color, oscurecimiento del borde y distancia de llegada.
// Primero la medida o la del catálogo (star.physics, D-014). Sin ella, un radio típico de su tipo espectral y su clase
// de luminosidad, solo para el dibujo: la ficha no lo muestra (FichaEstrella lee star.physics y star.datos).
import { KM_TO_PC, SUN_RADIUS_KM } from './scale.js';
import { LIMITE_ENANA, claseLuminosidad, tipoContradiceBrillo } from '../tipoEstelar.js';
import { bvATemperatura, bvDesdeBpRp } from './gaiaCapa.js';

const interpolar = (tabla, x) => {
  if (x <= tabla[0][0]) return tabla[0][1];
  for (let k = 1; k < tabla.length; k++) {
    const [x1, y1] = tabla[k];
    if (x <= x1) { const [x0, y0] = tabla[k - 1]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return tabla[tabla.length - 1][1];
};

// Temperatura por subtipo (O0 = 0, B0 = 10 … M9 = 69): enanas de Pecaut & Mamajek (2013, ApJS 208, 9, versión en línea);
// gigantes G, K y M más frías, de Gray (2005, The Observation and Analysis of Stellar Photospheres, tabla B.1).
const TEMPERATURA_ENANA = [[3, 44900], [5, 41400], [10, 31400], [13, 18700], [15, 15700], [20, 9700], [25, 8100], [30, 7220],
  [35, 6510], [40, 5920], [42, 5770], [45, 5660], [50, 5280], [53, 4830], [55, 4450], [57, 4050], [60, 3850], [62, 3560],
  [64, 3210], [65, 3060], [67, 2810], [69, 2400]];
const TEMPERATURA_GIGANTE = [[40, 5600], [45, 5050], [50, 4750], [52, 4500], [55, 3950], [60, 3850], [63, 3550], [66, 3250], [69, 2900]];
// Radio típico (R☉) según la temperatura, por clase. Enanas: Pecaut & Mamajek (2013); gigantes y supergigantes:
// valores representativos de Gray (2005, tabla B.1) y Allen's Astrophysical Quantities (Cox 2000, tabla 15.8).
// No son medidas de ninguna estrella: solo dan un tamaño razonable a la esfera.
const RADIO_ENANA = [[2400, 0.11], [2800, 0.14], [3060, 0.2], [3560, 0.45], [3850, 0.6], [4450, 0.72], [5280, 0.86],
  [5770, 1], [6510, 1.3], [7220, 1.6], [8100, 1.75], [9700, 2.2], [15700, 3.6], [31400, 7.2], [41400, 10]];
const RADIO_GIGANTE = [[2900, 120], [3250, 90], [3550, 60], [3850, 45], [3950, 30], [4500, 18], [4750, 12], [5050, 10],
  [5600, 7], [6500, 4], [8000, 3.5], [10000, 4.5], [20000, 8], [31000, 13]];
const RADIO_SUPERGIGANTE = [[3400, 700], [3700, 500], [4200, 250], [5000, 150], [6000, 100], [7500, 80], [10000, 65],
  [15000, 45], [25000, 25], [35000, 20]];
const RADIO_ENANA_BLANCA = 0.013;
const TEMPERATURA_LBV = 15000;

const LETRAS = 'OBAFGKM';
// Subtipo numérico del tipo espectral («K3II-III» → 53), o null.
function subtipo(sp) {
  const m = sp?.trim().replace(/^(?:[eu]?sd|d)(?:\/(?:[eu]?sd|d))*(?=[OBAFGKM])/, '').match(/^([OBAFGKM])(\d+(?:\.\d+)?)?/);
  return m ? 10 * LETRAS.indexOf(m[1]) + (m[2] === undefined ? 5 : Math.min(9.5, Number(m[2]))) : null;
}
const letraDe = temperatura => temperatura > 30000 ? 'O' : temperatura > 10000 ? 'B' : temperatura > 7500 ? 'A'
  : temperatura > 6000 ? 'F' : temperatura > 5200 ? 'G' : temperatura > 3700 ? 'K' : 'M';

// Clase para el dibujo: 'enana', 'subgigante', 'gigante', 'supergigante', 'hipergigante', 'subenana' o 'enanaBlanca'.
// Sin clase en el tipo (o con una que contradice el brillo), como las neutras de la ficha: gigante si es más brillante
// que una enana de su letra (LIMITE_ENANA), si no enana.
export function claseDibujo(sp, absoluta, temperatura, distanciaPc) {
  if (/^(WD|D[ABCOQZX])/.test(sp?.trim() || '')) return 'enanaBlanca';
  // Variables luminosas azules (Eta Carinae): hipergigantes, aunque el tipo no traiga clase de luminosidad.
  if (/^LBV/.test(sp?.trim() || '')) return 'hipergigante';
  const clase = sp ? claseLuminosidad(sp) : null;
  const creible = clase && !(['Hipergigante', 'Supergigante', 'Gigante', 'Subgigante'].includes(clase) && tipoContradiceBrillo(sp, absoluta, distanciaPc));
  // Tipos sin letra de la secuencia (carbono y S: C, N, R, S; LBV; Wolf-Rayet): la letra de su temperatura.
  const inicial = sp && sp.trim().replace(/^(?:[eu]?sd|d)(?:\/(?:[eu]?sd|d))*/, '')[0];
  // Si su temperatura es la de una O (Wolf-Rayet, LBV calientes), el límite de las B: las O no tienen uno.
  const deSecuencia = inicial && LETRAS.includes(inicial);
  const letra = deSecuencia ? inicial : letraDe(temperatura) === 'O' && sp ? 'B' : letraDe(temperatura);
  const brillante = Number.isFinite(absoluta) && absoluta < (LIMITE_ENANA[letra] ?? -Infinity);
  if (creible) {
    const nombre = { Hipergigante: 'hipergigante', Supergigante: 'supergigante', Gigante: 'gigante', Subgigante: 'subgigante', VI: 'subenana', V: 'enana' }[clase];
    return nombre === 'enana' && brillante ? 'gigante' : nombre;
  }
  return brillante ? 'gigante' : 'enana';
}

export function radioTipico(clase, temperatura) {
  switch (clase) {
    case 'enanaBlanca': return RADIO_ENANA_BLANCA;
    case 'subenana': return 0.8 * interpolar(RADIO_ENANA, temperatura);
    case 'subgigante': return Math.max(1.8, 1.8 * interpolar(RADIO_ENANA, temperatura));
    case 'gigante': return interpolar(RADIO_GIGANTE, temperatura);
    case 'supergigante': return interpolar(RADIO_SUPERGIGANTE, temperatura);
    case 'hipergigante': return 1.5 * interpolar(RADIO_SUPERGIGANTE, temperatura);
    default: return interpolar(RADIO_ENANA, temperatura);
  }
}

// Temperatura para el dibujo: la de los datos oficiales, la del tipo espectral, la del color (B−V o BP−RP) o la solar.
function temperaturaDibujo(star, evolucionada) {
  if (star.datos?.temperatureK > 0) return star.datos.temperatureK;
  const sp = star.sp || star.datos?.espectro;
  // Una LBV sin otra temperatura: unos 15.000 K, solo para el dibujo (el color de su punto sale de su B−V).
  if (/^LBV/.test(sp?.trim() || '')) return TEMPERATURA_LBV;
  const blanca = sp?.trim().match(/^(?:WD|D[ABCOQZX])\D*(\d+(?:\.\d+)?)?/);
  if (blanca) return blanca[1] ? 50400 / Math.max(0.5, Number(blanca[1])) : 10000;
  const s = subtipo(sp);
  if (s !== null) return evolucionada && s >= 40 ? interpolar(TEMPERATURA_GIGANTE, s) : interpolar(TEMPERATURA_ENANA, s);
  const bv = star.capa ? (star.capa.bpRp === null || star.capa.bpRp === undefined ? null : bvDesdeBpRp(star.capa.bpRp)) : star.c;
  return Number.isFinite(bv) && bv !== 0 ? Math.max(2400, Math.min(40000, bvATemperatura(bv))) : 5772;
}

// Periastro (UA) más chico entre las órbitas medidas de las compañeras de la estrella (visualBinary.js): las que giran
// en torno a ella como primaria y, si es una compañera, la suya. Infinity si no tiene.
const UA_POR_RADIO_SOLAR = 149597870.7 / SUN_RADIUS_KM;
function periastroMinimoAu(star) {
  const pares = [];
  if (star.system) for (const c of star.system.components) if (c.pair?.of === 'A') pares.push(c.pair);
  if (star.sistemaDe) for (const c of star.sistemaDe.components) if (c.companion === star || c.estrella === star) pares.push(c.pair);
  const periastros = pares.filter(p => p?.k === 'o' && p.a > 0).map(p => p.a * (1 - (p.e || 0)));
  return periastros.length ? Math.min(...periastros) : Infinity;
}

// Física con la forma de star.physics y `dibujo: true` cuando el radio es típico. Memorizada por estrella.
const memoria = new WeakMap();
export function fisicaDibujo(star) {
  if (!star) return null;
  if (star.physics) return star.physics;
  // Componente de una binaria anfitriona sin radio propio (buildHostBinary, exoplanetOrbit.js): copia el tipo, el color y
  // los datos del par, que no son suyos. Queda como marcador, sin esfera.
  if (star.components?.includes(star)) return null;
  if (memoria.has(star)) return memoria.get(star);
  const sp = star.sp || star.datos?.espectro;
  const previa = temperaturaDibujo(star, false);
  const clase = claseDibujo(sp, star.m, previa, star.d);
  const evolucionada = ['gigante', 'supergigante', 'hipergigante'].includes(clase);
  const temperatureK = evolucionada ? temperaturaDibujo(star, true) : previa;
  // Radio de los datos oficiales sin temperatura (fisicaOficial pide los dos): es medido o de catálogo, se respeta.
  // El radio típico no puede tragar la órbita medida de una compañera: como mucho 0,4 veces su periastro más chico.
  const tope = 0.4 * periastroMinimoAu(star) * UA_POR_RADIO_SOLAR;
  const radiusSolar = star.datos?.radiusSolar > 0 ? star.datos.radiusSolar : Math.min(radioTipico(clase, temperatureK), tope);
  const fisica = { temperatureK, radiusSolar, radiusKm: radiusSolar * SUN_RADIUS_KM, radiusPc: radiusSolar * SUN_RADIUS_KM * KM_TO_PC,
    luminositySolar: null, clase, dibujo: !(star.datos?.radiusSolar > 0), status: 'dibujo' };
  memoria.set(star, fisica);
  return fisica;
}

// Clase de luminosidad para la superficie (tamaño de las celdas), también con radio medido.
export function claseSuperficie(star) {
  if (!star) return 'enana';
  if (!star.physics) return fisicaDibujo(star).clase;
  return claseDibujo(star.sp || star.datos?.espectro, star.m, star.physics.temperatureK, star.d);
}
