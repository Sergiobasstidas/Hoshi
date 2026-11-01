import { buildSearchIndex } from './scene/starSearch';
import { addCuratedSearchRows } from './scene/curatedStars';

// Índice de nombres del catálogo, compartido por el buscador y la ficha de estrella.
let cached;
export const indiceBusqueda = () => {
  cached ||= fetch('/data/star-search.json').then(r=>{if(!r.ok)throw Error('index');return r.json();})
    .then(addCuratedSearchRows).then(buildSearchIndex).catch(e=>{cached=null;throw e;});
  return cached;
};
