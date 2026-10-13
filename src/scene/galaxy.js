import { Vector3 } from 'three';
import { LIGHT_YEAR_PC, smoothRange } from './scale.js';

// Ejes galácticos IAU en el marco ecuatorial del catálogo (transpuesta de la
// rotación ICRS → galáctica). Conservar todas las posiciones estelares existentes.
export const GALACTIC_X = [-0.0548755604, -0.8734370902, -0.4838350155];
export const GALACTIC_Y = [0.4941094279, -0.4448296300, 0.7469822445];
export const GALACTIC_Z = [-0.8676661490, -0.1980763734, 0.4559837762];
export const SUN_GALACTIC_HEIGHT_PC = 20.8;
export const SUN_GALACTIC_DISTANCE_PC = 8122;
export function galacticVector(x, y, z) {
  return GALACTIC_X.map((v, i) => v*x + GALACTIC_Y[i]*y + GALACTIC_Z[i]*z);
}
export const GALAXY_CENTER = galacticVector(Math.sqrt(8122**2-20.8**2), 0, -20.8);
// Registro visual del mapa frontal rotulado ESA: centro (0,5; 0,5),
// vecindario solar aproximadamente (0,5; 0,70). La imagen es ilustrativa.
export const GALAXY_IMAGE_WIDTH_PC = 8122 / 0.20;
export const GALAXY_VIEW_DISTANCE_PC = 48000;
export function galaxyView(edgeOn = false) {
  // La vertical de cámara pasa al polo norte galáctico para que el plano del disco
  // quede horizontal en pantalla. Es presentación: las coordenadas no se rotan.
  return { id: 'galaxy', target: GALAXY_CENTER, distance: GALAXY_VIEW_DISTANCE_PC, up: GALACTIC_Z,
    direction: new Vector3(...galacticVector(0.25, -0.35, edgeOn ? 0.035 : 1)).normalize().toArray() };
}
export function galaxyFieldOfView(aspect) {
  return 2 * Math.atan(22000 / (GALAXY_VIEW_DISTANCE_PC * 0.78 * Math.max(0.2, Math.min(1, aspect)))) * 180 / Math.PI;
}
export function galaxyOpacity(solarDistancePc) {
  return smoothRange(solarDistancePc / LIGHT_YEAR_PC, 1800, 7000);
}
// El ángulo de visión del disco depende de la posición del observador, no de su mirada.
// Usar coordenadas globales para que cambiar el origen a otra estrella no altere la exposición.
export function galaxyFacing(position, origin) {
  const x=position.x+origin[0]-GALAXY_CENTER[0];
  const y=position.y+origin[1]-GALAXY_CENTER[1];
  const z=position.z+origin[2]-GALAXY_CENTER[2];
  const distance=Math.hypot(x,y,z);
  if(distance<1e-9)return 0;
  return smoothRange(Math.abs(x*GALACTIC_Z[0]+y*GALACTIC_Z[1]+z*GALACTIC_Z[2])/distance,.03,.3);
}
export function catalogueGalaxyGain(distancePc) {
  return 1 - 0.985*smoothRange(distancePc / LIGHT_YEAR_PC, 8000, 55000);
}

// El muestreo sigue la imagen de referencia, no un catálogo de estrellas inventadas.
// Nubes pequeñas aportan grosor; un elipsoide central independiente forma el bulbo.
export function buildGalaxyParticles(pixels, width, height, count = 55000) {
  let seed = 142857;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const gaussian = () => Math.sqrt(-2*Math.log(Math.max(random(),1e-8)))*Math.cos(2*Math.PI*random());
  const position = new Float32Array(count*3), color = new Float32Array(count*3), sizes = new Float32Array(count);
  let i = 0;
  // Muestreo por rechazo acotado: evita bucles infinitos si la imagen resulta negra.
  for (let attempts=0; i<count && attempts<count*100; attempts++) {
    const u=random(), v=random(), dx=u-.5, dy=v-.5;
    const radial=Math.hypot(dx,dy);
    if(radial>.49) continue;
    // La fuente también representa la galaxia enana de Sagitario sobre el disco. No
    // forma parte de esta capa de la Vía Láctea y no debe aplanarse en su plano.
    if(Math.hypot((u-.5)*1.3,v-.055)<.07) continue;
    const k=(Math.min(height-1,Math.floor(v*height))*width+Math.min(width-1,Math.floor(u*width)))*4;
    const r=pixels[k]/255,g=pixels[k+1]/255,b=pixels[k+2]/255;
    const brightness=(r+g+b)/3;
    if(random()>brightness**1.65*.85 || brightness<.06) continue;
    const x=-dy*GALAXY_IMAGE_WIDTH_PC, y=-dx*GALAXY_IMAGE_WIDTH_PC;
    const bulge = Math.exp(-(x*x+y*y)/(2*2200**2));
    const z=gaussian()*(100+800*bulge+80*radial);
    position.set([x,y,z],i*3);
    color.set([r,g,b],i*3);
    // Una de cada ocho muestras es una mancha difusa; las demás son puntos compactos.
    sizes[i]=i%8===0 ? 180+random()*320 : 8+random()*20;
    i++;
  }
  return { position:position.slice(0,i*3), color:color.slice(0,i*3), sizes:sizes.slice(0,i) };
}
