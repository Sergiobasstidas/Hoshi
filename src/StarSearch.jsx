import { useEffect, useMemo, useState } from 'react';
import { buildSearchIndex, normalizeStarQuery, searchStars } from './scene/starSearch';
import { buscaNumeroDeCatalogo, indiceBusqueda, indiceNumeros } from './indiceBusqueda';
import { useEsComputador } from './esComputador';
const SIN_DESTINOS=[];
// El buscador también suma planetas, lunas y estrellas de destino, en el computador y en el celular. Los números
// de Gaia DR3 y TIC se cargan aparte, solo cuando la búsqueda parece uno.
export default function StarSearch({ onSelect, onSelectBody, destinos=SIN_DESTINOS, elegida }) {
  const computador=useEsComputador();
  const [index,setIndex]=useState(null), [query,setQuery]=useState(''), [open,setOpen]=useState(false);
  const [active,setActive]=useState(0), [error,setError]=useState(false);
  const [numeros,setNumeros]=useState(null);
  const pideNumero=buscaNumeroDeCatalogo(normalizeStarQuery(query));
  useEffect(()=>{if(pideNumero&&!numeros)indiceNumeros().then(setNumeros,()=>{});},[pideNumero,numeros]);
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
  const results=useMemo(()=>{
    const nombres=new Set(cuerpos.map(result=>normalizeStarQuery(result.aliases[0])));
    return [...cuerpos,...estrellas.filter(result=>!nombres.has(normalizeStarQuery(result.aliases[0])))]
      .sort((a,b)=>a.score-b.score).slice(0,8);
  },[cuerpos,estrellas]);
  const load=async()=>{
    setOpen(true);setError(false);
    try {
      setIndex(await indiceBusqueda());
    } catch {setError(true);}
  };
  const select=result=>{if(result.body)onSelectBody(result.body);else onSelect(result);setQuery(result.aliases[0]);setOpen(false);};
  return <div className="star-search" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor="star-search-input" className="solo-lector">Buscar estrella</label>
    <input id="star-search-input" role="combobox" autoComplete="off" className={elegida&&query===elegida.nombre?'con-estrella':undefined}
      style={elegida&&query===elegida.nombre?{'--color-estrella':elegida.color}:undefined} aria-autocomplete="list" aria-expanded={open}
      aria-controls="star-search-results" aria-activedescendant={open&&results[active]?`star-result-${results[active].id}`:undefined}
      placeholder={computador?'¿A dónde vamos? Sirio, Júpiter, TRAPPIST-1…':'Buscar: Sirio, Vega, HIP…'} value={query} onFocus={load}
      onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true);}}
      onKeyDown={e=>{
        if(e.key==='Escape'){setOpen(false);e.stopPropagation();}
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(i=>Math.max(0,Math.min(results.length-1,i+(e.key==='ArrowDown'?1:-1))));}
        if(e.key==='Enter'&&open&&results[active]){e.preventDefault();select(results[active]);}
      }} />
    {/* Sin texto suficiente no se abre la lista: no hace falta pedir más letras. */}
    {open&&(error||!index||query.trim().length>=2)&&<div className="search-dropdown">
      <div role="status">{error?'No se pudo cargar.':!index?'Cargando catálogo…':results.length?`${results.length} sugerencias`:'Sin coincidencias: el catálogo local no contiene todas las estrellas ni todos sus nombres'}</div>
      {error&&<button onClick={load}>Reintentar</button>}
      <ul id="star-search-results" role="listbox">
        {results.map((result,i)=><li key={result.id} id={`star-result-${result.id}`} role="option" aria-selected={active===i}
          onMouseEnter={()=>setActive(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>select(result)}>
          <strong>{result.score>=3?'Quizás: ':''}{result.aliases[0]}</strong>
          <span>{[result.matched,...result.aliases.filter(a=>a!==result.matched&&a!==result.aliases[0])].slice(0,4).join(' · ')}</span>
        </li>)}
      </ul>
    </div>}
  </div>;
}
