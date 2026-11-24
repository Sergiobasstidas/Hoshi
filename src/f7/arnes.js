// Arnés de capturas de F-07 (solo en la rama f7-prototipos). Parámetros de URL:
//   ?vista=a|b|c|d2000|d8000|e|f1|f3  deja la cámara en una de las 8 posiciones del «antes», sin animación;
//   ?f7=hoy|paso0|a|b|c y ?oort=hoy|o1|o2  eligen la galaxia y la nube de Oort (src/f7/opciones.js).
// En la consola: await hoshiF7.listo() y después await hoshiF7.medir() (5 s de dibujo continuo).
import { GALACTIC_X, GALACTIC_Z, GALAXY_CENTER, galacticVector } from '../scene/galaxy.js';
import { LIGHT_YEAR_PC } from '../scene/scale.js';

const parametros = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
export const VISTA_F7 = parametros.get('vista');
export { GALAXIA_F7 as VARIANTE_F7, OORT_F7 } from './opciones.js';

const escalar = (v, k) => v.map(x => x * k);
const sumar = (a, b) => a.map((x, i) => x + b[i]);
const unidad = v => escalar(v, 1 / Math.hypot(...v));
const canto = unidad(galacticVector(0.25, -0.35, 0.035));
const enPlano = anosLuz => sumar(escalar(GALACTIC_X, anosLuz * LIGHT_YEAR_PC), escalar(GALACTIC_Z, -20.8));
const oort = anosLuz => escalar(unidad(galacticVector(0.3, 0.4, 0.5)), anosLuz * LIGHT_YEAR_PC);

// Posición, punto al que mira y vertical, en pc respecto del Sol (marco del catálogo). «a» es la vista inicial (la Tierra)
// y «b», la vista «Vía Láctea» de siempre; las demás se ponen en vuelo libre después de «Vía Láctea», como en el «antes».
export const POSES_F7 = {
  c: { posicion: sumar(GALAXY_CENTER, escalar(canto, 48000)), mira: GALAXY_CENTER, arriba: GALACTIC_Z },
  d2000: { posicion: enPlano(2000), mira: GALAXY_CENTER, arriba: GALACTIC_Z },
  d8000: { posicion: enPlano(8000), mira: GALAXY_CENTER, arriba: GALACTIC_Z },
  e: { posicion: escalar(GALACTIC_Z, 25000 * LIGHT_YEAR_PC), mira: escalar(GALACTIC_X, 1e-4), arriba: GALACTIC_X },
  f1: { posicion: oort(1), mira: [0, 0, 0], arriba: GALACTIC_Z },
  f3: { posicion: oort(3), mira: [0, 0, 0], arriba: GALACTIC_Z },
};
export const VISTAS_F7 = ['a', 'b', ...Object.keys(POSES_F7)];

const ordenar = a => [...a].sort((x, y) => x - y);
export const percentil = (valores, k) => (valores.length ? ordenar(valores)[Math.min(valores.length - 1, Math.floor(k * valores.length))] : null);

// Envuelve renderer.render para medir el tiempo de GPU (EXT_disjoint_timer_query_webgl2) y guardar renderer.info mientras
// `medicion.activa`. Una consulta por cuadro: se abre en la primera pasada (las del volumen de la galaxia van a un render
// target antes de la escena) y se cierra al dibujar en la pantalla. Devuelve la función que lo deja como estaba.
export function envolverRender(renderer, medicion) {
  const ctx = renderer.getContext(), ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2');
  const original = renderer.render;
  medicion.ctx = ctx; medicion.ext = ext;
  let abierta = null;
  renderer.render = (escena, camara) => {
    const aPantalla = renderer.getRenderTarget() === null;
    if (ext && medicion.activa && !abierta) { abierta = ctx.createQuery(); ctx.beginQuery(ext.TIME_ELAPSED_EXT, abierta); }
    original.call(renderer, escena, camara);
    if (abierta && aPantalla) { ctx.endQuery(ext.TIME_ELAPSED_EXT); medicion.consultas.push(abierta); abierta = null; }
    if (medicion.activa && aPantalla) {
      const i = renderer.info;
      medicion.info = { dibujos: i.render.calls, puntos: i.render.points, triangulos: i.render.triangles, texturas: i.memory.textures, geometrias: i.memory.geometries };
    }
  };
  return () => { renderer.render = original; };
}
