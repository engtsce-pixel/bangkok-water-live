// Public ThaiWater observations. Source-published does not imply independent QA.
export function numeric(v) { if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return null; const n=Number(v);return Number.isFinite(n)&&![-999,9999,999999].includes(n)?n:null; }
export function thaiTime(v) { if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v))return null;const n=Date.parse(v.replace(' ','T')+'+07:00');return Number.isFinite(n)?n:null; }
export function rowsFor(payload,kind,now=Date.now()) {
 const input=kind==='water'?payload?.waterlevel_data?.data:payload?.data;if(!Array.isArray(input))throw Error('Invalid source structure');
 const fields={water:['waterlevel_msl','waterlevel_datetime','tele_station','tele_station_name','m MSL'],canal:['canal_value','canal_datetime','canal','canal_name','m MSL'],rain:['rain_24h','rainfall_datetime','tele_station','tele_station_name','mm/24h'],flow:['flow_value','flow_datetime','flow','flow_name','m³/s'],road:['floodroad_value','floodroad_datetime','floodroad','floodroad_name','source unit unconfirmed']}[kind];
 const [valueKey,timeKey,prefix,nameKey,unit]=fields;
 const seen=new Set();return input.flatMap(r=>{const s=r.station||{},value=numeric(r[valueKey]),time=thaiTime(r[timeKey]),lat=numeric(s[prefix+'_lat']),lon=numeric(s[prefix+'_long']);
 if(String(r.geocode?.province_code)!=='10'||value===null||time===null||time>now+60000||now-time>86400000||!s[nameKey]?.th||!Number.isInteger(s.id)||lat===null||lon===null||lat<13||lat>15||lon<99||lon>102||(kind==='rain'&&value<0))return [];
 const id=kind+':'+s.id;if(seen.has(id))return [];seen.add(id);
 return [{id,stationId:s.id,kind,name:s[nameKey].th,district:r.geocode?.amphoe_name?.th||'',value,time,lat,lon,unit,agency:r.agency?.agency_name?.th||'ThaiWater',stale:now-time>15*60000,warning:kind==='canal'?numeric(s.warning_level):null,critical:kind==='canal'?numeric(s.critical_level):null,bank:numeric(kind==='canal'?s.bank:s.min_bank),sourceLevel:kind==='water'&&Number.isInteger(r.situation_level)?r.situation_level:null}];
 }).sort((a,b)=>b.time-a.time||a.name.localeCompare(b.name,'th'));
}
export function waterPoints(payload,now=Date.now()) {
 if(payload?.result!=='OK'||!Array.isArray(payload.data?.graph_data))throw Error('Invalid history');const seen=new Set();
 return payload.data.graph_data.flatMap(r=>{const time=thaiTime(r.datetime),value=numeric(r.value);if(time===null||value===null||time>now+60000||time<now-86400000||seen.has(time))return [];seen.add(time);return [{time,value}];}).sort((a,b)=>a.time-b.time);
}
export function upstreamForecast(payload,now=Date.now()){
 const modified=Date.parse(payload?.modified);if(!Number.isFinite(modified)||modified>now+60000||now-modified>86400000||payload?.station!=='CPY014')throw Error('Forecast file age unknown or old');
 const rows=String(payload.csv).trim().split(/\r?\n/).slice(1).flatMap(line=>{const [code,date,clock,raw]=line.split(',');const time=thaiTime(date+' '+clock),value=numeric(raw);return code==='CPY014'&&time!==null&&value!==null&&time>now&&time<=now+10800000?[{time,value}]:[];}).sort((a,b)=>a.time-b.time);
 if(rows.length!==3||rows[1].time-rows[0].time!==3600000||rows[2].time-rows[1].time!==3600000)throw Error('Incomplete 3-hour forecast');return rows;
}
export function levelStatus(r,now=Date.now()) {
 if(now-r.time>15*60000)return {text:'ข้อมูลเก่า',color:'#8d9aa6'};
 if(r.kind==='canal') {if(r.critical!==null&&r.value>=r.critical)return {text:'ถึงเกณฑ์วิกฤตต้นทาง',color:'#ff6275'};if(r.warning!==null&&r.value>=r.warning)return {text:'ถึงเกณฑ์เตือนต้นทาง',color:'#ffbe63'};return {text:r.warning!==null?'ต่ำกว่าเกณฑ์เตือน':'ไม่มีเกณฑ์เตือน',color:'#65d1e8'};}
 if(r.kind==='water'){const labels=['','น้ำน้อยวิกฤติ','น้ำน้อย','น้ำปกติ','น้ำมาก','น้ำล้นตลิ่ง'];return {text:labels[r.sourceLevel]||'ไม่มีสถานะต้นทาง',color:r.sourceLevel===5?'#ff6275':r.sourceLevel===4?'#70a4ff':'#65d1e8'};}
 return {text:'ค่าที่ต้นทางเผยแพร่',color:'#65d1e8'};
}
