// Nombres de las estrellas de la capa de fondo: tipo, orden en la ficha y clave de búsqueda (la misma que da
// normalizeStarQuery para estos catálogos, pero sin sus reemplazos lentos; build_capa_busqueda.js lo comprueba).
const TIPOS = [
  ['HD', /^HD \d/], ['HR', /^HR \d/], ['HIP', /^HIP \d/], ['GJ', /^(GJ|Gl) /], ['SAO', /^SAO \d/], ['BD', /^BD[+-]\d/],
  ['CD', /^CD-\d/], ['CPD', /^CPD-\d/], ['TYC', /^TYC \d/], ['WDS', /^WDS J/],
];
// Nombre de estrella variable del GCVS: «V1234 Ori», «AB Dor».
const VARIABLE = /^(V\d+|[A-Z]{1,2}) [A-Z][A-Za-z]{2}$/;
export function tipoNombre(nombre) {
  for (const [tipo, re] of TIPOS) if (re.test(nombre)) return tipo;
  return VARIABLE.test(nombre) ? 'V*' : 'NAME';
}
// Orden de la ficha: nombre propio, variable, HD, HR, HIP, GJ, SAO, BD, CD, CPD, TYC y WDS.
const ORDEN = ['NAME', 'V*', 'HD', 'HR', 'HIP', 'GJ', 'SAO', 'BD', 'CD', 'CPD', 'TYC', 'WDS'];
export const ordenNombres = nombres => nombres.map((n, k) => [ORDEN.indexOf(tipoNombre(n)), k, n]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(f => f[2]);
// «BD+07 948» → «bdp07948», «CD-23 1234» → «cdm231234», «GJ 3885» → «gl3885», «TYC 55-28-1» → «tyc55281».
export const claveCatalogo = nombre => nombre.toLowerCase().replace(/^(bd|cd|cpd)\s*([+-])/, (_, c, s) => `${c}${s === '+' ? 'p' : 'm'}`)
  .replace(/^gj\b/, 'gl').replace(/[^a-z0-9]/g, '');
