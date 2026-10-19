import './alturaNavegacion.css';

// La barra de botones de escala puede partirse en varias filas según el ancho de la ventana.
// Su altura extra se publica en --nav-extra para que el selector «Acercarse a», el buscador
// y los paneles de la derecha bajen con ella en vez de quedar encima de los botones.
const ONE_ROW_PX = 33;
function watch(nav) {
  const update = () => document.documentElement.style.setProperty('--nav-extra', `${Math.max(0, nav.offsetHeight - ONE_ROW_PX)}px`);
  new ResizeObserver(update).observe(nav);
  update();
}
// La barra aparece cuando React la monta: se espera a que exista.
const found = new MutationObserver(() => {
  const nav = document.querySelector('.scale-navigation');
  if (!nav) return;
  found.disconnect();
  watch(nav);
});
found.observe(document.documentElement, { childList: true, subtree: true });
