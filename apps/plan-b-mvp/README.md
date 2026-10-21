# Plan B MVP (v2)

Plan B MVP v2 is a local student prototype that helps a traveller choose a practical alternative when a public-transport journey is disrupted, and also lets them view routes regularly in a "Plan a trip" mode. It reuses the iOS-style look of [Prototype 6](../prototype-6-2026-09-23/description.md) and implements the "Re-evaluated ideas" section of the [prototype ideas](../../docs/design/prototype_ideas.md). The separate [interview scenario](demo.html) preserves the prepared, fictional Bus 412 exercise. The [scope and evidence trail](../../docs/product/mvp-scope-2026-10-20.md) links all 21 de-identified prototype interview records, and the [v2 feature log](../../docs/product/mvp-v2-feature-log-2026-10-21.md) maps each idea to what was built and what remains untested.

**Status:** implemented on 2026-10-21 with Claude Code assistance for team review. No participant has tested v2, and nothing here establishes adoption, live-data accuracy or willingness to pay.

## Run locally

Prerequisites: Python 3.12 or newer and a Google Cloud API key. The server uses only the Python standard library, there is no build step and there are no packages to install. From this directory:

```bash
python server.py
```

Then open `http://127.0.0.1:8000`. The optional `PORT` environment variable changes the port, and the server listens only on `127.0.0.1`. On desktop the app appears inside a phone frame; on a phone-sized screen it fills the screen. Windows no longer needs the `tzdata` package because Brisbane time falls back to a fixed UTC+10 offset.

### API key lookup

The server looks for the Google key in this order and uses the first one it finds:

