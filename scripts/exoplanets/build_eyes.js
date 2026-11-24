// scripts/exoplanets/build_eyes.js
// Tipo de aspecto de cada exoplaneta de Hoshi según Eyes on Exoplanets (NASA/JPL-Caltech), para dibujarlo como allí
// (src/scene/eyes/recetaEyes.js), y el tipo que muestra su ficha (clasificarPlaneta). Lee la base de planetas de Eyes
// (data/raw/eyes/, no se sube; con HOSHI_RED=descargar se vuelve a bajar) y escribe public/data/exoplanetas-eyes.json: por
// nombre de planeta, el índice de su par [aspecto, tipo de ficha] en `c`. El id de Eyes es el nombre con guiones bajos
// (idEyes). Los planetas que no están en Eyes toman el aspecto de tipoPorRegla. pl_bmasselim, de la tabla de la NASA.
import fs from 'node:fs';
import { DESCARGAR } from '../catalog/red.js';
import { clasificarPlaneta, idEyes, tipoPorRegla } from '../../src/scene/eyes/recetaEyes.js';
import { parse } from 'csv-parse/sync';

const URL_BASE = 'https://eyes.nasa.gov/assets/dynamic/exo/db/EyesExoPlanetDatabase.bin';
const RAW = './data/raw/eyes/EyesExoPlanetDatabase.bin';
const SALIDA = './public/data/exoplanetas-eyes.json';

// Formato de la base de Eyes (su _createExoDatabase): firma de 8 bytes, lista de campos (tipo y nombre) y una fila por
// planeta: id y cada campo (texto con su largo, número de 8 bytes o pares y tríos de números).
export function leerBaseEyes(buffer) {
  let p = 0;
  const entero16 = () => { const v = buffer.readInt16LE(p); p += 2; return v; };
  const texto = n => { const v = buffer.toString('utf8', p, p + n); p += n; return v; };
  if (buffer.readBigInt64LE(0) !== 1163415344n) throw Error('La base de Eyes no tiene la firma esperada');
  p = 8;
  const n = buffer.readUInt16LE(p); p += 2;
  const campos = Array.from({ length: n }, () => { const tipo = entero16(); return { tipo, nombre: texto(entero16()) }; });
  const filas = [];
  while (p < buffer.length) {
    const fila = { id: texto(entero16()) };
    for (const { tipo, nombre } of campos) {
      if (tipo === -1 || tipo === 1) fila[nombre] = texto(entero16());
      else if (tipo === 4) { fila[nombre] = buffer.readDoubleLE(p); p += 8; }
      else if (tipo === 5) { fila[nombre] = [buffer.readFloatLE(p), buffer.readFloatLE(p + 4)]; p += 8; }
      else if (tipo === 8) { fila[nombre] = [0, 8, 16].map(k => buffer.readDoubleLE(p + k)); p += 24; }
      else throw Error(`Tipo de campo ${tipo} desconocido en la base de Eyes`);
    }
    filas.push(fila);
  }
  return filas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (DESCARGAR) {
    const r = await fetch(URL_BASE, { signal: AbortSignal.timeout(300000) });
    if (!r.ok) throw Error(`Eyes respondió ${r.status}`);
    fs.mkdirSync('./data/raw/eyes', { recursive: true });
    fs.writeFileSync(RAW, Buffer.from(await r.arrayBuffer()));
  }
  if (!fs.existsSync(RAW)) throw Error(`Falta ${RAW}; corre: npm run descargar:red`);
  const eyes = new Map(leerBaseEyes(fs.readFileSync(RAW)).map(f => [f.id, f]));
  const masaLimite = new Set(parse(fs.readFileSync('./data/raw/exoplanets/nasa_pscomppars.csv', 'utf8'), { columns: true, skip_empty_lines: true, comment: '#', relax_quotes: true })
    .filter(f => f.pl_bmasselim === '1').map(f => f.pl_name));
  const sistemas = JSON.parse(fs.readFileSync('./public/data/exoplanets.json', 'utf8')).systems;
  const pares = [], indice = new Map(), planetas = {};
  let cruzados = 0, porLimite = 0;
  const porRegla = [];
  for (const sistema of sistemas) for (const planeta of sistema.p) {
    const fila = eyes.get(idEyes(planeta.n));
    let aspecto = fila?.visType;
    if (fila) cruzados++;
    else { aspecto = tipoPorRegla(planeta); porRegla.push(`${planeta.n} (${aspecto})`); }
    const limite = masaLimite.has(planeta.n);
    if (limite && planeta.r !== null) porLimite++;
    const { tipo, aspecto: final } = clasificarPlaneta({ aspecto, clase: fila?.plType || null, masaLimite: limite, r: planeta.r, a: planeta.a, teq: planeta.teq ?? null });
    const clave = `${final}|${tipo}`;
    if (!indice.has(clave)) { indice.set(clave, pares.length); pares.push([final, tipo]); }
    planetas[planeta.n] = indice.get(clave);
  }
  const salida = JSON.stringify({ meta: { fuente: 'Eyes on Exoplanets, NASA/JPL-Caltech (EyesExoPlanetDatabase.bin)', cruzados, porRegla: porRegla.length, masaLimite: porLimite },
    c: pares, p: planetas });
  if (!fs.existsSync(SALIDA) || fs.readFileSync(SALIDA, 'utf8') !== salida) fs.writeFileSync(SALIDA, salida);
  console.log(`✓ Eyes: ${cruzados} planetas cruzados, ${porLimite} con masa límite (tipo por radio), ${porRegla.length} por la regla${porRegla.length ? `: ${porRegla.join(', ')}` : ''}`);
}
