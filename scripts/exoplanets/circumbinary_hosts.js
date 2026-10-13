// scripts/exoplanets/circumbinary_hosts.js
// Binarias anfitrionas de planetas circumbinarios. Las tablas de la NASA (pscomppars,
// stellarhosts) no traen la órbita de la binaria y solo a veces la secundaria: esta tabla
// curada la toma del artículo de cada sistema. La clave es el `hostname` del archivo.
// Lo que no esté publicado queda en null y la ficha lo declara; nada se rellena aquí.
//
// Campos: names (las dos estrellas), m (M☉), r (R☉) y teff (K) de [A, B]; null en A
// hereda el valor del archivo. P en días, a en UA (suma de los dos semiejes), e, inc y w
// en grados. `w` sigue la convención de eclipses y velocidad radial: B pasa por delante de
// A (eclipse primario) en la anomalía verdadera 90° − w. `node` solo si se midió (órbita
// visual). `t`: ['t0', JD del eclipse primario] o ['tp', JD del periastro]; null si la
// fase no se incorporó. `s`: lo que no es una medida publicada (ver BINARY_ASSUMPTIONS en
// src/scene/exoplanetOrbit.js). Sin `P` el par no se separa: solo se informa en la ficha.
//
// Procedencia de cada fila, consultada el 13/10/2026: «tabla» = tabla de parámetros del
// artículo (arXiv); «KEBC» = Kepler Eclipsing Binary Catalog (Villanova), época del
// eclipse primario; «resumen» = cifras citadas en el resumen o en una ficha secundaria.
// Las filas marcadas «sin contrastar» repiten los valores habituales de la bibliografía
// sin haber abierto la tabla original: revisarlas antes de usarlas para algo cuantitativo.

const doi = id => `https://doi.org/${id}`, arxiv = id => `https://arxiv.org/abs/${id}`;

