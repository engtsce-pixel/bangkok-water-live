# V5 live-source integration

## Architecture

Cloudflare worker.mjs exposes GET-only fixed paths, with no arbitrary upstream URL, credentials, writes to equipment, or authentication bypass. Assets are served independently. Source errors return missing/unavailable, never fabricated zero values. Fixed API routes: /api/live, /api/history, /api/pumps, /api/cameras, /api/upstream-forecast.

## ThaiWater

Public base: https://api-v3.thaiwater.net/api/v1/thaiwater30/public/

Endpoints verified against the official ThaiWater frontend at https://www.thaiwater.net/dist/js/app.chunk.js and actual responses:

- waterlevel_load: waterlevel_data.data, station.tele_station_*, waterlevel_msl, waterlevel_datetime. Unit m MSL. situation_level labels follow the provider scale (1 low-critical, 2 low, 3 normal, 4 high, 5 overflowing).
- canal_waterlevel: canal_value, canal_datetime, station.canal_*, warning_level/critical_level, unit m MSL.
- rain_24h?province_code=10,11,12,13,73,74: rain_24h in mm over prior 24 hours ending at rainfall_datetime. Keep Bangkok province_code 10 only.
- flow: flow_value in m³/s, flow_datetime and station.flow_*. Single-point flow is not city-wide total or pump capacity.
- flood_road: source unit is inconsistent in the official frontend. The dashboard therefore shows only source zero/positive reports with station and timestamp, not inferred centimetres, flood depth, safety or forecast risk.
- waterlevel_graph: station_type canal or tele_waterlevel, positive numeric station_id, server-generated last-24-hour start_date/end_date. graph_data.datetime/value. Reject null/sentinel points and duplicate times. Break chart lines across gaps over 30 minutes.

Times without offsets in these public responses are parsed as Asia/Bangkok (+07:00), consistent with the public display. Missing values, -999/9999/999999, invalid coordinates, future times beyond one minute and records older than 24 hours are excluded. Values older than 15 minutes are visibly old. Fifteen minutes is this dashboard's freshness policy, not a source guarantee. The API does not supply a per-row quality approval flag; the interface explicitly states source publication rather than independently verified measurements.

The worker filters live API data to Bangkok before cache/response. It does not persist observations or fabricate historical series. A failed source does not hide successful independent sources.

## BMA machines and gates

Official read-only endpoints found in public page code:
- https://weather.bangkok.go.th/Pump/Map/GetData?id=0
- https://weather.bangkok.go.th/Station/Map/GetData?id=0

Only a fixed allowlist of public fields is returned: station ID/name/code/district/coordinates, pump count, capacity metadata, observation timestamp, RTU connection, per-machine status/trip and gate opening. Microsoft /Date(epochMillis)/ is an absolute time. Do not substitute the waterTbl page-generation timestamp for LastPump.site_timestamp_station.

A machine is running only when RTU connected, timestamp within 15 minutes, pump_statusN=1 and pump_trip_statusN=false. Trip=true is a fault. Missing, disconnected and old states are unknown. Missing machine slots beyond the published set remain unknown, not off. Gate opening is in metres per the official Station page, and suppressed when disconnected/old. Do not calculate actual discharge from count, nominal capacity or cumulative LastAmount counters. The two source namespaces retain separate IDs; no fuzzy matching to infrastructure stations is performed.

## Upstream water forecast

Metadata: https://fews2.hii.or.th/model-output/data_portal/metadata/hii_waterlevel.csv
Forecast: https://fews2.hii.or.th/model-output/data_portal/hii_waterlevel/forecast/CPY014.txt

CPY014 is Nuan Chawi Bridge, Pak Kret, Nonthaburi (13.9474,100.5351), published by HII FEWS and displayed by ThaiWater. This is a nearby upstream station, NOT a Bangkok canal flood or district depth forecast. The official metadata has no published Bangkok station in this set at verification. The next three consecutive hourly values are plotted in m MSL. File Last-Modified is labelled file modification time, not asserted model issuance time. Missing/unknown/future file time, files older than 24 hours or missing hourly coverage suppress the chart. No extrapolation/interpolation creates forecast values.

## CCTV

Official pages https://dds.bangkok.go.th/cctv1.php and cctv2.php publish /cctv-image/cctv1.jpg and cctv2.jpg. Images are loaded directly from DDS; the worker only checks HEAD metadata. Last-Modified was 28 August 2026 during this verification, so images are labelled OLD. Retrieval time is never presented as capture time. A failed image is hidden with an unavailable message. No substitute photography, proxy download or fake live badge is used.

## Remaining scope

A calibrated 3-hour Bangkok flood-depth/arrival/volume model and tunnel fullness data are not available from these verified feeds. The app displays provider threshold status and public forecasts separately, without inventing flood risk maps or operational instructions. Legacy config.json/core observation contract/history.js are retained for compatibility but not used by the active live adapters. There are no secrets or registered API keys in the project.
