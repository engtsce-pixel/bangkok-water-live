Bangkok Water Live V4
- Static public dashboard
- Checks BMA Open Data every 5 minutes from CKAN Data API
- If browser CORS blocks the feed, falls back to verified sample station metadata and clearly labels it as non-realtime
- ThaiWater live values remain disabled until an actual provider Base URL is confirmed; the ThaiWater pages currently document the standard endpoints (/Rainfall, /Runoff, /StationInfo), not one universal live provider URL.
Deploy: upload the five web files (index.html, app.js, style.css, _headers, README.md) to the existing Cloudflare Worker static assets project. Do not upload wrangler.toml via mobile uploader.
