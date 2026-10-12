import { useRef, useState } from 'react';
import { AU_TO_PC, LIGHT_YEAR_PC } from './scene/scale.js';
import { barraDesdeDistancia, distanciaDesdeBarra, textoDistancia } from './scene/escalaNavegacion.js';

const MARCAS = [['Tierra',0],['Sistema solar',barraDesdeDistancia(50*AU_TO_PC)],
  ['Heliosfera',barraDesdeDistancia(120*AU_TO_PC)],['Nube de Oort',barraDesdeDistancia(LIGHT_YEAR_PC)],
  ['Vecindario',barraDesdeDistancia(100*LIGHT_YEAR_PC)],['Vía Láctea',100]];
const LINEAS = Array.from({length:65},(_,i)=>100-i*100/64);
export default function BarraDistancia({ onViajar }) {
  const recorrido=useRef(null);
  const [vista,setVista]=useState(null);
  const desdePuntero=evento=>{
    const caja=recorrido.current.getBoundingClientRect();
    return Math.max(0,Math.min(100,100*(1-(evento.clientY-caja.top)/caja.height)));
  };
  const cercana=vista===null?null:MARCAS.reduce((a,b)=>Math.abs(b[1]-vista)<Math.abs(a[1]-vista)?b:a);
  return <aside className="barra-distancia" aria-label="Escala de exploración">
    <button className="escala-extremo escala-galaxia" onClick={()=>onViajar(100)}>Vía Láctea</button>
    <div ref={recorrido} className="barra-recorrido" role="slider" tabIndex="0" data-barra-distancia
      aria-label="Escala de distancia desde la Tierra" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow={vista??0} data-vista={vista??''}
      aria-valuetext={vista===null?undefined:`Vista previa: ${textoDistancia(distanciaDesdeBarra(vista))}. Pulsa Intro para viajar.`}
      onPointerMove={evento=>setVista(desdePuntero(evento))} onPointerLeave={()=>setVista(null)}
      onClick={evento=>onViajar(desdePuntero(evento))}
      onFocus={()=>setVista(Number(recorrido.current.dataset.valor||0))} onBlur={()=>setVista(null)}
      onKeyDown={evento=>{
        if(!['ArrowUp','ArrowDown','Home','End','Enter',' '].includes(evento.key))return;
        evento.preventDefault();evento.stopPropagation();
        const actual=vista??Number(recorrido.current.dataset.valor||0);
        if(evento.key==='Enter'||evento.key===' ')onViajar(actual);
        else setVista(evento.key==='Home'?0:evento.key==='End'?100:Math.max(0,Math.min(100,actual+(evento.key==='ArrowUp'?2:-2))));
      }}>
      {LINEAS.map(valor=>{
        const onda=vista===null?0:Math.exp(-(((valor-vista)/7)**2));
        return <i key={valor} className="escala-linea" style={{top:`${100-valor}%`,width:`${16+onda*58}px`,opacity:.3+onda*.65}}/>;
      })}
      <i className="escala-posicion"/>
      {vista!==null&&<output className="escala-vista" style={{top:`${100-vista}%`}}>
        {cercana&&Math.abs(cercana[1]-vista)<6&&<strong>{cercana[0]}</strong>}
        <span>{textoDistancia(distanciaDesdeBarra(vista))}</span>
      </output>}
    </div>
    <button className="escala-extremo escala-tierra" onClick={()=>onViajar(0)}>Tierra</button>
  </aside>;
}
