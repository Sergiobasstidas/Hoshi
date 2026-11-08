// scripts/catalog/build_hsb.js
// Registro HSB (Hoshi + Sergio Bastidas): un número fijo por estrella que no cambia aunque
// cambien las versiones de AT-HYG o la tabla de la NASA. Crea o actualiza
// data/catalog/hsb_registro.csv sin renumerar nunca:
//  - cada estrella se reconoce en el registro por sus números fijos, en este orden: HIP, HD,
//    TYC, Gaia DR3, id de AT-HYG v3.2, id de AT-HYG v4.0 y nombre;
//  - las nuevas reciben el siguiente número desde HSB_NUEVO_BASE (en la primera carga, con el
//    registro vacío, el número fue su `i` de stars_15pc.json);
//  - las que ya no están quedan como «retirada»; ninguna fila se borra.
//
// Estrellas que entran:
//  1. Las de data/processed/stars_15pc.json (AT-HYG v3.2 y anfitrionas añadidas).
//  2. De AT-HYG v4.0: las filas nuevas (sin TYC, Gaia, HIP ni HYG de la v3.2) que son
//     compañeras de una estrella del registro (mismo número de Gliese, misma base de TYC o
//     ≤ 60″ con distancia a ±25 %), y las filas de la HYGLike v4.0 con distancia que
//     todavía no están. Se numeran en orden de ascensión recta.
//
// A cada estrella se le busca su fila de AT-HYG v4.0 (columna athyg_v40) puntuando los números
// que coinciden y restando los que se contradicen (HIP 5, HD 4, TYC 3, Gaia 2, Gliese 1); se
// asigna de mayor a menor puntaje, una fila por estrella. Sin ningún número en común, por
// posición (≤ 5″) y brillo (|Δmag| < 0,5).
//
// Gaia DR3: data/catalog/hsb_gaia_revision.csv trae la fuente elegida cuando AT-HYG y el enlace
// propio (star_identity) no coinciden o solo AT-HYG la da. Criterio (comparación con Gaia DR3 de
// ARI Heidelberg, 07/11/2026): posición de Gaia llevada a J2000 frente a la de Tycho-2 (< 3″; < 30″
// si la posición es de Gliese) y V esperada desde G y BP−RP (Riello et al. 2021) frente a la V de
// Hipparcos (entre −0,5 y +1,0, porque Gaia separa componentes de pares que Hipparcos no). Las
// dudosas quedan sin Gaia y con gaia_revisar = 1. Un mismo Gaia nunca queda en dos estrellas.
//
// Columnas de sistemas: comp (letra de la componente según Gliese en AT-HYG) y primaria_hsb
// (estrella principal: la de star_systems.json o aquella de la que la fila nueva es compañera).
// data/catalog/hsb_companeras_dibujadas.csv relaciona cada compañera que star_systems.json dibuja
// sin estrella propia con la estrella HSB nueva que la representa.
//
// Estrellas cercanas y 2MASS (descargas de scripts/catalog/descargar_cercanas.py):
//  - tmass: designación 2MASS del vecino más probable de cada Gaia DR3 (tmass_psc_xsc_best_neighbour).
//  - CNS5 (Golovin et al. 2023): cada objeto con paralaje trigonométrica se enlaza con su estrella del
//    registro (Gaia DR3, HIP, GJ con su componente y, sin números en común, posición llevada a J2000
//    con su movimiento propio, ≤ 3″); los que no están entran al registro (origen cns5).
//  - Capa del millón de Gaia DR3 (data/raw/gaia/gaia_dr3_1m.csv.gz, según la selección que deja
//    scripts/process_gaia.js: las que descarta por ser una estrella de Hoshi se enlazan con ella) y GCNS
//    (Gaia Collaboration, Smart et al. 2021) con gcns_prob ≥ 0,38 (umbral del artículo) y
//    paralaje/error ≥ 10; una fuente de GCNS a ≤ 3″ de una estrella del registro sin Gaia y con
//    distancia a ±25 % es esa estrella. Una fuente que se dibuja en la capa solo se da por una estrella del
//    registro si coincide con ella (mismaEstrella); esas quedan en data/catalog/hsb_capa_enlazadas.csv.
//    Las demás fuentes que no son ya el Gaia DR3 de una estrella del registro reciben número en un lote aparte,
//    data/catalog/hsb_gaia/lote-AAAA-MM-DD.csv.gz (hsb, gaia_dr3, tmass, origen, alta). Un lote nunca
//    se reescribe: una carga posterior crea un lote nuevo solo con lo que falte.
// Los números nuevos siguen al mayor ya usado en el registro y en los lotes.
//
// Correrlo dos veces seguidas da exactamente los mismos archivos.
// Uso: npm run hsb   (requiere data/raw/athyg, data/raw/gcns, data/raw/cns5 y data/raw/tmass; ver sus FUENTES.md)

import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';
import { corregirFila, enlacesPorEstrella } from './enlaces_registro.js';

export const REGISTRO_CSV = './data/catalog/hsb_registro.csv';
export const COMPANERAS_CSV = './data/catalog/hsb_companeras_dibujadas.csv';
const GAIA_REVISION_CSV = './data/catalog/hsb_gaia_revision.csv';
// Fuentes dibujadas en la capa de fondo (millón y GCNS) que son una estrella del registro, por un Gaia DR3
// conocido de esa estrella que no es el de su fila o por posición: gaia_dr3, hsb de la estrella, motivo.
// build_estrellas no las dibuja si esa estrella ya está en el catálogo de la app.
export const CAPA_ENLAZADAS_CSV = './data/catalog/hsb_capa_enlazadas.csv';
export const COLUMNAS_CAPA_ENLAZADAS = ['gaia_dr3', 'hsb', 'por'];
const GAIA_1M_CSV = './data/raw/gaia/gaia_dr3_1m.csv.gz';
const STARS_JSON = './data/processed/stars_15pc.json';
const SYSTEMS_JSON = './data/processed/star_systems.json';
const ADDED_HOSTS_JSON = './data/catalog/added_hosts.json';
const HOSTS_JSON = './data/catalog/exoplanet_host_identity.json';
const ATHYG_V32 = ['./data/raw/athyg/athyg_v32-1.csv.gz', './data/raw/athyg/athyg_v32-2.csv.gz'];
const ATHYG_V40 = ['./data/raw/athyg/v40/athyg_40.csv.gz'];
const HYGLIKE_V40 = './data/raw/athyg/v40/hyglike_from_athyg_v40.csv.gz';
const CNS5_CSV = './data/raw/cns5/cns5_main.csv';
const GCNS_CSV = './data/raw/gcns/gcns_main.csv.gz';
const TMASS_CSV = './data/raw/tmass/gaia_dr3_tmass.csv.gz';
const GAIA_1M_SELECCION = './data/catalog/gaia_1m_seleccion.csv.gz';
export const LOTES_DIR = './data/catalog/hsb_gaia';
export const COLUMNAS_LOTE = ['hsb', 'gaia_dr3', 'tmass', 'origen', 'alta'];
// GCNS: probabilidad de astrometría fiable desde la que el artículo da la fuente por buena, y
// paralaje con error ≤ 10 % (regla D-014: distancia = 1/paralaje).
const GCNS_PROB_MIN = 0.38, PARALAJE_SNR_MIN = 10;
const CNS5_MAX_ARCSEC = 3;

// Los números de AT-HYG llegan a ~2,6 millones y las anfitrionas añadidas usan 9 000 000 + n:
// las estrellas que entren después de la primera carga empiezan aquí.
export const HSB_NUEVO_BASE = 100_000_000;
export const COLUMNAS = ['hsb', 'origen', 'athyg_v32', 'athyg_v40', 'hip', 'hd', 'hr', 'gl', 'tyc', 'gaia_dr3', 'gaia_revisar',
  'tmass', 'tic', 'nombre', 'comp', 'primaria_hsb', 'alta', 'estado', 'igual_a'];