1. the `MAPS_API_KEY` environment variable;
2. a `.env` file in `apps/plan-b-mvp/`;
3. a `.env` file in `apps/prototype-6-2026-09-23/` (the team's existing key).

`.env` files are git-ignored. Keep the key on the server, never paste it into the browser and never commit it. Without a key the Google-powered features (routes, places, fuel prices, car parks) are unavailable, but the Translink alerts, ride board, settings, impact dashboard and the fictional `demo.html` do not need it.

### Google APIs

| API | Needed for | Status on the team key (checked 2026-10-21) |
| --- | --- | --- |
| Routes API | Public-transport and driving routes, walking steps, tolls, map geometry | Required; enabled and verified |
| Places API (New) | Local average fuel price and nearby car parks | Required for fuel price and parking; enabled and verified (fuel prices and car parks returned for Brisbane) |
| Elevation API | Uphill and downhill metres for walking sections | Optional; not enabled on the team key, so the app falls back to Open-Meteo. If the team enables it, it is used automatically |

Google bills requests per API. Set a suitable quota or budget in Google Cloud before shared use. See Google's [Routes API setup](https://developers.google.com/maps/documentation/routes/get-api-key), [transit routing](https://developers.google.com/maps/documentation/routes/transit-route), [usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing) and [attribution policy](https://developers.google.com/maps/documentation/routes/policies).

## Data sources and what is sent where

| Service | What it provides | What is sent |
| --- | --- | --- |
| Google Routes API (via this server) | Transit and driving routes, durations, tolls, fares when returned, route geometry | Origin, destination and departure time for each search |
| Google Places API (New) (via this server) | Fuel prices near the start and car parks within 800 m of the destination | Coordinates near the start and the destination |
| Translink SEQ GTFS-Realtime (`gtfsrt.api.translink.com.au`, no key) | Service alerts and trip updates (delays and cancellations), cached for 60 seconds | A plain feed request from this server; no trip details are sent |
| Open-Meteo elevation API (fallback) | Elevation from a 90 m Copernicus terrain model | Sampled coordinates along walking paths |
| Uber universal deep link (`m.uber.com/ul`) | Opens Uber with pickup and dropoff filled in | Pickup and dropoff coordinates, only when the traveller opens the link |
| Google Maps directions link | Hands the chosen trip to Google Maps for turn-by-turn directions | The entered places, only when the traveller opens the link |
| OpenStreetMap tiles with Leaflet | Map background | Standard tile requests from the browser |

The browser stores settings, saved places and the impact history in `localStorage` on that device only. The ride board is stored on the server in `data/rides.json`, which is git-ignored.

## Features

The mapping from each idea to what was built is in the [v2 feature log](../../docs/product/mvp-v2-feature-log-2026-10-21.md). In summary:

### Planning and decision support

- **Plan B search:** real free-text origin and destination, "Current location" (browser geolocation), saved Home and Work/Uni places, departure time, an optional deadline and an optional "What was disrupted?" field.
- **Plan a trip mode:** regular route viewing with an optional deadline and a default "Public transport first" sort, so public transport is emphasised.
- **Transparent ranking:** sort chips with a one-line explanation of the order. There is no opaque score.
- **Plain-language cards:** each route card has a trade-off sentence, a "vs driving" comparison (money saved, CO2 avoided, extra minutes), certainty cues (deadline buffer, live service status) and effort cues (walking, climb, transfers). Fields can be hidden in Settings to reduce clutter.
- **Elevation gain:** uphill and downhill metres for the walking parts of public-transport options, shown as "Flat walk", "Gentle climb +X m" or "Uphill walk +X m". This comes from an elevation service, not from the Routes API.
- **Driving cost and parking:** fuel (distance × L/100 km × fuel price) plus the Google toll estimate plus parking. Car parks within 800 m of the destination are listed with paid or free flags, the nearest is drawn on the map, and its walk is added to driving arrival time and walking. Google does not provide parking prices, so the traveller sets a typical parking cost; driving cost is marked incomplete when paid parking exists and no cost is set. The list shows car parks that Google lists, not live space availability.
- **Uber:** a deep link opens Uber with pickup and dropoff filled in, where the live price and pickup time are shown. The app does not show an Uber price itself and labels rideshare cost as unknown.
- **Map:** Leaflet with OpenStreetMap tiles (darkened in dark mode), zoom buttons, fit route, full-screen expand, scroll-wheel zoom, colour-coded segments (walking is dashed), start and destination pins, car-park pins for driving and an overview map of all routes.
- **Next steps:** the chosen trip shows simplified steps (consecutive walking steps are merged into "Walk about N min to a stop") with turn-by-turn directions in the detail view, and a Google Maps directions handoff.

### Disruption handling

- **Panic mode:** a large button on the home screen. It uses the current location (or a typed place), a destination from saved places or the last destination, and an optional "need to be there by" time. It returns one recommendation: only options with no active Translink alert, on time first, public transport preferred, then least effort (walking minutes plus 8 minutes per change). It shows leave-by time, arrival, the reason and simplified steps, with "Start directions" (Google Maps) and "See other options".
- **Translink alerts and delays:** the home screen shows live alerts, and an alerts sheet can be filtered by line. Active disruptive alerts flag affected routes, the median current delay per line shifts arrival, and cancellations are shown. Bus lines match by number; train lines match by Translink route codes or keywords, which is approximate.
- **Watch for disruptions:** on a chosen trip the app checks every minute while it is open and shows an in-app alert with "See my alternatives", which re-plans avoiding that line. There are no push notifications and no monitoring while the app is closed.

### Sharing and sustainability

- **Ride board:** offer car seats or start a split Uber. Posts match when the start is within 2 km, the destination is within 2.5 km and departure is within 45 minutes. A traveller joins with a nickname, sees the per-person cost split and the CO2 avoided by sharing. Posts store only rounded points (about 100 m), no contact details, expire 30 minutes after departure and show a safety notice. It is visible to everyone using the same local server, so it is a local prototype and not a multi-user service.
- **CO2 on every option:** transit uses per-mode kg CO2e per passenger-km × distance (defaults: bus 0.105, train 0.035, light rail 0.029, ferry 0.019, approximate values adapted from UK government averages and editable in Settings). Car uses litres × 2.31 kg/L for petrol or 2.68 kg/L for diesel, and Uber assumes 7 L/100 km. A "Lowest CO2" sort is available.
- **Impact Dashboard:** trips logged with "I'm taking this trip" are compared with driving the same route alone. It shows CO2 avoided, money saved, low-car trips and the percentage of trips not driving, month-by-month bar charts for the last six months (with hover tooltips and a table view) and recent trips. Data stays in the browser only.

### Settings

A slide-in Settings panel replaces on-screen mode selection:

- theme (Auto, Light or Dark) and reduce motion;
- ways to travel: public transport (bus, train, light rail and ferry chips), own car and Uber;
- fuel use in L/100 km, fuel type, and fuel price as either "Live average" from Places API (New) fuel prices near the start or a manual price;
- typical parking cost;
- a flat public-transport fare used when Google returns no fare (default $0.50, an assumption to check, because Google returned no Translink fares in testing);
- default limits;
- toggles for each card field: buffer, cost, walking, transfers, elevation, CO2, parking and live status;
- saved places (Home and Work/Uni), watch-trip options and editable CO2 factors;
- clear impact history;
- a link to the fictional interview scenario.

### Motion and look

Prototype 6 styling, spring toggles, sliding segmented controls, a slide-in settings panel, bottom sheets, push transitions, rising cards and toasts. All of these respect the reduced-motion setting.

## Stack decision

The front end stays as plain HTML, CSS and JavaScript (`index.html`, `app.js`, `app.css`) served by a Python standard-library server, with no build step and no new dependencies. Streamlit was considered and rejected because it cannot reproduce Prototype 6's app look, page push transitions, bottom sheets and spring animations. The v1 files `live.js` and `live.css` were removed because `app.js` and `app.css` replace them.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `app.js`, `app.css` | v2 front end |
| `server.py` | Local HTTP server and API routes |
| `live_routes.py` | Planner: route building, limits, ranking, cost and CO2 |
| `google_api.py` | Google Routes, Places (New) and elevation requests |
| `gtfs_rt.py` | Translink GTFS-Realtime alert and trip-update decoder (no protobuf library) |
| `rides.py` | Shared ride board storage and matching |
| `demo.html`, `demo.js`, `styles.css` | Unchanged fictional Bus 412 interview scenario |
| `test_live_routes.py`, `test_gtfs_rt.py`, `test_rides.py` | Offline tests |

## Develop and check

Run the offline tests from this directory:

```bash
python -m unittest -v
python -m py_compile server.py live_routes.py google_api.py gtfs_rt.py rides.py
```

The 82 tests in `test_live_routes.py`, `test_gtfs_rt.py` and `test_rides.py` make no network calls, so they cannot verify external data. On 2026-10-21 the app was also driven end to end in headless Microsoft Edge with the team key: home, settings, Plan B search, the detail sheet with map, next steps, trip logging, dashboard, ride board, panic mode, dark mode and regular trip mode all rendered with no console errors. That browser run is a developer check, not participant evidence.

Fixes found during that testing: arrival times now use scheduled board and alight times because Google's transit duration can exclude a long wait for a later service (v1 could under-state arrival); consecutive walking steps are merged; and duplicate transit routes are removed.

For manual review, also check a known Australian transit trip, a driving trip, an invalid deadline, an API error, a route without a fare, a train line alert, selection, dark mode, reduced motion, keyboard navigation and narrow mobile layouts. Before any public deployment, provide the Terms of Use and Privacy Policy required by Google's Routes API policy, review key restrictions, and arrange hosting, moderation and quota controls. This local server is a development server, not a deployment configuration.

## Limitations

- No participant has tested v2.
- Matching of train lines to GTFS-Realtime data is approximate, and the accuracy of live data and adoption are not established.
- The CO2 factors and the $0.50 flat fare are assumptions, not verified values.
- Parking is the list of car parks Google returns, not live space availability, and parking prices are not available from Google.
- The app does not show an Uber price. Rideshare cost is unknown unless a rider enters the estimate they saw on the ride board.
- The ride board works on a single local server, is unmoderated, and does not address identity, safety checks or moderation.
- The impact history is stored per browser and is lost if browser data is cleared.
- Watching for disruptions only works while the app is open.
- Elevation falls back to Open-Meteo's 90 m terrain model while the Google Elevation API is not enabled.
- Google Routes estimates are not confirmed disruption notices, guaranteed arrival times or booking options. Verify services and directions before leaving.

## Prepared exercise values

The [interview scenario](demo.html) starts at a fictional 8:20 am Bus 412 cancellation at Taringa Station. Its routes are teaching fixtures and **extra cost** means spending added after that scenario point, whereas the live page uses whole fare when available.

| Prepared option | Whole journey from 8:20 | Arrival | Extra cost | Total walking | Breakdown |
| --- | ---: | --- | ---: | ---: | --- |
| Wait for the next bus | 47 min | 9:07 am | $0 | 3 min | Walk 3, wait 12, ride 32 min |
| Walk to Stop B and take Bus B | 34 min | 8:54 am | $1 | 8 min | Walk 6, wait 4, ride 22, walk 2 min |
| Rideshare | 22 min | 8:42 am | $18 | 2 min | Walk 2, wait 4, drive 16 min |

These scenario values are invented, not current fares, service availability, pickup times or mapped directions. The $0 waiting option assumes no added payment in the exercise. Its arrival estimate includes the final walk to the destination.
