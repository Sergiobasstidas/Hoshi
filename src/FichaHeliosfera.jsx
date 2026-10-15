import { useState } from 'react';
import { HELIOSPHERE_NORTH_LOBE_AU, HELIOSPHERE_NOSE_AU, HELIOSPHERE_SOUTH_LOBE_AU, HELIOSPHERE_TAIL_AU, INTERSTELLAR_FLOW, VOYAGER_CROSSINGS } from './scene/heliosphereShape';

const es = (value, digits = 1) => value.toLocaleString('es-CL', { maximumFractionDigits: digits });
const enlace = (href, texto) => <a href={href} target="_blank" rel="noreferrer">{texto}</a>;

// Ficha de la heliosfera: separa lo medido de lo que procede de un modelo y
// deja a la vista el debate sobre la forma.
export default function FichaHeliosfera() {
  const [abierta, setAbierta] = useState(true);
  if (!abierta) return null;
  return <aside className="pulsar-legend ficha-heliosfera" aria-label="Información de la heliosfera">
    <button className="panel-close" aria-label="Cerrar información" onClick={() => setAbierta(false)}>×</button>
    <strong>Heliosfera · modelo «croissant»</strong>
    <span>Superficie dibujada: heliopausa, el límite entre el viento solar y el medio interestelar.</span>
    <span className="ficha-titulo">Medido</span>
    {VOYAGER_CROSSINGS.map(cruce => <span key={cruce.probe}>{cruce.probe}: choque de terminación a {es(cruce.shockAu)} UA ({cruce.shockYear}) · heliopausa a {es(cruce.au)} UA ({cruce.date})</span>)}
    <span>Viento interestelar (IBEX): llega desde λ {es(INTERSTELLAR_FLOW.longitudeDeg)}°, β +{es(INTERSTELLAR_FLOW.latitudeDeg, 2)}° (eclíptica J2000) a {es(INTERSTELLAR_FLOW.speedKmS)} km/s. La orientación de la figura usa esa dirección.</span>
    <span>La superficie pasa por los dos puntos de cruce. Son las únicas distancias a la heliopausa medidas en el lugar.</span>
    <span className="ficha-titulo">De modelo</span>
    <span>Todo lo demás. El contorno está digitalizado de dos cortes publicados (meridional y ecuatorial) de la simulación del «croissant» de Opher, en Kornbleuth et al. 2021. Entre los dos cortes la forma está interpolada, y el relieve de los chorros es ilustrativo.</span>
    <details><summary>La forma está en debate · fuentes</summary>
      <p>Cifras de esta figura: nariz ≈{es(HELIOSPHERE_NOSE_AU, 0)} UA, hueco entre lóbulos ≈{es(HELIOSPHERE_TAIL_AU, 0)} UA, lóbulo norte ≈{es(HELIOSPHERE_NORTH_LOBE_AU, 0)} UA, lóbulo sur ≈{es(HELIOSPHERE_SOUTH_LOBE_AU, 0)} UA. Es una instantánea de una simulación que cambia con el tiempo; el contorno se reescaló un poco para pasar por los cruces medidos.</p>
      <p><b>Croissant</b> (Opher): el campo magnético solar reúne el viento en dos chorros; sin cola larga.</p>
      <p><b>Burbuja</b> (Dialynas et al. 2017, Cassini/INCA y Voyager): casi esférica, la cola responde al ciclo solar igual que la nariz.</p>
      <p><b>Cometa</b> (modelo clásico; grupos de Moscú y Huntsville): cola de miles de UA.</p>
      <p>El mapa 3D de IBEX (Reisenfeld et al. 2021) da ≈110–120 UA hacia la nariz, 160–180 UA en latitudes altas y una cola de al menos 350 UA, el límite de su método. Ninguna sonda ha medido la cola.</p>
      <p>{enlace('https://doi.org/10.1088/2041-8205/800/2/L28', 'Opher 2015')} · {enlace('https://doi.org/10.1038/s41550-020-1036-0', 'Opher 2020')} · {enlace('https://doi.org/10.1038/s41550-017-0115', 'Dialynas 2017')} · {enlace('https://doi.org/10.3847/1538-4357/ac2fa6', 'Kornbleuth 2021')} · {enlace('https://doi.org/10.3847/1538-4365/abf658', 'Reisenfeld 2021')} · {enlace('https://doi.org/10.1088/0067-0049/220/2/28', 'Bzowski 2015')} · {enlace('https://ssd.jpl.nasa.gov/horizons/', 'JPL Horizons')}</p>
    </details>
  </aside>;
}
