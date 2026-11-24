import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GASEOSOS, PROPIAS, ROCOSOS, idEyes, pintarMapa, recetaEyes, tipoPorRadio, tipoPorRegla } from '../src/scene/eyes/recetaEyes.js';

// Resultados de Eyes on Exoplanets para unos 200 planetas de todos los tipos y los 16 con mapa propio, guardados fuera
// del código de Eyes (que no está en este repositorio).
const esperado = JSON.parse(fs.readFileSync('./scripts/fixtures/eyes_esperado.json', 'utf8'));
const cerca = (a, b, tolerancia, que) => {
  assert.equal(a.length, b.length, que);
  a.forEach((v, k) => Array.isArray(v) ? cerca(v, b[k], tolerancia, que) : assert.ok(Math.abs(v - b[k]) <= tolerancia, `${que}: ${v} ≠ ${b[k]}`));
};

const eyes = JSON.parse(fs.readFileSync('./public/data/exoplanetas-eyes.json', 'utf8'));

test('la receta de cada planeta elige los mismos mapas y colores que Eyes', () => {
  const tipos = new Set(esperado.recetas.map(r => r.tipo));
  for (const t of ['Hot Jupiter', 'Gas Giant', 'Neptune-like', 'lavaAtmos', 'lavaNoAtmos', 'desertAtmos', 'desertNoAtmos', 'iceAtmos', 'NA']) assert.ok(tipos.has(t), t);
  assert.ok(esperado.recetas.length >= 180);
  for (const e of esperado.recetas) {
    const r = recetaEyes(e.id, e.tipo), que = `${e.id} (${e.tipo})`;
    assert.equal(r.normal, e.normal, que);
    assert.deepEqual(r.bases, e.bases, que);
    assert.ok(Math.abs(r.pesoBase1 - e.pesoBase1) < 1e-8, que);
    cerca(r.canales, e.canales, 1e-12, que);
    assert.deepEqual(r.detalles.map(d => d.archivo), e.detalles.map(d => d.archivo), que);
    cerca(r.detalles.map(d => d.color), e.detalles.map(d => d.color), 1e-12, que);
  }
  for (const n of ['51 Peg b', 'GJ 436 b', 'LHS 1140 b']) assert.ok(esperado.recetas.some(e => e.id === idEyes(n)), n);
  // Mapas propios: los mismos archivos que en Eyes.
  assert.deepEqual(Object.keys(PROPIAS).sort(), Object.keys(esperado.propias).sort());
  for (const [id, p] of Object.entries(esperado.propias)) assert.deepEqual([PROPIAS[id].color, PROPIAS[id].especular || null], [p.color, p.especular], id);
});

test('cada exoplaneta de Hoshi tiene su tipo de Eyes, y los mapas propios y la composición son los de Eyes', () => {
  const nombres = JSON.parse(fs.readFileSync('./public/data/exoplanets.json', 'utf8')).systems.flatMap(s => s.p.map(p => p.n));
  for (const n of nombres) assert.ok(eyes.c[eyes.p[n]], n);
  assert.ok(eyes.meta.cruzados >= 6000, `${eyes.meta.cruzados} cruzados`);
  for (const [id, propia] of Object.entries(PROPIAS)) {
    assert.ok(fs.existsSync(`./public/textures/eyes-exoplanetas/${propia.color}`), id);
    if (propia.especular) assert.ok(fs.existsSync(`./public/textures/eyes-exoplanetas/${propia.especular}`), id);
  }
  // Un píxel: base0 + peso · base1, canales teñidos y un detalle encima con la mitad de opacidad.
  const receta = { bases: ['b0', 'b1'], pesoBase1: 0.5, canales: [[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 0.5, 1]],
    detalles: [{ archivo: 'd0', color: [0, 0, 0, 1] }] };
  const px = pintarMapa(receta, { b0: [102, 51, 204, 255], b1: [102, 0, 0, 255], d0: [0, 0, 0, 127.5] }, 1, 1);
  // (0,4; 0,2; 0,8) + 0,5 · (0,4; 0; 0) = (0,6; 0,2; 0,8) → teñido (0,6; 0,2; 0,4) → detalle (0,3; 0,1; 0,2).
  [0.3, 0.1, 0.2, 1].forEach((v, k) => assert.ok(Math.abs(px[k] - v * 255) <= 0.5, `canal ${k}: ${px[k]}`));
});

