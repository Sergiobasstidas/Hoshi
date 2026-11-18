// Lo elegido en el buscador mientras está apuntado (App.jsx): su nombre ya va fijo bajo la marca, así que la etiqueta
// normal del mismo objeto en la escena se oculta (VisualGuides, Cumulos, CompanionStars). Lo leen en cada cuadro.
export const apuntadoEscena = { estrella: null, cumulo: null, nombre: null };
export function fijarApuntadoEscena(apuntado) {
  apuntadoEscena.estrella = apuntado?.body?.star?.i ?? null;
  apuntadoEscena.cumulo = apuntado?.cumuloId ?? null;
  apuntadoEscena.nombre = apuntado && !apuntado.body?.star && !apuntado.cumuloId ? apuntado.body?.name ?? null : null;
}
// ¿Esta etiqueta nombra lo apuntado? Estrellas por número de catálogo, cúmulos por id y los demás cuerpos por nombre.
export const etiquetaApuntada = ({ estrella, cumulo, nombre }) => (estrella != null && estrella === apuntadoEscena.estrella)
  || (cumulo != null && cumulo === apuntadoEscena.cumulo) || (nombre != null && nombre === apuntadoEscena.nombre);
