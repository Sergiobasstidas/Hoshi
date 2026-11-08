// Carga de public/data/estrellas.bin.gz por partes: el catálogo (≈ 4 MB sin comprimir) se entrega apenas llega, sin
// esperar la capa de fondo (≈ 10 MB), que llega después. El archivo viene con gzip; si el servidor ya lo descomprimió
// (Content-Encoding), se lee tal cual. Formato en estrellasBin.js.
import { ESTRELLAS_URL, cabeceraDe, largoHastaCapa, leerCapa, leerCatalogo } from './estrellasBin.js';

function unir(trozos, total) {
  const salida = new Uint8Array(total);
  let p = 0;
  for (const t of trozos) { salida.set(t, p); p += t.length; }
  return salida.buffer;
}

const esGzip = bytes => bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
const descomprimir = flujo => flujo.pipeThrough(new DecompressionStream('gzip'));

// alCatalogo(estrellas) y alCapa(capa) se llaman una vez cada uno; devuelve una promesa que termina con la capa.
export async function cargarEstrellas({ alCatalogo, alCapa, alProgreso } = {}) {
  const respuesta = await fetch(ESTRELLAS_URL);
  if (!respuesta.ok) throw new Error(ESTRELLAS_URL);
  const lectorRed = respuesta.body?.getReader();
  if (!lectorRed) {
    // Sin lectura por partes: todo de una vez.
    let buffer = await respuesta.arrayBuffer();
    if (esGzip(new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength)))) buffer = await new Response(descomprimir(new Blob([buffer]).stream())).arrayBuffer();
    const { cabecera, estrellas, finCatalogo } = leerCatalogo(buffer);
    alCatalogo?.(estrellas);
    const capa = leerCapa(buffer, cabecera, finCatalogo);
    alCapa?.(capa);
    return capa;
  }
  // El primer trozo dice si viene comprimido.
  let pendiente = await lectorRed.read();
  let lector = lectorRed;
  if (pendiente.value && esGzip(pendiente.value)) {
    const primero = pendiente.value;
    const comprimido = new ReadableStream({
      start(control) { control.enqueue(primero); },
      async pull(control) {
        const { done, value } = await lectorRed.read();
        if (done) control.close(); else control.enqueue(value);
      },
      cancel(motivo) { return lectorRed.cancel(motivo); },
    });
    lector = descomprimir(comprimido).getReader();
    pendiente = null;
  }
  // Todo lo que sigue cuenta bytes ya descomprimidos.
  const trozos = [];
  let recibidos = 0, necesarios = null, cabecera = null, catalogoListo = false;
  for (;;) {
    const { done, value } = pendiente ?? await lector.read();
    pendiente = null;
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
    // Avance hasta tener el catálogo (lo que espera la pantalla de carga), no hasta el final de la capa.
    if (necesarios) alProgreso?.(Math.min(1, recibidos / necesarios));
    if (done) break;
  }
  const buffer = unir(trozos, recibidos);
  if (!catalogoListo) alCatalogo?.(leerCatalogo(buffer).estrellas);
  const capa = leerCapa(buffer, cabecera, necesarios);
  alCapa?.(capa);
  return capa;
}