// Columnas mínimas para leer un registro de una versión anterior (las demás quedan vacías).
const COLUMNAS_BASE = ['hsb', 'origen', 'athyg_v32', 'hip', 'hd', 'hr', 'gl', 'tyc', 'gaia_dr3', 'tic', 'nombre', 'alta', 'estado'];
// Identificadores con los que se reconoce una estrella, en orden de prioridad.
export const LLAVES = ['hip', 'hd', 'tyc', 'gaia_dr3', 'athyg_v32', 'athyg_v40', 'nombre'];
const IDENTIDAD = ['origen', 'athyg_v32', 'athyg_v40', 'hip', 'hd', 'hr', 'gl', 'tyc', 'gaia_dr3', 'gaia_revisar', 'tmass', 'tic', 'nombre'];
// Peso de cada número al buscar la fila de AT-HYG v4.0 de una estrella.
const PESOS_V40 = { hip: 5, hd: 4, tyc: 3, gaia: 2, gl: 1 };
const COMPANERA_MAX_ARCSEC = 60, COMPANERA_DIST_REL = 0.25;
const POSICION_MAX_ARCSEC = 5, POSICION_MAX_DMAG = 0.5;
// Fuente de GCNS dibujada en la capa frente a la estrella del registro con la que se enlaza: es la misma si
// está a ≤ 15″ (las posiciones de Gliese en AT-HYG pueden estar a varios segundos de arco), con distancia a
// ±25 % y G − V entre −2,5 y +1,5 (enanas M: G hasta 2,5 mag más brillante que V); a menos de 1″ no se mira
// el brillo (Gaia no separa dos fuentes tan juntas). Si la estrella ya tiene otro Gaia DR3, es otra fuente.
const MISMA_MAX_ARCSEC = 15, MISMA_G_MENOS_V = [-2.5, 1.5];
export function mismaEstrella(g, s) {
  if (s.gaia_dr3 && s.gaia_dr3 !== g.gaia) return false;
  if (!s.pos || !(s.d > 0)) return false;
  const sep = separacion(g.pos, s.pos);
  if (sep > MISMA_MAX_ARCSEC || Math.abs(g.d - s.d) / s.d >= COMPANERA_DIST_REL) return false;
  if (sep < 1 || g.G === null || s.mag === null || s.mag === undefined) return true;
  return g.G - s.mag >= MISMA_G_MENOS_V[0] && g.G - s.mag <= MISMA_G_MENOS_V[1];
}

const texto = v => (v === undefined || v === null ? '' : String(v).trim());

// --- Lectura y escritura del registro ---

const celda = v => (/[",\n\r]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function serializarCsv(columnas, filas) {
  return [columnas.join(','), ...filas.map(f => columnas.map(c => celda(texto(f[c]))).join(','))].join('\n') + '\n';
}

export const serializarRegistro = filas => serializarCsv(COLUMNAS, filas);

export function leerRegistro(contenido) {
  if (!contenido) return [];
  const filas = parseSync(contenido, { columns: true, skip_empty_lines: true });
  const faltan = COLUMNAS_BASE.filter(c => filas.length && !(c in filas[0]));
  if (faltan.length) throw new Error(`Al registro le faltan columnas: ${faltan.join(', ')}`);
  return filas.map(f => ({ ...Object.fromEntries(COLUMNAS.map(c => [c, f[c] ?? ''])), hsb: Number(f.hsb) }));
}

// --- Números de Gliese, TYC y posiciones ---

// «Gl 66B» → { numero: '66', comp: 'B' }; también acepta «66B» (formato de la v4.0).
export function partesGl(gl) {
  const m = texto(gl).match(/^(?:[A-Za-z]+\s*)?(\d+(?:\.\d+)?)\s*([A-Za-z]*)$/);
  return m ? { numero: m[1], comp: m[2] } : null;
}
const glNormal = gl => { const p = partesGl(gl); return p ? p.numero + p.comp : ''; };
// AT-HYG v4.0 quita el prefijo: hasta 999 son del catálogo de Gliese (Gl), desde 1000 de Gliese-Jahreiss (GJ).
export function conPrefijoGl(gl) {
  const p = partesGl(gl);
  if (!p) return texto(gl);
  return `${Number(p.numero) < 1000 ? 'Gl' : 'GJ'} ${p.numero}${p.comp}`;
}
const baseTyc = tyc => texto(tyc).split('-').slice(0, 2).join('-');

function separacion(a, b) {
  const r = Math.PI / 180;
  const x = Math.sin((b.dec - a.dec) * r / 2) ** 2 + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.sin((b.ra - a.ra) * r / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(x))) / r * 3600;
}

// Índice por celdas de 0,1° para buscar vecinos a menos de unos minutos de arco.
function rejilla(puntos) {
  const celdas = new Map();
  const clave = (i, j) => `${i}:${j}`;
  for (const p of puntos) {
    const k = clave(Math.floor(p.dec * 10), Math.floor(p.ra * 10));
    if (!celdas.has(k)) celdas.set(k, []);
    celdas.get(k).push(p);
  }
  return (p, radio) => {
    const out = [], fd = Math.floor(p.dec * 10);
    const anchoRa = Math.abs(p.dec) > 85 ? 1800 : Math.ceil(1 / Math.max(0.05, Math.cos(p.dec * Math.PI / 180)));
    for (let i = fd - 1; i <= fd + 1; i++) {
      for (let dj = -anchoRa; dj <= anchoRa; dj++) {
        for (const q of celdas.get(clave(i, (Math.floor(p.ra * 10) + dj + 3600) % 3600)) || []) {
          const s = separacion(p, q);
          if (s <= radio) out.push([s, q]);
        }
      }
    }
    return out.sort((a, b) => a[0] - b[0]);
  };
}

// --- Gaia DR3 ---

// Un mismo Gaia DR3 en dos estrellas indica un enlace dudoso. Lo conserva la única estrella del
// nivel más alto: 0 = carga base con su Gaia de AT-HYG v3.2, 1 = carga base con Gaia de la
// revisión, 2 = fila añadida de la v4.0. Si en ese nivel hay más de una, se quita a todas.
// Donde se quita queda gaia_revisar = 1.
const nivelGaia = s => (s.nueva ? 2 : s.gaiaDeRevision ? 1 : 0);
export function quitarGaiaRepetidos(identidades) {
  const porGaia = new Map();
  for (const s of identidades) if (s.gaia_dr3) porGaia.set(s.gaia_dr3, [...(porGaia.get(s.gaia_dr3) || []), s]);
  const repetidos = [];
  for (const [gaia, lista] of porGaia) {
    if (lista.length < 2) continue;
    const mejor = Math.min(...lista.map(nivelGaia));
    const arriba = lista.filter(s => nivelGaia(s) === mejor);
    const conserva = arriba.length === 1 ? arriba[0] : null;
    for (const s of lista) if (s !== conserva) { s.gaia_dr3 = ''; s.gaia_revisar = '1'; }
    repetidos.push({ gaia, nuevas: lista.filter(s => s.nueva).length, estrellas: lista.map(s => `${s.i ?? `v4.0 ${s.athyg_v40}`} ${s.nombre || s.hip && `HIP ${s.hip}` || s.gl || ''}`.trim()), conserva: conserva ? conserva.i ?? `v4.0 ${conserva.athyg_v40}` : null });
  }
  return repetidos;
}

// En las filas añadidas de la v4.0, un HIP o TYC que ya tiene una estrella de la carga base se
// queda con ella (la v4.0 a veces pasa el HIP de un par a la otra componente), y un Gaia que la
// revisión dejó en duda tampoco se les asigna (queda gaia_revisar = 1).
export function quitarNumerosTomados(base, nuevas, gaiaDescartados = new Set()) {
  const tomados = { hip: new Set(base.map(s => s.hip).filter(Boolean)), tyc: new Set(base.map(s => s.tyc).filter(Boolean)) };
  const quitados = { hip: 0, tyc: 0, gaia: 0 };
  for (const s of nuevas) {
    for (const c of ['hip', 'tyc']) if (s[c] && tomados[c].has(s[c])) { s[c] = ''; quitados[c]++; }
    if (s.gaia_dr3 && gaiaDescartados.has(s.gaia_dr3)) { s.gaia_dr3 = ''; s.gaia_revisar = '1'; quitados.gaia++; }
  }
  return quitados;
}

