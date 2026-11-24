import { eccentricAnomaly } from './binaryOrbit.js';
import { skyOffset } from './visualBinary.js';
import { miembrosSistema } from './gruposSistema.js';
import { nombreEstrella } from './nombresEstrella.js';

const DIAS_ANO = 365.25;
const mjdAAno = mjd => 2000 + (mjd - 51544.5) / DIAS_ANO;
// Un grupo que ocupa menos de esta fracción de su nivel se ve aparte, ampliado.
export const FRACCION_AMPLIAR = 0.2;
const RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
// Tipos de compañera oculta (MSC) cuyo período es medido: espectroscópicas, eclipsantes, variables o astrométricas.
const PERIODO_MEDIDO = new Set(['S1', 'S2', 'E', 'V', 'A']);

// Hacia dónde queda una estrella respecto de otra en el cielo (ángulo de posición: norte hacia el este).
export const rumbo = theta => RUMBOS[Math.round(((theta % 360) + 360) % 360 / 45) % 8];

const conOrbita = pair => pair?.k === 'o' && pair.p > 0 && pair.a > 0 && Number.isFinite(pair.t);

// Posición de la compañera de un par con órbita respecto de la primaria en el año dado:
// este y norte en el cielo, en UA (ORB6: a, e, i, nodo, ω, período en días y periastro en MJD).
export function posicionEnOrbita(pair, ano) {
  const periodo = pair.p / DIAS_ANO, periastro = mjdAAno(pair.t);
  const E = eccentricAnomaly(2 * Math.PI * (ano - periastro) / periodo, pair.e);
  const { east, north } = skyOffset(pair, E);
  return [east, north];
}

// La órbita relativa completa vista en el cielo (este, norte en UA), para dibujarla.
export function curvaOrbita(pair, n = 120) {
  return Array.from({ length: n + 1 }, (_, i) => { const { east, north } = skyOffset(pair, i / n * 2 * Math.PI); return [east, north]; });
}

// Sentido de giro en el cielo tal como se dibuja (norte arriba, este a la izquierda): +1 horario, −1 antihorario.
// Con la elipse de canto (i ≈ 90°) no hay sentido visible: 0.
export function sentidoDeGiro(pair) {
  if (Math.abs(pair.i - 90) < 2) return 0;
  const curva = curvaOrbita(pair, 64).map(([e, n]) => [-e, -n]);
  let area = 0;
  for (let k = 0; k < curva.length - 1; k++) area += curva[k][0] * curva[k + 1][1] - curva[k + 1][0] * curva[k][1];
  // Con y hacia abajo (como en pantalla), área positiva es giro horario.
  return area > 0 ? 1 : -1;
}

// Ángulo de posición (grados) de una estrella del catálogo vista desde otra, con sus posiciones x, y, z (pc, ecuatoriales).
export function anguloEntre(desde, hacia) {
  const d = Math.hypot(desde.x, desde.y, desde.z);
  const ra = Math.atan2(desde.y, desde.x), dec = Math.asin(desde.z / d);
  const h = Math.hypot(hacia.x, hacia.y, hacia.z);
  const dx = hacia.x / h - desde.x / d, dy = hacia.y / h - desde.y / d, dz = hacia.z / h - desde.z / d;
  const este = -dx * Math.sin(ra) + dy * Math.cos(ra);
  const norte = -dx * Math.sin(dec) * Math.cos(ra) - dy * Math.sin(dec) * Math.sin(ra) + dz * Math.cos(dec);
  return (Math.atan2(este, norte) * 180 / Math.PI + 360) % 360;
}
const tienePosicion = star => [star?.x, star?.y, star?.z].every(Number.isFinite) && Math.hypot(star.x, star.y, star.z) > 0;

