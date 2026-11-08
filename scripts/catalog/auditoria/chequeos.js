// scripts/catalog/auditoria/chequeos.js
// Matriz de identidad (una fila por estrella y fuente) y chequeos de la auditoría. Cada diferencia sale con un
// tipo, la regla que la decide y uno de cuatro veredictos:
//   «Corregir»       hay una medida directa mejor que la que se usa;
//   «Decide Sergio»  dos medidas buenas y de precisión parecida que no calzan, un cambio > 20 % en una estrella con
//                    nombre, o una decisión de criterio sobre un grupo entero;
//   «Es real»        la diferencia tiene una causa física o conocida (binaria, variable, saturación, par óptico, el
//                    error de la otra fuente): se anota y no se cambia nada;
//   «Enlace malo»    el cruce entre catálogos está mal o falta: se arregla en la identidad y se vuelve a comparar.
import { vFromGaia } from '../photometry.js';
import { filaCns5 } from '../fusion.js';
import { Cielo, aJ2000, num, separacion } from './fuentes.js';
import { rangoMv } from './magnitudes.js';

export const UMBRAL = {
  posicionArcsec: 1,          // posición: > 1″ a la misma época
  redondeoArcsec: 0.05,       // x, y, z se guardan con 7 cifras: la posición recalculada puede moverse unas centésimas de ″
  posicionLejosArcsec: 10,    // más allá, solo es error de época si lo explica el movimiento propio
  epocaAnos: 30,              // años de movimiento propio que puede explicar una época mal puesta
  enlaceArcsec: 3,            // búsqueda de pareja por posición
  ambiguoArcsec: 2,           // dos candidatas a menos de esto: ambigua, no se adivina
  enlaceMag: 1,               // diferencia de brillo admitida en un enlace por posición
  distSigma: 3, distRel: 0.1, // distancia: > 3σ combinados y > 10 %
  escaleraRel: 0.05,          // Gaia con RUWE alto frente a la siguiente medida: solo si difieren > 3σ y > 5 %
  errorBueno: 0.05,           // «medida buena» (error ≤ 5 %)
  precisionParecida: 3,       // dos medidas son comparables si sus errores difieren menos de 3 veces
  magV: 0.5, magVRoja: 1.0,   // V frente a la V predicha desde Gaia (BP−RP > 2,5: la conversión dispersa más)
  colorBV: 0.3,               // B−V de Hoshi frente al de Hipparcos
  pmMasAno: 10,               // movimiento propio Gaia frente a Hipparcos
  fisica: 0.15,               // temperatura y radio: > 15 % y > 3σ
  cambioNombrada: 0.2,        // cambio > 20 % en una estrella con nombre: decide Sergio
  duplicadoArcsec: 2, duplicadoMag: 0.5,
  gSatura: 4, ruweMax: 1.4, errorMax: 0.1,
  esperaGaiaV: [4.5, 20], esperaHipV: 8, esperaCns5Pc: 25, esperaGcnsPlx: 10,
};
export const VEREDICTOS = ['Corregir', 'Decide Sergio', 'Es real', 'Enlace malo'];

