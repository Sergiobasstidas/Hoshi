import { CanvasTexture, LinearMipmapLinearFilter, NoColorSpace, SRGBColorSpace, TextureLoader } from 'three';
import { PROPIAS, TEXTURAS_EYES, pintarMapa, idEyes, recetaEyes, tipoPorRegla } from './recetaEyes.js';
import { cargarTablaEyes, parDe } from './tablaEyes.js';

// Mapas de los exoplanetas como en Eyes on Exoplanets (recetaEyes.js). Nada de esto entra en la carga inicial: la
// tabla de tipos (public/data/exoplanetas-eyes.json) y los mapas se piden la primera vez que un planeta se ve grande.
// Cada planeta pide sus mapas con pedirMapas y los suelta con soltarMapas; cuando nadie los usa se liberan, y con
// ellos los píxeles de los mapas base y de detalle que se guardaron para componer.

const cargador = new TextureLoader();
const cargarTextura = (archivo, color) => new Promise((resolve, reject) => cargador.load(TEXTURAS_EYES + archivo, textura => {
  textura.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  textura.minFilter = LinearMipmapLinearFilter;
  textura.anisotropy = 4;
  resolve(textura);
}, undefined, reject));

// Píxeles de cada mapa base y de detalle, compartidos entre planetas mientras alguno tenga mapa.
const pixeles = new Map();
function pixelesDe(archivo, ancho, alto) {
  if (!pixeles.has(archivo)) pixeles.set(archivo, new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => {
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho; lienzo.height = alto;
      const ctx = lienzo.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(imagen, 0, 0, ancho, alto);
      resolve(ctx.getImageData(0, 0, ancho, alto).data);
    };
    imagen.onerror = reject;
    imagen.src = TEXTURAS_EYES + archivo;
  }));
  return pixeles.get(archivo);
}

const ANCHO = 1024, ALTO = 512;
async function crearMapas(planeta) {
  const id = idEyes(planeta.n), propia = PROPIAS[id];
  if (propia) {
    const [mapa, especular] = await Promise.all([cargarTextura(propia.color, true), propia.especular ? cargarTextura(propia.especular, false) : null]);
    return { mapa, especular, normal: null, escalaNormal: null, sincronica: propia.sincronica || null };
  }
  const tipo = parDe(await cargarTablaEyes(), planeta.n)?.[0] || tipoPorRegla(planeta);
  const receta = recetaEyes(id, tipo);
  const archivos = [...receta.bases, ...receta.detalles.map(d => d.archivo)];
  const [imagenes, normal] = await Promise.all([
    Promise.all(archivos.map(f => pixelesDe(f, ANCHO, ALTO))).then(datos => Object.fromEntries(archivos.map((f, k) => [f, datos[k]]))),
    receta.normal ? cargarTextura(receta.normal, false) : null]);
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO; lienzo.height = ALTO;
  lienzo.getContext('2d').putImageData(new ImageData(pintarMapa(receta, imagenes, ANCHO, ALTO), ANCHO, ALTO), 0, 0);
  const mapa = new CanvasTexture(lienzo);
  mapa.colorSpace = SRGBColorSpace;
  mapa.minFilter = LinearMipmapLinearFilter;
  mapa.anisotropy = 4;
  return { mapa, especular: null, normal, escalaNormal: receta.escalaNormal, sincronica: null };
}

const enUso = new Map();
// Promesa con los mapas del planeta ({ mapa, normal, escalaNormal, especular, sincronica }).
export function pedirMapas(planeta) {
  let entrada = enUso.get(planeta.n);
  if (!entrada) { entrada = { cuenta: 0, mapas: crearMapas(planeta) }; enUso.set(planeta.n, entrada); }
  entrada.cuenta++;
  return entrada.mapas;
}
export function soltarMapas(planeta) {
  const entrada = enUso.get(planeta.n);
  if (!entrada || --entrada.cuenta > 0) return;
  enUso.delete(planeta.n);
  entrada.mapas.then(m => [m.mapa, m.normal, m.especular].forEach(t => t?.dispose())).catch(() => {});
  if (enUso.size === 0) pixeles.clear();
}
