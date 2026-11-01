import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AU_TO_PC } from './scale';
import { enZonaHabitable, zonaDeEstrella } from './zonaHabitable';

const COLOR = '#5fd4c0';
// Franja de la zona habitable en el plano de las órbitas; lo optimista va más tenue.
export default function FranjaHabitable({ star, origin, fichas }) {
  const zona = useMemo(() => zonaDeEstrella(star, fichas), [star, fichas]);
  const sistema = star.planetary?.[0];
  const orientacion = useMemo(() => {
    const normal = new THREE.Vector3(...(sistema?.viewUp || [0, 0, 1])).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }, [sistema]);
  const conservadora = useRef(), optimista = useRef();
  useFrame((_, delta) => {
    for (const [material, objetivo] of [[conservadora, 0.28], [optimista, 0.1]]) {
      if (material.current) material.current.opacity = Math.min(objetivo, material.current.opacity + delta * objetivo * 1.5);
    }
  });
  if (!zona) return null;
  const posicion = [star.x - origin[0], star.y - origin[1], star.z - origin[2]];
  return <group position={posicion}>
    <mesh quaternion={orientacion} raycast={() => null} renderOrder={3}>
      <ringGeometry args={[zona.interior * AU_TO_PC, zona.exterior * AU_TO_PC, 128, 1]} />
      <meshBasicMaterial ref={conservadora} color={COLOR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh quaternion={orientacion} raycast={() => null} renderOrder={2}>
      <ringGeometry args={[zona.optimistaInterior * AU_TO_PC, zona.optimistaExterior * AU_TO_PC, 128, 1]} />
      <meshBasicMaterial ref={optimista} color={COLOR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
    {sistema?.planets.filter(planeta => enZonaHabitable(zona, planeta.a)).map(planeta => <Html key={planeta.n} position={planeta.offsetPc} zIndexRange={[19, 11]} style={{ pointerEvents: 'none' }}>
      <span className="zona-habitable-planeta" />
    </Html>)}
  </group>;
}
