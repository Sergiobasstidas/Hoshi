// scripts/catalog/auditoria/magnitudes.js
// Magnitud absoluta V típica por tipo espectral y clase de luminosidad, solo para ALERTAS (no es una medición:
// nunca cambia un dato, regla D-014). Valores redondeados a 0,1 mag:
//  - enanas (V): Pecaut & Mamajek 2013, ApJS 208, 9, tabla «A Modern Mean Dwarf Stellar Color and Effective
//    Temperature Sequence» (versión en línea de E. Mamajek);
//  - subgigantes (IV), gigantes (III), gigantes brillantes (II) y supergigantes (I): Allen's Astrophysical Quantities,
//    4.ª ed. (Cox 2000), tabla 15.7, interpolada;
//  - subenanas (sd): 1,5 mag por debajo de la enana del mismo tipo; enanas blancas (D): M_V entre 9 y 16.
// Se alerta si M_V queda a más de VENTANA mag de la típica; sin clase de luminosidad, solo si queda fuera de todas.

const LETRAS = 'OBAFGKM';
const codigo = (letra, n) => LETRAS.indexOf(letra) * 10 + n;
const TABLA = {
  V: [['O5', -5.5], ['B0', -4.0], ['B5', -1.2], ['A0', 1.1], ['A5', 1.9], ['F0', 2.6], ['F5', 3.4], ['G0', 4.4], ['G5', 5.1], ['K0', 5.9], ['K5', 7.4], ['M0', 8.9], ['M3', 10.9], ['M5', 13.6], ['M7', 16.4], ['M9', 19.0]],
  IV: [['B0', -4.5], ['A0', 0.4], ['F0', 1.8], ['G0', 3.0], ['K0', 3.1], ['K5', 3.4]],
  III: [['O5', -6.0], ['B0', -5.0], ['B5', -2.2], ['A0', 0.0], ['F0', 1.5], ['G0', 1.0], ['G5', 0.9], ['K0', 0.7], ['K5', -0.2], ['M0', -0.4], ['M5', -0.5], ['M9', -0.5]],
  II: [['O5', -6.5], ['B0', -5.4], ['A0', -3.0], ['F0', -2.5], ['G0', -2.4], ['K0', -2.3], ['M0', -2.4], ['M9', -2.4]],
  I: [['O5', -7.0], ['B0', -6.5], ['A0', -6.8], ['F0', -6.6], ['G0', -6.4], ['K0', -6.0], ['M0', -5.6], ['M9', -5.6]],
};
export const VENTANA = 2;
const VENTANA_CLASE = { I: 3, II: 2.5 };

function interpolar(tabla, c) {
  const t = tabla.map(([s, m]) => [codigo(s[0], Number(s.slice(1))), m]);
  if (c < t[0][0] || c > t[t.length - 1][0]) return null;
  for (let k = 1; k < t.length; k++) if (c <= t[k][0]) return t[k - 1][1] + (t[k][1] - t[k - 1][1]) * (c - t[k - 1][0]) / (t[k][0] - t[k - 1][0]);
  return null;
}

// Tipo espectral → { letra, n, clase } o null (enanas blancas: { blanca: true }).
export function leerTipo(sp) {
  const t = String(sp || '').trim();
  if (/^D[ABOQZCX]/.test(t)) return { blanca: true };
  const sd = /^(sd|esd|usd)/i.test(t);
  const m = t.replace(/^(sd|esd|usd|d|g|c|k)/, '').match(/^([OBAFGKM])(\d(?:\.\d+)?)?\s*(?:\/[OBAFGKM]?\d?(?:\.\d+)?)?\s*((?:Ia\+|Iab|Ia|Ib|III|II|IV|V|I)(?:[-/](?:III|II|IV|V|I[ab]?))?)?/);
  if (!m) return null;
  // Prefijos de Mount Wilson: d = enana, g = gigante, c = supergigante.
  const prefijo = { d: 'V', g: 'III', c: 'I' }[t.match(/^(d|g|c)(?=[OBAFGKM])/)?.[1]];
  // «IV-V» o «III/IV»: valen todas las clases nombradas.
  const clases = sd ? ['sd'] : m[3] ? m[3].split(/[-/]/).map(c => (/^I[ab+]*$/.test(c) ? 'I' : c)) : prefijo ? [prefijo] : [];
  return { letra: m[1], n: m[2] !== undefined ? Number(m[2]) : null, clases };
}

// Rango [mín, máx] de M_V admitido, o null si el tipo no se puede leer.
export function rangoMv(sp) {
  const t = leerTipo(sp);
  if (!t) return null;
  if (t.blanca) return [9, 16];
  // Sin subtipo («M V»): todos los subtipos de la letra.
  const codigos = t.n === null ? [0, 3, 5, 7, 9].map(n => codigo(t.letra, n)) : [codigo(t.letra, t.n)];
  const rango = (clase, c) => {
    const base = clase === 'sd' ? interpolar(TABLA.V, c) : interpolar(TABLA[clase], c);
    if (base === null) return null;
    const mv = clase === 'sd' ? base + 1.5 : base, w = VENTANA_CLASE[clase] ?? VENTANA;
    return [mv - w, mv + w];
  };
  const clases = t.clases.length ? t.clases : ['V', 'IV', 'III', 'II', 'I'];
  const todos = clases.flatMap(cl => codigos.map(c => rango(cl, c))).filter(Boolean);
  return todos.length ? [Math.min(...todos.map(r => r[0])), Math.max(...todos.map(r => r[1]))] : null;
}
