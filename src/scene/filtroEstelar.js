import { useSyncExternalStore } from 'react';

// Filtros activables, como los de un telescopio solar. Sin filtro la estrella deslumbra.
// Cada filtro es un canal real del Solar Dynamics Observatory (SDO): en el Sol se muestra
// su imagen más reciente sobre la cara que mira a la Tierra; en la cara oculta y en las
// demás estrellas, la simulación de la misma capa (`capa`): blanca = fotosfera,
// cromosfera = 304 Å, corona = ultravioleta extremo, magnetica = campo en la superficie.
export const FILTROS_ESTELARES = [
  { id: 'visible', corto: 'sin filtro', nombre: 'sin filtro', capa: 'blanca' },
  { id: 'ninguno', corto: 'deslumbrante', nombre: 'deslumbrante' },
  { id: 'sdo-hmii', corto: 'NASA visible', nombre: 'sin filtro NASA (luz visible)', canal: 'HMIIF', capa: 'blanca', instrumento: 'SDO/HMI' },
  { id: 'sdo-0131', corto: 'corona caliente', nombre: 'corona caliente (131 Å, vídeo de 48 h)', canal: '0131', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-0171', corto: 'corona y arcos', nombre: 'corona y arcos (171 Å)', canal: '0171', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-0193', corto: 'corona', nombre: 'corona (193 Å)', canal: '0193', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-211193171', corto: 'corona en tres bandas', nombre: 'corona en tres bandas (211, 193 y 171 Å)', canal: '211193171', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-0304', corto: 'cromosfera', nombre: 'cromosfera (304 Å)', canal: '0304', capa: 'cromosfera', instrumento: 'SDO/AIA' },
  { id: 'sdo-304211171', corto: 'cromosfera y corona', nombre: 'cromosfera y corona (304, 211 y 171 Å)', canal: '304211171', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-hmib', corto: 'magnetograma', nombre: 'magnetograma', canal: 'HMIB', capa: 'magnetica', instrumento: 'SDO/HMI' },
];
export const filtroPorId = id => FILTROS_ESTELARES.find(filtro => filtro.id === id) || FILTROS_ESTELARES[0];
// Por defecto, la fotosfera simulada en luz visible, con el color de la temperatura (pedido de Sergio, 31/10/2026).
export const FILTRO_POR_DEFECTO = 'visible';
let actual = FILTRO_POR_DEFECTO;
const oyentes = new Set();

export const filtroEstelarActual = () => actual;
export function cambiarFiltroEstelar(id) {
  const orden = FILTROS_ESTELARES.map(filtro => filtro.id);
  const siguiente = orden.includes(id) ? id : orden[(orden.indexOf(actual) + 1) % orden.length];
  if (siguiente === actual) return;
  actual = siguiente;
  oyentes.forEach(oyente => oyente());
}
const suscribir = oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); };
export const useFiltroEstelar = () => useSyncExternalStore(suscribir, filtroEstelarActual);
