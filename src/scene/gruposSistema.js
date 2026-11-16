import { colorCatalogo, estrellaDeComponente } from './visualBinary.js';

const DIAS_ANO = 365.25;

// Las estrellas de un sistema en dos grupos, solo con los datos de star_systems:
// «pares», las parejas con órbita (k = 'o'), y «lejanas», las compañeras anchas (k = 'w') que
// viajan con el sistema a una separación proyectada (rho, en UA).
export function gruposSistema(sistema) {
  if (!sistema) return { pares: [], lejanas: [] };
  const primaria = sistema.star;
  const miembros = { A: { star: primaria, nombre: primaria.n || 'Estrella principal', sp: primaria.sp } };
  for (const c of sistema.components) {
    miembros[c.name] = { star: estrellaDeComponente(sistema, c), nombre: c.companion?.n || `${primaria.n} ${c.name}`, sp: c.pair.sp };
  }
  for (const m of Object.values(miembros)) m.color = colorCatalogo(m.star, m.sp);
  const pares = sistema.components.filter(c => c.pair.k === 'o' && miembros[c.pair.of]).map(c => {
    const { pair } = c;
    return {
      clave: pair.pair, uno: miembros[pair.of], otro: miembros[c.name], pair,
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

// Redondeo a dos cifras para las razones («unas 450 veces»).
export const redondeo = valor => {
  const potencia = 10 ** Math.max(0, Math.floor(Math.log10(valor)) - 1);
  return Math.round(valor / potencia) * potencia;
};