// Mapa del sistema tal como se ve desde la Tierra, a escala: cada estrella en su dirección y separación
// medidas (rho en UA, theta en grados), encadenadas desde la estrella con la que se midió («of», que dice
// desde dónde se midió, no de quién depende). Las de un par con órbita van en su órbita en el año dado.
// Devuelve las estrellas (sin repetir) con su posición (este, norte en UA), los pares con órbita y el tamaño.
export function mapaSistema(sistema, ano, titulo = estrella => nombreEstrella(estrella)) {
  if (!sistema) return null;
  const miembros = miembrosSistema(sistema, titulo);
  const porLetra = { A: { ...miembros.A, este: 0, norte: 0, de: null, letras: ['A'], ocultas: [] } };
  const lista = [porLetra.A];
  const pares = [];
  for (const c of sistema.components) {
    const padre = porLetra[c.pair.of];
    if (!padre) continue;
    const { pair } = c;
    // Un compuesto que repite letras ya dibujadas («BC» con C ya puesta en Keid) es el mismo punto.
    const letras = c.name.length > 1 && /^[A-Z]+$/.test(c.name) ? [...c.name] : [c.name];
    const repetida = lista.find(e => e.letras.some(l => letras.includes(l) || l === c.name) || (e.de === pair.of && e.pair && !conOrbita(e.pair)
      && Math.abs(e.pair.rho - pair.rho) < 1e-6 && Math.abs(e.pair.theta - pair.theta) < 1e-6));
    if (repetida && !conOrbita(pair)) {
      repetida.letras.push(c.name);
      repetida.etiqueta = repetida.letras.join('/');
      porLetra[c.name] = repetida;
      continue;
    }
    let este, norte;
    if (conOrbita(pair)) {
      [este, norte] = posicionEnOrbita(pair, ano);
    } else if (pair.rho > 0 && Number.isFinite(pair.theta)) {
      // Raíz invertida: si el catálogo pone a la compañera a unos 180° del ángulo medido, el par se midió al revés.
      let theta = pair.theta;
      const estrella = miembros[c.name]?.star;
      if (tienePosicion(padre.star) && tienePosicion(estrella) && estrella !== padre.star) {
        const real = anguloEntre(padre.star, estrella);
        const diferencia = Math.abs(((real - theta + 540) % 360) - 180);
        if (diferencia > 150) theta = (theta + 180) % 360;
      }
      const t = theta * Math.PI / 180;
      este = pair.rho * Math.sin(t); norte = pair.rho * Math.cos(t);
    } else continue;
    // Una ancha medida desde la compañera de una órbita (Tegmine C, de B) se fija con la posición de esa
    // compañera en el año de la medida: no se balancea con la órbita.
    let base = [padre.este, padre.norte];
    if (!conOrbita(pair) && padre.de && conOrbita(padre.pair) && pair.year) {
      const abuelo = porLetra[padre.de], [pe, pn] = posicionEnOrbita(padre.pair, pair.year);
      base = [abuelo.este + pe, abuelo.norte + pn];
    }
    const estrella = { ...miembros[c.name], este: base[0] + este, norte: base[1] + norte, de: c.pair.of, pair, letras: [c.name], ocultas: [] };
    porLetra[c.name] = estrella;
    lista.push(estrella);
    if (conOrbita(pair)) pares.push({ uno: c.pair.of, otro: c.name, pair, periodo: pair.p / DIAS_ANO, extension: pair.a * (1 + pair.e), sentido: sentidoDeGiro(pair) });
  }
  // Compañeras ocultas (MSC): no se ven por separado; se marcan junto a su estrella.
  for (const oculta of sistema.hidden || []) {
    const estrella = porLetra[oculta.of];
    if (!estrella) continue;
    // El tipo del MSC puede traer varios códigos («S1,a», «S2,E»); con «?» el período no es seguro.
    const medido = !String(oculta.type).includes('?') && String(oculta.type).split(',').some(t => PERIODO_MEDIDO.has(t.replace('*', '').trim()));
    estrella.ocultas.push({ letra: oculta.n, tipo: oculta.type, periodo: medido && oculta.p > 0 ? oculta.p : null });
  }
  const xs = lista.map(e => e.este), ys = lista.map(e => e.norte);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return { estrellas: lista, porLetra, pares, span };
}

