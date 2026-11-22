// Búsqueda de las estrellas de la capa de fondo (public/data/capa/, lo escribe scripts/build_capa_busqueda.js). Nada se
// baja al abrir la página: el manifiesto y los nombres propios al empezar a buscar, y después solo el trozo donde cae lo
// escrito (nombres de catálogo por su clave, TYC por TYC1, HSB por rango, Gaia DR3 en el trozo de datos de su rango)
// y, al elegir una estrella, el trozo con sus datos. Cada estrella se nombra por su fila: su lugar en el orden de Gaia
// DR3 de los archivos de datos.
import { normalizeStarQuery } from './scene/starSearch.js';
import { claveCatalogo } from './scene/capaNombres.js';

const json = url => fetch(url).then(r => { if (!r.ok) throw Error(url); return r.json(); });
const cache = new Map();
function pedir(archivo, preparar = x => x) {
  if (!cache.has(archivo)) cache.set(archivo, json(`/data/capa/${archivo}`).then(preparar).catch(e => { cache.delete(archivo); throw e; }));
  return cache.get(archivo);
}
const manifiesto = () => pedir('manifiesto.json');
const propios = () => pedir('propios.json', d => ({ ...d, claves: d.n.map(normalizeStarQuery) }));

// Último trozo cuyo primer valor es ≤ el buscado (los trozos están en orden).
function trozoDe(primeros, valor, menor = (a, b) => a < b) {
  let a = 0, b = primeros.length - 1;
  if (b < 0 || menor(valor, primeros[0])) return -1;
  while (a < b) { const m = (a + b + 1) >> 1; if (menor(valor, primeros[m])) b = m - 1; else a = m; }
  return a;
}
const menorGaia = (a, b) => b !== '' && BigInt(a) < BigInt(b);
// Como en la lista del catálogo: en negrita el nombre principal (el de la ficha) y debajo el que coincidió.
const resultado = (fila, nombre, score, principal) => ({ id: `capa-${fila}`, aliases: [principal || nombre], matched: nombre, score, capa: { fila },
  detalle: `${nombre} · Estrella de fondo` });

// Trozo de datos: el source_id viene entero en la primera fila y como diferencia en las demás.
function prepararDatos(d) {
  let previo = 0n;
  const s = d.s.map((v, k) => {
    if (v === null) { previo = 0n; return null; }
    previo = typeof v === 'string' || !k || previo === 0n ? BigInt(v) : previo + BigInt(v);
    return String(previo);
  });
  return { ...d, s };
}
const trozoDatos = j => pedir(`datos-${j}.json`, prepararDatos);

// Se empieza a usar al escribir: el manifiesto y los nombres propios (unos pocos KB).
export const prepararCapa = () => Promise.all([manifiesto(), propios()]);

const TYC = /^\s*(?:tyc\s*)?(\d{1,4})\s*-\s*(\d{1,5})(?:\s*-\s*(\d))?\s*$/i;

