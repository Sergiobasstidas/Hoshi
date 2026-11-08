// Avance real de la carga inicial, para la barra de la pantalla de carga (index.html):
// el catálogo (estrellas, sistemas múltiples y planetas) pesa el 60 % y las texturas de los
// cuerpos el 40 %. Cada parte va de 0 a 1.
const partes = { catalogo: 0, texturas: 0 };
// `lista` pasa a true cuando se retira la pantalla de carga (SceneReady, App.jsx): lo que se pide después,
// como las nubes y las luces de la Tierra, no retrasa la barra.
export const cargaInicial = { lista: false };
export function progresoCarga(parte, valor) {
  if (partes[parte] === valor) return;
  partes[parte] = valor;
  window.hoshiProgreso?.(0.6 * partes.catalogo + 0.4 * partes.texturas);
}
