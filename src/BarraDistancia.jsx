import { useEffect, useRef } from 'react';
import { MARCAS_ESCALA, distanciaDesdeBarra, textoDistancia } from './scene/escalaNavegacion.js';
import { CANTIDAD_LINEAS_ESCALA, intensidadLinea } from './scene/ondaEscala.js';

const MARCAS = MARCAS_ESCALA;
const LINEAS = Array.from({length:CANTIDAD_LINEAS_ESCALA},(_,i)=>i);
export default function BarraDistancia({ onViajar, onSeguir }) {
  const recorrido=useRef(null);
  const lineas=useRef([]);
  const salida=useRef(null);
  const nombre=useRef(null);
  const distancia=useRef(null);
  const vista=useRef(null);
  const cuadro=useRef(null);
  // Arrastre con el dedo: la cámara sigue la posición del dedo, como con la rueda.
  const arrastre=useRef(null);
  useEffect(()=>()=>cancelAnimationFrame(cuadro.current),[]);

  const previsualizar=valor=>{
    vista.current=valor;
    // Una actualización por fotograma, con la posición más reciente y sin colas por línea.
    if(cuadro.current!==null)return;
    cuadro.current=requestAnimationFrame(()=>{
      cuadro.current=null;
      const actual=vista.current;
      lineas.current.forEach((linea,indice)=>{
        const onda=intensidadLinea(indice,actual);
        linea.style.transform=`translateY(-50%) scaleX(${1+onda*2})`;
        linea.style.opacity=.3+onda*.65;
      });
      recorrido.current.dataset.vista=actual??'';
      salida.current.hidden=actual===null;
      if(actual===null)return;
      recorrido.current.setAttribute('aria-valuenow',actual.toFixed(1));
      const texto=textoDistancia(distanciaDesdeBarra(actual));
      recorrido.current.setAttribute('aria-valuetext',`Vista previa: ${texto}. Pulsa Intro para viajar.`);
      salida.current.style.top=`${100-actual}%`;
      const cercana=MARCAS.reduce((a,b)=>Math.abs(b[1]-actual)<Math.abs(a[1]-actual)?b:a);
      nombre.current.hidden=Math.abs(cercana[1]-actual)>=6;
      nombre.current.textContent=cercana[0];
      distancia.current.textContent=texto;
    });
  };
  const desdePuntero=evento=>{
    const caja=recorrido.current.getBoundingClientRect();
    return Math.max(0,Math.min(100,100*(1-(evento.clientY-caja.top)/caja.height)));
  };
  return <aside className="barra-distancia" aria-label="Escala de exploración">
    <button className="escala-extremo escala-galaxia" onClick={()=>onViajar(100)}>Vía Láctea</button>
    <div ref={recorrido} className="barra-recorrido" role="slider" tabIndex="0" data-barra-distancia
      aria-label="Escala de distancia desde la Tierra" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-vista=""
      onPointerDown={evento=>{if(evento.pointerType==='touch')arrastre.current={inicio:evento.clientY,movido:false};}}
      onPointerMove={evento=>{
        const valor=desdePuntero(evento);
        previsualizar(valor);
        const toque=arrastre.current;
        if(!toque||evento.pointerType!=='touch')return;
        if(Math.abs(evento.clientY-toque.inicio)>6)toque.movido=true;
        if(toque.movido)onSeguir(valor);
      }}
      onPointerUp={evento=>{const toque=arrastre.current;if(toque?.movido)onSeguir(desdePuntero(evento),true);if(evento.pointerType==='touch')previsualizar(null);}}
      onPointerCancel={()=>{arrastre.current=null;}}
      onPointerLeave={()=>previsualizar(null)}
      onClick={evento=>{const toque=arrastre.current;arrastre.current=null;if(!toque?.movido)onViajar(desdePuntero(evento));}}
      onFocus={()=>previsualizar(Number(recorrido.current.dataset.valor||0))} onBlur={()=>previsualizar(null)}
      onKeyDown={evento=>{
        if(!['ArrowUp','ArrowDown','Home','End','Enter',' '].includes(evento.key))return;
        evento.preventDefault();evento.stopPropagation();
        const actual=vista.current??Number(recorrido.current.dataset.valor||0);
        if(evento.key==='Enter'||evento.key===' ')onViajar(actual);
        else previsualizar(evento.key==='Home'?0:evento.key==='End'?100:Math.max(0,Math.min(100,actual+(evento.key==='ArrowUp'?2:-2))));
      }}>
      {LINEAS.map(indice=><i key={indice} ref={elemento=>{lineas.current[indice]=elemento;}} className="escala-linea" style={{top:`${indice*100/(CANTIDAD_LINEAS_ESCALA-1)}%`}}/>)}
      <i className="escala-posicion"/>
      <output ref={salida} className="escala-vista" hidden><strong ref={nombre}/><span ref={distancia}/></output>
    </div>
    <button className="escala-extremo escala-tierra" onClick={()=>onViajar(0)}>Tierra</button>
  </aside>;
}
