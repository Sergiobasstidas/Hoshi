// scripts/catalog/criterios_enlace.js
// Criterios comunes para aceptar que una estrella y un objeto de otra fuente (SIMBAD, AT-HYG) son el mismo, aunque su
// brillo no calce: los usan la revisión de enlaces a Gaia (auditoria/gaia_revisar.js) y los nombres de la capa
// (capa_nombres.js), para que las dos reglas no se contradigan.

// El movimiento propio coincide si la diferencia es de hasta 10 mas/año o del 20 % del de Gaia. `dpm` es null si no se
// puede comparar (sin movimiento propio en alguna de las dos).
export function movimientoCoincide(pmGaia, pmOtro) {
  const conGaia = pmGaia.every(Number.isFinite), conOtro = pmOtro.every(Number.isFinite) && (pmOtro[0] || pmOtro[1]);
  const dpm = conGaia && conOtro ? Math.hypot(pmGaia[0] - pmOtro[0], pmGaia[1] - pmOtro[1]) : null;
  return { dpm, ok: dpm === null || dpm <= Math.max(10, 0.2 * Math.hypot(pmGaia[0], pmGaia[1])) };
}

// Una variable de período largo cambia varias magnitudes: una diferencia de V no prueba que sea otro objeto. Se acepta
// sin tope de ΔV si está a ≤ 1″ y el movimiento propio se pudo comparar y coincide.
export const SEP_SIN_TOPE_DV = 1;
export const calzaSinTopeDeBrillo = ({ separacion, dpm, pmOk }) => separacion <= SEP_SIN_TOPE_DV && dpm !== null && pmOk;
