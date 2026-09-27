const REFRESH_MS = 300000;

const BMA_API =
  'https://data.go.th/api/3/action/package_search?q=สถานีสูบน้ำ';

const map = L.map('map', {
  zoomControl: true,
  preferCanvas: true
}).setView([13.7563, 100.5018], 10);

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }
).addTo(map);

const riverLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);

L.polyline(
  [
    [13.95, 100.50],
    [13.90, 100.49],
    [13.85, 100.49],
    [13.80, 100.50],
    [13.75, 100.50],
    [13.70, 100.51],
    [13.65, 100.52]
  ],
  {
    weight: 6,
    opacity: 0.8
  }
).addTo(riverLayer);

const fallback = [
  {
    gp_name: 'สถานีสูบน้ำพระโขนง',
    gp_type: 'สถานีสูบน้ำ',
    lat: 13.7107,
    lon: 100.5945
  },
  {
    gp_name: 'สถานีสูบน้ำบางซื่อ',
    gp_type: 'สถานีสูบน้ำ',
    lat: 13.8065,
    lon: 100.5295
  },
  {
    gp_name: 'สถานีสูบน้ำคลองตัน',
    gp_type: 'สถานีสูบน้ำ',
    lat: 13.7425,
    lon: 100.5840
  },
  {
    gp_name: 'สถานีสูบน้ำลาดพร้าว',
    gp_type: 'สถานีสูบน้ำ',
    lat: 13.8060,
    lon: 100.6080
  }
];

function esc(v) {
  return String(v ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function drawStations(rows) {
  stationLayer.clearLayers();

  rows.forEach((r) => {
    const lat = Number(r.lat || r.latitude);
    const lon = Number(r.lon || r.lng || r.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    L.circleMarker([lat, lon], {
      radius: 6,
      weight: 2,
      fillOpacity: 0.85
    })
      .bindPopup(
        `<b>${esc(r.gp_name || r.name || 'จุดระบายน้ำ')}</b><br>` +
        `${esc(r.gp_type || r.type || '')}`
      )
      .addTo(stationLayer);
  });
}

async function loadBma() {
  setSync(false, 'กำลังเชื่อมต่อข้อมูล');

  try {
    const res = await fetch(BMA_API, {
      cache: 'no-store'
    });

    if (!res.ok) throw new Error('API HTTP ' + res.status);

    const data = await res.json();

    /*
      data.go.th/CKAN อาจเปลี่ยนโครงสร้างข้อมูลหรือบล็อก CORS
      จึงไม่แสดงค่าที่ไม่สามารถยืนยันว่าเป็น telemetry จริง
    */

    if (data && data.success) {
      setSync(
        true,
        'เชื่อมต่อ Open Data แล้ว · รอชุดข้อมูล Telemetry'
      );
    } else {
      throw new Error('Invalid API response');
    }
  } catch (err) {
    drawStations(fallback);

    setSync(
      false,
      'แสดงจุดอ้างอิง · API ต้องผ่าน Proxy'
    );

    console.warn('BMA API:', err);
  }
}

function setSync(ok, text) {
  const el = document.getElementById('syncText');

  if (el) {
    el.textContent = text;
  }

  const dot = document.getElementById('syncDot');

  if (dot) {
    dot.dataset.status = ok ? 'ok' : 'warn';
  }
}

function tick() {
  const d = new Date();

  const clock = document.getElementById('clock');

  if (clock) {
    clock.textContent = d.toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
  }

  const last = document.getElementById('lastCheck');

  if (last) {
    last.textContent = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

const riverToggle = document.getElementById('layerRiver');

if (riverToggle) {
  riverToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      riverLayer.addTo(map);
    } else {
      map.removeLayer(riverLayer);
    }
  });
}

drawStations(fallback);
tick();
loadBma();

window.lastLoad = Date.now();

setInterval(tick, 1000);

setInterval(() => {
  window.lastLoad = Date.now();
  loadBma();
}, REFRESH_MS);
