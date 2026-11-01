// Estrellas brillantes que Gaia y TIC saturan: valores tomados del resumen del artículo citado.
// Solo se agregan datos comprobados en la fuente; lo no comprobado queda vacío.
const DAVIS = 'Davis et al. 2011, arXiv:1010.3790';
const KERVELLA = 'Kervella et al. 2017, A&A 597, A137, arXiv:1610.06185';
const JOYCE = 'Joyce et al. 2020, ApJ, arXiv:2006.09837';
const RAMIREZ = 'Ramírez & Allende Prieto 2011, arXiv:1109.4425';
const OHNAKA = 'Ohnaka et al. 2013, arXiv:1304.4800';
const SCHILLER = 'Schiller & Przybilla 2008, arXiv:0712.0040';
const TORRES = 'Torres et al. 2015, arXiv:1505.07461';
const BOURET = 'Bouret et al. 2008, arXiv:0806.2162';

const GIAMMICHELE = 'Giammichele et al. 2012, ApJS 199, 29, arXiv:1202.5581';
const DOMICIANO_2021 = 'Domiciano de Souza et al. 2021, A&A, arXiv:2109.07153';
const KERVELLA_2022 = 'Kervella et al. 2022, A&A, arXiv:2209.07537';
const SHENAR = 'Shenar et al. 2015, ApJ 809, 135, arXiv:1503.03476';
const SOUTHWORTH = 'Southworth et al. 2007, A&A 467, 1215, arXiv:astro-ph/0703634';
const SHULL = 'Shull & Curran, aceptado en ApJ, arXiv:2412.06919';
const TKACHENKO = 'Tkachenko et al. 2016, MNRAS, arXiv:1601.08069';

export const ESTRELLAS_CURADAS = {
  Sirius: { radiusSolar: [1.713, DAVIS] },
  'Rigil Kentaurus': { radiusSolar: [1.2234, KERVELLA] },
  Toliman: { radiusSolar: [0.8632, KERVELLA] },
  Betelgeuse: { radiusSolar: [764, JOYCE] },
  Arcturus: { temperatureK: [4286, RAMIREZ], radiusSolar: [25.4, RAMIREZ], massSolar: [1.08, RAMIREZ] },
  Antares: { radiusSolar: [680, OHNAKA], temperatureK: [3660, OHNAKA], luminositySolar: [10 ** 4.88, OHNAKA], massSolar: [15, OHNAKA] },
  Deneb: { temperatureK: [8525, SCHILLER], radiusSolar: [203, SCHILLER], massSolar: [19, SCHILLER], luminositySolar: [1.96e5, SCHILLER] },
  Capella: { temperatureK: [4970, TORRES], radiusSolar: [11.98, TORRES], massSolar: [2.5687, TORRES] },
  Alnitak: { radiusSolar: [25, BOURET], massSolar: [40, BOURET] },
  "Van Maanen's Star": { temperatureK: [6215, GIAMMICHELE], temperatureUncertaintyK: [183, GIAMMICHELE], massSolar: [0.68, GIAMMICHELE], luminositySolar: [10 ** -3.77, GIAMMICHELE] },
  Canopus: { temperatureK: [7657, DOMICIANO_2021], temperatureUncertaintyK: [161, DOMICIANO_2021], radiusSolar: [73.2, DOMICIANO_2021], radiusUncertaintySolar: [3.9, DOMICIANO_2021] },
  Achernar: { temperatureK: [15539, KERVELLA_2022], temperatureUncertaintyK: [438, KERVELLA_2022], radiusSolar: [8.14, KERVELLA_2022], radiusUncertaintySolar: [0.26, KERVELLA_2022], luminositySolar: [3493, KERVELLA_2022] },
  Mintaka: { radiusSolar: [9.2, `${SHENAR}; valor para d = 212 pc, la distancia del catálogo`], radiusUncertaintySolar: [0.5, SHENAR] },
  Menkalinan: { radiusSolar: [2.762, SOUTHWORTH], radiusUncertaintySolar: [0.017, SOUTHWORTH], massSolar: [2.376, SOUTHWORTH] },
  Adhara: { radiusSolar: [10.7, SHULL], radiusUncertaintySolar: [0.7, SHULL], massSolar: [13.1, SHULL], temperatureK: [21000, SHULL], luminositySolar: [20000, SHULL] },
  Spica: { radiusSolar: [7.47, TKACHENKO], radiusUncertaintySolar: [0.54, TKACHENKO], massSolar: [11.43, TKACHENKO] },
};
