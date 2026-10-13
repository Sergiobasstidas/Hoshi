import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, PerspectiveCamera } from 'three';
import { GALACTIC_X, GALACTIC_Y, GALACTIC_Z, GALAXY_CENTER, SUN_GALACTIC_DISTANCE_PC, galaxyView, galaxyFieldOfView, galaxyOpacity, galaxyFacing, buildGalaxyParticles } from '../src/scene/galaxy.js';
import { MAX_VIEW_DISTANCE_PC, LIGHT_YEAR_PC } from '../src/scene/scale.js';
import { beginJourney, advanceJourney } from '../src/scene/navigation.js';

test('Los ejes galácticos conservan distancias y apuntan al polo norte galáctico',()=>{
 const x=new Vector3(...GALACTIC_X),y=new Vector3(...GALACTIC_Y),z=new Vector3(...GALACTIC_Z);
 assert.ok(Math.abs(x.dot(y))<1e-8); assert.ok(Math.abs(y.dot(z))<1e-8);
 assert.ok(x.clone().cross(y).distanceTo(z)<1e-8);
 assert.ok(Math.abs(Math.hypot(...GALAXY_CENTER)-SUN_GALACTIC_DISTANCE_PC)<1e-5);
 const dec=Math.asin(z.z)*180/Math.PI;
 const ra=(Math.atan2(z.y,z.x)*180/Math.PI+360)%360;
 assert.ok(Math.abs(dec-27.12825)<.001); assert.ok(Math.abs(ra-192.85948)<.001);
});
test('Los viajes galácticos respetan el límite y conservan la partida al cambiar el origen',()=>{
 for(const edge of [true,false]){
  const view=galaxyView(edge),origin=[1000,-400,600];
  const camera=new PerspectiveCamera(); camera.position.set(1,2,3);
  const start=camera.position.toArray().map((v,i)=>v+origin[i]);
  view.journey={start,rotation:camera.quaternion.toArray()};
  const motion=beginJourney(camera,view,origin);
  assert.ok(camera.position.distanceTo(new Vector3(1,2,3))<1e-10);
  while(!advanceJourney(camera,motion,view,galaxyFieldOfView(1),.05)){ /* Avanzar hasta la llegada. */ }
  const world=camera.position.clone().add(new Vector3(...origin));
  assert.ok(world.length()<MAX_VIEW_DISTANCE_PC);
  assert.ok(Math.abs(world.distanceTo(new Vector3(...GALAXY_CENTER))-view.distance)<1e-7);
 }
});
test('La vista galáctica deja el plano del disco horizontal sin girar el catálogo',()=>{
 const norte=new Vector3(...GALACTIC_Z);
 for(const edge of [true,false]){
  const view=galaxyView(edge);
  const camera=new PerspectiveCamera(); camera.up.set(0,-Math.sin(23.43928*Math.PI/180),Math.cos(23.43928*Math.PI/180));
  camera.position.set(1,2,3);
  view.journey={start:camera.position.toArray(),rotation:camera.quaternion.toArray()};
  const motion=beginJourney(camera,view,[0,0,0]);
  while(!advanceJourney(camera,motion,view,galaxyFieldOfView(1),.05)){ /* Avanzar hasta la llegada. */ }
  camera.updateMatrixWorld();
  assert.ok(camera.up.distanceTo(norte)<1e-9);
  // El eje horizontal de pantalla queda dentro del plano galáctico.
  const derecha=new Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  assert.ok(Math.abs(derecha.dot(norte))<1e-9);
  // El norte galáctico apunta hacia arriba en pantalla.
  assert.ok(new Vector3().setFromMatrixColumn(camera.matrixWorld,1).dot(norte)>0);
 }
 // Una vista sin vertical propia no altera la de la cámara.
 const camera=new PerspectiveCamera(); camera.position.set(1,2,3);
 const view={target:[0,0,0],distance:5,journey:{start:[1,2,3],rotation:camera.quaternion.toArray()}};
 const motion=beginJourney(camera,view,[0,0,0]);
 while(!advanceJourney(camera,motion,view,50,.05)){ /* Avanzar hasta la llegada. */ }
 assert.deepEqual(camera.up.toArray(),[0,1,0]);
});
test('La aparición galáctica es continua y está ausente a escala solar',()=>{
 assert.equal(galaxyOpacity(100*LIGHT_YEAR_PC),0);
 assert.equal(galaxyOpacity(7000*LIGHT_YEAR_PC),1);
 let previous=0;
 for(let ly=0;ly<10000;ly+=10){const next=galaxyOpacity(ly*LIGHT_YEAR_PC);assert.ok(next>=previous);assert.ok(next-previous<.004);previous=next;}
});
test('Las muestras galácticas sintéticas son reproducibles, finitas, volumétricas y admiten imágenes vacías',()=>{
 const pixels=new Uint8ClampedArray(16*16*4).fill(180);
 const a=buildGalaxyParticles(pixels,16,16,2000),b=buildGalaxyParticles(pixels,16,16,2000);
 assert.deepEqual(a,b);assert.equal(a.sizes.length,2000);
 assert.ok(a.position.every(Number.isFinite));
 assert.ok(a.position.some((v,i)=>i%3===2&&Math.abs(v)>100));
 assert.equal(buildGalaxyParticles(new Uint8ClampedArray(4),1,1,10).sizes.length,0);
});

test('La exposición del disco no depende de la mirada ni del origen local, pero disminuye de canto',()=>{
 const camera=new PerspectiveCamera();
 camera.position.fromArray(GALAXY_CENTER).addScaledVector(new Vector3(...GALACTIC_Z),30000);
 const expected=galaxyFacing(camera.position,[0,0,0]);
 assert.equal(expected,1);
 for(let i=0;i<12;i++){
  camera.rotateY(.4); camera.rotateX(.2);
  assert.equal(galaxyFacing(camera.position,[0,0,0]),expected);
 }
 const origin=[1000,2000,-4000];
 assert.equal(galaxyFacing(camera.position.clone().sub(new Vector3(...origin)),origin),expected);
 camera.position.fromArray(GALAXY_CENTER).addScaledVector(new Vector3(...GALACTIC_X),30000);
 assert.equal(galaxyFacing(camera.position,[0,0,0]),0);
 assert.equal(galaxyFacing(new Vector3(...GALAXY_CENTER),[0,0,0]),0);
});
