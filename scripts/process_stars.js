// scripts/process_stars.js
// Lee el CSV de HYGLike, filtra estrellas hasta MAX_DISTANCE_PC del Sol,
// agrega color RGB pre-calculado desde el índice B-V, y exporta JSON.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { applyPatches, loadPatches } from './catalog/catalog_patches.js';
import { estrellasNuevas, fusionarBase, indiceCns5 } from './catalog/fusion.js';

// === CONFIGURACIÓN ===
const MAX_DISTANCE_PC = 400000;
const RAW_DIR = './data/raw';
// Nombre heredado: el archivo ya no se limita a 15 pc. Se conserva por los imports.
const OUTPUT_PATH = './data/processed/stars_15pc.json';
// Registro HSB y fuentes para elegir cada dato (scripts/catalog/fusion.js). Sin registro, el catálogo sale
// como antes, solo con AT-HYG y los parches (primera pasada de npm run catalogo en un repositorio nuevo).
const REGISTRO_CSV = './data/catalog/hsb_registro.csv';
const GAIA_CSV = './data/raw/gaia/gaia_dr3_registro.csv.gz';
const HIPPARCOS_CSV = './data/raw/hipparcos/hipparcos_2007.csv.gz';
const ESPECTROS_JSON = './data/catalog/espectros_simbad.json';
const ATHYG_V40 = './data/raw/athyg/v40/athyg_40.csv.gz';
const CNS5_CSV = './data/raw/cns5/cns5_main.csv';
const FUENTES_PATH = './data/catalog/hsb_fuentes.csv.gz';


// === 1. Detectar el CSV en data/raw/ (cualquier nombre sirve) ===
const csvFiles = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.csv')).sort();
if (csvFiles.length === 0) {
  console.error('❌ No se encontró ningún CSV en data/raw/');
  process.exit(1);
}
const inputPath = path.join(RAW_DIR, csvFiles[0]);
console.log(`📂 Leyendo: ${inputPath}`);


// === 2. Leer y parsear el CSV ===
// readFileSync carga el archivo entero en memoria como texto.
// parse() lo convierte en un array de objetos JS, usando la primera fila como nombres de columna.
const csvText = fs.readFileSync(inputPath, 'utf-8');
const records = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
});
console.log(`✓ Total de estrellas en el catálogo: ${records.length.toLocaleString()}`);


// === 3. Filtrar por distancia ===
// El campo 'dist' está en parsecs. Nos quedamos con las que están a ≤ MAX_DISTANCE_PC.
const nearbyStars = records.filter(s => {
  const d = parseFloat(s.dist);
  return !isNaN(d) && d >= 0 && d <= MAX_DISTANCE_PC;
});
console.log(`✓ Estrellas procesadas: ${nearbyStars.length}`);


// === 4. Helpers: convertir índice B-V → temperatura → color RGB ===

// El índice B-V indica la temperatura de la estrella.
// Fórmula de Ballesteros (2012): aproxima la temperatura efectiva en Kelvin.
function bvToTemperature(bv) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

// Algoritmo de Tanner Helland: aproxima un cuerpo negro a su color RGB (sRGB).
// Devuelve [r, g, b] con valores 0-255.
function temperatureToRgb(temp) {
  const t = temp / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  return [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))));
}

function getStarColor(ci) {
  const bv = parseFloat(ci);
  if (isNaN(bv)) return [255, 255, 255]; // default blanco si no hay dato
  return temperatureToRgb(bvToTemperature(bv));
}


// === 5. Transformar: solo los campos que necesitamos, con keys cortas ===
// Keys de 1 letra para que el JSON sea liviano (estilo BSC5P-JSON-XYZ).
const processed = nearbyStars.map(s => {
  const [r, g, b] = getStarColor(s.ci);
  // Las columnas x, y, z del CSV vienen redondeadas a ~0,001 pc (≈ 206 UA), lo que
  // superpone componentes de un mismo sistema. Se recalculan desde ascensión recta,
  // declinación y distancia, en el mismo marco ecuatorial J2000 con origen en el Sol.
  const dist = parseFloat(s.dist), ra = parseFloat(s.ra) * Math.PI / 12, dec = parseFloat(s.dec) * Math.PI / 180;
  // Siete cifras significativas: 0,02 UA a 1 pc y 2 UA a 100 pc, sin engordar el archivo.
  const coordinate = value => Number((dist * value).toPrecision(7));
  return {
    i: parseInt(s.id),            // ID único
    n: s.proper || null,          // nombre propio (si existe)
    x: coordinate(Math.cos(dec) * Math.cos(ra)), // posición X (parsecs, Sol = origen)
    y: coordinate(Math.cos(dec) * Math.sin(ra)),
    z: coordinate(Math.sin(dec)),
    d: parseFloat(s.dist),        // distancia al Sol en parsecs
    m: parseFloat(s.absmag),      // magnitud absoluta (más bajo = más brillante)
    c: parseFloat(s.ci) || 0,     // índice B-V (color)
    sp: s.spect || null,          // tipo espectral (ej: "G2V")
    rgb: [r, g, b],               // color RGB ya calculado
  };
});


