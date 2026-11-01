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

export const ESTRELLAS_CURADAS = {
  Sirius: { radiusSolar: [1.713, DAVIS] },
  'Rigil Kentaurus': { radiusSolar: [1.2234, KERVELLA] },
  Toliman: { radiusSolar: [0.8632, KERVELLA] },
  Betelgeuse: { radiusSolar: [764, JOYCE] },
  Arcturus: { temperatureK: [4286, RAMIREZ], radiusSolar: [25.4, RAMIREZ], massSolar: [1.08, RAMIREZ] },
  Antares: { temperatureK: [3660, OHNAKA], luminositySolar: [10 ** 4.88, OHNAKA], massSolar: [15, OHNAKA] },
  Deneb: { temperatureK: [8525, SCHILLER], radiusSolar: [203, SCHILLER], massSolar: [19, SCHILLER], luminositySolar: [1.96e5, SCHILLER] },
  Capella: { temperatureK: [4970, TORRES], radiusSolar: [11.98, TORRES], massSolar: [2.5687, TORRES] },
  Alnitak: { radiusSolar: [25, BOURET], massSolar: [40, BOURET] },
};