// Fuentes Gaia de los casos dudosos de la revisión. En los casos resueltos, la fuente que perdió
// suele ser la de la otra componente del par, que sí puede quedar en su propia fila.
export function gaiaDescartadosEnRevision(revision) {
  const elegidos = new Set(revision.map(r => texto(r.gaia_elegido)).filter(Boolean));
  return new Set(revision.filter(r => r.veredicto === 'dudosa')
    .flatMap(r => [texto(r.gaia_athyg), texto(r.gaia_star_identity)]).filter(g => g && !elegidos.has(g)));
}

export function aplicarRevisionGaia(identidades, revision) {
  const porHsb = new Map(revision.map(r => [Number(r.hsb), r]));
  let cambiadas = 0;
  for (const s of identidades) {
    const r = porHsb.get(s.i);
    if (!r) continue;
    s.gaiaDeRevision = texto(r.gaia_elegido) !== s.gaia_dr3;
    s.gaia_dr3 = texto(r.gaia_elegido);
    s.gaia_revisar = r.veredicto === 'dudosa' ? '1' : '';
    cambiadas++;
  }
  return cambiadas;
}

// --- Identidad de cada estrella de Hoshi (carga base) ---

const deAlias = (alias, patron) => (alias || []).map(a => a.match(patron)?.[1]).find(Boolean) || '';

// stars: stars_15pc.json; athyg: Map id → fila de AT-HYG v3.2; anfitrionas: Map i → registro de
// added_hosts.json; nasa: anfitriones de exoplanet_host_identity.json.
export function identidades({ stars, athyg, anfitrionas, nasa }) {
  const ticPorEstrella = new Map(), nasaPorNombre = new Map();
  for (const h of nasa) {
    if (h.i !== null && h.tic && !ticPorEstrella.has(h.i)) ticPorEstrella.set(h.i, h.tic);
    nasaPorNombre.set(h.h, h);
  }
  const tic = v => texto(v).replace(/^TIC\s*/, '');
  // Las estrellas que ya entraron desde el registro (i ≥ HSB_NUEVO_BASE) no son de la carga base.
  return stars.filter(s => s.i < HSB_NUEVO_BASE).map(s => {
    const radec = { ra: Math.atan2(s.y, s.x) * 180 / Math.PI, dec: s.d > 0 ? Math.asin(s.z / s.d) * 180 / Math.PI : 0 };
    if (s.dataOrigin === 'exoplanet-host') {
      const a = anfitrionas.get(s.i);
      if (!a) throw new Error(`La anfitriona ${s.i} no está en added_hosts.json`);
      const h = nasaPorNombre.get(a.h) || {};
      return { i: s.i, origen: 'anfitriona', athyg_v32: '', hip: texto(h.hip), hd: texto(h.hd),
        hr: deAlias(h.alias, /^HR (\d+)$/), gl: texto(h.gj), tyc: deAlias(h.alias, /^TYC (\d+-\d+-\d+)$/),
        gaia_dr3: texto(a.gaia), gaia_v32: texto(a.gaia), tic: tic(h.tic), nombre: texto(a.h), d: s.d, pos: { ra: (radec.ra + 360) % 360, dec: radec.dec }, mag: null };
    }
    // El Sol es la fila 0 de HYGLike y la 1 de AT-HYG completo; el resto conserva el id.
    const id = s.i === 0 ? 1 : s.i;
    const r = athyg.get(id);
    if (!r) throw new Error(`La estrella ${s.i} no está en AT-HYG v3.2 completo`);
    return { i: s.i, origen: 'athyg', athyg_v32: String(id), hip: texto(r.hip), hd: texto(r.hd), hr: texto(r.hr),
      gl: texto(r.gl), tyc: texto(r.tyc), gaia_dr3: texto(r.gaia), gaia_v32: texto(r.gaia), tic: tic(ticPorEstrella.get(s.i)), nombre: texto(r.proper),
      d: s.d, pos: { ra: Number(r.ra) * 15, dec: Number(r.dec) }, mag: r.mag === '' ? null : Number(r.mag) };
  });
}

// --- Fila de AT-HYG v4.0 de cada estrella ---

// La fila v4.0 se busca con los números de la v3.2 (gaia_v32: el Gaia de AT-HYG, antes de la revisión).
const LLAVES_V40 = [['hip', 'hip'], ['hd', 'hd'], ['tyc', 'tyc'], ['gaia', 'gaia_v32'], ['gl', 'gl']];

// Puntaje de una fila v4.0 para una estrella: suma lo que coincide, resta lo que se contradice.
function puntaje(s, f) {
  let p = 0, coinciden = 0;
  for (const [cv, cs] of LLAVES_V40) {
    const a = cs === 'gl' ? glNormal(s.gl) : s[cs], b = cv === 'gl' ? glNormal(f.gl) : f[cv];
    if (!a || !b) continue;
    if (a === b) { p += PESOS_V40[cv]; coinciden++; } else p -= PESOS_V40[cv];
  }
  return coinciden ? p : -Infinity;
}

// estrellas: identidades base (las anfitrionas solo se enlazan por TYC o Gaia);
// v40: filas de AT-HYG v4.0 conservadas. Devuelve Map estrella → fila.
export function asignarV40(estrellas, v40) {
  const indice = Object.fromEntries(LLAVES_V40.map(([cv]) => [cv, new Map()]));
  for (const f of v40) {
    for (const [cv] of LLAVES_V40) {
      const v = cv === 'gl' ? glNormal(f.gl) : f[cv];
      if (!v) continue;
      if (!indice[cv].has(v)) indice[cv].set(v, []);
      indice[cv].get(v).push(f);
    }
  }
  const pares = [], sinNumeros = [];
  for (const s of estrellas) {
    const llaves = s.origen === 'anfitriona' ? LLAVES_V40.filter(([cv]) => cv === 'tyc' || cv === 'gaia') : LLAVES_V40;
    const candidatas = new Set();
    for (const [cv, cs] of llaves) {
      const v = cs === 'gl' ? glNormal(s.gl) : s[cs];
      for (const f of (v && indice[cv].get(v)) || []) candidatas.add(f);
    }
    if (!candidatas.size) { sinNumeros.push(s); continue; }
    for (const f of candidatas) {
      const p = s.origen === 'anfitriona' ? (f.gaia && f.gaia === s.gaia_v32 ? 2 : 0) + (f.tyc && f.tyc === s.tyc ? 3 : 0) : puntaje(s, f);
      if (p > 0) pares.push({ s, f, p, sep: s.pos ? separacion(s.pos, f.pos) : 0 });
    }
  }
  pares.sort((a, b) => b.p - a.p || a.sep - b.sep || (a.s.i - b.s.i) || (a.f.id - b.f.id));
  const asignacion = new Map(), usadas = new Set();
  for (const { s, f } of pares) {
    if (asignacion.has(s) || usadas.has(f)) continue;
    asignacion.set(s, f); usadas.add(f);
  }
  // Sin ningún número en común: posición y brillo (solo estrellas de AT-HYG con magnitud).
  const vecinas = rejilla(v40.map(f => ({ ...f.pos, f })));
  for (const s of sinNumeros) {
    if (s.origen !== 'athyg' || s.mag === null) continue;
    const f = vecinas(s.pos, POSICION_MAX_ARCSEC).map(([, q]) => q.f)
      .find(q => !usadas.has(q) && q.mag !== null && Math.abs(q.mag - s.mag) < POSICION_MAX_DMAG);
    if (f) { asignacion.set(s, f); usadas.add(f); }
  }
  return asignacion;
}

// --- Estrellas nuevas de la v4.0 ---

