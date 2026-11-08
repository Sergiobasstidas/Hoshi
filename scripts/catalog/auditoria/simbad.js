// scripts/catalog/auditoria/simbad.js
// Tabla de identificadores de SIMBAD para la auditoría: para cada HIP, los HD, GJ/Gl, Gaia DR3 y 2MASS del mismo
// objeto (consultas TAP en bloque, una por tipo de identificador). Se guardan con red.js en data/raw/red/auditoria;
// sin HOSHI_RED=descargar se leen de ahí.
import { parse } from 'csv-parse/sync';
import { pedir } from '../red.js';

const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
export const PREFIJOS = { hd: 'HD %', gj: 'GJ %', gaia: 'Gaia DR3 %', tmass: '2MASS J%' };

async function consulta(prefijo) {
  const query = `SELECT h.id AS hip, v.id AS alias FROM ident AS h JOIN ident AS v ON v.oidref = h.oidref WHERE h.id LIKE 'HIP %' AND v.id LIKE '${prefijo}'`;
  const texto = await pedir('auditoria', SIMBAD, { method: 'POST', signal: AbortSignal.timeout(600000),
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', maxrec: '2000000', query }), aceptar: (t, r) => r.ok && t.startsWith('hip,alias') });
  return parse(texto, { columns: true });
}

// Map GJ normalizado («423A») → Set de Gaia DR3, para las estrellas sin HIP.
export async function gaiaDeGj() {
  const query = "SELECT h.id AS gj, v.id AS gaia FROM ident AS h JOIN ident AS v ON v.oidref = h.oidref WHERE h.id LIKE 'GJ %' AND v.id LIKE 'Gaia DR3 %'";
  const texto = await pedir('auditoria', SIMBAD, { method: 'POST', signal: AbortSignal.timeout(600000),
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', maxrec: '2000000', query }), aceptar: (t, r) => r.ok && t.startsWith('gj,gaia') });
  const mapa = new Map();
  for (const { gj, gaia } of parse(texto, { columns: true })) {
    const clave = gj.replace(/^GJ\s+/, '').replace(/\s+/g, '');
    if (!mapa.has(clave)) mapa.set(clave, new Set());
    mapa.get(clave).add(gaia.replace(/^Gaia DR3\s+/, ''));
  }
  return mapa;
}

// Map hip (número) → { hd: Set, gj: Set, gaia: Set, tmass: Set } con los identificadores normalizados.
export async function identificadoresSimbad() {
  const porHip = new Map();
  for (const [tipo, prefijo] of Object.entries(PREFIJOS)) {
    for (const { hip, alias } of await consulta(prefijo)) {
      const n = Number(hip.replace(/^HIP\s+/, ''));
      if (!porHip.has(n)) porHip.set(n, { hd: new Set(), gj: new Set(), gaia: new Set(), tmass: new Set() });
      const valor = tipo === 'hd' ? alias.replace(/^HD\s+/, '').replace(/\s+/g, '')
        : tipo === 'gaia' ? alias.replace(/^Gaia DR3\s+/, '')
        : tipo === 'tmass' ? alias.replace(/^2MASS J/, '')
        : alias.replace(/^GJ\s+/, '').replace(/\s+/g, '');
      porHip.get(n)[tipo].add(valor);
    }
  }
  return porHip;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t = await identificadoresSimbad();
  const cuenta = tipo => [...t.values()].filter(x => x[tipo].size).length;
  const g = await gaiaDeGj();
  console.log(`SIMBAD: ${g.size} GJ con Gaia DR3`);
  console.log(`SIMBAD: ${t.size} HIP con identificadores; HD ${cuenta('hd')}, GJ ${cuenta('gj')}, Gaia DR3 ${cuenta('gaia')}, 2MASS ${cuenta('tmass')}`);
}