// La versión anterior de pintarMapa (con arreglos por píxel), para comprobar que la nueva da exactamente lo mismo.
function pintarMapaAnterior(receta, imagenes, ancho, alto) {
  const salida = new Uint8ClampedArray(ancho * alto * 4);
  const [base0, base1] = receta.bases.map(f => imagenes[f]), [c0, c1, c2] = receta.canales;
  const capas = receta.detalles.map(d => [imagenes[d.archivo], d.color]);
  for (let p = 0; p < salida.length; p += 4) {
    let mezcla = [0, 1, 2].map(k => (base0[p + k] + (base1 ? receta.pesoBase1 * base1[p + k] : 0)) / 255);
    mezcla = [0, 1, 2].map(k => mezcla[0] * c0[k] + mezcla[1] * c1[k] + mezcla[2] * c2[k]);
    for (const [pixeles, color] of capas) {
      const opacidad = pixeles[p + 3] / 255;
      mezcla = mezcla.map((v, k) => v + (color[k] - v) * opacidad);
    }
    salida.set([mezcla[0] * 255, mezcla[1] * 255, mezcla[2] * 255, 255], p);
  }
  return salida;
}

test('pintarMapa da exactamente lo mismo que la versión anterior, con una base o dos y varios detalles', () => {
  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const ancho = 64, alto = 32, imagen = () => Uint8ClampedArray.from({ length: ancho * alto * 4 }, () => Math.floor(azar() * 256));
  const imagenes = { b0: imagen(), b1: imagen(), d0: imagen(), d1: imagen(), d2: imagen() };
  for (const id of ['Kepler-22_b', 'HD_209458_b', 'WASP-12_b', 'TRAPPIST-1_e', 'GJ_436_b']) {
    for (const tipo of ['Gas Giant', 'Hot Jupiter', 'Neptune-like', 'lavaAtmos', 'desertNoAtmos', 'iceAtmos', 'Unknown']) {
      const receta = recetaEyes(id, tipo);
      for (const bases of [['b0'], ['b0', 'b1']]) {
        const prueba = { ...receta, bases, detalles: receta.detalles.map((d, k) => ({ ...d, archivo: `d${k % 3}` })) };
        assert.deepEqual(pintarMapa(prueba, imagenes, ancho, alto), pintarMapaAnterior(prueba, imagenes, ancho, alto), `${id} ${tipo} ${bases.length}`);
      }
    }
  }
});

test('la regla de tipos sigue la clasificación de Eyes', () => {
  assert.equal(tipoPorRegla({ m: 0.5, r: 0.9, a: 0.01 }), 'lavaNoAtmos');
  assert.equal(tipoPorRegla({ m: 4, r: 1.5, a: 0.1 }), 'lavaAtmos');
  assert.equal(tipoPorRegla({ m: 4, r: 1.5, a: 0.8 }), 'desertAtmos');
  assert.equal(tipoPorRegla({ m: 3, r: 1.3, a: 5 }), 'iceAtmos');
  assert.equal(tipoPorRegla({ m: 8, r: 2.7, a: 0.1 }), 'Neptune-like');
  assert.equal(tipoPorRegla({ m: 300, r: 13, a: 0.05, teq: 1300 }), 'Hot Jupiter');
  assert.equal(tipoPorRegla({ m: 1500, r: null, a: 5, teq: 120 }), 'Gas Giant');
  assert.equal(tipoPorRegla({ m: null, r: null }), 'NA');
});

test('la ficha y el aspecto de cada planeta nunca se contradicen', () => {
  const planetas = JSON.parse(fs.readFileSync('./public/data/exoplanets.json', 'utf8')).systems.flatMap(s => s.p);
  const par = n => eyes.c[eyes.p[n]];
  for (const p of planetas) {
    const [aspecto, tipo] = par(p.n);
    if (tipo === 'Planeta rocoso' || tipo === 'Supertierra') assert.ok(ROCOSOS.has(aspecto), `${p.n}: ${tipo} con aspecto ${aspecto}`);
    if (tipo === 'Tipo Neptuno' || tipo === 'Gigante gaseoso') assert.ok(GASEOSOS.has(aspecto), `${p.n}: ${tipo} con aspecto ${aspecto}`);
  }
  // Masa publicada solo como límite superior: el tipo sale del radio y el aspecto es rocoso.
  for (const n of ['Kepler-42 c', 'Kepler-32 f', 'KOI-4777.01']) {
    const p = planetas.find(x => x.n === n), [aspecto, tipo] = par(n);
    assert.equal(tipo, tipoPorRadio(p.r), n);
    assert.ok(ROCOSOS.has(aspecto), `${n}: ${aspecto}`);
  }
  // Los demás, como Eyes: GJ 436 b tipo Neptuno, 51 Peg b gigante, TRAPPIST-1 e rocoso.
  assert.deepEqual(par('GJ 436 b'), ['Neptune-like', 'Tipo Neptuno']);
  assert.deepEqual(par('51 Peg b'), ['Hot Jupiter', 'Gigante gaseoso']);
  assert.equal(par('TRAPPIST-1 e')[1], 'Planeta rocoso');
});
