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
export const SDO_CHANNELS = {
  '0171': { halfField: AIA_HALF_FIELD_ARCSEC },
  '0193': { halfField: AIA_HALF_FIELD_ARCSEC },
  '0304': { halfField: AIA_HALF_FIELD_ARCSEC },
  HMIB: { halfField: HMI_HALF_FIELD_ARCSEC },
  HMII: { halfField: HMI_HALF_FIELD_ARCSEC },
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
    metadata = { status: 'loading', channels: {} };
    fetch(`${BASE}sdo.json`).then(response => response.ok ? response.json() : Promise.reject(response.status))
      .then(data => { metadata = { status: 'ready', channels: data.canales }; })
      .catch(() => { metadata = { status: 'error', channels: {} }; });
  }
  return metadata;
}

// Textura del canal, cargada al pedirla por primera vez. `ready` indica que ya llegó.
export function sdoTexture(channel) {
  if (!textures[channel]) {
    const entry = { texture: null, ready: false };
    entry.texture = new THREE.TextureLoader().load(`${BASE}${channel}.jpg`, () => { entry.ready = true; });
    entry.texture.colorSpace = THREE.SRGBColorSpace;
    entry.texture.anisotropy = 4;
    textures[channel] = entry;
  }
  return textures[channel];
}

// Fecha de la imagen en hora de Chile, para la etiqueta «vista desde la Tierra».
export function sdoDateLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }) + ' UTC';
}
