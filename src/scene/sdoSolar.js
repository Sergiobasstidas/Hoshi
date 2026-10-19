import * as THREE from 'three';
import { planetPosition } from './solarEphemeris.js';
import { AU_TO_PC } from './scale.js';

// Imágenes recientes del Solar Dynamics Observatory, descargadas con
// scripts/sdo/descargar_sdo.mjs a public/textures/sdo (fecha de cada una en sdo.json).
// El SDO orbita la Tierra: solo ve la cara del Sol que mira hacia ella. La imagen se
// proyecta sobre ese hemisferio, con el norte solar arriba como la publica el SDO.
export const SDO_CREDIT = 'Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams';
export const SDO_SOURCE = 'https://sdo.gsfc.nasa.gov/data/';
const BASE = '/textures/sdo/';

// Semiancho del campo de cada imagen en segundos de arco: AIA, 4096 píxeles de 0,6″;
// HMI, 4096 de 0,504″. Medido en las imágenes del 19/10/2026: el disco de HMI ocupa
// 0,933 del semiancho (0,934 calculado) y el de 304 Å, 0,798 (0,784 más la cromosfera).
const AIA_HALF_FIELD_ARCSEC = 2048 * 0.6;
const HMI_HALF_FIELD_ARCSEC = 2048 * 0.504;
// `tint`: color medio de la corona justo fuera del disco en cada imagen (sRGB, máximo 1),
// medido el 19/10/2026; tiñe el resplandor que rodea al disco. `flat`: imagen aplanada, sin
// oscurecimiento del borde, que el sombreador repone según el ángulo de la cámara.
// `compose`: canales cuyo brillo forma el rojo, el verde y el azul. `video`: últimas 48 h.
export const SDO_CHANNELS = {
  '0131': { halfField: AIA_HALF_FIELD_ARCSEC, tint: [0.02, 1, 1], video: '0131.mp4' },
  '0171': { halfField: AIA_HALF_FIELD_ARCSEC, tint: [1, 0.7, 0.01] },
  '0193': { halfField: AIA_HALF_FIELD_ARCSEC, tint: [1, 0.63, 0.26] },
  '0211': { halfField: AIA_HALF_FIELD_ARCSEC, tint: [1, 0.59, 0.74] },
  '0304': { halfField: AIA_HALF_FIELD_ARCSEC, tint: [1, 0.05, 0.03] },
  '211193171': { halfField: AIA_HALF_FIELD_ARCSEC, tint: [0.95, 1, 0.48] },
  // El SDO publica esta composición solo en vídeo; la imagen fija se arma aquí.
  '304211171': { halfField: AIA_HALF_FIELD_ARCSEC, tint: [0.35, 1, 0.6], compose: ['0304', '0211', '0171'], gains: [1.15, 0.85, 1.35] },
  HMIB: { halfField: HMI_HALF_FIELD_ARCSEC },
  HMIIF: { halfField: HMI_HALF_FIELD_ARCSEC, flat: true },
};

const RAD = Math.PI / 180;
const SOLAR_RADIUS_KM = 695700;
const AU_KM = 149597870.7;
// Polo norte de rotación del Sol (IAU WGCCRE 2015): AR 286,13°, Dec 63,87°.
const SOLAR_POLE = new THREE.Vector3(
  Math.cos(63.87 * RAD) * Math.cos(286.13 * RAD),
  Math.cos(63.87 * RAD) * Math.sin(286.13 * RAD),
  Math.sin(63.87 * RAD));

// Ejes de la imagen en el marco ecuatorial J2000: hacia la Tierra, norte solar proyectado
// (arriba) y oeste solar (derecha), y radio del disco en fracción del semiancho.
export function sdoImageFrame(date, channel) {
  const toward = new THREE.Vector3(...planetPosition('Tierra', date)).normalize();
  const up = SOLAR_POLE.clone().addScaledVector(toward, -SOLAR_POLE.dot(toward)).normalize();
  // Mirando al Sol desde la Tierra (dirección −toward), la derecha es up × toward: el oeste.
  const right = up.clone().cross(toward);
  return { toward, up, right, diskRadius: angularRadiusArcsec(date) / SDO_CHANNELS[channel].halfField };
}

