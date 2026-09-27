import {forecastPeriods,number} from './core.mjs';
const $=id=>document.getElementById(id);
const time=t=>new Date(t).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'});
const stamp=t=>new Date(t).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'});
const set=(id,v)=>{$(id).textContent=v;};
export function initOperations({map,street,json,getStations}) {
  let satellite,radar,coverage,frames=[],host='',frameIndex=0,playing=null,pointLayer;
  let districtRows=[],districtFetched=0,radarLoaded=0,weatherAt=0,forecastIndex=-1;
  if(map) {
    satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'});
    satellite.on('tileerror',()=>{if(map.hasLayer(satellite)){chooseBase(false);set('mapNotice','ภาพดาวเทียมโหลดไม่สำเร็จ · ใช้แผนที่ถนน');}});
    pointLayer=L.layerGroup();
    L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  }
  function chooseBase(useSatellite) {
    if(!map)return;
    map.removeLayer(useSatellite?street:satellite); (useSatellite?satellite:street).addTo(map);
    $('satelliteMap').classList.toggle('active',useSatellite);$('streetMap').classList.toggle('active',!useSatellite);
  }
  $('streetMap').addEventListener('click',()=>chooseBase(false));
  $('satelliteMap').addEventListener('click',()=>chooseBase(true));
  chooseBase(true);
  $('sourceButton').addEventListener('click',()=>{$('sources').open=true;$('sources').scrollIntoView({behavior:'smooth'});});
  $('showCameras').addEventListener('click',()=>{$('cameras').scrollIntoView({behavior:'smooth'});});
  $('fullscreenMap').addEventListener('click',async()=>{try {if(document.fullscreenElement) await document.exitFullscreen();else await document.querySelector('.map-panel').requestFullscreen();}catch{set('mapNotice','เบราว์เซอร์นี้ไม่รองรับโหมดเต็มจอ');}});
  document.addEventListener('fullscreenchange',()=>{setTimeout(()=>map?.invalidateSize(),100);});
  function stop(){if(playing)clearInterval(playing);playing=null;$('radarPlay').textContent='▶ เล่น';}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  function renderRadar(index) {
    if(!map || !frames[index])return;
    frameIndex=index;const f=frames[index];$('radarSlider').value=String(index);
    set('radarFrameTime',time(f.time*1000));
    const age=Date.now()-f.time*1000;
    set('radarTime',$('radarToggle').checked?`เฟรมเรดาร์ ${stamp(f.time*1000)}${age>30*60000?' · ภาพเก่า':''}`:'ข้อมูลกายภาพ · เรดาร์ปิดอยู่');
    if(radar)map.removeLayer(radar);
    radar=L.tileLayer(`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,{opacity:.65,maxNativeZoom:7,maxZoom:19,zIndex:300,attribution:'<a href="https://www.rainviewer.com/">RainViewer</a>'});
    radar.on('tileerror',()=>set('radarStatus','ภาพเรดาร์บางส่วนโหลดไม่ได้ · อย่าตีความพื้นที่ว่างว่าไม่มีฝน'));
    if($('radarToggle').checked)radar.addTo(map);
    for(const button of $('radarFrames').querySelectorAll('button'))button.classList.toggle('active',Number(button.dataset.frame)===index);
  }
  function toggleRadar(){if(!map)return;if($('radarToggle').checked && frames.length)renderRadar(frameIndex);else{stop();if(radar)map.removeLayer(radar);set('radarTime','ข้อมูลกายภาพ · ไม่ใช่สถานะสด');}}
  $('radarToggle').addEventListener('change',toggleRadar);
  $('showRadar').addEventListener('click',()=>{$('radarToggle').checked=!$('radarToggle').checked;toggleRadar();});
  $('coverageToggle').addEventListener('change',()=>{if(!map||!host)return;if(coverage)map.removeLayer(coverage);if($('coverageToggle').checked){coverage=L.tileLayer(`${host}/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png`,{opacity:.55,maxNativeZoom:7,maxZoom:19,zIndex:310,attribution:'RainViewer coverage'}).addTo(map);set('mapNotice','บริเวณสีดำของชั้น coverage คือพื้นที่ไม่มีเรดาร์จากผู้ให้บริการ');}});
  $('radarSlider').addEventListener('input',()=>{stop();renderRadar(Number($('radarSlider').value));});
  $('radarPlay').addEventListener('click',()=>{if(playing){stop();return;}if(!frames.length)return;$('radarToggle').checked=true;$('radarPlay').textContent='❚❚ หยุด';playing=setInterval(()=>renderRadar((frameIndex+1)%frames.length),1200);});
  function clearRadar(message){stop();frames=[];if(radar&&map)map.removeLayer(radar);$('radarFrames').replaceChildren();const box=document.createElement('div');box.className='empty-state';box.textContent=message;$('radarFrames').append(box);set('radarStatus',message);set('radarTime','ไม่มีเฟรมเรดาร์ที่ใช้ได้');$('radarPlay').disabled=true;$('radarSlider').disabled=true;}
  async function loadRadar(){
    try {
      const data=await json('https://api.rainviewer.com/public/weather-maps.json');
      if(data.host!=='https://tilecache.rainviewer.com')throw new Error('host');
      const now=Date.now();const next=data.radar?.past?.filter(f=>Number.isFinite(f.time)&&f.time*1000<=now+60000&&now-f.time*1000<3*3600000&&/^\/v2\/radar\/[a-zA-Z0-9_-]+$/.test(f.path)).sort((a,b)=>a.time-b.time);
      if(!next?.length)throw new Error('frames');
      stop();host=data.host;frames=next;radarLoaded=now;
      $('radarSlider').max=String(frames.length-1);$('radarSlider').disabled=false;$('radarPlay').disabled=false;$('radarFrames').replaceChildren();
      const indexes=[...new Set([0,Math.floor((frames.length-1)/4),Math.floor((frames.length-1)/2),Math.floor((frames.length-1)*3/4),frames.length-1])];
      for(const i of indexes){const f=frames[i],button=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');button.dataset.frame=String(i);button.setAttribute('aria-label',`ดูเรดาร์เวลา ${time(f.time*1000)}`);img.src=`${host}${f.path}/256/7/13.7563/100.5018/2/1_1.png`;img.alt=`เฟรมเรดาร์ ${time(f.time*1000)}`;img.addEventListener('error',()=>{img.hidden=true;label.textContent=`${time(f.time*1000)} · โหลดภาพไม่ได้`;});label.textContent=time(f.time*1000);button.append(img,label);button.addEventListener('click',()=>{stop();$('radarToggle').checked=true;renderRadar(i);});$('radarFrames').append(button);}
      renderRadar(frames.length-1);set('radarStatus',`${frames.length} เฟรม · ดึง ${stamp(now)} · ${now-frames.at(-1).time*1000>30*60000?'เฟรมล่าสุดเกิน 30 นาที':'เวลาเฟรมไม่ใช่เวลาตรวจวัดของทุกเรดาร์'}`);
    }catch{clearRadar('ยังไม่มีเฟรมเรดาร์ที่ใช้ได้ · เปิดเรดาร์ กทม. จากลิงก์ด้านล่าง');}
  }
  const amount=r=>forecastIndex<0?r.periods.reduce((s,p)=>s+p.value,0):r.periods[forecastIndex].value;
  function drawPoints(){if(!map)return;pointLayer.clearLayers();for(const r of districtRows){if(!r.periods)continue;L.circleMarker([r.station.lat,r.station.lon],{radius:9,color:'#78e5ff',weight:2,fillColor:'#047ba9',fillOpacity:.9}).bindTooltip(`${r.district}: ${amount(r).toFixed(1)} มม. (${forecastIndex<0?'3 ช่วงชั่วโมง':'ชั่วโมง '+(forecastIndex+1)})`,{permanent:true,direction:'top',className:'rain-point'}).addTo(pointLayer);}if($('forecastToggle').checked)pointLayer.addTo(map);}
  for(const button of document.querySelectorAll('[data-period]'))button.addEventListener('click',()=>{forecastIndex=Number(button.dataset.period);document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));set('districtRainHeading',forecastIndex<0?'ฝนรวม':`ช่วง ${forecastIndex+1}`);renderDistricts();});
  $('forecastToggle').addEventListener('change',()=>{if(!map)return;if($('forecastToggle').checked)drawPoints();else map.removeLayer(pointLayer);});
  function renderDistricts(){
    $('districtForecast').replaceChildren();for(const r of districtRows){const tr=document.createElement('tr'),where=document.createElement('td'),rain=document.createElement('td'),risk=document.createElement('td'),button=document.createElement('button'),small=document.createElement('small');button.textContent=r.district.replace(/^เขต/,'');small.textContent=r.station.gp_name;button.title=`พยากรณ์ที่ ${r.station.lat}, ${r.station.lon}`;button.addEventListener('click',()=>{map?.setView([r.station.lat,r.station.lon],12);$('forecastToggle').checked=true;drawPoints();});where.append(button,small);rain.textContent=r.periods?`${amount(r).toFixed(1)} มม.`:'ไม่มีข้อมูล';if(r.periods&&forecastIndex>=0)rain.title=`${time(r.periods[forecastIndex].time-3600000)}–${time(r.periods[forecastIndex].time)}`;const tag=document.createElement('span');tag.className='pending';tag.textContent='ประเมินไม่ได้';risk.append(tag);tr.append(where,rain,risk);$('districtForecast').append(tr);}
    drawPoints();
  }
  async function loadDistricts(){
    const areas=['เขตลาดกระบัง','เขตประเวศ','เขตสวนหลวง','เขตบางนา','เขตมีนบุรี'];
    const source=getStations();const chosen=areas.map(district=>({district,station:source.find(s=>s.district===district)})).filter(r=>r.station);
    if(!chosen.length){set('districtForecastMeta','ยังไม่มีพิกัดอ้างอิงที่ตรวจสอบได้');return;}
    districtRows=chosen;
    try{const params=new URLSearchParams({latitude:chosen.map(r=>r.station.lat).join(','),longitude:chosen.map(r=>r.station.lon).join(','),hourly:'precipitation',forecast_days:'2',timezone:'Asia/Bangkok'});const data=await json('https://api.open-meteo.com/v1/forecast?'+params);const results=Array.isArray(data)?data:[data];districtFetched=Date.now();districtRows=chosen.map((r,i)=>{try{return {...r,periods:forecastPeriods(results[i])};}catch{return r;}});set('districtForecastMeta',`ค่าที่จุดสถานี ไม่ใช่ค่าเฉลี่ยเขต · Open-Meteo · ดึง ${stamp(districtFetched)}`);}
    catch{set('districtForecastMeta','เชื่อมพยากรณ์รายจุดไม่ได้ · ไม่ได้แทนด้วยค่าศูนย์');}
    renderDistricts();
    const valid=districtRows.find(r=>r.periods)?.periods;
    if(valid)set('districtForecastMeta',`ช่วง ${stamp(valid[0].time-3600000)}–${time(valid.at(-1).time)} · จุดสถานี ไม่ใช่ค่าเฉลี่ยเขต · Open-Meteo · ดึง ${time(districtFetched)}`);
  }
  async function loadWeather(){try{const data=await json('https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=Asia%2FBangkok');const c=data.current,u=data.current_units,at=Date.parse(c?.time+'Z')-number(data.utc_offset_seconds)*1000;if(!c||!Number.isFinite(at)||Date.now()-at>90*60000||at>Date.now()+60000||u?.temperature_2m!=='°C'||u?.relative_humidity_2m!=='%'||u?.wind_speed_10m!=='km/h'||[c.temperature_2m,c.relative_humidity_2m,c.wind_speed_10m].some(v=>number(v)===null))throw new Error('invalid');weatherAt=at;set('weatherNow',`${c.temperature_2m}°C · ${c.relative_humidity_2m}% · ลม ${c.wind_speed_10m} km/h`);$('weatherNow').title=`Open-Meteo แบบจำลอง เวลา ${stamp(at)}`;}catch{weatherAt=0;set('weatherNow','ยังไม่มีข้อมูลที่ใช้ได้');}}
  return {async refresh(){await Promise.allSettled([loadRadar(),loadDistricts(),loadWeather()]);},tick(){if(radarLoaded&&Date.now()-radarLoaded>15*60000){radarLoaded=0;clearRadar('ข้อมูลเรดาร์ยังไม่อัปเดตเกิน 15 นาที');}if(districtFetched&&Date.now()-districtFetched>15*60000){districtFetched=0;districtRows=districtRows.map(({periods,...r})=>r);renderDistricts();set('districtForecastMeta','ข้อมูลหมดอายุ · รอรอบโหลดใหม่');}if(weatherAt&&Date.now()-weatherAt>90*60000){weatherAt=0;set('weatherNow','ข้อมูลสภาพอากาศหมดอายุ');}}};
}