export const CIRCUMBINARY_HOSTS = {
  // --- Binarias eclipsantes con solución fotodinámica ---
  // Doyle et al. 2011, tabla 1. Periastro: Sebastian et al. 2025 (vía la ficha de Wikipedia).
  // T de B: Haghighipour & Kaltenegger 2013.
  'Kepler-16': { names: ['Kepler-16 A', 'Kepler-16 B'], m: [0.6897, 0.20255], r: [0.6489, 0.22623], teff: [4450, 3311],
    P: 41.079220, a: 0.22431, e: 0.15944, inc: 90.3401, w: 263.464, t: ['tp', 2457573.0995], s: '',
    ref: 'Doyle et al. 2011', url: doi('10.1126/science.1210923') },
  // Welsh et al. 2012, tablas 1 y 2; ω de e·sen ω y e·cos ω.
  'Kepler-34': { names: ['Kepler-34 A', 'Kepler-34 B'], m: [1.0479, 1.0208], r: [1.1618, 1.0927], teff: [5913, 5867],
    P: 27.7958103, a: 0.22882, e: 0.52087, inc: 89.8584, w: 71.44, t: ['t0', 2454979.72308], s: '',
    ref: 'Welsh et al. 2012', url: doi('10.1038/nature10768') },
  'Kepler-35': { names: ['Kepler-35 A', 'Kepler-35 B'], m: [0.8877, 0.8094], r: [1.0284, 0.7861], teff: [5606, 5202],
    P: 20.733666, a: 0.17617, e: 0.1421, inc: 90.4238, w: 86.51, t: ['t0', 2454965.84580], s: '',
    ref: 'Welsh et al. 2012', url: doi('10.1038/nature10768') },
  // Orosz et al. 2012b, tablas 5 a 7. T de B = 0,5896 · T de A (cociente del ajuste).
  'Kepler-38': { names: ['Kepler-38 A', 'Kepler-38 B'], m: [0.949, 0.249], r: [1.757, 0.2724], teff: [5623, 3315],
    P: 18.79537, a: 0.1469, e: 0.1032, inc: 89.265, w: 268.68, t: ['t0', 2454952.872560], s: '',
    ref: 'Orosz et al. 2012', url: doi('10.1088/0004-637X/758/2/87') },
  // Orosz et al. 2019 (resumen); época: KEBC.
  'Kepler-47': { names: ['Kepler-47 A', 'Kepler-47 B'], m: [0.957, 0.342], r: [0.936, 0.338], teff: [5636, 3357],
    P: 7.4483648, a: 0.08145, e: 0.0288, inc: 89.613, w: 226.3, t: ['t0', 2454970.693646], s: '',
    ref: 'Orosz et al. 2019', url: doi('10.3847/1538-3881/ab0ca0') },
  // Schwamb et al. 2013, tablas 7 y 8 y resumen. Es el par interior de un sistema cuádruple.
  'PH1': { names: ['PH1 Aa', 'PH1 Ab'], m: [1.528, 0.408], r: [1.734, 0.378], teff: [6407, 3561],
    P: 20.000214, a: 0.1744, e: 0.2117, inc: 87.360, w: 217.6, t: ['t0', 2454967.81776], s: '',
    ref: 'Schwamb et al. 2013', url: doi('10.1088/0004-637X/768/2/127') },
  // Kostov et al. 2014 (resumen y texto); época: KEBC. a = (a/R_A)·R_A.
  'Kepler-413': { names: ['Kepler-413 A', 'Kepler-413 B'], m: [0.820, 0.542], r: [0.776, 0.484], teff: [4700, 3460],
    P: 10.116146, a: 0.1015, e: 0.037, inc: 87.33, w: 279.54, t: ['t0', 2454972.981520], s: '',
    ref: 'Kostov et al. 2014', url: doi('10.1088/0004-637X/784/1/14') },
  // Welsh et al. 2015. Época de la tabla 3 del preprint; el resto, sin contrastar con la versión publicada.
  'Kepler-453': { names: ['Kepler-453 A', 'Kepler-453 B'], m: [0.944, 0.1951], r: [0.833, 0.2150], teff: [5527, 3226],
    P: 27.322037, a: 0.18539, e: 0.0524, inc: 90.266, w: 263.05, t: ['t0', 2454965.425987], s: '',
    ref: 'Welsh et al. 2015', url: doi('10.1088/0004-637X/809/1/26') },
  // Kostov et al. 2016 (texto); época: KEBC, cuyo eclipse secundario en fase 0,5526 fija la convención de ω.
  'Kepler-1647': { names: ['Kepler-1647 A', 'Kepler-1647 B'], m: [1.2207, 0.9678], r: [1.7903, 0.9663], teff: [6210, 5770],
    P: 11.2588179, a: 0.1276, e: 0.1602, inc: 87.9164, w: 300.85, t: ['t0', 2454956.478952], s: '',
    ref: 'Kostov et al. 2016', url: doi('10.3847/0004-637X/827/1/86') },
  // Socia et al. 2020, tablas 2 y 3.
  'Kepler-1661': { names: ['Kepler-1661 A', 'Kepler-1661 B'], m: [0.841, 0.262], r: [0.762, 0.276], teff: [5100, 3585],
    P: 28.162539, a: 0.187, e: 0.112, inc: 88.76, w: 36.4, t: ['t0', 2454976.71820], s: '',
    ref: 'Socia et al. 2020', url: arxiv('2001.02840') },
  // Goldberg et al. 2023, tablas 1 y 2 (máxima verosimilitud). No publica el semieje.
  'Kepler-1660 A': { names: ['Kepler-1660 A', 'Kepler-1660 B'], m: [1.1366, 1.0820], r: [1.491, 1.299], teff: [6050, 6040],
    P: 18.610875, a: null, e: 0.5032, inc: 84.670, w: 108.34, t: ['t0', 2454966.861873], s: '',
    ref: 'Goldberg et al. 2023', url: doi('10.1093/mnras/stad2568') },
  // Kostov et al. 2020, tablas 3 y 4. T de B = 0,5516 · T de A.
  'TOI-1338 A': { names: ['TOI-1338 A', 'TOI-1338 B'], m: [1.127, 0.3128], r: [1.331, 0.3089], teff: [6040, 3332],
    P: 14.608559, a: 0.1321, e: 0.15603, inc: 89.696, w: 117.554, t: ['t0', 2458336.8242], s: '',
    ref: 'Kostov et al. 2020', url: doi('10.3847/1538-3881/ab8a48') },
  // Kostov et al. 2021, tablas 5 y 6 (familia 6 de soluciones) y temperaturas adoptadas.
  'TIC 172900988 Aa': { names: ['TIC 172900988 Aa', 'TIC 172900988 Ab'], m: [1.2384, 1.2020], r: [1.3844, 1.3112], teff: [6040, 5970],
    P: 19.658016, a: 0.191918, e: 0.44789, inc: 89.4077, w: 69.602, t: ['t0', 2458878.3386], s: '',
    ref: 'Kostov et al. 2021', url: doi('10.3847/1538-3881/ac223a') },
  // Baycroft et al. 2025, tablas 1 y 2. a = a_A + a_B. Sin temperatura de B.
  'BEBOP-3': { names: ['BEBOP-3 A', 'BEBOP-3 B'], m: [1.083, 0.2615], r: [1.414, 0.2811], teff: [6033, null],
    P: 13.2176657, a: 0.12077, e: 0.063255, inc: 88.7488, w: 280.88, t: ['tp', 2459756.1098], s: '',
    ref: 'Baycroft et al. 2025', url: arxiv('2506.14615') },
  // Triaud et al. 2025, tabla 1. a = a_A + a_B. Inclinación: solo el intervalo 88,5°–91,5°. Sin radios.
  'BEBOP-4 A': { names: ['BEBOP-4 A', 'BEBOP-4 B'], m: [1.507, 0.459], r: [null, null], teff: [null, null],
    P: 71.96857, a: 0.4241, e: 0.26887, inc: 90, w: 275.95, t: ['tp', 2459724.6183], s: 'i',
    ref: 'Triaud et al. 2025', url: arxiv('2510.25329') },

  // --- Binarias compactas tras envoltura común (enana blanca o subenana + enana roja) ---
  // Órbitas de horas, circularizadas. Los planetas se infieren de los tiempos de eclipse.
  // Parsons et al. 2010 (resumen): a = 0,934 R☉. Período: Beuermann et al. 2010.
  'NN Ser': { names: ['NN Ser A (enana blanca)', 'NN Ser B (enana roja)'], m: [0.535, 0.111], r: [0.0211, 0.149], teff: [57000, null],
    P: 0.13008017, a: 0.004344, e: 0, inc: 89.6, w: 0, t: null, s: 'cf',
    ref: 'Parsons et al. 2010', url: arxiv('0909.4307') },
  // Schwope et al. 2011 (resumen). Polar: la enana blanca acreta de su compañera.
  'HU Aqr': { names: ['HU Aqr A (enana blanca)', 'HU Aqr B (enana roja)'], m: [0.80, 0.18], r: [null, null], teff: [null, null],
    P: 0.0868204, a: null, e: 0, inc: 87, w: 0, t: null, s: 'cf',
    ref: 'Schwope et al. 2011', url: doi('10.1051/0004-6361/201016373') },
  // Bailey & Cropper 1991 (q = 0,2). Sin contrastar; la masa de la enana blanca es discutida (0,44–0,8 M☉).
  'UZ For': { names: ['UZ For A (enana blanca)', 'UZ For B (enana roja)'], m: [0.71, 0.14], r: [null, null], teff: [null, null],
    P: 0.087865425, a: null, e: 0, inc: 81, w: 0, t: null, s: 'cf',
    ref: 'Bailey y Cropper 1991', url: doi('10.1093/mnras/253.1.27') },
  // Schwope et al. 2002 (inclinación, citada por Beuermann et al. 2011). Masas sin contrastar.
  'DP Leo': { names: ['DP Leo A (enana blanca)', 'DP Leo B (enana roja)'], m: [0.6, 0.09], r: [null, null], teff: [null, null],
    P: 0.06236286, a: null, e: 0, inc: 79.5, w: 0, t: null, s: 'cf',
    ref: 'Schwope et al. 2002', url: doi('10.1051/0004-6361:20011651') },
  // Maxted et al. 2007 (masas, radio de B); enana blanca: Parsons et al. 2017. Inclinación sin contrastar.
  'RR Cae': { names: ['RR Cae A (enana blanca)', 'RR Cae B (enana roja)'], m: [0.440, 0.183], r: [0.01568, 0.209], teff: [7540, null],
    P: 0.3037036, a: null, e: 0, inc: 79.78, w: 0, t: null, s: 'cf',
    ref: 'Maxted et al. 2007', url: arxiv('astro-ph/0702005') },
  // van den Besselaar et al. 2007 (resumen). T de B: tabla de anfitrionas de la NASA (Han et al. 2018).
  'DE CVn': { names: ['DE CVn A (enana blanca)', 'DE CVn B (enana roja)'], m: [0.51, 0.41], r: [0.0136, 0.37], teff: [8000, 3400],
    P: 0.3641394, a: null, e: 0, inc: 86, w: 0, t: null, s: 'cf',
    ref: 'van den Besselaar et al. 2007', url: doi('10.1051/0004-6361:20066246') },
  // Vučković et al. 2007 y Charpinet et al. 2008 (vía fichas secundarias). Sin contrastar.
  'NY Vir': { names: ['NY Vir A (subenana B)', 'NY Vir B (enana roja)'], m: [0.459, 0.122], r: [0.151, 0.16], teff: [32780, 3000],
    P: 0.101016, a: null, e: 0, inc: 80.67, w: 0, t: null, s: 'cf',
    ref: 'Vučković et al. 2007', url: arxiv('0706.3363') },
  // Almeida et al. 2012 (valores de la tabla de anfitrionas de la NASA). Inclinación sin contrastar.
  'NSVS 14256825': { names: ['NSVS 14256825 A (subenana OB)', 'NSVS 14256825 B (enana roja)'], m: [0.419, 0.109], r: [0.188, 0.162], teff: [40000, 2550],
    P: 0.110374, a: null, e: 0, inc: 82.5, w: 0, t: null, s: 'cf',
    ref: 'Almeida et al. 2012', url: arxiv('1203.1266') },
  // Østensen et al. 2010 (masas); Esmer et al. 2022 (radios y temperaturas, tabla de la NASA). Kepler-451.
  '2MASS J19383260+4603591': { names: ['Kepler-451 A (subenana B)', 'Kepler-451 B (enana roja)'], m: [0.48, 0.12], r: [0.203, 0.168], teff: [29564, 2829],
    P: 0.1257653, a: null, e: 0, inc: 69.45, w: 0, t: null, s: 'cf',
    ref: 'Østensen et al. 2010', url: arxiv('1006.4267') },

  // --- Planetas fotografiados alrededor de una binaria ---
  // Dupuy et al. 2023, tabla 3: órbita visual completa (Ω medido). Solo masa total 0,141 M☉.
  // w = ω visual − 180°; periastro 2021,537.
  'VHS J125601.92-125723.9': { names: ['VHS 1256-1257 A', 'VHS 1256-1257 B'], m: [0.0705, 0.0705], r: [null, null], teff: [null, null],
    P: 7.307 * 365.25, a: 1.96, e: 0.8826, inc: 118.7, w: 224.9, node: 4.4, t: ['tp', 2459411.39], s: 'q',
    ref: 'Dupuy et al. 2023', url: arxiv('2208.08448') },
  // Órbita astrométrica según la ficha de Wikipedia de Ross 458 (13,63 años; 4,93 UA; e 0,245;
  // i 130,3°), sin contrastar con su fuente. Orientación de la elipse y fase sin incorporar.
  'Ross 458': { names: ['Ross 458 A', 'Ross 458 B'], m: [0.553, 0.0849], r: [null, null], teff: [null, null],
    P: 13.63 * 365.25, a: 4.93, e: 0.245, inc: 130.3, w: 0, t: null, s: 'wf',
    ref: 'órbita astrométrica de Ross 458 AB', url: 'https://en.wikipedia.org/wiki/Ross_458' },

  // --- Sin órbita incorporada: el par no se separa ---
  // Masas de la tabla de anfitrionas de la NASA y su referencia.
  'HD 143811 A': { names: ['HD 143811 A', 'HD 143811 B'], m: [1.30, 1.15], ref: 'Jones et al. 2025', url: arxiv('2509.06729'),
    note: 'binaria espectroscópica; su órbita no está incorporada' },
  '2MASS J01033563-5515561 A': { names: ['2MASS J0103-5515 A', '2MASS J0103-5515 B'], m: [0.19, 0.17], ref: 'Delorme et al. 2013', url: doi('10.1051/0004-6361/201321169'),
    note: 'par resuelto en imagen, sin órbita' },
  '2MASS J0249-0557 A': { names: ['2MASS J0249-0557 A', '2MASS J0249-0557 B'], m: [0.046, 0.042], ref: 'Dupuy et al. 2018', url: doi('10.3847/1538-3881/aacbc2'),
    note: 'par de enanas marrones resuelto en imagen, sin órbita' },
  'HD 284149 A': { names: ['HD 284149 A', 'HD 284149 B'], m: [1.13, 0.16], ref: 'Bonavita et al. 2017', url: doi('10.1051/0004-6361/201731003'),
    note: 'compañera resuelta en imagen, sin órbita' },
  'b Cen A': { names: ['b Cen A', 'b Cen B'], m: [5.5, null], ref: 'Janson et al. 2021', url: doi('10.1038/s41586-021-04124-8'),
    note: 'la secundaria no está caracterizada' },
  'HIP 79098 AB': { names: ['HIP 79098 A', 'HIP 79098 B'], m: [null, null], ref: 'Janson et al. 2019', url: doi('10.1051/0004-6361/201935687'),
    note: 'binaria espectroscópica sin órbita; solo se publica la masa conjunta' },
  'ROXs 42 B': { names: ['ROXs 42 B a', 'ROXs 42 B b'], m: [null, null], ref: 'Currie et al. 2014', url: doi('10.1088/2041-8205/780/2/L30'),
    note: 'binaria cerrada sin masas ni órbita en el archivo' },
  'WISPIT 1': { names: ['WISPIT 1 A', 'WISPIT 1 B'], m: [null, null], ref: 'van Capelleveen et al. 2025', url: 'https://exoplanetarchive.ipac.caltech.edu/overview/WISPIT%201',
    note: 'binaria sin masas ni órbita en el archivo' },
};
