// Estrellas brillantes que Gaia y TIC saturan: valores tomados del resumen del artículo citado.
// Solo se agregan datos comprobados en la fuente; lo no comprobado queda vacío.
const DAVIS = 'Davis et al. 2011, arXiv:1010.3790';
const KERVELLA = 'Kervella et al. 2017, A&A 597, A137, arXiv:1610.06185';
const HAUBOIS = 'Haubois et al. 2009, A&A 508, 923, arXiv:0910.4167';
const AUFDENBERG = 'Aufdenberg et al. 2002, ApJ, arXiv:astro-ph/0201218';
const RAMIREZ = 'Ramírez & Allende Prieto 2011, arXiv:1109.4425';
const OHNAKA = 'Ohnaka et al. 2013, arXiv:1304.4800';
const SCHILLER = 'Schiller & Przybilla 2008, arXiv:0712.0040';
const TORRES = 'Torres et al. 2015, arXiv:1505.07461';
const BOURET = 'Bouret et al. 2008, arXiv:0806.2162';

const GIAMMICHELE = 'Giammichele et al. 2012, ApJS 199, 29, arXiv:1202.5581';
const DOMICIANO_2021 = 'Domiciano de Souza et al. 2021, A&A, arXiv:2109.07153';
const KERVELLA_2022 = 'Kervella et al. 2022, A&A, arXiv:2209.07537';
const SOUTHWORTH = 'Southworth et al. 2007, A&A 467, 1215, arXiv:astro-ph/0703634';
const SHULL = 'Shull & Curran, aceptado en ApJ, arXiv:2412.06919';
const TKACHENKO = 'Tkachenko et al. 2016, MNRAS, arXiv:1601.08069';
const MILLER_JONES = 'Miller-Jones et al. 2021, Science 371, 1046, arXiv:2102.09091';
const PUEBLA = 'Puebla et al. 2016, MNRAS 456, 2907, arXiv:1511.09365';
const BAINES = 'Baines et al. 2021, AJ 162, 198, arXiv:2211.09030';
const WITTKOWSKI = 'Wittkowski et al. 2012, A&A 540, L12, arXiv:1203.5194';
const ARROYO_TORRES = 'Arroyo-Torres et al. 2013, A&A 554, A76, arXiv:1305.6179';
const BARON = 'Baron et al. 2014, ApJ 785, 46, arXiv:1405.4032';

export const ESTRELLAS_CURADAS = {
  Sirius: { radiusSolar: [1.713, DAVIS] },
  'Rigil Kentaurus': { radiusSolar: [1.2234, KERVELLA] },
  Toliman: { radiusSolar: [0.8632, KERVELLA] },
  // Regla de radios: diámetro angular medido × distancia del catálogo, o binarias y órbitas; después
  // análisis espectral con una distancia a menos de 15 % de la del catálogo y, al final, catálogos.
  // Nunca modelos de evolución, sísmicos, de pulsación ni hidrodinámicos.
  // Distancias de Betelgeuse, VY CMa y el cinturón de Orión: scripts/catalog/distancias_curadas.js.
  Betelgeuse: { radiusSolar: [1056.9, `${HAUBOIS}; diámetro angular 44,28 ± 0,15 mas (IOTA) × distancia del catálogo, 222 pc (Harper et al. 2017)`] },
  Arcturus: { temperatureK: [4286, RAMIREZ], radiusSolar: [25.4, RAMIREZ] },
  Antares: { radiusSolar: [680, OHNAKA], temperatureK: [3660, OHNAKA], luminositySolar: [10 ** 4.88, OHNAKA] },
  // Schiller & Przybilla usan 802 pc y el catálogo 433 pc: de ellos solo se toma la temperatura.
  Deneb: { temperatureK: [8525, SCHILLER], radiusSolar: [128.5, `${AUFDENBERG}; diámetro angular 2,76 ± 0,06 mas (NPOI) × distancia del catálogo, 432,9 pc`] },
  Capella: { temperatureK: [4970, TORRES], radiusSolar: [11.98, TORRES], massSolar: [2.5687, TORRES] },
  // Bouret et al. usan 414 pc; el catálogo, 400 pc (Orión OB1b).
  Alnitak: { radiusSolar: [25, BOURET], massSolar: [40, BOURET], temperatureK: [29500, BOURET], temperatureUncertaintyK: [1000, BOURET] },
  "Van Maanen's Star": { temperatureK: [6215, GIAMMICHELE], temperatureUncertaintyK: [183, GIAMMICHELE], massSolar: [0.68, GIAMMICHELE], luminositySolar: [10 ** -3.77, GIAMMICHELE] },
  Canopus: { temperatureK: [7657, DOMICIANO_2021], temperatureUncertaintyK: [161, DOMICIANO_2021], radiusSolar: [73.2, DOMICIANO_2021], radiusUncertaintySolar: [3.9, DOMICIANO_2021] },
  Achernar: { temperatureK: [15539, KERVELLA_2022], temperatureUncertaintyK: [438, KERVELLA_2022], radiusSolar: [8.14, KERVELLA_2022], radiusUncertaintySolar: [0.26, KERVELLA_2022], luminositySolar: [3493, KERVELLA_2022] },
  // El radio de Shenar et al. 2015 es para 212 pc; con 400 pc (Orión OB1b) no sirve y queda vacío.
  Menkalinan: { radiusSolar: [2.762, SOUTHWORTH], radiusUncertaintySolar: [0.017, SOUTHWORTH], massSolar: [2.376, SOUTHWORTH] },
  Adhara: { radiusSolar: [10.7, SHULL], radiusUncertaintySolar: [0.7, SHULL], temperatureK: [21000, SHULL], luminositySolar: [20000, SHULL] },
  Spica: { radiusSolar: [7.47, TKACHENKO], radiusUncertaintySolar: [0.54, TKACHENKO], massSolar: [11.43, TKACHENKO] },
  // Ajuste del sistema binario con la distancia de paralaje en radio; el TIC le daba 52 R☉ y 9486 K.
  'Cygnus X-1': { radiusSolar: [22.3, MILLER_JONES], radiusUncertaintySolar: [1.8, MILLER_JONES], temperatureK: [31138, MILLER_JONES], massSolar: [40.6, MILLER_JONES] },
  Alnilam: { radiusSolar: [28.6, `${PUEBLA}; valor para d = 412 pc; el catálogo usa 400 pc (Orión OB1b)`] },
};

