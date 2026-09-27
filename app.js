import {initOperations} from './operations.js';
import {renderWaterHistory} from './history.js';
import {REFRESH_MS, stations, forecastPeriods, observation, advice} from './core.mjs';
const $ = id => document.getElementById(id);
const text = (id, value) => { $(id).textContent = value; };
const fmt = time => new Date(time).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'});
const hour = time => new Date(time).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'});
const escape = value => String(value ?? 'ไม่ระบุ').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GIS = 'https://gis-portal.disaster.go.th/arcgis/rest/services/Map116/DPM_BMA_waterflow_stations_DSS/FeatureServer/2/query?where=1%3D1&outFields=gp_id,gp_name,gp_type,district,gp_lat,gp_long,gp_total_capacity,gp_water_control,gp_warning,gp_critical&returnGeometry=false&resultRecordCount=2000&f=json';
const WEATHER = 'https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&hourly=precipitation&forecast_days=2&timezone=Asia%2FBangkok';
let allStations = [], markers = new Map(), map, layer, street, busy = false, nextRefresh = Date.now(), telemetryUrl = null, configError = false;
let latestForecast = null, latestObservations = null, forecastFetched = 0, stationFetched = null;
async function json(url) {
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),15000);
  try { const response = await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit'}); if(!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); }
  finally { clearTimeout(timer); }
}
if (window.L) {
  map = L.map('map',{preferCanvas:true}).setView([13.7563,100.5018],11);
  street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map).on('tileerror',()=>text('mapNotice','แผนที่พื้นหลังบางส่วนโหลดไม่ได้ ยังดูข้อมูลจากรายชื่อสถานีได้'));
  layer = L.layerGroup().addTo(map);
} else { text('map','โหลดแผนที่ไม่ได้ กรุณาตรวจการเชื่อมต่อ แล้วรีโหลดหน้าเว็บ'); }
const operations = initOperations({map,street,json,getStations:()=>allStations});
function details(r) {
  return `<b>${escape(r.gp_name)}</b><p>${escape(r.gp_type)} · ${escape(r.district)}</p><p>กำลังสูบตามต้นทาง: ${escape(r.gp_total_capacity)}</p><p>ระดับควบคุม: ${escape(r.gp_water_control)} · เตือน: ${escape(r.gp_warning)} · วิกฤต: ${escape(r.gp_critical)}</p><small>ค่ากายภาพตามต้นทาง หน่วย/ฐานระดับต้องยืนยันก่อนเปรียบเทียบ ไม่ใช่ระดับน้ำหรือสถานะเดินเครื่องปัจจุบัน</small>`;
}
function selectStation(r) { $('stationDetail').innerHTML = details(r); if(map) { map.setView([r.lat,r.lon],14); markers.get(r)?.openPopup(); } }
function filterStations() {
  const query = $('search').value.trim().toLocaleLowerCase(), district = $('district').value;
  const rows = allStations.filter(r=>(String(r.gp_name).includes('อุโมงค์')?$('tunnelToggle').checked:r.gate?$('gates').checked:$('pumps').checked) && (!district || r.district === district) && `${r.gp_name} ${r.district}`.toLocaleLowerCase().includes(query));
  layer?.clearLayers(); markers.clear();
  for(const r of rows) { if(!map) break; const color = String(r.gp_name).includes('อุโมงค์')?'#ce77ff':r.gate?'#ffbb67':'#23ae95'; const marker = L.circleMarker([r.lat,r.lon],{radius:5,weight:1.5,color:'#103d47',fillColor:color,fillOpacity:.9}).addTo(layer).bindPopup(details(r)).on('click',()=>{$('stationDetail').innerHTML = details(r);}); markers.set(r,marker); }
  text('filterCount',`พบ ${rows.length} จาก ${allStations.length} จุด`);
  $('stationList').replaceChildren();
  for(const r of rows.slice(0,80)) { const button=document.createElement('button'); button.textContent=r.gp_name; button.addEventListener('click',()=>selectStation(r)); $('stationList').append(button); }
  if(rows.length>80) { const p=document.createElement('p'); p.className='muted'; p.textContent='รายชื่อแสดง 80 จุดแรก · ค้นหาหรือเลือกเขตเพื่อเจาะจง'; $('stationList').append(p); }
  if(!rows.length) text('stationList','ไม่พบสถานีที่ตรงเงื่อนไข');
}
function setStations(rows, meta) {
  const normalized = stations(rows); if(!normalized.length) throw new Error('ไม่มีพิกัดที่ใช้ได้');
  allStations = normalized; text('infrastructureReady',`${normalized.length} จุด / ${rows.length} รายการ`);
  const selected = $('district').value;
  $('district').replaceChildren(new Option('ทุกเขต',''));
  [...new Set(allStations.map(r=>r.district).filter(Boolean))].sort().forEach(d=>$('district').add(new Option(d,d)));
  if([...$('district').options].some(o=>o.value===selected)) $('district').value=selected;
  text('stationCount',`${allStations.length} จุด`); text('stationSummary',`ประตู ${allStations.filter(r=>r.gate).length} · สูบ/รับน้ำ ${allStations.filter(r=>!r.gate).length}`);
  text('stationStatus',`${meta} · ต้นทาง ${rows.length} รายการ / แสดง ${normalized.length} รายการที่มีพิกัดใช้ได้`); filterStations();
}
async function loadStations() {
  try { const data=await json(GIS); if(data.error || data.exceededTransferLimit || !Array.isArray(data.features)) throw new Error('ข้อมูลไม่ครบ'); const fetched=Date.now(); setStations(data.features.map(f=>f.attributes),`โหลดจาก GIS ปภ. ${fmt(fetched)} · ข้อมูลกายภาพ ไม่ใช่สถานะสด`); stationFetched=fetched; }
  catch { if(allStations.length) { text('stationStatus',`เชื่อมต้นทางไม่สำเร็จ · ใช้ข้อมูลที่ดึงเมื่อ ${fmt(stationFetched)} · ไม่ใช่สถานะสด`); return; }
    try { const data=await json('./stations.json'); if(!Number.isFinite(Date.parse(data.retrievedAt))) throw new Error('ไม่มีวันอ้างอิง'); setStations(data.records,`สำเนาจาก GIS ปภ. ดึงเมื่อ ${fmt(data.retrievedAt)} · เชื่อมต้นทางไม่ได้ · ไม่ใช่สถานะสด`); stationFetched=data.retrievedAt; }
    catch { text('stationCount','ไม่มีข้อมูล'); text('stationStatus','โหลดข้อมูลสถานีไม่ได้'); text('stationList','ไม่สามารถอ่านข้อมูลสถานีได้'); text('filterCount','ไม่มีข้อมูล'); }
  }
}
function emptyForecast(message) { latestForecast=null; text('forecastValue','ไม่มีข้อมูล'); text('forecastChart','ยังไม่มีข้อมูลพยากรณ์ที่ใช้ได้'); $('forecastChart').setAttribute('aria-label','ไม่มีข้อมูลพยากรณ์'); $('forecastTable').replaceChildren(); text('forecastMeta',''); text('forecastStatus',message); text('advice',advice(null)); }
function renderForecast(rows) {
  const max=Math.max(1,...rows.map(r=>r.value)), sum=rows.reduce((a,r)=>a+r.value,0);
  text('forecastValue',`${sum.toFixed(1)} มม.`);
  const bars=rows.map((r,i)=>{const height=r.value/max*105,x=40+i*80; return `<rect x="${x}" y="${145-height}" width="42" height="${height}" rx="3" fill="#5de4c0"/><text x="${x+21}" y="${133-height}" text-anchor="middle">${r.value.toFixed(1)}</text><text x="${x+21}" y="168" text-anchor="middle">${hour(r.time)}</text>`;}).join('');
  $('forecastChart').innerHTML=`<svg viewBox="0 0 300 185" aria-hidden="true"><text x="12" y="18">มม. / ชั่วโมง</text><path d="M20 145H285" stroke="#5b7884"/>${bars}</svg>`;
  $('forecastChart').setAttribute('aria-label',rows.map(r=>`${hour(r.time)} ฝน ${r.value} มิลลิเมตร`).join(', '));
  $('forecastTable').innerHTML=`<table><caption>ฝนสะสมแต่ละช่วงชั่วโมง (เวลาไทย)</caption><thead><tr><th>ช่วงเวลา</th><th>มม.</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${hour(r.time-3600000)}–${hour(r.time)}</td><td>${r.value.toFixed(1)}</td></tr>`).join('')}</tbody></table>`;
  text('forecastMeta',`ช่วง ${fmt(rows[0].time-3600000)} ถึง ${fmt(rows[2].time)} · ดึง ${fmt(forecastFetched)}`); text('advice',advice(rows));
}
async function loadForecast() {
  try { const data=await json(WEATHER), rows=forecastPeriods(data); latestForecast=data; forecastFetched=Date.now(); renderForecast(rows); text('forecastStatus',`รับข้อมูล ${fmt(forecastFetched)} · พยากรณ์แบบจำลอง ไม่ใช่ค่าตรวจวัด`); }
  catch { emptyForecast('รับพยากรณ์ไม่ได้ หรือไม่มีข้อมูลครบช่วงปัจจุบัน'); }
}
function renderObservations() {
  renderWaterHistory(latestObservations);
  for(const [kind,valueId,metaId] of [['waterLevel','waterValue','waterMeta'],['rainfall','rainValue','rainMeta']]) {
    const row=observation(latestObservations?.[kind],kind);
    if(!row) {text(valueId,'รอข้อมูลจริง'); text(metaId,'ไม่มีค่าที่ตรวจสอบได้'); continue;}
    text(valueId,`${row.value} ${kind==='rainfall'?'มม.':'ม.'}${row.stale?' (เก่า)':''}`);
    text(metaId,`${row.station} · ${fmt(row.time)} · ${row.source} · ${kind==='rainfall'?`สะสม ${row.periodMinutes} นาที`:`ฐาน ${row.datum}`}`);
  }
}
async function loadTelemetry() {
  if(!telemetryUrl) {text('telemetryStatus',configError?'อ่านการตั้งค่าไม่ได้ · ยังไม่เชื่อมข้อมูลตรวจวัด':'ยังไม่มี endpoint ที่ยืนยันแล้ว · ไม่ใช้ค่าพยากรณ์แทนค่าตรวจวัด'); return;}
  try {latestObservations=await json(telemetryUrl); const usable=['waterLevel','rainfall'].map(k=>observation(latestObservations[k],k)).filter(Boolean); text('telemetryStatus',usable.length?`รับข้อมูลตรวจวัดที่ผ่านการตรวจรูปแบบ ${usable.length}/2 ประเภท · ${usable.some(r=>r.stale)?'มีข้อมูลเกิน 15 นาที':'ตรวจเวลาแล้ว'}`:'ข้อมูลไม่ผ่านการตรวจรูปแบบ / คุณภาพ / เวลา');}
  catch {latestObservations=null; text('telemetryStatus','เชื่อมข้อมูลตรวจวัดไม่ได้');}
  renderObservations();
}
async function refresh() {
  if(busy) return; busy=true; $('refreshButton').disabled=true; text('overall','กำลังตรวจแหล่งข้อมูล');
  try {await Promise.allSettled([loadStations(),loadForecast(),loadTelemetry()]); await operations.refresh();}
  finally {busy=false; nextRefresh=Date.now()+REFRESH_MS; $('refreshButton').disabled=false; text('overall',navigator.onLine?'ตรวจข้อมูลแล้ว · ดูสถานะแต่ละแหล่งด้านล่าง':'ออฟไลน์ · ข้อมูลอาจไม่เป็นปัจจุบัน'); text('lastChecked',`ตรวจล่าสุด ${fmt(Date.now())}`);}
}
for(const id of ['search','district','pumps','gates','tunnelToggle']) $(id).addEventListener(id==='search'?'input':'change',filterStations);
$('resetView').addEventListener('click',()=>{$('search').value='';$('district').value='';$('pumps').checked=true;$('gates').checked=true;$('tunnelToggle').checked=true;filterStations();map?.setView([13.7563,100.5018],11);});
$('refreshButton').addEventListener('click',refresh);
function tick() {operations.tick();text('clock',new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'medium'})+' (เวลาไทย)'); text('countdown',busy?'กำลังโหลด…':`ตรวจใหม่ใน ${Math.max(0,Math.ceil((nextRefresh-Date.now())/1000))} วินาที`); if(latestForecast) {try {const rows=forecastPeriods(latestForecast); if(Date.now()-forecastFetched>15*60000) throw new Error('stale'); renderForecast(rows);} catch {emptyForecast('พยากรณ์หมดช่วงเวลาหรือเกิน 15 นาที · รอโหลดใหม่');}} if(latestObservations) renderObservations(); if(!busy && Date.now()>=nextRefresh) refresh();}
async function start() {
  try {const cfg=await json('./config.json'); if(cfg.telemetryUrl) {const url=new URL(cfg.telemetryUrl,location.href); if(url.origin!==location.origin) throw new Error('ใช้ proxy ในโดเมนเดียวกันเท่านั้น'); telemetryUrl=url.href;}}
  catch {configError=true;}
  await refresh(); setInterval(tick,1000); document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
}
start();


