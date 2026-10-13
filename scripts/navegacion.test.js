import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { distanciaDesdeBarra, barraDesdeDistancia, destinoDesdeBarra, DISTANCIA_MINIMA, TIERRA } from '../src/scene/escalaNavegacion.js';
import { MAX_VIEW_DISTANCE_PC, KM_TO_PC } from '../src/scene/scale.js';
import { selectStarLabels } from '../src/scene/starLabelSelection.js';

test('La barra recorre escalas crecientes y recupera su valor desde la distancia', () => {
  let anterior = 0;
  for(let valor=0;valor<=100;valor+=0.5){
    const distancia=distanciaDesdeBarra(valor);
    assert.ok(distancia>anterior);
    assert.ok(Math.abs(barraDesdeDistancia(distancia)-valor)<1e-10);
    anterior=distancia;
  }
  assert.ok(DISTANCIA_MINIMA>TIERRA.radiusKm*KM_TO_PC);
  assert.equal(distanciaDesdeBarra(-10),DISTANCIA_MINIMA);
  assert.equal(barraDesdeDistancia(Infinity),100);
});

test('La barra conserva el lado de aproximación aunque cambie el origen local y respeta el límite global', () => {
  const global=new Vector3(23,-57,80), origen=new Vector3(13,4,-5);
  const local=global.clone().sub(origen);
  const a=destinoDesdeBarra(67,global.toArray(),[0,0,0]);
  const b=destinoDesdeBarra(67,local.toArray(),origen.toArray());
  assert.deepEqual(a,b);
  assert.ok(new Vector3(...a.direction).distanceTo(global.clone().sub(new Vector3(...TIERRA.position)).normalize())<1e-12);
  for(const valor of [0,50,100]){
    const destino=destinoDesdeBarra(valor,local.toArray(),origen.toArray());
    const llegada=new Vector3(...destino.target).addScaledVector(new Vector3(...destino.direction),destino.distance);
    assert.ok(llegada.length()<=MAX_VIEW_DISTANCE_PC);
    assert.ok(destino.direction.every(Number.isFinite));
  }
});

test('El extremo de la escala centra la galaxia y queda a la distancia máxima de la Tierra', async () => {
  const {GALAXY_CENTER,GALACTIC_Z}=await import('../src/scene/galaxy.js');
  const {DISTANCIA_MAXIMA}=await import('../src/scene/escalaNavegacion.js');
  const destino=destinoDesdeBarra(100,[1,2,3],[0,0,0]);
  assert.deepEqual(destino.target,GALAXY_CENTER);
  assert.deepEqual(destino.up,GALACTIC_Z);
  const llegada=new Vector3(...destino.target).addScaledVector(new Vector3(...destino.direction),destino.distance);
  assert.ok(Math.abs(llegada.distanceTo(new Vector3(...TIERRA.position))-DISTANCIA_MAXIMA)<1e-6);
  assert.ok(Math.abs(barraDesdeDistancia(llegada.distanceTo(new Vector3(...TIERRA.position)))-100)<1e-9);
  // Por debajo del extremo la escala sigue apuntando a la Tierra.
  assert.deepEqual(destinoDesdeBarra(99,[1,2,3],[0,0,0]).target,TIERRA.position);
});

test('Las etiquetas conservan su identidad ante cambios mínimos de distancia y superposición', () => {
  let visibles=new Set([1,2]);
  for(let cuadro=0;cuadro<120;cuadro++){
    const variacion=Math.sin(cuadro)*0.5;
    const candidatos=[{id:1,x:0,y:0,width:90,distance:10+variacion},
      {id:2,x:110+variacion,y:0,width:90,distance:10-variacion},
      {id:3,x:111,y:0,width:90,distance:10}];
    visibles=selectStarLabels(candidatos,visibles,null,2);
    assert.deepEqual([...visibles],[1,2]);
  }
});

test('Una estrella claramente más cercana reemplaza a otra y la selección siempre tiene prioridad', () => {
  const candidatos=[{id:1,x:0,y:0,width:90,distance:10},{id:2,x:0,y:0,width:90,distance:6}];
  let visibles=selectStarLabels(candidatos,new Set([1]),null);
  assert.deepEqual([...visibles],[2]);
  for(let cuadro=0;cuadro<20;cuadro++){
    visibles=selectStarLabels(candidatos,visibles,null);
    assert.deepEqual([...visibles],[2]);
  }
  assert.deepEqual([...selectStarLabels(candidatos,visibles,1,1)],[1]);
});

test('Las etiquetas que se cruzan no desaparecen ni alteran su orden por una tercera candidata', () => {
  let visibles=new Set([1,2]);
  for(let cuadro=0;cuadro<90;cuadro++){
    const candidatos=[{id:1,x:40,y:0,width:90,distance:20},
      {id:2,x:40+Math.sin(cuadro)*20,y:0,width:90,distance:19},
      {id:3,x:40,y:0,width:90,distance:18}];
    visibles=selectStarLabels(candidatos,visibles,null,2);
    assert.deepEqual([...visibles],[1,2]);
  }
});

test('El viaje corto de escala conserva la partida y llega en dos segundos sin cambiar el viaje normal', async () => {
  const {PerspectiveCamera}=await import('three');
  const {beginJourney,advanceJourney}=await import('../src/scene/navigation.js');
  const {JOURNEY_SECONDS}=await import('../src/scene/starJourney.js');
  const camera=new PerspectiveCamera(50,1,1e-14,400000);
  camera.position.fromArray(TIERRA.position).add(new Vector3(0,0,DISTANCIA_MINIMA));
  const partida=camera.position.clone();
  const destino=destinoDesdeBarra(100,partida.toArray(),[0,0,0]);
  const vista={...destino,journey:{start:partida.toArray(),rotation:camera.quaternion.toArray(),duration:2}};
  const transicion=beginJourney(camera,vista,[0,0,0]);
  assert.equal(transicion.duration,2);
  assert.ok(camera.position.distanceTo(partida)<1e-15);
  for(let i=0;i<119;i++)assert.equal(advanceJourney(camera,transicion,vista,50,1/60),false);
  advanceJourney(camera,transicion,vista,50,1/60);
  assert.ok(Math.abs(camera.position.distanceTo(new Vector3(...destino.target))-destino.distance)<1e-8);
  const normal=beginJourney(camera,{...vista,journey:{...vista.journey,duration:undefined}},[0,0,0]);
  assert.equal(normal.duration,JOURNEY_SECONDS);
  assert.ok(normal.duration>transicion.duration);
});
