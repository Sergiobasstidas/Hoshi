// Búsqueda de exoplanetas (public/data/planet-search.json, scripts/exoplanets/build_planet_search.js). Cada planeta se
// encuentra por su nombre, por sus nombres propios (Awohali, KOI-87.01, TOI-1796.01) y por cada nombre de su estrella
// seguido de su letra («Gliese 436 b», «Ross 905 b»). Los nombres de la estrella son los del índice de estrellas
// (indiceBusqueda.js) más los que trae el archivo, que también encuentran a la estrella. El archivo se pide la
// primera vez que se abre el buscador.
import { buildSearchIndex, searchStars } from './starSearch.js';

const INTERNO = /^(AT-HYG|HSB|HYG) /;
// Letra de componente al final de un nombre de estrella («HD 41004 B», «Gl 559A», «** HDS 814A»).
const COMPONENTE = /[\d\s]([A-E])$/;

// Nombres de estrella con que se arma «nombre + letra del planeta». Si la anfitriona es una componente (B en HD 41004 B),
// solo los de esa componente, y los del sistema con y sin su letra («HD 41004 B b», «HD 41004 b»): «HD 41004 A b» es
// el planeta de la otra estrella.
export function prefijosDeEstrella(nombres, componente) {
  if (!componente) return nombres;
  return nombres.flatMap(n => {
    const letra = COMPONENTE.exec(n)?.[1];
    return letra ? (letra === componente ? [n] : []) : [n, `${n} ${componente}`];
  });
}

// Una sola letra al final: mayúscula es una componente estelar («GJ 229 B») y minúscula un planeta («GJ 229 b»), como
// en starSearch.js. Devuelve cuánto se suma al puntaje de planetas y de estrellas para ese orden.
export function ordenPorLetra(consulta) {
  const letra = /(?:^|[\d\s])([A-Za-z])\s*$/.exec(consulta.trim())?.[1];
  if (!letra) return { planeta: 0, estrella: 0 };
  return letra === letra.toUpperCase() ? { planeta: 1, estrella: 0 } : { planeta: 0, estrella: 1 };
}

// Índices de planetas y de los nombres nuevos de las estrellas. `estrellas`: el índice de estrellas (filas con id y aliases).
export function indicesDePlanetas(datos, estrellas) {
  const porId = new Map(estrellas.map(fila => [fila.id, fila]));
  const filasPlanetas = [], filasEstrellas = [], planetaDe = new Map();
  for (const [estrellaId, nombresNuevos, planetas, componente = ''] of datos) {
    const fila = porId.get(estrellaId);
    const nombresEstrella = [...(fila?.aliases || []).filter(n => !INTERNO.test(n)), ...nombresNuevos];
    if (fila && nombresNuevos.length) filasEstrellas.push([estrellaId, nombresNuevos]);
    const prefijos = prefijosDeEstrella(nombresEstrella, componente);
    for (const [nombre, letra, propios] of planetas) {
      const id = `planeta-${nombre}`;
      filasPlanetas.push([id, [...new Set([nombre, ...propios, ...prefijos.map(n => `${n} ${letra}`)])]]);
      planetaDe.set(id, { nombre, estrellaId, estrella: fila?.aliases[0] || nombre.replace(/ \S+$/, '') });
    }
  }
  return { planetas: buildSearchIndex(filasPlanetas), estrellas: buildSearchIndex(filasEstrellas), planetaDe, porId };
}

let pedido;
export const cargarPlanetas = () => {
  pedido ||= fetch('/data/planet-search.json').then(r => { if (!r.ok) throw Error('planetas'); return r.json(); })
    .catch(error => { pedido = null; throw error; });
  return pedido;
};

// Planetas que calzan con la consulta, como filas del buscador (mismos puntajes que las estrellas; sin «Quizás»).
export function buscarPlanetas(indices, consulta, maximo = 4) {
  if (!indices) return [];
  return searchStars(indices.planetas, consulta, maximo).filter(r => r.score < 3).map(r => ({ ...r, planeta: indices.planetaDe.get(r.id) }));
}
// Estrellas anfitrionas encontradas solo por un nombre que trae el archivo de planetas (Ross 905), como filas del índice
// de estrellas.
export function buscarAnfitrionas(indices, consulta, maximo = 3) {
  if (!indices) return [];
  return searchStars(indices.estrellas, consulta, maximo).filter(r => r.score < 3)
    .map(r => ({ ...indices.porId.get(r.id), score: r.score, matched: r.matched }));
}
