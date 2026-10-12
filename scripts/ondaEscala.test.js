import test from 'node:test';
import assert from 'node:assert/strict';
import { CANTIDAD_LINEAS_ESCALA, intensidadLinea } from '../src/scene/ondaEscala.js';

const ondaEn = vista => Array.from({length:CANTIDAD_LINEAS_ESCALA},(_,i)=>intensidadLinea(i,vista));

test('La onda nunca ensancha más de siete líneas y alcanza 48 px como máximo',()=>{
  for(let paso=0;paso<=10000;paso++){
    const onda=ondaEn(paso/100);
    assert.ok(onda.filter(x=>x>0).length<=7);
    assert.ok(onda.every(x=>x>=0&&16*(1+2*x)<=48));
  }
  assert.equal(ondaEn(50).filter(x=>x>0).length,7);
  assert.ok(ondaEn(null).every(x=>x===0));
});

test('La onda varía continuamente y un salto del puntero no deja una segunda zona',()=>{
  for(let vista=0;vista<100;vista+=.1){
    const a=ondaEn(vista),b=ondaEn(vista+.001);
    assert.ok(a.every((x,i)=>Math.abs(x-b[i])<.001));
  }
  const arriba=ondaEn(85),abajo=ondaEn(15);
  assert.ok(arriba.every((x,i)=>x===0||abajo[i]===0));
});
