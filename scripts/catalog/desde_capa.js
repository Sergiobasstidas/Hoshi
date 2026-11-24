// scripts/catalog/desde_capa.js
// Estrellas que pasaron de la capa de fondo al catálogo: miembros de cúmulos globulares (build_globulares.js) y estrellas
// famosas (build_famosas.js). Su fuente de la capa no se quita: queda en su lugar, oculta (build_estrellas.js) y fuera del
// buscador (build_capa_busqueda.js), para que no cambien los índices de la capa ni sus trozos.
import fs from 'node:fs';
import { ADDED_GLOBULARES_JSON } from './globulares.js';
import { ADDED_FAMOSAS_JSON } from './famosas.js';

export const ORIGENES_DESDE_CAPA = new Set(['globular', 'famosa']);
export const ARCHIVOS_DESDE_CAPA = [ADDED_GLOBULARES_JSON, ADDED_FAMOSAS_JSON];
export const estrellasDesdeCapa = () => ARCHIVOS_DESDE_CAPA.flatMap(ruta => fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')).stars : []);
export const idsDesdeCapa = () => new Set(estrellasDesdeCapa().map(s => s.i));
