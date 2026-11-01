import { useSyncExternalStore } from 'react';

// Filtros activables, como los de un telescopio solar. Sin filtro la estrella deslumbra.
// Cada filtro es un canal real del Solar Dynamics Observatory (SDO): en el Sol se muestra
// su imagen más reciente sobre la cara que mira a la Tierra; en la cara oculta y en las
// demás estrellas, la simulación de la misma capa (`capa`): blanca = fotosfera,
// cromosfera = 304 Å, corona = ultravioleta extremo, magnetica = campo en la superficie.
export const FILTROS_ESTELARES = [
  { id: 'visible', nombre: 'Luz visible', banda: '', texto: 'Simulación de la superficie con el color de su temperatura real.', capa: 'blanca' },
  { id: 'ninguno', nombre: 'Sin filtro', banda: '', texto: 'El Sol tal como deslumbra sin protección.' },
  { id: 'sdo-hmii', nombre: 'Fotosfera', banda: 'HMI', texto: 'Foto real de la superficie en luz visible, tomada por el SDO de la NASA.', canal: 'HMIIF', capa: 'blanca', instrumento: 'SDO/HMI' },
  { id: 'sdo-0131', nombre: 'Corona en llamarada', banda: '131 Å', texto: 'Plasma a ~10 millones de °C: revela las fulguraciones. Vídeo de 48 horas.', canal: '0131', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-0171', nombre: 'Bucles coronales', banda: '171 Å', texto: 'Luz de hierro a ~600.000 °C: muestra los arcos de plasma sobre las manchas.', canal: '0171', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-0193', nombre: 'Corona', banda: '193 Å', texto: 'La corona a ~1,2 millones de °C y los agujeros coronales oscuros.', canal: '0193', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-211193171', nombre: 'Corona compuesta', banda: '211/193/171 Å', texto: 'Tres cámaras de distinta temperatura combinadas en una imagen.', canal: '211193171', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-0304', nombre: 'Cromosfera', banda: '304 Å', texto: 'Capa sobre la superficie a ~50.000 °C, con protuberancias y filamentos.', canal: '0304', capa: 'cromosfera', instrumento: 'SDO/AIA' },
  { id: 'sdo-304211171', nombre: 'Cromosfera y corona', banda: '304/211/171 Å', texto: 'La cromosfera y la corona combinadas.', canal: '304211171', capa: 'corona', instrumento: 'SDO/AIA' },
  { id: 'sdo-hmib', nombre: 'Campo magnético', banda: 'HMI', texto: 'Magnetograma: blanco y negro son las polaridades norte y sur.', canal: 'HMIB', capa: 'magnetica', instrumento: 'SDO/HMI' },
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