// Cómo se descubre una compañera oculta, en palabras, según los códigos de tipo del MSC (ReadMe): S, S1, S2 espectro;
// E eclipses; E* cambios en el momento de los eclipses; A o a bamboleo de la posición; V par visual muy cerrado.
// «?» = sin confirmar. El período solo cuando es seguro (ver mapaSistema).
const MEDIOS = [[/^S/, 'su espectro'], [/^E\*/, 'cambios en el momento de los eclipses'], [/^E/, 'sus eclipses'], [/^a$|^A/, 'el bamboleo de su posición'], [/^V/, 'un par visual muy cerrado']];
export function comoSeRevela(oculta) {
  const codigos = String(oculta.tipo || '').split(',').map(t => t.trim()).filter(Boolean);
  const medios = [...new Set(codigos.map(t => MEDIOS.find(([re]) => re.test(t.replace('?', '')))?.[1]).filter(Boolean))];
  const sinConfirmar = codigos.some(t => t.includes('?'));
  const vuelta = oculta.periodo ? ` (una vuelta cada ${oculta.periodo < 365.25 ? `${numeroCorto(oculta.periodo)} días` : `${numeroCorto(oculta.periodo / 365.25)} años`})` : '';
  const por = medios.length ? `por ${medios.length > 1 ? `${medios.slice(0, -1).join(', ')} y ${medios.at(-1)}` : medios[0]}` : 'por medidas indirectas';
  return { sinConfirmar, texto: `${por}${vuelta}` };
}
// Frase completa para una estrella con compañeras ocultas: «Mizar B es doble: …», «Castor C es a su vez múltiple: …».
export function fraseOcultas(nombre, ocultas) {
  // Primero las confirmadas.
  const partes = ocultas.map(comoSeRevela).sort((a, b) => a.sinConfirmar - b.sinConfirmar);
  if (partes.length === 1) return `${nombre} es doble: su compañera se descubre${partes[0].sinConfirmar ? ', sin confirmar,' : ''} ${partes[0].texto}.`;
  const lista = partes.map((p, k) => `${k === 0 ? 'una compañera se descubre' : 'otra'}${p.sinConfirmar ? ', sin confirmar,' : ''} ${p.texto}`);
  return `${nombre} es a su vez múltiple: ${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}.`;
}
const numeroCorto = v => v.toLocaleString('es-CL', { maximumSignificantDigits: 3 });

