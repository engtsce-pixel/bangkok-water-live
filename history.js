import {waterHistory} from './core.mjs';
export function renderWaterHistory(data){
  const root=document.getElementById('waterHistoryChart'),rows=waterHistory(data?.waterHistory);
  root.replaceChildren();
  if(rows.length<2){const div=document.createElement('div');div.className='empty-state';div.textContent='รออนุกรมเวลาตรวจวัดจริง · ต้องมีอย่างน้อย 2 จุดจากสถานีและฐานระดับเดียวกัน';root.append(div);return;}
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 300 180');svg.setAttribute('class','water-chart-svg');svg.setAttribute('role','img');svg.setAttribute('aria-label',`ระดับน้ำ ${rows[0].station} ฐาน ${rows[0].datum}`);
  const min=Math.min(...rows.map(r=>r.value)),max=Math.max(...rows.map(r=>r.value)),span=Math.max(.2,max-min),start=rows[0].time,end=rows.at(-1).time;
  const x=r=>35+(r.time-start)/(end-start)*250,y=r=>140-(r.value-min)/span*95;
  let path='';rows.forEach((r,i)=>{path+=`${i===0||r.time-rows[i-1].time>30*60000?'M':'L'}${x(r)} ${y(r)} `;});
  const line=document.createElementNS(ns,'path');line.setAttribute('d',path);line.setAttribute('stroke','#4bcdf0');line.setAttribute('stroke-width','2');line.setAttribute('fill','none');svg.append(line);
  const label=(x,y,value)=>{const t=document.createElementNS(ns,'text');t.setAttribute('x',String(x));t.setAttribute('y',String(y));t.textContent=value;svg.append(t);};
  for(const r of rows){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(x(r)));dot.setAttribute('cy',String(y(r)));dot.setAttribute('r','2');dot.setAttribute('fill','#89e9ff');svg.append(dot);}
  label(5,18,`${rows[0].station} · ม. (${rows[0].datum})`);label(2,140,min.toFixed(2));label(2,45,(min+span).toFixed(2));
  const time=t=>new Date(t).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'});
  label(35,162,time(start));label(246,162,time(end));label(35,178,`${rows.length} ค่าจริง${rows.at(-1).stale?' · ค่าล่าสุดเกิน 15 นาที':''}`);root.append(svg);
}
