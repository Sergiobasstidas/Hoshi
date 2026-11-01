// En el computador, la interfaz mantiene la misma proporción que en una pantalla de referencia:
// crece con la ventana, tanto a lo ancho como a lo alto, para que nada se vea chico en un monitor grande.
const ANCHO_REFERENCIA = 1728, ALTO_REFERENCIA = 990, ZOOM_REFERENCIA = 1.3;
const ZOOM_MINIMO = 0.9, ZOOM_MAXIMO = 3;
const computador = window.matchMedia('(min-width: 1201px) and (pointer: fine)');

function ajustar() {
  const raiz = document.documentElement.style;
  if (!computador.matches) { raiz.removeProperty('--zoom-ui'); raiz.removeProperty('--escala-nombres'); return; }
  const zoom = ZOOM_REFERENCIA * Math.min(window.innerWidth / ANCHO_REFERENCIA, window.innerHeight / ALTO_REFERENCIA);
  const limitado = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, zoom));
  raiz.setProperty('--zoom-ui', limitado.toFixed(3));
  // Los nombres de la escena se colocan en píxeles desde la cámara: crecen con su letra, no con zoom.
  raiz.setProperty('--escala-nombres', (limitado / ZOOM_REFERENCIA).toFixed(3));
}
ajustar();
window.addEventListener('resize', ajustar);
computador.addEventListener('change', ajustar);
