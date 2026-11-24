import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXTOS_CLASE, TIPOS, tipoEstelar } from '../src/tipoEstelar.js';

test('solo «D» mayúscula con su subtipo o «WD» es enana blanca; «d» y «sd» de SIMBAD son enanas y subenanas', () => {
  const nombre = sp => tipoEstelar(sp)?.nombre ?? null;
  assert.equal(nombre('DA2'), 'Enana blanca');
  assert.equal(nombre('DQ'), 'Enana blanca');
  assert.equal(nombre('DZ7.5'), 'Enana blanca');
  assert.equal(nombre('WD'), 'Enana blanca');
  assert.equal(nombre('dM4'), 'Enana roja');
  assert.equal(nombre('sdM7'), 'Subenana roja');
  assert.equal(nombre('d/sdM7'), 'Subenana roja');
  assert.equal(nombre('esdK7'), 'Subenana naranja');
  assert.equal(nombre('M5.5Ve'), 'Enana roja');
  assert.equal(nombre('G2 V'), 'Estrella amarilla');
  assert.equal(nombre('K1III'), 'Gigante naranja');
  assert.equal(nombre('A0mA1Va'), 'Estrella blanca');
  assert.equal(nombre(''), null);
  assert.equal(nombre(null), null);
});

test('clase de luminosidad I es supergigante; 0, Ia0 o Ia+ hipergigante; IV subgigante; III y II gigantes', () => {
  const nombre = sp => tipoEstelar(sp)?.nombre ?? null;
  for (const [sp, esperado] of [['M4Iae', 'Supergigante roja'], ['M5eIbp', 'Supergigante roja'], ['M1-M2Ia-Iab', 'Supergigante roja'],
    ['M2Iab', 'Supergigante roja'], ['B8Ia', 'Supergigante azul'], ['A2Ia', 'Supergigante blanca'], ['K0Ia0', 'Hipergigante naranja'],
    ['F8Ia+', 'Hipergigante blanca amarillenta'], ['K9Ia+B2V', 'Supergigante naranja'], ['M1.5Iab+B2Vn', 'Supergigante roja'], ['B1.5 0-Ia', 'Hipergigante azul'], ['G2_0', 'Hipergigante amarilla'], ['G3_0-Ia', 'Hipergigante amarilla'], ['G2Ib', 'Supergigante amarilla'], ['K2.5Iab', 'Supergigante naranja'],
    ['M2.5III-IV', 'Gigante roja'], ['K2IIICNIb/II', 'Gigante naranja'], ['M3+Ib', 'Supergigante roja'], ['B5(Ib/II)', 'Gigante azul'], ['M5Ib-II', 'Gigante roja'], ['F2I/II:+F3V', 'Gigante blanca amarillenta'], ['K1III', 'Gigante naranja'], ['G8II', 'Gigante amarilla'], ['K0IIIb', 'Gigante naranja'], ['G8IV', 'Subgigante amarilla'], ['K1IV', 'Subgigante naranja'], ['B2IV', 'Subgigante azul'], ['F5IV-V', 'Estrella blanca amarillenta'],
    ['G5IV/V', 'Estrella amarilla'], ['K2III/V', 'Enana naranja'], ['K 0 III', 'Gigante naranja'], ['G 0 V', 'Estrella amarilla'], ['A 0 P (SI)', 'Estrella blanca'],
    ['A P (SI,SR)', 'Estrella blanca'], ['G4_0', 'Hipergigante amarilla'], ['B1-2Ia-0ep', 'Hipergigante azul'], ['B9.5+G8III', 'Estrella azul'], ['F2/5+GIII', 'Estrella blanca amarillenta'],
    ['A8/9(m)+KIII', 'Estrella blanca'], ['M4IVe', 'Enana roja'], ['M3IV', 'Enana roja'], ['M1VIp', 'Subenana roja'], ['K1V-VI', 'Enana naranja'], ['G1.5IV-VFe-1', 'Estrella amarilla'], ['K0/1V+G(III)', 'Enana naranja'], ['K0III-IV', 'Gigante naranja'],
    ['M5.5Ve', 'Enana roja'], ['G2 V', 'Estrella amarilla'], ['DA', 'Enana blanca'], ['sdB', 'Subenana azul']]) {
    assert.equal(nombre(sp), esperado, sp);
  }
  assert.equal(nombre('WC'), null);
  assert.equal(tipoEstelar('M4Iae').clase, 'M');
});

test('el texto genérico sigue la misma clase que la línea de tipo', () => {
  const texto = sp => tipoEstelar(sp)?.texto;
  for (const [sp, clave] of [['B1Ia+', 'Hipergigante'], ['G2_0', 'Hipergigante'], ['K0Ia0', 'Hipergigante'], ['M4Iae', 'Supergigante roja'], ['M1-M2Ia-Iab', 'Supergigante roja'],
    ['B8Ia', 'Supergigante'], ['K2.5Iab', 'Supergigante'], ['F8Ib', 'Supergigante'], ['K0III', 'Gigante roja o naranja'], ['M2.5III-IV', 'Gigante roja o naranja'], ['K2II', 'Gigante roja o naranja'],
    ['G8III', 'Gigante'], ['A0III', 'Gigante'], ['B5II', 'Gigante'], ['G8IV', 'Subgigante'], ['K1IV', 'Subgigante'], ['B2IV', 'Subgigante']]) {
    assert.equal(texto(sp), TEXTOS_CLASE[clave], sp);
  }
  // Enanas, subenanas, enanas blancas y IV-V, como antes: el texto de su letra.
  for (const [sp, letra] of [['M5.5Ve', 'M'], ['G2 V', 'G'], ['K0V', 'K'], ['F5IV-V', 'F'], ['dM4', 'M'], ['DA2', 'D']]) assert.equal(texto(sp), TIPOS[letra][1], sp);
  assert.match(texto('sdM7'), /subenana/);
});

