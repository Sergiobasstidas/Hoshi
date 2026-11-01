// En el computador, todo cambia de tamaño de forma continua con la ventana, sin saltos. La interfaz crece
// más despacio que ella y los indicadores aún menos; el logo la sigue tal cual.
const ANCHO_REFERENCIA = 1728, ALTO_REFERENCIA = 992, ZOOM_REFERENCIA = 1.3;
const LOGO_MINIMO = 0.9, LOGO_MAXIMO = 3;
const INTERFAZ = 0.92, INTERFAZ_MINIMA = 0.75, INTERFAZ_MAXIMA = 1.15;
const DIAL = 0.82, DIAL_REFERENCIA = 1.17;
const computador = window.matchMedia('(min-width: 901px) and (pointer: fine)');

function ajustar() {
  const raiz = document.documentElement.style;
  if (!computador.matches) {
    for (const variable of ['--zoom-ui', '--zoom-logo', '--escala-nombres', '--escala-dial']) raiz.removeProperty(variable);
    return;
  }
  const proporcion = Math.min(window.innerWidth / ANCHO_REFERENCIA, window.innerHeight / ALTO_REFERENCIA);
  const escala = Math.min(INTERFAZ_MAXIMA, Math.max(INTERFAZ_MINIMA, INTERFAZ * proporcion ** 0.5));
  const zoom = ZOOM_REFERENCIA * escala;
  raiz.setProperty('--zoom-ui', zoom.toFixed(3));
  raiz.setProperty('--zoom-logo', Math.min(LOGO_MAXIMO, Math.max(LOGO_MINIMO, ZOOM_REFERENCIA * proporcion)).toFixed(3));
  // Los nombres de la escena se colocan en píxeles desde la cámara: crecen con su letra, no con zoom.
  raiz.setProperty('--escala-nombres', escala.toFixed(3));
  // Los indicadores van dentro del zoom: su escala lo descuenta para seguir su propia curva.
  raiz.setProperty('--escala-dial', (DIAL_REFERENCIA * DIAL * proporcion ** 0.3 / zoom).toFixed(3));
}
ajustar();
window.addEventListener('resize', ajustar);
computador.addEventListener('change', ajustar);