// Radio angular del Sol visto desde la Tierra en la fecha, en segundos de arco.
export function angularRadiusArcsec(date) {
  const [x, y, z] = planetPosition('Tierra', date);
  const distanceKm = Math.hypot(x, y, z) / AU_TO_PC * AU_KM;
  return Math.asin(SOLAR_RADIUS_KM / distanceKm) / RAD * 3600;
}

let metadata = null;
const textures = {};
// Fecha y textura de cada canal; la primera llamada inicia la descarga desde public/.
export function sdoState() {
  if (!metadata) {
    metadata = { status: 'loading', channels: {}, video: null };
    fetch(`${BASE}sdo.json`).then(response => response.ok ? response.json() : Promise.reject(response.status))
      .then(data => { metadata = { status: 'ready', channels: data.canales, video: data.video || null }; })
      .catch(() => { metadata = { status: 'error', channels: {} }; });
  }
  return metadata;
}

const loadImage = channel => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = `${BASE}${channel}.jpg`;
});
// Composición en tres colores: el brillo de cada canal, con su ganancia, en rojo, verde y azul.
async function composeChannels(channels, gains) {
  const images = await Promise.all(channels.map(loadImage));
  const { width, height } = images[0];
  const canvas = document.createElement('canvas');
  Object.assign(canvas, { width, height });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const layers = images.map(image => {
    context.drawImage(image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  });
  const output = context.createImageData(width, height);
  for (let i = 0; i < output.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const layer = layers[c];
      output.data[i + c] = Math.min(255, gains[c] * (0.299 * layer[i] + 0.587 * layer[i + 1] + 0.114 * layer[i + 2]));
    }
    output.data[i + 3] = 255;
  }
  context.putImageData(output, 0, 0);
  return canvas;
}

// Textura del canal, cargada al pedirla por primera vez. `ready` indica que ya llegó. El
// vídeo empieza con la imagen fija del mismo canal y la reemplaza en cuanto se reproduce.
export function sdoTexture(channel) {
  if (textures[channel]) return textures[channel];
  const { compose, gains, video } = SDO_CHANNELS[channel];
  const entry = { texture: null, ready: false, element: null };
  const configure = texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture; };
  if (compose) {
    entry.texture = configure(new THREE.Texture());
    composeChannels(compose, gains).then(canvas => {
      entry.texture.image = canvas;
      entry.texture.needsUpdate = true;
      entry.ready = true;
    }).catch(() => {});
  } else {
    entry.texture = configure(new THREE.TextureLoader().load(`${BASE}${channel}.jpg`, () => { entry.ready = true; }));
  }
  if (video) {
    const element = document.createElement('video');
    Object.assign(element, { src: `${BASE}${video}`, loop: true, muted: true, playsInline: true, preload: 'auto' });
    element.addEventListener('playing', () => {
      entry.texture = configure(new THREE.VideoTexture(element));
      entry.texture.generateMipmaps = false;
      entry.texture.minFilter = THREE.LinearFilter;
      entry.ready = true;
      entry.playing = true;
    }, { once: true });
    entry.element = element;
  }
  textures[channel] = entry;
  return entry;
}

// El vídeo solo avanza mientras su filtro está activo.
export function playSdoVideo(channel, active) {
  Object.entries(textures).forEach(([id, entry]) => {
    const element = entry.element;
    if (!element) return;
    if (active && id === channel) { if (element.paused) element.play().catch(() => {}); }
    else if (!element.paused) element.pause();
  });
}

// Fecha de la imagen de un canal; la composición armada aquí toma la de su primer canal y el
// vídeo, la de su último fotograma.
export function sdoChannelDate(channel) {
  const { channels, video } = sdoState();
  if (SDO_CHANNELS[channel]?.video && textures[channel]?.playing && video) return video.fecha;
  return channels[SDO_CHANNELS[channel]?.compose?.[0] || channel]?.fecha;
}

// Fecha de la imagen en hora de Chile, para la etiqueta «vista desde la Tierra».
export function sdoDateLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }) + ' UTC';
}
