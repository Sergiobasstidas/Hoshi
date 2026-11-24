import { colorCatalogo, estrellaDeComponente } from './visualBinary.js';
import { nombreEstrella } from './nombresEstrella.js';

const DIAS_ANO = 365.25;

// Las estrellas de un sistema en dos grupos, solo con los datos de star_systems:
// «pares», las parejas con órbita (k = 'o'), y «lejanas», las compañeras anchas (k = 'w') que
// viajan con el sistema a una separación proyectada (rho, en UA).
// `titulo` (opcional): nombre de una estrella; por omisión, nombreEstrella.
export function gruposSistema(sistema, titulo = estrella => nombreEstrella(estrella)) {
  if (!sistema) return { pares: [], lejanas: [] };
  const miembros = miembrosSistema(sistema, titulo);
  const pares = sistema.components.filter(c => c.pair.k === 'o' && miembros[c.pair.of]).map(c => {
    const { pair } = c;
    return {
      clave: `${pair.of}>${pair.n}`, uno: miembros[pair.of], otro: miembros[c.name], pair,
      periodo: pair.p > 0 ? pair.p / DIAS_ANO : null, a: pair.a > 0 ? pair.a : null, e: pair.e || 0,
      masas: pair.m1 > 0 && pair.m2 > 0 ? [pair.m1, pair.m2] : null,
    };
  });
  const lejanas = sistema.components.filter(c => c.pair.k !== 'o' && miembros[c.pair.of]).map(c => {
    const de = miembros[c.pair.of];
    const rho = c.pair.rho > 0 ? c.pair.rho : null;
    // Cuántas veces más lejos está que la pareja con órbita a la que acompaña.
    const par = pares.find(p => p.a && (p.uno === de || p.otro === de));
    return { miembro: miembros[c.name], de, rho, par: par || null, veces: rho && par ? rho / par.a : null };
  });
  return { pares, lejanas };
}

// Las estrellas del sistema por letra del catálogo («A» la primaria), con nombre y color.
export function miembrosSistema(sistema, titulo = estrella => nombreEstrella(estrella)) {
  const primaria = sistema.star;
  const miembros = { A: { letra: 'A', star: primaria, nombre: titulo(primaria) || 'Estrella principal', sp: primaria.sp } };
  for (const c of sistema.components) {
    const star = estrellaDeComponente(sistema, c);
    // Un solo estilo de nombre en el sistema: si la compañera del catálogo se llama «otra designación + su letra»
    // («40 Eridani B» en Keid), se nombra desde la primaria («Keid B»), como sus hermanas.
    const propio = c.companion ? titulo(star) : nombreSinRegistro(c, miembros);
    const otraDesignacion = c.companion && propio?.endsWith(` ${c.name}`) && !propio.startsWith(`${miembros.A.nombre} `);
    miembros[c.name] = { letra: c.name, star, nombre: otraDesignacion ? `${miembros.A.nombre} ${c.name}` : propio, sp: c.pair.sp };
  }
  for (const m of Object.values(miembros)) m.color = colorCatalogo(m.star, m.sp);
  return miembros;
}

// Nombre legible de una compañera sin registro propio: desde su estrella padre si tiene nombre propio
// («Mizar Cb» → «Alcor B»); si no, desde la primaria con su letra («Theta¹ Tauri Bb»).
function nombreSinRegistro(c, miembros) {
  const raiz = miembros.A, padre = miembros[c.pair.of];
  const propio = padre && padre !== raiz && padre.nombre && !padre.nombre.startsWith(`${raiz.nombre} `);
  if (propio && c.name.startsWith(padre.letra) && c.name.length > padre.letra.length) return `${padre.nombre} ${c.name.slice(padre.letra.length).toUpperCase()}`;
  return `${raiz.nombre} ${c.name}`;
}

// Redondeo a dos cifras para las razones («unas 450 veces»).
export const redondeo = valor => {
  const potencia = 10 ** Math.max(0, Math.floor(Math.log10(valor)) - 1);
  return Math.round(valor / potencia) * potencia;
};
