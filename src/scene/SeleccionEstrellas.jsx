import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Matrix4, Vector3 } from 'three';
import { estrellaBajoCursor, nombreYaVisible, prepararSeleccion } from './seleccionEstrella';
import { parametrosBrillo } from './modosBrillo';
import { nombreEstrella } from './nombresEstrella';
import { currentOccluders, rayHidden } from './labelOcclusion';
import { indiceBusqueda } from '../indiceBusqueda';

// Clic en una estrella del campo (sin etiqueta propia o con ella): la elige (App.jsx la enfoca y abre su ficha); doble
// clic: viaja; clic en el vacío: onVacio. Al pasar el mouse
// sobre una estrella sin nombre en pantalla se muestra su nombre (nombreEstrella) y el cursor de mano. La búsqueda
// recorre el catálogo en cada clic y, al mover el mouse, como mucho cada INTERVALO_MS.
const MOVIMIENTO_MAXIMO_PX = 4, INTERVALO_MS = 80;
const matriz = new Matrix4();
const rayo = { origin: new Vector3(), direction: new Vector3() };
// Sin el índice del buscador, una estrella sin nombre propio se llamaría «HSB …»: el nombre al pasar el mouse espera a
// que cargue.
let indiceListo = false;
// Nombres que ya están a la vista: etiquetas de estrellas (normales y de contexto), de compañeras y la de la marca.
const visiblesEnEscena = () => [
  ...[...document.querySelectorAll('[data-labels] .scene-label')].map(e => ({ texto: e.textContent, visible: e.style.visibility === 'visible' && Number(e.style.opacity || 0) > 0.05 })),
  ...[...document.querySelectorAll('.companion-label, .companion-extremo')].map(e => ({ texto: e.textContent, visible: Number(e.style.opacity || 0) > 0.05 })),
  ...[...document.querySelectorAll('.apuntado-nombre')].map(e => ({ texto: e.textContent, visible: true })),
];

export default function SeleccionEstrellas({ estrellas, origin, onElegir, onViajar, onVacio, activo = true }) {
  const { gl, camera } = useThree();
  const datos = useMemo(() => prepararSeleccion(estrellas.filter(s => s.i !== 0 && Number.isFinite(s.x))), [estrellas]);
  const vigente = useRef({});
  useEffect(() => { vigente.current = { datos, origin, onElegir, onViajar, onVacio, activo }; });
  useEffect(() => {
    const lienzo = gl.domElement;
    const nombre = document.createElement('div');
    nombre.className = 'scene-label star estrella-bajo-cursor';
    nombre.innerHTML = '<span class="label-text"></span>';
    Object.assign(nombre.style, { position: 'absolute', left: 0, top: 0, pointerEvents: 'none', visibility: 'hidden', opacity: 1, zIndex: 20 });
    lienzo.parentElement?.appendChild(nombre);
    const buscar = event => {
      const { datos: d, origin: o, activo: a } = vigente.current;
      if (!a) return null;
      const caja = lienzo.getBoundingClientRect();
      camera.updateMatrixWorld();
      matriz.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const { fisico, limite } = parametrosBrillo();
      // Detrás del disco del Sol, de un planeta, de una luna o de la estrella visitada (más cercanos) no se elige nada.
      const discos = currentOccluders().filter(disco => disco.center && disco.radiusPc > 0);
      const oculta = !discos.length ? null : (k, distancia) => {
        const p = [d.x[k] - o[0], d.y[k] - o[1], d.z[k] - o[2]];
        rayo.origin.copy(camera.position);
        rayo.direction.set(...p).sub(camera.position).normalize();
        // El disco de la misma estrella no la tapa.
        return rayHidden(rayo, distancia, discos.filter(disco => Math.hypot(...disco.center.map((v, i) => v - p[i])) > 1.5 * disco.radiusPc));
      };
      const k = estrellaBajoCursor(d, { matriz: matriz.elements, origen: o, camara: camera.position.toArray().map((v, i) => v + o[i]),
        ancho: caja.width, alto: caja.height, cx: event.clientX - caja.left, cy: event.clientY - caja.top, fisico, limite, oculta });
      return k < 0 ? null : { star: d.estrellas[k], x: event.clientX - caja.left, y: event.clientY - caja.top };
    };
    let inicio = null, ultimo = 0, pendiente = null;
    // Quitar el nombre también cancela el que estaba por mostrarse (mover espera INTERVALO_MS entre búsquedas).
    const ocultar = () => { clearTimeout(pendiente); nombre.style.visibility = 'hidden'; lienzo.style.cursor = ''; };
    const mover = event => {
      if (event.buttons) { ocultar(); return; }
      const ahora = performance.now();
      if (ahora - ultimo < INTERVALO_MS) { clearTimeout(pendiente); pendiente = setTimeout(() => mover(event), INTERVALO_MS); return; }
      ultimo = ahora;
      const hallada = buscar(event);
      if (!hallada) { ocultar(); return; }
      lienzo.style.cursor = 'pointer';
      // Las que ya tienen su nombre a la vista no lo repiten.
      const texto = nombreEstrella(hallada.star);
      if (!indiceListo && /^HSB \d/.test(texto)) {
        nombre.style.visibility = 'hidden';
        indiceBusqueda().then(() => { indiceListo = true; }, () => {});
        return;
      }
      const enEscena = visiblesEnEscena();
      if (nombreYaVisible(texto, enEscena) || (hallada.star.n && nombreYaVisible(hallada.star.n, enEscena))) { nombre.style.visibility = 'hidden'; return; }
      nombre.firstChild.textContent = texto;
      nombre.style.transform = `translate(${hallada.x + 10}px, ${hallada.y - 18}px)`;
      nombre.style.visibility = 'visible';
    };
    // Solo el primer dedo (o el botón principal) puede hacer un clic: un segundo dedo (pellizco) lo anula.
    const bajar = event => { inicio = event.isPrimary && event.button === 0 ? [event.clientX, event.clientY] : null; };
    const cancelar = () => { inicio = null; };
    const soltar = event => {
      if (!event.isPrimary) return;
      ocultar();
      if (!inicio || Math.hypot(event.clientX - inicio[0], event.clientY - inicio[1]) > MOVIMIENTO_MAXIMO_PX) return;
      inicio = null;
      const hallada = buscar(event);
      // Un clic (no el fin de un arrastre) sin estrella avisa con onVacio: la escena decide si soltar la selección.
      if (hallada) vigente.current.onElegir?.(hallada.star); else vigente.current.onVacio?.();
    };
    const dobleClic = event => {
      ocultar();
      const hallada = buscar(event);
      if (hallada) vigente.current.onViajar?.(hallada.star);
    };
    lienzo.addEventListener('pointermove', mover);
    lienzo.addEventListener('pointerdown', bajar);
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('dblclick', dobleClic);
    lienzo.addEventListener('pointerleave', ocultar);
    lienzo.addEventListener('pointercancel', cancelar);
    lienzo.addEventListener('wheel', ocultar, { passive: true });
    return () => {
      clearTimeout(pendiente);
      lienzo.removeEventListener('pointermove', mover);
      lienzo.removeEventListener('pointerdown', bajar);
      lienzo.removeEventListener('pointerup', soltar);
      lienzo.removeEventListener('dblclick', dobleClic);
      lienzo.removeEventListener('pointerleave', ocultar);
      lienzo.removeEventListener('pointercancel', cancelar);
      lienzo.removeEventListener('wheel', ocultar);
      nombre.remove();
    };
  }, [gl, camera]);
  return null;
}