// Primaria de una fila nueva entre las estrellas del registro: mismo número de Gliese, misma
// base de TYC o vecina a ≤ 60″ con distancia a ±25 %. Devuelve { s, por } o null.
export function buscadorDePrimaria(estrellas) {
  const porHip = new Map(estrellas.filter(s => s.hip).map(s => [s.hip, s])), porGl = new Map(), porTyc = new Map();
  const prefiere = (lista, mejor) => [...lista].sort((a, b) => mejor(b) - mejor(a) || a.i - b.i)[0];
  for (const s of estrellas) {
    const g = partesGl(s.gl);
    if (g) porGl.set(g.numero, [...(porGl.get(g.numero) || []), s]);
    if (s.tyc) porTyc.set(baseTyc(s.tyc), [...(porTyc.get(baseTyc(s.tyc)) || []), s]);
  }
  const vecinas = rejilla(estrellas.filter(s => s.pos).map(s => ({ ...s.pos, s })));
  return f => {
    if (f.hip && porHip.has(f.hip)) return { s: porHip.get(f.hip), por: 'hip' };
    const g = partesGl(f.gl);
    if (g && porGl.has(g.numero)) return { s: prefiere(porGl.get(g.numero), s => ['', 'A'].includes(partesGl(s.gl).comp)), por: 'gliese' };
    if (f.tyc && porTyc.has(baseTyc(f.tyc))) return { s: prefiere(porTyc.get(baseTyc(f.tyc)), s => s.tyc.endsWith('-1')), por: 'tyc' };
    if (f.dist === null) return null;
    const cerca = vecinas(f.pos, COMPANERA_MAX_ARCSEC).find(([, q]) => q.s.d > 0 && Math.abs(f.dist - q.s.d) / q.s.d < COMPANERA_DIST_REL);
    return cerca ? { s: cerca[1].s, por: 'posicion' } : null;
  };
}

function identidadV40(f) {
  return { i: null, nueva: true, origen: 'athyg_v40', athyg_v32: '', athyg_v40: String(f.id), hip: f.hip, hd: f.hd, hr: f.hr,
    gl: conPrefijoGl(f.gl), tyc: f.tyc, gaia_dr3: f.gaia, tic: '', nombre: f.proper, d: f.dist, pos: f.pos, mag: f.mag };
}

// --- Conciliación con el registro existente ---

const firma = f => LLAVES.map(k => texto(f[k])).join('|');

export function conciliar(registro, estrellas, { fecha, siguienteMinimo = HSB_NUEVO_BASE }) {
  const filas = registro.map(f => ({ ...f }));
  const usados = new Set(filas.map(f => f.hsb));
  const tomadas = new Set();
  const asignacion = new Map(); // índice de estrella → fila del registro

  // 1) Coincidencia completa de todas las llaves.
  const porFirma = new Map();
  for (const f of filas) porFirma.set(firma(f), [...(porFirma.get(firma(f)) || []), f]);
  estrellas.forEach((s, k) => {
    const libres = (porFirma.get(firma(s)) || []).filter(f => !tomadas.has(f));
    const f = libres.find(f => f.hsb === s.i) || libres[0];
    if (f) { tomadas.add(f); asignacion.set(k, f); }
  });

  // 2) Llave por llave, en orden de prioridad: cada llave compartida acota los candidatos.
  const indice = Object.fromEntries(LLAVES.map(c => [c, new Map()]));
  for (const f of filas) for (const c of LLAVES) if (texto(f[c])) indice[c].set(texto(f[c]), [...(indice[c].get(texto(f[c])) || []), f]);
  estrellas.forEach((s, k) => {
    if (asignacion.has(k)) return;
    let candidatos = null;
    for (const c of LLAVES) {
      if (!texto(s[c])) continue;
      const iguales = (indice[c].get(texto(s[c])) || []).filter(f => !tomadas.has(f) && (!candidatos || candidatos.includes(f)));
      if (iguales.length) candidatos = iguales;
      if (candidatos?.length === 1) break;
    }
    if (!candidatos) return;
    const f = candidatos.find(f => f.hsb === s.i) || [...candidatos].sort((a, b) => a.hsb - b.hsb)[0];
    tomadas.add(f); asignacion.set(k, f);
  });

  // 3) Nuevas y actualizadas.
  const vacio = filas.length === 0;
  let siguiente = filas.reduce((m, f) => Math.max(m, f.hsb + 1), Math.max(HSB_NUEVO_BASE, siguienteMinimo));
  const nuevas = [], filaDe = [];
  estrellas.forEach((s, k) => {
    const identidad = Object.fromEntries(IDENTIDAD.map(c => [c, texto(s[c])]));
    let f = asignacion.get(k);
    if (f) Object.assign(f, identidad, { estado: 'activa' });
    else {
      // Un número ya reservado aguas arriba (anfitriona nueva) o la primera carga conservan su `i`.
      let hsb = Number.isInteger(s.i) && (vacio || s.i >= HSB_NUEVO_BASE) && !usados.has(s.i) ? s.i : null;
      if (hsb === null) { while (usados.has(siguiente)) siguiente++; hsb = siguiente++; }
      usados.add(hsb);
      f = { hsb, ...identidad, comp: '', primaria_hsb: '', alta: fecha, estado: 'activa' };
      filas.push(f); nuevas.push(f);
    }
    filaDe[k] = f;
  });

  const activas = new Set(filaDe);
  const retiradas = filas.filter(f => !activas.has(f) && f.estado !== 'retirada');
  for (const f of filas) if (!activas.has(f)) f.estado = 'retirada';
  filas.sort((a, b) => a.hsb - b.hsb);
  return { filas, nuevas, retiradas, filaDe };
}

// --- Compañeras dibujadas de star_systems.json frente a las estrellas nuevas ---

export function relacionarCompaneras(sistemas, hsbDe, companerasDe) {
  const salida = [];
  const claves = Object.keys(sistemas).map(Number).sort((a, b) => a - b);
  for (const clave of claves) {
    const sistema = sistemas[clave];
    // Una compañera enlazada a una estrella nueva del registro (cid ≥ HSB_NUEVO_BASE) sigue contando como
    // dibujada: así esta relación no depende de la corrida anterior.
    const propia = c => c.cid !== undefined && c.cid < HSB_NUEVO_BASE;
    const miembros = [clave, ...sistema.comps.filter(propia).map(c => c.cid)];
    const nuevas = miembros.flatMap(m => companerasDe.get(m) || []);
    const dibujadas = sistema.comps.filter(c => !propia(c));
    if (!nuevas.length || !dibujadas.length) continue;
    const libres = new Set(nuevas), pareja = new Map();
    for (const c of dibujadas) {
      const n = [...libres].find(x => x.fila.comp && x.fila.comp === c.n);
      if (n) { pareja.set(c, [n, 'letra']); libres.delete(n); }
    }
    const sinPareja = dibujadas.filter(c => !pareja.has(c));
    if (sinPareja.length === 1 && libres.size === 1) { const n = [...libres][0]; pareja.set(sinPareja[0], [n, 'única']); libres.delete(n); }
    for (const c of dibujadas.filter(c => !pareja.has(c))) {
      const n = [...libres].filter(x => Number.isFinite(c.v) && x.mag !== null && Math.abs(x.mag - c.v) < 1.5)
        .sort((a, b) => Math.abs(a.mag - c.v) - Math.abs(b.mag - c.v) || a.fila.hsb - b.fila.hsb)[0];
      if (n) { pareja.set(c, [n, 'brillo']); libres.delete(n); }
    }
    for (const c of dibujadas) {
      const [n, criterio] = pareja.get(c) || [null, 'sin pareja'];
      salida.push({ sistema_hsb: hsbDe.get(clave), wds: sistema.wds || '', companera: c.n, de: c.of, par: c.pair || '', tipo: c.k,
        hsb_nuevo: n ? n.fila.hsb : '', athyg_v40: n ? n.fila.athyg_v40 : '', gl_nuevo: n ? n.fila.gl : '', criterio });
    }
    for (const n of [...libres].sort((a, b) => a.fila.hsb - b.fila.hsb)) {
      salida.push({ sistema_hsb: hsbDe.get(clave), wds: sistema.wds || '', companera: '', de: '', par: '', tipo: '',
        hsb_nuevo: n.fila.hsb, athyg_v40: n.fila.athyg_v40, gl_nuevo: n.fila.gl, criterio: 'nueva sin dibujo' });
    }
  }
  return salida;
}
export const COLUMNAS_COMPANERAS = ['sistema_hsb', 'wds', 'companera', 'de', 'par', 'tipo', 'hsb_nuevo', 'athyg_v40', 'gl_nuevo', 'criterio'];