// === 5b. Parches de data/catalog/: distancias de Gaia DR3 y anfitrionas de exoplanetas ===
// Se aplican si los archivos existen; AT-HYG no se modifica. Ver scripts/catalog/catalog_patches.js.
const patches = loadPatches();
const patched = applyPatches(processed, patches);
console.log(`✓ Distancias corregidas: ${patches.corrections.length}; anfitrionas añadidas: ${patches.added.length}`);


// === 5c. Una regla por dato (distancia, color, tipo espectral) y estrellas nuevas del registro HSB ===
let catalogo = patched;
if (fs.existsSync(REGISTRO_CSV)) {
  const csvGz = ruta => parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'), { columns: true, skip_empty_lines: true });
  const registro = new Map(parse(fs.readFileSync(REGISTRO_CSV, 'utf8'), { columns: true }).map(r => [Number(r.hsb), { ...r, hsb: Number(r.hsb) }]));
  const gaia = new Map(csvGz(GAIA_CSV).map(g => [g.source_id, g]));
  const hip = new Map(csvGz(HIPPARCOS_CSV).map(h => [h.hip, h]));
  const espectros = JSON.parse(fs.readFileSync(ESPECTROS_JSON, 'utf8'));
  // Solo las filas de AT-HYG v4.0 que hacen falta: las de estrellas nuevas.
  const pedidas = new Set([...registro.values()].filter(r => r.origen === 'athyg_v40' && r.athyg_v40).map(r => Number(r.athyg_v40)));
  const v40 = new Map();
  let cabecera = null;
  const lineas = readline.createInterface({ input: fs.createReadStream(ATHYG_V40).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const linea of lineas) {
    if (!linea) continue;
    if (!cabecera) { cabecera = linea.split(','); continue; }
    const id = Number(linea.slice(0, linea.indexOf(',')));
    if (pedidas.has(id)) { const [fila] = parse(linea, { columns: cabecera, relax_quotes: true }); v40.set(id, fila); }
  }
  const filasCns5 = parse(fs.readFileSync(CNS5_CSV, 'utf8'), { columns: true });
  const cns5 = indiceCns5(filasCns5);
  const base = fusionarBase(patched, { registro, gaia, hip, espectros, cns5 });
  const nuevas = estrellasNuevas(registro, { gaia, hip, espectros, v40, cns5 });
  // La fuente de cada dato queda en hsb_fuentes.csv.gz; en el catálogo de la app solo se conserva `ds` en las
  // anfitrionas añadidas y en las curadas, como antes.
  catalogo = [...base.estrellas, ...nuevas.estrellas].map(star => {
    if (star.dataOrigin === 'exoplanet-host' || star.dataOrigin === 'curated') return star;
    const resto = { ...star };
    delete resto.ds;
    return resto;
  });
  const columnas = ['hsb', 'd', 'fuente_d', 'c', 'fuente_c', 'sp', 'fuente_sp'];
  const celda = v => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const filas = [...base.fuentes, ...nuevas.fuentes].sort((a, b) => a.hsb - b.hsb);
  fs.writeFileSync(FUENTES_PATH, zlib.gzipSync([columnas.join(','), ...filas.map(f => columnas.map(c => celda(f[c])).join(','))].join('\n') + '\n', { level: 9 }));
  const conteo = campo => filas.reduce((o, f) => ({ ...o, [f[campo]]: (o[f[campo]] || 0) + 1 }), {});
  console.log(`✓ Fuentes: distancia ${JSON.stringify(conteo('fuente_d'))}`);
  console.log(`  color ${JSON.stringify(conteo('fuente_c'))}; espectro ${JSON.stringify(conteo('fuente_sp'))}`);
  console.log(`✓ Estrellas nuevas del registro HSB: ${nuevas.estrellas.length}; omitidas ${JSON.stringify(nuevas.omitidas)}`);
}


// === 6. Ordenar por distancia (Sol primero) ===
const patchedSorted = catalogo.sort((a, b) => a.d - b.d || a.i - b.i);


// === 7. Escribir el JSON ===
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(patchedSorted));

const sizeKB = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
console.log(`✓ Guardado: ${OUTPUT_PATH} (${sizeKB} KB)`);


// === Bonus: mostrar las 5 más cercanas en consola, para verificar ===
console.log(`\nLas 5 estrellas más cercanas al Sol:`);
patchedSorted.slice(0, 5).forEach(s => {
  const name = s.n || '(sin nombre)';
  console.log(`  ${name.padEnd(25)} d=${s.d.toFixed(3)} pc   RGB=${s.rgb}`);
});
