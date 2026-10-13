// scripts/process_stars.js
// Lee el CSV de HYGLike, filtra estrellas hasta MAX_DISTANCE_PC del Sol,
// agrega color RGB pre-calculado desde el índice B-V, y exporta JSON.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

// === CONFIGURACIÓN ===
const MAX_DISTANCE_PC = 400000;
const RAW_DIR = './data/raw';
// Nombre heredado: el archivo ya no se limita a 15 pc. Se conserva por los imports.
const OUTPUT_PATH = './data/processed/stars_15pc.json';


// === 1. Detectar el CSV en data/raw/ (cualquier nombre sirve) ===
const csvFiles = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.csv'));
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
  return {
    i: parseInt(s.id),            // ID único
    n: s.proper || null,          // nombre propio (si existe)
    x: parseFloat(s.x),           // posición X (parsecs, Sol = origen)
    y: parseFloat(s.y),
    z: parseFloat(s.z),
    d: parseFloat(s.dist),        // distancia al Sol en parsecs
    m: parseFloat(s.absmag),      // magnitud absoluta (más bajo = más brillante)
    c: parseFloat(s.ci) || 0,     // índice B-V (color)
    sp: s.spect || null,          // tipo espectral (ej: "G2V")
    rgb: [r, g, b],               // color RGB ya calculado
  };
});


// === 6. Ordenar por distancia (Sol primero) ===
processed.sort((a, b) => a.d - b.d);


// === 7. Escribir el JSON ===
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(processed, null, 2));

const sizeKB = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
console.log(`✓ Guardado: ${OUTPUT_PATH} (${sizeKB} KB)`);


// === Bonus: mostrar las 5 más cercanas en consola, para verificar ===
console.log(`\nLas 5 estrellas más cercanas al Sol:`);
processed.slice(0, 5).forEach(s => {
  const name = s.n || '(sin nombre)';
  console.log(`  ${name.padEnd(25)} d=${s.d.toFixed(3)} pc   RGB=${s.rgb}`);
});
