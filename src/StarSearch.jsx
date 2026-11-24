import { useEffect, useMemo, useRef, useState } from 'react';
import { GENITIVOS, buildSearchIndex, lineaDeAlias, normalizeStarQuery, searchStars } from './scene/starSearch';
import { nombreParaMostrar } from './scene/nombresEstrella';
import { buscaNumeroDeCatalogo, indiceBusqueda, indiceNumeros } from './indiceBusqueda';
import { buscarEnCapa } from './capaBusqueda';
import { cargar as cargarCumulos } from './scene/datosCumulos';
import { buscarCumulos } from './scene/buscarCumulos';
import { buscarAnfitrionas, buscarPlanetas, cargarPlanetas, indicesDePlanetas, ordenPorLetra } from './scene/buscarPlanetas';
const SIN_DESTINOS=[];
// Sugerencias al abrir el buscador vacío: nombre que se muestra, qué es y cómo se busca.
const SUGERENCIAS=[
  {nombre:'Sol',tipo:'Estrella',buscar:'Sol'},
  {nombre:'Sirio',tipo:'Estrella',buscar:'Sirius'},
  {nombre:'Próxima Centauri',tipo:'Estrella',buscar:'Proxima Centauri'},
  {nombre:'TRAPPIST-1',tipo:'Sistema con planetas',buscar:'TRAPPIST-1'},
  {nombre:'Júpiter',tipo:'Planeta',buscar:'Júpiter'},
  {nombre:'Pléyades',tipo:'Cúmulo',buscar:'Pléyades'},
];
// Grupos de la lista de sugerencias, en este orden y con estos títulos.
const GRUPOS=[['Estrella','Estrellas'],['Planeta','Planetas'],['Sistema con planetas','Sistemas planetarios'],['Cúmulo','Cúmulos']];
// El buscador también suma planetas, lunas y estrellas de destino, en el computador y en el celular. Los números
// de Gaia DR3 y TIC se cargan aparte, solo cuando la búsqueda parece uno.
// `seleccion`: clave de lo elegido en la escena (App.jsx). El nombre que dejó una búsqueda se borra cuando
// eso cambia: al soltarlo (Esc, ×), al elegir otra cosa o al viajar a otro lado.
export default function StarSearch({ onSelect, onSelectBody, onSelectCumulo, onSelectPlaneta, destinos=SIN_DESTINOS, elegida, seleccion }) {
  const [index,setIndex]=useState(null), [query,setQuery]=useState(''), [open,setOpen]=useState(false);
  const [active,setActive]=useState(0), [error,setError]=useState(false);
  const [numeros,setNumeros]=useState(null);
  // Cúmulos (public/data/cumulos.json): se piden recién al abrir el buscador.
  const [cumulos,setCumulos]=useState(null);
  // Exoplanetas por cualquiera de sus nombres (public/data/planet-search.json): también al abrir el buscador.
  const [planetas,setPlanetas]=useState(null);
  // Estrellas de la capa de fondo para lo escrito (se piden aparte, por trozos; ver capaBusqueda.js).
  const [capa,setCapa]=useState({query:'',results:[]});
  // Lo elegido justo después de la búsqueda; se toma un instante después, cuando la escena ya cambió.
  const [propia,setPropia]=useState(null);
  const seleccionActual=useRef(seleccion);
  useEffect(()=>{seleccionActual.current=seleccion;},[seleccion]);
  if(propia!==null&&seleccion!==propia){setPropia(null);setQuery('');}
  const pideNumero=buscaNumeroDeCatalogo(normalizeStarQuery(query));
  useEffect(()=>{if(pideNumero&&!numeros)indiceNumeros().then(setNumeros,()=>{});},[pideNumero,numeros]);
  useEffect(()=>{
    if(!open||normalizeStarQuery(query).length<2)return;
    let vigente=true;
    buscarEnCapa(query).then(results=>{if(vigente)setCapa({query,results});},()=>{});
    return ()=>{vigente=false;};
  },[open,query]);
  const estrellas=useMemo(()=>{
    const directas=searchStars(index || [],query);
    if(!pideNumero||!numeros||!index)return directas;
    // Un número de Gaia o TIC se muestra con los nombres de la estrella, no solo con el número.
    const porId=new Map(index.map(item=>[item.id,item]));
    const vistos=new Set(directas.map(result=>result.id));
    const porNumero=searchStars(numeros,query).filter(result=>!vistos.has(result.id)&&porId.has(result.id))
      .map(result=>({...porId.get(result.id),score:result.score,matched:result.matched}));
    return [...directas,...porNumero].sort((a,b)=>a.score-b.score).slice(0,8);
  },[index,numeros,pideNumero,query]);
  const nombresDestinos=destinos.map(body=>body.name).join('|');
  const cuerpos=useMemo(()=>{
    if(normalizeStarQuery(query).length<2)return [];
    const unicos=[...new Map(destinos.map(body=>[body.optionValue||body.name,body])).values()];
    return searchStars(buildSearchIndex(unicos.map((body,i)=>[`cuerpo-${i}`,[body.name]])),query)
      .map(result=>({...result,body:unicos[Number(result.id.slice(7))]}));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la lista se recrea en cada render; basta con sus nombres.
  },[nombresDestinos,query]);
  const deCumulos=useMemo(()=>buscarCumulos(cumulos,query).map(fila=>({...fila,detalle:[fila.cumulo?.tipo==='globular'?'Cúmulo globular':'Cúmulo abierto',...fila.aliases.slice(1,3)].join(' · ')})),[cumulos,query]);
  // Índices de planetas y de los nombres nuevos de sus estrellas, con los nombres del índice de estrellas.
  const indicesPlanetas=useMemo(()=>planetas&&index?indicesDePlanetas(planetas,index):null,[planetas,index]);
  const dePlanetas=useMemo(()=>buscarPlanetas(indicesPlanetas,query).map(fila=>({...fila,
    detalle:`Planeta · ${nombreParaMostrar(fila.planeta.estrella,GENITIVOS)}${fila.matched!==fila.aliases[0]?` · ${fila.matched}`:''}`})),[indicesPlanetas,query]);
  const anfitrionas=useMemo(()=>buscarAnfitrionas(indicesPlanetas,query),[indicesPlanetas,query]);
  const results=useMemo(()=>{
    const nombres=new Set(cuerpos.map(result=>normalizeStarQuery(result.aliases[0])));
    const deCapa=capa.query===query?capa.results:[];
    // Con el mismo puntaje, el cúmulo va antes que una estrella que lo nombra a medias.
    // Un planeta del sistema donde se está ya sale entre los cuerpos; una anfitriona, una sola vez.
    const idsEstrellas=new Set(estrellas.map(result=>result.id));
    // «GJ 229 B» pone primero la estrella y «GJ 229 b» el planeta (ordenPorLetra).
    const orden=ordenPorLetra(query), mas=(filas,extra)=>extra?filas.map(fila=>({...fila,score:fila.score+extra})):filas;
    return [...cuerpos,...deCumulos,...mas(dePlanetas.filter(result=>!nombres.has(normalizeStarQuery(result.aliases[0]))),orden.planeta),
      ...mas([...estrellas.filter(result=>!nombres.has(normalizeStarQuery(result.aliases[0]))),...anfitrionas.filter(result=>!idsEstrellas.has(result.id)),...deCapa],orden.estrella)]
      .sort((a,b)=>a.score-b.score).slice(0,8);
  },[cuerpos,deCumulos,dePlanetas,estrellas,anfitrionas,capa,query]);
  // Sugerencias resueltas: un cuerpo de navegación (Sol, Júpiter) o la estrella del catálogo con ese nombre.
  const sugeridas=useMemo(()=>{
    if(!index)return [];
    const clave=texto=>normalizeStarQuery(texto);
    return SUGERENCIAS.map((sugerencia,k)=>{
      if(sugerencia.tipo==='Cúmulo'){
        const fila=buscarCumulos(cumulos,sugerencia.buscar).find(f=>f.score===0);
        return fila?{...fila,id:`sugerencia-${k}`,aliases:[sugerencia.nombre],sugerencia}:null;
      }
      const body=destinos.find(b=>clave(b.name)===clave(sugerencia.nombre)||clave(b.name)===clave(sugerencia.buscar));
      if(body)return {id:`sugerencia-${k}`,aliases:[sugerencia.nombre],body,sugerencia};
      const estrella=searchStars(index,sugerencia.buscar).find(r=>r.score===0);
      return estrella?{...estrella,id:`sugerencia-${k}`,estrellaId:estrella.id,aliases:[sugerencia.nombre,...estrella.aliases.filter(a=>a!==sugerencia.nombre)],sugerencia}:null;
    }).filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la lista de destinos se recrea en cada render; basta con sus nombres.
  },[index,cumulos,nombresDestinos]);
  const vacia=query.trim()==='';
  const lista=vacia?sugeridas:results;
  const load=async()=>{
    setOpen(true);setError(false);
    if(!cumulos)cargarCumulos().then(setCumulos,()=>{});
    if(!planetas)cargarPlanetas().then(setPlanetas,()=>{});
    try {
      setIndex(await indiceBusqueda());
    } catch {setError(true);}
  };
  const select=result=>{if(result.cumulo)onSelectCumulo?.(result.cumulo);else if(result.planeta)onSelectPlaneta?.(result.planeta);else if(result.body)onSelectBody(result.body);else onSelect(result.estrellaId!==undefined?{...result,id:result.estrellaId}:result);setQuery(result.body||result.cumulo||result.planeta?result.aliases[0]:nombreParaMostrar(result.aliases[0],GENITIVOS));setOpen(false);setPropia(null);
    setTimeout(()=>setPropia(seleccionActual.current),100);};
  return <div className="star-search" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor="star-search-input" className="solo-lector">Buscar estrella</label>
    {/* Lupa antes de «Buscar», dentro del campo. */}
    <span className="star-search-campo">
      <svg className="star-search-lupa" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M15.4 15.4 20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input id="star-search-input" role="combobox" autoComplete="off" className={elegida&&query===nombreParaMostrar(elegida.nombre,GENITIVOS)?'con-estrella':undefined}
        style={elegida&&query===nombreParaMostrar(elegida.nombre,GENITIVOS)?{'--color-estrella':elegida.color}:undefined} aria-autocomplete="list" aria-expanded={open}
        aria-controls="star-search-results" aria-activedescendant={open&&lista[active]?`star-result-${lista[active].id}`:undefined}
        placeholder="Buscar" value={query} onFocus={()=>{setActive(0);load();}} onClick={()=>setOpen(true)}
        onChange={e=>{setPropia(null);setQuery(e.target.value);setActive(0);setOpen(true);}}
        onKeyDown={e=>{
          if(e.key==='Escape'){setOpen(false);e.stopPropagation();}
          if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(i=>Math.max(0,Math.min(lista.length-1,i+(e.key==='ArrowDown'?1:-1))));}
          if(e.key==='Enter'&&open&&lista[active]){e.preventDefault();select(lista[active]);}
        }} />
    </span>
    {/* Vacía: sugerencias. Con una sola letra no se abre la lista: no hace falta pedir más letras. */}
    {open&&vacia&&index&&sugeridas.length>0&&<div className="search-dropdown sugerencias">
      <ul id="star-search-results" role="listbox" aria-label="Sugerencias">
        {GRUPOS.flatMap(([tipo,titulo])=>{
          const del=sugeridas.filter(r=>r.sugerencia.tipo===tipo);
          return del.length?[<li key={`t-${tipo}`} role="presentation" className="sugerencias-titulo">{titulo}</li>,
            ...del.map(r=>{const i=sugeridas.indexOf(r);return <li key={r.id} id={`star-result-${r.id}`} role="option" aria-selected={active===i}
              onMouseEnter={()=>setActive(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>select(r)}>{r.aliases[0]}</li>;})]:[];
        })}
      </ul>
    </div>}
    {open&&!vacia&&(error||!index||query.trim().length>=2)&&<div className="search-dropdown">
      <div role="status">{error?'No se pudo cargar.':!index?'Cargando catálogo…':results.length?`${results.length} ${results.length===1?'sugerencia':'sugerencias'}`:'Sin coincidencias: el catálogo local no contiene todas las estrellas ni todos sus nombres'}</div>
      {error&&<button onClick={load}>Reintentar</button>}
      <ul id="star-search-results" role="listbox">
        {results.map((result,i)=><li key={result.id} id={`star-result-${result.id}`} role="option" aria-selected={active===i}
          onMouseEnter={()=>setActive(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>select(result)}>
          <strong>{result.score>=3?'Quizás: ':''}{result.body||result.cumulo||result.planeta?result.aliases[0]:nombreParaMostrar(result.aliases[0],GENITIVOS)}</strong>
          <span>{result.detalle??lineaDeAlias(result.aliases,result.matched).join(' · ')}</span>
        </li>)}
      </ul>
    </div>}
  </div>;
}
