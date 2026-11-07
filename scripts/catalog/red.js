// scripts/catalog/red.js
// Consultas a servicios externos (SIMBAD, NASA, MAST, Gaia, JMDC) separadas del procesado.
//  - Con HOSHI_RED=descargar, cada consulta se hace y su respuesta se guarda tal cual en
//    data/raw/red/<paso>/<huella>.txt, con un índice (indice.json) de URL, fecha y sha256.
//  - Sin esa variable no se usa la red: cada consulta se responde con lo guardado. Si falta,
//    el paso se detiene y pide correr la descarga (npm run descargar:red).
// La huella es el sha1 de la URL y del cuerpo de la consulta, así que una consulta igual
// siempre lee el mismo archivo. Si una consulta falló al descargar se guarda el error, y al
// repetirla sin red falla igual: el procesado omite lo mismo que omitió al descargar.

import fs from 'node:fs';
import crypto from 'node:crypto';

export const DESCARGAR = process.env.HOSHI_RED === 'descargar';
const RAIZ = './data/raw/red';

const huella = (url, cuerpo) => crypto.createHash('sha1').update(`${url}\n${cuerpo}`).digest('hex');
const sha256 = texto => crypto.createHash('sha256').update(texto).digest('hex');

function leerIndice(paso) {
  const ruta = `${RAIZ}/${paso}/indice.json`;
  return fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : {};
}

// Primera fecha de descarga del paso (ISO), para los campos «descargado» de las salidas.
export function fechaDescarga(paso) {
  const fechas = Object.values(leerIndice(paso)).map(e => e.fecha).sort();
  return fechas[0] || null;
}

// Vacía lo guardado de un paso antes de una descarga nueva.
export function empezarDescarga(paso) {
  if (!DESCARGAR) return;
  fs.rmSync(`${RAIZ}/${paso}`, { recursive: true, force: true });
  fs.mkdirSync(`${RAIZ}/${paso}`, { recursive: true });
}

// pedir(paso, url, { method, body, signal, aceptar }) → texto de la respuesta.
// `aceptar(texto, respuesta)` decide si la respuesta es válida (por omisión, respuesta.ok).
export async function pedir(paso, url, opciones = {}) {
  const { aceptar, ...fetchOpciones } = opciones;
  const cuerpo = fetchOpciones.body === undefined ? '' : String(fetchOpciones.body);
  const clave = huella(url, cuerpo);
  const archivo = `${RAIZ}/${paso}/${clave}.txt`;
  if (DESCARGAR) {
    let texto, error = null;
    try {
      const r = await fetch(url, fetchOpciones);
      texto = await r.text();
      if (!(aceptar ? aceptar(texto, r) : r.ok)) error = `respuesta no válida (HTTP ${r.status}): ${texto.slice(0, 200)}`;
    } catch (e) {
      error = e.message;
    }
    const indice = leerIndice(paso);
    const guardado = error === null ? texto : `ERROR\n${error}`;
    fs.writeFileSync(archivo, guardado);
    indice[clave] = { url, cuerpo: cuerpo.length > 300 ? `${cuerpo.slice(0, 300)}…` : cuerpo, fecha: new Date().toISOString(),
      bytes: Buffer.byteLength(guardado), sha256: sha256(guardado), ...(error === null ? {} : { error }) };
    fs.writeFileSync(`${RAIZ}/${paso}/indice.json`, JSON.stringify(indice, null, 1));
    if (error !== null) throw new Error(error);
    return texto;
  }
  if (!fs.existsSync(archivo)) throw new Error(`Falta la descarga de ${paso} (${url}); corre: npm run descargar:red`);
  const texto = fs.readFileSync(archivo, 'utf8');
  if (texto.startsWith('ERROR\n')) throw new Error(texto.slice(6));
  return texto;
}
