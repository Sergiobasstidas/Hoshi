// scripts/catalog/pecaut_mamajek.js
// Secuencia media de enanas de Pecaut & Mamajek (2013, ApJS 208, 9), versión en línea de E. Mamajek
// («A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence»). Se guarda con red.js en
// data/raw/red/pecaut_mamajek; sin HOSHI_RED=descargar se lee de ahí.
// Uso: tipo espectral → B−V (color por tipo, solo para dibujar) y la relación BP−RP → B−V de las enanas M.
import { pedir } from './red.js';

export const URL_TABLA = 'https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt';

// Filas { sp, bv, bpRp, mv } de la tabla (null donde la tabla no trae valor).
export async function tablaPecautMamajek() {
  const texto = await pedir('pecaut_mamajek', URL_TABLA, { signal: AbortSignal.timeout(120000), aceptar: (t, r) => r.ok && t.includes('SpT') });
  const lineas = texto.split('\n');
  const cab = lineas.find(l => /^#SpT\s/.test(l));
  if (!cab) throw new Error('Pecaut & Mamajek: sin cabecera');
  const col = cab.replace(/^#/, '').trim().split(/\s+/);
  const idx = n => col.indexOf(n);
  const valor = (p, n) => { const v = p[idx(n)]; return v === undefined || /^\.+$/.test(v) || v === '' ? null : Number(v); };
  const filas = [];
  let enTabla = false;
  for (const l of lineas) {
    if (l === cab) { enTabla = true; continue; }
    if (!enTabla) continue;
    if (/^#SpT/.test(l)) break;
    const p = l.trim().split(/\s+/);
    if (!/^[OBAFGKMLTY]\d/.test(p[0] || '')) continue;
    filas.push({ sp: p[0], bv: valor(p, 'B-V'), bpRp: valor(p, 'Bp-Rp'), mv: valor(p, 'Mv') });
  }
  return filas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const filas = await tablaPecautMamajek();
  console.log(`Pecaut & Mamajek: ${filas.length} filas`);
  for (const f of filas.filter(f => /^(K5|K7|M)/.test(f.sp))) console.log(f.sp, f.bv, f.bpRp, f.mv);
}

// Tipo espectral → B−V de la enana de ese tipo (interpolado por subtipo; sin subtipo, el 5). Solo para dibujar
// estrellas sin color medido: no es una medida y no se muestra como dato. null si el tipo no es O–M.
export function bvPorTipo(filas) {
  const LETRAS = 'OBAFGKM';
  const codigo = sp => { const m = sp.match(/^([OBAFGKM])(\d+(?:\.\d+)?)/); return m ? LETRAS.indexOf(m[1]) * 10 + Number(m[2]) : null; };
  const puntos = filas.filter(f => f.bv !== null && codigo(f.sp) !== null).map(f => [codigo(f.sp), f.bv]).sort((a, b) => a[0] - b[0]);
  return sp => {
    const t = String(sp || '').trim().replace(/^(sd|esd|usd|d|g|c)(?=[OBAFGKM])/, '');
    const m = t.match(/^([OBAFGKM])(\d+(?:\.\d+)?)?/);
    if (!m) return null;
    const c = LETRAS.indexOf(m[1]) * 10 + (m[2] !== undefined ? Number(m[2]) : 5);
    if (c <= puntos[0][0]) return puntos[0][1];
    for (let k = 1; k < puntos.length; k++) {
      if (c <= puntos[k][0]) { const [x0, y0] = puntos[k - 1], [x1, y1] = puntos[k]; return Number((y0 + (y1 - y0) * (c - x0) / (x1 - x0)).toFixed(3)); }
    }
    return puntos[puntos.length - 1][1];
  };
}
