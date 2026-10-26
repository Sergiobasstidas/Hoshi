import test from 'node:test';
import assert from 'node:assert/strict';
import { velocidadDesdeDial, dialDesdeVelocidad, valorDesdeAngulo, formatoVelocidad } from '../src/scene/controlVelocidad.js';
import { MAX_FLIGHT_SPEED_PC, AU_TO_PC, KM_TO_PC, LIGHT_YEAR_PC } from '../src/scene/scale.js';
import { isFlightTypingTarget } from '../src/scene/flightMotion.js';

test('El dial abarca la velocidad de la rueda sin saltos y se puede invertir en todo el rango',()=>{
  let anterior=0;
  for(let valor=0;valor<=100;valor++){
    const velocidad=velocidadDesdeDial(valor);
    assert.ok(velocidad>anterior);
    assert.ok(Math.abs(dialDesdeVelocidad(velocidad)-valor)<1e-9);
    anterior=velocidad;
  }
  assert.ok(Math.abs(velocidadDesdeDial(100)-MAX_FLIGHT_SPEED_PC)<1e-9);
  assert.equal(dialDesdeVelocidad(0),0);
});
test('El arco recorre mínimo, centro y máximo sin invertir extremos en su zona vacía',()=>{
  const punto=grados=>[Math.cos(grados*Math.PI/180),Math.sin(grados*Math.PI/180)];
  for(const [grados,valor] of [[135,0],[270,50],[405,100],[130,0],[410,100]]){
    assert.ok(Math.abs(valorDesdeAngulo(...punto(grados))-valor)<1e-9);
  }
});
test('El indicador conserva UA o años luz y añade kilómetros por segundo enteros',()=>{
  assert.equal(formatoVelocidad(AU_TO_PC).unidad,'UA/s');
  assert.equal(formatoVelocidad(AU_TO_PC*.5).unidad,'km/h');
  assert.equal(formatoVelocidad(10*KM_TO_PC).numero,'36.000');
  assert.equal(formatoVelocidad(LIGHT_YEAR_PC).unidad,'años luz/s');
  assert.equal(formatoVelocidad(1234567.8*KM_TO_PC).km,'1.234.568');
  assert.ok(!formatoVelocidad(MAX_FLIGHT_SPEED_PC).km.includes(','));
});
test('Las teclas de un control de escala no se propagan al vuelo',()=>{
  let selector;
  assert.ok(isFlightTypingTarget({closest:s=>{selector=s;return {};}}));
  assert.ok(selector.includes('[role="slider"]'));
});
