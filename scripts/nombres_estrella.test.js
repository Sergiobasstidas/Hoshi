import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildStarSystems, estrellaDeComponente } from '../src/scene/visualBinary.js';
import { nombreEstrella } from '../src/scene/nombresEstrella.js';
import { gruposSistema } from '../src/scene/gruposSistema.js';
import { estrellaBajoCursor, nombreYaVisible, prepararSeleccion } from '../src/scene/seleccionEstrella.js';

// Catálogo, sistemas y títulos como los arma App.jsx (estrellas.bin trae las mismas estrellas que stars_15pc.json).
const estrellas = JSON.parse(fs.readFileSync('./data/processed/stars_15pc.json', 'utf8'));
const porId = new Map(estrellas.map(s => [s.i, s]));
const sistemas = buildStarSystems(JSON.parse(fs.readFileSync('./data/processed/star_systems.json', 'utf8')), porId);
for (const sistema of sistemas) {
  sistema.star.system = sistema;
  for (const c of sistema.components) if (c.companion) c.companion.sistemaDe = sistema;
}
for (const s of JSON.parse(fs.readFileSync('./public/data/exoplanets.json', 'utf8')).systems) {
  const star = porId.get(s.i);
  if (star) (star.planetary ||= []).push({ name: s.h });
}
const filasTitulos = JSON.parse(fs.readFileSync('./public/data/titulos.json', 'utf8'));
const titulos = new Map(filasTitulos.map(([id, t]) => [id, t])), bases = new Map(filasTitulos.filter(f => f[2]).map(([id, , b]) => [id, b]));
const sistemaDe = id => sistemas.find(s => s.star.i === id);
const companera = (id, letra) => { const s = sistemaDe(id); return estrellaDeComponente(s, s.components.find(c => c.name === letra)); };
const nombre = (star, conTitulos = true) => nombreEstrella(star, conTitulos ? titulos : new Map(), conTitulos ? bases : new Map());

test('nombreEstrella: título, sistema planetario, primaria + letra y WDS como último recurso', () => {
  // TOI-4156 (sin nombre de etiqueta, a 217 pc) y su compañera B.
  const toi = porId.get(9003123), b = companera(9003123, 'B');
  assert.equal(toi.n, null);
  assert.equal(nombre(toi), 'TOI-4156');
  assert.equal(nombre(b), 'TOI-4156 B');
  // Sin títulos, por el nombre de su sistema planetario.
  assert.equal(nombre(toi, false), 'TOI-4156');
  assert.equal(nombre(b, false), 'TOI-4156 B');
  // Sin título ni planetas, el WDS con su prefijo.
  const sinNada = { ...toi, planetary: undefined };
  const sistemaSinNada = { ...sistemaDe(9003123), star: sinNada };
  assert.equal(nombreEstrella({ i: '9003123-B', n: null, componente: 'B', sistemaDe: sistemaSinNada }, new Map(), new Map()), 'WDS 15231+7620 B');
  // La A, AB o Aa de la primaria no se repite: «LTT 1445 C», «COCONUTS-2 B».
  assert.equal(nombre(companera(226545, 'C')), 'LTT 1445 C');
  assert.equal(nombreEstrella({ i: 'x-B', n: null, componente: 'B', sistemaDe: { star: { i: 1, n: null }, wds: '00000+0000' } }, new Map([[1, 'COCONUTS-2A']]), new Map()), 'COCONUTS-2 B');
  // Con registro propio, su nombre (55 Cnc B); 51 Psc Ab y GJ 900 BC por su primaria.
  assert.equal(nombre(companera(929640, 'B')), '55 Cancri B');
  assert.equal(nombre(companera(42657, 'Ab')), '51 Psc Ab');
  assert.equal(nombre(companera(2519108, 'BC')), 'GJ 900 BC');
  // p Eridani: las dos estrellas se llaman igual, y el sistema las distingue por estrella.
  const { pares, lejanas } = gruposSistema(sistemaDe(125360), s => nombre(s));
  const miembros = [...pares.flatMap(p => [p.uno, p.otro]), ...lejanas.flatMap(l => [l.miembro, l.de])];
  assert.deepEqual(new Set(miembros.map(m => m.star.i)), new Set([125360, 125364]));
  assert.ok(miembros.every(m => m.nombre === 'p Eridani'));
});

