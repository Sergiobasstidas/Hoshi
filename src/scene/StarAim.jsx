import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createStarAim, advanceStarAim } from './starHeading';

export default function StarAim({ target, origin, onRelease, cameraRef }) {
  const { camera } = useThree();
  const aim = useRef(null);
  useLayoutEffect(() => {
    cameraRef.current = camera;
    return () => { cameraRef.current = null; };
  }, [camera, cameraRef]);
  useLayoutEffect(() => {
    aim.current = target ? createStarAim(camera, target.position, origin) : null;
  }, [camera, target, origin]);
  // Las prioridades explícitas aplican la traslación antes del giro, incluso al remontar.
  useFrame((_, delta) => {
    if (aim.current && !advanceStarAim(camera, aim.current, delta)) {
      aim.current = null;
      onRelease();
    }
  }, -1);
  return null;
}
