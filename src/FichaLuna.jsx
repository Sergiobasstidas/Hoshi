import { EPHEMERIS_DATE } from './scene/solarEphemeris';
import { orbitalPeriodDays, propagationDays, semiMajorAxisKm } from './scene/moonEphemeris';
import { HORIZONS_SOURCE, MOON_ELEMENTS_SOURCE, MOON_PHYSICAL_SOURCE } from './scene/moonBodies';
import { RING_FACTS_SOURCE, RING_PARTICLES, RING_REGIONS } from './scene/ringParticles';

const number = (value, digits = 3) => value.toLocaleString('es-CL', { maximumSignificantDigits: digits });
const period = days => days < 2 ? `${number(days * 24)} horas` : days < 400 ? `${number(days)} días` : `${number(days / 365.25)} años`;
const distance = km => km >= 1e6 ? `${number(km / 1e6)} millones de km` : `${number(km / 1000)} mil km`;
const link = (href, text) => <a href={href} target="_blank" rel="noreferrer">{text}</a>;

// Ficha de una luna de Júpiter o Saturno: qué es medido, qué es estimado y cómo se calculó la posición.
export function FichaLuna({ body }) {
  const { moon } = body;
  const retrograde = moon.sets ? moon.sets[0][2] > 90 : moon.i > 90 && moon.frame === 'ecliptic';
  const days = propagationDays(moon, EPHEMERIS_DATE);
  return <>
    <div>Luna de {moon.planet}{moon.iau !== body.name ? ` · ${moon.iau}` : ''} · a {distance(semiMajorAxisKm(moon, EPHEMERIS_DATE))} de media · una vuelta cada {period(orbitalPeriodDays(moon, EPHEMERIS_DATE))}{retrograde ? ' · órbita retrógrada' : ''}</div>
    {moon.size !== 'jpl' && <div>{moon.size === 'published' ? 'Diámetro medido publicado (recopilado en Wikipedia: Thomas, Grav et al.).'
      : `Diámetro estimado, no medido: sale de su brillo${moon.H != null ? ` (magnitud absoluta H = ${number(moon.H)})` : ''} suponiendo un albedo bajo; puede errar en un factor de dos.`}</div>}
    <div>Posición del {EPHEMERIS_DATE.toLocaleDateString('es-CL')} · {moon.sets
      ? `elementos osculadores de JPL Horizons propagados ${Math.round(days)} días${days > 31 ? ' (fuera del intervalo calculado: el error crece con el tiempo)' : ''}`
      : moon.anchored ? 'elementos medios de JPL con la fase ajustada a JPL Horizons'
      : 'elementos medios de JPL sin ajustar (Horizons no la calcula después de 2018): posición aproximada'}{moon.errDeg !== undefined ? ` · diferencia con Horizons en la comprobación: ≤ ${number(Math.max(moon.errDeg, 0.01), 2)}°` : ''} · la estela marca el último 90 % de la vuelta</div>
    <div>Datos: {link(MOON_ELEMENTS_SOURCE, 'elementos medios')} · {link(HORIZONS_SOURCE, 'Horizons')} · {link(MOON_PHYSICAL_SOURCE, 'parámetros físicos')} (JPL)</div>
  </>;
}

// Ficha de los anillos: lo medido frente a lo representado.
export function FichaAnillos() {
  return <>
    <div>Anillos · {RING_REGIONS.filter(region => region.id !== 'D').map(region => `${region.id === 'Cassini' ? 'Cassini' : region.id} ${number(region.inner / 1000, 4)}–${number(region.outer / 1000, 4)} mil km`).join(' · ')}</div>
    <div>Dato: radios, huecos (Cassini, Encke, Keeler) y profundidad óptica medida por Cassini UVIS cada 10 km en la ocultación de β Centauri (2008); albedos de la ficha de NASA.</div>
    <div>Representación: {number(RING_PARTICLES / 1000, 3)} mil puntos donde hay unos 10¹⁶–10¹⁸ partículas de centímetros a metros; su cantidad por radio sigue la luz que intercepta el anillo, 1 − e^(−τ). El espesor real, de unos 10 m frente a 280.000 km de diámetro, no llega a un píxel: los puntos están en el plano. El anillo D, casi transparente, lleva puntos de más; tamaño y color de los puntos no son medidas; la cara en sombra es aproximada.</div>
    <div>{link('https://pds-rings.seti.org/holdings/volumes/COUVIS_8xxx/COUVIS_8001/data/UVIS_HSP_2008_231_BETCEN_I_TAU10KM.LBL', 'Perfil: Cassini UVIS (PDS)')} · {link(RING_FACTS_SOURCE, 'Ficha de anillos: NASA')}</div>
  </>;
}
