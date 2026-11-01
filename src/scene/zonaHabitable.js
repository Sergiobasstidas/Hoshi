import { AU_TO_PC } from './scale.js';

// Zona habitable de Kopparapu et al. (2013), ApJ 765, 131: flujo efectivo en cada límite según la
// temperatura de la estrella. Conservadora: efecto invernadero húmedo y máximo; optimista: Venus
// reciente y Marte temprano. Validez: de 2.600 a 7.200 K; las algo más frías usan el borde de 2.600 K.
const LIMITES = {
  venus: [1.7753, 1.4316e-4, 2.9875e-9, -7.5702e-12, -1.1635e-15],
  humedo: [1.014, 8.1774e-5, 1.7063e-9, -4.3241e-12, -6.6462e-16],
  maximo: [0.3438, 5.8942e-5, 1.6558e-9, -3.0045e-12, -5.2983e-16],
  marte: [0.3179, 5.4513e-5, 1.5313e-9, -2.7786e-12, -4.8997e-16],
};

export function zonaHabitable(temperaturaK, luminosidadSolar) {
  if (!(temperaturaK >= 2300 && temperaturaK <= 7200 && luminosidadSolar > 0)) return null;
  const t = Math.max(temperaturaK, 2600) - 5780;
  const distancia = ([s, a, b, c, d]) => Math.sqrt(luminosidadSolar / (s + a * t + b * t ** 2 + c * t ** 3 + d * t ** 4));
  return { luminosidad: luminosidadSolar, optimistaInterior: distancia(LIMITES.venus), interior: distancia(LIMITES.humedo), exterior: distancia(LIMITES.maximo), optimistaExterior: distancia(LIMITES.marte) };
}
export const zonaDeEstrella = (star, fichas) => zonaHabitable(star?.physics?.temperatureK ?? star?.datos?.temperatureK,
  star?.physics?.luminositySolar ?? star?.datos?.luminositySolar ?? fichas?.anfitrionas[star?.planetary?.[0]?.name]?.luminosidad);
export const enZonaHabitable = (zona, ua) => Boolean(zona && ua >= zona.interior && ua <= zona.exterior);
export const numeroZona = ua => ua.toLocaleString('es-CL', { maximumSignificantDigits: 2 });
export const planetasDentro = cuantos => `${cuantos} ${cuantos === 1 ? 'planeta' : 'planetas'} dentro`;
// Luz en un borde, en % de la que recibe la Tierra.
export const luzEnBorde = (ua, zona) => Math.round(zona.luminosidad / ua ** 2 * 100);
// Tercera ley de Kepler: período de una órbita en ese borde, en días o años. Sin masa, nada.
export function anoEnBorde(ua, masaSolar) {
  if (!(masaSolar > 0)) return null;
  const anos = Math.sqrt(ua ** 3 / masaSolar), dias = anos * 365.25;
  return dias < 365 ? { valor: Math.round(dias).toLocaleString('es-CL'), unidad: 'días' }
    : { valor: anos.toLocaleString('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 }), unidad: 'años' };
}
// Encuadre al llegar a un sistema con planetas: el plano de las órbitas en diagonal, con el planeta
// más externo y la zona a la vista. Un planeta a más de 10 veces el borde de la zona no cuenta:
// dejaría todo lo demás diminuto.
const DISTANCIA_POR_RADIO = 2.13, PLANETA_LEJANO = 10;
export function encuadreDeSistema(star, fichas) {
  const sistema = star?.planetary?.[0];
  if (!sistema || sistema.binary || star.system) return null;
  const zona = zonaDeEstrella(star, fichas), borde = zona?.optimistaExterior || 0;
  const orbitas = sistema.planets.map(planeta => planeta.a).filter(a => a > 0);
  const cercanas = borde ? orbitas.filter(a => a <= borde * PLANETA_LEJANO) : orbitas;
  const radio = Math.max(borde, ...cercanas);
  if (!(radio > 0)) return null;
  return { distance: radio * DISTANCIA_POR_RADIO * AU_TO_PC, direction: sistema.viewDirection, up: sistema.viewUp };
}