// --- CNS5 ---

// Posición de CNS5 (época propia) llevada a J2000 con su movimiento propio (mas/año; pmra con cos δ).
function posicionJ2000(r) {
  const ra = Number(r.ra), dec = Number(r.dec), anos = 2000 - Number(r.epoch || 2000);
  return { ra: (((ra + (Number(r.pmra) || 0) * anos / 3.6e6 / Math.cos(dec * Math.PI / 180)) % 360) + 360) % 360,
    dec: dec + (Number(r.pmdec) || 0) * anos / 3.6e6 };
}

// filas: cns5.main; estrellas: identidades del registro (con gaiaAsociados: Set de todos sus Gaia
// conocidos). Devuelve { enlazadas: Map fila → estrella, por: conteo, nuevas: identidades }.
export function conciliarCns5(filas, estrellas) {
  const porGaia = new Map(), porHip = new Map(), porGl = new Map();
  const agregar = (mapa, clave, s) => { if (clave) mapa.set(clave, [...(mapa.get(clave) || []), s]); };
  for (const s of estrellas) {
    for (const g of s.gaiaAsociados || [s.gaia_dr3]) agregar(porGaia, g, s);
    agregar(porHip, s.hip, s);
    agregar(porGl, glNormal(s.gl), s);
  }
  const medidas = filas.filter(r => Number(r.parallax) > 0);
  const pares = [];
  for (const r of medidas) {
    const gl = glNormal(`${r.gj_id}${r.component_id}`);
    const candidatas = new Set([...(porGaia.get(r.gaia_edr3_id) || []), ...(porHip.get(r.hip_id) || []), ...(porGl.get(gl) || [])]);
    for (const s of candidatas) {
      let p = 0;
      if (r.gaia_edr3_id) {
        // Su propio Gaia pesa más que uno solo asociado (en un par, CNS5 y SIMBAD pueden repartir distinto el HIP).
        if (s.gaia_dr3 === r.gaia_edr3_id) p += 5;
        else if ((s.gaiaAsociados || new Set([s.gaia_dr3])).has(r.gaia_edr3_id)) p += 3;
        else if (s.gaia_dr3) p -= 3;
      }
      if (r.hip_id && s.hip) p += r.hip_id === s.hip ? 2 : -2;
      if (gl && glNormal(s.gl)) p += gl === glNormal(s.gl) ? 1 : -1;
      if (p > 0) pares.push({ r, s, p });
    }
  }
  pares.sort((a, b) => b.p - a.p || a.r.cns5_id - b.r.cns5_id || ((a.s.i ?? 0) - (b.s.i ?? 0)) || String(a.s.athyg_v40).localeCompare(String(b.s.athyg_v40)));
  const enlazadas = new Map(), tomadas = new Set(), por = { numeros: 0, gliese: 0, posicion: 0 };
  for (const { r, s } of pares) {
    if (enlazadas.has(r) || tomadas.has(s)) continue;
    enlazadas.set(r, s); tomadas.add(s); por.numeros++;
  }
  const vecinas = rejilla(estrellas.filter(s => s.pos).map(s => ({ ...s.pos, s })));
  // Misma designación GJ completa (número y componente) a ≤ 30″ aunque el Gaia no coincida: CNS5 y
  // AT-HYG a veces asignan al revés las fuentes de Gaia de las componentes de un par (p Eridani).
  for (const r of medidas) {
    if (enlazadas.has(r)) continue;
    const gl = glNormal(`${r.gj_id}${r.component_id}`);
    if (!gl) continue;
    const cerca = vecinas(posicionJ2000(r), COMPANERA_MAX_ARCSEC / 2).find(([, q]) => !tomadas.has(q.s) && glNormal(q.s.gl) === gl);
    if (cerca) { enlazadas.set(r, cerca[1].s); tomadas.add(cerca[1].s); por.gliese++; }
  }
  const nuevas = [];
  for (const r of medidas) {
    if (enlazadas.has(r)) continue;
    const pos = posicionJ2000(r);
    const cerca = vecinas(pos, CNS5_MAX_ARCSEC).find(([, q]) => !tomadas.has(q.s));
    if (cerca) { enlazadas.set(r, cerca[1].s); tomadas.add(cerca[1].s); por.posicion++; continue; }
    nuevas.push({ i: null, nueva: true, origen: 'cns5', athyg_v32: '', athyg_v40: '', hip: texto(r.hip_id), hd: '', hr: '',
      gl: conPrefijoGl(`${r.gj_id}${r.component_id}`), tyc: '', gaia_dr3: texto(r.gaia_edr3_id), tic: '', nombre: '', pos,
      d: 1000 / Number(r.parallax), cns5: r.cns5_id });
  }
  nuevas.sort((a, b) => a.pos.ra - b.pos.ra || a.pos.dec - b.pos.dec || Number(a.cns5) - Number(b.cns5));
  return { enlazadas, por, nuevas, medidas: medidas.length };
}

// --- Lotes de estrellas identificadas solo por Gaia DR3 ---

export function leerLotes(dir = LOTES_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => /^lote-.*\.csv\.gz$/.test(n)).sort()
    .flatMap(n => parseSync(zlib.gunzipSync(fs.readFileSync(`${dir}/${n}`)).toString('utf8'), { columns: true, skip_empty_lines: true })
      .map(f => ({ ...f, hsb: Number(f.hsb), lote: n })));
}

const compararIds = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);

// Fuentes Gaia que aún no tienen número: ni en el registro ni en un lote. Devuelve las filas del
// lote nuevo, numeradas desde `siguiente` en orden de origen y, dentro de cada origen, de source_id.
export function nuevoLote(origenes, { enRegistro, lotes, siguiente, fecha, tmassDe }) {
  const conNumero = new Set([...enRegistro, ...lotes.map(f => f.gaia_dr3)]);
  const filas = [];
  for (const [origen, ids] of origenes) {
    for (const g of [...ids].sort(compararIds)) {
      if (conNumero.has(g)) continue;
      conNumero.add(g);
      filas.push({ hsb: siguiente++, gaia_dr3: g, tmass: tmassDe(g), origen, alta: fecha });
    }
  }
  return filas;
}

// Distancia, G y posición J2000 (con el movimiento propio, desde la época 2016,0) de una fila de Gaia DR3.
function fuenteGaia(c) {
  const dec = Number(c('dec')), anos = 2000 - 2016, g = c('phot_g_mean_mag');
  return { d: 1000 / Number(c('parallax')), G: g === '' || g === undefined ? null : Number(g),
    pos: { ra: (Number(c('ra')) + (Number(c('pmra')) || 0) * anos / 3.6e6 / Math.cos(dec * Math.PI / 180) + 360) % 360,
      dec: dec + (Number(c('pmdec')) || 0) * anos / 3.6e6 } };
}

// --- Lectura de AT-HYG (gz; en la v3.2 solo la primera parte trae cabecera) ---

export async function recorrerAthyg(partes, alLeer) {
  let cabecera = null;
  for (const parte of partes) {
    const lector = fs.createReadStream(parte).pipe(zlib.createGunzip()).pipe(parse());
    for await (const fila of lector) {
      if (!cabecera) { cabecera = fila; continue; }
      alLeer(fila, cabecera);
    }
  }
}

const numero = v => (v === '' || v === undefined ? null : Number(v));
const filaV40 = (fila, col) => ({
  id: Number(fila[col.id]), tyc: fila[col.tyc], gaia: fila[col.gaia], hyg: fila[col.hyg], hip: fila[col.hip], hd: fila[col.hd],
  hr: fila[col.hr], gl: fila[col.gl], proper: fila[col.proper], pos: { ra: Number(fila[col.ra]) * 15, dec: Number(fila[col.dec]) },
  dist: numero(fila[col.dist]), mag: numero(fila[col.mag]),
});

const fechaLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const stars = JSON.parse(fs.readFileSync(STARS_JSON, 'utf8'));
  const sistemas = JSON.parse(fs.readFileSync(SYSTEMS_JSON, 'utf8'));
  const anfitrionas = new Map(JSON.parse(fs.readFileSync(ADDED_HOSTS_JSON, 'utf8')).stars.map(s => [s.i, s]));
  const nasa = JSON.parse(fs.readFileSync(HOSTS_JSON, 'utf8')).hosts;
  const revision = parseSync(fs.readFileSync(GAIA_REVISION_CSV, 'utf8'), { columns: true, skip_empty_lines: true });

  // 1) AT-HYG v3.2: filas de Hoshi y números presentes (para saber qué filas de la v4.0 son nuevas).
  const ids32 = new Set(stars.filter(s => s.dataOrigin !== 'exoplanet-host').map(s => (s.i === 0 ? 1 : s.i)));
  const v32 = new Map(), en32 = { tyc: new Set(), gaia: new Set(), hip: new Set(), hyg: new Set() };
  await recorrerAthyg(ATHYG_V32, (fila, cab) => {
    const c = Object.fromEntries(cab.map((n, k) => [n, k]));
    for (const n of Object.keys(en32)) if (fila[c[n]]) en32[n].add(fila[c[n]]);
    const id = Number(fila[0]);
    if (ids32.has(id)) v32.set(id, Object.fromEntries(cab.map((n, k) => [n, fila[k]])));
  });
  const base = identidades({ stars, athyg: v32, anfitrionas, nasa });
  const revisadas = aplicarRevisionGaia(base, revision);
  // Correcciones de enlace de la auditoría (data/catalog/hsb_enlaces.csv): mandan sobre AT-HYG y la revisión.
  const enlaces = enlacesPorEstrella();
  let enlazadasPorAuditoria = 0;
  for (const s of base) if (corregirFila(s, enlaces.get(s.i))) { s.gaiaDeRevision = false; enlazadasPorAuditoria++; }

  // 2) HYGLike v4.0: su `id` es el número de HYG; el de AT-HYG está en comp_primary.
  const corte = new Set();
  for (const r of parseSync(zlib.gunzipSync(fs.readFileSync(HYGLIKE_V40)).toString('utf8'), { columns: true, skip_empty_lines: true })) {
    if (r.dist !== '' && Number(r.dist) >= 0) corte.add(Number(r.comp_primary));
  }

  // 3) AT-HYG v4.0: se conservan las filas que comparten algún número con el registro, las nuevas y las del corte.
  const numerosBase = { hip: new Set(), hd: new Set(), tyc: new Set(), gaia: new Set(), gl: new Set() };
  for (const s of base) {
    for (const [cv, cs] of LLAVES_V40) { const v = cs === 'gl' ? glNormal(s.gl) : s[cs]; if (v) numerosBase[cv].add(v); }
  }
  const celdasSinNumeros = new Set(base.filter(s => !LLAVES_V40.some(([, cs]) => s[cs])).map(s => `${Math.floor(s.pos.dec * 10)}:${Math.floor(s.pos.ra * 10)}`));
  const v40 = [], nuevasV40 = new Set();
  await recorrerAthyg(ATHYG_V40, (fila, cab) => {
    const c = Object.fromEntries(cab.map((n, k) => [n, k]));
    const f = filaV40(fila, c);
    const nueva = !['tyc', 'gaia', 'hip', 'hyg'].some(n => f[n] && en32[n].has(f[n]));
    const comparte = LLAVES_V40.some(([cv]) => { const v = cv === 'gl' ? glNormal(f.gl) : f[cv]; return v && numerosBase[cv].has(v); });
    const cerca = celdasSinNumeros.has(`${Math.floor(f.pos.dec * 10)}:${Math.floor(f.pos.ra * 10)}`);
    if (nueva || comparte || cerca || corte.has(f.id)) { v40.push(f); if (nueva) nuevasV40.add(f); }
  });

  // 4) Fila v4.0 de cada estrella del registro.
  const asignadas = asignarV40(base, v40);
  for (const [s, f] of asignadas) { s.athyg_v40 = String(f.id); s.gaia_v40 = f.gaia; }
  const usadas = new Set(asignadas.values());

  // 5) Filas que entran: compañeras nuevas y filas del corte, en orden de ascensión recta.
  const primariaDe = buscadorDePrimaria(base);
  const entran = [], porQue = { companera: 0, corte: 0 }, primariaPor = {};
  for (const f of v40) {
    if (usadas.has(f)) continue;
    const enCorte = corte.has(f.id);
    if (!enCorte && !nuevasV40.has(f)) continue;
    const primaria = primariaDe(f);
    if (!enCorte && !primaria) continue;
    const s = identidadV40(f);
    s.primaria = primaria?.s ?? null;
    if (primaria) primariaPor[primaria.por] = (primariaPor[primaria.por] || 0) + 1;
    porQue[enCorte ? 'corte' : 'companera']++;
    entran.push(s);
  }
  entran.sort((a, b) => a.pos.ra - b.pos.ra || a.pos.dec - b.pos.dec || Number(a.athyg_v40) - Number(b.athyg_v40));

  // 5b) Todos los Gaia DR3 conocidos de cada estrella (v3.2, v4.0 y las dos opciones de la revisión),
  //     para no dar por nueva una fuente que ya es de una estrella del registro.
  const revisionDe = new Map(revision.map(r => [Number(r.hsb), r]));
  for (const s of [...base, ...entran]) {
    const r = s.i === null ? null : revisionDe.get(s.i);
    s.gaiaAsociados = new Set([s.gaia_dr3, s.gaia_v32, s.gaia_v40, r?.gaia_athyg, r?.gaia_star_identity].filter(Boolean));
  }
  const asociados = new Set([...base, ...entran].flatMap(s => [...s.gaiaAsociados]));

  // 5c) CNS5: se enlaza con lo que ya está; lo que falta entra al registro.
  const cns5 = conciliarCns5(parseSync(fs.readFileSync(CNS5_CSV, 'utf8'), { columns: true, skip_empty_lines: true }), [...base, ...entran]);
  for (const s of cns5.nuevas) {
    if (s.gaia_dr3) asociados.add(s.gaia_dr3);
    s.primaria = primariaDe({ ...s, dist: s.d })?.s ?? null;
  }

  const lista = [...base, ...entran, ...cns5.nuevas];
  const descartados = gaiaDescartadosEnRevision(revision);
  const quitados = quitarNumerosTomados(base, entran, descartados);
  const quitadosCns5 = quitarNumerosTomados([...base, ...entran], cns5.nuevas, descartados);
  // Una fila nueva (AT-HYG v4.0 o CNS5) con el Gaia que una corrección de la auditoría le dio a una estrella de la
  // carga base es esa misma estrella: queda retirada apuntando a ella.
  // Las filas nuevas con su propia corrección (reconocidas por su número de AT-HYG v4.0 o, las de CNS5, por su nombre
  // de Gliese en el registro anterior) la reciben antes de comparar Gaia: así un intercambio de Gaia entre una estrella
  // de la base y su compañera no retira a la compañera.
  const previo = leerRegistro(fs.existsSync(REGISTRO_CSV) ? fs.readFileSync(REGISTRO_CSV, 'utf8') : '');
  const hsbV40 = new Map(previo.filter(f => f.origen === 'athyg_v40' && f.athyg_v40).map(f => [f.athyg_v40, f.hsb]));
  const hsbCns5 = new Map(previo.filter(f => f.origen === 'cns5' && f.gl).map(f => [f.gl, f.hsb]));
  for (const s of [...entran, ...cns5.nuevas]) {
    const h = s.origen === 'cns5' ? hsbCns5.get(s.gl) : hsbV40.get(String(s.athyg_v40));
    if (h !== undefined && enlaces.has(h)) { corregirFila(s, enlaces.get(h)); s.conEnlace = true; }
  }
  const gaiaCorregido = new Map(base.filter(s => enlaces.get(s.i)?.gaia_dr3).map(s => [s.gaia_dr3, s.i]));
  for (const s of [...entran, ...cns5.nuevas]) if (!s.conEnlace && s.gaia_dr3 && gaiaCorregido.has(s.gaia_dr3)) s.igualA = gaiaCorregido.get(s.gaia_dr3);
  const repetidos = quitarGaiaRepetidos(lista);

  // 5d) 2MASS de cada Gaia DR3 (y el que trae GCNS para las fuentes que ARI no devolvió).
  const tmass = new Map();
  await recorrerAthyg([TMASS_CSV], (fila, cab) => { tmass.set(fila[cab.indexOf('source_id')], fila[cab.indexOf('tmass')]); });
  const gcns = [];
  await recorrerAthyg([GCNS_CSV], (fila, cab) => {
    const c = n => fila[cab.indexOf(n)];
    const plx = Number(c('parallax')), err = Number(c('parallax_error'));
    if (c('name_2mass') && !tmass.has(c('source_id'))) tmass.set(c('source_id'), c('name_2mass'));
    gcns.push({ gaia: c('source_id'), valida: Number(c('gcns_prob')) >= GCNS_PROB_MIN && err > 0 && plx / err >= PARALAJE_SNR_MIN, ...fuenteGaia(c) });
  });
  const tmassDe = g => (g && tmass.get(g)) || '';
  for (const s of lista) s.tmass = s.tmassCorregido ?? tmassDe(s.gaia_dr3);

  // 6) Conciliación con el registro anterior.
  const anterior = fs.existsSync(REGISTRO_CSV) ? fs.readFileSync(REGISTRO_CSV, 'utf8') : '';
  const lotes = leerLotes();
  const mayorLote = lotes.reduce((m, f) => Math.max(m, f.hsb), 0);
  const fecha = fechaLocal();
  const { filas, nuevas, retiradas, filaDe } = conciliar(leerRegistro(anterior), lista, { fecha, siguienteMinimo: mayorLote + 1 });
  // La misma estrella que otra: queda retirada apuntando a la que se conserva (nunca se borra ni se renumera).
  for (const f of filas) { const c = enlaces.get(f.hsb); if (c?.igual_a) { f.estado = 'retirada'; f.igual_a = c.igual_a; } }

  // 7) Sistemas: letra de componente y estrella principal.
  const filaPorEstrella = new Map(lista.map((s, k) => [s, filaDe[k]]));
  let mismasQueBase = 0;
  for (const s of lista) if (s.igualA) { const f = filaPorEstrella.get(s); f.estado = 'retirada'; f.igual_a = String(s.igualA); mismasQueBase++; }
  const hsbDe = new Map(base.map(s => [s.i, filaPorEstrella.get(s).hsb]));
  const primariaHsb = new Map();
  for (const [clave, sistema] of Object.entries(sistemas)) {
    const h = hsbDe.get(Number(clave));
    if (h === undefined) continue;
    primariaHsb.set(h, h);
    for (const c of sistema.comps) if (c.cid !== undefined && c.cid < HSB_NUEVO_BASE && hsbDe.has(c.cid) && !primariaHsb.has(hsbDe.get(c.cid))) primariaHsb.set(hsbDe.get(c.cid), h);
  }
  const companerasDe = new Map();
  for (const s of [...entran, ...cns5.nuevas]) {
    if (!s.primaria) continue;
    const hp = filaPorEstrella.get(s.primaria).hsb;
    const raiz = primariaHsb.get(hp) ?? hp;
    if (!primariaHsb.has(hp)) primariaHsb.set(hp, hp);
    primariaHsb.set(filaPorEstrella.get(s).hsb, raiz);
    companerasDe.set(s.primaria.i, [...(companerasDe.get(s.primaria.i) || []), { fila: filaPorEstrella.get(s), mag: s.mag }]);
  }
  for (const s of lista) {
    const f = filaPorEstrella.get(s);
    f.comp = partesGl(s.gl)?.comp || '';
    f.primaria_hsb = primariaHsb.has(f.hsb) ? String(primariaHsb.get(f.hsb)) : '';
  }

  const salida = serializarRegistro(filas);
  if (salida !== anterior) fs.writeFileSync(REGISTRO_CSV, salida);
  const companeras = relacionarCompaneras(sistemas, hsbDe, companerasDe);
  const salidaCompaneras = serializarCsv(COLUMNAS_COMPANERAS, companeras);
  const anteriorCompaneras = fs.existsSync(COMPANERAS_CSV) ? fs.readFileSync(COMPANERAS_CSV, 'utf8') : '';
  if (salidaCompaneras !== anteriorCompaneras) fs.writeFileSync(COMPANERAS_CSV, salidaCompaneras);

  // 8) Lote de las fuentes identificadas solo por Gaia DR3: capa del millón y GCNS.
  const enRegistro = new Set(filas.filter(f => f.estado === 'activa' && f.gaia_dr3).map(f => f.gaia_dr3));
  if (!fs.existsSync(GAIA_1M_SELECCION)) throw new Error(`Falta ${GAIA_1M_SELECCION}: corre antes node scripts/process_gaia.js`);
  const millon = [], millonEnlazadas = new Set(), dibujadasGcns = new Set(), dibujadas1m = new Set();
  await recorrerAthyg([GAIA_1M_SELECCION], (fila, cab) => {
    const [g, estado, capa] = [fila[cab.indexOf('source_id')], fila[cab.indexOf('estado')], fila[cab.indexOf('capa')]];
    // La capa también lleva GCNS; aquí solo cuentan las del millón (GCNS tiene su propio paso).
    if (capa !== undefined && capa !== '1m') { if (estado.startsWith('duplicada')) millonEnlazadas.add(g); else if (estado === 'dibujada') dibujadasGcns.add(g); return; }
    if (estado.startsWith('duplicada')) millonEnlazadas.add(g); else millon.push(g);
    if (estado === 'dibujada') dibujadas1m.add(g);
  });
  for (const g of millonEnlazadas) asociados.add(g);
  // Estrella del registro de cada Gaia DR3 conocido (para las fuentes de GCNS que no reciben número).
  const estrellaDeGaia = new Map();
  for (const s of lista) for (const g of [...(s.gaiaAsociados || []), s.gaia_dr3]) if (g && !estrellaDeGaia.has(g)) estrellaDeGaia.set(g, s);
  const enlazadasCapa = new Map();
  // Millón: fuentes dibujadas que son un Gaia DR3 conocido de otra estrella del registro (ya tienen número).
  const candidatas1m = new Set([...dibujadas1m].filter(g => estrellaDeGaia.has(g) && !enRegistro.has(g)));
  // Una fuente dibujada a ≤ 1″ de una estrella del registro que no la tiene como su Gaia (tiene otro, o el suyo quedó en
  // duda), con distancia a ±25 % y brillo compatible, es esa estrella dibujada dos veces (auditoría, tipo DUPLICADO):
  // Gaia a veces da dos fuentes para una misma estrella, y a menos de 1″ la escena no las separa.
  const conGaia = rejilla(lista.filter(s => s.pos && s.d > 0).map(s => ({ ...s.pos, s })));
  const duplicadaEnGaia = g => g.pos && g.d > 0 && conGaia(g.pos, 1).map(([, q]) => q.s).find(q => q.gaia_dr3 !== g.gaia
    && Math.abs(g.d - q.d) / q.d < COMPANERA_DIST_REL && (g.G === null || q.mag === null || q.mag === undefined || (g.G - q.mag >= MISMA_G_MENOS_V[0] && g.G - q.mag <= MISMA_G_MENOS_V[1])));
  let duplicadasEnGaia = 0;
  await recorrerAthyg([GAIA_1M_CSV], (fila, cab) => {
    const c = n => fila[cab.indexOf(n)];
    const id = c('source_id');
    if (!dibujadas1m.has(id) || enRegistro.has(id)) return;
    const g = { gaia: id, ...fuenteGaia(c) };
    if (candidatas1m.has(id)) { const s = estrellaDeGaia.get(id); if (mismaEstrella(g, s)) { enlazadasCapa.set(id, { s, por: 'gaia_conocido' }); return; } }
    const s = duplicadaEnGaia(g);
    if (s) { enlazadasCapa.set(id, { s, por: 'duplicada_gaia' }); duplicadasEnGaia++; }
  });
  // GCNS: una fuente sin Gaia conocido en el registro puede ser una estrella del registro que no tiene Gaia.
  const sinGaia = rejilla([...base, ...entran, ...cns5.nuevas].filter(s => !s.gaiaAsociados?.size && !s.gaia_dr3 && s.pos && s.d > 0).map(s => ({ ...s.pos, s })));
  const gcnsValidas = gcns.filter(g => g.valida);
  let gcnsPorPosicion = 0;
  const separadas = new Set();
  for (const g of gcnsValidas) {
    let s, por;
    if (dibujadasGcns.has(g.gaia) && !enRegistro.has(g.gaia)) {
      const q = duplicadaEnGaia(g);
      if (q) { enlazadasCapa.set(g.gaia, { s: q, por: 'duplicada_gaia' }); duplicadasEnGaia++; continue; }
    }
    if (asociados.has(g.gaia)) {
      if (enRegistro.has(g.gaia) || !estrellaDeGaia.has(g.gaia)) continue;
      [s, por] = [estrellaDeGaia.get(g.gaia), 'gaia_conocido'];
    } else {
      const cerca = sinGaia(g.pos, CNS5_MAX_ARCSEC).find(([, q]) => Math.abs(g.d - q.s.d) / q.s.d < COMPANERA_DIST_REL);
      if (!cerca) continue;
      [s, por] = [cerca[1].s, 'posicion'];
    }
    // Una fuente que process_gaia dibuja en la capa solo es esa estrella si de verdad coincide con ella;
    // si no, es otra estrella (una compañera, o un Gaia DR3 mal asignado) y recibe su propio número.
    if (dibujadasGcns.has(g.gaia) && !mismaEstrella(g, s)) { separadas.add(g.gaia); continue; }
    if (por === 'posicion') { asociados.add(g.gaia); gcnsPorPosicion++; }
    if (dibujadasGcns.has(g.gaia)) enlazadasCapa.set(g.gaia, { s, por });
  }
  const filasCapa = [...enlazadasCapa].sort(([a], [b]) => compararIds(a, b))
    .map(([gaia, { s, por }]) => ({ gaia_dr3: gaia, hsb: filaPorEstrella.get(s).hsb, por }));
  const salidaCapa = serializarCsv(COLUMNAS_CAPA_ENLAZADAS, filasCapa);
  if (!fs.existsSync(CAPA_ENLAZADAS_CSV) || fs.readFileSync(CAPA_ENLAZADAS_CSV, 'utf8') !== salidaCapa) fs.writeFileSync(CAPA_ENLAZADAS_CSV, salidaCapa);
  const gcnsEnRegistro = gcnsValidas.filter(g => asociados.has(g.gaia)).length;
  const loteNuevo = nuevoLote([
    ['gaia_dr3_1m', millon.filter(g => !enRegistro.has(g))],
    ['gcns', gcnsValidas.map(g => g.gaia).filter(g => !asociados.has(g) || separadas.has(g))],
  ], { enRegistro, lotes, siguiente: filas.reduce((m, f) => Math.max(m, f.hsb), mayorLote) + 1, fecha, tmassDe });
  let archivoLote = null;
  if (loteNuevo.length) {
    fs.mkdirSync(LOTES_DIR, { recursive: true });
    let n = 1;
    do archivoLote = `${LOTES_DIR}/lote-${fecha}${n > 1 ? `-${n}` : ''}.csv.gz`; while (fs.existsSync(archivoLote) && ++n);
    fs.writeFileSync(archivoLote, zlib.gzipSync(serializarCsv(COLUMNAS_LOTE, loteNuevo), { level: 9 }));
  }

  const activas = filas.filter(f => f.estado === 'activa');
  const sinV40 = base.filter(s => !s.athyg_v40 && s.origen === 'athyg');
  const anfConV40 = base.filter(s => s.athyg_v40 && s.origen === 'anfitriona').length;
  console.log(`✓ Registro HSB: ${filas.length} filas (${activas.length} activas); nuevas ${nuevas.length}, retiradas ahora ${retiradas.length}${salida === anterior ? '; sin cambios' : ''}`);
  console.log(`✓ AT-HYG v4.0: ${base.filter(s => s.athyg_v40).length} de ${base.length} con fila (${base.filter(s => s.origen === 'athyg').length - sinV40.length} de AT-HYG); entran ${entran.length} (compañeras ${porQue.companera}, corte ${porQue.corte}); primaria por ${JSON.stringify(primariaPor)}`);
  console.log(`  Estrellas de AT-HYG sin fila v4.0: ${sinV40.map(s => `${s.i}${s.gl ? ` ${s.gl}` : ''}`).join(', ') || 'ninguna'}; anfitrionas enlazadas: ${anfConV40}`);
  console.log(`  Filas añadidas que pierden un número ya tomado: HIP ${quitados.hip}, TYC ${quitados.tyc}, Gaia en duda en la revisión ${quitados.gaia}`);
  console.log(`✓ Gaia revisado: ${revisadas}; corregidas por la auditoría (hsb_enlaces.csv): ${enlazadasPorAuditoria}, filas nuevas que eran esas mismas estrellas (retiradas): ${mismasQueBase}; gaia_revisar = 1: ${activas.filter(f => f.gaia_revisar).length}; con Gaia DR3: ${activas.filter(f => f.gaia_dr3).length}; con TYC: ${activas.filter(f => f.tyc).length}`);
  console.log(`✓ Compañeras dibujadas: ${new Set(companeras.map(c => c.sistema_hsb)).size} sistemas, ${companeras.filter(c => c.companera).length} filas (${companeras.filter(c => c.companera && c.hsb_nuevo).length} con estrella nueva)${salidaCompaneras === anteriorCompaneras ? '; sin cambios' : ''}`);
  const porOrigen = o => loteNuevo.filter(f => f.origen === o).length;
  console.log(`✓ CNS5: ${cns5.medidas} con paralaje; enlazadas ${cns5.por.numeros} por números, ${cns5.por.gliese} por designación GJ y ${cns5.por.posicion} por posición; nuevas ${cns5.nuevas.length} (pierden HIP ${quitadosCns5.hip})`);
  console.log(`✓ 2MASS en el registro: ${activas.filter(f => f.tmass).length} de ${activas.filter(f => f.gaia_dr3).length} con Gaia DR3`);
  console.log(`✓ Lotes: ${lotes.length} filas anteriores; ${archivoLote ? `nuevo ${archivoLote}: ${loteNuevo.length} (millón ${porOrigen('gaia_dr3_1m')}, GCNS ${porOrigen('gcns')})` : 'sin lote nuevo'}`);
  const enMillon = new Set(millon);
  console.log(`  Millón: ${millon.length + millonEnlazadas.size} fuentes; ${millonEnlazadas.size} son estrellas de Hoshi (process_gaia), ${millon.filter(g => enRegistro.has(g)).length} otras ya en el registro`);
  console.log(`  Capa de fondo: ${enlazadasCapa.size} fuentes dibujadas son una estrella del registro (${CAPA_ENLAZADAS_CSV}; ${duplicadasEnGaia} por ser una segunda fuente de Gaia de esa estrella); ${separadas.size} de GCNS enlazadas antes son otra estrella y tienen número propio`);
  console.log(`  GCNS fiables: ${gcnsValidas.length} de ${gcns.length}; ${gcnsEnRegistro} ya en el registro (${gcnsPorPosicion} por posición, sin Gaia en el registro); ${gcnsValidas.filter(g => !asociados.has(g.gaia) && enMillon.has(g.gaia)).length} en la capa del millón`);
  if (repetidos.length) {
    const soloBase = repetidos.filter(r => !r.nuevas);
    console.log(`⚠ Gaia DR3 en más de una estrella: ${repetidos.length} (${repetidos.length - soloBase.length} con filas añadidas; entre estrellas de la carga base: ${soloBase.length})`);
    for (const r of soloBase) console.log(`  ${r.gaia}: ${r.estrellas.join(' / ')}${r.conserva !== null ? ` (lo conserva ${r.conserva})` : ' (se quita a todas)'}`);
  }
}
