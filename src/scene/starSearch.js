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
// Genitivo latino por abreviatura IAU, con mayúsculas («cyg» → «Cygni», «cma» → «Canis Majoris»), para mostrar
// las designaciones de Bayer y Flamsteed como se conocen (nombresEstrella.js).
export const GENITIVOS = new Map(CONSTELACIONES.map(([abreviatura, genitivo]) => [abreviatura, genitivo.replace(/\b[a-z]/g, letra => letra.toUpperCase())]));
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
// griegas a su abreviatura, para que «Épsilon Orionis», «ε Ori» y «eps-ori» den lo mismo. El signo de las zonas de
// BD, CD y CPD se conserva como letra (p o m): «BD+07 948» y «BD-07 948» son estrellas distintas.
export function normalizeStarQuery(value) {
  return value.toLowerCase().replace(/\b(bd|cd|cpd)\s*([+\-−–])/g, (_, catalogo, signo) => `${catalogo}${signo === '+' ? 'p' : 'm'}`).replace(/[α-ω]/g, letra => ` ${greek[letra] || letra} `).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(gliese|gj)\b/g, 'gl')
    .replace(PATRON_FRASES, (_, frase) => ` ${ABREVIATURA.get(frase.replace(/\s+/g, ' '))} `)
    .replace(/[a-z]+/g, token => greek[token] || token).replace(/[^a-z0-9]/g, '');
}
// ¿Dos nombres son el mismo, salvo mayúsculas, tildes, espacios y guiones? («Dìwö» y «Diwo», «Tau Cet» y «tau Cet»).
const claveNombre = nombre => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s\-‐‑–−]+/g, '');
export const mismoNombre = (a, b) => claveNombre(a) === claveNombre(b);
// Línea de alias bajo una sugerencia: el nombre con que se encontró y otros, nunca uno igual al título.
export function lineaDeAlias(aliases, matched, cuantos = 4) {
  const titulo = aliases[0], vistos = [];
  for (const n of [matched, ...aliases]) if (n && !mismoNombre(n, titulo) && !vistos.some(v => mismoNombre(v, n))) vistos.push(n);
  return vistos.slice(0, cuantos);
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
  const exactas=matches.filter(m=>m.score===0);
  if(!exactas.length) matches.push(...porComponente(index,query,key,matches), ...porBayerConNumero(index,key,matches));
  // «Phi Cancri» da exacto con la variable FI Cnc («fi» es phi en español): las φ¹ y φ² Cnc van con ella, antes.
  else if(exactas.every(m=>esVariableCorta(m.matched))) matches.push(...porBayerConNumero(index,key,matches).map(m=>({...m,score:0})));
  // En un empate, un nombre propio o un Bayer gana a una variable de dos letras («Anser» antes que AN Ser, «Nu Dra»
  // antes que NU Dra); después, por el primer nombre.
  return matches.sort((a,b)=>a.score-b.score || esVariableCorta(a.matched)-esVariableCorta(b.matched) || a.aliases[0].localeCompare(b.aliases[0])).slice(0,limit);
}
const esVariableCorta = nombre => (/^[A-Z]{1,2} [A-Z][a-z]{2}$/.test(nombre || '') ? 1 : 0);

// «Zeta Reticuli», «Omega Scorpii»: si ninguna estrella se llama así, las componentes con número (ζ¹ y ζ² Ret), con
// puntaje 1. No se inventa la forma sin número: solo se ofrecen las que existen.
const LETRAS_GRIEGAS = new Set(Object.values(greek));
const ABREVIATURAS = new Set(CONSTELACIONES.map(([abreviatura]) => abreviatura));
function porBayerConNumero(index, key, yaEstan) {
  const m = /^([a-z]{2,3})([a-z]{3})$/.exec(key);
  if (!m || !LETRAS_GRIEGAS.has(m[1]) || !ABREVIATURAS.has(m[2])) return [];
  const conNumero = new RegExp(`^${m[1]}\\d${m[2]}$`), vistos = new Set(yaEstan.map(x => x.id));
  return index.filter(item => !vistos.has(item.id) && item.keys.some(k => conNumero.test(k)))
    .map(item => ({ ...item, score: 1, matched: item.aliases[item.keys.findIndex(k => conNumero.test(k))] }));
}

// «HD 37525Ab», «HIP 26579 B»: si ninguna estrella tiene ese nombre, se ofrece la del sistema (HD 37525).
const CATALOGO_CON_COMPONENTE = /^(hd|hip|hr|gl|sao|hic|ads)(\d+)([a-z]{1,3})$/;
function porComponente(index, query, key, yaEstan) {
  const partes = CATALOGO_CON_COMPONENTE.exec(key);
  if (!partes) return [];
  // Una sola minúscula al final es un planeta (HD 209458 b): lo busca la lista de cuerpos, no esta.
  const letras = /([a-z]+)[^a-z]*$/i.exec(query)?.[1];
  if (!letras || /^[a-z]$/.test(letras)) return [];
  const sistema = partes[1] + partes[2];
  const vistos = new Set(yaEstan.map(m => m.id));
  return index.filter(item => !vistos.has(item.id) && item.keys.includes(sistema))
    .map(item => ({ ...item, score: 0.5, matched: item.aliases[item.keys.indexOf(sistema)] }));
}
