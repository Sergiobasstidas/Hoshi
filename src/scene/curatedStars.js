const ETA_CARINAE_DISTANCE_PC = 7500 / 3.26156;
const ETA_CARINAE_RA_RAD = (10 + 45 / 60 + 3.545808 / 3600) * Math.PI / 12;
const ETA_CARINAE_DEC_RAD = -(59 + 41 / 60 + 3.95124 / 3600) * Math.PI / 180;

export const ETA_CARINAE_ID = -93308;

// Eta Carinae no figura en la exportación local de AT-HYG. Conservar este registro
// curado por separado para distinguir su origen y distancia aproximada del
// catálogo. Coordenadas: SIMBAD J2000. Distancia: referencia educativa de NASA.
export const ETA_CARINAE = {
  i: ETA_CARINAE_ID,
  n: 'Eta Carinae',
  x: ETA_CARINAE_DISTANCE_PC * Math.cos(ETA_CARINAE_DEC_RAD) * Math.cos(ETA_CARINAE_RA_RAD),
  y: ETA_CARINAE_DISTANCE_PC * Math.cos(ETA_CARINAE_DEC_RAD) * Math.sin(ETA_CARINAE_RA_RAD),
  z: ETA_CARINAE_DISTANCE_PC * Math.sin(ETA_CARINAE_DEC_RAD),
  d: ETA_CARINAE_DISTANCE_PC,
  // Derivado de SIMBAD V=6,48 y la distancia adoptada, sin corrección de extinción.
  // Solo controla el marcador de ubicación, nunca un radio físico.
  m: 6.48 - 5 * Math.log10(ETA_CARINAE_DISTANCE_PC / 10),
  c: null,
  sp: 'LBV + O',
  rgb: [184, 208, 255],
  dataOrigin: 'curated',
  source: 'https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Eta+Carinae',
  distanceSource: 'https://science.nasa.gov/asset/hubble/eta-carinae-observations-in-uv-light-uncover-magnesium-embedded-in-warm-gas/',
};

export const CURATED_STARS = [ETA_CARINAE];

export const CURATED_SEARCH_ROWS = [[ETA_CARINAE_ID, [
  'Eta Carinae', 'Eta Car', 'η Carinae', 'η Car', 'HD 93308', 'HR 4210',
  'SAO 238429', 'Gaia DR3 5350358584482202880', 'TIC 458859916',
  '2MASS J10450360-5941040', 'CPD-59 2620', 'WDS J10451-5941',
  'IRAS 10431-5925', 'V* eta Car',
]]];

export function addCuratedSearchRows(rows) {
  const ids = new Set(rows.map(([id]) => id));
  return [...rows, ...CURATED_SEARCH_ROWS.filter(([id]) => !ids.has(id))];
}
