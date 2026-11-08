import { Dato } from './FichaLateral';
import { EPHEMERIS_DATE } from './scene/solarEphemeris';
import { orbitalPeriodDays, semiMajorAxisKm } from './scene/moonEphemeris';
import { HORIZONS_SOURCE, MOON_ELEMENTS_SOURCE, MOON_PHYSICAL_SOURCE } from './scene/moonBodies';
import { RING_FACTS_SOURCE, RING_REGIONS } from './scene/ringParticles';
import { PLANET_TEXTURE_LICENSE, PLANET_TEXTURE_SOURCE, PLANET_TEXTURES } from './scene/planetTextures';
import { lightDaysText } from './scene/probeTrajectories';
import textos from '../data/processed/textos_fichas.json';

const numero = (valor, digitos = 3) => valor.toLocaleString('es-CL', { maximumSignificantDigits: digitos });
const km = valor => `${valor.toLocaleString('es-CL', { maximumFractionDigits: 0 })} km`;
const periodo = dias => dias < 2 ? `${numero(dias * 24)} horas` : dias < 400 ? `${numero(dias)} días` : `${numero(dias / 365.25)} años`;
const distancia = valor => valor >= 1e6 ? `${numero(valor / 1e6)} millones de km` : `${numero(valor / 1000)} mil km`;
const enlace = (href, texto) => <a href={href} target="_blank" rel="noreferrer">{texto}</a>;
const fecha = EPHEMERIS_DATE.toLocaleDateString('es-CL');

// Tipo de cada cuerpo del sistema solar, para la línea bajo el nombre.
const TIPOS = { Sol: 'Estrella · G2 V', Mercurio: 'Planeta rocoso', Venus: 'Planeta rocoso', Tierra: 'Planeta rocoso', Marte: 'Planeta rocoso',
  'Júpiter': 'Planeta gigante gaseoso', Saturno: 'Planeta gigante gaseoso', Urano: 'Gigante de hielo', Neptuno: 'Gigante de hielo', Luna: 'Satélite de la Tierra' };
const tipoDe = cuerpo => cuerpo.kind === 'satellite' ? `Luna de ${cuerpo.planet}` : cuerpo.kind === 'probe' ? 'Sonda espacial'
  : cuerpo.kind === 'flyby' ? 'Planeta en el paso de la sonda' : cuerpo.kind === 'hito' ? 'Etapa del viaje de la sonda'
  : cuerpo.kind === 'system' ? 'Sistema binario · WC7 + O5.5' : TIPOS[cuerpo.name];

// Datos de una luna de Júpiter o Saturno. El diámetro solo si es medido (D-014).
function DatosLuna({ cuerpo }) {
  const { moon } = cuerpo;
  const retrograda = moon.sets ? moon.sets[0][2] > 90 : moon.i > 90 && moon.frame === 'ecliptic';
  const medido = moon.size === 'published' || moon.size === 'jpl';
  return <>
    <Dato etiqueta="Planeta" valor={moon.planet} />
    <Dato etiqueta="Distancia media" valor={distancia(semiMajorAxisKm(moon, EPHEMERIS_DATE))} secundario={`Posición del ${fecha}`} />
    <Dato etiqueta="Una vuelta" valor={periodo(orbitalPeriodDays(moon, EPHEMERIS_DATE))} />
    {retrograda && <Dato etiqueta="Órbita" valor="Retrógrada" secundario="Gira al revés que el planeta" />}
    {medido && <Dato etiqueta="Diámetro" valor={km(cuerpo.radiusKm * 2)} />}
  </>;
}

function Anillos() {
  return <section>
    <h3>Anillos · distancia al centro de Saturno</h3>
    <dl>
      {RING_REGIONS.filter(region => region.id !== 'D').map(region => <Dato key={region.id} etiqueta={region.name}
        valor={`${numero(region.inner / 1000, 4)}–${numero(region.outer / 1000, 4)} mil km`} />)}
    </dl>
  </section>;
}

