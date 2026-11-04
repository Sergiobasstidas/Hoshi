import { buildSearchIndex } from './scene/starSearch';
import { addCuratedSearchRows } from './scene/curatedStars';

const json = url => fetch(url).then(r => { if (!r.ok) throw Error('index'); return r.json(); });
// Suma a cada fila del catálogo los nombres de estrella variable, por ID. Si la estrella no tiene nombre
// propio, el de variable va primero: se lee «VY CMa» en vez de «HIP 35793».
function sumarVariables(rows, variables) {
  const porId = new Map(variables);
  return rows.map(([id, aliases]) => {
    const extra = porId.get(id);
    if (!extra) return [id, aliases];
    return [id, /^(HIP|HD|HR|Gl|GJ|AT-HYG) /.test(aliases[0]) ? [...extra, ...aliases] : [...aliases, ...extra]];
  });
}

// Índice de nombres del catálogo, compartido por el buscador y la ficha de estrella; incluye los
// nombres de estrellas variables (VY CMa), que pesan poco.
let cached;
export const indiceBusqueda = () => {
  cached ||= Promise.all([json('/data/star-search.json'), json('/data/star-search-variables.json').catch(() => [])])
    .then(([rows, variables]) => sumarVariables(rows, variables)).then(addCuratedSearchRows).then(buildSearchIndex).catch(e => { cached = null; throw e; });
  return cached;
};

// Números de Gaia DR3 y TIC (unos 2 MB comprimidos): solo se piden cuando se busca uno.
let numeros;
export const buscaNumeroDeCatalogo = clave => /^(gaia|dr3|tic)/.test(clave) || /^\d{6,}$/.test(clave);
export const indiceNumeros = () => {
  numeros ||= json('/data/star-search-numeros.json').then(rows => buildSearchIndex(rows)).catch(e => { numeros = null; throw e; });
  return numeros;
};
