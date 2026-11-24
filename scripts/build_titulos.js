// scripts/build_titulos.js
// Título de las estrellas que se nombran en la escena sin haber abierto el buscador: anfitrionas de exoplanetas
// (public/data/exoplanets.json) y estrellas de sistemas múltiples, primarias y compañeras con registro propio
// (data/processed/star_systems.json). El título es el primer nombre del buscador (public/data/star-search.json), el más
// conocido. Escribe public/data/titulos.json ([[id, título], …]), que se carga junto con los planetas; lo usa
// nombreEstrella (src/scene/nombresEstrella.js) por medio de src/scene/titulos.js. Si el título es un nombre propio
// (sin números, «Copernicus»), la fila trae además el nombre con que se nombran sus compañeras sin registro propio
// («55 Cnc» → «55 Cancri B»): [id, título, nombre para compañeras].
import fs from 'node:fs';
import { rangoNombre } from '../src/scene/nombresEstrella.js';

const nombresDe = new Map(JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8')).map(([id, nombres]) => [id, nombres]));
const NO_SIRVE = /^(AT-HYG|HSB|Gaia|TIC|2MASS|WISE|TYC|UCAC|GSC|LAMOST|SDSS|1RXS|APASS) /;
// Nombre para las compañeras: el primero con número que no sea un número de catálogo de todo el cielo.
// Bayer, Flamsteed y variables con letras («Lam Cas», «61 Cyg», «YZ Cet») sirven tal cual.
const paraCompaneras = nombres => /\d/.test(nombres[0]) || [1, 2, 4].includes(rangoNombre(nombres[0])) ? null
  : nombres.find(n => [1, 2].includes(rangoNombre(n))) || nombres.find(n => /\d/.test(n) && !NO_SIRVE.test(n)) || null;
const ids = new Set();
for (const sistema of JSON.parse(fs.readFileSync('public/data/exoplanets.json', 'utf8')).systems) ids.add(sistema.i);
for (const [id, sistema] of Object.entries(JSON.parse(fs.readFileSync('data/processed/star_systems.json', 'utf8')))) {
  ids.add(Number(id));
  for (const c of sistema.comps) if (c.cid !== undefined) ids.add(c.cid);
}
const salida = [...ids].sort((a, b) => a - b).flatMap(id => {
  const nombres = nombresDe.get(id);
  if (!nombres || /^(AT-HYG|HSB) /.test(nombres[0])) return [];
  const base = paraCompaneras(nombres);
  return [base ? [id, nombres[0], base] : [id, nombres[0]]];
});
const texto = JSON.stringify(salida);
if (!fs.existsSync('public/data/titulos.json') || fs.readFileSync('public/data/titulos.json', 'utf8') !== texto) fs.writeFileSync('public/data/titulos.json', texto);
console.log(`✓ Títulos: ${salida.length} estrellas (anfitrionas y sistemas múltiples) de ${ids.size}`);
