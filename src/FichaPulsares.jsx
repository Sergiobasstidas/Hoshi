import { Dato } from './FichaLateral';
import { PULSARS } from './scene/pulsarData';

// Ficha del mapa de púlsares de la placa de las Voyager, en la columna lateral (App.jsx).
export default function FichaPulsares({ onEncuadrar }) {
  return <>
    <h2 className="marca-hoshi">Púlsares de las Voyager</h2>
    <p className="ficha-estrella-tipo">Mapa del disco de oro · 1977</p>
    <p className="ficha-estrella-relato">Los 14 púlsares con que el disco de las Voyager señala dónde está el Sol. Las líneas salen del Sol hacia cada uno, con su posición de catálogo y su distancia estimada.</p>
    <button className="ficha-estrella-accion" onClick={onEncuadrar}>Encuadrar mapa</button>
    <section>
      <h3>Los 14 púlsares</h3>
      <dl>
        {PULSARS.map(p => <Dato key={p.id} etiqueta={p.bname} valor={`≈ ${Math.round(p.distancePc * 3.26156).toLocaleString('es-CL')} años luz`} secundario={p.id} />)}
      </dl>
    </section>
    <p className="ficha-estrella-fuente">Las distancias tienen incertidumbre y no son las longitudes del grabado.
      <br />Datos: <a href="https://science.nasa.gov/mission/voyager/golden-record-cover/" target="_blank" rel="noreferrer">NASA: mapa original</a> · <a href="https://www.atnf.csiro.au/research/pulsar/psrcat/" target="_blank" rel="noreferrer">Catálogo ATNF</a></p>
  </>;
}
