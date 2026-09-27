export const REFRESH_MS = 300000;
export function number(value) {
  if (!['number','string'].includes(typeof value) || String(value).trim() === '') return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
export function stations(records) {
  if (!Array.isArray(records)) throw new Error('รูปแบบข้อมูลสถานีไม่ถูกต้อง');
  const seen = new Set();
  return records.flatMap(r => {
    const lat = number(r.gp_lat), lon = number(r.gp_long);
    if (!r.gp_name || lat === null || lon === null || lat < 13.4 || lat > 14.1 || lon < 100.2 || lon > 101) return [];
    const key = `${r.gp_id ?? r.gp_name}|${lat}|${lon}`;
    if (seen.has(key)) return []; seen.add(key);
    return [{...r, lat, lon, gate: String(r.gp_type).includes('ประตู')}];
  });
}
export function forecastPeriods(data, now = Date.now()) {
  const h = data?.hourly;
  if (data?.hourly_units?.precipitation !== 'mm' || !Array.isArray(h?.time) || !Array.isArray(h?.precipitation)) throw new Error('หน่วยหรือรูปแบบพยากรณ์ไม่ถูกต้อง');
  const offset = number(data.utc_offset_seconds);
  if (offset === null) throw new Error('ไม่มีเขตเวลาของข้อมูล');
  const rows = h.time.map((time, i) => ({time: Date.parse(time + 'Z') - offset * 1000, value: number(h.precipitation[i])})).filter(r => r.time > now && r.time <= now + 3 * 3600000);
  if (rows.length !== 3 || rows.some(r => r.value === null || r.value < 0) || rows.some((r,i) => i > 0 && r.time - rows[i-1].time !== 3600000)) throw new Error('ข้อมูลพยากรณ์ 3 ชั่วโมงไม่ครบหรือหมดอายุ');
  return rows;
}
export function observation(row, kind, now = Date.now()) {
  if (!row || row.kind !== kind || !row.station || !row.source || !/^https:\/\//.test(row.sourceUrl || '') || row.quality !== 'verified') return null;
  const value = number(row.value), time = Date.parse(row.observedAt);
  if (value === null || !Number.isFinite(time) || !/(Z|[+-]\d{2}:\d{2})$/.test(row.observedAt) || time > now + 60000) return null;
  if (kind === 'rainfall' && (row.unit !== 'mm' || value < 0 || number(row.periodMinutes) === null || number(row.periodMinutes) <= 0)) return null;
  if (kind === 'waterLevel' && (row.unit !== 'm' || !row.datum)) return null;
  return {...row, value, time, stale: now - time > 15 * 60000};
}
export function advice(rows) {
  if (!rows || rows.length !== 3) return 'ข้อมูลไม่พอประเมินฝน กรุณาตรวจเรดาร์ กล้อง และประกาศจากหน่วยงาน';
  return rows.some(r => r.value > 0)
    ? 'แบบจำลองมีฝนในช่วงที่แสดง ควรตรวจเรดาร์และสภาพเส้นทางก่อนออกเดินทาง ยังสรุปความเสี่ยงน้ำท่วมจากฝนอย่างเดียวไม่ได้'
    : 'แบบจำลองจุดนี้ไม่แสดงฝนในช่วงที่แสดง แต่ฝนเฉพาะพื้นที่และน้ำท่วมยังเกิดได้ ควรติดตามเรดาร์และประกาศจากหน่วยงาน';
}
