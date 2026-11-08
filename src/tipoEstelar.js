// Tipo de estrella para la ficha a partir del tipo espectral (AT-HYG, SIMBAD o NASA).
// Enana blanca solo con «D» mayúscula seguida de A, B, C, O, Q, Z o X (DA, DA2, DQ…) o con «WD». En SIMBAD el
// prefijo «d» minúscula marca una enana (clase V) y «sd», «esd» o «usd» una subenana (clase VI): «d/sdM7» es
// una enana roja subenana, no una enana blanca.

export const TIPOS = {
  O: ['Estrella azul', 'Las estrellas de tipo O son las más calientes y masivas, y también las más escasas. Consumen su combustible en pocos millones de años y terminan como supernovas.'],
  B: ['Estrella azul', 'Las estrellas de tipo B son calientes y luminosas, con varias veces la masa del Sol. Viven decenas o cientos de millones de años, mucho menos que el Sol.'],
  A: ['Estrella blanca', 'Las estrellas de tipo A son más calientes y masivas que el Sol, y suelen girar rápido. Sirio y Vega son de este tipo.'],
  F: ['Estrella blanca amarillenta', 'Las estrellas de tipo F son algo más calientes y masivas que el Sol, y viven algo menos que él.'],
  G: ['Estrella amarilla', 'Las estrellas de tipo G son como el Sol: brillan de forma estable durante unos diez mil millones de años.'],
  K: ['Enana naranja', 'Las estrellas de tipo K son algo más frías y pequeñas que el Sol, y viven más que él, varias decenas de miles de millones de años.'],
  M: ['Enana roja', 'Las enanas rojas son las estrellas más comunes de la galaxia. Son pequeñas y frías, y gastan su hidrógeno tan despacio que viven mucho más que la edad actual del universo.'],
  D: ['Enana blanca', 'Una enana blanca es el núcleo que queda cuando una estrella como el Sol agota su combustible: una masa parecida a la del Sol en un tamaño parecido al de la Tierra, que se enfría poco a poco.'],
};
const SUBENANA = 'Una subenana tiene muchos menos metales que el Sol: es de una generación antigua de estrellas y brilla algo menos que una estrella común de su mismo color.';
const SUBENANAS = { M: 'Subenana roja', K: 'Subenana naranja', G: 'Subenana amarilla', F: 'Subenana blanca amarillenta', A: 'Subenana blanca', B: 'Subenana azul', O: 'Subenana azul' };

export function tipoEstelar(espectro) {
  const sp = espectro?.trim();
  if (!sp) return null;
  if (/^(WD|D[ABCOQZX])/.test(sp)) return { nombre: TIPOS.D[0], texto: TIPOS.D[1], clase: 'D' };
  // Prefijos de luminosidad de SIMBAD: «d», «sd», «esd», «usd», a veces combinados («d/sdM7»).
  const prefijo = sp.match(/^((?:[eu]?sd|d)(?:\/(?:[eu]?sd|d))*)(?=[OBAFGKM])/)?.[1] || '';
  const resto = sp.slice(prefijo.length);
  const letra = resto[0];
  const tipo = TIPOS[letra];
  if (!tipo || letra === 'D') return null;
  if (/sd/.test(prefijo)) return { nombre: SUBENANAS[letra], texto: SUBENANA, clase: letra };
  if (prefijo) return { nombre: tipo[0], texto: tipo[1], clase: letra };
  const gigante = /(I{1,3}|II|IV)(?![a-z]*V)/.test(resto.slice(1)) && !/\bV\b/.test(resto);
  return { nombre: gigante ? tipo[0].replace(/^(Estrella|Enana)/, 'Gigante') : tipo[0], texto: tipo[1], clase: letra };
}
