// scripts/catalog/auditoria/enlaces.js
// Propone las correcciones de enlace a partir de las diferencias «Enlace malo» de la auditoría y las agrega a
// data/catalog/hsb_enlaces.csv (hsb, campo, valor, motivo), que build_hsb.js aplica en cada corrida. El archivo
// solo crece: una corrección ya escrita no se reescribe. Campos:
//   gaia_dr3      el Gaia DR3 de la estrella (vacío: se quita el que tenía y queda gaia_revisar = 1)
//   hip, hd       número de Hipparcos o Henry Draper (vacío: se quita)
//   cns5          fila de CNS5 de la estrella (gj_id + componente), para la escalera de distancias
//   igual_a       la estrella es la misma que otra del registro: queda «retirada» y apunta a esa
// Uso: node scripts/catalog/auditoria/enlaces.js            muestra lo que agregaría
//      node scripts/catalog/auditoria/enlaces.js --escribir agrega lo nuevo al archivo
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { identificadoresSimbad } from './simbad.js';
import { leerGaiaRegistro } from '../gaia_local.js';
import { vFromGaia } from '../photometry.js';

import { COLUMNAS_ENLACES, ENLACES_CSV, leerEnlaces } from '../enlaces_registro.js';

const celda = v => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

export async function proponer() {
  const difs = parse(zlib.gunzipSync(fs.readFileSync('data/catalog/hsb_auditoria.csv.gz')).toString('utf8'), { columns: true });
  const registro = new Map(parse(fs.readFileSync('data/catalog/hsb_registro.csv', 'utf8'), { columns: true }).map(r => [Number(r.hsb), r]));
  const stars = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));
  const simbad = await identificadoresSimbad();
  const propuestas = new Map(), sinAplicar = [];
  const poner = (hsb, campo, valor, motivo) => {
    const k = `${hsb}|${campo}`;
    if (!propuestas.has(k)) propuestas.set(k, { hsb, campo, valor, motivo });
  };
  const malos = difs.filter(d => d.veredicto === 'Enlace malo');
  // Gaia propuestos: un mismo Gaia para dos estrellas no se aplica.
  const gaiaPedido = new Map();
  const pedirGaia = (d, id) => { if (!gaiaPedido.has(id)) gaiaPedido.set(id, []); gaiaPedido.get(id).push(d); };
  for (const d of malos) {
    const hsb = Number(d.hsb), r = registro.get(hsb);
    if (d.tipo === 'ID-FALTA' && d.dato === 'Gaia DR3') {
      if (/ya en /.test(d.fuente_propuesta)) { sinAplicar.push({ ...d, porque: 'el Gaia ya es de otra estrella de Hoshi (componente o duplicado): decide Sergio' }); continue; }
      pedirGaia(d, d.valor_propuesto);
    } else if (d.tipo === 'ID-CONFLICTO' && d.dato === 'Gaia DR3 según SIMBAD') {
      if (d.valor_propuesto.includes(' / ')) { sinAplicar.push({ ...d, porque: 'SIMBAD da más de un Gaia para el objeto' }); continue; }
      pedirGaia(d, d.valor_propuesto);
    } else if (d.tipo === 'DIST-SIN-MEDIDA' || d.tipo === 'DIST-CALIDAD') {
      const id = d.fuente_propuesta.match(/Gaia DR3 (\d+)/)?.[1];
      if (id) pedirGaia(d, id); else sinAplicar.push({ ...d, porque: 'sin identificador en la propuesta' });
    } else if (d.tipo === 'ID-FALTA' && d.dato === 'HIP') {
      poner(hsb, 'hip', d.valor_propuesto, `Hipparcos 2007 por posición y brillo (auditoría: ${d.fuente_propuesta})`);
    } else if (d.tipo === 'ID-FALTA' && d.dato === 'CNS5') {
      poner(hsb, 'cns5', d.valor_propuesto, `CNS5 por posición (auditoría: ${d.fuente_propuesta})`);
    } else if (d.tipo === 'ID-CONFLICTO' && d.dato === 'HD según SIMBAD') {
      if (d.valor_propuesto.includes(' / ')) { sinAplicar.push({ ...d, porque: 'SIMBAD da más de un HD para el objeto' }); continue; }
      poner(hsb, 'hd', d.valor_propuesto, `SIMBAD: el HD del objeto de HIP ${r?.hip} (antes ${d.valor_actual})`);
    } else if ((d.tipo === 'MAG/COLOR' && d.dato === 'V (mag)') || (d.tipo === 'POS' && d.dato.includes('Gaia'))) {
      // El Gaia es de otro objeto: se quita (si SIMBAD da el correcto, esa propuesta tiene prioridad).
      poner(hsb, 'gaia_dr3', '', `el Gaia ${r?.gaia_dr3} es de otro objeto (${d.tipo}: ${d.regla})`);
    } else if (d.tipo === 'POS' && d.dato.includes('Hipparcos')) {
      poner(hsb, 'hip', '', `el HIP ${r?.hip} es de otro objeto (a ${d.diferencia_sigma}″)`);
    } else if (d.tipo === 'DUPLICADO' && d.dato === 'HD') {
      // Dos estrellas con el mismo HD: se queda con la que tiene ese HD en SIMBAD (por su HIP).
      const hd = d.valor_actual, mio = r?.hip ? simbad.get(Number(r.hip))?.hd : null;
      const tiene = conjunto => conjunto && [...conjunto].some(x => x.replace(/[A-Z]$/, '') === hd);
      // La otra estrella con ese HD: si SIMBAD le da ese HD a ella (por su HIP), esta lo pierde.
      const otro = registro.get(Number(d.valor_propuesto.match(/HSB (\d+)/)?.[1]));
      const suyo = otro?.hip ? simbad.get(Number(otro.hip))?.hd : null;
      if (mio && mio.size && !tiene(mio)) poner(hsb, 'hd', '', `HD ${hd} es de otra estrella según SIMBAD (el objeto de HIP ${r.hip} es HD ${[...mio].join('/')})`);
      else if ((!mio || !mio.size) && tiene(suyo)) poner(hsb, 'hd', '', `HD ${hd} es de HIP ${otro.hip} según SIMBAD`);
      else if (!tiene(mio)) sinAplicar.push({ ...d, porque: 'SIMBAD no da ese HD a ninguna de las dos' });
    } else if (d.tipo === 'DUPLICADO' && d.dato === 'GJ/Gl') {
      // El mismo nombre GJ (con componente) en dos estrellas: se conserva la de menor número si son la misma estrella
      // (≤ 5″ y ΔV ≤ 0,5); si no, no se toca.
      const otro = Number(d.valor_propuesto.match(/HSB (\d+)/)?.[1]);
      const a = stars.get(hsb), b = stars.get(otro);
      if (!a || !b) { sinAplicar.push({ ...d, porque: 'una de las dos no está en el catálogo' }); continue; }
      const sep = Math.acos(Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)))) * 206264.8;
      const va = a.m + 5 * Math.log10(a.d / 10), vb = b.m + 5 * Math.log10(b.d / 10);
      if (sep <= 5 && Math.abs(va - vb) <= 0.5) { if (hsb > otro) poner(hsb, 'igual_a', otro, `misma estrella que HSB ${otro} (${d.valor_actual}, a ${sep.toFixed(2)}″, ΔV ${(va - vb).toFixed(2)})`); }
      else sinAplicar.push({ ...d, porque: `mismo nombre GJ pero a ${sep.toFixed(1)}″ y ΔV ${(va - vb).toFixed(2)}: pueden ser componentes; decide Sergio` });
    } else {
      sinAplicar.push({ ...d, porque: 'sin regla automática' });
    }
  }
  // Gaia ya bajados (registro y correcciones): un Gaia que no calza en brillo con la estrella (> 1,5 mag) es de otra
  // componente y no se enlaza.
  const gaiaLocal = await leerGaiaRegistro().catch(() => new Map());
  for (const [id, lista] of gaiaPedido) {
    const estrellas = new Set(lista.map(d => d.hsb));
    if (estrellas.size > 1) { for (const d of lista) sinAplicar.push({ ...d, porque: `el mismo Gaia ${id} se propone para ${estrellas.size} estrellas` }); continue; }
    const d = lista[0], s = stars.get(Number(d.hsb)), g = gaiaLocal.get(id);
    const vg = g ? vFromGaia(Number(g.phot_g_mean_mag), g.bp_rp === '' ? NaN : Number(g.bp_rp)) : null;
    if (s && vg !== null && Math.abs(vg - (s.m + 5 * Math.log10(s.d / 10))) > 1.5) { sinAplicar.push({ ...d, porque: `el Gaia ${id} no calza en brillo con la estrella: es de otra componente` }); continue; }
    propuestas.delete(`${d.hsb}|gaia_dr3`);
    poner(Number(d.hsb), 'gaia_dr3', id, `${d.tipo}: ${d.fuente_propuesta.replace(/; paralaje.*$/, '')}`);
  }
  // Números de lote cuyo Gaia ya es de una estrella del registro (por una corrección de enlace): quedan como «iguales a»
  // esa estrella. Los lotes no se reescriben; la relación queda aquí.
  const deRegistro = new Map([...registro.values()].filter(r => r.estado === 'activa' && r.gaia_dr3).map(r => [r.gaia_dr3, Number(r.hsb)]));
  for (const nombre of fs.readdirSync('data/catalog/hsb_gaia').filter(f => f.endsWith('.csv.gz')).sort()) {
    for (const l of parse(zlib.gunzipSync(fs.readFileSync(`data/catalog/hsb_gaia/${nombre}`)).toString('utf8'), { columns: true })) {
      const h = deRegistro.get(l.gaia_dr3);
      if (h !== undefined) poner(Number(l.hsb), 'igual_a', h, `el Gaia ${l.gaia_dr3} del ${nombre.replace('.csv.gz', '')} es el de HSB ${h} (corrección de enlace)`);
    }
  }
  return { propuestas: [...propuestas.values()].sort((a, b) => a.hsb - b.hsb || (a.campo < b.campo ? -1 : 1)), sinAplicar };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { propuestas, sinAplicar } = await proponer();
  const existentes = leerEnlaces();
  const ya = new Set(existentes.map(f => `${f.hsb}|${f.campo}`));
  const nuevas = propuestas.filter(p => !ya.has(`${p.hsb}|${p.campo}`));
  const cuenta = l => l.reduce((o, x) => ({ ...o, [x.campo ?? x.tipo]: (o[x.campo ?? x.tipo] || 0) + 1 }), {});
  console.log(`Correcciones nuevas: ${nuevas.length} ${JSON.stringify(cuenta(nuevas))}; sin aplicar: ${sinAplicar.length}`);
  const motivos = {};
  for (const s of sinAplicar) motivos[s.porque.replace(/\d+/g, 'N')] = (motivos[s.porque.replace(/\d+/g, 'N')] || 0) + 1;
  console.log(JSON.stringify(motivos, null, 1));
  if (process.argv.includes('--escribir')) {
    // Se agrega al final, sin reordenar: una fila posterior manda sobre una anterior del mismo dato, y el orden fija los
    // lotes de la descarga de Gaia (gaia_local.js).
    const todas = [...existentes, ...nuevas];
    fs.writeFileSync(ENLACES_CSV, [COLUMNAS_ENLACES.join(','), ...todas.map(f => COLUMNAS_ENLACES.map(c => celda(f[c])).join(','))].join('\n') + '\n');
    console.log(`✓ ${ENLACES_CSV}: ${todas.length} correcciones`);
  }
}
