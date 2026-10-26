import { useMemo, useState } from 'react';
import { buildSearchIndex, searchStars } from './scene/starSearch';
import { addCuratedSearchRows } from './scene/curatedStars';
let cached;
export default function StarSearch({ onSelect }) {
  const [index,setIndex]=useState(null), [query,setQuery]=useState(''), [open,setOpen]=useState(false);
  const [active,setActive]=useState(0), [error,setError]=useState(false);
  const results=useMemo(()=>searchStars(index || [],query),[index,query]);
  const load=async()=>{
    setOpen(true);setError(false);
    try {
      cached ||= fetch('/data/star-search.json').then(r=>{if(!r.ok)throw Error('index');return r.json();})
        .then(addCuratedSearchRows).then(buildSearchIndex).catch(e=>{cached=null;throw e;});
      setIndex(await cached);
    } catch {setError(true);}
  };
  const select=result=>{onSelect(result);setQuery(result.aliases[0]);setOpen(false);};
  return <div className="star-search" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor="star-search-input" className="solo-lector">Buscar estrella</label>
    <input id="star-search-input" role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls="star-search-results" aria-activedescendant={open&&results[active]?`star-result-${results[active].id}`:undefined}
      placeholder="Buscar: Sirio, Vega, HIP…" value={query} onFocus={load}
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