const BIBCODES_GAIA = ['2018yCat.1345....0G', '2020yCat.1350....0G', '2018A&A...616A...1G', '2021A&A...649A...1G'];
const BV_TOPE = 2.16; // último valor de la tabla de bvDesdeBpRp (src/scene/gaiaCapa.js)
const glPartes = gl => { const m = String(gl || '').match(/^(?:[A-Za-z]+\s*)?(\d+(?:\.\d+)?)\s*([A-Za-z]*)$/); return m ? { numero: m[1], comp: m[2] } : null; };
const r3 = v => (v === null || v === undefined || !Number.isFinite(v) ? '' : Number(v.toPrecision(6)));
const tmassNorm = t => String(t || '').replace(/^2MASS\s*J?/, '').replace(/"/g, '');

// Rango aproximado de B−V por clase espectral (sin extinción); lejos se admite más rojo.
const BV_CLASE = { O: [-0.45, 0.1], B: [-0.4, 0.35], A: [-0.15, 0.5], F: [0.2, 0.8], G: [0.45, 1.25], K: [0.7, 1.9], M: [1.1, 2.4] };

export function auditar(D, { simbadHip, simbadGj, separaciones }) {
  const identidad = [], difs = [];
  const nombreDe = s => s.n || D.registro.get(s.i)?.nombre || D.registro.get(s.i)?.gl || (D.registro.get(s.i)?.hip ? `HIP ${D.registro.get(s.i).hip}` : '')
    || (D.registro.get(s.i)?.hd ? `HD ${D.registro.get(s.i).hd}` : '') || `HSB ${s.i}`;
  const conNombre = s => Boolean(s.n);
  const dif = (s, tipo, dato, o) => difs.push({ hsb: s.i, nombre: s.nombre ?? nombreDe(s), con_nombre: conNombre(s) ? 1 : 0, tipo, dato, valor_actual: '', fuente_actual: '',
    valor_propuesto: '', fuente_propuesta: '', diferencia_sigma: '', regla: '', veredicto: '', ...o });
  const ident = (s, fuente, o) => identidad.push({ hsb: s.i, fuente, id: '', metodo: '', sep_arcsec: '', dmag: '', confianza: '', motivo: '', ...o });

  // Sistemas que Hoshi dibuja: estrella → { clave del sistema, wds, rol }.
  const enSistema = new Map();
  for (const [clave, sis] of Object.entries(D.sistemas)) {
    enSistema.set(Number(clave), { sistema: Number(clave), wds: sis.wds, rol: 'primaria' });
    for (const c of sis.comps) if (c.cid !== undefined) enSistema.set(c.cid, { sistema: Number(clave), wds: sis.wds, rol: `componente ${c.n}` });
  }
  const sistemaDe = s => enSistema.get(s.i)?.sistema ?? (D.registro.get(s.i)?.primaria_hsb ? Number(D.registro.get(s.i).primaria_hsb) : s.i);
  const anfitriona = new Map(D.exo.filter(e => e.i !== null && e.i !== undefined).map(e => [e.i, e]));
  const fuentesCuradas = new Set([...D.curadas.values()].map(c => c.fuente));

  // ---------- Identificadores repetidos dentro del catálogo ----------
  const usos = { hip: new Map(), hd: new Map(), gl: new Map(), gaia: new Map(), tmass: new Map() };
  for (const s of D.estrellas) {
    const r = D.registro.get(s.i);
    if (!r) continue;
    for (const [campo, valor] of [['hip', r.hip], ['hd', r.hd], ['gl', r.gl], ['gaia', r.gaia_dr3], ['tmass', r.tmass]]) {
      if (!valor) continue;
      if (!usos[campo].has(valor)) usos[campo].set(valor, []);
      usos[campo].get(valor).push(s);
    }
  }
  const rotulo = { hip: 'HIP', hd: 'HD', gl: 'GJ/Gl', gaia: 'Gaia DR3', tmass: '2MASS' };
  for (const [campo, mapa] of Object.entries(usos)) {
    for (const [valor, lista] of mapa) {
      if (lista.length < 2) continue;
      // Componentes de un mismo sistema (mismo número GJ con letras distintas, o compañeras del sistema dibujado) con
      // un solo HD, HIP o 2MASS: el catálogo viejo no las separa. Lo demás es la misma estrella dos veces o un mal cruce.
      const mismosGl = new Set(lista.map(x => glPartes(D.registro.get(x.i)?.gl)?.numero).filter(Boolean));
      const componentes = (mismosGl.size === 1 && lista.every(x => glPartes(D.registro.get(x.i)?.gl)?.comp)) || new Set(lista.map(sistemaDe)).size === 1;
      // Un 2MASS compartido por dos fuentes de Gaia distintas es real: 2MASS no separa pares que Gaia sí.
      const real = campo === 'tmass' || (campo !== 'gaia' && campo !== 'gl' && componentes);
      for (const s of lista) {
        const otros = lista.filter(x => x !== s).map(x => `${nombreDe(x)} (HSB ${x.i})`).join('; ');
        dif(s, real ? 'ID-CONFLICTO' : 'DUPLICADO', rotulo[campo], { valor_actual: valor, fuente_actual: 'registro HSB', valor_propuesto: `también en ${otros}`,
          regla: campo === 'tmass' ? '2MASS no separa las dos fuentes de Gaia: comparten su vecino oficial' : real ? 'componentes del mismo sistema con un identificador común (la fuente no las separa)' : 'el mismo identificador en dos estrellas: la misma estrella dos veces o un mal cruce',
          veredicto: real ? 'Es real' : 'Enlace malo' });
      }
    }
  }

  // ---------- Duplicados por posición dentro del catálogo ----------
  const cieloHoshi = new Cielo();
  for (const s of D.estrellas) if (s.d > 0 && s.i !== 0) cieloHoshi.agregar({ id: s.i, s, j2000: { ra: s.ra, dec: s.dec } });
  for (const s of D.estrellas) {
    if (!(s.d > 0) || s.i === 0 || s.V === null) continue;
    for (const { o, sep } of cieloHoshi.cerca({ ra: s.ra, dec: s.dec }, UMBRAL.duplicadoArcsec)) {
      const q = o.s;
      if (q.i <= s.i || q.V === null || Math.abs(q.V - s.V) > UMBRAL.duplicadoMag || Math.abs(q.d - s.d) / s.d > UMBRAL.distRel) continue;
      const a = glPartes(D.registro.get(s.i)?.gl), b = glPartes(D.registro.get(q.i)?.gl);
      const componentes = a && b && a.numero === b.numero && a.comp !== b.comp;
      // Dos fuentes distintas de Gaia, cada una con su posición: es un par cerrado medido, no un duplicado.
      const gs = D.registro.get(s.i)?.gaia_dr3, gq = D.registro.get(q.i)?.gaia_dr3;
      const medidas = gs && gq && gs !== gq && !D.registro.get(s.i)?.gaia_revisar && !D.registro.get(q.i)?.gaia_revisar;
      if (medidas) continue;
      for (const [x, y] of [[s, q], [q, s]]) dif(x, 'DUPLICADO', 'posición y brillo', { valor_actual: `${x.V.toFixed(2)} mag a ${r3(x.d)} pc`, fuente_actual: 'Hoshi',
        valor_propuesto: `${nombreDe(y)} (HSB ${y.i}) a ${sep.toFixed(2)}″, ${y.V.toFixed(2)} mag, ${r3(y.d)} pc`, fuente_propuesta: 'Hoshi', diferencia_sigma: r3(sep),
        regla: componentes ? 'componentes del mismo par GJ en la misma posición: la compañera debería ir a su separación' : 'misma posición, brillo y distancia: la misma estrella dos veces',
        veredicto: componentes ? 'Corregir' : 'Decide Sergio' });
    }
  }

  // ---------- Estrella por estrella ----------
  for (const s of D.estrellas) {
    if (s.n === 'Sol' || s.n === 'Sun' || s.i === 0) continue;
    const r = D.registro.get(s.i) || {};
    const at = D.athyg.get(s.i);
    const f = D.fuentesD.get(s.i) || {};
    const pos = { ra: s.ra, dec: s.dec };
    const V = s.V;
    const doble = enSistema.has(s.i);
    // Paralajes de fuentes que faltan enlazar (Gaia por posición o por SIMBAD, CNS5 por posición).
    const candidatas = [];

    // Gaia DR3
    let g = r.gaia_dr3 ? D.gaia.get(r.gaia_dr3) || D.gcns.get(r.gaia_dr3) || D.gaia1m.get(r.gaia_dr3) : null;
    const vg = g ? vFromGaia(g.G, g.bpRp) : null;
    let sepGaia = null;
    if (r.gaia_dr3) {
      sepGaia = g?.j2000 ? Math.min(separacion(pos, g.j2000), separacion(pos, g.nativa)) : null;
      const dm = vg !== null && V !== null ? vg - V : null;
      const conf = !g ? 'dudosa' : (sepGaia === null || sepGaia <= 1) && (dm === null || Math.abs(dm) <= 0.5) ? 'segura'
        : (sepGaia === null || sepGaia <= 3) && (dm === null || Math.abs(dm) <= 1) ? 'probable' : 'dudosa';
      ident(s, 'Gaia DR3', { id: r.gaia_dr3, metodo: 'numero', sep_arcsec: r3(sepGaia), dmag: r3(dm), confianza: conf, motivo: g ? '' : 'el número no está en los archivos locales de Gaia' });
    } else if ((V !== null && V >= UMBRAL.esperaGaiaV[0] && V <= UMBRAL.esperaGaiaV[1]) || r.gaia_revisar) {
      const cand = [...D.cieloGcns.cerca(pos, UMBRAL.enlaceArcsec), ...D.cielo1m.cerca(pos, UMBRAL.enlaceArcsec)]
        .filter((c, k, a) => a.findIndex(x => x.o.id === c.o.id) === k)
        .map(c => ({ ...c, dm: vFromGaia(c.o.G, c.o.bpRp) !== null && V !== null ? vFromGaia(c.o.G, c.o.bpRp) - V : null }))
        .filter(c => c.dm === null || Math.abs(c.dm) <= UMBRAL.enlaceMag);
      const ambigua = cand.filter(c => c.sep <= UMBRAL.ambiguoArcsec).length > 1;
      const c = cand[0];
      const motivo = r.gaia_revisar ? 'Gaia en duda (gaia_revisar)' : c ? (ambigua ? 'ambigua: dos fuentes a < 2″' : 'candidata por posición y brillo sin enlazar')
        : (V !== null && V < UMBRAL.esperaGaiaV[0] ? 'demasiado brillante para Gaia' : 'sin fuente de Gaia DR3 a ≤ 3″ en GCNS ni en el millón (los archivos locales no cubren todo Gaia)');
      ident(s, 'Gaia DR3', { id: c?.o.id ?? '', metodo: c ? 'posicion' : '', sep_arcsec: r3(c?.sep), dmag: r3(c?.dm), confianza: c ? (ambigua || c.sep > 1 || Math.abs(c.dm ?? 0) > 0.5 ? 'dudosa' : 'probable') : '', motivo: `sin enlace: ${motivo}` });
      if (c && !ambigua && !r.gaia_revisar && c.sep <= 1 && Math.abs(c.dm ?? 0) <= 0.5) {
        candidatas.push({ fuente: `Gaia DR3 ${c.o.id} (por posición)`, plx: c.o.plx, err: c.o.err, G: c.o.G, ruwe: c.o.ruwe });
        dif(s, 'ID-FALTA', 'Gaia DR3', { valor_propuesto: c.o.id, fuente_propuesta: `${D.gcns.has(c.o.id) ? 'GCNS' : 'Gaia DR3 (millón)'} por posición (${c.sep.toFixed(2)}″, ΔV ${c.dm?.toFixed(2) ?? '?'}); paralaje ${c.o.plx?.toFixed(3)} ± ${c.o.err?.toFixed(3)} mas`,
          regla: 'pareja única por posición y brillo', veredicto: 'Enlace malo' });
      }
    }

    // Hipparcos
    const h = r.hip ? D.hip.get(Number(r.hip)) : null;
    // Gaia sin movimiento propio (2 parámetros): a J2000 con el de Hipparcos o, sin él, el de AT-HYG, como fusion.js.
    const pmReserva = h && h.pmra !== null ? [h.pmra, h.pmdec] : at && at.pmra !== '' && at.pmdec !== '' ? [Number(at.pmra), Number(at.pmdec)] : null;
    if (g?.nativa && g.pmra === null && pmReserva) {
      g = { ...g, pmra: pmReserva[0], pmdec: pmReserva[1], j2000: aJ2000(g.nativa.ra, g.nativa.dec, pmReserva[0], pmReserva[1], 2016) };
      sepGaia = Math.min(separacion(pos, g.j2000), separacion(pos, g.nativa));
    }
    const hBv = h && h.bv !== null && !(h.bv === 0) ? h.bv : null; // B−V = 0 en Hipparcos 2007 es «sin dato»
    if (r.hip) {
      const sep = h ? Math.min(separacion(pos, h.j2000), separacion(pos, h.nativa)) : null;
      const dm = h && V !== null && h.Hp !== null ? h.Hp - V : null;
      const conf = !h ? 'dudosa' : (sep <= 1 && (dm === null || Math.abs(dm) <= 0.7)) ? 'segura' : (sep <= 3 && (dm === null || Math.abs(dm) <= 1.2)) ? 'probable' : 'dudosa';
      ident(s, 'Hipparcos 2007', { id: r.hip, metodo: 'numero', sep_arcsec: r3(sep), dmag: r3(dm), confianza: conf, motivo: h ? '' : 'el HIP no está en Hipparcos 2007 (van Leeuwen)' });
    } else if (V !== null && V <= UMBRAL.esperaHipV) {
      const cand = D.cieloHip.cerca(pos, UMBRAL.enlaceArcsec).map(c => ({ ...c, dm: c.o.Hp - V })).filter(c => Math.abs(c.dm) <= UMBRAL.enlaceMag + 0.2);
      const c = cand[0], otra = c ? (usos.hip.get(String(c.o.id)) || [])[0] : null;
      const motivo = c ? (otra ? `el HIP ${c.o.id} está en ${nombreDe(otra)} (componente sin resolver en Hipparcos)` : 'candidata por posición y brillo sin enlazar') : 'sin estrella de Hipparcos a ≤ 3″';
      ident(s, 'Hipparcos 2007', { id: c?.o.id ?? '', metodo: c ? 'posicion' : '', sep_arcsec: r3(c?.sep), dmag: r3(c?.dm), confianza: c ? (c.sep <= 1 ? 'probable' : 'dudosa') : '', motivo: `sin enlace: ${motivo}` });
      if (c && !otra && c.sep <= 1) dif(s, 'ID-FALTA', 'HIP', { valor_propuesto: c.o.id, fuente_propuesta: `Hipparcos 2007 por posición (${c.sep.toFixed(2)}″, Hp − V ${c.dm.toFixed(2)})`, regla: 'pareja única por posición y brillo', veredicto: 'Enlace malo' });
    }

    // CNS5
    const c5 = filaCns5(r, D.cns5, s);
    if (c5) {
      const sep = c5.j2000 ? Math.min(separacion(pos, c5.j2000), separacion(pos, c5.nativa)) : null;
      ident(s, 'CNS5', { id: `${c5.gj_id}${c5.component_id}`, metodo: r.gaia_dr3 && c5.gaia_edr3_id === r.gaia_dr3 ? 'numero' : 'nombre', sep_arcsec: r3(sep), confianza: sep !== null && sep > 10 ? 'probable' : 'segura',
        motivo: c5.component_id.length > 1 ? 'fila del sistema completo' : '' });
    } else if (s.d > 0 && s.d < UMBRAL.esperaCns5Pc) {
      const c = D.cieloCns5.cerca(pos, UMBRAL.enlaceArcsec)[0];
      ident(s, 'CNS5', { id: c ? `${c.o.gj_id}${c.o.component_id}` : '', metodo: c ? 'posicion' : '', sep_arcsec: r3(c?.sep), confianza: c ? 'probable' : '',
        motivo: `sin enlace: ${r.gaia_revisar ? 'Gaia en duda (gaia_revisar)' : c ? 'candidata por posición sin enlazar' : 'sin fila de CNS5 a ≤ 3″ ni por nombre (puede estar más lejos de 25 pc según CNS5)'}` });
      if (c && c.sep <= 1 && !r.gaia_revisar) candidatas.push({ fuente: `CNS5 ${c.o.gj_id}${c.o.component_id} (${c.o.parallax_bibcode})`, plx: num(c.o.parallax), err: num(c.o.parallax_error) });
      if (c && c.sep <= 1 && !r.gaia_revisar) dif(s, 'ID-FALTA', 'CNS5', { valor_propuesto: `${c.o.gj_id}${c.o.component_id}`, fuente_propuesta: `CNS5 por posición (${c.sep.toFixed(2)}″; paralaje ${c.o.parallax} ± ${c.o.parallax_error} mas)`, regla: 'pareja única por posición', veredicto: 'Enlace malo' });
    }

    // GCNS
    const gc = r.gaia_dr3 ? D.gcns.get(r.gaia_dr3) : null;
    if (gc) ident(s, 'GCNS', { id: gc.id, metodo: 'numero', confianza: 'segura' });
    else if (g && g.plx > UMBRAL.esperaGcnsPlx && g.err > 0 && g.plx / g.err >= 10) ident(s, 'GCNS', { motivo: 'sin enlace: su Gaia no está en GCNS (corte de probabilidad de GCNS)' });

    // WDS
    const sis = enSistema.get(s.i);
    if (sis) ident(s, 'WDS', { id: sis.wds, metodo: 'numero', confianza: 'segura', motivo: sis.rol });
    else if (glPartes(r.gl)?.comp) ident(s, 'WDS', { motivo: 'sin enlace: componente GJ con letra que no está en ningún sistema dibujado' });

    // 2MASS
    const tm = r.gaia_dr3 ? D.tmass.get(r.gaia_dr3) : null;
    if (r.tmass || tm) {
      ident(s, '2MASS', { id: r.tmass || tm, metodo: r.tmass ? 'numero' : 'Gaia (tabla de vecinos)', confianza: 'segura' });
      if (r.tmass && tm && tmassNorm(r.tmass) !== tmassNorm(tm)) dif(s, 'ID-CONFLICTO', '2MASS', { valor_actual: r.tmass, fuente_actual: 'registro HSB', valor_propuesto: tm, fuente_propuesta: 'tabla de vecinos Gaia DR3–2MASS', regla: 'el 2MASS del registro debe ser el vecino oficial de su Gaia', veredicto: 'Enlace malo' });
    }

    // SIMBAD
    const sim = r.hip ? simbadHip.get(Number(r.hip)) : null;
    if (sim) {
      ident(s, 'SIMBAD', { id: `HIP ${r.hip}`, metodo: 'numero', confianza: 'segura' });
      const comparar = (dato, actual, conjunto) => {
        if (!actual || !conjunto.size || conjunto.has(actual)) return;
        dif(s, 'ID-CONFLICTO', `${dato} según SIMBAD`, { valor_actual: actual, fuente_actual: 'registro HSB', valor_propuesto: [...conjunto].join(' / '), fuente_propuesta: `SIMBAD (objeto de HIP ${r.hip})`,
          regla: doble ? 'sistema múltiple: SIMBAD puede dar el identificador a otra componente' : 'los identificadores de una estrella deben ser del mismo objeto en SIMBAD', veredicto: doble ? 'Decide Sergio' : 'Enlace malo' });
      };
      comparar('HD', r.hd ? r.hd.replace(/\s+/g, '') : '', new Set([...sim.hd, ...[...sim.hd].map(x => x.replace(/[A-Z]$/, ''))]));
      const gp = glPartes(r.gl);
      if (gp && sim.gj.size && ![...sim.gj].some(x => x.replace(/[A-Z]+$/, '') === gp.numero)) comparar('GJ', gp.numero + gp.comp, sim.gj);
      comparar('Gaia DR3', r.gaia_dr3, sim.gaia);
      // El 2MASS del registro es el vecino oficial de su Gaia: si SIMBAD lo da a otra componente, es real.
      if (r.tmass && !(tm && tmassNorm(tm) === tmassNorm(r.tmass))) comparar('2MASS', tmassNorm(r.tmass), new Set([...sim.tmass].map(tmassNorm)));
      if (!r.gaia_dr3 && sim.gaia.size === 1 && !r.gaia_revisar) {
        const id = [...sim.gaia][0], gx = D.gaia.get(id) || D.gcns.get(id) || D.gaia1m.get(id), otra = usos.gaia.get(id)?.[0];
        if (gx && !otra) candidatas.push({ fuente: `Gaia DR3 ${id} (SIMBAD)`, plx: gx.plx, err: gx.err, G: gx.G, ruwe: gx.ruwe });
        dif(s, 'ID-FALTA', 'Gaia DR3', { valor_propuesto: id, fuente_propuesta: `SIMBAD (HIP ${r.hip})${gx ? `; paralaje ${gx.plx?.toFixed(3)} ± ${gx.err?.toFixed(3)} mas` : '; sin datos locales'}${otra ? `; ya en ${nombreDe(otra)}` : ''}`,
          regla: otra ? 'SIMBAD da un Gaia que Hoshi tiene en otra estrella' : 'SIMBAD da el Gaia DR3 del mismo objeto', veredicto: 'Enlace malo' });
      }
    } else if (!r.hip && glPartes(r.gl) && !r.gaia_dr3 && !r.gaia_revisar) {
      const gp = glPartes(r.gl), ids = simbadGj.get(gp.numero + gp.comp) || (!gp.comp ? simbadGj.get(gp.numero) : null);
      if (ids && ids.size === 1) {
        const id = [...ids][0], gx = D.gaia.get(id) || D.gcns.get(id) || D.gaia1m.get(id), otra = usos.gaia.get(id)?.[0];
        if (gx && !otra) candidatas.push({ fuente: `Gaia DR3 ${id} (SIMBAD)`, plx: gx.plx, err: gx.err, G: gx.G, ruwe: gx.ruwe });
        dif(s, 'ID-FALTA', 'Gaia DR3', { valor_propuesto: id, fuente_propuesta: `SIMBAD (${r.gl})${gx ? `; paralaje ${gx.plx?.toFixed(3)} ± ${gx.err?.toFixed(3)} mas` : '; sin datos locales'}${otra ? `; ya en ${nombreDe(otra)}` : ''}`,
          regla: otra ? 'SIMBAD da un Gaia que Hoshi tiene en otra estrella' : 'SIMBAD da el Gaia DR3 del mismo objeto', veredicto: 'Enlace malo' });
      }
    }

    // NASA Exoplanet Archive
    const ex = anfitriona.get(s.i);
    if (ex) {
      ident(s, 'NASA Exoplanet Archive', { id: ex.h, metodo: ex.mm || '', sep_arcsec: r3(ex.sep), confianza: String(ex.mm).startsWith('posicion') ? 'probable' : 'segura' });
      const gNasa = /^Gaia DR3/.test(ex.ids?.gaia || '') ? ex.ids.gaia.replace(/^Gaia DR3\s+/, '') : null;
      const hNasa = ex.ids?.hip ? ex.ids.hip.replace(/^HIP\s+/, '').replace(/\s*[A-Z]+$/, '') : null;
      // Si SIMBAD confirma el Gaia de Hoshi para su HIP, NASA nombra a otra componente del sistema.
      const confirmado = r.hip && simbadHip.get(Number(r.hip))?.gaia.has(r.gaia_dr3);
      if (gNasa && r.gaia_dr3 && gNasa !== r.gaia_dr3) dif(s, 'NASA', 'Gaia DR3', { valor_actual: r.gaia_dr3, fuente_actual: 'registro HSB', valor_propuesto: gNasa, fuente_propuesta: `NASA (${ex.h})`,
        regla: confirmado ? 'SIMBAD confirma el Gaia de Hoshi: NASA usa el de otra componente del sistema' : 'la anfitriona debe ser el mismo objeto', veredicto: confirmado ? 'Es real' : 'Enlace malo' });
      if (hNasa && r.hip && hNasa !== r.hip) dif(s, 'NASA', 'HIP', { valor_actual: r.hip, fuente_actual: 'registro HSB', valor_propuesto: hNasa, fuente_propuesta: `NASA (${ex.h})`, regla: 'la anfitriona debe ser el mismo objeto', veredicto: 'Enlace malo' });
      const ps = D.nasaPs.get(ex.h);
      if (ex.dNasa > 0 && s.d > 0 && Math.abs(ex.dNasa - s.d) / s.d > UMBRAL.distRel) {
        const propia = ps?.plx > 0 ? 1000 / ps.plx : null;
        const nasaIncoherente = propia && Math.abs(propia - ex.dNasa) / ex.dNasa > 0.05;
        const nasaCalzaHoshi = propia && Math.abs(propia - s.d) / s.d < UMBRAL.distRel;
        dif(s, 'NASA', 'distancia', { valor_actual: r3(s.d), fuente_actual: f.fuente_d || '', valor_propuesto: r3(ex.dNasa), fuente_propuesta: `NASA sy_dist (${ex.h})${propia ? `; su paralaje ${ps.plx} mas da ${r3(propia)} pc` : ''}`,
          regla: nasaIncoherente && nasaCalzaHoshi ? 'la distancia de NASA no calza con su propia paralaje, que sí calza con Hoshi: el error es de NASA' : 'Hoshi usa una paralaje medida con la escalera; NASA usa otra',
          veredicto: nasaIncoherente && nasaCalzaHoshi ? 'Es real' : conNombre(s) && Math.abs(ex.dNasa - s.d) / s.d > UMBRAL.cambioNombrada ? 'Decide Sergio' : 'Es real' });
      }
      const of = D.oficiales[String(s.i)];
      if (ex.st?.teff && of?.temperatureK) {
        const t1 = ex.st.teff, t2 = of.temperatureK, e = Math.max(ex.st.teffE || 0, 0.02 * t1);
        if (Math.abs(t1 - t2) / t2 > UMBRAL.fisica && Math.abs(t1 - t2) > 3 * e) dif(s, 'NASA', 'temperatura (K)', { valor_actual: t2, fuente_actual: of.fuentes?.temperatureK || 'ficha oficial', valor_propuesto: t1, fuente_propuesta: `NASA (${ex.h})`, regla: '> 15 % y > 3σ entre dos mediciones publicadas', veredicto: 'Decide Sergio' });
      }
      if (ex.st?.r && of?.radiusSolar) {
        const r1 = ex.st.r, r2 = of.radiusSolar, e = Math.max(ex.st.rE || 0, 0.03 * r1);
        if (Math.abs(r1 - r2) / r2 > UMBRAL.fisica && Math.abs(r1 - r2) > 3 * e) dif(s, 'NASA', 'radio (R☉)', { valor_actual: r3(r2), fuente_actual: of.fuentes?.radiusSolar || 'ficha oficial', valor_propuesto: r3(r1), fuente_propuesta: `NASA (${ex.h})`, regla: '> 15 % y > 3σ entre dos mediciones publicadas', veredicto: 'Decide Sergio' });
      }
    }

    // Posición
    const pm = g && g.pmra !== null ? Math.hypot(g.pmra, g.pmdec) : h ? Math.hypot(h.pmra || 0, h.pmdec || 0) : 0;
    const porEpoca = sep => sep <= pm * UMBRAL.epocaAnos / 1000 + UMBRAL.posicionArcsec;
    const fuentePos = at ? `AT-HYG v3.2 (${at.pos_src || '?'})` : 'registro HSB';
    if (g?.j2000 && sepGaia !== null && sepGaia > UMBRAL.posicionArcsec + UMBRAL.redondeoArcsec) {
      const lejos = sepGaia > UMBRAL.posicionLejosArcsec && !porEpoca(sepGaia);
      const mismaD = g.plx > 0 && s.d > 0 && Math.abs(1000 / g.plx - s.d) / s.d < 0.02;
      dif(s, 'POS', 'posición (″ respecto de Gaia DR3)', { valor_actual: `${s.ra.toFixed(5)} ${s.dec.toFixed(5)}`, fuente_actual: fuentePos,
        valor_propuesto: `${g.j2000.ra.toFixed(5)} ${g.j2000.dec.toFixed(5)}`, fuente_propuesta: `Gaia DR3 ${g.id} en J2000`, diferencia_sigma: r3(sepGaia),
        regla: !lejos ? (sepGaia > UMBRAL.posicionLejosArcsec ? 'el movimiento propio explica la diferencia: posición de otra época; Gaia da la medida en J2000' : 'Gaia DR3 da la posición medida')
          : mismaD ? 'muy lejos pero a la misma distancia: la posición del catálogo está mal' : 'muy lejos y a otra distancia: el Gaia es de otro objeto',
        veredicto: !lejos ? 'Corregir' : mismaD ? 'Decide Sergio' : 'Enlace malo' });
    } else if (!g && h && r.hip) {
      const sep = Math.min(separacion(pos, h.j2000), separacion(pos, h.nativa));
      const lejos = sep > UMBRAL.posicionLejosArcsec && !porEpoca(sep);
      if (sep > 2 * UMBRAL.posicionArcsec + UMBRAL.redondeoArcsec) dif(s, 'POS', 'posición (″ respecto de Hipparcos)', { valor_actual: `${s.ra.toFixed(5)} ${s.dec.toFixed(5)}`, fuente_actual: fuentePos,
        valor_propuesto: `${h.j2000.ra.toFixed(5)} ${h.j2000.dec.toFixed(5)}`, fuente_propuesta: `Hipparcos 2007 HIP ${h.id} en J2000`, diferencia_sigma: r3(sep),
        regla: lejos ? 'muy lejos: el HIP es de otro objeto' : 'Hipparcos da la posición medida', veredicto: lejos ? 'Enlace malo' : 'Corregir' });
    }

    // Distancia: escalera, calidad y discrepancias
    const medidas = [];
    const cur = D.curadas.get(s.i);
    if (cur) medidas.push({ fuente: 'curada', plx: 1000 / cur.dNueva, err: 0, rango: 0, ok: true });
    if (g && g.plx > 0 && g.err > 0) {
      const ok = g.G >= UMBRAL.gSatura && (g.ruwe === null || g.ruwe < UMBRAL.ruweMax) && g.err / g.plx <= UMBRAL.errorMax && !r.gaia_revisar;
      medidas.push({ fuente: 'Gaia DR3', plx: g.plx, err: g.err, rango: 1, ok, G: g.G, ruwe: g.ruwe });
    }
    if (h && h.plx > 0 && h.err > 0) medidas.push({ fuente: 'Hipparcos (van Leeuwen 2007)', plx: h.plx, err: h.err, rango: 2, ok: h.err / h.plx <= UMBRAL.errorMax });
    if (c5 && num(c5.parallax) > 0 && num(c5.parallax_error) > 0) {
      const p = num(c5.parallax), e = num(c5.parallax_error), deGaia = BIBCODES_GAIA.includes(c5.parallax_bibcode);
      medidas.push({ fuente: `CNS5 (${c5.parallax_bibcode})`, plx: p, err: e, rango: 3, ok: e / p <= UMBRAL.errorMax && !(deGaia && V !== null && V < UMBRAL.gSatura), deGaia });
    }
    const mejor = medidas.filter(m => m.ok).sort((a, b) => a.rango - b.rango)[0];
    const usada = f.fuente_d || '';
    // La distancia curada de otra componente del sistema también cuenta como curada (distancia_sistemas.js).
    const rangoUsado = cur || fuentesCuradas.has(usada) ? 0 : usada === 'Gaia DR3' ? 1 : usada.startsWith('Hipparcos') ? 2 : usada.startsWith('CNS5') ? 3 : usada.startsWith('sistema') ? -1 : 5;
    const gaiaMala = usada === 'Gaia DR3' ? medidas.find(m => m.fuente === 'Gaia DR3' && !m.ok) : null;
    const etiquetaGaia = m => `Gaia DR3 (G ${m.G?.toFixed(2)}, RUWE ${m.ruwe ?? '?'}${r.gaia_revisar ? ', en duda' : ''})`;
    if (rangoUsado !== -1 && mejor && mejor.rango < rangoUsado) {
      const dNueva = 1000 / mejor.plx, cambio = Math.abs(dNueva - s.d) / s.d;
      if (cambio > 1e-4) dif(s, 'DIST-ESCALERA', 'distancia (pc)', { valor_actual: r3(s.d), fuente_actual: usada + (at && rangoUsado === 5 ? ` (dist_src ${at.dist_src})` : ''),
        valor_propuesto: r3(dNueva), fuente_propuesta: `${mejor.fuente} (${mejor.plx.toFixed(4)} ± ${mejor.err.toFixed(4)} mas)`, diferencia_sigma: mejor.err > 0 ? r3(Math.abs(1000 / s.d - mejor.plx) / mejor.err) : '',
        regla: 'escalera: curada → Gaia DR3 → Hipparcos 2007 → CNS5 → AT-HYG', veredicto: conNombre(s) && cambio > UMBRAL.cambioNombrada ? 'Decide Sergio' : 'Corregir' });
    } else if (gaiaMala && mejor && mejor.fuente !== 'Gaia DR3') {
      // Gaia con RUWE alto (o saturada) en uso: solo se marca si la siguiente medida de la escalera no calza con ella.
      const delta = Math.abs(gaiaMala.plx - mejor.plx), sig = Math.hypot(gaiaMala.err, mejor.err);
      if (delta > UMBRAL.distSigma * sig && delta / mejor.plx > UMBRAL.escaleraRel) {
        const dNueva = 1000 / mejor.plx, cambio = Math.abs(dNueva - s.d) / s.d;
        dif(s, 'DIST-ESCALERA', 'distancia (pc)', { valor_actual: r3(s.d), fuente_actual: etiquetaGaia(gaiaMala), valor_propuesto: r3(dNueva), fuente_propuesta: `${mejor.fuente} (${mejor.plx.toFixed(4)} ± ${mejor.err.toFixed(4)} mas)`,
          diferencia_sigma: r3(delta / sig), regla: 'Gaia DR3 solo cuenta con G ≥ 4 y RUWE < 1,4, y no calza con la siguiente medida: manda esa',
          veredicto: conNombre(s) && cambio > UMBRAL.cambioNombrada ? 'Decide Sergio' : 'Corregir' });
      }
    } else if ((rangoUsado === 5 || gaiaMala) && !mejor) {
      // Sin ninguna paralaje que cumpla la regla. Si una fuente que falta enlazar la tiene, el problema es el enlace.
      const util = candidatas.find(m => m.plx > 0 && m.err > 0 && m.err / m.plx <= UMBRAL.errorMax && (m.G === undefined || m.G >= UMBRAL.gSatura)
        && (m.G === undefined || (m.ruwe !== undefined && m.ruwe !== null && m.ruwe < UMBRAL.ruweMax)));
      const todas = [...medidas.filter(m => m.err > 0), ...candidatas.filter(m => m.plx > 0 && m.err > 0)].sort((a, b) => a.err / a.plx - b.err / b.plx);
      const mejorExistente = todas[0];
      const texto = m => `${m.fuente}${m.G !== undefined && m.G !== null ? ` (G ${m.G.toFixed(2)}, RUWE ${m.ruwe ?? 'sin dato'})` : ''}: ${m.plx.toFixed(3)} ± ${m.err.toFixed(3)} mas (${Math.round(100 * m.err / m.plx)} %)`;
      const src = at?.dist_src || '';
      const vieja = ['GJ', 'N', 'OTHER'].includes(src);
      if (util) {
        dif(s, rangoUsado === 5 ? 'DIST-SIN-MEDIDA' : 'DIST-CALIDAD', 'distancia (pc)', { valor_actual: r3(s.d), fuente_actual: gaiaMala ? etiquetaGaia(gaiaMala) : `${usada}${src ? ` (dist_src ${src})` : ''}`,
          valor_propuesto: r3(1000 / util.plx), fuente_propuesta: texto(util), regla: 'hay una paralaje medida con error ≤ 10 % en una fuente que falta enlazar', veredicto: 'Enlace malo' });
      } else if (gaiaMala) {
        // Única paralaje: Gaia con RUWE ≥ 1,4, saturada o en duda. La regla pide RUWE < 1,4: decide Sergio (grupo).
        const errBueno = gaiaMala.err / gaiaMala.plx <= UMBRAL.errorMax;
        dif(s, 'DIST-CALIDAD', 'distancia (pc)', { valor_actual: r3(s.d), fuente_actual: etiquetaGaia(gaiaMala), valor_propuesto: mejorExistente ? texto(mejorExistente) : '',
          regla: r.gaia_revisar ? 'única paralaje, de un Gaia en duda' : gaiaMala.G < UMBRAL.gSatura ? `única paralaje, de Gaia saturada (G < 4)${errBueno ? ', con error ≤ 10 %' : ''}`
            : `única paralaje, de Gaia con RUWE ≥ 1,4${errBueno ? ' y error ≤ 10 %' : ' y error > 10 %'}`,
          veredicto: 'Decide Sergio' });
      } else {
        dif(s, 'DIST-SIN-MEDIDA', 'distancia (pc)', { valor_actual: r3(s.d), fuente_actual: `${usada}${src ? ` (dist_src ${src})` : ''}`,
          valor_propuesto: mejorExistente ? texto(mejorExistente) : 'ninguna', fuente_propuesta: mejorExistente ? 'mejor paralaje que existe (no cumple la regla)' : '',
          regla: vieja ? 'fuente antigua (Gliese-Jahreiss u otra) sin paralaje medida con error ≤ 10 % en Gaia, Hipparcos ni CNS5'
            : 'AT-HYG con una paralaje que no cumple la regla (error > 10 %, Gaia saturada o con RUWE alto) y sin otra medida',
          veredicto: 'Decide Sergio' });
      }
    }
    // Discrepancias entre medidas independientes (la de CNS5 que viene de Gaia no es independiente de Gaia).
    let peor = null;
    for (let a = 0; a < medidas.length; a++) for (let b = a + 1; b < medidas.length; b++) {
      const x = medidas[a], y = medidas[b];
      if ((x.fuente === 'Gaia DR3' && y.deGaia) || (y.fuente === 'Gaia DR3' && x.deGaia)) continue;
      if ((x.err && x.err / x.plx > 0.2) || (y.err && y.err / y.plx > 0.2)) continue;
      const delta = Math.abs(x.plx - y.plx), sig = Math.hypot(x.err, y.err) || 1e-9;
      if (delta > UMBRAL.distSigma * sig && delta / Math.max(x.plx, y.plx) > UMBRAL.distRel && (!peor || delta / sig > peor.n)) peor = { x, y, n: delta / sig };
    }
    if (peor) {
      const [p, q] = [peor.x, peor.y].sort((a, b) => (a.err / a.plx) - (b.err / b.plx));
      const gaiaRara = [p, q].some(m => m.fuente === 'Gaia DR3' && !m.ok);
      const comparables = p.err > 0 && q.err / q.plx <= UMBRAL.errorBueno && q.err / p.err < UMBRAL.precisionParecida;
      dif(s, 'DIST-DIFIERE', 'paralaje (mas)', { valor_actual: `${p.plx.toFixed(3)} ± ${p.err.toFixed(3)}`, fuente_actual: p.fuente, valor_propuesto: `${q.plx.toFixed(3)} ± ${q.err.toFixed(3)}`, fuente_propuesta: q.fuente,
        diferencia_sigma: r3(peor.n), regla: gaiaRara ? 'Gaia saturada o con RUWE alto: no cuenta' : doble ? 'sistema múltiple: la órbita sesga la paralaje de la medida más corta'
          : comparables ? 'dos medidas buenas de precisión parecida que no calzan' : `se usa la más precisa (${p.fuente}); la otra se anota`,
        veredicto: comparables && !gaiaRara && !doble ? 'Decide Sergio' : 'Es real' });
    }
    // GCNS y Gaia DR3 son la misma astrometría: la paralaje tiene que ser igual.
    if (gc && D.gaia.has(gc.id) && Math.abs(gc.plx - D.gaia.get(gc.id).plx) > 1e-3) dif(s, 'DUPLICADO', 'paralaje GCNS frente a Gaia DR3', { valor_actual: D.gaia.get(gc.id).plx, fuente_actual: 'Gaia DR3', valor_propuesto: gc.plx, fuente_propuesta: 'GCNS', regla: 'misma fuente de Gaia: misma paralaje', veredicto: 'Enlace malo' });

    // Brillo y color
    const umbralV = g && g.bpRp > 2.5 ? UMBRAL.magVRoja : UMBRAL.magV;
    if (vg !== null && V !== null && g.G >= UMBRAL.gSatura && g.bpRp > -0.5 && g.bpRp < 5) {
      const dv = V - vg;
      if (Math.abs(dv) > umbralV) {
        const variable = at?.var || '';
        dif(s, 'MAG/COLOR', 'V (mag)', { valor_actual: r3(V), fuente_actual: at ? `AT-HYG v3.2 (${at.mag_src || '?'})` : 'Hoshi', valor_propuesto: r3(vg), fuente_propuesta: `Gaia DR3 G ${g.G.toFixed(2)}, BP−RP ${g.bpRp.toFixed(2)} (Riello et al. 2021)`, diferencia_sigma: r3(dv),
          regla: Math.abs(dv) > 1.5 ? 'más de 1,5 mag: no es el mismo objeto o es un par sin resolver' : variable ? `estrella variable (${variable})` : doble || (g.ruwe ?? 0) >= UMBRAL.ruweMax ? 'par sin resolver en una de las dos fuentes' : 'V de Hoshi y V predicha desde Gaia no calzan',
          veredicto: Math.abs(dv) > 1.5 ? 'Enlace malo' : variable || doble || (g.ruwe ?? 0) >= UMBRAL.ruweMax ? 'Es real' : 'Decide Sergio' });
      }
    }
    if (hBv !== null && f.fuente_c === 'Gaia DR3 BP−RP' && Math.abs(s.c - hBv) > UMBRAL.colorBV) {
      const tope = s.c >= BV_TOPE - 1e-3 && hBv < s.c;
      dif(s, 'MAG/COLOR', 'B−V', { valor_actual: s.c, fuente_actual: 'Gaia DR3 BP−RP convertido', valor_propuesto: hBv, fuente_propuesta: `Hipparcos HIP ${h.id}`, diferencia_sigma: r3(s.c - hBv),
        regla: tope ? 'la conversión BP−RP → B−V llega a su tope (1,653): las M muy rojas quedan todas igual' : doble ? 'par sin resolver en una de las dos fuentes' : 'B−V medido frente a B−V convertido de BP−RP',
        veredicto: tope ? 'Decide Sergio' : doble || (g?.ruwe ?? 0) >= UMBRAL.ruweMax ? 'Es real' : 'Decide Sergio' });
    }
    // Sin color: process_stars pone B−V = 0 (blanco azulado) cuando AT-HYG no trae color.
    const sinColor = s.c === 0 && f.fuente_c !== 'Gaia DR3 BP−RP' && (!at || at.ci === '');
    if (sinColor) dif(s, 'COLOR-FALTA', 'B−V', { valor_actual: 0, fuente_actual: f.fuente_c || 'sin color', valor_propuesto: hBv ?? '', fuente_propuesta: hBv !== null ? `Hipparcos HIP ${h.id}` : '',
      regla: hBv !== null ? 'Hipparcos tiene el B−V medido' : 'sin color medido: se dibuja como B−V 0 (blanco azulado) aunque sea de otro tipo', veredicto: hBv !== null ? 'Corregir' : 'Decide Sergio' });

    // Tipo espectral frente al color y a la magnitud absoluta
    const clase = String(s.sp || '').trim().replace(/^(sd|esd|usd|d|g|c|k)(?=[OBAFGKM])/, '').charAt(0);
    if (!sinColor && BV_CLASE[clase] && Number.isFinite(s.c)) {
      const [lo, hi] = BV_CLASE[clase], extra = s.d > 300 ? 0.6 : s.d > 100 ? 0.25 : 0;
      if (s.c < lo - 0.15 || s.c > hi + extra + 0.15) dif(s, 'TIPO', 'tipo espectral frente a B−V', { valor_actual: s.sp, fuente_actual: f.fuente_sp || '', valor_propuesto: `B−V ${s.c}`, fuente_propuesta: f.fuente_c || '',
        regla: `clase ${clase} admite B−V entre ${lo} y ${(hi + extra).toFixed(2)}`, veredicto: doble ? 'Es real' : 'Decide Sergio' });
    }
    const rango = rangoMv(s.sp);
    if (rango && Number.isFinite(s.m) && (s.m < rango[0] || s.m > rango[1])) {
      dif(s, 'ALERTA-MAG-TIPO', 'magnitud absoluta frente al tipo', { valor_actual: s.m, fuente_actual: `${s.sp} a ${r3(s.d)} pc (${usada})`, valor_propuesto: `${rango[0].toFixed(1)} a ${rango[1].toFixed(1)}`,
        fuente_propuesta: 'M_V típica (Pecaut & Mamajek 2013; Cox 2000)', regla: 'alerta: la distancia o el tipo pueden estar mal (no es una medida: nunca corrige)', veredicto: 'Decide Sergio' });
    }

    // Movimiento propio y multiplicidad
    if (g && h && g.pmra !== null && h.pmra !== null) {
      const dpm = Math.hypot(g.pmra - h.pmra, g.pmdec - h.pmdec);
      if (dpm > UMBRAL.pmMasAno) dif(s, 'PM', 'movimiento propio (mas/año)', { valor_actual: `${g.pmra.toFixed(1)} ${g.pmdec.toFixed(1)}`, fuente_actual: 'Gaia DR3', valor_propuesto: `${h.pmra.toFixed(1)} ${h.pmdec.toFixed(1)}`, fuente_propuesta: 'Hipparcos 2007',
        diferencia_sigma: r3(dpm), regla: 'diferencia de movimiento propio: aceleración por una compañera', veredicto: 'Es real' });
    }
    if (g && (g.ruwe ?? 0) >= UMBRAL.ruweMax && !doble) dif(s, 'MULTIPLICIDAD', 'RUWE de Gaia', { valor_actual: 'simple en Hoshi', valor_propuesto: `RUWE ${g.ruwe}`, fuente_propuesta: 'Gaia DR3',
      regla: 'Gaia la ve doble (RUWE ≥ 1,4) y Hoshi no le dibuja compañera', veredicto: 'Es real' });

    // Derivados: x, y, z y magnitud absoluta
    const radio = Math.hypot(s.x, s.y, s.z);
    if (s.d > 0 && Math.abs(radio - s.d) / s.d > 1e-5) dif(s, 'DERIVADO', 'x, y, z', { valor_actual: r3(radio), valor_propuesto: r3(s.d), regla: '|x, y, z| = distancia', veredicto: 'Corregir' });
    if (at && at.mag !== '' && s.d > 0 && s.i < 100_000_000 && !String(usada).startsWith('NASA')) {
      const m = Number(at.mag) - 5 * Math.log10(s.d / 10);
      if (Math.abs(m - s.m) > 0.011) dif(s, 'DERIVADO', 'magnitud absoluta', { valor_actual: s.m, valor_propuesto: r3(m), fuente_propuesta: 'V de AT-HYG y la distancia en uso', regla: 'M = V − 5 log10(d/10)', veredicto: 'Corregir' });
    }
  }

  // ---------- Nombres propios ----------
  const porNombre = new Map();
  for (const s of D.estrellas) if (s.n && s.i !== 0) { if (!porNombre.has(s.n)) porNombre.set(s.n, []); porNombre.get(s.n).push(s); }
  for (const [n, lista] of porNombre) if (lista.length > 1) for (const s of lista) dif(s, 'NOMBRE', 'nombre propio', { valor_actual: n, valor_propuesto: `también en ${lista.filter(x => x !== s).map(x => `HSB ${x.i}`).join(', ')}`, regla: 'un nombre propio en dos estrellas', veredicto: 'Decide Sergio' });

  // ---------- Sistemas: distancia de las componentes, separaciones y nombres ----------
  for (const [clave, sis] of Object.entries(D.sistemas)) {
    const p = D.porId.get(Number(clave));
    if (!p) continue;
    for (const c of sis.comps) {
      // Separación en UA = separación angular medida × distancia de la primaria.
      const medida = separaciones.get(c.pair === 'MSC' ? `msc|${sis.wds}|${c.of}>${c.n}` : `${c.k === 'o' ? 'orb6' : 'wds'}|${c.pair}|${c.of}>${c.n}`);
      const ua = c.k === 'o' ? c.a : c.rho;
      if (medida && ua > 0 && p.d > 0 && !medida.some(x => Math.abs(ua / p.d - x) / x < 0.01)) {
        dif(p, 'DERIVADO', `separación ${c.of}–${c.n} (UA)`, { valor_actual: r3(ua), fuente_actual: 'star_systems.json', valor_propuesto: r3(medida[0] * p.d), fuente_propuesta: `${medida[0]}″ × ${r3(p.d)} pc`,
          diferencia_sigma: r3(ua / p.d - medida[0]), regla: 'separación en UA = separación angular medida × distancia de la primaria', veredicto: 'Corregir' });
      }
      if (c.cid === undefined) continue;
      const q = D.porId.get(c.cid);
      if (!q || !(q.d > 0) || !(p.d > 0)) continue;
      if (q.n && !p.n && q.V !== null && p.V !== null && q.V > p.V + 0.5) dif(q, 'NOMBRE', 'nombre propio en la compañera', { valor_actual: q.n, valor_propuesto: `primaria ${nombreDe(p)} sin nombre`, regla: 'el nombre propio suele ser de la primaria (la más brillante)', veredicto: 'Decide Sergio' });
      const rel = Math.abs(q.d - p.d) / p.d;
      if (rel > UMBRAL.distRel) {
        const mq = medidaDe(D, q), mp = medidaDe(D, p);
        const sigma = mq && mp ? Math.abs(mq.plx - mp.plx) / Math.hypot(mq.err, mp.err) : null;
        dif(q, 'SISTEMA', 'distancia de la componente', { valor_actual: r3(q.d), fuente_actual: D.fuentesD.get(q.i)?.fuente_d || '', valor_propuesto: r3(p.d), fuente_propuesta: `primaria ${nombreDe(p)}`, diferencia_sigma: r3(sigma),
          regla: sigma === null ? 'sin dos paralajes medidas para comparar' : sigma > UMBRAL.distSigma ? 'posible par óptico: las paralajes no calzan (se perdería la línea del par)' : 'las paralajes calzan: la componente debe compartir la distancia del sistema',
          veredicto: sigma === null ? 'Decide Sergio' : sigma > UMBRAL.distSigma ? (conNombre(q) || conNombre(p) ? 'Decide Sergio' : 'Es real') : 'Corregir' });
      }
    }
  }

  // ---------- Cúmulos (UCC): distancia de los miembros ----------
  for (const cl of D.cumulos) {
    if (!(cl.paralaje > 0) || !cl.ids) continue;
    const dCl = 1000 / cl.paralaje, prof = Math.max(3 * (cl.r50Pc || 0), 0.05 * dCl);
    for (const id of cl.ids) {
      const s = D.porId.get(id);
      if (!s || !(s.d > 0)) continue;
      const m = medidaDe(D, s), sigD = m ? 1000 / m.plx * (m.err / m.plx) : 0;
      if (Math.abs(s.d - dCl) > prof + 3 * sigD && Math.abs(s.d - dCl) / dCl > UMBRAL.distRel) {
        const usada = D.fuentesD.get(s.i)?.fuente_d || '';
        dif(s, 'CUMULO', `distancia frente a ${cl.nombre}`, { valor_actual: r3(s.d), fuente_actual: usada, valor_propuesto: r3(dCl), fuente_propuesta: `${cl.nombre} (UCC, paralaje ${cl.paralaje} mas)`,
          diferencia_sigma: sigD > 0 ? r3(Math.abs(s.d - dCl) / sigD) : '', regla: usada.startsWith('Hipparcos') ? 'distancia de Hipparcos frente al cúmulo (Hipparcos tiene un sesgo conocido en cúmulos como las Pléyades)' : 'el miembro no calza con la distancia del cúmulo: puede no ser miembro',
          veredicto: usada.startsWith('Hipparcos') || conNombre(s) ? 'Decide Sergio' : 'Es real' });
      }
    }
  }
  return { identidad, difs };
}

// Capa de fondo (Gaia y GCNS): fuentes que no cumplen la regla, duplicadas o que son una estrella del catálogo.
export function auditarCapa(D) {
  const difs = [];
  const fila = (fuente, tipo, dato, o) => difs.push({ hsb: D.hsbDeGaia.get(fuente) ?? '', nombre: `Gaia DR3 ${fuente}`, con_nombre: 0, tipo, dato, valor_actual: '', fuente_actual: '',
    valor_propuesto: '', fuente_propuesta: '', diferencia_sigma: '', regla: '', veredicto: '', ...o });
  const dibujadas = new Map();
  for (const r of D.seleccion) if (r.estado === 'dibujada') { if (!dibujadas.has(r.source_id)) dibujadas.set(r.source_id, []); dibujadas.get(r.source_id).push(r.capa); }
  const enCatalogo = new Map(), registrada = new Set();
  for (const r of D.registro.values()) if (r.gaia_dr3 && r.estado === 'activa') { registrada.add(r.gaia_dr3); if (D.porId.has(Number(r.hsb))) enCatalogo.set(r.gaia_dr3, Number(r.hsb)); }
  const cieloHoshi = new Cielo();
  for (const s of D.estrellas) if (s.d > 0 && s.i !== 0) cieloHoshi.agregar({ id: s.i, s, j2000: { ra: s.ra, dec: s.dec } });
  let ruwe = 0, error = 0;
  for (const [id, capas] of dibujadas) {
    if (capas.length > 1) fila(id, 'DUPLICADO', 'capa: misma fuente dos veces', { valor_actual: capas.join(' y '), regla: 'una fuente de Gaia se dibuja una vez', veredicto: 'Corregir' });
    // Como build_estrellas: no se dibujan las enlazadas con una estrella del catálogo ni el Gaia DR3 de una.
    if (enCatalogo.has(id) || D.porId.has(D.enlazadasCapa.get(id)) || D.porId.has(D.igualA.get(D.hsbDeGaia.get(id)))) continue;
    const o = D.gcns.get(id) || D.gaia1m.get(id);
    if (!o) continue;
    if (o.err > 0 && o.err / o.plx > UMBRAL.errorMax) { error++; fila(id, 'CAPA-REGLA', 'error de paralaje', { valor_actual: `${o.plx.toFixed(3)} ± ${o.err.toFixed(3)} mas`, regla: 'error de paralaje > 10 %', veredicto: 'Decide Sergio' }); }
    if ((o.ruwe ?? 0) >= UMBRAL.ruweMax) { ruwe++; fila(id, 'CAPA-REGLA', 'RUWE', { valor_actual: o.ruwe, fuente_actual: 'GCNS', regla: 'RUWE ≥ 1,4: astrometría de estrella simple dudosa (en el millón no se tiene el RUWE)', veredicto: 'Decide Sergio' }); }
    // Una fuente dibujada a < 1″ de una estrella del catálogo, con brillo y distancia parecidos y sin enlace: la misma estrella dos veces.
    // Una fuente con número propio en el registro es otra componente (par cerrado), no la misma estrella.
    if (o.plx > 0 && !D.enlazadasCapa.has(id) && !registrada.has(id)) {
      const v = vFromGaia(o.G, o.bpRp) ?? o.G;
      for (const { o: e, sep } of cieloHoshi.cerca(o.j2000, 1)) {
        const s = e.s, d = 1000 / o.plx;
        if (s.V !== null && Math.abs(v - s.V) <= 1 && Math.abs(d - s.d) / s.d < 0.25) {
          fila(id, 'DUPLICADO', 'capa: misma estrella que una del catálogo', { valor_actual: `${sep.toFixed(2)}″ de ${s.n || `HSB ${s.i}`}`, valor_propuesto: `HSB ${s.i}`, regla: 'misma posición, brillo y distancia que una estrella del catálogo', veredicto: 'Corregir' });
          break;
        }
      }
    }
  }
  return { difs, resumen: { dibujadas: dibujadas.size, ruwe, error } };
}

// Paralaje medida usable de una estrella (para comparar componentes y miembros de cúmulos).
function medidaDe(D, s) {
  const r = D.registro.get(s.i);
  if (!r) return null;
  // Misma regla que fusion.js: Gaia con G ≥ 4; con RUWE ≥ 1,4 cede ante Hipparcos si no calzan.
  const g = r.gaia_dr3 && !r.gaia_revisar ? D.gaia.get(r.gaia_dr3) : null;
  const h = r.hip ? D.hip.get(Number(r.hip)) : null;
  const deHip = h && h.plx > 0 && h.err > 0 && h.err / h.plx <= 0.1 ? { plx: h.plx, err: h.err } : null;
  if (g && g.plx > 0 && g.err > 0 && g.err / g.plx <= 0.1 && g.G >= UMBRAL.gSatura) {
    const cede = deHip && (g.ruwe ?? 0) >= UMBRAL.ruweMax && Math.abs(g.plx - deHip.plx) > 3 * Math.hypot(g.err, deHip.err) && Math.abs(g.plx - deHip.plx) / deHip.plx > UMBRAL.escaleraRel;
    if (!cede) return { plx: g.plx, err: g.err };
  }
  return deHip;
}
