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

Radar and CCTV are official source links, not embedded live streams. Review provider availability and embedding permissions before adding overlays/streams.

Sources:
- https://gis-portal.disaster.go.th/arcgis/rest/services/Map116/DPM_BMA_waterflow_stations_DSS/FeatureServer/2
- https://data.go.th/dataset/water-station (V4 direct API returned HTTP 403 during verification)
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/terms (free API for non-commercial use, no uptime guarantee; observe current request limits)
- https://standard.thaiwater.net/glossary/api-documentation/
- https://dds.bangkok.go.th/radar.php
- https://dds.bangkok.go.th/cctv.php

Deployment: retain existing Cloudflare worker `bangkok-water-live-v4` and its workers.dev URL. Upload the entire website directory, retaining `stations.json`. This is static hosting with no build or paid server required. Source repository: https://github.com/engtsce-pixel/bangkok-water-live . Do not add a new paid resource. For public traffic beyond the free forecast provider limits, add compliant server-side caching or disable that feed pending capacity review.

