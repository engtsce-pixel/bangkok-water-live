import {rowsFor,waterPoints,levelStatus} from './observed-core.mjs';
export function initObserved({map,json}){
 const $=id=>document.getElementById(id),put=(id,t)=>{$(id).textContent=t;},fmt=t=>new Date(t).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}),esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let rows=[],selected=null,points=[],historyToken=0,lastPayload=null,lastAgeUpdate=0,active='water',fetchFailure=false;
 const layer=map&&L.layerGroup().addTo(map);
 function badge(r){const s=levelStatus(r);return `<span style="color:${s.color}">${esc(s.text)}</span>`;}
 function summary(r){return `${r.name} · ${fmt(r.time)}${Date.now()-r.time>900000?' · ข้อมูลเก่า':''}`;}
 function chart(){const root=$('waterHistoryChart');root.replaceChildren();if(points.length<2){root.textContent='ยังไม่มีค่าจริงอย่างน้อย 2 จุดใน 24 ชั่วโมง';return;}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 310 180');svg.setAttribute('role','img');svg.setAttribute('aria-label',`ระดับน้ำย้อนหลัง ${selected.name} เมตร รทก.`);
 const thresholds=[selected.warning,selected.critical].filter(v=>v!==null),min=Math.min(...points.map(p=>p.value),...thresholds)-.05,max=Math.max(...points.map(p=>p.value),...thresholds)+.05,span=Math.max(.2,max-min),start=points[0].time,end=points.at(-1).time,x=t=>38+250*(t-start)/(end-start),y=v=>140-110*(v-min)/span;
 const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text)e.textContent=text;svg.append(e);};
 let d='';points.forEach((p,i)=>{d+=`${i===0||p.time-points[i-1].time>1800000?'M':'L'}${x(p.time)} ${y(p.value)} `;});add('path',{d,stroke:'#62d8f4','stroke-width':2,fill:'none'});
 for(const [v,color]of[[selected.warning,'#ffbe63'],[selected.critical,'#ff6275']])if(v!==null)add('path',{d:`M38 ${y(v)}H290`,stroke:color,'stroke-dasharray':'5 4'});
 for(const p of points)add('circle',{cx:x(p.time),cy:y(p.value),r:1.6,fill:'#8ce6ff'});
 add('text',{x:3,y:25},(min+span).toFixed(2));add('text',{x:3,y:142},min.toFixed(2));const hour=t=>new Date(t).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'});
 add('text',{x:38,y:159},hour(start));add('text',{x:250,y:159},hour(end));add('text',{x:38,y:177},`${points.length} ค่าจริง · ม.รทก.`);root.append(svg);
 }
 async function select(r){selected=r;put('waterValue',`${r.value.toFixed(2)} ม.รทก.${Date.now()-r.time>900000?' (เก่า)':''}`);put('waterMeta',summary(r));put('waterStationMeta',`${summary(r)} · ${r.agency} ผ่าน ThaiWater`);$('waterStation').value=r.id;points=[];put('waterHistoryChart','กำลังโหลดประวัติจริง…');const token=++historyToken;
 try{const d=await json(`/api/history?type=${r.kind==='canal'?'canal':'tele_waterlevel'}&station=${r.stationId}`);if(token!==historyToken)return;points=waterPoints(d.data);chart();}catch{if(token===historyToken)put('waterHistoryChart','โหลดประวัติไม่สำเร็จ · ไม่มีการเติมค่าทดแทน');}
 }
 function popup(r){return `<b>${esc(r.name)}</b><p>${r.value.toFixed(2)} ${esc(r.unit)}</p><p>${esc(summary(r))}</p>${badge(r)}<p>${esc(r.agency)} ผ่าน ThaiWater</p><small>ค่าที่ต้นทางเผยแพร่ ไม่ใช่ผลรับรองคุณภาพอิสระ</small>`;}
 function render(){
 layer?.clearLayers();for(const r of rows){const enabled=(r.kind==='water'||r.kind==='canal')?$('waterToggle').checked:r.kind==='rain'?$('rainToggle').checked:r.kind==='flow'?$('flowToggle').checked:$('roadToggle').checked;if(!enabled||!map)continue;
 const stale=Date.now()-r.time>900000,color=stale?'#8d9aa6':r.kind==='rain'?'#65b8ff':r.kind==='flow'?'#b68aff':r.kind==='road'?'#ffad63':levelStatus(r).color;
 const marker=L.circleMarker([r.lat,r.lon],{radius:7,weight:2,color:'#fff',fillColor:color,fillOpacity:.9}).addTo(layer);
 if(r.kind==='road')marker.bindPopup(`<b>${esc(r.name)}</b><p>${r.value>0?'ต้นทางรายงานค่ามากกว่า 0':'ต้นทางรายงาน 0'}</p><p>${esc(summary(r))}</p><small>ยังไม่ยืนยันหน่วย จึงไม่แปลงเป็นความลึก · ไม่ใช่การยืนยันว่าถนนปลอดภัย</small>`);
 else marker.bindPopup(popup(r));if(['water','canal'].includes(r.kind))marker.on('click',()=>select(r));
 }
 const query=$('observedSearch').value.trim().toLocaleLowerCase(),filtered=rows.filter(r=>(active==='water'?['water','canal'].includes(r.kind):r.kind===active)&&`${r.name} ${r.district}`.toLocaleLowerCase().includes(query));
 const body=$('observedRows');body.replaceChildren();for(const r of filtered){const tr=document.createElement('tr'),name=document.createElement('td'),button=document.createElement('button');button.className='text-button';button.textContent=r.name;button.onclick=()=>{map?.setView([r.lat,r.lon],14);if(['water','canal'].includes(r.kind))select(r);};name.append(button);tr.append(name);
 const value=r.kind==='road'?(r.value>0?'ค่าต้นทาง > 0':'ค่าต้นทาง = 0'):`${r.value.toFixed(2)} ${r.unit==='m MSL'?'ม.รทก.':r.unit==='mm/24h'?'มม./24 ชม.':r.unit}`;
 for(const t of[r.district,value,fmt(r.time),r.agency]){const td=document.createElement('td');td.textContent=t;tr.append(td);}const td=document.createElement('td');td.innerHTML=badge(r);tr.append(td);body.append(tr);}
 if(!filtered.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='ไม่มีข้อมูลที่ผ่านการตรวจเวลาและรูปแบบใน 24 ชั่วโมง';tr.append(td);body.append(tr);}
 put('observedCount',`${filtered.length} จุด · สีเทา = เกิน 15 นาที · ไม่แสดงค่าที่เกิน 24 ชั่วโมง`);
 const recent=rows.filter(r=>Date.now()-r.time<=900000),alerts=recent.filter(r=>['water','canal'].includes(r.kind)&&levelStatus(r).color==='#ff6275');put('alertValue',recent.some(r=>['water','canal'].includes(r.kind))?`${alerts.length} จุด`:'ไม่มีข้อมูลใหม่');put('alertMeta',`ถึงเกณฑ์วิกฤต/ล้นตลิ่งจากต้นทาง · จาก ${recent.filter(r=>['water','canal'].includes(r.kind)).length} จุดที่ไม่เกิน 15 นาที`);
 put('measuredAdvice',alerts.length?`มี ${alerts.length} จุดถึงเกณฑ์วิกฤตหรือมีสถานะน้ำล้นตลิ่งจากต้นทาง เช่น ${alerts.slice(0,2).map(r=>r.name).join(', ')} ให้ติดตามประกาศ กทม. และหลีกเลี่ยงพื้นที่ที่มีประกาศปิดทาง`:'ตรวจรายการระดับน้ำและเวลาของแต่ละสถานีควบคู่กับประกาศหน่วยงาน ข้อมูลไม่ครบไม่ได้หมายถึงไม่มีน้ำท่วม');
 put('telemetryReady',`${rows.filter(r=>['water','canal'].includes(r.kind)).length} จุดระดับน้ำ`);
 const rain=rows.filter(r=>r.kind==='rain').sort((a,b)=>b.time-a.time||b.value-a.value)[0],flow=rows.filter(r=>r.kind==='flow')[0];
 for(const [r,value,meta,unit]of[[rain,'rainValue','rainMeta','มม./24 ชม.'],[flow,'flowValue','flowMeta','ม³/วินาที']]){put(value,r?`${r.value.toFixed(1)} ${unit}${Date.now()-r.time>900000?' (เก่า)':''}`:'ไม่มีข้อมูล');put(meta,r?summary(r):'แหล่งข้อมูลไม่พร้อม');}
 if(selected){const updated=rows.find(r=>r.id===selected.id);if(updated){selected=updated;put('waterValue',`${updated.value.toFixed(2)} ม.รทก.${Date.now()-updated.time>900000?' (เก่า)':''}`);put('waterMeta',summary(updated));}else{selected=null;++historyToken;points=[];put('waterValue','ไม่มีข้อมูล');put('waterMeta','สถานีที่เลือกไม่มีค่าที่ใช้ได้');put('waterHistoryChart','ไม่มีประวัติของสถานีที่เลือก');put('waterStationMeta','ไม่มีค่าปัจจุบันของสถานีที่เลือก');}}
 }
 async function refresh(){
 try{lastPayload=await json('/api/live');fetchFailure=false;const errors=[];rows=[];for(const[k,v]of Object.entries(lastPayload.feeds||{})){try{if(v.error)throw Error();rows.push(...rowsFor(v.data,k));}catch{errors.push(k);}}
 const choices=rows.filter(r=>['water','canal'].includes(r.kind));$('waterStation').replaceChildren(...choices.map(r=>new Option(`${r.name} · ${r.kind==='canal'?'กทม.':'สถานีโทรมาตร'}`,r.id)));render();const chosen=choices.find(r=>r.id===selected?.id)||choices.find(r=>r.kind==='water')||choices[0];if(chosen)await select(chosen);else{put('waterValue','ไม่มีข้อมูล');put('waterMeta','ไม่มีระดับน้ำที่ใช้ได้');}
 put('telemetryStatus',`ThaiWater API · รับ ${rows.length} จุดในกรุงเทพฯ · ตรวจ ${fmt(Date.now())}${errors.length?' · บางแหล่งขัดข้อง: '+errors.join(', '):''} · ค่าที่ต้นทางเผยแพร่ ไม่มีธงรับรองคุณภาพรายจุด`);
 }catch{rows=[];lastPayload=null;fetchFailure=true;render();put('telemetryStatus','เชื่อม ThaiWater ไม่ได้ · ล้างค่าที่แสดง ไม่แทนด้วยศูนย์');}
 }
 async function cameras(){try{const d=await json('/api/cameras');for(const c of d.items||[]){const image=$('camera'+c.id),status=$('cameraStatus'+c.id);if(!image||!status)continue;if(!c.ok){image.hidden=true;status.textContent='ต้นทางไม่ตอบสนอง';continue;}const modified=Date.parse(c.modified),old=Number.isFinite(modified)&&Date.now()-modified>900000;status.textContent=Number.isFinite(modified)?`${old?'ภาพเก่า · ':''}ไฟล์แก้ไข ${fmt(modified)}`:'ไม่ทราบเวลาภาพ · ตรวจเวลาประทับในภาพ';image.hidden=false;image.onerror=()=>{image.hidden=true;status.textContent='โหลดภาพไม่ได้ · เปิดต้นทาง';};image.src=c.url+'?v='+Math.floor(Date.now()/300000);}}catch{for(const n of[1,2]){put('cameraStatus'+n,'ตรวจเวลาภาพไม่ได้ · เปิดต้นทาง');$('camera'+n).hidden=true;}}}
 $('waterStation').onchange=()=>{const r=rows.find(r=>r.id===$('waterStation').value);if(r)select(r);};
 for(const id of['waterToggle','rainToggle','flowToggle','roadToggle'])$(id).onchange=render;$('observedSearch').oninput=render;
 document.querySelectorAll('[data-observed]').forEach(b=>b.onclick=()=>{active=b.dataset.observed;document.querySelectorAll('[data-observed]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));render();});
 return {refresh:()=>Promise.allSettled([refresh(),cameras()]),tick(){if(Date.now()-lastAgeUpdate<60000)return;lastAgeUpdate=Date.now();if(lastPayload&&!fetchFailure){rows=rows.filter(r=>Date.now()-r.time<=86400000);render();}}};
}
