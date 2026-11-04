// Constelaciones: abreviatura IAU, genitivo latino y nombre en español (sin tildes, en minúsculas).
const CONSTELACIONES = [
  ['and', 'andromedae', 'andromeda'], ['ant', 'antliae', 'maquina neumatica'], ['aps', 'apodis', 'ave del paraiso'], ['aqr', 'aquarii', 'acuario'],
  ['aql', 'aquilae', 'aguila'], ['ara', 'arae', 'altar'], ['ari', 'arietis', 'aries'], ['aur', 'aurigae', 'auriga|cochero'], ['boo', 'bootis', 'boyero'],
  ['cae', 'caeli', 'buril'], ['cam', 'camelopardalis', 'jirafa'], ['cnc', 'cancri', 'cancer'], ['cvn', 'canum venaticorum', 'perros de caza|lebreles'],
  ['cma', 'canis majoris', 'can mayor'], ['cmi', 'canis minoris', 'can menor'], ['cap', 'capricorni', 'capricornio'], ['car', 'carinae', 'quilla'],
  ['cas', 'cassiopeiae', 'casiopea'], ['cen', 'centauri', 'centauro'], ['cep', 'cephei', 'cefeo'], ['cet', 'ceti', 'ballena'], ['cha', 'chamaeleontis', 'camaleon'],
  ['cir', 'circini', 'compas'], ['col', 'columbae', 'paloma'], ['com', 'comae berenices', 'cabellera de berenice'], ['cra', 'coronae australis', 'corona austral'],
  ['crb', 'coronae borealis', 'corona boreal'], ['crv', 'corvi', 'cuervo'], ['crt', 'crateris', 'copa'], ['cru', 'crucis', 'cruz del sur'], ['cyg', 'cygni', 'cisne'],
  ['del', 'delphini', 'delfin'], ['dor', 'doradus', 'dorado'], ['dra', 'draconis', 'dragon'], ['equ', 'equulei', 'caballo menor'], ['eri', 'eridani', 'eridano'],
  ['for', 'fornacis', 'horno'], ['gem', 'geminorum', 'geminis'], ['gru', 'gruis', 'grulla'], ['her', 'herculis', 'hercules'], ['hor', 'horologii', 'reloj'],
  ['hya', 'hydrae', 'hidra'], ['hyi', 'hydri', 'hidra macho'], ['ind', 'indi', 'indio'], ['lac', 'lacertae', 'lagarto'], ['leo', 'leonis', 'leon'],
  ['lmi', 'leonis minoris', 'leon menor'], ['lep', 'leporis', 'liebre'], ['lib', 'librae', 'libra'], ['lup', 'lupi', 'lobo'], ['lyn', 'lyncis', 'lince'],
  ['lyr', 'lyrae', 'lira'], ['men', 'mensae', 'mesa'], ['mic', 'microscopii', 'microscopio'], ['mon', 'monocerotis', 'unicornio'], ['mus', 'muscae', 'mosca'],
  ['nor', 'normae', 'escuadra'], ['oct', 'octantis', 'octante'], ['oph', 'ophiuchi', 'ofiuco'], ['ori', 'orionis', 'orion'], ['pav', 'pavonis', 'pavo'],
  ['peg', 'pegasi', 'pegaso'], ['per', 'persei', 'perseo'], ['phe', 'phoenicis', 'fenix'], ['pic', 'pictoris', 'pintor'], ['psc', 'piscium', 'piscis|peces'],
  ['psa', 'piscis austrini', 'pez austral'], ['pup', 'puppis', 'popa'], ['pyx', 'pyxidis', 'brujula'], ['ret', 'reticuli', 'reticulo'], ['sge', 'sagittae', 'flecha'],
  ['sgr', 'sagittarii', 'sagitario'], ['sco', 'scorpii', 'escorpio|escorpion'], ['scl', 'sculptoris', 'escultor'], ['sct', 'scuti', 'escudo'], ['ser', 'serpentis', 'serpiente'],
  ['sex', 'sextantis', 'sextante'], ['tau', 'tauri', 'tauro'], ['tel', 'telescopii', 'telescopio'], ['tra', 'trianguli australis', 'triangulo austral'],
  ['tri', 'trianguli', 'triangulo'], ['tuc', 'tucanae', 'tucan'], ['uma', 'ursae majoris', 'osa mayor'], ['umi', 'ursae minoris', 'osa menor'], ['vel', 'velorum', 'vela'],
  ['vir', 'virginis', 'virgo'], ['vol', 'volantis', 'pez volador'], ['vul', 'vulpeculae', 'zorra'],
];
// Los nombres largos primero, para que «osa mayor» no quede como «osa» + «mayor».
const FRASES = CONSTELACIONES.flatMap(([abreviatura, genitivo, nombres]) => [genitivo, ...nombres.split('|')].map(frase => [frase, abreviatura]))
  .sort((a, b) => b[0].length - a[0].length);
const PATRON_FRASES = new RegExp(`\\b(?:de la |del |de )?(${FRASES.map(([frase]) => frase.replace(/ /g, '\\s+')).join('|')})\\b`, 'g');
const ABREVIATURA = new Map(FRASES.map(([frase, abreviatura]) => [frase, abreviatura]));
// Letras griegas por símbolo, nombre en inglés o en español.
const greek = { 'α':'alp', alpha:'alp', alfa:'alp', 'β':'bet', beta:'bet', 'γ':'gam', gamma:'gam', 'δ':'del', delta:'del', 'ε':'eps', epsilon:'eps', 'ζ':'zet', zeta:'zet',
  'η':'eta', 'θ':'the', theta:'the', 'ι':'iot', iota:'iot', 'κ':'kap', kappa:'kap', kapa:'kap', 'λ':'lam', lambda:'lam', lamda:'lam', 'μ':'mu', mi:'mu', 'ν':'nu', ni:'nu',
  'ξ':'ksi', xi:'ksi', 'ο':'omi', omicron:'omi', 'π':'pi', 'ρ':'rho', ro:'rho', 'σ':'sig', sigma:'sig', 'τ':'tau', 'υ':'ups', upsilon:'ups', ipsilon:'ups',
  'φ':'phi', fi:'phi', 'χ':'chi', ji:'chi', 'ψ':'psi', 'ω':'ome', omega:'ome', sirio:'sirius' };
// Minúsculas, sin tildes ni espacios, guiones o signos; nombres largos de constelaciones y letras
// griegas a su abreviatura, para que «Épsilon Orionis», «ε Ori» y «eps-ori» den lo mismo.
export function normalizeStarQuery(value) {
  return value.toLowerCase().replace(/[α-ω]/g, letra => ` ${greek[letra] || letra} `).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(gliese|gj)\b/g, 'gl')
    .replace(PATRON_FRASES, (_, frase) => ` ${ABREVIATURA.get(frase.replace(/\s+/g, ' '))} `)
    .replace(/[a-z]+/g, token => greek[token] || token).replace(/[^a-z0-9]/g, '');
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
