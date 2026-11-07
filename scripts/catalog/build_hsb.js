// scripts/catalog/build_hsb.js
// Registro HSB (Hoshi + Sergio Bastidas): un número fijo por estrella que no cambia aunque
// cambien las versiones de AT-HYG o la tabla de la NASA. Crea o actualiza
// data/catalog/hsb_registro.csv sin renumerar nunca:
//  - cada estrella de stars_15pc.json se reconoce en el registro por sus números fijos, en
//    este orden: HIP, HD, TYC, Gaia DR3, id de AT-HYG de la misma versión y nombre;
//  - las nuevas reciben el siguiente número desde HSB_NUEVO_BASE (en el llenado inicial,
//    con el registro vacío, el número es su `i` actual);
//  - las que ya no están quedan como «retirada»; ninguna fila se borra.
// Correrlo dos veces seguidas da exactamente el mismo archivo.
// Uso: npm run hsb   (requiere data/raw/athyg, ver su FUENTES.md)

import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';

export const REGISTRO_CSV = './data/catalog/hsb_registro.csv';
const STARS_JSON = './data/processed/stars_15pc.json';
const ADDED_HOSTS_JSON = './data/catalog/added_hosts.json';
const HOSTS_JSON = './data/catalog/exoplanet_host_identity.json';
const ATHYG_PARTES = ['./data/raw/athyg/athyg_v32-1.csv.gz', './data/raw/athyg/athyg_v32-2.csv.gz'];

// Los números de AT-HYG llegan a ~2,6 millones y las anfitrionas añadidas usan 9 000 000 + n:
// las estrellas que entren después de la primera carga empiezan aquí.
export const HSB_NUEVO_BASE = 100_000_000;
export const COLUMNAS = ['hsb', 'origen', 'athyg_v32', 'hip', 'hd', 'hr', 'gl', 'tyc', 'gaia_dr3', 'tic', 'nombre', 'alta', 'estado'];
// Identificadores con los que se reconoce una estrella, en orden de prioridad.
export const LLAVES = ['hip', 'hd', 'tyc', 'gaia_dr3', 'athyg_v32', 'nombre'];
const IDENTIDAD = ['origen', 'athyg_v32', 'hip', 'hd', 'hr', 'gl', 'tyc', 'gaia_dr3', 'tic', 'nombre'];

const texto = v => (v === undefined || v === null ? '' : String(v).trim());

// --- Lectura y escritura del registro ---

