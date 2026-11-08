// scripts/catalog/auditoria/revisadas.js
// Escribe data/catalog/auditoria_revisadas.csv (hsb, tipo, dato, veredicto, decision, motivo): cada diferencia «Decide
// Sergio», «Enlace malo» o «Corregir» que queda en la auditoría, con la decisión que la cubre y su motivo. Las
// decisiones A–H (D-024, HSB-09) e I–O (HSB-10) las aprobó Sergio el 08/11/2026. Lo que no entra en ninguna queda con
// decisión «pendiente» y su regla, para que se vea.
// Uso: node scripts/catalog/auditoria/revisadas.js (después de npm run auditoria)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';

export const REVISADAS = 'data/catalog/auditoria_revisadas.csv';
const COLUMNAS = ['hsb', 'tipo', 'dato', 'veredicto', 'decision', 'motivo'];
const celda = v => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

// Revisión a mano de las estrellas con nombre (decisiones E y G).
const NOTAS = {
  TIPO: { 2335058: 'Bunda (ξ Aqr): SIMBAD la clasifica K0III (Houk 1999) y es binaria espectroscópica, pero los dos colores medidos (Hipparcos 0,175 y Gaia 0,18) son de una estrella A; no hay otra clasificación para decidir' },
  NOMBRE: {
    9000105: 'GJ 667 C: el nombre es la designación de esa estrella (la de los planetas)',
    9003019: 'TOI-2459: el nombre es la designación de esa estrella (la de los planetas)',
    100004407: 'Graffias C: designación con la letra de la componente',
    100004667: 'Alrakis C: designación con la letra de la componente',
    100004668: 'Alrakis es μ Draconis A (SIMBAD); la estrella brillante del sistema es el par μ Dra AB sin resolver (GJ 9584AB)',
    125360: 'p Eridani A: el renombre a «p Eridani A» espera una descarga nueva de datos oficiales (cambia sus consultas)',
    125364: 'p Eridani B: el renombre a «p Eridani B» espera una descarga nueva de datos oficiales (cambia sus consultas)',
  },
  'ALERTA-MAG-TIPO': {
    90273: 'Emiw: subgigante K1 casi en la secuencia principal; 0,07 mag fuera del rango típico',
    115103: 'Alpherg: gigante G7IIIa luminosa; 0,3 mag fuera del rango típico',
    175559: 'Mira: variable de largo período (amplitud ~8 mag); la V de AT-HYG es un promedio',
    222736: 'Acamar: par sin resolver y el tipo A2V es del sistema; la A es gigante (A4III)',
    433710: 'Phact: estrella Be subgigante de rotación rápida; 0,5 mag más brillante que una B9V',
    521604: 'Red Rectangle: estrella post-AGB oculta por su disco; se ve por luz dispersada',
    531292: 'Canopus: supergigante brillante (A9II–F0Ib); 0,5 mag fuera del rango de la clase II',
    827335: 'Tureis: el «II» de su tipo (kF2IImF5II, estrella Am) no es una clase de luminosidad real',
    949805: 'Alkaphrah: dos estrellas A sin resolver; suman 0,75 mag',
    1024340: 'Ras Elased Australis: gigante brillante G1IIIa; 0,4 mag fuera del rango típico',
    1077796: 'Adhafera: gigante brillante F0IIIa; 0,7 mag fuera del rango típico',
    1156214: 'Dingolay: subgigante clasificada G6V; más brillante que una enana',
    1183948: 'Shama: subgigante casi en la secuencia principal; 0,3 mag fuera del rango típico',
    1509654: 'Pherkad: gigante brillante (A3II–III); 1,2 mag fuera del rango de la clase III',
    1532532: 'Karaka: subgigante K2 casi en la secuencia principal; 0,5 mag fuera del rango típico',
    1579874: 'Acrab B: B2V en un sistema múltiple con RUWE alto; 0,4 mag fuera del rango típico',
    1584024: 'Marsic B: es gigante (K1III), no subgigante; el tipo K0IV no calza',
    1652557: 'Atria: gigante brillante (K2IIb–IIIa); el tipo K2III subestima su luminosidad',
    1657873: 'Xamidimura: binaria eclipsante de dos estrellas B y distancia de AT-HYG con error > 10 % (decisión B)',
    1744036: 'Sargas: gigante brillante (F1II); el tipo F1III no calza, y distancia de Hipparcos con error 14 % (decisión B)',
    1851931: 'Kaus Media: gigante brillante K2.5IIIa; 0,1 mag fuera del rango típico',
    2011001: 'Arkab Prior: B8V–B9V en el borde del rango; distancia sin paralaje dentro de la regla (decisión B)',
    2111238: 'Cygnus X-1: extinción de ~3 mag por polvo no corregida (está a 2,2 kpc en el plano)',
    2293929: 'Kitalpha: binaria compuesta (G6IV + B9.5V) sin resolver',
    2323395: 'Sadalsuud: supergigante G0Ib poco luminosa; 0,2 mag fuera del rango',
    2384866: 'Sadalmelik: supergigante G2Ib poco luminosa; 0,2 mag fuera del rango',
    2403906: 'Ancha: es gigante (G8III–IV); la clase II de su tipo exagera la luminosidad',
  },
  'MAG/COLOR': {
    2043182: 'Campbell\'s Hydrogen Star: estrella central de nebulosa planetaria ([WC9]); el color de Gaia incluye la nebulosa',
    2111238: 'Cygnus X-1: enrojecida por polvo (E(B−V) ~1); la diferencia es de la extinción, no de un error',
    2289559: 'Solaris: el B−V de Hipparcos (1,61) no calza con una K5; el de Gaia (1,01) sí',
    521604: 'Red Rectangle: la nebulosa bipolar suma luz; V y G no son de la misma región',
  },
};

