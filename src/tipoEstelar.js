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

// Textos de las fichas sin texto propio para las estrellas que dejaron la secuencia principal, por la misma clase que da
// el nombre de la línea de tipo. Las enanas, subenanas y enanas blancas usan el de su letra (TIPOS, SUBENANA).
export const TEXTOS_CLASE = {
  Hipergigante: 'Las hipergigantes están entre las estrellas más luminosas que se conocen, hasta millones de veces más que el Sol. Son inestables y pierden masa a gran ritmo.',
  'Supergigante roja': 'Las supergigantes rojas son estrellas muy infladas en una de sus últimas etapas. Entre ellas están las más grandes que se conocen, de más de mil veces el tamaño del Sol. La mayoría tiene gran masa y terminará como supernova.',
  Supergigante: 'Una supergigante es una estrella mucho más grande y luminosa que el Sol. La mayoría tiene gran masa y vive solo millones de años, no miles de millones como él.',
  'Gigante roja o naranja': 'Las gigantes rojas y anaranjadas son estrellas que agotaron el hidrógeno de su centro y se inflaron: miden desde varias hasta cientos de veces el tamaño del Sol, que empezará a convertirse en una dentro de unos cinco mil millones de años.',
  Gigante: 'Una gigante es más grande y luminosa que una estrella común de su mismo color. Casi todas se inflaron al gastar el hidrógeno de su centro.',
  Subgigante: 'Una subgigante brilla algo más que una estrella común de su mismo color, pero menos que una gigante. Casi todas se inflan al gastar el hidrógeno de su centro.',
};
const textoClase = (grupo, letra) => grupo === 'Supergigante' && letra === 'M' ? TEXTOS_CLASE['Supergigante roja']
  : grupo === 'Gigante' && (letra === 'K' || letra === 'M') ? TEXTOS_CLASE['Gigante roja o naranja'] : TEXTOS_CLASE[grupo];

// Clase de luminosidad: la primera en el tipo, para no confundirla con anomalías que vienen después («CaI wk», «CN1b»
// escrito «CNIb», «(SI)» de silicio): un grupo de I y V que no siga a una mayúscula ni a un símbolo químico («Ca», «Fe»).
// I (Ia, Iab, Ib) → «Supergigante»; 0-Ia, Ia0 o Ia+ → «Hipergigante»; las intermedias con II («Ib-II», «Ib/II», «I-II»)
// → «Gigante»; IV → «Subgigante» (en la letra M, enana: son enanas jóvenes, como WW PsA); III y II → «Gigante».
// Sin clase reconocible, ninguna.
const primeraClase = luminosidad => luminosidad.match(/(?<![A-Z][a-z]|[A-Z]|[IV])(III|II|IV|VI|V|I)(a\+|a-?0|ab|a|b)?([-/]II(?!I))?/);
function claseGigante(luminosidad, letra) {
  if (/(?<![\d.])0-Ia/.test(luminosidad)) return 'Hipergigante';
  const clase = primeraClase(luminosidad);
  if (!clase || clase[1] === 'V' || clase[1] === 'VI') return null; // «K0/1V+G(III)»: la primera es una enana
  if (clase[1] === 'IV') return letra === 'M' ? null : 'Subgigante';
  if (clase[1] !== 'I' || clase[3]) return 'Gigante';
  return /^(a\+|a-?0)$/.test(clase[2] || '') ? 'Hipergigante' : 'Supergigante';
}

// Magnitud absoluta por encima de la cual el tipo contradice el brillo, con márgenes amplios por el polvo. Las
// hipergigantes y supergigantes a menos de 1 kpc (poco polvo por delante) usan un tope más estricto, 0.
export const TOPE_ABSOLUTA = { Hipergigante: 2, Supergigante: 2, Gigante: 4.5, Subgigante: 6 };
export const TOPE_SUPERGIGANTE_CERCANA = 0, CERCANA_PC = 1000;
export const tipoContradiceBrillo = (espectro, absoluta, distanciaPc = Infinity) => {
  const grupo = tipoEstelar(espectro)?.grupo;
  if (!grupo || !Number.isFinite(absoluta)) return false;
  const cercana = (grupo === 'Hipergigante' || grupo === 'Supergigante') && distanciaPc < CERCANA_PC;
  return absoluta > (cercana ? TOPE_SUPERGIGANTE_CERCANA : TOPE_ABSOLUTA[grupo]);
};