// Niveles de zoom del mapa. En cada nivel, las estrellas que quedan a menos de FRACCION_AMPLIAR del
// tamaño del nivel se juntan en un solo punto, y ese grupo se muestra en un nivel propio, ampliado.
// Así Castor (0,05 UA dentro de 100 UA dentro de 1.050 UA) se lee de afuera hacia adentro.
// Cada nivel: sus marcas (una estrella o un grupo), los pares con órbita que se ven, su tamaño (UA), de qué
// nivel sale y cuántas veces se amplía.
export function nivelesMapa(mapa) {
  if (!mapa) return [];
  const porLetra = Object.fromEntries(mapa.estrellas.map(e => [e.letras[0], e]));
  const profundidad = letra => { let n = 0; for (let e = porLetra[letra]; e?.de; e = mapa.porLetra[e.de]) n++; return n; };
  const niveles = [];
  const armar = (letras, padre, ancla) => {
    const pts = letras.map(l => porLetra[l]);
    const orbitas = mapa.pares.filter(p => letras.includes(p.uno) && letras.includes(p.otro));
    const extension = Math.max(...pts.map(p => p.este)) - Math.min(...pts.map(p => p.este)),
      alto = Math.max(...pts.map(p => p.norte)) - Math.min(...pts.map(p => p.norte));
    const span = Math.max(extension, alto, ...orbitas.map(p => 2 * p.extension));
    const umbral = FRACCION_AMPLIAR * span;
    const grupo = Object.fromEntries(letras.map(l => [l, l]));
    const raiz = l => (grupo[l] === l ? l : (grupo[l] = raiz(grupo[l])));
    for (const a of pts) for (const b of pts) {
      if (a !== b && Math.hypot(a.este - b.este, a.norte - b.norte) < umbral) grupo[raiz(a.letras[0])] = raiz(b.letras[0]);
    }
    const grupos = {};
    for (const l of letras) (grupos[raiz(l)] ||= []).push(l);
    const nivel = { id: niveles.length, span, padre, ancla, marcas: [], orbitas: [] };
    niveles.push(nivel);
    const hijos = [];
    if (Object.keys(grupos).length === 1) nivel.marcas = letras.map(l => ({ letra: l, letras: [l] }));
    else for (const miembros of Object.values(grupos)) {
      miembros.sort((a, b) => profundidad(a) - profundidad(b));
      nivel.marcas.push({ letra: miembros[0], letras: miembros });
      if (miembros.length > 1) hijos.push(miembros);
    }
    // Se dibuja la órbita de un par si sus dos estrellas se ven (sueltas o encabezando su grupo).
    nivel.orbitas = mapa.pares.filter(p => nivel.marcas.some(m => m.letra === p.uno) && nivel.marcas.some(m => m.letra === p.otro));
    for (const miembros of hijos) {
      const hijo = armar(miembros, nivel.id, miembros[0]);
      hijo.factor = span / Math.max(hijo.span, 1e-9);
    }
    return nivel;
  };
  armar(mapa.estrellas.map(e => e.letras[0]), null, 'A');
  return niveles;
}

// Regla del mapa: la referencia más larga que no pase del 38 % del ancho de la fila (en UA).
export const REFERENCIAS = [
  [0.39, 'Mercurio–Sol'], [1, 'Tierra–Sol'], [5.2, 'Júpiter–Sol'], [30, 'Neptuno–Sol'],
  [173, '1 día luz (Voyager 1)'], [1212, '1 semana luz'], [5270, '1 mes luz'], [10540, '2 meses luz'],
  [15810, '3 meses luz'], [63241, '1 año luz'],
];
export function reglaDe(anchoUa) {
  const cabe = REFERENCIAS.filter(([ua]) => ua <= 0.38 * anchoUa);
  if (cabe.length) return { ua: cabe.at(-1)[0], texto: cabe.at(-1)[1] };
  // Más chico que Mercurio–Sol: un valor redondo sin referencia.
  const objetivo = 0.3 * anchoUa, potencia = 10 ** Math.floor(Math.log10(objetivo));
  const ua = [5, 2, 1].map(f => f * potencia).find(v => v <= objetivo) ?? potencia;
  return { ua, texto: null };
}

// Tiempo que tarda la luz en recorrer una distancia (UA), en palabras: 1 UA son 499 segundos luz.
export function tiempoLuz(ua) {
  const segundos = ua * 499.005;
  const redondo = v => v.toLocaleString('es-CL', { maximumSignificantDigits: 2 });
  if (segundos < 90) return `${Math.max(1, Math.round(segundos))} segundos luz`;
  if (segundos < 90 * 60) { const m = Math.round(segundos / 60); return m === 1 ? '1 minuto luz' : `${m} minutos luz`; }
  const dias = segundos / 86400;
  if (dias < 1) { const h = Math.round(segundos / 3600); return h === 1 ? '1 hora luz' : `${h} horas luz`; }
  if (dias < 30) { const d = Math.round(dias); return d === 1 ? '1 día luz' : `${d} días luz`; }
  if (dias < 365.25) { const meses = Math.round(dias / 30.44); return meses === 1 ? '1 mes luz' : `${meses} meses luz`; }
  return `${redondo(dias / 365.25)} años luz`;
}
