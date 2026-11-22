// scripts/catalog/globulares.js
// Cúmulos globulares que Hoshi dibuja, con sus miembros de Gaia (build_globulares.js) y su ficha (process_cumulos.js).
// Miembros: Vasiliev & Baumgardt 2021, MNRAS 505, 5978 («Gaia EDR3 view on Galactic globular clusters»; Zenodo 4891252),
// con probabilidad de pertenencia > 0,9 y G < 15 (sin exigir sus filtros de calidad: ver build_globulares.js). Color BP−RP de Vasiliev;
// donde falta, el de Hunt & Reffert 2023 (A&A 673, A114, miembros) por source_id.
// Centro, movimiento propio, velocidad radial y distancia de cada cúmulo: valores publicados, en la configuración de abajo.
// La distancia de cada miembro es la del cúmulo (como las Pléyades brillantes, distancias_curadas.js): a 5 kpc la
// paralaje de cada estrella sola los desparrama por miles de parsecs. Para dibujarlo en 3D, cada miembro recibe además
// una profundidad según su radio proyectado (profundidadPlummer, abajo); la ficha muestra la distancia del cúmulo. El radio con
// la mitad de los miembros lo mide build_globulares.js desde el centro, con los miembros que se dibujan.

import crypto from 'node:crypto';

// NGC 5139 (Omega Centauri):
// - Distancia: Maíz Apellániz, Pantaleoni González & Barbá 2021, A&A 649, A13, tabla 5: paralaje de grupo de Gaia EDR3
//   ϖg = 0,1928 ± 0,0096 mas (punto cero de Lindegren y covarianza angular), d = 5,25 (+0,28/−0,25) kpc. Concuerda con
//   Soltis, Casertano & Riess 2021, ApJL 908, L5 (5,24 kpc) y con la binaria eclipsante OGLEGC 17 (Thompson et al. 2001,
//   AJ 121, 3089: 5,385 ± 0,30 kpc). No se usan los 5,43 kpc de Baumgardt & Vasiliev 2021 (combinan distancias que
//   dependen de modelos) ni el dist50 de Hunt & Reffert 2023 (5.274 pc, con un error formal sin los sistemáticos de Gaia).
// - Centro J2000: Anderson & van der Marel 2010, ApJ 710, 1032 (medido con el Hubble). El de Hunt & Reffert 2023 está
//   10,5′ al norte. El origen de las columnas x, y del archivo de Vasiliev & Baumgardt coincide con él (< 0,1″).
// - Movimiento propio: Vasiliev & Baumgardt 2021, MNRAS 505, 5978, tabla A1 (versión 3).
// - Velocidad radial: base de cúmulos globulares de H. Baumgardt, versión 4, tabla de órbitas (232,78 km/s; concuerda con
//   Mayor et al. 1997 y Harris 2010).
export const GLOBULARES = [
  {
    id: 'ngc5139', nombre: 'Omega Centauri', hunt: 'NGC_5139', vasiliev: 'NGC_5139_oCen.txt', constelacion: 'Cen',
    distanciaPc: 5250, fuenteDistancia: 'Maíz Apellániz et al. 2021, A&A 649, A13 (paralaje de grupo de Gaia EDR3, 5,25 kpc)',
    centro: [201.69683, -47.47957], pm: [-3.250, -6.746], rv: 232.78,
    catalogos: ['NGC 5139', 'Caldwell 80', 'Melotte 118', 'GCl 24'],
  },
];

export const PROBABILIDAD_MIN = 0.9, G_MAX = 15;

// Profundidad de los miembros a lo largo de la visual: un desplazamiento por estrella según su radio proyectado
// (Plummer condicional, p(z|R), con a = radio proyectado con la mitad de los miembros dibujados, desde el centro),
// determinista por su source_id. La ficha muestra la distancia del cúmulo (src/scene/magnitudesFicha.js).
// Plummer: ρ(r) ∝ (1 + r²/a²)^(−5/2).
// Desplazamiento a lo largo de la visual (pc) para una estrella a `R` pc del centro en el cielo, en un cúmulo de Plummer
// de radio `a`: la distribución de z dado R es ∝ (b² + z²)^(−5/2) con b² = a² + R², cuya acumulada es
// ½ + z(2z² + 3b²) / (4 (b² + z²)^(3/2)). Se invierte por bisección con u fijo por source_id.
export function profundidadPlummer(R, a, sourceId) {
  const u = crypto.createHash('sha1').update(String(sourceId)).digest().readUInt32BE(0) / 2 ** 32;
  const b2 = a * a + R * R, acumulada = z => 0.5 + z * (2 * z * z + 3 * b2) / (4 * (b2 + z * z) ** 1.5);
  let lo = -50 * Math.sqrt(b2), hi = 50 * Math.sqrt(b2);
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (acumulada(m) < u) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export const VASILIEV_DIR = './data/raw/globulares';
export const VASILIEV_ZIP = `${VASILIEV_DIR}/clusters.zip`;
export const HUNT_MIEMBROS = cumulo => `${VASILIEV_DIR}/hunt2023_${cumulo.hunt.toLowerCase()}_miembros.tsv`;
export const ADDED_GLOBULARES_JSON = './data/catalog/added_globulares.json';

// Lee una tabla TSV de VizieR (asu-tsv): cabecera, unidades y guiones, después las filas.
export function leerTsvVizier(texto) {
  const lineas = texto.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const columnas = lineas[0].split('\t').map(c => c.trim());
  return lineas.slice(3).map(l => { const v = l.split('\t'); return Object.fromEntries(columnas.map((c, k) => [c, (v[k] || '').trim()])); });
}
