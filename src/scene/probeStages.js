import { useSyncExternalStore } from 'react';
import { AU_KM } from './scale.js';

// Etapas de cada sonda para la línea de tiempo (LineaTiempoSonda.jsx): datos de JPL Horizons y
// valores publicados (public/data/probe-stages.json, scripts/probes/build_probe_stages.js), y un
// texto propio por etapa, redactado a partir de las páginas de la NASA y de Wikipedia (enlaces en el
// archivo de créditos del proyecto, fuera del repositorio).
export const GM_SUN = 1.32712440018e11;
export const escapeSpeed = au => Math.sqrt(2 * GM_SUN / (au * AU_KM));

const TEXTOS = {
  '-31:lanzamiento': 'Despegó desde Cabo Cañaveral dieciséis días después que su gemela, en una trayectoria más rápida que la hizo llegar primero a Júpiter.',
  '-31:Júpiter': 'Cruzó el sistema de Júpiter y descubrió volcanes activos en Ío, los primeros vistos fuera de la Tierra, y un anillo tenue alrededor del planeta.',
  '-31:Saturno': 'Se desvió para estudiar de cerca la atmósfera de Titán; ese paso la sacó del plano de los planetas, hacia el norte, y cerró su recorrido planetario.',
  '-31:heliopausa': 'Fue el primer objeto hecho por humanos en salir de la burbuja del viento solar y entrar al espacio interestelar.',
  '-31:hoy': 'Es el objeto hecho por humanos más lejano de la Tierra: su señal tarda cerca de un día en llegar.',
  '-32:lanzamiento': 'Despegó antes que la Voyager 1, en una trayectoria más lenta que le permitió visitar los cuatro planetas gigantes.',
  '-32:Júpiter': 'Completó el estudio de Júpiter que había empezado la Voyager 1, con imágenes más cercanas de Europa y Ganímedes.',
  '-32:Saturno': 'Estudió los anillos y la atmósfera de Saturno; la gravedad del planeta la encaminó hacia Urano.',
  '-32:Urano': 'Es la única nave que ha visitado Urano: descubrió diez lunas y dos anillos que no se conocían.',
  '-32:Neptuno': 'También es la única que ha visitado Neptuno: pasó sobre su polo norte, vio la Gran Mancha Oscura y los géiseres de Tritón, y salió desviada hacia el sur.',
  '-32:heliopausa': 'Cruzó la heliopausa seis años después que su gemela y, con su instrumento de plasma aún en funcionamiento, midió directamente la entrada al medio interestelar.',
  '-32:hoy': 'Se aleja por debajo del plano de los planetas; su señal tarda unas veinte horas en llegar a la Tierra.',
  '-23:lanzamiento': 'Fue la primera nave enviada al sistema solar exterior y la primera en cruzar el cinturón de asteroides.',
  '-23:Júpiter': 'Fue la primera nave en visitar Júpiter: tomó las primeras imágenes cercanas del planeta y midió su intenso cinturón de radiación.',
  '-23:fin del contacto': 'Su última señal llegó en enero de 2003, cuando su fuente de energía ya no alcanzaba para transmitir.',
  '-23:hoy': 'Sigue alejándose en silencio, en dirección a Aldebarán, en la constelación de Tauro.',
  '-24:lanzamiento': 'Gemela de la Pioneer 10, despegó un año después para seguirla hasta Júpiter y continuar hasta Saturno.',
  '-24:Júpiter': 'Pasó a unos 42.000 km sobre las nubes de Júpiter, más cerca que su gemela, y usó su gravedad para cruzar el sistema solar rumbo a Saturno.',
  '-24:Saturno': 'Fue la primera nave en visitar Saturno: descubrió el anillo F y abrió el camino a las Voyager.',
  '-24:fin del contacto': 'La misión terminó en septiembre de 1995, cuando ya no tenía energía para operar sus instrumentos.',
  '-24:hoy': 'Sigue alejándose en silencio, en dirección a la constelación del Águila.',
};
export const stageText = (code, stage) => TEXTOS[`${code}:${stage.planet ?? stage.kind}`] ?? '';

// Día juliano de una etapa (las de solo fecha, a mediodía UTC).
const jdOf = text => Date.parse(text.length === 10 ? `${text}T12:00:00Z` : text) / 86400000 + 2440587.5;
export const stageJd = stage => stage.closestJd ?? jdOf(stage.utc ?? stage.date);

// Eje del tiempo comprimido por tramos: cada tramo entre etapas ocupa un ancho proporcional a la raíz
// de su duración, así los sobrevuelos de 1979–1989 no quedan apretados frente a los treinta años de
// crucero. Devuelve la posición (0–1) de un día juliano y los tramos comprimidos (más de 1,5 veces
// menos espacio por año que el tramo más holgado), que se marcan con un corte.
export function timeAxis(stages) {
  const times = stages.map(stageJd);
  const weights = times.slice(1).map((t, i) => Math.sqrt(Math.max(t - times[i], 30) / 365.25));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const starts = weights.reduce((list, w) => [...list, list.at(-1) + w / total], [0]);
  const at = jd => {
    if (jd <= times[0]) return 0;
    for (let i = 0; i < weights.length; i++) {
      if (jd <= times[i + 1]) return starts[i] + (jd - times[i]) / (times[i + 1] - times[i]) * weights[i] / total;
    }
    return 1;
  };
  const density = weights.map((w, i) => w / total / (times[i + 1] - times[i]));
  const loosest = Math.max(...density);
  const breaks = density.map((d, i) => d < loosest / 1.5 ? (starts[i] + starts[i + 1]) / 2 : null).filter(x => x !== null);
  return { at, positions: times.map(at), breaks };
}

let state = { status: 'idle', probes: [] };
const listeners = new Set();
const emit = next => { state = next; listeners.forEach(listener => listener()); };
function load() {
  if (state.status !== 'idle') return;
  state = { ...state, status: 'loading' };
  fetch('/data/probe-stages.json').then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
    .then(data => emit({ status: 'ready', probes: data.probes }))
    .catch(() => emit({ status: 'error', probes: [] }));
}
const subscribe = listener => { listeners.add(listener); load(); return () => listeners.delete(listener); };
export const useProbeStages = () => useSyncExternalStore(subscribe, () => state, () => state);
