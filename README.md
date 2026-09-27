# Bangkok Water Live V5

Public dashboard: https://bangkok-water-live-v4.tum-neo.workers.dev/

Static HTML/CSS/JavaScript; no build step or application server required.

- BMA drainage infrastructure from DDPM GIS: 438 source records, 429 mappable records. Missing coordinates are never invented.
- Search by station/district, district filter, pump/intake and gate layers, station details.
- Refresh approximately every five minutes while open, with timeout handling and a manual refresh button.
- Date-labelled official station snapshot in `stations.json` when the upstream feed is unavailable. This is infrastructure metadata, not current pump operation or water telemetry.
- Open-Meteo hourly precipitation forecast for central Bangkok, three hourly periods, chart and table. Forecasts are not observations or flood predictions.
- Official DDS radar and CCTV links; no embedded stream or radar overlay yet.
- Measured rainfall and water levels remain unavailable until a verified provider endpoint is configured. No invented live values.

See [INTEGRATION.md](INTEGRATION.md) for source provenance, telemetry adapter requirements, units, timestamps, quality flags and free service constraints.

Deploy all web files to the existing Cloudflare worker `bangkok-water-live-v4`, preserving the existing URL. The source snapshot is at the repository root (`stations.json`). Do not deploy the old V4 source over V5.

Local preview: serve this directory with any static HTTP server, then open it in a browser. ES modules require HTTP rather than opening index.html as a local file.