const distancia = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s.d]));

function decision(d) {
  const nota = NOTAS[d.tipo]?.[Number(d.hsb)];
  if (d.tipo === 'CAPA-REGLA') return ['A', 'RUWE ≥ 1,4 en la capa de fondo: se sigue dibujando (D-020)'];
  if (d.tipo === 'DIST-CALIDAD') return ['H', 'única paralaje, de Gaia con RUWE ≥ 1,4 y error ≤ 10 %: se acepta (D-020)'];
  if (d.tipo === 'DIST-SIN-MEDIDA' && d.veredicto === 'Decide Sergio') return ['B', 'sin paralaje que cumpla la regla ni distancia medida publicada: queda la de AT-HYG, sin aviso visual'];
  if (d.tipo === 'COLOR-FALTA') return ['C', 'sin color medido ni tipo espectral: no hay con qué darle color; se dibuja como B−V 0'];
  if (d.tipo === 'MAG/COLOR' && /tope/.test(d.regla)) return ['D', 'B−V en el tope de la conversión (M8.5V de Pecaut & Mamajek 2013)'];
  if (d.tipo === 'ALERTA-MAG-TIPO') return ['E', nota || 'alerta de magnitud absoluta frente al tipo: no es una medida y no cambia ningún dato'];
  if (d.tipo === 'MAG/COLOR') return ['G', nota || `${d.regla}: no se cambian datos`];
  if (d.tipo === 'POS' && d.veredicto === 'Decide Sergio') return ['F', 'a más de 10″ de su Gaia y el brillo no calza (±0,5 mag): enlace dudoso, se deja la posición'];
  // Decisiones I–O (aprobadas por Sergio el 08/11/2026, HSB-10).
  if (d.tipo === 'TIPO') return ['I', NOTAS.TIPO[Number(d.hsb)] || (/clase [OBA]/.test(d.regla) && distancia.get(Number(d.hsb)) > 200
    ? 'estrella O, B o A lejana: el color medido incluye el enrojecimiento por polvo' : 'el tipo es solo texto; el color medido manda en el dibujo y no hay otra medida para cambiarlo')];
  if (d.tipo === 'DIST-DIFIERE') return ['J', 'se usa la paralaje más precisa; la otra (casi siempre Hipparcos) se anota'];
  if (d.tipo === 'ID-CONFLICTO' && /GJ/.test(d.dato)) return ['L', 'SIMBAD usa el número GJ del sistema para la principal, o la estrella tiene dos números GJ válidos'];
  if (d.tipo === 'NOMBRE') return ['M', NOTAS.NOMBRE[Number(d.hsb)] || 'el nombre es la designación de esa componente'];
  if (d.tipo === 'NASA') return ['O', 'HIP 73674 (HD 133131, par de gemelas): SIMBAD no da un Gaia para el par y NASA usa el de la A; se queda el actual hasta tener una medida que decida'];
  return ['pendiente', `fuera de A–O: ${d.regla}`];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const difs = parse(zlib.gunzipSync(fs.readFileSync('data/catalog/hsb_auditoria.csv.gz')).toString('utf8'), { columns: true });
  const filas = difs.filter(d => ['Decide Sergio', 'Enlace malo', 'Corregir'].includes(d.veredicto)).map(d => {
    const [dec, motivo] = decision(d);
    return { hsb: d.hsb, tipo: d.tipo, dato: d.dato, veredicto: d.veredicto, decision: dec, motivo };
  });
  fs.writeFileSync(REVISADAS, [COLUMNAS.join(','), ...filas.map(f => COLUMNAS.map(c => celda(f[c])).join(','))].join('\n') + '\n');
  const cuenta = filas.reduce((o, f) => ({ ...o, [f.decision]: (o[f.decision] || 0) + 1 }), {});
  console.log(`✓ ${REVISADAS}: ${filas.length} filas ${JSON.stringify(cuenta)}`);
}