// Estrellas sin nombre propio en AT-HYG, por su ID; `nombre` es el que se muestra.
export const ESTRELLAS_CURADAS_POR_ID = {
  700584: { nombre: ['VY Canis Majoris', WITTKOWSKI], alias: ['VY CMa', WITTKOWSKI], radiusSolar: [1458, `${WITTKOWSKI}; diámetro angular 11,3 ± 0,3 mas (VLTI/AMBER) × distancia del catálogo, 1,2 kpc (Zhang et al. 2012)`],
    temperatureK: [3490, WITTKOWSKI], temperatureUncertaintyK: [90, WITTKOWSKI] },
  // UY Scuti (build_famosas.js): diámetro angular de Rosseland 5,48 ± 0,10 mas (VLTI/AMBER, banda K) × la distancia de Gaia
  // DR3 (1000 / 0,5166 mas = 1935,7 pc): R = 0,1075 × 5,48 × 1935,7 = 1140 R☉. Arroyo-Torres et al. usaron 2,9 kpc y daban
  // 1708 R☉; con la paralaje de Gaia queda en 1140 ± 111 R☉ (error del diámetro y de la paralaje).
  101351417: { radiusSolar: [1140, `${ARROYO_TORRES}; diámetro angular de Rosseland 5,48 ± 0,10 mas (VLTI/AMBER) × distancia de Gaia DR3 4152993273702130432, 1935,7 pc (paralaje 0,5166 ± 0,0494 mas)`],
    radiusUncertaintySolar: [111, `${ARROYO_TORRES} y Gaia DR3: error del diámetro angular y de la paralaje`],
    temperatureK: [3365, ARROYO_TORRES], temperatureUncertaintyK: [134, ARROYO_TORRES] },
  // RS Persei (famosas.js): diámetro con oscurecimiento del borde 3,05 ± 0,05 mas (CHARA/MIRC, banda H) × la distancia del
  // cúmulo NGC 884, 2494,4 pc (distancias_curadas.js); el error es solo el del diámetro.
  101351418: { radiusSolar: [818, `${BARON}; diámetro angular 3,05 ± 0,05 mas (CHARA/MIRC) × distancia del cúmulo NGC 884, 2494,4 pc (UCC)`],
    radiusUncertaintySolar: [13, `${BARON}: error del diámetro angular`],
    temperatureK: [3470, BARON], temperatureUncertaintyK: [90, BARON] },
  // La compañera B es unas 3,5 magnitudes más débil: casi no pesa en el diámetro medido.
  2368905: { nombre: ['VV Cephei A', BAINES], alias: ['VV Cep', BAINES], radiusSolar: [777, `${BAINES}; diámetro angular 7,251 ± 0,012 mas (NPOI) × distancia del catálogo, 996,7 pc`], temperatureK: [3396, BAINES], temperatureUncertaintyK: [35, BAINES], luminositySolar: [72881, BAINES] },
};
