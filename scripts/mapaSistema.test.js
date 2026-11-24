import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapaSistema, nivelesMapa, reglaDe, sentidoDeGiro, tiempoLuz } from '../src/scene/mapaSistema.js';

const sistemas = JSON.parse(readFileSync(new URL('../data/processed/star_systems.json', import.meta.url), 'utf8'));
// Sistema mínimo con nombres fijos («X B», «X C») y, si se dan, posiciones de catálogo por letra.
const armar = (id, posiciones = {}) => ({
  star: { i: Number(id), n: 'X', ...posiciones.A },
  components: sistemas[id].comps.map(c => ({ name: c.n, pair: c, companion: { i: `${id}${c.n}`, n: `X ${c.n}`, ...posiciones[c.n] } })),
  hidden: sistemas[id].hidden,
});
const mapa = (id, posiciones) => mapaSistema(armar(id, posiciones), 2026.9, s => s.n);
const distancia = (m, a, b) => Math.hypot(m.porLetra[a].este - m.porLetra[b].este, m.porLetra[a].norte - m.porLetra[b].norte);

test('Alcyone: C y D quedan donde el WDS los mide desde Alcyone (las posiciones encadenadas desde B calzan)', () => {
  const m = mapa('276732');
  // WDS mide AC en 313° y 24.724 UA (a la distancia del catálogo).
  const c = m.porLetra.C, theta = (Math.atan2(c.este, c.norte) * 180 / Math.PI + 360) % 360;
  assert.ok(Math.abs(theta - 313.5) < 1, `ángulo ${theta}`);
  assert.ok(Math.abs(distancia(m, 'A', 'C') - 24744) < 300);
  assert.equal(m.estrellas.length, 4);
});

test('Dos compañeras con el mismo ρ y θ son un solo punto «D/E»', () => {
  const m = mapa('1407689');
  assert.equal(m.estrellas.length, 2);
  assert.equal(m.porLetra.D.etiqueta, 'D/E');
});

test('Tegmine: C se fija con la posición de B en el año de la medida y no depende del año del mapa', () => {
  const ahora = mapaSistema(armar('839167'), 2026.9, s => s.n), luego = mapaSistema(armar('839167'), 2060, s => s.n);
  assert.ok(Math.abs(ahora.porLetra.C.este - luego.porLetra.C.este) < 1e-9);
  assert.ok(Math.abs(ahora.porLetra.B.este - luego.porLetra.B.este) > 0.1, 'B sí se mueve en su órbita');
});

test('θ¹ Tau: Chamukuy al sur-sureste; Bb gira en torno a θ¹ Tau y C cuelga de θ¹ Tau', () => {
  const m = mapa('325102');
  const angulo = e => (Math.atan2(e.este, e.norte) * 180 / Math.PI + 360) % 360;
  assert.ok(Math.abs(angulo(m.porLetra.B) - 167) < 1 && Math.abs(distancia(m, 'A', 'B') - 16000) < 500);
  const bb = m.pares.find(p => p.otro === 'Bb');
  assert.equal(bb.uno, 'A');
  assert.ok(Math.abs(bb.periodo - 16.26) < 0.05);
  assert.ok(Math.abs(angulo(m.porLetra.C) - 75) < 1 && Math.abs(distancia(m, 'A', 'C') - 12700) < 300);
});

test('Keid: B y C se orbitan cada 233 años, a unas 35 UA, y A queda a unas 400 UA', () => {
  const m = mapa('309538');
  const bc = m.pares.find(p => p.otro === 'C');
  assert.equal(bc.uno, 'B');
  assert.ok(Math.abs(bc.periodo - 233.2) < 0.5);
  assert.ok(distancia(m, 'B', 'C') < 60 && Math.abs(distancia(m, 'A', 'C') - 390) < 5);
  const niveles = nivelesMapa(m);
  assert.ok(niveles[0].marcas.some(k => k.letras.includes('B') && k.letras.includes('C')), 'el par B–C es un punto en la fila 1');
  assert.ok(niveles.some(n => n.orbitas.some(p => p.otro === 'C')), 'y gira en la fila 2');
});

test('Castor se lee de afuera hacia adentro: tres escalas, sin tope de compañeras', () => {
  const niveles = nivelesMapa(mapa('735275'));
  assert.ok(niveles.length >= 3);
  assert.ok(niveles.some(n => n.orbitas.some(p => p.otro === 'Bb')));
});

test('Diadem: la órbita de canto no tiene sentido de giro visible', () => {
  const par = sistemas['1325157'].comps[0];
  assert.equal(sentidoDeGiro(par), 0);
  assert.notEqual(sentidoDeGiro(sistemas['1451193'].comps[0]), 0);
});

test('Regla y tiempo de luz', () => {
  assert.equal(reglaDe(100).texto, 'Neptuno–Sol');
  assert.equal(reglaDe(40000).texto, '2 meses luz');
  assert.equal(reglaDe(0.5).texto, null);
  assert.equal(tiempoLuz(25000), '5 meses luz');
  assert.equal(tiempoLuz(11000), '2 meses luz');
  // 1 UA son 499 segundos luz: segundos bajo 90 s, minutos bajo 90 min.
  assert.equal(tiempoLuz(0.14), '70 segundos luz');
  assert.equal(tiempoLuz(0.26), '2 minutos luz');
  assert.equal(tiempoLuz(1.5), '12 minutos luz');
  assert.equal(tiempoLuz(27), '4 horas luz');
});

test('Las compañeras ocultas se marcan junto a su estrella, con período solo si es medido', () => {
  const id = Object.keys(sistemas).find(k => sistemas[k].hidden?.some(h => h.type === 'S1' && h.of === 'A'));
  const m = mapa(id);
  assert.ok(m.porLetra.A.ocultas.some(o => o.tipo === 'S1' && o.periodo > 0));
});

test('Las compañeras ocultas se cuentan en una frase, con su período solo si es seguro', async () => {
  const { fraseOcultas } = await import('../src/scene/mapaSistema.js');
  assert.equal(fraseOcultas('Mizar B', mapa('1343569').porLetra.B.ocultas), 'Mizar B es doble: su compañera se descubre por su espectro y el bamboleo de su posición (una vuelta cada 176 días).');
  const castorC = mapa('735275').porLetra.C.ocultas;
  assert.equal(fraseOcultas('Castor C', castorC), 'Castor C es a su vez múltiple: una compañera se descubre por su espectro y sus eclipses (una vuelta cada 0,814 días) y otra, sin confirmar, por cambios en el momento de los eclipses.');
});
