import fs from 'fs';
const e=JSON.parse(fs.readFileSync('elem.json')).filter(r=>(r[1]=='Jupiter'||r[1]=='Saturn') && (+r[7] > 1.4e6));
const OUT='osc.json'; const out=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT)):{};
for(const r of e){ const code=r[3]; if(out[code]) continue;
  const center=r[1]=='Jupiter'?'500@599':'500@699';
  const url=`https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='${code}'&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=ELEMENTS&CENTER='${center}'&REF_PLANE=FRAME&CSV_FORMAT=YES&START_TIME='2026-09-01'&STOP_TIME='2030-01-01'&STEP_SIZE='60 d'&OUT_UNITS=KM-S`;
  for(let k=0;k<4;k++){ try{ const t=await (await fetch(url)).text(); const b=t.split('$$SOE')[1]?.split('$$EOE')[0];
    if(!b){out[code]={error:t.slice(0,200)};break;}
    out[code]=b.trim().split('\n').map(l=>l.split(',').map(s=>s.trim())).map(c=>[+c[0],+c[2],+c[4],+c[5],+c[6],+c[8]*86400,+c[9],+c[11]]); break;
  }catch(err){await new Promise(r=>setTimeout(r,2000*(k+1)));} }
  fs.writeFileSync(OUT,JSON.stringify(out)); await new Promise(r=>setTimeout(r,120));
}
console.log('done',Object.keys(out).length, e.length);
