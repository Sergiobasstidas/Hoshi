// scripts/catalog/auditoria.js
// Auditoría cruzada del catálogo: enlaza cada estrella de Hoshi con todas las fuentes (por número y por posición y
// brillo), compara cada dato y le da a cada diferencia un tipo, una regla y un veredicto (scripts/catalog/auditoria/).
// Sin red: lee data/raw (SIMBAD, de data/raw/red/auditoria; se baja con HOSHI_RED=descargar).
//   npm run auditoria                          escribe data/catalog/hsb_identidad.csv.gz y hsb_auditoria.csv.gz
//   npm run auditoria -- --informe <carpeta>   además resumen.md, discrepancias.csv y resumen.json en esa carpeta
//   npm run auditoria -- --control             falla si queda una diferencia «Corregir», «Decide Sergio» o «Enlace malo»
//                                              que no esté en data/catalog/auditoria_revisadas.csv (con su motivo)
// No cambia ningún dato del catálogo.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { cargarTodo } from './auditoria/fuentes.js';
import { UMBRAL, VEREDICTOS, auditar, auditarCapa } from './auditoria/chequeos.js';
import { gaiaDeGj, identificadoresSimbad } from './auditoria/simbad.js';
import { separacionesMedidas } from './auditoria/separaciones.js';

const IDENTIDAD = 'data/catalog/hsb_identidad.csv.gz', AUDITORIA = 'data/catalog/hsb_auditoria.csv.gz', REVISADAS = 'data/catalog/auditoria_revisadas.csv';
export const COLUMNAS = ['hsb', 'nombre', 'tipo', 'dato', 'valor_actual', 'fuente_actual', 'valor_propuesto', 'fuente_propuesta', 'diferencia_sigma', 'regla', 'veredicto'];
const COLUMNAS_IDENTIDAD = ['hsb', 'fuente', 'id', 'metodo', 'sep_arcsec', 'dmag', 'confianza', 'motivo'];
const celda = v => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const aCsv = (filas, columnas) => [columnas.join(','), ...filas.map(f => columnas.map(c => celda(f[c])).join(','))].join('\n') + '\n';
const escribirGz = (ruta, texto) => {
  const nuevo = zlib.gzipSync(texto, { level: 9 });
  if (!fs.existsSync(ruta) || !zlib.gunzipSync(fs.readFileSync(ruta)).equals(Buffer.from(texto))) fs.writeFileSync(ruta, nuevo);
};
export const claveRevisada = d => `${d.hsb}|${d.tipo}|${d.dato}`;

export async function correrAuditoria() {
  const D = await cargarTodo();
  const { identidad, difs } = auditar(D, { simbadHip: await identificadoresSimbad(), simbadGj: await gaiaDeGj(), separaciones: separacionesMedidas() });
  const capa = auditarCapa(D);
  const todas = [...difs, ...capa.difs];
  const orden = d => `${d.tipo}|${d.dato}|${String(d.hsb).padStart(12, '0')}|${d.nombre}|${d.valor_propuesto}`;
  todas.sort((a, b) => (orden(a) < orden(b) ? -1 : orden(a) > orden(b) ? 1 : 0));
  identidad.sort((a, b) => a.hsb - b.hsb || (a.fuente < b.fuente ? -1 : a.fuente > b.fuente ? 1 : 0));
  return { D, identidad, difs: todas, capa: capa.resumen };
}

