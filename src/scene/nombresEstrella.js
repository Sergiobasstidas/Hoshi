import { GENITIVOS } from './starSearch.js';
import { basesCompaneras, titulosEstrellas } from './titulos.js';

// Orden de los nombres de una estrella: el primero es el título de su ficha y de la lista del buscador.
//   0 nombre propio (IAU)               4 estrella variable con letras del GCVS (R Leo, RR Lyr)
//   1 Bayer (alf Cen, Alp Cyg)          5 catálogos (HIP, HD, HR, GJ/Gl, TYC, Gaia DR3, 2MASS…), en el orden de siempre
//   2 Flamsteed (61 Cyg)                6 variable «V» con número (V1803 Cyg) y candidatas KOI/TOI/EPIC/KIC
//   3 nombre del sistema planetario en NASA (Kepler-90, HR 8799, TRAPPIST-1)
//   7 al final, los números de AT-HYG y HSB, que no son nombres
// Los nombres de un mismo rango conservan su orden.
const GRIEGAS = 'alf|alp|bet|gam|del|eps|zet|eta|the|iot|kap|lam|mu|nu|ksi|xi|omi|pi|rho|sig|tau|ups|phi|chi|psi|ome';
const BAYER = new RegExp(`^(?:\\* )?(?:${GRIEGAS})\\.?(?:[- ]?0?\\d{1,2})?(?: \\d{1,3})? [A-Z][a-z]{2}(?: [A-Z])?$`, 'i');
const FLAMSTEED = /^(?:\* )?\d{1,3} [A-Z][a-z]{2}(?: [A-Z])?$/;
const VARIABLE_LETRAS = /^(?:V\* )?[A-Z]{1,2} [A-Z][a-z]{2}$/;
const VARIABLE_NUMERO = /^(?:V\* )?V\d+ [A-Z][a-z]{2}$/;
export const CANDIDATA = /^(?:KOI|TOI|CTOI|EPIC|KIC)[- ]?\d/;
const NUMERO_HOSHI = /^(?:AT-HYG|HSB) \d+$/;

// Rango de un nombre. `propios`: nombres propios de la estrella; `sistemas`: nombres de sistemas planetarios de NASA.
export function rangoNombre(nombre, { propios = new Set(), sistemas = new Set() } = {}) {
  if (propios.has(nombre)) return 0;
  if (sistemas.has(nombre)) return 3;
  if (NUMERO_HOSHI.test(nombre)) return 7;
  if (VARIABLE_NUMERO.test(nombre) || CANDIDATA.test(nombre)) return 6;
  // La letra griega lleva minúsculas («alf», «Alp», «Mu»); en mayúsculas («MU Mus») es una variable del GCVS.
  if (BAYER.test(nombre) && /[a-z]/.test(nombre.replace(/^\* /, '').split(' ')[0])) return 1;
  if (FLAMSTEED.test(nombre)) return 2;
  if (VARIABLE_LETRAS.test(nombre)) return 4;
  return 5;
}

