// scripts/catalog/build_globulares.js
// Miembros de los cúmulos globulares (scripts/catalog/globulares.js) como estrellas añadidas al catálogo, en el formato de
// data/processed/stars_15pc.json, en data/catalog/added_globulares.json. Los aplica catalog_patches.js junto con las
// anfitrionas añadidas; process_gaia.js los saca de la capa de fondo y build_hsb.js los da de alta en el registro.
// Uso: node scripts/catalog/build_globulares.js.
// Número HSB: el que ya tenga como miembro en el registro; si no, el siguiente libre por encima del registro, los lotes y
// las anfitrionas añadidas. Las gigantes más brillantes ya estaban en la capa de 1M con número de lote: ese número queda
// «igual a» el nuevo en data/catalog/hsb_enlaces.csv (lo agrega este script si falta).
import fs from 'node:fs';
import { temperatureToRgb, bvToTemperature, vFromGaia } from './photometry.js';
import { HSB_NUEVO_BASE, REGISTRO_CSV, leerLotes, leerRegistro } from './build_hsb.js';
import { equatorialToCartesian, propagateToJ2000 } from './build_added_hosts.js';
import { ADDED_GLOBULARES_JSON, G_MAX, GLOBULARES, HUNT_MIEMBROS, PROBABILIDAD_MIN, VASILIEV_DIR, leerTsvVizier, profundidadPlummer } from './globulares.js';
import { bvDesdeBpRp } from '../../src/scene/gaiaCapa.js';
import { ENLACES_CSV, leerEnlaces } from './enlaces_registro.js';

