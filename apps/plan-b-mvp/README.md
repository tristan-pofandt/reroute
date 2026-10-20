# Plan B MVP

Plan B now has two connected flows. The home page searches actual Google Routes estimates for places and times supplied by the traveller. The separate [interview scenario](demo.html) preserves the prepared, fictional Bus 412 exercise and its constraint, comparison and selection behaviour. The [scope and evidence trail](../../docs/product/mvp-scope-2026-10-20.md) links all 21 de-identified prototype interview records. This is a student MVP; no participant has yet tested this implementation.

## Run locally

Prerequisites: Python 3.12 or newer, a Google Cloud project with billing and the Routes API enabled, and a Routes API key. The Python server uses only the standard library. In a terminal from this directory:

```bash
export MAPS_API_KEY='your-restricted-routes-api-key'
python3 server.py
```

Open `http://127.0.0.1:8000`. Keep the key on the server; never paste it into the browser or commit it to Git. On macOS or Linux, you can set `MAPS_API_KEY` in your terminal environment before starting. `PORT` optionally changes the local port. The server listens only on `127.0.0.1`. Without a key, the in-app live comparison is unavailable, but the home page can open the entered origin and destination directly in Google Maps without a key. Google Maps will use its own route and departure setting; recheck the time there. The fictional `demo.html` also works through the server or directly as a file. Opening `index.html` as a file only supports the Google Maps handoff, not in-app comparison.

Each live search sends the entered origin, destination and departure time to Google Routes API. It requests public transport and/or driving according to the traveller's mode choices. A checked mode may make a separate billed request. Google may return no route, an incomplete fare, or an error. API quota, credentials, coverage and current data determine whether live search works in practice. Set a suitable quota or budget in Google Cloud before shared use. See Google's [Routes API setup](https://developers.google.com/maps/documentation/routes/get-api-key), [transit routing](https://developers.google.com/maps/documentation/routes/transit-route), [usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing), and [attribution policy](https://developers.google.com/maps/documentation/routes/policies).

## What the app does

- Accepts a real origin, destination, departure time and deadline in Brisbane time, a maximum **total fare**, a walking limit and selected travel modes.
- Shows returned transit and driving estimates, estimated arrival, deadline buffer, walking minutes, transfers, available transit fare, route steps and reasons a route cannot be confirmed within every limit.
- Keeps unknown transit fares, non-AUD fares and driving costs visibly unverified. It does not substitute the fictional fare or rideshare price from Prototype 6.
- Lets a traveller inspect, sort and select an option, then opens a fresh directions handoff in Google Maps or a separate Translink check. The Google Maps link may show a different route from the earlier API result.
- Offers Google Maps journey links from the form even without a Routes API key. They send the entered places to Google Maps only when opened and do not carry the app's departure time.
- Keeps the fictional interview exercise available from the header. Its three prepared options remain separate from live search results.

Google Routes estimates are not confirmed disruption notices, vehicle positions, guaranteed arrival times or booking options. The app does not detect a cancelled service, monitor a journey, estimate rideshare pickup or price, calculate fuel or parking, send alerts, collect accounts or store searches. A route with unknown cost is not labelled as fitting a budget. Travellers should verify services and exact directions before leaving.

## Develop and check

There is no frontend build step or package install. Source is `index.html`, `live.js`, `live.css`, `styles.css`, `live_routes.py` and `server.py`; `demo.html` and `demo.js` own the fictional exercise. Run the offline route validation and parsing checks with:

```bash
python3 -m unittest -v test_live_routes.py
python3 -m py_compile server.py live_routes.py
```

For manual review, check a known Australian transit trip, a driving trip, an invalid deadline, an API error, a route without fare, selection and Google Maps handoff. Check desktop and narrow mobile layouts with keyboard navigation. A live API call with the team's own key is still required to verify external data and coverage; offline tests cannot establish that. Before any public deployment, provide the Terms of Use and Privacy Policy required by Google's Routes API policy, review key restrictions, and arrange hosting and quota controls. This local server is a development server, not a public deployment configuration.

## Prepared exercise values

The [interview scenario](demo.html) starts at a fictional 8:20 am Bus 412 cancellation at Taringa Station. Its routes are teaching fixtures and **extra cost** means spending added after that scenario point, whereas the live page uses whole fare when available.

| Prepared option | Whole journey from 8:20 | Arrival | Extra cost | Total walking | Breakdown |
| --- | ---: | --- | ---: | ---: | --- |
| Wait for the next bus | 47 min | 9:07 am | $0 | 3 min | Walk 3, wait 12, ride 32 min |
| Walk to Stop B and take Bus B | 34 min | 8:54 am | $1 | 8 min | Walk 6, wait 4, ride 22, walk 2 min |
| Rideshare | 22 min | 8:42 am | $18 | 2 min | Walk 2, wait 4, drive 16 min |

These scenario values are invented, not current fares, service availability, pickup times or mapped directions. The $0 waiting option assumes no added payment in the exercise. Its arrival estimate includes the final walk to the destination.
