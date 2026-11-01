import { FILTROS_ESTELARES, cambiarFiltroEstelar, useFiltroEstelar } from './scene/filtroEstelar';
import './filtrosSol.css';

// Filtros del Sol a la vista mientras es el foco: un clic elige el filtro.
export default function FiltrosSol() {
  const actual = useFiltroEstelar();
  return <div className="filtros-sol" role="radiogroup" aria-label="Filtro del Sol">
    {FILTROS_ESTELARES.map(filtro => <button key={filtro.id} role="radio" aria-checked={filtro.id === actual} title={filtro.nombre}
      className={filtro.id === actual ? 'encendido' : ''} onClick={() => cambiarFiltroEstelar(filtro.id)}>
      {filtro.id === actual && <span aria-hidden="true" />}{filtro.corto}
    </button>)}
  </div>;
}
