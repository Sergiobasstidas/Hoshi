import { useRef, useState } from 'react';
import { AU_TO_PC, LIGHT_YEAR_PC } from './scene/scale.js';
import { barraDesdeDistancia, distanciaDesdeBarra, textoDistancia } from './scene/escalaNavegacion.js';

const MARCAS = [['Tierra',0],['Sistema solar',barraDesdeDistancia(50*AU_TO_PC)],
  ['Oort',barraDesdeDistancia(LIGHT_YEAR_PC)],['Estrellas',barraDesdeDistancia(100*LIGHT_YEAR_PC)],['Galaxia',100]];
export default function BarraDistancia({ onViajar }) {
  const entrada=useRef(null);
  const valor=useRef(null);
  const [vista,setVista]=useState(null);
  const confirmar=()=>{
    if(valor.current===null)return;
    const elegido=valor.current;
    valor.current=null; setVista(null);
    entrada.current.dataset.editando='no';
    onViajar(elegido);
  };
  return <aside className="barra-distancia" aria-label="Distancia de exploración">
    <span className="barra-titulo">ESCALA</span>
    <div className="barra-recorrido">
      <input ref={entrada} data-barra-distancia type="range" min="0" max="100" step="0.1" defaultValue="0"
        aria-label="Distancia desde la Tierra" aria-orientation="vertical"
        onChange={evento=>{valor.current=Number(evento.target.value); evento.target.dataset.editando='si'; setVista(valor.current);}}
        onPointerUp={confirmar} onKeyUp={confirmar} onBlur={confirmar}
        onPointerCancel={()=>{valor.current=null;setVista(null);entrada.current.dataset.editando='no';}} />
      {MARCAS.map(([nombre,valor])=><button key={nombre} style={{top:`${valor}%`}}
        onClick={()=>onViajar(valor)}>{nombre}</button>)}
    </div>
    <output>{vista===null?'Arrastra y suelta':textoDistancia(distanciaDesdeBarra(vista))}</output>
  </aside>;
}
