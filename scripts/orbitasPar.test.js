import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anomaliaEn, cruces, escalas, parConOrbita, proximoPaso, relativa, velocidadRelativa } from '../src/scene/orbitasPar.js';

const systems = JSON.parse(readFileSync(new URL('../data/processed/star_systems.json', import.meta.url), 'utf8'));
const RIGIL_KENTAURUS = 1451193;
const pair = systems[RIGIL_KENTAURUS].comps.find(c => c.pair === 'RHD 1');
const sistema = { star: { i: RIGIL_KENTAURUS, n: 'Rigil Kentaurus' }, components: [{ name: 'B', pair, companion: { i: 1451151, n: 'Toliman' } }] };
const orbita = parConOrbita({ system: sistema });

test('Alfa Centauri tiene página de órbitas con los elementos de ORB6', () => {
  assert.equal(orbita.primaria.nombre, 'Rigil Kentaurus');
  assert.equal(orbita.companera.nombre, 'Toliman');
  assert.ok(Math.abs(orbita.periodo - 79.76) < 0.01);
  assert.equal(parConOrbita({ system: sistema }), orbita, 'se reutiliza el mismo objeto');
  assert.equal(parConOrbita({ i: 1 }), null);
});

test('El próximo acercamiento es en 2035 y el máximo alejamiento en 2075', () => {
  const cerca = proximoPaso(orbita, 2026.85), lejos = proximoPaso(orbita, 2026.85, orbita.periodo / 2);
  assert.equal(Math.floor(cerca), 2035);
  assert.equal(Math.floor(lejos), 2075);
  const [x, y] = relativa(orbita, anomaliaEn(orbita, cerca));
  assert.ok(Math.abs(Math.hypot(x, y) - orbita.a * (1 - orbita.e)) < 1e-6);
  assert.ok(velocidadRelativa(orbita, 0) / velocidadRelativa(orbita, Math.PI) > 3);
});

test('Las dos estrellas quedan en lados opuestos del centro de masa', () => {
  const q = 0.4573, s = escalas(0, q);
  assert.ok(s.primaria < 0 && s.companera > 0);
  assert.ok(Math.abs(-s.primaria / s.companera - q / (1 - q)) < 1e-12);
  assert.ok(Math.abs(escalas(1, q).primaria) < 1e-12);
  assert.equal(cruces(orbita, q).length, 2);
});

test('Ver órbitas: con masas medidas giran en torno al centro de masa; sin ellas, órbita relativa', async () => {
  const { masasMedidas, orbitaCompleta } = await import('../src/scene/orbitasPar.js');
  const par = nombre => Object.values(systems).flatMap(s => s.comps).find(c => c.pair === nombre);
  const conSistema = (pairData, i) => parConOrbita({ system: { star: { i, n: 'A' }, components: [{ name: 'B', pair: pairData, companion: { i: i + 1, n: 'B' } }] } });
  assert.deepEqual(orbita.masas, [1.0788, 0.9092], 'Alfa Centauri: Akeson et al. 2021');
  const sirio = conSistema(par('AGC 1'), 10);
  assert.deepEqual(sirio.masas, [2.063, 1.018], 'Sirio: Bond et al. 2017');
  const rasalhague = par('MCY 4');
  assert.ok(orbitaCompleta(rasalhague));
  assert.equal(masasMedidas(rasalhague), null);
  assert.equal(conSistema(rasalhague, 20).masas, null, 'Rasalhague: órbita relativa');
  // Las masas del MSC (fotometría o modelos) no cuentan como medidas.
  const msc = Object.values(systems).flatMap(s => s.comps).find(c => c.k === 'o' && c.mc === 'vv' && c.pair !== 'RHD 1');
  assert.equal(masasMedidas(msc), null);
});

test('Castor: «Ver órbitas» de Bb abre la de Bb aunque comparta el código CIA 29 con Ab', async () => {
  const { claveDePar } = await import('../src/scene/orbitasPar.js');
  const datos = JSON.parse(readFileSync(new URL('../data/processed/star_systems.json', import.meta.url), 'utf8'));
  const comps = datos['735275'].comps;
  const sistemaCastor = { star: { i: 735275, n: 'Castor' }, components: comps.map(c => ({ name: c.n, pair: c, companion: { i: `c${c.n}`, n: `Castor ${c.n}` } })) };
  const bb = comps.find(c => c.n === 'Bb');
  const orbitaBb = parConOrbita({ system: sistemaCastor }, claveDePar(bb));
  assert.equal(orbitaBb.companera.nombre, 'Castor Bb');
  assert.ok(Math.abs(orbitaBb.periodo * 365.25 - bb.p) < 1e-6);
});
