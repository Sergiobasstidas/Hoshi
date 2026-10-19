import { memo, useLayoutEffect, useRef } from 'react';
import { useMoons } from './scene/moonBodies';
import './lunas.css';

// Botones con el nombre de cada luna; Moons.jsx decide en cada cuadro cuáles se ven y dónde.
// Memorizado: App vuelve a dibujarse a menudo y rehacer 406 botones cada vez se nota.
const MoonButtons = memo(function MoonButtons({ focusedCode, onSelectRef }) {
  const { bodies } = useMoons();
  return <div className="moon-labels" data-moon-labels data-focused={focusedCode}>
    {bodies.map(body => <button key={body.moon.code} type="button" data-code={body.moon.code} className="moon-label"
      onClick={() => onSelectRef.current(body)} title={`Acercarse a ${body.name}`}>{body.name}</button>)}
  </div>;
});

export default function MoonLabels({ focused, onSelect }) {
  const onSelectRef = useRef(onSelect);
  useLayoutEffect(() => { onSelectRef.current = onSelect; });
  return <MoonButtons focusedCode={focused?.kind === 'satellite' ? focused.moon.code : ''} onSelectRef={onSelectRef} />;
}
