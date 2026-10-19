import fs from 'fs';
const strip = s => s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
function table(html, id){
  const m = html.match(new RegExp(`<table[^>]*id="${id}"[\\s\\S]*?</table>`));
  const t = m[0];
  const rows = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => strip(c[1])));
  return rows;
}
const elem = table(fs.readFileSync('elem.html','utf8'),'sat_elem');
fs.writeFileSync('elem.json', JSON.stringify(elem));
console.log(elem.length); console.log(elem.slice(0,4).map(r=>r.join(' | ')).join('\n'));
const cnt={}; for(const r of elem.slice(1)) cnt[r[1]+' '+r[5]]=(cnt[r[1]+' '+r[5]]||0)+1; console.log(cnt);
console.log(elem.filter(r=>/Saturn/.test(r[1])).slice(0,12).map(r=>r.join(' | ')).join('\n'));
const ph = fs.readFileSync('phys.html','utf8');
console.log([...ph.matchAll(/<table[^>]*>/g)].map(m=>m[0]));