const ADDED_HOSTS_JSON = './data/catalog/added_hosts.json';
// Bit 2 de qflag: la estrella pasó los filtros de calidad de Vasiliev & Baumgardt. No se exige: esos filtros sacan a todas
// las gigantes con G < 13 (en NGC 5139, las 896 más brillantes), justo las que se ven. La probabilidad > 0,9 ya es la del
// modelo de pertenencia. Con EXIGIR_CALIDAD = true quedarían solo las de G 13–15.
const EXIGIR_CALIDAD = false, CALIDAD = 2;
const num = v => (v === '' || v === undefined || v === null || v === 'nan' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function numerador() {
  const registro = leerRegistro(fs.existsSync(REGISTRO_CSV) ? fs.readFileSync(REGISTRO_CSV, 'utf8') : '');
  const lotes = leerLotes();
  const anfitrionas = fs.existsSync(ADDED_HOSTS_JSON) ? JSON.parse(fs.readFileSync(ADDED_HOSTS_JSON, 'utf8')).stars : [];
  // Solo se reusa el número de un miembro ya dado de alta como «globular»: los números del registro y de los lotes de la
  // capa no se comparten (hsb.test.js); una fuente de la capa que pasa al catálogo queda «igual a» su número nuevo.
  const porGaia = new Map();
  for (const f of registro) if (f.gaia_dr3 && f.origen === 'globular') porGaia.set(f.gaia_dr3, f.hsb);
  const usados = new Set([...registro.map(f => f.hsb), ...lotes.map(f => f.hsb), ...anfitrionas.map(s => s.i)]);
  let siguiente = HSB_NUEVO_BASE;
  for (const u of usados) if (u >= siguiente) siguiente = u + 1;
  return gaia => {
    if (porGaia.has(gaia)) return porGaia.get(gaia);
    while (usados.has(siguiente)) siguiente++;
    usados.add(siguiente);
    return siguiente++;
  };
}

const numero = numerador();
const estrellas = [], resumen = [];
const radios = {};
// Separación en el cielo (grados) entre dos direcciones.
const separacion = (ra1, de1, ra2, de2) => {
  const r = Math.PI / 180, c = Math.sin(de1 * r) * Math.sin(de2 * r) + Math.cos(de1 * r) * Math.cos(de2 * r) * Math.cos((ra1 - ra2) * r);
  return Math.acos(Math.min(1, c)) / r;
};
for (const cumulo of GLOBULARES) {
  const [ra0, de0] = cumulo.centro;
  const colorHunt = new Map(leerTsvVizier(fs.readFileSync(HUNT_MIEMBROS(cumulo), 'utf8')).map(r => [r.GaiaDR3, num(r['BP-RP'])]));
  const lineas = fs.readFileSync(`${VASILIEV_DIR}/catalogues/${cumulo.vasiliev}`, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  let sinColor = 0, colorDeHunt = 0;
  // 1) Miembros que se dibujan, con su radio proyectado (pc, a la distancia del cúmulo) desde el centro publicado.
  const miembros = [];
  for (const linea of lineas) {
    const f = linea.trim().split(/\s+/);
    const [id, ra, de] = [f[0], Number(f[1]), Number(f[2])];
    const pmra = num(f[6]), pmdec = num(f[7]), g = num(f[12]), qflag = Number(f[15]), prob = Number(f[16]);
    if (!(prob > PROBABILIDAD_MIN) || (EXIGIR_CALIDAD && !(qflag & CALIDAD)) || !(g < G_MAX)) continue;
    let bpRp = num(f[13]);
    if (bpRp === null && colorHunt.get(id) !== undefined && colorHunt.get(id) !== null) { bpRp = colorHunt.get(id); colorDeHunt++; }
    if (bpRp === null) sinColor++;
    const R = cumulo.distanciaPc * Math.tan(separacion(ra, de, ra0, de0) * Math.PI / 180);
    miembros.push({ id, ra, de, pmra, pmdec, g, bpRp, R });
  }
  // 2) Radio proyectado con la mitad de los miembros dibujados: el «a» del perfil de Plummer de la profundidad
  //    (en Plummer, el radio proyectado que encierra la mitad es a) y el radio del encuadre del cúmulo (process_cumulos.js).
  const ordenados = miembros.map(m => m.R).sort((x, y) => x - y);
  const a = ordenados[Math.floor(ordenados.length / 2)];
  radios[cumulo.id] = { r50Pc: Number(a.toFixed(2)), r50Arcmin: Number((Math.atan(a / cumulo.distanciaPc) * 180 / Math.PI * 60).toFixed(2)) };
  for (const { id, ra, de, pmra, pmdec, g, bpRp, R } of miembros) {
    const [raJ, deJ] = propagateToJ2000(ra, de, pmra, pmdec, 2016);
    const d = cumulo.distanciaPc + profundidadPlummer(R, a, id);
    const v = vFromGaia(g, bpRp) ?? g;
    const bv = bpRp === null ? null : bvDesdeBpRp(bpRp);
    const [x, y, z] = equatorialToCartesian(raJ, deJ, d);
    estrellas.push({
      i: numero(id), n: null, x, y, z, d: Number(d.toPrecision(7)), m: Number((v - 5 * Math.log10(d / 10)).toFixed(3)),
      c: bv === null ? 0 : Number(bv.toFixed(3)), sp: null, rgb: bv === null ? [255, 255, 255] : temperatureToRgb(bvToTemperature(bv)),
      dataOrigin: 'globular', gaia: id, cumulo: cumulo.id, ds: cumulo.fuenteDistancia,
      src: { pos: 'Gaia EDR3 (Vasiliev & Baumgardt 2021), propagada a J2000', d: `distancia del cúmulo: ${cumulo.fuenteDistancia}`,
        v: bpRp === null ? 'G de Gaia usada como V (sin color)' : 'G y BP−RP de Gaia (Riello et al. 2021)',
        c: bpRp === null ? 'sin color' : 'B−V desde BP−RP (gaiaCapa.js)' },
      alias: [`Gaia DR3 ${id}`],
    });
  }
  resumen.push(`${cumulo.nombre}: ${miembros.length} miembros (prob > ${PROBABILIDAD_MIN}, G < ${G_MAX}); color de Hunt ${colorDeHunt}, sin color ${sinColor}; radio con la mitad ${a.toFixed(1)} pc`);
}
// Fuentes de la capa (lotes) que ahora son un miembro del catálogo: su número de lote queda «igual a» el del miembro.
const deLote = new Map(leerLotes().filter(f => f.gaia_dr3).map(f => [f.gaia_dr3, f.hsb]));
const yaIguales = new Set(leerEnlaces().filter(f => f.campo === 'igual_a').map(f => Number(f.hsb)));
const nuevasIguales = estrellas.filter(s => deLote.has(s.gaia) && !yaIguales.has(deLote.get(s.gaia)))
  .map(s => `${deLote.get(s.gaia)},igual_a,${s.i},"${GLOBULARES.find(c => c.id === s.cumulo).nombre}: miembro que pasó de la capa al catálogo (build_globulares.js)"`);
if (nuevasIguales.length) fs.appendFileSync(ENLACES_CSV, `${nuevasIguales.join('\n')}\n`);
const salida = JSON.stringify({ meta: { fuente: 'Vasiliev & Baumgardt 2021, MNRAS 505, 5978 (Zenodo 4891252)', radios }, stars: estrellas });
if (!fs.existsSync(ADDED_GLOBULARES_JSON) || fs.readFileSync(ADDED_GLOBULARES_JSON, 'utf8') !== salida) fs.writeFileSync(ADDED_GLOBULARES_JSON, salida);
console.log(`✓ ${resumen.join(' · ')}`);
