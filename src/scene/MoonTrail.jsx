import { useMemo } from 'react';
import { Color } from 'three';
import { KM_TO_PC } from './scale';
import { EPHEMERIS_DATE, moonOffset, planetPosition } from './solarEphemeris';
import { sampleTrail } from './fadingTrail';
import FadingTrails from './FadingTrails';

// Órbita de la Luna como estela (pedido de Sergio, 19/10/2026): la misma de las lunas de Júpiter
// y Saturno, con su color beige, pero más larga, casi la vuelta entera (0,9 del periodo sideral),
// muestreada con la misma serie que coloca a la Luna en la fecha de carga (solarEphemeris.js).
const SIDEREAL_MONTH_DAYS = 27.321661;
const TRAIL_SPAN = 0.9, SAMPLES = 160;
const TRAIL_COLOR = new Color('#d9c59a').toArray();
// Distancia media Tierra-Luna (km), tamaño de referencia para que la estela aparezca al acercarse.
const MEAN_DISTANCE_PC = 384400 * KM_TO_PC;
const FADE_PIXELS = [12, 50];
const DAY_MS = 86400000;

export default function MoonTrail() {
  const earth = useMemo(() => planetPosition('Tierra'), []);
  const trails = useMemo(() => {
    const end = EPHEMERIS_DATE.getTime() / DAY_MS;
    const points = sampleTrail(day => moonOffset(new Date(day * DAY_MS)), end, SIDEREAL_MONTH_DAYS * TRAIL_SPAN, SAMPLES);
    return [{ points, color: TRAIL_COLOR, weight: 1, size: MEAN_DISTANCE_PC }];
  }, []);
  return <group position={earth}>
    <FadingTrails trails={trails} fadePixels={FADE_PIXELS} opacity={1} width={1.6} />
  </group>;
}
