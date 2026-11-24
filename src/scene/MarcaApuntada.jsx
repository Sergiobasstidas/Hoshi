import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

const punto = new Vector3();
// La marca de lo apuntado (.apuntado, App.jsx) sigue al objeto en la pantalla: con la ficha abierta, la estrella
// elegida queda en el centro de lo que se ve y no en el centro de la pantalla (EnfoqueCamara.jsx). Detrás de la
// cámara, la marca se esconde.
export default function MarcaApuntada({ posicion, origin }) {
  const { camera, gl } = useThree();
  useFrame(() => {
    const marca = document.querySelector('.apuntado');
    if (!marca) return;
    if (!posicion) { marca.style.removeProperty('left'); marca.style.removeProperty('top'); marca.style.visibility = ''; return; }
    punto.set(posicion[0] - origin[0], posicion[1] - origin[1], posicion[2] - origin[2]).project(camera);
    const lienzo = gl.domElement.getBoundingClientRect(), padre = marca.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    marca.style.left = `${lienzo.left - padre.left + (punto.x + 1) / 2 * lienzo.width}px`;
    marca.style.top = `${lienzo.top - padre.top + (1 - punto.y) / 2 * lienzo.height}px`;
    marca.style.visibility = punto.z > 1 ? 'hidden' : '';
  });
  return null;
}
