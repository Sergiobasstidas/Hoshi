// Opciones de F-07 por URL (solo en la rama f7-prototipos): ?f7=hoy|paso0|a|b (galaxia) y ?oort=hoy|o1|o2 (nube de Oort).
// «paso0» descarta las estrellas invisibles apiladas y apaga el cielo unido lejos; A y B lo incluyen.
const parametros = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
const leer = (clave, validas, omision) => { const v = parametros.get(clave); return validas.includes(v) ? v : omision; };
export const GALAXIA_F7 = leer('f7', ['hoy', 'paso0', 'a', 'b'], 'hoy');
export const OORT_F7 = leer('oort', ['hoy', 'o1', 'o2'], 'hoy');
export const PASO0_F7 = GALAXIA_F7 !== 'hoy';
// Ablación para medir por pase: ?sin=estrellas,capa,galaxia,oort,particulas.
export const SIN_F7 = new Set((parametros.get('sin') || '').split(',').filter(Boolean));
