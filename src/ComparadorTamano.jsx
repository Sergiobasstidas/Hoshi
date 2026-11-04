import { useState } from 'react';
import { cambiarFiltroEstelar } from './scene/filtroEstelar';
import { SOL, destacadas, elegirComparacion, numeroRadio, useComparacionSol } from './scene/comparacionSol';
import { temperatureColor } from './scene/stellarPhysics';
import './comparadorTamano.css';

const colorDe = temperatura => `rgb(${temperatureColor(temperatura).map(valor => Math.round(valor * 255)).join(', ')})`;
const sinTildes = texto => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Pestaña del panel del Sol: elegir una estrella con radio publicado para ponerla en su lugar.
export default function ComparadorTamano() {
  const { candidatas, elegida } = useComparacionSol();
  const [busqueda, setBusqueda] = useState('');
  const texto = sinTildes(busqueda.trim());
  const lista = texto ? candidatas.filter(estrella => sinTildes(`${estrella.nombre} ${estrella.catalogo}`).includes(texto)).slice(0, 30)
    : [SOL, ...destacadas(candidatas)];
  const actual = elegida || SOL;
  const elegir = estrella => {
    if (estrella.id !== 'sol') cambiarFiltroEstelar('visible');
    elegirComparacion(estrella);
  };
  return <div className="comparador">
    <h3>Estrella en lugar del Sol</h3>
    <input className="comparador-buscar" type="search" placeholder="Buscar estrella…" value={busqueda} onChange={event => setBusqueda(event.target.value)} aria-label="Buscar estrella para comparar" />
    <div className="comparador-lista" role="radiogroup" aria-label="Estrella en lugar del Sol">
      {lista.map(estrella => <button key={estrella.id} role="radio" aria-checked={estrella.id === actual.id} className={estrella.id === actual.id ? 'actual' : ''} onClick={() => elegir(estrella)}>
        <i style={{ background: colorDe(estrella.temperatureK) }} aria-hidden="true" /><span>{estrella.nombre}</span><small>{numeroRadio(estrella.radiusSolar)} R☉</small>
      </button>)}
      {texto && lista.length === 0 && <p className="comparador-vacio">Sin estrellas con radio publicado con ese nombre.</p>}
    </div>
  </div>;
}