test('los tipos que contradicen el brillo quedan solo con el color, y ninguna estrella conocida se marca', async () => {
  const fs = await import('node:fs');
  const { TOPE_ABSOLUTA, tipoContradiceBrillo } = await import('../src/tipoEstelar.js');
  assert.deepEqual(TOPE_ABSOLUTA, { Hipergigante: 2, Supergigante: 2, Gigante: 4.5, Subgigante: 6 });
  assert.equal(tipoContradiceBrillo('F8Ia', 3.2), true);
  assert.equal(tipoContradiceBrillo('K0III', 5.8), true);
  assert.equal(tipoContradiceBrillo('K0III', 1.8), false);
  assert.equal(tipoContradiceBrillo('G8IV', 5.5), false);
  assert.equal(tipoContradiceBrillo('K0V', 9), false);
  // Supergigantes a menos de 1 kpc: tope 0 (HD 30178, M2Ib a 198 pc con +1,35); más lejos, +2.
  assert.equal(tipoContradiceBrillo('M2Ib', 1.35, 198), true);
  assert.equal(tipoContradiceBrillo('M2Ib', 1.35, 1500), false);
  assert.equal(tipoContradiceBrillo('M2Ib', -0.5, 198), false);
  // Sin clase: el nombre de la letra y su texto de siempre.
  assert.deepEqual(tipoEstelar('F8Ia', { sinClase: true }), { nombre: TIPOS.F[0], texto: TIPOS.F[1], clase: 'F' });
  const todo = JSON.parse(fs.readFileSync('./public/data/tipos-revisados.json', 'utf8')), revisados = todo.estrellas;
  assert.equal(revisados[1292313].catalogo, 'F8Ia'); // HIP 62156
  assert.ok(Object.values(revisados).every(r => r.motivo && 'usado' in r));
  // Enanas conocidas: no se marcan (Alfa Centauri A y B, Tau Ceti, Épsilon Eridani, 61 Cygni A y B, Próxima, Barnard,
  // Vega, Sirio, Altair, Fomalhaut, Achernar y Procyon).
  const marcadas = new Set([...Object.keys(revisados).map(Number), ...todo.neutras]);
  for (const id of [1451193, 1451151, 130695, 260533, 2276178, 2276255, 1436975, 1789453, 1892152, 584955, 2089783, 2469000, 122757, 749263]) assert.ok(!marcadas.has(id), id);
  // Dingolay: K0 del catálogo HD, neutra (brilla más que una enana naranja).
  assert.deepEqual([revisados[1156214].usado, revisados[1156214].neutra], ['K0', true]);
  // Betelgeuse, Rigel, Deneb, Antares, Polaris, Eta Leonis, Rho Cas, VY CMa, UY Scuti, Canopus, Arturo, Aldebarán, Iota Crucis.
  assert.deepEqual([revisados[1296561].usado, revisados[214331].usado], ['B0.5III', 'K3Ib']); // Mimosa y Miram
  for (const id of [463434, 388910, 2220894, 1620181, 191390, 1061687, 2544581, 700584, 101351417, 531292, 1417320, 333847, 1293985]) assert.ok(!(id in revisados), id);
});

test('G, K y M sin clase creíble: nombre y texto neutros; las enanas de clase V muy brillantes quedan sin clase', async () => {
  const { LIMITE_ENANA, NEUTRAS, claseLuminosidad } = await import('../src/tipoEstelar.js');
  assert.deepEqual(LIMITE_ENANA, { B: -5.5, A: -1.5, F: 1, G: 3, K: 4, M: 6 });
  assert.deepEqual(['K0', 'M3e', 'K0V', 'dM4', 'sdM7', 'K0III', 'M1VIp', 'B9.5+G8III'].map(claseLuminosidad), [null, null, 'V', 'V', 'VI', 'Gigante', 'VI', null]);
  assert.deepEqual(tipoEstelar('K0', { neutra: true }), { nombre: 'Estrella naranja', texto: NEUTRAS.K[1], clase: 'K' });
  assert.equal(tipoEstelar('M3e', { neutra: true }).nombre, 'Estrella roja');
  assert.equal(tipoEstelar('G5', { neutra: true }).nombre, 'Estrella amarilla');
  // O, B, A y F no tienen versión neutra: siguen como hoy.
  assert.equal(tipoEstelar('F5', { neutra: true }).texto, TIPOS.F[1]);
  const fs = await import('node:fs');
  const { estrellas, neutras } = JSON.parse(fs.readFileSync('./public/data/tipos-revisados.json', 'utf8'));
  const stars = new Map(JSON.parse(fs.readFileSync('./data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));
  // Las neutras sin clase son G, K o M sin clase de luminosidad.
  assert.ok(neutras.length > 1000);
  assert.ok(neutras.every(i => claseLuminosidad(stars.get(i).sp) === null && 'GKM'.includes(tipoEstelar(stars.get(i).sp).clase)));
  // Las enanas brillantes: clase V, más brillantes que el límite de su letra.
  const brillantes = Object.entries(estrellas).filter(([, r]) => r.motivo === 'enana brillante');
  assert.ok(brillantes.length > 100);
  assert.ok(brillantes.every(([i, r]) => !r.usado && stars.get(Number(i)).m < LIMITE_ENANA[tipoEstelar(r.catalogo).clase]));
});
