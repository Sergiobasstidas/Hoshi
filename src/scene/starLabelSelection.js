// Retener nombres presentes incluso al cruzarse. Solo los nombres nuevos deben
// encontrar espacio: una superposición durante el vuelo no apaga los anteriores.
export function selectStarLabels(candidates, previous, selectedId, limit = 12) {
  const byId = new Map(candidates.map(c => [c.id, c]));
  const chosen = [];
  const protectedLabel = c => c.id === selectedId || c.hovered;
  const overlaps = (a,b) => a.x < b.x+b.width+18 && a.x+a.width+18 > b.x && Math.abs(a.y-b.y)<28;
  const add = c => { if(c && chosen.length<limit && !chosen.some(other=>other.id===c.id))chosen.push(c); };
  add(byId.get(selectedId));
  candidates.filter(c=>c.hovered).forEach(add);
  for(const id of previous)add(byId.get(id));
  const incoming=candidates.filter(c=>!chosen.some(other=>other.id===c.id)).sort((a,b)=>a.distance-b.distance||a.id-b.id);
  for(const candidate of incoming){
    const collisions=chosen.filter(other=>overlaps(candidate,other));
    if(collisions.length) {
      // Sustitución local y con margen amplio; nunca reordenar todo el conjunto
      // por la aparición de una estrella ajena a esta zona de pantalla.
      if(collisions.length!==1 || protectedLabel(collisions[0]) || candidate.distance>=collisions[0].distance*.65)continue;
      chosen.splice(chosen.indexOf(collisions[0]),1,candidate);
    } else if(chosen.length<limit)chosen.push(candidate);
    else {
      const farthest=chosen.filter(c=>!protectedLabel(c)).sort((a,b)=>b.distance-a.distance)[0];
      if(farthest && candidate.distance<farthest.distance*.65)chosen.splice(chosen.indexOf(farthest),1,candidate);
    }
  }
  return new Set(chosen.map(c=>c.id));
}
