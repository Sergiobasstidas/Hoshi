// Diámetros angulares medidos del JMDC (JMMC Measured stellar Diameters Catalog, Duvert 2016,
// http://jmdc.jmmc.fr/): interferometría óptica, interferometría de intensidad y ocultaciones lunares.
// Se ejecuta a mano y escribe data/catalog/jmdc_diametros.json con la mejor medida de cada estrella:
// diámetro con oscurecimiento del borde y su error (hasta 10 %), con artículo citado, sin las marcadas como
// binarias ni las que salen de un modelo.
import fs from 'node:fs';

const html = await (await fetch('http://jmdc.jmmc.fr/', { signal: AbortSignal.timeout(180000) })).text();
const columnas = ['id1', 'id2', 'ud', 'ld', 'eld', 'band', 'mu', 'method', 'bandcode', 'notes', 'bibcode', 'sinpe'];
const texto = valor => valor.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&#34;/g, '"').trim();
const filas = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  .map(fila => [...fila[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(celda => texto(celda[1])))
  .filter(celdas => celdas.length === columnas.length)
  .map(celdas => Object.fromEntries(columnas.map((columna, i) => [columna, celdas[i]])));
if (filas.length < 1000) throw Error(`JMDC: solo ${filas.length} filas`);

const METODO = { 1: 'interferometría óptica', 2: 'ocultación lunar', 3: 'interferometría de intensidad' };
const mejor = new Map();
for (const fila of filas) {
  const hd = fila.id1.match(/^HD\s*(\d+)/)?.[1], ld = Number(fila.ld), error = Number(fila.eld);
  if (!hd || !(ld > 0) || !(error > 0) || error / ld > 0.1 || !/^\d{4}[A-Za-z&]/.test(fila.bibcode) || /binar|model/i.test(fila.notes)) continue;
  const previa = mejor.get(hd);
  if (!previa || error / ld < previa.error / previa.ld) mejor.set(hd, { hd: Number(hd), ld, error, metodo: METODO[fila.method] || fila.method, bibcode: fila.bibcode });
}
fs.writeFileSync('data/catalog/jmdc_diametros.json', JSON.stringify({
  meta: { fuente: 'JMDC, Duvert 2016 (VizieR II/345), http://jmdc.jmmc.fr/', descargado: new Date().toISOString(),
    criterio: 'diámetro LD en mas con error de hasta 10 % y bibcode; sin notas de binaria ni de modelo; por estrella, el de menor error relativo' },
  estrellas: [...mejor.values()].sort((a, b) => a.hd - b.hd),
}));
console.log(`JMDC: ${filas.length} medidas, ${mejor.size} estrellas con diámetro LD útil`);
