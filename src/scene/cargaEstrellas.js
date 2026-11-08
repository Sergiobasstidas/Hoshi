// Carga de public/data/estrellas.bin por partes: el catálogo (≈ 4 MB) se entrega apenas llega, sin esperar la capa
// de fondo (≈ 10 MB), que llega después. Formato en estrellasBin.js.
import { ESTRELLAS_URL, cabeceraDe, largoHastaCapa, leerCapa, leerCatalogo } from './estrellasBin.js';

function unir(trozos, total) {
  const salida = new Uint8Array(total);
  let p = 0;
  for (const t of trozos) { salida.set(t, p); p += t.length; }
  return salida.buffer;
}

// alCatalogo(estrellas) y alCapa(capa) se llaman una vez cada uno; devuelve una promesa que termina con la capa.
export async function cargarEstrellas({ alCatalogo, alCapa, alProgreso } = {}) {
  const respuesta = await fetch(ESTRELLAS_URL);
  if (!respuesta.ok) throw new Error(ESTRELLAS_URL);
  const lector = respuesta.body?.getReader();
  if (!lector) {
    // Sin lectura por partes: todo de una vez.
    const buffer = await respuesta.arrayBuffer();
    const { cabecera, estrellas, inicioCapa } = leerCatalogo(buffer);
    alCatalogo?.(estrellas);
    const capa = leerCapa(buffer, cabecera, inicioCapa);
    alCapa?.(capa);
    return capa;
  }
  const trozos = [];
  let recibidos = 0, necesarios = null, cabecera = null, catalogoListo = false;
  for (;;) {
    const { done, value } = await lector.read();
    if (value) { trozos.push(value); recibidos += value.length; }
    if (!cabecera && recibidos >= 12) {
      const inicio = unir(trozos, recibidos);
      const largo = new DataView(inicio).getUint32(8, true);
      if (recibidos >= 12 + largo) {
        ({ cabecera } = cabeceraDe(inicio));
        necesarios = largoHastaCapa(cabecera, 12 + largo);
      }
    }
    if (cabecera && !catalogoListo && recibidos >= necesarios) {
      catalogoListo = true;
      alCatalogo?.(leerCatalogo(unir(trozos, recibidos)).estrellas);
    }
    if (necesarios) alProgreso?.(Math.min(1, recibidos / (necesarios + 8 * cabecera.nCapa)));
    if (done) break;
  }
  const buffer = unir(trozos, recibidos);
  if (!catalogoListo) alCatalogo?.(leerCatalogo(buffer).estrellas);
  const capa = leerCapa(buffer, cabecera, necesarios);
  alCapa?.(capa);
  return capa;
}
