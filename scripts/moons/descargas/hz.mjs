import fs from 'fs';
const e=JSON.parse(fs.readFileSync('elem.json')).filter(r=>r[1]=='Jupiter'||r[1]=='Saturn');
const out = fs.existsSync('hz.json') ? JSON.parse(fs.readFileSync('hz.json')) : {};
const TL="2451545.0,2461327.5,2461357.5,2461692.5";
for (const r of e) {
  const code=r[3]; if (out[code]) continue;
  const center = r[1]=='Jupiter' ? '500@599' : '500@699';
  const url=`https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='${code}'&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=VECTORS&CENTER='${center}'&REF_PLANE=FRAME&VEC_TABLE=1&CSV_FORMAT=YES&TLIST='${TL}'&TLIST_TYPE=JD&OUT_UNITS=KM-S`;
  for (let k=0;k<4;k++) { try {
    const t = await (await fetch(url)).text();
    const body = t.split('$$SOE')[1]?.split('$$EOE')[0];
    if (!body) { out[code]={error:t.slice(0,300)}; break; }
    out[code]=body.trim().split('\n').map(l=>l.split(',').map(s=>s.trim())).map(c=>[+c[0],+c[2],+c[3],+c[4]]);
    break;
  } catch(err) { await new Promise(r=>setTimeout(r,2000*(k+1))); } }
  fs.writeFileSync('hz.json',JSON.stringify(out));
  await new Promise(r=>setTimeout(r,150));
}
console.log('done',Object.keys(out).length);