// Nombres ordenados por rango (estable). Devuelve [nombres, principales]: cuántos son de rango 0 a 3, que van antes de
// las estrellas variables con letras (se suman en el navegador desde star-search-variables.json).
export function ordenarNombres(nombres, contexto) {
  const conRango = nombres.map((n, k) => [rangoNombre(n, contexto), k, n]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return [conRango.map(f => f[2]), conRango.filter(f => f[0] <= 3).length];
}

// Suma los nombres de estrella variable a los de una fila del buscador: los de letras (R Leo) después de los
// principales y los «V» con número (V1803 Cyg) junto a las candidatas, antes de los números de AT-HYG y HSB.
export function sumarVariablesEnOrden(nombres, variables, principales = 0) {
  const letras = variables.filter(v => !VARIABLE_NUMERO.test(v)), numero = variables.filter(v => VARIABLE_NUMERO.test(v));
  const resto = nombres.slice(principales);
  const hoshi = resto.findIndex(n => NUMERO_HOSHI.test(n));
  const antesHoshi = hoshi < 0 ? resto : resto.slice(0, hoshi), alFinal = hoshi < 0 ? [] : resto.slice(hoshi);
  return [...new Set([...nombres.slice(0, principales), ...letras, ...antesHoshi, ...numero, ...alFinal])];
}

// Cómo se muestra un nombre como título: las designaciones de Bayer y Flamsteed con la letra griega y el genitivo
// latino completos, como se conocen («61 Cyg» → «61 Cygni», «tau Cet» → «Tau Ceti», «Rho-2 Ari» → «Rho² Arietis»,
// «61 Cyg B» → «61 Cygni B»). Los nombres propios, las variables (V1803 Cyg, YY Psc, MU Mus) y los catálogos quedan
// igual. Solo es presentación: la búsqueda y los datos usan la forma corta.
const LETRAS_GRIEGAS = { alf: 'Alpha', alp: 'Alpha', bet: 'Beta', gam: 'Gamma', del: 'Delta', eps: 'Epsilon', zet: 'Zeta', eta: 'Eta', the: 'Theta',
  iot: 'Iota', kap: 'Kappa', lam: 'Lambda', mu: 'Mu', nu: 'Nu', ksi: 'Xi', xi: 'Xi', omi: 'Omicron', pi: 'Pi', rho: 'Rho', sig: 'Sigma', tau: 'Tau',
  ups: 'Upsilon', phi: 'Phi', chi: 'Chi', psi: 'Psi', ome: 'Omega' };
const SUPERINDICE = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const DESIGNACION = /^(?:\* )?(?:([A-Za-z]{2,3})\.?(?:[- ]?0?(\d{1,2}))? )?(?:(\d{1,3}) )?([A-Z][A-Za-z]{2})(?: ([A-Z]))?$/;
export function nombreParaMostrar(nombre, genitivos) {
  const m = typeof nombre === 'string' && DESIGNACION.exec(nombre);
  if (!m) return nombre;
  const [, letra, indice, numero, sigla, componente] = m;
  const genitivo = genitivos.get(sigla.toLowerCase());
  // La letra griega lleva minúsculas: «MU Mus» es una variable del GCVS.
  const griega = letra && /[a-z]/.test(letra) ? LETRAS_GRIEGAS[letra.toLowerCase()] : null;
  if (!genitivo || (letra && !griega) || (!griega && !numero)) return nombre;
  const partes = [griega && griega + (indice ? [...String(Number(indice))].map(d => SUPERINDICE[d]).join('') : ''), numero, genitivo, componente];
  return partes.filter(Boolean).join(' ');
}

// --- Nombre de una estrella para etiquetas, fichas, el dial y el buscador ---
// Una sola regla para todo lo que nombra una estrella de la escena (estrellas.bin solo trae `n` para unas 600):
//   1. su nombre de etiqueta (`n`);
//   2. su título en el buscador (`titulos`: id → el nombre más conocido, «Kepler-90» y no «KOI-351»; titulos.js);
//   3. el nombre de su sistema planetario (Kepler-90);
//   4. si es una compañera, el nombre de su primaria (sin la A, AB o Aa final) y su letra: «LTT 1445 C»; sin nombre de
//      la primaria, «WDS 15231+7620 B»;
//   5. «HSB <número>».
// Se muestra con nombreParaMostrar («61 Cyg B» → «61 Cygni B»).

// «LTT 1445 A» → «LTT 1445»; «COCONUTS-2 A» → «COCONUTS-2»; «51 Psc AB» → «51 Psc».
const sinLetraPrimaria = nombre => nombre.replace(/(?<=[\d\s])(?:A|AB|Aa)$/, '').trim();
// Compañera de un sistema: la letra de su componente (las que no tienen registro propio la traen en `componente`).
function letraDeCompanera(star) {
  if (star.componente) return star.componente;
  const sistema = star.sistemaDe;
  return sistema?.components?.find(c => c.companion === star)?.name || null;
}
function nombrePropio(star, titulos) {
  return star.n || titulos?.get(star.i) || star.planetary?.[0]?.name || null;
}
// `titulos` (id → título) y `bases` (id → nombre para sus compañeras): por omisión, los de titulos.js.
export function nombreEstrellaCrudo(star, titulos = titulosEstrellas(), bases = undefined) {
  if (!star) return null;
  const propio = star.componente ? null : nombrePropio(star, titulos);
  if (propio) return propio;
  const letra = letraDeCompanera(star), sistema = star.sistemaDe;
  if (letra && sistema) {
    const mapaBases = bases !== undefined ? bases : titulos === titulosEstrellas() ? basesCompaneras() : null;
    const primaria = mapaBases?.get(sistema.star.i) || nombrePropio(sistema.star, titulos);
    return primaria ? `${sinLetraPrimaria(primaria)} ${letra}` : sistema.wds ? `WDS ${sistema.wds} ${letra}` : `HSB ${sistema.star.i} ${letra}`;
  }
  return Number.isFinite(star.i) ? `HSB ${star.i}` : null;
}
export const nombreEstrella = (star, titulos, bases) => {
  const crudo = nombreEstrellaCrudo(star, titulos, bases);
  return crudo && nombreParaMostrar(crudo, GENITIVOS);
};
