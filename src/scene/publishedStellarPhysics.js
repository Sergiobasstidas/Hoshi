import { SUN_RADIUS_KM, KM_TO_PC } from './scale.js';

// Ribas et al. (2017), A&A 603 A58, tabla 11. Conservar las incertidumbres
// publicadas; independiente de la aproximación B–V (no válida para enanas M).
export const PROXIMA_CATALOGUE_ID = 1436975;
export const PROXIMA_PHYSICS = {
  radiusSolar: 0.146, radiusUncertaintySolar: 0.007,
  radiusKm: 0.146 * SUN_RADIUS_KM, radiusPc: 0.146 * SUN_RADIUS_KM * KM_TO_PC,
  temperatureK: 2980, temperatureUncertaintyK: 80,
  luminositySolar: 0.00151, status: 'published',
  source: 'https://arxiv.org/abs/1704.08449', sourceLabel: 'Ribas et al. (2017) · tabla 11',
};
export const PUBLISHED_STELLAR_PHYSICS = { [PROXIMA_CATALOGUE_ID]: PROXIMA_PHYSICS };