// Ficha del Sol, un planeta, la Luna, una luna, una sonda o el sistema WR 140, en la columna lateral.
// `sistema`: datos del modelo de WR 140 (App.jsx).
export default function FichaCuerpo({ cuerpo, sistema }) {
  const tipo = tipoDe(cuerpo);
  const relato = textos.sistemaSolar[cuerpo.name];
  const textura = PLANET_TEXTURES[cuerpo.name];
  const esPlaneta = cuerpo.au !== undefined;
  return <>
    <h2 className="marca-hoshi" style={cuerpo.color ? { color: cuerpo.color } : undefined}>{cuerpo.name}</h2>
    {tipo && <p className="ficha-estrella-tipo">{tipo}</p>}
    {relato && <p className="ficha-estrella-relato">{relato}</p>}
    <dl>
      {cuerpo.kind === 'system' && sistema ? <>
        <Dato etiqueta="Separación entre estrellas" valor={`${numero(sistema.separacionAu)} UA`} secundario={`Modelo del ${sistema.fecha}`} />
        <Dato etiqueta="Rango orbital" valor={`${numero(sistema.periastroAu)}–${numero(sistema.apoastroAu)} UA`} />
        <Dato etiqueta="Distancia al Sol" valor={`${numero(sistema.anosLuz)} años luz`} />
      </> : cuerpo.kind === 'satellite' ? <DatosLuna cuerpo={cuerpo} />
        : cuerpo.kind === 'probe' ? <>
          {cuerpo.launch && <Dato etiqueta="Lanzamiento" valor={cuerpo.launch} />}
          {cuerpo.distanceAu > 0 && <Dato etiqueta="Distancia al Sol" valor={`${numero(cuerpo.distanceAu)} UA`} secundario={`El ${fecha}`} />}
          {cuerpo.earthAu > 0 && <Dato etiqueta="Su señal tarda" valor={lightDaysText(cuerpo.earthAu)} secundario="En llegar a la Tierra" />}
          {cuerpo.contactLost && <Dato etiqueta="Último contacto" valor={cuerpo.contactLost} />}
        </>
        : <>
          {cuerpo.radiusKm > 0.01 && <Dato etiqueta={cuerpo.name === 'Sol' ? 'Radio' : 'Radio medio'} valor={km(cuerpo.radiusKm)} />}
          {cuerpo.name === 'Sol' && <Dato etiqueta="Temperatura de la superficie" valor="5.772 K" secundario="5.499 °C" />}
          {esPlaneta && <Dato etiqueta="Distancia media al Sol" valor={`${numero(cuerpo.au)} UA`} />}
          {cuerpo.inclinationDeg !== undefined && <Dato etiqueta="Inclinación orbital" valor={`${numero(cuerpo.inclinationDeg, 3)}°`} secundario="Respecto de la eclíptica" />}
          {cuerpo.eccentricity !== undefined && <Dato etiqueta="Excentricidad" valor={numero(cuerpo.eccentricity, 3)} secundario={`Órbita del ${fecha}`} />}
          {cuerpo.name === 'Luna' && cuerpo.distanceKm > 0 && <Dato etiqueta="Distancia a la Tierra" valor={km(Math.round(cuerpo.distanceKm / 100) * 100)} secundario={`El ${fecha}`} />}
        </>}
    </dl>
    {cuerpo.name === 'Saturno' && <Anillos />}
    <p className="ficha-estrella-fuente">
      {cuerpo.kind === 'system' ? <>Datos: {enlace('https://doi.org/10.1093/mnras/stab1181', 'Thomas et al. (2021)')}</>
        : cuerpo.kind === 'satellite' ? <>Datos: {enlace(MOON_ELEMENTS_SOURCE, 'elementos medios')} · {enlace(HORIZONS_SOURCE, 'Horizons')} · {enlace(MOON_PHYSICAL_SOURCE, 'parámetros físicos')} (JPL)</>
        : cuerpo.kind === 'probe' || cuerpo.kind === 'hito' ? <>Datos: {enlace(HORIZONS_SOURCE, 'JPL Horizons')}</>
        : <>Datos: {cuerpo.source ? enlace(cuerpo.source, `NASA${cuerpo.name !== 'Sol' ? ' / JPL' : ''}`) : 'NASA / JPL'}
          {cuerpo.orbitSource && <> · {enlace(cuerpo.orbitSource, 'órbita')}</>}
          {cuerpo.name === 'Saturno' && <> · {enlace(RING_FACTS_SOURCE, 'anillos')}</>}</>}
      {textura && <><br />Textura: {enlace(PLANET_TEXTURE_SOURCE, 'Solar System Scope / INOVE')} · {enlace(PLANET_TEXTURE_LICENSE, 'CC BY 4.0')}</>}
    </p>
  </>;
}