const celda = v => (/[",\n\r]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function serializarRegistro(filas) {
  return [COLUMNAS.join(','), ...filas.map(f => COLUMNAS.map(c => celda(texto(f[c]))).join(','))].join('\n') + '\n';
}

export function leerRegistro(contenido) {
  if (!contenido) return [];
  const filas = parseSync(contenido, { columns: true, skip_empty_lines: true });
  const faltan = COLUMNAS.filter(c => filas.length && !(c in filas[0]));
  if (faltan.length) throw new Error(`Al registro le faltan columnas: ${faltan.join(', ')}`);
  return filas.map(f => ({ ...f, hsb: Number(f.hsb) }));
}

// --- Identidad de cada estrella de Hoshi ---

// Un mismo Gaia DR3 en dos estrellas indica un enlace dudoso: se deja vacío en todas.
export function quitarGaiaRepetidos(identidades) {
  const porGaia = new Map();
  for (const s of identidades) if (s.gaia_dr3) porGaia.set(s.gaia_dr3, [...(porGaia.get(s.gaia_dr3) || []), s]);
  const repetidos = [...porGaia].filter(([, lista]) => lista.length > 1);
  for (const [, lista] of repetidos) for (const s of lista) s.gaia_dr3 = '';
  return repetidos.map(([gaia, lista]) => ({ gaia, estrellas: lista.map(s => `${s.i} ${s.nombre || s.hip && `HIP ${s.hip}` || s.hd && `HD ${s.hd}` || ''}`.trim()) }));
}

const deAlias = (alias, patron) => (alias || []).map(a => a.match(patron)?.[1]).find(Boolean) || '';

// stars: stars_15pc.json; athyg: Map id → fila de AT-HYG completo; anfitrionas: Map i → registro de
// added_hosts.json; nasa: anfitriones de exoplanet_host_identity.json.
export function identidades({ stars, athyg, anfitrionas, nasa }) {
  const ticPorEstrella = new Map(), nasaPorNombre = new Map();
  for (const h of nasa) {
    if (h.i !== null && h.tic && !ticPorEstrella.has(h.i)) ticPorEstrella.set(h.i, h.tic);
    nasaPorNombre.set(h.h, h);
  }
  const tic = v => texto(v).replace(/^TIC\s*/, '');
  return stars.map(s => {
    if (s.dataOrigin === 'exoplanet-host') {
      const a = anfitrionas.get(s.i);
      if (!a) throw new Error(`La anfitriona ${s.i} no está en added_hosts.json`);
      const h = nasaPorNombre.get(a.h) || {};
      return { i: s.i, origen: 'anfitriona', athyg_v32: '', hip: texto(h.hip), hd: texto(h.hd),
        hr: deAlias(h.alias, /^HR (\d+)$/), gl: texto(h.gj), tyc: deAlias(h.alias, /^TYC (\d+-\d+-\d+)$/),
        gaia_dr3: texto(a.gaia), tic: tic(h.tic), nombre: texto(a.h) };
    }
    // El Sol es la fila 0 de HYGLike y la 1 de AT-HYG completo; el resto conserva el id.
    const id = s.i === 0 ? 1 : s.i;
    const r = athyg.get(id);
    if (!r) throw new Error(`La estrella ${s.i} no está en AT-HYG v3.2 completo`);
    return { i: s.i, origen: 'athyg', athyg_v32: String(id), hip: texto(r.hip), hd: texto(r.hd), hr: texto(r.hr),
      gl: texto(r.gl), tyc: texto(r.tyc), gaia_dr3: texto(r.gaia), tic: tic(ticPorEstrella.get(s.i)), nombre: texto(r.proper) };
  });
}

// --- Conciliación con el registro existente ---

const firma = f => LLAVES.map(k => texto(f[k])).join('|');

export function conciliar(registro, estrellas, { fecha }) {
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
  let siguiente = filas.reduce((m, f) => Math.max(m, f.hsb + 1), HSB_NUEVO_BASE);
  const nuevas = [];
  estrellas.forEach((s, k) => {
    const identidad = Object.fromEntries(IDENTIDAD.map(c => [c, texto(s[c])]));
    const f = asignacion.get(k);
    if (f) { Object.assign(f, identidad, { estado: 'activa' }); return; }
    // Un número ya reservado aguas arriba (anfitriona nueva) o la primera carga conservan su `i`.
    let hsb = (vacio || s.i >= HSB_NUEVO_BASE) && !usados.has(s.i) ? s.i : null;
    if (hsb === null) { while (usados.has(siguiente)) siguiente++; hsb = siguiente++; }
    usados.add(hsb);
    const fila = { hsb, ...identidad, alta: fecha, estado: 'activa' };
    filas.push(fila); nuevas.push(fila);
  });

  const retiradas = filas.filter(f => !tomadas.has(f) && !nuevas.includes(f) && f.estado !== 'retirada');
  for (const f of filas) if (!tomadas.has(f) && !nuevas.includes(f)) f.estado = 'retirada';
  filas.sort((a, b) => a.hsb - b.hsb);
  return { filas, nuevas, retiradas };
}

// --- Lectura de AT-HYG completo (dos partes; solo la primera trae cabecera) ---

export async function leerAthyg(ids, partes = ATHYG_PARTES) {
  const out = new Map();
  let cabecera = null;
  for (const parte of partes) {
    const lector = fs.createReadStream(parte).pipe(zlib.createGunzip()).pipe(parse({ relax_column_count: false }));
    for await (const fila of lector) {
      if (!cabecera) { cabecera = fila; continue; }
      const id = Number(fila[0]);
      if (ids.has(id)) out.set(id, Object.fromEntries(cabecera.map((c, k) => [c, fila[k]])));
    }
  }
  return out;
}

const fechaLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const stars = JSON.parse(fs.readFileSync(STARS_JSON, 'utf8'));
  const anfitrionas = new Map(JSON.parse(fs.readFileSync(ADDED_HOSTS_JSON, 'utf8')).stars.map(s => [s.i, s]));
  const nasa = JSON.parse(fs.readFileSync(HOSTS_JSON, 'utf8')).hosts;
  const ids = new Set(stars.filter(s => s.dataOrigin !== 'exoplanet-host').map(s => (s.i === 0 ? 1 : s.i)));
  const athyg = await leerAthyg(ids);
  const lista = identidades({ stars, athyg, anfitrionas, nasa });
  const repetidos = quitarGaiaRepetidos(lista);
  const anterior = fs.existsSync(REGISTRO_CSV) ? fs.readFileSync(REGISTRO_CSV, 'utf8') : '';
  const { filas, nuevas, retiradas } = conciliar(leerRegistro(anterior), lista, { fecha: fechaLocal() });
  const salida = serializarRegistro(filas);
  if (salida !== anterior) fs.writeFileSync(REGISTRO_CSV, salida);
  const activas = filas.filter(f => f.estado === 'activa');
  console.log(`✓ Registro HSB: ${filas.length} filas (${activas.length} activas); nuevas ${nuevas.length}, retiradas ahora ${retiradas.length}${salida === anterior ? '; sin cambios' : ''}`);
  console.log(`✓ Con TYC: ${activas.filter(f => f.tyc).length}; con Gaia DR3: ${activas.filter(f => f.gaia_dr3).length}; con TIC: ${activas.filter(f => f.tic).length}`);
  if (repetidos.length) {
    console.log(`⚠ Gaia DR3 en más de una estrella (queda vacío en todas): ${repetidos.length}`);
    for (const r of repetidos) console.log(`  ${r.gaia}: ${r.estrellas.join(' / ')}`);
  }
}
