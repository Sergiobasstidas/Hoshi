import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angularRadiusArcsec, sdoImageFrame } from '../src/scene/sdoSolar.js';

const DATE = new Date('2026-10-19T15:30:00Z');

test('el disco del SDO ocupa la fracción medida en las imágenes del 19/10/2026', () => {
  // Radio angular el 19/10: ≈ 963″ (la Tierra a 0,996 UA).
  assert.ok(Math.abs(angularRadiusArcsec(DATE) - 963) < 2);
  // Medido: 0,933 del semiancho en HMI; 0,798 en 304 Å, con la cromosfera sobre el borde.
  assert.ok(Math.abs(sdoImageFrame(DATE, 'HMIB').diskRadius - 0.933) < 0.005);
  const aia = sdoImageFrame(DATE, '0304').diskRadius;
  assert.ok(aia > 0.775 && aia < 0.798);
});

test('ejes de la imagen: hacia la Tierra, norte solar arriba y oeste a la derecha', () => {
  const { toward, up, right } = sdoImageFrame(DATE, '0171');
  for (const axis of [toward, up, right]) assert.ok(Math.abs(axis.length() - 1) < 1e-9);
  assert.ok(Math.abs(toward.dot(up)) < 1e-9 && Math.abs(toward.dot(right)) < 1e-9 && Math.abs(up.dot(right)) < 1e-9);
  // El Sol gira hacia el oeste: un punto del centro del disco se mueve hacia la derecha.
  assert.ok(up.clone().cross(toward).dot(right) > 0.99);
  // El norte solar está a unos 26° del norte celeste en octubre: apunta hacia +Z.
  assert.ok(up.z > 0.8);
});
