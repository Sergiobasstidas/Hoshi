const greek = { 'α':'alp', alpha:'alp', alfa:'alp', 'β':'bet', beta:'bet', 'γ':'gam', gamma:'gam', 'δ':'del', delta:'del', 'ε':'eps', epsilon:'eps', 'ζ':'zet', zeta:'zet', 'η':'eta', 'θ':'the', theta:'the', 'ι':'iot', iota:'iot', 'κ':'kap', kappa:'kap', 'λ':'lam', lambda:'lam', 'μ':'mu', 'ν':'nu', 'ξ':'ksi', xi:'ksi', 'ο':'omi', omicron:'omi', 'π':'pi', 'ρ':'rho', 'σ':'sig', sigma:'sig', 'τ':'tau', 'υ':'ups', upsilon:'ups', 'φ':'phi', 'χ':'chi', 'ψ':'psi', 'ω':'ome', omega:'ome', carinae:'car', carina:'car', orionis:'ori', orion:'ori', canismajoris:'cma', sirio:'sirius' };
export function normalizeStarQuery(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(gliese|gj)\b/g, 'gl')
    .replace(/canis\s+majoris/g, 'canismajoris')
    .replace(/[a-zα-ω]+/g, token => greek[token] || token).replace(/[^a-z0-9]/g, '');
}
export function buildSearchIndex(rows) {
  return rows.map(([id, aliases]) => ({ id, aliases, keys: aliases.map(normalizeStarQuery) }));
}
function editDistance(a, b) {
  let row = Array.from({length:b.length+1}, (_,i)=>i);
  for (let i=1;i<=a.length;i++) {
    const next=[i];
    for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    row=next;
  }
  return row[b.length];
}
export function searchStars(index, query, limit=8) {
  const key=normalizeStarQuery(query);
  if (key.length<2) return [];
  const matches=[];
  for(const item of index) {
    let score=Infinity, matched='';
    item.keys.forEach((alias,i)=>{
      const rank=alias===key?0:alias.startsWith(key)?1:alias.includes(key)?2:Infinity;
      if(rank<score){score=rank;matched=item.aliases[i];}
    });
    // Sugerir correcciones solo en nombres comunes alfabéticos, nunca en identificadores de catálogo.
    if(!Number.isFinite(score) && key.length>=5 && !/\d/.test(key) && !/\d/.test(item.keys[0]) && Math.abs(item.keys[0].length-key.length)<=2) {
      const distance=editDistance(key,item.keys[0]);
      if(distance<=Math.min(3,Math.floor(key.length*.4))) {score=3+distance;matched=item.aliases[0];}
    }
    if(Number.isFinite(score)) matches.push({...item,score,matched});
  }
  return matches.sort((a,b)=>a.score-b.score || a.aliases[0].localeCompare(b.aliases[0])).slice(0,limit);
}