// G, K y M sin una clase que se pueda creer (sin clase de luminosidad, o con una que contradice el brillo, y sin
// distancia buena o más brillantes que una enana): nombre y texto que no dicen si es enana o gigante.
export const NEUTRAS = {
  G: ['Estrella amarilla', 'Las estrellas de tipo G son amarillas, como el Sol. Pueden ser parecidas a él o gigantes mucho más grandes.'],
  K: ['Estrella naranja', 'Las estrellas de tipo K son anaranjadas y algo más frías que el Sol. Pueden ser enanas más pequeñas que él o gigantes mucho más grandes.'],
  M: ['Estrella roja', 'Las estrellas de tipo M son las más frías y rojas. Pueden ser enanas pequeñas, como la mayoría, o gigantes enormes.'],
};
// Magnitud absoluta mínima de una enana de cada letra: más brillante que esto, una «V» es dudosa y una G, K o M sin
// clase no se puede llamar enana. O sin límite.
export const LIMITE_ENANA = { B: -5.5, A: -1.5, F: 1, G: 3, K: 4, M: 6 };

// Clase de luminosidad que da el tipo: el grupo de gigantes, «V» (enana, también con prefijo «d»), «VI» (subenana) o null
// si no trae ninguna («K0», «M3e»).
export function claseLuminosidad(espectro) {
  const t = tipoEstelar(espectro);
  if (!t || t.clase === 'D') return null;
  if (t.grupo) return t.grupo;
  const sp = espectro.trim(), prefijo = sp.match(/^((?:[eu]?sd|d)(?:\/(?:[eu]?sd|d))*)(?=[OBAFGKM])/)?.[1] || '';
  if (/sd/.test(prefijo)) return 'VI';
  if (prefijo) return 'V';
  const propia = sp.split(/\+(?=[OBAFGKM])/)[0];
  const clase = primeraClase(propia.slice(1))?.[1];
  return clase === 'VI' ? 'VI' : clase ? 'V' : null;
}

// `sinClase`: el tipo del catálogo contradice el brillo y no hay otro que calce (public/data/tipos-revisados.json): solo el color.
// `neutra`: G, K o M sin clase creíble: nombre y texto neutros (NEUTRAS).
export function tipoEstelar(espectro, { sinClase = false, neutra = false } = {}) {
  const sp = espectro?.trim();
  if (!sp) return null;
  if (/^(WD|D[ABCOQZX])/.test(sp)) return { nombre: TIPOS.D[0], texto: TIPOS.D[1], clase: 'D' };
  // Prefijos de luminosidad de SIMBAD: «d», «sd», «esd», «usd», a veces combinados («d/sdM7»).
  const prefijo = sp.match(/^((?:[eu]?sd|d)(?:\/(?:[eu]?sd|d))*)(?=[OBAFGKM])/)?.[1] || '';
  const resto = sp.slice(prefijo.length);
  const letra = resto[0];
  const tipo = TIPOS[letra];
  if (!tipo || letra === 'D') return null;
  if (neutra && NEUTRAS[letra]) return { nombre: NEUTRAS[letra][0], texto: NEUTRAS[letra][1], clase: letra };
  if (/sd/.test(prefijo)) return { nombre: SUBENANAS[letra], texto: SUBENANA, clase: letra };
  if (prefijo) return { nombre: tipo[0], texto: tipo[1], clase: letra };
  // La clase es la de la primera estrella: lo que sigue a un «+» con letra espectral es una compañera («K9Ia+B2V»,
  // «B9.5+G8III»).
  const propia = resto.split(/\+(?=[OBAFGKM])/)[0];
  // Clase VI como primera («M1VIp», la Estrella de Kapteyn): subenana.
  if (primeraClase(propia.slice(1))?.[1] === 'VI') return { nombre: SUBENANAS[letra], texto: SUBENANA, clase: letra };
  // IV-V, IV/V, III/V y parecidos siguen como estrella común, también con anomalías pegadas («G1.5IV-VFe-1»).
  const gigante = /(I{1,3}|II|IV)(?![a-z]*V)/.test(propia.slice(1)) && !/\bV\b|(?<![IV])V(?=[A-Z])|III\/V/.test(propia);
  // Clase 0 escrita sola («G2_0», ρ Cas): hipergigante.
  const grupo = /_0(?![\d.])/.test(propia) ? 'Hipergigante' : gigante ? claseGigante(propia.slice(1), letra) : null;
  if (!grupo || sinClase) return { nombre: tipo[0], texto: tipo[1], clase: letra };
  return { nombre: tipo[0].replace(/^(Estrella|Enana)/, grupo), texto: textoClase(grupo, letra), clase: letra, grupo };
}
