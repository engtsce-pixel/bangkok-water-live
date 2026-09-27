const BASE='https://api-v3.thaiwater.net/api/v1/thaiwater30/public/';
const FEEDS={water:'waterlevel_load',canal:'canal_waterlevel',rain:'rain_24h?province_code=10,11,12,13,73,74',flow:'flow'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function upstream(path,ctx){
 const url=BASE+path,key=new Request(url),cache=globalThis.caches?.default,cached=await cache?.match(key);if(cached)return cached.json();
 const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Upstream '+r.status);let data=await r.json();
 if(data.result!=='OK'&&data.waterlevel_data?.result!=='OK')throw Error('Upstream result');
 if(path==='waterlevel_load')data={waterlevel_data:{result:data.waterlevel_data.result,data:data.waterlevel_data.data.filter(r=>String(r.geocode?.province_code)==='10')}};
 else if(Object.values(FEEDS).includes(path))data={result:data.result,data:data.data.filter(r=>String(r.geocode?.province_code)==='10')};
 const body={data,fetchedAt:new Date().toISOString()};if(cache)ctx.waitUntil(cache.put(key,new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}})));return body;
}
export default {async fetch(request,env,ctx){
 const u=new URL(request.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 try {
 if(u.pathname==='/api/live'){
 const entries=await Promise.all(Object.entries(FEEDS).map(async([name,path])=>{try{return [name,await upstream(path,ctx)];}catch{return [name,{error:'แหล่งข้อมูลไม่ตอบสนอง'}];}}));return json({feeds:Object.fromEntries(entries)});
 }
 if(u.pathname==='/api/roads'){
 const url='https://weather.bangkok.go.th/Flood/PageMap/GetData?id=0',key=new Request(url),cache=globalThis.caches?.default,cached=await cache?.match(key);if(cached)return cached;
 const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.dtTbl))throw Error();
 const fields=['flood_code','flood_name','flood','districtName','latitude','longitude','site_timestamp','status','sensor','duct_sensor'];
 const body=json({fetchedAt:new Date().toISOString(),rows:d.dtTbl.map(row=>Object.fromEntries(fields.map(k=>[k,row[k]??null])))});
 if(cache)ctx.waitUntil(cache.put(key,new Response(body.clone().body,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}})));return body;
 }
 if(u.pathname==='/api/history'){

 const station=u.searchParams.get('station'),type=u.searchParams.get('type');if(!/^[1-9]\d{0,8}$/.test(station||'')||!['canal','tele_waterlevel'].includes(type))return json({error:'Invalid station'},400);
 const date=t=>new Date(t+7*3600000).toISOString().slice(0,16).replace('T',' '),params=new URLSearchParams({station_type:type,station_id:station,start_date:date(Date.now()-86400000),end_date:date(Date.now())});return json(await upstream('waterlevel_graph?'+params,ctx));
 }
 if(u.pathname==='/api/pumps'){
 const groups=await Promise.all(['Pump','Station'].map(async group=>{const url=`https://weather.bangkok.go.th/${group}/Map/GetData?id=0`,key=new Request(url),cache=globalThis.caches?.default,cached=await cache?.match(key);if(cached)return cached.json();
 try{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.LastPump))throw Error();
 const fields=['pumpStation_id','pumpStation_name','pumpStation_code','district_name','latitude','longitude','pump_count','pump_capacity','site_timestamp_station','site_timestamp_station_TH','rtu_status'];
 fields.push('pump_gate_count');for(let i=1;i<=4;i++)fields.push('pump_gate0'+i);for(let i=1;i<=6;i++)fields.push('pump_status'+i,'pump_trip_status'+i);
 const body={group,fetchedAt:new Date().toISOString(),rows:d.LastPump.map(row=>Object.fromEntries(fields.map(k=>[k,row[k]??null])))};
 if(cache)ctx.waitUntil(cache.put(key,new Response(JSON.stringify(body),{headers:{'Cache-Control':'public, max-age=300','Content-Type':'application/json'}})));return body;
 }catch{return {group,error:'เชื่อมสำนักการระบายน้ำไม่ได้',rows:[]};}}));return json({groups});
 }
 if(u.pathname==='/api/cameras'){
 const items=await Promise.all([1,2].map(async id=>{const url=`https://dds.bangkok.go.th/cctv-image/cctv${id}.jpg`;try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(8000)});return {id,url,ok:r.ok&&r.headers.get('content-type')?.startsWith('image/'),modified:r.headers.get('last-modified')};}catch{return {id,url,ok:false,modified:null};}}));return json({items});
 }
 if(u.pathname==='/api/upstream-forecast'){
 const url='https://fews2.hii.or.th/model-output/data_portal/hii_waterlevel/forecast/CPY014.txt',key=new Request(url),cache=globalThis.caches?.default,cached=await cache?.match(key);if(cached)return cached;
 const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const text=await r.text();if(!text.startsWith('station,date,time,value'))throw Error();
 const body=json({station:'CPY014',name:'สะพานนวลฉวี อ.ปากเกร็ด จ.นนทบุรี',modified:r.headers.get('last-modified'),csv:text,source:url});if(cache){const saved=new Response(body.clone().body,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}});ctx.waitUntil(cache.put(key,saved));}return body;
 }
 return json({error:'Not found'},404);
 }catch{return json({error:'แหล่งข้อมูลไม่ตอบสนอง กรุณาลองใหม่'},502);}
}};
