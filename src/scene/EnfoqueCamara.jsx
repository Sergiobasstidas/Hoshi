import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { avanzarEnfoque, centroDeOrbita, centroVisible, cortarGiro, crearEnfoque, direccionFinal, giroCortado, orientacionMirando } from './enfoque';
import { mantenerActivo } from './reposo';

// Giro alrededor del centro de la órbita que cuenta como arrastre (un píxel arrastrado gira unos 0,002 rad).
const GIRO_ALREDEDOR_RAD = 1e-4;
const reducirMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Gira la cámara hacia la estrella pedida (`pedido`: { posicion: [x, y, z] del catálogo, libre }) y después la mantiene
// fija en el centro de lo que se ve aunque la cámara se mueva. En órbita (`libre` falso) la fijación la dan los
// controles: al terminar el giro, `alGirar(adelante)` recibe la dirección final para poner ahí el centro de la órbita; en
// vuelo libre, la cámara se vuelve a orientar en cada cuadro que cambia de lugar. `cortarGiro(pedido)` corta el giro donde
// esté (el usuario tomó la cámara) y avisa igual con `alGirar`. Si el pedido se quita a mitad del giro (×, Esc o clic en
// el vacío), cuenta como un corte. Fijada en órbita, acercarse o alejarse (rueda, pellizco) la vuelve a dejar en su punto
// moviendo el centro de la órbita (`controlsRef`); girar alrededor del centro (arrastrar) la suelta.
export default function EnfoqueCamara({ pedido, origin, alGirar, alSoltar, controlsRef }) {
  const { camera, gl } = useThree();
  const estado = useRef(null);
  useLayoutEffect(() => {
    const previo = estado.current;
    if (!pedido && previo && !previo.fijada && !previo.pedido.libre) {
      cortarGiro(previo.pedido);
      alGirar?.(new Vector3(0, 0, -1).applyQuaternion(camera.quaternion), previo.pedido);
    }
    estado.current = pedido ? { pedido, giro: undefined, fijada: false, ultima: null, desplazamiento: null } : null;
    mantenerActivo();
  // Solo al cambiar el pedido: alGirar cambia en cada dibujo de App.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);
  useFrame((_, delta) => {
    const e = estado.current;
    if (!e) return;
    const estrella = new Vector3(...e.pedido.posicion).sub(new Vector3(...origin));
    // Dónde queda la estrella en pantalla (lienzo, ficha y controles de arriba). Se lee solo cuando hay que apuntar: leer el
    // DOM en cada cuadro de reposo cuesta.
    const medir = () => {
      const lienzo = gl.domElement.getBoundingClientRect();
      const ficha = document.querySelector('aside.ficha-estrella')?.getBoundingClientRect() ?? null;
      // Bajo los controles de arriba (buscador y menús), que en el teléfono ocupan la parte alta de la pantalla.
      const techo = Math.max(lienzo.top, ...[...document.querySelectorAll('.star-search, .menu-explorar, .body-selector')]
        .map(el => el.getBoundingClientRect()).filter(r => r.height > 0 && r.bottom < lienzo.top + lienzo.height / 2).map(r => r.bottom));
      const ndc = centroVisible(lienzo, ficha, techo);
      const arriba = e.pedido.libre ? new Vector3(0, 1, 0).applyQuaternion(camera.quaternion) : camera.up;
      return { arriba, opciones: { fov: camera.fov, aspecto: camera.aspect, ndc, arriba } };
    };
    if (!e.fijada) {
      const { opciones } = medir();
      if (e.giro === undefined) e.giro = crearEnfoque(camera, estrella.clone().sub(camera.position).normalize(), { ...opciones, reducido: reducirMovimiento() });
      const cortado = giroCortado(e.pedido);
      const termino = !e.giro || cortado || avanzarEnfoque(camera, e.giro, delta);
      mantenerActivo();
      if (!termino) return;
      e.fijada = !cortado;
      e.ultima = camera.position.clone();
      alGirar?.(new Vector3(0, 0, -1).applyQuaternion(camera.quaternion), e.pedido);
      if (!e.fijada) estado.current = null;
      return;
    }
    const controles = e.pedido.libre ? null : controlsRef?.current;
    // Los controles de órbita vuelven un cuadro después del giro: desde ahí se mide si la cámara gira alrededor del centro.
    if (controles && !e.desplazamiento) e.desplazamiento = camera.position.clone().sub(controles.target);
    // OrbitControls.update() mueve la cámara ~1e-15 en cada cuadro: eso es ruido, no un movimiento. Sin este umbral se volvía
    // a apuntar en cada cuadro y la escena nunca quedaba en reposo con una estrella fijada (e.ultima no se actualiza).
    const radio = controles ? camera.position.distanceTo(controles.target) : camera.position.distanceTo(estrella);
    if (camera.position.distanceTo(e.ultima) <= 1e-9 * Math.max(radio, camera.position.length())) return;
    const { arriba, opciones } = medir();
    if (!e.pedido.libre) {
      // En órbita: si la cámara giró alrededor del centro (arrastre), se suelta; si solo se acercó o se alejó, la
      // estrella vuelve a su punto y el centro pasa a esa dirección, sin quedar más allá de ella.
      if (!controles) return;
      const desplazamiento = camera.position.clone().sub(controles.target);
      if (desplazamiento.angleTo(e.desplazamiento) > GIRO_ALREDEDOR_RAD) { estado.current = null; alSoltar?.(e.pedido); return; }
      const adelante = direccionFinal(estrella.clone().sub(camera.position).normalize(), arriba, opciones);
      orientacionMirando(adelante, arriba, camera.quaternion);
      camera.updateMatrixWorld();
      const centro = centroDeOrbita(camera.position.toArray(), adelante.toArray(), controles.target.toArray(), estrella.toArray());
      controles.target.set(...centro);
      e.desplazamiento = camera.position.clone().sub(controles.target);
      e.ultima.copy(camera.position);
      mantenerActivo();
      return;
    }
    // Fijada en vuelo libre: si la cámara cambió de lugar, vuelve a dejar la estrella en su punto.
    e.ultima.copy(camera.position);
    const adelante = direccionFinal(estrella.clone().sub(camera.position).normalize(), arriba, opciones);
    orientacionMirando(adelante, arriba, camera.quaternion);
    camera.updateMatrixWorld();
  });
  return null;
}

// Al elegir una estrella sin viajar, el origen local de la escena pasa a ella (App.jsx): la cámara se vuelve a anclar
// para quedar en el mismo lugar del espacio. Los viajes ya lo hacen al empezar (navigation.js, beginJourney).
export function ReanclarCamara({ origin, activo }) {
  const { camera } = useThree();
  const anterior = useRef(origin);
  useLayoutEffect(() => {
    const previo = anterior.current;
    anterior.current = origin;
    if (!activo || previo === origin || previo.every((v, i) => v === origin[i])) return;
    camera.position.add(new Vector3(previo[0] - origin[0], previo[1] - origin[1], previo[2] - origin[2]));
    camera.updateMatrixWorld();
    mantenerActivo();
  }, [camera, origin, activo]);
  return null;
}