test('ninguna etiqueta ni nombre de los sistemas dice null, undefined ni un WDS sin prefijo', () => {
  assert.ok(sistemas.length > 5000, `${sistemas.length} sistemas`);
  const malos = [];
  for (const sistema of sistemas) {
    for (const star of [sistema.star, ...sistema.components.map(c => estrellaDeComponente(sistema, c))]) {
      const n = nombre(star);
      if (!n || /null|undefined/.test(n) || /^\d{5}[+-]\d{4}/.test(n)) malos.push(`${sistema.star.i}: ${n}`);
    }
  }
  assert.deepEqual(malos.slice(0, 10), []);
});

test('el clic elige la estrella más brillante a pocos píxeles del cursor entre las que se ven', () => {
  // Cámara en el origen mirando hacia −z (la de three.js), 90° de campo en un lienzo de 200 × 200.
  const matriz = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -0.002, 0];
  const datos = prepararSeleccion([
    { i: 1, x: 0, y: 0, z: -10, m: 5 }, // al centro, débil
    { i: 2, x: 0.05, y: 0, z: -10, m: 1 }, // a medio píxel, brillante
    { i: 3, x: 3, y: 0, z: -10, m: -5 }, // lejos del cursor
    { i: 4, x: 0, y: 0, z: 10, m: -5 }, // detrás de la cámara
  ]);
  const elegir = opciones => estrellaBajoCursor(datos, { matriz, origen: [0, 0, 0], camara: [0, 0, 0], ancho: 200, alto: 200, cx: 100, cy: 100, ...opciones });
  assert.equal(datos.estrellas[elegir({})].i, 2);
  // A simple vista (límite 6): a 10 pc la magnitud aparente es la absoluta; con límite 0, ninguna de las dos se ve.
  assert.equal(datos.estrellas[elegir({ fisico: 1, limite: 6 })].i, 2);
  assert.equal(elegir({ fisico: 1, limite: -1 }), -1);
  assert.equal(elegir({ cx: 150 }), -1);
});

test('sin margen: un clic no elige una estrella más débil que el límite del modo, ni una tapada', () => {
  const matriz = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -0.002, 0];
  const datos = prepararSeleccion([{ i: 1, x: 0, y: 0, z: -10, m: 5 }, { i: 2, x: 0.05, y: 0, z: -10, m: 1 }]);
  const elegir = opciones => estrellaBajoCursor(datos, { matriz, origen: [0, 0, 0], camara: [0, 0, 0], ancho: 200, alto: 200, cx: 100, cy: 100, ...opciones });
  // Magnitud aparente 1 con límite 0,5: el punto ya no se ve, así que no se elige (antes contaba hasta límite + 1).
  assert.equal(elegir({ fisico: 1, limite: 0.5 }), -1);
  assert.equal(datos.estrellas[elegir({ fisico: 1, limite: 1.01 })].i, 2);
  // Tapada por un disco más cercano: se elige la otra, y si todas están tapadas, ninguna.
  assert.equal(datos.estrellas[elegir({ oculta: k => datos.estrellas[k].i === 2 })].i, 1);
  assert.equal(elegir({ oculta: () => true }), -1);
});

test('el nombre al pasar el mouse no se repite si ya se ve en la escena', () => {
  const escena = [{ texto: 'Tau Ceti', visible: true }, { texto: 'Sirio A', visible: false }, { texto: 'TOI-4156 B', visible: true }];
  assert.equal(nombreYaVisible('Tau Ceti', escena), true);
  assert.equal(nombreYaVisible('TOI-4156 B', escena), true);
  assert.equal(nombreYaVisible('Sirio A', escena), false);
  assert.equal(nombreYaVisible('63 Ceti', escena), false);
});
