import { useRef } from 'react';
import { dialDesdeVelocidad, velocidadDesdeDial, valorDesdeAngulo, formatoVelocidad } from './scene/controlVelocidad.js';
import { wheelSpeed } from './scene/scale.js';

export default function DialVelocidad({ velocidad, activo, viajando, onCambiar, onActivar }) {
  const arrastre=useRef(null);
  const valor=dialDesdeVelocidad(velocidad);
  const formato=formatoVelocidad(velocidad);
  const ajustar=evento=>{
    const caja=evento.currentTarget.getBoundingClientRect();
    // En el celular el visor es una píldora horizontal: se ajusta deslizando de izquierda a derecha.
    if(caja.width>caja.height*1.6){onCambiar(velocidadDesdeDial(Math.max(0,Math.min(100,(evento.clientX-caja.left)/caja.width*100))));return;}
    onCambiar(velocidadDesdeDial(valorDesdeAngulo(evento.clientX-caja.left-caja.width/2,evento.clientY-caja.top-caja.height/2)));
  };
  return <section className={`dial-velocidad${activo?' activo':''}`} aria-label="Control de velocidad de vuelo">
    <div className="dial-superficie" onPointerDown={evento=>{
      if(!activo||evento.button!==0)return;
      arrastre.current=evento.pointerId;evento.currentTarget.setPointerCapture(evento.pointerId);ajustar(evento);
    }} onPointerMove={evento=>{if(arrastre.current===evento.pointerId)ajustar(evento);}}
      onPointerUp={evento=>{arrastre.current=null;if(evento.currentTarget.hasPointerCapture(evento.pointerId))evento.currentTarget.releasePointerCapture(evento.pointerId);}}
      onPointerCancel={()=>{arrastre.current=null;}} onLostPointerCapture={()=>{arrastre.current=null;}}
      onWheel={evento=>{if(activo)onCambiar(wheelSpeed(velocidad,evento,window.innerHeight));}}>
      <svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="degradado-velocidad"><stop stopColor="#345065"/><stop offset="1" stopColor="#739eaa"/></linearGradient></defs>
        <g transform="rotate(135 100 100)"><circle className="dial-fondo" cx="100" cy="100" r="86" pathLength="100" strokeDasharray="75 100"/>
          <circle className="dial-arco" cx="100" cy="100" r="86" pathLength="100" strokeDasharray={`${valor*.75} 100`}/></g>
        {Array.from({length:31},(_,i)=>{const a=(135+i*9)*Math.PI/180;return <line key={i} x1={100+Math.cos(a)*74} y1={100+Math.sin(a)*74} x2={100+Math.cos(a)*(i%5===0?67:70)} y2={100+Math.sin(a)*(i%5===0?67:70)}/>;})}
      </svg>
      <div className="dial-lectura"><span className="dial-titulo">VELOCIDAD DE VUELO</span><strong>{activo?formato.numero:'—'}</strong><span>{formato.unidad}</span><small>{activo?`${formato.km} km/s`:viajando?'Viaje automático':'Modo orbital'}</small></div>
      <i className="pildora-barra" aria-hidden="true"><b style={{width:`${activo?valor:0}%`}} /></i>
    </div>
    <input className="dial-teclado" type="range" min="0" max="100" step="0.1" value={valor} disabled={!activo}
      aria-label="Ajustar velocidad de vuelo" aria-valuetext={`${formato.numero} ${formato.unidad}; ${formato.km} kilómetros por segundo`}
      onChange={evento=>onCambiar(velocidadDesdeDial(Number(evento.target.value)))}/>
    {!activo&&<span className="dial-instruccion"><button disabled={viajando} onClick={onActivar}>{viajando?'En tránsito':'Activar vuelo libre'}</button></span>}
  </section>;
}
