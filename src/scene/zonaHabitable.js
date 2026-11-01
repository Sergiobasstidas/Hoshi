// Zona habitable de Kopparapu et al. (2013), ApJ 765, 131: flujo efectivo en cada límite según la
// temperatura de la estrella. Conservadora: efecto invernadero húmedo y máximo; optimista: Venus
// reciente y Marte temprano. Validez: de 2.600 a 7.200 K; las algo más frías usan el borde de 2.600 K.
const LIMITES = {
  venus: [1.7753, 1.4316e-4, 2.9875e-9, -7.5702e-12, -1.1635e-15],
  humedo: [1.014, 8.1774e-5, 1.7063e-9, -4.3241e-12, -6.6462e-16],
  maximo: [0.3438, 5.8942e-5, 1.6558e-9, -3.0045e-12, -5.2983e-16],
  marte: [0.3179, 5.4513e-5, 1.5313e-9, -2.7786e-12, -4.8997e-16],
};
const ORBITAS = [['Mercurio', 0.387], ['Venus', 0.723], ['la Tierra', 1], ['Marte', 1.524], ['Júpiter', 5.2], ['Saturno', 9.58], ['Urano', 19.2], ['Neptuno', 30.1]];

export function zonaHabitable(temperaturaK, luminosidadSolar) {
  if (!(temperaturaK >= 2300 && temperaturaK <= 7200 && luminosidadSolar > 0)) return null;
  const t = Math.max(temperaturaK, 2600) - 5780;
  const distancia = ([s, a, b, c, d]) => Math.sqrt(luminosidadSolar / (s + a * t + b * t ** 2 + c * t ** 3 + d * t ** 4));
  return { optimistaInterior: distancia(LIMITES.venus), interior: distancia(LIMITES.humedo), exterior: distancia(LIMITES.maximo), optimistaExterior: distancia(LIMITES.marte) };
}
export const zonaDeEstrella = (star, fichas) => zonaHabitable(star?.physics?.temperatureK ?? star?.datos?.temperatureK,
  star?.physics?.luminositySolar ?? star?.datos?.luminositySolar ?? fichas?.anfitrionas[star?.planetary?.[0]?.name]?.luminosidad);
export const enZonaHabitable = (zona, ua) => Boolean(zona && ua >= zona.interior && ua <= zona.exterior);
const orbitaCercana = ua => ORBITAS.reduce((a, b) => Math.abs(Math.log(b[1] / ua)) < Math.abs(Math.log(a[1] / ua)) ? b : a)[0];
export function comparacionSolar(zona) {
  if (zona.exterior < 0.3) return 'Mucho más cerca de su estrella que Mercurio del Sol';
  const [desde, hasta] = [orbitaCercana(zona.interior), orbitaCercana(zona.exterior)];
  return desde === hasta ? `En el sistema solar, cerca de la órbita de ${desde}` : `En el sistema solar, de ${desde} a ${hasta}`;
}
