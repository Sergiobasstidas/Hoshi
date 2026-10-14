import { useMemo } from 'react';
import { COLOR_MODES, MISSIONS, MISSION_COLORS, PLANET_TYPES, STATUS, countTabs, filterSystems } from './scene/descubrimientos.js';
import './PanelDescubrimientos.css';

const number = value => (value || 0).toLocaleString('es-CL');
// Iconos pequeños dibujados en línea: tamaño relativo del planeta y telescopio/satélite.
const PLANET_ICON_RADIUS = { gigante: 7, neptuno: 5.5, supertierra: 4.2, terrestre: 3.2 };
function PlanetIcon({ type }) {
  const r = PLANET_ICON_RADIUS[type.id];
  return <svg className="icono-descubrimiento" viewBox="0 0 18 18" aria-hidden="true">
    {r ? <><circle cx="9" cy="9" r={r} fill={type.color} opacity="0.92" />
      {type.id === 'gigante' && <ellipse cx="9" cy="9" rx="8.6" ry="2.3" fill="none" stroke={type.color} strokeWidth="0.9" opacity="0.7" />}</>
      : <path d="M9 1.5 L10.2 7.8 L16.5 9 L10.2 10.2 L9 16.5 L7.8 10.2 L1.5 9 L7.8 7.8 Z" fill="#fff" opacity="0.85" />}
  </svg>;
}
function MissionIcon({ index }) {
  const color = index === null ? '#fff' : MISSION_COLORS[index];
  const kind = index === null ? 'todas' : MISSIONS[index].icono;
  return <svg className="icono-descubrimiento" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round">
    {kind === 'telescopio' ? <><path d="M3 11 L13 5 L14.6 7.8 L4.6 13.8 Z" /><path d="M8.5 11 L6 16.5 M8.5 11 L11 16.5" /></>
      : kind === 'satelite' ? <><rect x="6.5" y="6.5" width="5" height="5" rx="1" /><path d="M1.5 4.5 L5 8 M13 10 L16.5 13.5 M3 3 L6 6 M12 12 L15 15" /></>
      : kind === 'observatorio' ? <><path d="M3 15.5 H15 M4.5 15.5 V10 A4.5 4.5 0 0 1 13.5 10 V15.5" /><path d="M9 5.5 L12.5 2.5" /></>
      : <><circle cx="9" cy="9" r="6" /><path d="M3 9 H15 M9 3 C6 6 6 12 9 15 C12 12 12 6 9 3" /></>}
  </svg>;
}

function Tabs({ label, options, value, onChange, counts }) {
  return <div className="descubrimientos-fila" role="radiogroup" aria-label={label}>
    <span className="descubrimientos-rotulo">{label}</span>
    <div className="descubrimientos-pestanas">
      {options.map(option => <button key={option.id} role="radio" aria-checked={value === option.id} title={option.detalle}
        className={value === option.id ? 'activa' : ''} disabled={counts && !counts[option.id] && value !== option.id}
        onClick={() => onChange(option.id)}>
        {option.icon}<span>{option.nombre}</span>{counts && <small>{number(counts[option.id])}</small>}
      </button>)}
    </div>
  </div>;
}

export default function PanelDescubrimientos({ data, status, filter, onFilter, onClose }) {
  const counts = useMemo(() => data ? countTabs(data, filter) : null, [data, filter]);
  const systems = useMemo(() => data ? filterSystems(data, filter).size : 0, [data, filter]);
  const set = key => value => onFilter(current => ({ ...current, [key]: value }));
  return <aside className="descubrimientos-panel" aria-label="Descubrimientos de exoplanetas">
    <header>
      <div>
        <span className="eyebrow">Descubrimientos</span>
        <strong>Exoplanetas</strong>
        {data && <span className="descubrimientos-resumen">{number(counts.estado[filter.estado])} {counts.estado[filter.estado] === 1 ? 'planeta' : 'planetas'} en {number(systems)} {systems === 1 ? 'sistema' : 'sistemas'}</span>}
      </div>
      <button className="descubrimientos-cerrar" aria-label="Cerrar descubrimientos" onClick={onClose}>×</button>
    </header>
    {status === 'loading' && <p className="descubrimientos-estado" role="status">Cargando el archivo de exoplanetas de la NASA…</p>}
    {status === 'error' && <p className="descubrimientos-estado" role="status">No se pudo cargar el archivo de exoplanetas. Cierra y vuelve a abrir para reintentar.</p>}
    {data && <>
      <Tabs label="Estado" value={filter.estado} onChange={set('estado')} counts={counts.estado}
        options={STATUS} />
      <Tabs label="Tipo de planeta" value={filter.tipo} onChange={set('tipo')} counts={counts.tipo}
        options={[{ id: 'todos', nombre: 'Todos', icon: <PlanetIcon type={{ id: 'todos' }} /> },
          ...PLANET_TYPES.slice(0, 4).map(type => ({ ...type, icon: <PlanetIcon type={type} /> }))]} />
      <Tabs label="Misión" value={filter.mision} onChange={set('mision')} counts={counts.mision}
        options={[{ id: 'todas', nombre: 'Todas', icon: <MissionIcon index={null} /> },
          ...MISSIONS.map((mission, index) => ({ ...mission, icon: <MissionIcon index={index} /> }))]} />
      <Tabs label="Color" value={filter.color} onChange={set('color')} options={COLOR_MODES} />
      <div className="descubrimientos-leyenda">
        <span><i className="destello" />Confirmado</span>
        <span><i className="destello candidato" />Solo candidatos</span>
        {filter.color === 'estrella' && <span><i className="gradiente-estelar" />Color de la estrella por su temperatura</span>}
        {filter.color === 'tipo' && PLANET_TYPES.map(type => <span key={type.id}><i className="punto" style={{ background: type.color }} />{type.nombre}</span>)}
        {filter.color === 'mision' && MISSIONS.map((mission, index) => <span key={mission.id}><i className="punto" style={{ background: MISSION_COLORS[index] }} />{mission.nombre}</span>)}
      </div>
      <p className="descubrimientos-fuente">Fuente: <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">NASA Exoplanet Archive</a> (Caltech/IPAC) · tablas pscomppars, toi, cumulative y k2pandc</p>
    </>}
  </aside>;
}
