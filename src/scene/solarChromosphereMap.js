import * as THREE from 'three';

// Mapa real de todo el Sol en 304 Å (NASA/Goddard SVS, STEREO + SDO, 2011): una imagen
// fija en alta resolución y un vídeo de 81 días. Atribución en public/textures/nasa-svs-3851.
const STILL = '/textures/nasa-svs-3851/sol-304-2011.jpg';
const VIDEO = '/textures/nasa-svs-3851/sol-304-2011-lento.mp4';
// El archivo ya va ocho veces más lento que el original; se reproduce a la mitad.
const PLAYBACK_RATE = 0.5;

let maps = null;
const configure = texture => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  // Sin mipmaps: evitan una costura en el meridiano donde la longitud da la vuelta.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};

// Una sola copia compartida por todas las estrellas que la muestran.
export function solarChromosphereMap() {
  if (maps) return maps;
  maps = { still: configure(new THREE.TextureLoader().load(STILL, () => { maps.stillReady = true; })),
    video: null, stillReady: false, videoReady: false };
  const element = document.createElement('video');
  Object.assign(element, { src: VIDEO, loop: true, muted: true, playsInline: true, preload: 'auto' });
  element.playbackRate = PLAYBACK_RATE;
  element.addEventListener('playing', () => { maps.videoReady = true; }, { once: true });
  maps.video = configure(new THREE.VideoTexture(element));
  maps.element = element;
  return maps;
}

// El vídeo solo avanza mientras alguna estrella lo muestra.
export function playSolarChromosphere(active) {
  const element = maps?.element;
  if (!element) return;
  if (active && element.paused) { element.playbackRate = PLAYBACK_RATE; element.play().catch(() => {}); }
  else if (!active && !element.paused) element.pause();
}
