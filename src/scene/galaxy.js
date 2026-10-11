import { Vector3 } from 'three';
import { LIGHT_YEAR_PC, smoothRange } from './scale.js';

// IAU Galactic axes in the catalogue's equatorial frame (transpose of the
// standard ICRS -> Galactic rotation). Keep all existing star positions intact.
export const GALACTIC_X = [-0.0548755604, -0.8734370902, -0.4838350155];
export const GALACTIC_Y = [0.4941094279, -0.4448296300, 0.7469822445];
export const GALACTIC_Z = [-0.8676661490, -0.1980763734, 0.4559837762];
export const SUN_GALACTIC_HEIGHT_PC = 20.8;
export const SUN_GALACTIC_DISTANCE_PC = 8122;
export function galacticVector(x, y, z) {
  return GALACTIC_X.map((v, i) => v*x + GALACTIC_Y[i]*y + GALACTIC_Z[i]*z);
}
export const GALAXY_CENTER = galacticVector(Math.sqrt(8122**2-20.8**2), 0, -20.8);
// Visual registration of the ESA labelled face-on map: centre (0.5,0.5),
// solar neighbourhood approximately (0.5,0.70). The image is an illustration.
export const GALAXY_IMAGE_WIDTH_PC = 8122 / 0.20;
export const GALAXY_VIEW_DISTANCE_PC = 48000;
export function galaxyView(edgeOn = false) {
  return { id: 'galaxy', target: GALAXY_CENTER, distance: GALAXY_VIEW_DISTANCE_PC,
    direction: new Vector3(...galacticVector(0.25, -0.35, edgeOn ? 0.035 : 1)).normalize().toArray() };
}
export function galaxyFieldOfView(aspect) {
  return 2 * Math.atan(22000 / (GALAXY_VIEW_DISTANCE_PC * 0.78 * Math.max(0.2, Math.min(1, aspect)))) * 180 / Math.PI;
}
export function galaxyOpacity(solarDistancePc) {
  return smoothRange(solarDistancePc / LIGHT_YEAR_PC, 1800, 7000);
}
// A disc's viewing angle depends on the observer's position, not their gaze.
// Work in world coordinates so visiting a rebased star cannot change exposure.
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

// Sampling follows the reference image, not an invented catalogue of stars.
// Small clouds add thickness; a separate central ellipsoid forms the bulge.
export function buildGalaxyParticles(pixels, width, height, count = 55000) {
  let seed = 142857;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const gaussian = () => Math.sqrt(-2*Math.log(Math.max(random(),1e-8)))*Math.cos(2*Math.PI*random());
  const position = new Float32Array(count*3), color = new Float32Array(count*3), sizes = new Float32Array(count);
  let i = 0;
  // Bounded rejection sampling: no infinite loop if the source is unexpectedly black.
  for (let attempts=0; i<count && attempts<count*100; attempts++) {
    const u=random(), v=random(), dx=u-.5, dy=v-.5;
    const radial=Math.hypot(dx,dy);
    if(radial>.49) continue;
    // The source also depicts the Sagittarius dwarf above the disc. It is not
    // part of this Milky Way layer and must not be flattened into its plane.
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
    // One in eight samples is a diffuse patch, others resolve as compact specks.
    sizes[i]=i%8===0 ? 180+random()*320 : 8+random()*20;
    i++;
  }
  return { position:position.slice(0,i*3), color:color.slice(0,i*3), sizes:sizes.slice(0,i) };
}