// Estrellas de la capa para lo escrito, de a lo más `limite`: 0 = nombre exacto, 1 = empieza igual, 2 = lo contiene.
export async function buscarEnCapa(texto, limite = 8) {
  const clave = normalizeStarQuery(texto);
  if (clave.length < 2) return [];
  const m = await manifiesto();
  const salida = [];
  // TYC: «TYC 4771-1103-1» o «4771-1103-1»; se sugiere desde que está el segundo número.
  const tyc = TYC.exec(texto);
  if (tyc && (/tyc/i.test(texto) || tyc[3])) {
    const j = trozoDe(m.tyc, Number(tyc[1]), (a, b) => a < b);
    if (j >= 0) {
      const t = await pedir(`tyc-${j}.json`);
      const exacto = tyc[3] ? `${Number(tyc[1])}-${Number(tyc[2])}-${tyc[3]}` : null, prefijo = `${Number(tyc[1])}-${tyc[2]}`;
      t.t.forEach((valor, k) => {
        if (valor === exacto) salida.push(resultado(t.i[k], `TYC ${valor}`, 0, t.p[k]));
        else if (!exacto && valor.startsWith(prefijo)) salida.push(resultado(t.i[k], `TYC ${valor}`, 1, t.p[k]));
      });
    }
    return salida.sort((a, b) => a.score - b.score).slice(0, limite);
  }
  // Gaia DR3 y HSB: el número completo.
  const gaia = /^(?:gaia)?(?:dr3)?(\d{6,20})$/.exec(clave);
  if (gaia) {
    const j = trozoDe(m.gaia, gaia[1], menorGaia);
    if (j >= 0) {
      const t = await trozoDatos(j);
      const k = t.s.indexOf(gaia[1]);
      if (k >= 0) salida.push(resultado(j * m.porDatos + k, `Gaia DR3 ${gaia[1]}`, 0, t.n[k].split('|')[0]));
    }
  }
  const hsb = /^hsb(\d+)$/.exec(clave);
  if (hsb) {
    const j = trozoDe(m.hsb, Number(hsb[1]));
    if (j >= 0) {
      // HSB como diferencia con el anterior del trozo.
      const t = await pedir(`hsb-${j}.json`, d => { let h = 0; return { ...d, h: d.h.map(v => (h += v)) }; });
      const k = t.h.indexOf(Number(hsb[1]));
      // −1: fuente oculta (ya se dibuja desde el catálogo; build_capa_busqueda.js).
      if (k >= 0 && t.i[k] >= 0) salida.push(resultado(t.i[k], `HSB ${hsb[1]}`, 0, nombrePrincipal(await datosCapa(t.i[k]))));
    }
  }
  if (gaia || hsb) return salida;
  // Nombres propios y de estrella variable.
  const p = await propios();
  p.claves.forEach((c, k) => {
    const rango = c === clave ? 0 : c.startsWith(clave) ? 1 : clave.length >= 4 && c.includes(clave) ? 2 : -1;
    if (rango >= 0) salida.push(resultado(p.i[k], p.n[k], rango, p.p[k]));
  });
  // Catálogos (HD, BD, CD, CPD, SAO, HR, HIP, GJ, WDS): el trozo donde caería la clave, y lo que empieza igual.
  if (/^(hd|hr|hip|gl|sao|bd|cd|cpd|wds)/.test(clave)) {
    const j = trozoDe(m.nombres, clave);
    for (const trozo of [j, j + 1]) {
      if (trozo < 0 || trozo >= m.nombres.length || (trozo === j + 1 && !m.nombres[trozo].startsWith(clave))) continue;
      const t = await pedir(`nombres-${trozo}.json`, d => ({ ...d, claves: d.n.map(claveCatalogo) }));
      // Primera clave ≥ la buscada.
      let a = 0, b = t.claves.length;
      while (a < b) { const mid = (a + b) >> 1; if (t.claves[mid] < clave) a = mid + 1; else b = mid; }
      for (let k = a; k < t.claves.length && t.claves[k].startsWith(clave) && salida.length < 4 * limite; k++) salida.push(resultado(t.i[k], t.n[k], t.claves[k] === clave ? 0 : 1, t.p[k]));
    }
  }
  return salida.sort((a, b) => a.score - b.score || a.matched.length - b.matched.length || a.matched.localeCompare(b.matched)).slice(0, limite);
}

// Datos de la estrella de la fila `fila`: índice en la capa, HSB, Gaia DR3, G, paralaje y su error (mas), BP−RP y sus
// nombres (en el orden de la ficha).
export async function datosCapa(fila) {
  const m = await manifiesto();
  const j = Math.floor(fila / m.porDatos), k = fila - j * m.porDatos;
  const t = await trozoDatos(j);
  return { fila, indice: t.k[k], hsb: t.h[k], gaia: t.s[k], g: t.g[k], paralaje: t.p[k], paralajeError: t.e[k], bpRp: t.c[k], nombres: t.n[k] ? t.n[k].split('|') : [] };
}

// Nombre principal: el primero de la lista (ya viene en el orden de la ficha), o Gaia DR3, o HSB.
export const nombrePrincipal = datos => datos.nombres[0] || (datos.gaia ? `Gaia DR3 ${datos.gaia}` : `HSB ${datos.hsb}`);

// Posición (pc, respecto del Sol) de la estrella `indice` de la capa, desde sus celdas cuantizadas.
export function posicionEnCapa(capa, indice) {
  const celdas = capa.celdas;
  let a = 0, b = celdas.length - 1;
  while (a < b) { const m = (a + b + 1) >> 1; if (celdas[m][4] <= indice) a = m; else b = m - 1; }
  const [x0, y0, z0, lado] = celdas[a], paso = lado / 65535;
  return [x0 + capa.q[3 * indice] * paso, y0 + capa.q[3 * indice + 1] * paso, z0 + capa.q[3 * indice + 2] * paso];
}
