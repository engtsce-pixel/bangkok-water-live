import {numeric} from './observed-core.mjs';
// DDS flood page explicitly labels flood values in centimetres.
export function roadRows(payload,now=Date.now()) {
 if(!Array.isArray(payload?.rows))throw Error('Invalid DDS road data');
 const seen=new Set();return payload.rows.flatMap(r=>{
  const value=numeric(r.flood),lat=numeric(r.latitude),lon=numeric(r.longitude),match=String(r.site_timestamp).match(/^\/Date\((\d+)\)\/$/),time=match?Number(match[1]):null;
  if(!r.flood_code?.startsWith('FL.')||!r.flood_name||value===null||value<0||lat===null||lon===null||lat<13||lat>15||lon<99||lon>102||time===null||time>now+60000||now-time>86400000||r.status!==1||r.sensor!=='ปกติ'||r.duct_sensor===true||seen.has(r.flood_code))return [];
  seen.add(r.flood_code);return [{id:'road:'+r.flood_code,kind:'road',name:r.flood_name,district:r.districtName||'',value,time,lat,lon,unit:'ซม.',agency:'สำนักการระบายน้ำ กทม.',stale:now-time>900000}];
 }).sort((a,b)=>b.time-a.time||b.value-a.value);
}
