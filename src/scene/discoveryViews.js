import { Vector3 } from 'three';
import { GALACTIC_Z, GALAXY_CENTER, galacticVector } from './galaxy.js';

// Encuadres del modo de descubrimientos. La vertical de cámara es el polo norte galáctico,
// para que el disco quede horizontal; es presentación, las posiciones no se rotan.
const direction = (x, y, z) => new Vector3(...galacticVector(x, y, z)).normalize().toArray();
export const DISCOVERY_VIEWS = [
  { id: 'exo-cerca', nombre: 'Cerca del Sol', target: [0, 0, 0], distance: 320, direction: direction(0.35, -0.6, 0.55), up: GALACTIC_Z },
  { id: 'exo-brazo', nombre: 'Brazo de Orión', target: [0, 0, 0], distance: 2400, direction: direction(0.2, -0.55, 0.8), up: GALACTIC_Z },
  { id: 'exo-galaxia', nombre: 'Vía Láctea', target: GALAXY_CENTER.map(v => v * 0.45), distance: 24000, direction: direction(0.12, -0.3, 1), up: GALACTIC_Z },
];
export const DEFAULT_DISCOVERY_VIEW = DISCOVERY_VIEWS[1];
