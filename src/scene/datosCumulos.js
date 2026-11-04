// Cúmulos de estrellas del Unified Cluster Catalogue (Perren et al. 2023, MNRAS 526, 4107; CC BY 4.0),
// cruzados con Hoshi por Gaia DR3 en scripts/process_cumulos.js. Se piden la primera vez que se muestran.
import { useEffect, useState } from 'react';

let pedido;
const cargar = () => {
  pedido ||= fetch('/data/cumulos.json').then(r => { if (!r.ok) throw Error('cumulos'); return r.json(); }).catch(error => { pedido = null; throw error; });
  return pedido;
};
export function useCumulos(activo) {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    if (!activo || datos) return;
    let vigente = true;
    cargar().then(valor => { if (vigente) setDatos(valor); }, () => {});
    return () => { vigente = false; };
  }, [activo, datos]);
  return datos;
}
// Solo se muestran los cúmulos con al menos estos miembros en Hoshi: con menos, no se distingue el grupo.
export const MIEMBROS_PARA_NOMBRE = 8;
// Encuadre al elegir un cúmulo: la cámara mira desde el lado del Sol, fuera del grupo, a la distancia en que sus
// miembros ocupan cerca del 55 % del alto de la pantalla. Se mide lo que se ve de lado (perpendicular a la mirada);
// la dispersión en profundidad, que viene sobre todo del error de las distancias, solo aleja la cámara si hace falta.
export function encuadreDeCumulo(cumulo, estrellaDe, fovGrados = 50, fraccion = 0.55) {
  const centro = [cumulo.x, cumulo.y, cumulo.z], largo = Math.hypot(...centro);
  const haciaSol = centro.map(v => -v / largo);
  const lado = [], delante = [];
  for (const id of cumulo.ids) {
    const s = estrellaDe.get(id);
    if (!s) continue;
    const o = [s.x - centro[0], s.y - centro[1], s.z - centro[2]];
    const fondo = o[0] * haciaSol[0] + o[1] * haciaSol[1] + o[2] * haciaSol[2];
    lado.push(Math.hypot(o[0] - fondo * haciaSol[0], o[1] - fondo * haciaSol[1], o[2] - fondo * haciaSol[2]));
    delante.push(fondo);
  }
  lado.sort((a, b) => a - b);
  const radio = Math.max(lado[Math.floor((lado.length - 1) * 0.95)] || 0, (cumulo.r50Pc || 1) * 0.5);
  const porPantalla = radio / Math.tan(fraccion * fovGrados / 2 * Math.PI / 180);
  const fuera = Math.max(0, ...delante) * 1.2 + radio;
  return { distance: Math.max(porPantalla, fuera), direction: haciaSol };
}
