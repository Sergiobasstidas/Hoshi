// Estrella puesta en el lugar del Sol para comparar tamaños con las órbitas del sistema solar.
// Solo radios publicados (data/processed/stellar_official.json) y la conversión de unidades.
import { useSyncExternalStore } from 'react';
import { PLANETS } from './scale.js';

export const UA_POR_RADIO_SOLAR = 695700 / 149597870.7;
export const SOL = { id: 'sol', nombre: 'Sol', radiusSolar: 1, temperatureK: 5772, fuente: 'IAU 2015 (radio solar nominal)' };
// Estrellas de la lista sin buscar, por su nombre del catálogo.
// De mayor a menor: hipergigantes, supergigantes, gigantes, estrellas como el Sol y enanas.
const DESTACADAS = ['VY Canis Majoris', 'VV Cephei A', 'Betelgeuse', 'Antares', 'Deneb', 'La Superba', 'Mirach', 'Rigel', 'Canopus', 'Aldebaran',
  'Alnilam', 'Kochab', 'Arcturus', 'Cygnus X-1', 'Capella', 'Pollux', 'Spica', 'Vega', 'Sirius', 'Rigil Kentaurus', 'Toliman', "Barnard's Star", 'Proxima Centauri'];
// Nombres en español de las conocidas; el resto, como en el catálogo.
const NOMBRES = { Sirius: 'Sirio A', Arcturus: 'Arturo', Aldebaran: 'Aldebarán', Procyon: 'Proción', 'Proxima Centauri': 'Próxima Centauri',
  Pollux: 'Pólux', Spica: 'Espiga', 'Rigil Kentaurus': 'Alfa Centauri A', Toliman: 'Alfa Centauri B', "Barnard's Star": 'Estrella de Barnard' };
const nombreEnEspanol = nombre => NOMBRES[nombre] || nombre;

// `elegida`: la del panel. `mostrada`: la que está en la escena; puede cambiar después del viaje de la cámara.
let estado = { candidatas: [], elegida: null, mostrada: null };
const oyentes = new Set();
const avisar = () => oyentes.forEach(oyente => oyente());
export const estadoComparacion = () => estado;
export const suscribirComparacion = oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); };
export const useComparacionSol = () => useSyncExternalStore(oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); }, () => estado);

// Estrellas con radio y temperatura publicados.
export function definirCandidatas(stars) {
  // Las que no tienen nombre propio en el catálogo traen el suyo en los datos curados (VY Canis Majoris).
  const candidatas = stars.filter(star => (star.n || star.datos?.nombre) && star.n !== 'Sol' && star.datos?.radiusSolar && (star.datos.temperatureK || star.physics?.temperatureK))
    .map(star => ({ id: star.i, catalogo: [star.n || star.datos.nombre, star.datos.alias].filter(Boolean).join(' '), nombre: nombreEnEspanol(star.n || star.datos.nombre), radiusSolar: star.datos.radiusSolar,
      temperatureK: star.datos.temperatureK || star.physics.temperatureK, fuente: star.datos.fuentes?.radiusSolar }))
    .sort((a, b) => b.radiusSolar - a.radiusSolar);
  if (candidatas.length === estado.candidatas.length) return;
  estado = { ...estado, candidatas };
  avisar();
}
export const destacadas = candidatas => DESTACADAS.map(nombre => candidatas.find(estrella => estrella.catalogo === nombre || estrella.catalogo.startsWith(`${nombre} `))).filter(Boolean);
export function mostrarComparacion(estrella) {
  if (estado.mostrada === estrella) return;
  estado = { ...estado, mostrada: estrella };
  avisar();
}
export function elegirComparacion(estrella) {
  estado = { ...estado, elegida: estrella && estrella.id !== 'sol' ? estrella : null };
  avisar();
}

// Cuánto mide en UA y la primera órbita de planeta que quedaría fuera de su superficie.
export function alcance(radiusSolar) {
  const ua = radiusSolar * UA_POR_RADIO_SOLAR;
  return { ua, primeraFuera: PLANETS.find(planeta => planeta.au >= ua) };
}
// Hasta unos 10 R☉ se compara con el contorno del Sol: es la razón de los radios publicados.
// Segundos que tarda la estrella en pasar de un tamaño y color al otro.
export const DURACION_CAMBIO_S = 1.2;
export const CONTORNO_SOLAR_HASTA = 10;
export const numeroRadio = valor => valor.toLocaleString('es-CL', { maximumSignificantDigits: valor >= 100 ? 4 : 3 });
