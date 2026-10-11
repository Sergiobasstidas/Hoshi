import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { galaxyFieldOfView } from './galaxy.js';
import { beginJourney, advanceJourney, pulsarFieldOfView } from './navigation.js';

export default function CameraNavigation({ view, showPulsars, origin, transitionRef, onComplete }) {
  const { camera, size } = useThree();
  const endFov = useMemo(() => showPulsars && view.id === 'pulsars' ? pulsarFieldOfView(size.width / size.height) : view.id === 'galaxy' ? galaxyFieldOfView(size.width / size.height) : 50,
    [showPulsars, view.id, size.width, size.height]);
  useLayoutEffect(() => {
    if (!view.journey) return;
    transitionRef.current = beginJourney(camera, view, origin);
    camera.updateMatrixWorld();
  }, [camera, view, origin, transitionRef]);

  useFrame(({ camera }, delta) => {
    const transition = transitionRef.current;
    if (!transition) {
      if (camera.fov !== endFov) { camera.fov = endFov; camera.updateProjectionMatrix(); }
      return;
    }
    if (advanceJourney(camera, transition, view, endFov, delta)) {
      transitionRef.current = null;
      onComplete(Boolean(view.journey.arriveFree));
    }
  });
  return null;
}
