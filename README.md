# Bangkok Water Management V5 — live public sources

Public site: https://bangkok-water-live-v4.tum-neo.workers.dev/

Reference-inspired dashboard with satellite/street maps, historical radar, three hourly rain forecasts, official infrastructure, published observations, real water-level history, pump-machine status, gate opening and source camera images.

## Connected sources

- BMA infrastructure via DDPM GIS: 438 records, 429 usable coordinates. No invented locations.
- ThaiWater public API: Bangkok river/canal levels (m MSL), 24-hour measured rain, canal flow and road sensor reports. Latest observations older than 15 minutes are labelled old; records older than 24 hours are omitted. Provider publication is not an independent quality certification.
- BMA weather portal: public Pump and Station data. RTU connectivity, per-machine running/stopped/trip states, provider timestamp and gate opening in metres. Disconnected or old records never appear as currently running. No commands are sent to equipment.
- HII FEWS CPY014: three next hourly water-level model values at Nuan Chawi Bridge, Nonthaburi. Explicitly NOT a Bangkok district flood forecast. Reject incomplete or old forecast files.
- RainViewer: historical radar timeline and coverage mask. No fabricated future radar.
- Open-Meteo: modelled current weather and three hourly rain periods at Bangkok center and five district reference points.
- DDS CCTV: original JPEG images with source Last-Modified age. Old images are visibly labelled; never advertised as live video.

## Deploy

Run `npx wrangler deploy` with the included configuration, or commit to the connected GitHub main branch. Existing worker name and URL are retained. `worker.mjs` serves fixed read-only `/api/*` routes; other files are served directly by the ASSETS binding. No API keys, database, cron or paid add-on is required. Requests are subject to the existing Cloudflare plan quota and upstream availability. Public data JSON is cached for five minutes at the edge where available; the browser refreshes approximately every five minutes while open.

See INTEGRATION.md for schemas, provenance and limits. `_headers` remains for static assets. `.assetsignore` excludes worker source and tooling from static publication.

Not supplied: calibrated Bangkok-wide flood depth/arrival/volume model, tunnel percentage occupancy, measured total pump discharge, operational pump/gate commands or guaranteed live CCTV. These require additional verified data and modelling; displayed source readings are never converted into invented predictions.
