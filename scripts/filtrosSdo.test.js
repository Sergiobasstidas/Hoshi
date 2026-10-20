import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILTROS_ESTELARES, filtroEstelarActual, filtroPorId } from '../src/scene/filtroEstelar.js';
import { SDO_CHANNELS } from '../src/scene/sdoSolar.js';

test('filtros del Sol: sin filtro intacto y un canal del SDO sin repetir por filtro', () => {
  assert.equal(FILTROS_ESTELARES[0].id, 'ninguno');
  assert.equal(FILTROS_ESTELARES[0].canal, undefined);
  const canales = FILTROS_ESTELARES.slice(1).map(filtro => filtro.canal);
  assert.equal(new Set(canales).size, canales.length);
  for (const canal of canales) assert.ok(SDO_CHANNELS[canal], canal);
  // Las composiciones que se arman aquí usan canales descargados.
  for (const { compose } of Object.values(SDO_CHANNELS)) for (const canal of compose || []) assert.ok(SDO_CHANNELS[canal], canal);
  assert.equal(filtroEstelarActual(), 'sdo-0193');
  assert.equal(filtroPorId('desconocido').id, 'ninguno');
});
