// Magnitudes que muestra la ficha de una estrella. La aparente es la medida: sale de la absoluta y la distancia con que se
// guardó la estrella. En un miembro de un cúmulo globular (`cumulo` con su distancia `d` en pc), todo lo que depende de la
// distancia se calcula con la del cúmulo, no con la profundidad propia con que se dibuja en 3D
// (scripts/catalog/globulares.js), que no está medida estrella por estrella.
export function magnitudesFicha(star, cumulo = null) {
  if (!Number.isFinite(star.m) || !(star.d > 0)) return null;
  const aparente = star.m + 5 * Math.log10(star.d / 10);
  const distanciaPc = cumulo?.d > 0 ? cumulo.d : star.d;
  return { aparente, absoluta: aparente - 5 * Math.log10(distanciaPc / 10), distanciaPc };
}
