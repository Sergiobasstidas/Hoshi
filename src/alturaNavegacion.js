import './alturaNavegacion.css';

// La barra de botones de escala puede partirse en varias filas según el ancho de la ventana.
// Su altura extra se publica en --nav-extra para que el selector «Acercarse a», el buscador
// y los paneles de la derecha bajen con ella en vez de quedar encima de los botones.
const ONE_ROW_PX = 33;
// En el computador el buscador empieza donde empieza el botón «Vuelo libre» (--ancho-buscador).
function alinearBuscador(nav) {
  const boton = nav.querySelector('[data-accion="vuelo-libre"]'), buscador = document.querySelector('.star-search');
  if (!boton || !buscador) return;
  const zoom = Number(getComputedStyle(buscador).zoom) || 1;
  const ancho = (buscador.getBoundingClientRect().right - boton.getBoundingClientRect().left) / zoom;
  if (ancho > 0) document.documentElement.style.setProperty('--ancho-buscador', `${ancho}px`);
}
function watch(nav) {
  const update = () => {
    document.documentElement.style.setProperty('--nav-extra', `${Math.max(0, nav.offsetHeight - ONE_ROW_PX)}px`);
    alinearBuscador(nav);
  };
  new ResizeObserver(update).observe(nav);
  window.addEventListener('resize', update);
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
