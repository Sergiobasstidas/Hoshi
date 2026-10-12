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
