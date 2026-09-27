# Bangkok Water Live V5 — integration contract

The shipped site contains no fabricated observations. `config.json` starts with `telemetryUrl: null`.
To connect BMA or ThaiWater, implement a same-origin endpoint (for example `/api/observations`) and set `telemetryUrl` to that path. Keep provider credentials server-side. Do not put secrets in config.json or any static asset.

The endpoint returns an object with optional `waterLevel` and `rainfall` objects. Each needs:

- `kind`: `waterLevel` or `rainfall`, matching its parent key
- `station`: actual station name (each card represents that station, not all Bangkok)
- `value`: finite measured number; missing data must be null, never zero
- `unit`: `m` for waterLevel, `mm` for rainfall
- `observedAt`: ISO-8601 timestamp including Z or explicit offset
- `source`: provider name
- `sourceUrl`: HTTPS provider reference
- `quality`: `verified` only after the adapter checks the provider's quality flags
- waterLevel additionally requires `datum` (actual vertical reference)
- rainfall additionally requires `periodMinutes` (actual accumulation interval)

Do not copy control/warning/critical infrastructure thresholds into measurements. Do not mark forecast values as observations. Map raw provider field names and quality conventions after checking the actual provider documentation; ThaiWater's standard documentation is not a universal live endpoint. A bare schema-valid object does not independently prove data authenticity: the server-side adapter must perform provenance and quality checks.

The UI rejects missing units, missing timestamps, unsupported quality and future times (>1 minute), labels observations older than 15 minutes as old, and clears invalid data. This 15-minute display policy is not a hydrological validity standard.

Forecast: Open-Meteo Best Match hourly precipitation at Bangkok center. Values are previous-hour totals at the supplied end timestamps. Three consecutive ending hours are shown; the first may start before the current time. Not radar nowcasting, not drainage/flood prediction, not an operational pump/gate recommendation. No synthetic forecast fallback. Data retrieval time is not a model issue time.

Stations: BMA infrastructure dataset distributed by DDPM GIS. Fetch every approximately five minutes; if unavailable, show the shipped, date-labelled snapshot. Original 438 records include 9 without usable coordinates; 429 are mappable. Identical names/coordinates with different provider IDs are retained. District names and physical fields are retained as supplied, including source typos; units/datum must be verified before operational use.

Radar: RainViewer public Weather Maps API supplies historical frames and a coverage mask. Its frame timestamps describe composite frame generation, not every underlying radar observation. Tiles are limited to native zoom 7; the map enlarges them when zoomed further. Radar imagery is qualitative here; the UI does not convert colors to measured local rain amounts. Frame age and fetch age are separately labelled. No fabricated future radar frames. RainViewer data has no availability guarantee; an empty area is not proof of no rain. This personal/community, non-commercial project uses the free public API with visible attribution.

CCTV remains official source links, not embedded live streams. No sample photography is substituted for live cameras. Verify actual stream endpoints and embedding permission before implementation.

District precipitation: the app selects an actual infrastructure station coordinate in each of five named districts from the official station records, then requests Open-Meteo at those coordinates. The station name and coordinates identify the point; the result is not a district mean. The table and map support a total of three hourly periods or a selected period. No rainfall-to-flood classification or water-volume calculation is performed.

Water history: the same-origin telemetry endpoint may additionally return `waterHistory`, an array of objects using the waterLevel observation schema above. Display is limited to the last 24 hours; only entries sharing the latest valid entry's station and datum are shown. Duplicate times are omitted; gaps over 30 minutes break the connecting line. At least two valid observations are needed. An old last observation is labelled. The chart contains no extrapolated future points.

Current weather in the header is explicitly modelled Open-Meteo temperature, relative humidity and wind, never labelled station observations. Timestamps and expected units are validated. Model weather older than 90 minutes is suppressed. No operational pump/gate instructions are generated.

Sources:
- https://gis-portal.disaster.go.th/arcgis/rest/services/Map116/DPM_BMA_waterflow_stations_DSS/FeatureServer/2
- https://data.go.th/dataset/water-station (V4 direct API returned HTTP 403 during verification)
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/terms (free API for non-commercial use, no uptime guarantee; observe current request limits)
- https://standard.thaiwater.net/glossary/api-documentation/
- https://dds.bangkok.go.th/radar.php
- https://dds.bangkok.go.th/cctv.php
- https://www.rainviewer.com/api/weather-maps-api.html
- https://www.rainviewer.com/api.html

Deployment: retain existing Cloudflare worker `bangkok-water-live-v4` and its workers.dev URL. Upload the entire website directory, retaining `stations.json`. This is static hosting with no build or paid server required. Source repository: https://github.com/engtsce-pixel/bangkok-water-live . Do not add a new paid resource. For public traffic beyond the free forecast provider limits, add compliant server-side caching or disable that feed pending capacity review.

