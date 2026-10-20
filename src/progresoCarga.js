// Avance real de la carga inicial, para la barra de la pantalla de carga (index.html):
// el catálogo (estrellas, sistemas múltiples y planetas) pesa el 60 % y las texturas de los
// cuerpos el 40 %. Cada parte va de 0 a 1.
const partes = { catalogo: 0, texturas: 0 };
export function progresoCarga(parte, valor) {
  if (partes[parte] === valor) return;
  partes[parte] = valor;
  window.hoshiProgreso?.(0.6 * partes.catalogo + 0.4 * partes.texturas);
}
