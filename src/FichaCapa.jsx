import { Dato } from './FichaLateral';
import { LIGHT_YEAR_PC } from './scene/scale';

const numero = (valor, digitos = 3) => valor.toLocaleString('es-CL', { maximumSignificantDigits: digitos });
const decimales = (valor, d) => valor.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

// Ficha de una estrella de la capa de fondo: solo lo que mide Gaia DR3 (D-014: distancia = 1/paralaje, color BP−RP
// sin convertir a B−V ni modelos).
export default function FichaCapa({ nombre, datos, irA }) {
  const otros = datos.nombres.filter(n => n !== nombre);
  const pc = datos.paralaje > 0 ? 1000 / datos.paralaje : null;
  const anosLuz = pc && pc / LIGHT_YEAR_PC;
  return <>
    {/* Un número de Gaia DR3 como nombre es largo: va más chico, para que no se corte en una cifra suelta. */}
    <h2 className="marca-hoshi" style={nombre.length > 18 ? { fontSize: '1.5rem' } : undefined}>{nombre}</h2>
    {irA && <button className="ficha-ir-a" onClick={irA.onIr}>{irA.texto}</button>}
    <p className="ficha-estrella-tipo">Estrella de fondo</p>
    <dl>
      {anosLuz && <Dato etiqueta="Distancia al Sol" valor={`${numero(anosLuz, anosLuz < 100 ? 3 : 2)} años luz`}
        secundario={`Paralaje ${decimales(datos.paralaje, 4)} ± ${decimales(datos.paralajeError, 4)} mas`} />}
      {Number.isFinite(datos.g) && <Dato etiqueta="Magnitud G aparente" valor={decimales(datos.g, 3)} />}
      {Number.isFinite(datos.bpRp) && <Dato etiqueta="Color BP−RP" valor={decimales(datos.bpRp, 3)} />}
      {otros.length > 0 && <Dato etiqueta="Otros nombres" valor={otros.join(' · ')} />}
      <Dato etiqueta="Catálogos" valor={[datos.gaia && `Gaia DR3 ${datos.gaia}`, `HSB ${datos.hsb}`].filter(n => n && n !== nombre).join(' · ')} />
    </dl>
    <p className="ficha-estrella-fuente">{datos.nombres.length ? 'Datos: Gaia DR3 · nombres: SIMBAD y Tycho-2' : 'Datos: Gaia DR3'}</p>
  </>;
}
