// scripts/catalog/build_tipos_revisados.js
// Tipos espectrales que no se pueden mostrar tal cual en la ficha. Solo se juzgan con una distancia que cumple la regla
// (D-014: sin DIST-SIN-MEDIDA ni DIST-CALIDAD en la auditoría).
//  - Gigante que contradice el brillo: subgigante, gigante, supergigante o hipergigante con una magnitud absoluta
//    demasiado débil para esa clase (tipoContradiceBrillo). Se usa el tipo de SIMBAD por su HIP
//    (data/catalog/espectros_simbad.json) si calza; si no, queda solo la letra.
//  - Enana que contradice el brillo: clase V mucho más brillante que una enana (LIMITE_ENANA). Queda solo la letra.
//  - G, K o M sin clase creíble (sin clase de luminosidad, o con solo la letra por lo anterior) que no calza con una
//    enana, porque brilla más o porque no tiene una distancia buena: nombre y texto neutros (NEUTRAS).
//  - Tipos elegidos a mano (TIPOS_CURADOS), que también pasan por la regla de las neutras.
// Escribe public/data/tipos-revisados.json (la ficha lo carga al abrir la primera, src/useTiposRevisados.js): { estrellas: { id: { catalogo, usado, motivo, neutra?, simbad?, fuente? } },
// neutras: [id] } (las G, K o M sin clase de luminosidad que quedan neutras, con su tipo tal cual).
// `usado`: el tipo que muestra la ficha, o null para mostrar solo el color; `neutra`: nombre y texto neutros.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { LIMITE_ENANA, NEUTRAS, claseLuminosidad, tipoContradiceBrillo, tipoEstelar } from '../../src/tipoEstelar.js';

const SALIDA = './public/data/tipos-revisados.json';
// Tipos elegidos a mano cuando el de SIMBAD no coincide con la clasificación mejor respaldada y con el texto de la ficha.
const TIPOS_CURADOS = {
  1296561: { usado: 'B0.5III', fuente: 'Cohen et al. 2008' }, // Mimosa: SIMBAD B1IV
  214331: { usado: 'K3Ib', fuente: 'De Medeiros et al. 2002' }, // Miram: SIMBAD K3-Ib-IIa
  // Dingolay (HD 96063): el único tipo con clase, G6V (Houk & Swift 1999), quedó superado por los análisis del espectro
  // (log g 3,3–3,6; Johnson et al. 2011, Mortier et al. 2013, Jofré et al. 2015). Se usa el del catálogo HD.
  1156214: { usado: 'K0', fuente: 'Cannon & Pickering 1918 (catálogo HD)' },
};
const estrellas = JSON.parse(fs.readFileSync('./data/processed/stars_15pc.json', 'utf8'));
const oficiales = JSON.parse(fs.readFileSync('./data/processed/stellar_official.json', 'utf8'));
const simbad = JSON.parse(fs.readFileSync('./data/catalog/espectros_simbad.json', 'utf8')).hip;
const hipDe = new Map(JSON.parse(fs.readFileSync('./public/data/star-search.json', 'utf8'))
  .map(([i, alias]) => [i, alias.find(a => /^HIP \d+$/.test(a))?.slice(4)]).filter(([, hip]) => hip));
const distanciaDudosa = new Set(zlib.gunzipSync(fs.readFileSync('./data/catalog/hsb_auditoria.csv.gz')).toString('utf8').split('\n')
  .filter(l => /^\d+,[^,]*,DIST-(SIN-MEDIDA|CALIDAD),/.test(l)).map(l => Number(l.split(',')[0])));

const salida = {}, cuenta = {}, neutras = [];
const contar = clave => { cuenta[clave] = (cuenta[clave] || 0) + 1; };
let arregladas = 0;
for (const s of estrellas) {
  const catalogo = s.sp || oficiales[s.i]?.espectro;
  if (!catalogo || !tipoEstelar(catalogo)) continue;
  const buena = !distanciaDudosa.has(s.i) && s.d > 0 && Number.isFinite(s.m);
  const deSimbad = simbad[hipDe.get(s.i)] || null;
  let fila = null;
  if (TIPOS_CURADOS[s.i]) fila = { catalogo, simbad: deSimbad, ...TIPOS_CURADOS[s.i], motivo: 'curado' };
  else if (buena && tipoContradiceBrillo(catalogo, s.m, s.d)) {
    const sirve = deSimbad && deSimbad !== catalogo && tipoEstelar(deSimbad) && !tipoContradiceBrillo(deSimbad, s.m, s.d);
    fila = { catalogo, simbad: deSimbad, usado: sirve ? deSimbad : null, motivo: `${tipoEstelar(catalogo).grupo} débil` };
    if (sirve) arregladas++;
  } else if (buena && claseLuminosidad(catalogo) === 'V' && s.m < LIMITE_ENANA[tipoEstelar(catalogo).clase]) {
    fila = { catalogo, usado: null, motivo: 'enana brillante' };
  }
  // G, K o M sin clase creíble que no calza con una enana: neutra.
  const mostrado = fila ? fila.usado : catalogo;
  const letra = tipoEstelar(catalogo).clase;
  const sinClase = !mostrado || claseLuminosidad(mostrado) === null;
  const letraMostrada = mostrado ? tipoEstelar(mostrado).clase : letra;
  if (sinClase && NEUTRAS[letraMostrada] && !(buena && s.m >= LIMITE_ENANA[letraMostrada])) {
    fila = { ...(fila || { catalogo, usado: catalogo, motivo: 'sin clase' }), neutra: true };
  }
  if (!fila) continue;
  contar(fila.neutra ? `${fila.motivo} → neutra` : fila.motivo);
  // Las «sin clase» neutras, que son la mayoría, van solo como lista de números.
  if (fila.motivo === 'sin clase') { neutras.push(s.i); continue; }
  salida[s.i] = Object.fromEntries(Object.entries(fila).filter(([, v]) => v !== undefined && v !== null));
  salida[s.i].usado = fila.usado ?? null;
}
fs.writeFileSync(SALIDA, JSON.stringify({
  descripcion: 'Tipos espectrales que la ficha no muestra tal cual (build_tipos_revisados.js): «usado» es el tipo que se muestra, o null para solo el color; «neutra», nombre y texto que no dicen si es enana o gigante.',
  estrellas: salida, neutras: neutras.sort((a, b) => a - b) }) + '\n');
console.log(`✓ Tipos revisados: ${Object.keys(salida).length} (${Object.entries(cuenta).map(([g, n]) => `${g} ${n}`).join(', ')}); SIMBAD arregla ${arregladas}`);
