import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Matrix4 } from 'three';
import { estrellaBajoCursor, nombreYaVisible, prepararSeleccion } from './seleccionEstrella';
import { parametrosBrillo } from './modosBrillo';
import { nombreEstrella } from './nombresEstrella';

// Clic en una estrella del campo (sin etiqueta propia o con ella): la elige (App.jsx la enfoca y abre su ficha); doble
// clic: viaja; clic en el vacío: onVacio. Al pasar el mouse
// sobre una estrella sin nombre en pantalla se muestra su nombre (nombreEstrella) y el cursor de mano. La búsqueda
// recorre el catálogo en cada clic y, al mover el mouse, como mucho cada INTERVALO_MS.
const MOVIMIENTO_MAXIMO_PX = 4, INTERVALO_MS = 80;
const matriz = new Matrix4();
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
      const k = estrellaBajoCursor(d, { matriz: matriz.elements, origen: o, camara: camera.position.toArray().map((v, i) => v + o[i]),
        ancho: caja.width, alto: caja.height, cx: event.clientX - caja.left, cy: event.clientY - caja.top, fisico, limite });
      return k < 0 ? null : { star: d.estrellas[k], x: event.clientX - caja.left, y: event.clientY - caja.top };
    };
    let inicio = null, ultimo = 0, pendiente = null;
    const ocultar = () => { nombre.style.visibility = 'hidden'; lienzo.style.cursor = ''; };
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
      const enEscena = visiblesEnEscena();
      if (nombreYaVisible(texto, enEscena) || (hallada.star.n && nombreYaVisible(hallada.star.n, enEscena))) { nombre.style.visibility = 'hidden'; return; }
      nombre.firstChild.textContent = texto;
      nombre.style.transform = `translate(${hallada.x + 10}px, ${hallada.y - 18}px)`;
      nombre.style.visibility = 'visible';
    };
    const bajar = event => { inicio = event.button === 0 ? [event.clientX, event.clientY] : null; };
    const soltar = event => {
      if (!inicio || Math.hypot(event.clientX - inicio[0], event.clientY - inicio[1]) > MOVIMIENTO_MAXIMO_PX) return;
      inicio = null;
      const hallada = buscar(event);
      // Un clic (no el fin de un arrastre) sin estrella avisa con onVacio: la escena decide si soltar la selección.
      if (hallada) vigente.current.onElegir?.(hallada.star); else vigente.current.onVacio?.();
    };
    const dobleClic = event => {
      const hallada = buscar(event);
      if (hallada) vigente.current.onViajar?.(hallada.star);
    };
    lienzo.addEventListener('pointermove', mover);
    lienzo.addEventListener('pointerdown', bajar);
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('dblclick', dobleClic);
    lienzo.addEventListener('pointerleave', ocultar);
    return () => {
      clearTimeout(pendiente);
      lienzo.removeEventListener('pointermove', mover);
      lienzo.removeEventListener('pointerdown', bajar);
      lienzo.removeEventListener('pointerup', soltar);
      lienzo.removeEventListener('dblclick', dobleClic);
      lienzo.removeEventListener('pointerleave', ocultar);
      nombre.remove();
    };
  }, [gl, camera]);
  return null;
}