// Conteos y textos del informe.
export function resumir({ D, identidad, difs, capa }) {
  const n = D.estrellas.length;
  const cuenta = (lista, clave) => lista.reduce((o, d) => { const k = clave(d); o[k] = (o[k] || 0) + 1; return o; }, {});
  const porTipo = {};
  for (const d of difs) { porTipo[d.tipo] ??= Object.fromEntries(VEREDICTOS.map(v => [v, 0])); porTipo[d.tipo][d.veredicto]++; }
  const porVeredicto = cuenta(difs, d => d.veredicto);
  const fuentePrincipal = t => (String(t).match(/Gaia DR3|GCNS|Hipparcos|CNS5|AT-HYG|SIMBAD|NASA|WDS|UCC|2MASS|registro HSB|curada|star_systems|Hoshi|M_V típica/) || ['otra'])[0];
  const porFuente = cuenta(difs.filter(d => d.fuente_propuesta), d => fuentePrincipal(d.fuente_propuesta));
  // Cuántas estrellas cambiaría cada regla de «Corregir».
  const reglas = {};
  for (const d of difs.filter(x => x.veredicto === 'Corregir')) { const k = `${d.tipo}: ${d.regla}`; (reglas[k] ??= new Set()).add(d.hsb); }
  const cambios = Object.entries(reglas).map(([regla, s]) => ({ regla, estrellas: s.size, porcentaje: Number((100 * s.size / n).toFixed(2)) })).sort((a, b) => b.estrellas - a.estrellas);
  // Identidad: enlazadas y sin enlace por fuente.
  const ident = {};
  for (const r of identidad) {
    ident[r.fuente] ??= { enlazadas: 0, segura: 0, probable: 0, dudosa: 0, sinEnlace: 0, motivos: {} };
    const e = ident[r.fuente];
    if (r.motivo.startsWith('sin enlace')) { e.sinEnlace++; const m = r.motivo.replace(/^sin enlace: /, '').replace(/HIP \d+ está en .*/, 'HIP está en otra estrella'); e.motivos[m] = (e.motivos[m] || 0) + 1; }
    else { e.enlazadas++; if (e[r.confianza] !== undefined) e[r.confianza]++; }
  }
  // Las 20 estrellas con nombre más afectadas: suma de diferencias que piden un cambio o una decisión.
  const peso = { Corregir: 3, 'Decide Sergio': 3, 'Enlace malo': 2, 'Es real': 0 };
  const afectadas = {};
  for (const d of difs) if (d.con_nombre && peso[d.veredicto]) { afectadas[d.hsb] ??= { hsb: d.hsb, nombre: d.nombre, puntos: 0, tipos: new Set() }; afectadas[d.hsb].puntos += peso[d.veredicto]; afectadas[d.hsb].tipos.add(d.tipo); }
  const top = Object.values(afectadas).sort((a, b) => b.puntos - a.puntos || a.hsb - b.hsb).slice(0, 20).map(a => ({ ...a, tipos: [...a.tipos] }));
  // Alertas de magnitud que coinciden con otra diferencia de la misma estrella.
  const conOtra = new Set(difs.filter(d => !['ALERTA-MAG-TIPO', 'MULTIPLICIDAD', 'PM', 'DIST-CALIDAD', 'CAPA-REGLA'].includes(d.tipo) && d.veredicto !== 'Es real').map(d => d.hsb));
  const alertas = difs.filter(d => d.tipo === 'ALERTA-MAG-TIPO');
  return { estrellas: n, porTipo, porVeredicto, porFuente, cambios, identidad: ident, top, capa,
    alertas: { total: alertas.length, coinciden: alertas.filter(d => conOtra.has(d.hsb)).length, conNombre: alertas.filter(d => d.con_nombre).length }, umbrales: UMBRAL };
}

export function leerRevisadas() {
  if (!fs.existsSync(REVISADAS)) return new Set();
  return new Set(parse(fs.readFileSync(REVISADAS, 'utf8'), { columns: true }).map(claveRevisada));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const informe = args.includes('--informe') ? args[args.indexOf('--informe') + 1] : null;
  const resultado = await correrAuditoria();
  const { identidad, difs } = resultado;
  escribirGz(IDENTIDAD, aCsv(identidad, COLUMNAS_IDENTIDAD));
  escribirGz(AUDITORIA, aCsv(difs, COLUMNAS));
  const r = resumir(resultado);
  console.log(`✓ Auditoría: ${r.estrellas} estrellas, ${identidad.length} filas de identidad, ${difs.length} diferencias: ${VEREDICTOS.map(v => `${v} ${r.porVeredicto[v] || 0}`).join(', ')}`);
  for (const [tipo, c] of Object.entries(r.porTipo).sort()) console.log(`  ${tipo.padEnd(16)} ${VEREDICTOS.map(v => `${v} ${c[v]}`).join(' · ')}`);
  if (informe) {
    fs.mkdirSync(informe, { recursive: true });
    fs.writeFileSync(path.join(informe, 'discrepancias.csv'), aCsv(difs, COLUMNAS));
    fs.writeFileSync(path.join(informe, 'resumen.json'), JSON.stringify(r, null, 1));
    console.log(`✓ Informe en ${informe}`);
  }
  if (args.includes('--control')) {
    const revisadas = leerRevisadas();
    // «Corregir» solo pasa si quedó en revisadas con su motivo (no tiene una regla segura y espera una decisión).
    const corregir = difs.filter(d => d.veredicto === 'Corregir' && !revisadas.has(claveRevisada(d)));
    const nuevas = difs.filter(d => (d.veredicto === 'Decide Sergio' || d.veredicto === 'Enlace malo') && !revisadas.has(claveRevisada(d)));
    const sinVeredicto = difs.filter(d => !VEREDICTOS.includes(d.veredicto));
    if (corregir.length || nuevas.length || sinVeredicto.length) {
      console.error(`✗ Control de la auditoría: ${corregir.length} para corregir, ${nuevas.length} sin revisar (Decide Sergio o Enlace malo), ${sinVeredicto.length} sin veredicto`);
      process.exit(1);
    }
    const pendientes = fs.existsSync(REVISADAS) ? parse(fs.readFileSync(REVISADAS, 'utf8'), { columns: true }).filter(f => f.decision === 'pendiente').length : 0;
    console.log(`✓ Control de la auditoría: todo corregido o revisado con motivo (${pendientes} con decisión pendiente fuera de A–O)`);
  }
}
