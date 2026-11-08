// scripts/catalog/enlaces_registro.js
// Correcciones de enlace del registro HSB (data/catalog/hsb_enlaces.csv: hsb, campo, valor, motivo). Las propone la
// auditoría (scripts/catalog/auditoria/enlaces.js) y el archivo solo crece. build_hsb.js las aplica al registro, y
// quien lee el registro las aplica también al leerlo, para que una misma corrida del catálogo use ya los enlaces
// corregidos. Campos:
//   gaia_dr3  Gaia DR3 de la estrella (vacío: se quita y queda gaia_revisar = 1)
//   hip, hd   número de Hipparcos o Henry Draper (vacío: se quita)
//   cns5      fila de CNS5 (gj_id + componente) para la escalera de distancias
//   igual_a   la estrella es la misma que otra del registro: queda «retirada» apuntando a esa
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

export const ENLACES_CSV = 'data/catalog/hsb_enlaces.csv';
export const COLUMNAS_ENLACES = ['hsb', 'campo', 'valor', 'motivo'];

export function leerEnlaces(ruta = ENLACES_CSV) {
  if (!fs.existsSync(ruta)) return [];
  return parse(fs.readFileSync(ruta, 'utf8'), { columns: true, skip_empty_lines: true });
}

// Map hsb → { campo: valor }.
export function enlacesPorEstrella(filas = leerEnlaces()) {
  const mapa = new Map();
  for (const f of filas) { const h = Number(f.hsb); if (!mapa.has(h)) mapa.set(h, {}); mapa.get(h)[f.campo] = f.valor; }
  return mapa;
}

// Aplica las correcciones a una fila (del registro o una identidad de build_hsb). Devuelve si cambió algo.
export function corregirFila(fila, c) {
  if (!c) return false;
  if ('gaia_dr3' in c) { fila.gaia_dr3 = c.gaia_dr3; fila.gaia_revisar = c.gaia_dr3 ? '' : '1'; }
  for (const campo of ['hip', 'hd', 'cns5', 'igual_a']) if (campo in c) fila[campo] = c[campo];
  if (c.igual_a) fila.estado = 'retirada';
  return true;
}

// Registro leído (Map hsb → fila) con las correcciones aplicadas.
export function aplicarEnlaces(registro, enlaces = enlacesPorEstrella()) {
  for (const [hsb, c] of enlaces) { const f = registro.get(hsb) ?? registro.get(String(hsb)); if (f) corregirFila(f, c); }
  return registro;
}

// Estrellas que son la misma que otra del registro (no entran al catálogo).
export const retiradasPorEnlace = (enlaces = enlacesPorEstrella()) => new Set([...enlaces].filter(([, c]) => c.igual_a).map(([h]) => h));
