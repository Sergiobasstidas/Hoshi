// Opciones de F-07. Elegidas por Sergio (24/11/2026): galaxia C (foto de hoy con las nubes de B dentro del disco, con el paso 0)
// y nube de Oort O2. Las demás quedan para comparar por URL: ?f7=hoy|paso0|a|b|c (galaxia; c: la imagen de hoy y, dentro del disco, el volumen de B) y ?oort=hoy|o1|o2 (nube de Oort).
// «paso0» descarta las estrellas invisibles apiladas y apaga el cielo unido lejos; A y B lo incluyen.
const parametros = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
const leer = (clave, validas, omision) => { const v = parametros.get(clave); return validas.includes(v) ? v : omision; };
export const GALAXIA_F7 = leer('f7', ['hoy', 'paso0', 'a', 'b', 'c'], 'c');
export const OORT_F7 = leer('oort', ['hoy', 'o1', 'o2'], 'o2');
export const PASO0_F7 = GALAXIA_F7 !== 'hoy';
// Ablación para medir por pase: ?sin=estrellas,capa,galaxia,oort,particulas.
export const SIN_F7 = new Set((parametros.get('sin') || '').split(',').filter(Boolean));
// Tramos del cruce de la opción C (kpc), ajustables por URL: ?cz=0.5,1.5&cr=15,20&sb=0.3,0.7&cc=0.3,0.9 (src/scene/galaxiaModelo.js, CRUCE_C).
const tramo = clave => { const v = (parametros.get(clave) || '').split(',').map(Number); return v.length === 2 && v.every(Number.isFinite) && v[1] > v[0] ? v : null; };
export const TRAMOS_C = { z: tramo('cz'), r: tramo('cr'), sinBrazos: tramo('sb'), cerca: tramo('cc') };
