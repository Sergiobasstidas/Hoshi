// Búsqueda de cúmulos (public/data/cumulos.json) por su nombre, el nombre entre paréntesis, sus catálogos
// («Messier 45» también como «M45» y «M 45») y los nombres de uso común. Sin tildes ni mayúsculas.
import { MIEMBROS_PARA_NOMBRE } from './datosCumulos.js';

// Nombres de uso común que no están en el catálogo, por id del cúmulo.
const ALIAS = {
  pleiades: ['Pleiades', 'Siete Cabritas'],
  hyades: ['Hyades'],
  ngc2632: ['Praesepe', 'Colmena', 'Beehive'],
  ngc5139: ['ω Centauri', 'Omega Cen', 'Omega Centauro', 'ω Cen', 'Mel 118'],
};

// «ω» se lee «omega»: «ω Cen» no queda como «cen».
const normalizar = texto => texto.toLowerCase().replace(/ω/g, 'omega').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

// Todos los nombres con que se encuentra un cúmulo; el primero es el que se muestra.
export function nombresDeCumulo(cumulo) {
  const nombres = [cumulo.nombre];
  const parentesis = /^(.*?)\s*\((.+)\)$/.exec(cumulo.nombre);
  if (parentesis) nombres.push(parentesis[1], parentesis[2]);
  for (const catalogo of cumulo.catalogos || []) {
    nombres.push(catalogo);
    const messier = /^Messier (\d+)$/.exec(catalogo);
    if (messier) nombres.push(`M${messier[1]}`);
  }
  nombres.push(...(ALIAS[cumulo.id] || []));
  return [...new Set(nombres)];
}

// Cúmulos que Hoshi muestra y que calzan con la consulta, como filas del buscador: puntaje 0 si un nombre es
// igual a lo escrito, 1 si empieza así y 2 si lo contiene (desde tres letras).
export function buscarCumulos(datos, consulta, maximo = 4) {
  const q = normalizar(consulta || '');
  if (!datos || q.length < 2) return [];
  const filas = [];
  for (const cumulo of datos.cumulos) {
    if (cumulo.ids.length < MIEMBROS_PARA_NOMBRE) continue;
    const nombres = nombresDeCumulo(cumulo);
    let mejor = null;
    for (const nombre of nombres) {
      const n = normalizar(nombre);
      const score = n === q ? 0 : n.startsWith(q) ? 1 : q.length >= 3 && n.includes(q) ? 2 : null;
      if (score !== null && (!mejor || score < mejor.score)) mejor = { score, matched: nombre };
    }
    if (mejor) filas.push({ id: `cumulo-${cumulo.id}`, aliases: nombres, cumulo, ...mejor });
  }
  return filas.sort((a, b) => a.score - b.score).slice(0, maximo);
}
