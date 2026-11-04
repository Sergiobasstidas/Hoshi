import { Dato } from './FichaLateral';
import { LIGHT_YEAR_PC } from './scene/scale';
import { CONSTELACIONES } from './constelaciones';
import textos from '../data/processed/textos_fichas.json';
import './cumulos.css';

const numero = (valor, decimales = 1) => valor.toLocaleString('es-CL', { maximumFractionDigits: decimales });

// Ficha de un cúmulo: solo valores publicados en el Unified Cluster Catalogue y cuántos de sus miembros tiene Hoshi.
export default function FichaCumulo({ cumulo, estrellaDe, fuente, fuenteBrillantes, onVerEstrella }) {
  const brillantes = cumulo.ids.map(id => estrellaDe.get(id)).filter(star => star?.n).slice(0, 10);
  const edad = cumulo.edadMyr;
  return <div className="ficha-cumulo">
    <h2 className="marca-hoshi">{cumulo.nombre}</h2>
    <p className="ficha-estrella-tipo">Cúmulo abierto{CONSTELACIONES[cumulo.constelacion] ? ` · ${CONSTELACIONES[cumulo.constelacion]}` : ''}</p>
    <p className="ficha-estrella-relato">{textos.cumulos[cumulo.id] || 'Un grupo de estrellas nacidas de la misma nube de gas, que todavía viajan juntas por la galaxia. Se reconocen como familia porque comparten distancia y movimiento en el cielo, medidos por el satélite Gaia.'}</p>
    <dl>
      <Dato etiqueta="Distancia al Sol" valor={`${numero(cumulo.d / LIGHT_YEAR_PC, 0)} años luz`} secundario={`${numero(cumulo.d, 0)} pc · paralaje media ${numero(cumulo.paralaje, 3)} mas`} />
      {cumulo.r50Pc > 0 && <Dato etiqueta="Radio con la mitad de los miembros" valor={`${numero(cumulo.r50Pc / LIGHT_YEAR_PC)} años luz`} secundario={`${numero(cumulo.r50Arcmin)}′ en el cielo`} />}
      {cumulo.miembros > 0 && <Dato etiqueta="Miembros en el catálogo" valor={numero(cumulo.miembros, 0)} secundario="con probabilidad de pertenencia mayor que 50 %" />}
      <Dato etiqueta="Miembros en Hoshi" valor={numero(cumulo.ids.length, 0)} secundario="los más débiles no están en el catálogo de Hoshi" />
      {edad > 0 && <Dato etiqueta="Edad" valor={edad >= 1000 ? `${numero(edad / 1000, 2)} mil millones de años` : `${numero(edad, 0)} millones de años`} />}
      {cumulo.metalicidad !== null && <Dato etiqueta="Metalicidad [Fe/H]" valor={numero(cumulo.metalicidad, 2)} />}
      {cumulo.catalogos?.length > 0 && <Dato etiqueta="Catálogos" valor={cumulo.catalogos.join(' · ')} />}
    </dl>
    {brillantes.length > 0 && <>
      <p className="ficha-estrella-tipo">Los más brillantes con nombre propio</p>
      <ul className="ficha-cumulo-miembros">
        {brillantes.map(star => <li key={star.i}><button className="enlace-ficha" onClick={() => onVerEstrella(star)}>{star.n}</button></li>)}
      </ul>
    </>}
    <p className="ficha-estrella-fuente">Datos: {fuente}. Miembros cruzados con Hoshi por su identificador de Gaia DR3.
      {cumulo.brillantesSimbad && ` Miembros brillantes que Gaia no mide bien: ${fuenteBrillantes} (${[...new Set(Object.values(cumulo.brillantesSimbad))].join(', ')}).`}</p>
  </div>;
}
