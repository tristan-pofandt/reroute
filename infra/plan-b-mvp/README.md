# Plan B MVP deployment

Operational configuration for running the [Plan B MVP](../../apps/plan-b-mvp/README.md) somewhere other than a developer laptop, for example on an investor demo day. Nothing here has been deployed by an agent: the files were written and checked for syntax only, and the Docker image and the Render blueprint have not been built or applied.

| File | Purpose |
| --- | --- |
| `Dockerfile` | `python:3.13-slim` image that installs `apps/plan-b-mvp/requirements.txt` and runs `gunicorn -w 1 --threads 8 server:app`, listening on `HOST` (0.0.0.0) and `PORT` (8000) |
| `Dockerfile.dockerignore` | Keeps `.env` files, local `data/`, caches and tests out of the image (BuildKit reads it automatically) |
| `render.yaml` | Render Blueprint for one Docker web service; secrets are `sync: false` so they are typed into the dashboard |

## Read this first

- **Review the legal pages before public use.** Google's Routes API policy requires public Terms of Use and Privacy Policy URLs for apps that show Google routes. This app serves `/terms`, `/privacy` and `/about`; the team must verify the wording and add deployment-specific contact and hosting details before release.
- **Never commit keys.** `MAPS_API_KEY`, `MAPS_BROWSER_API_KEY` and `VAPID_PRIVATE_KEY` live only in the host's environment settings. `.env` files are git-ignored and excluded from the image. The browser key is public by design; create a separate key restricted to Maps JavaScript API and exact HTTP referrers (including the deployed HTTPS origin and any local development origin). The server key must never be used as the browser key: the server prints a warning at start-up if the two are equal, because `/api/config` sends the browser key to every visitor.
- **Use one worker.** The push monitor thread, the static GTFS loader and the feed caches live inside the Python process, so the container runs gunicorn with `-w 1` and eight threads. Do not scale it out to several instances without moving that state elsewhere.
- **Web Push and installing the app need HTTPS.** Both Render and a Cloudflare tunnel provide it. Plain `http://` on a laptop only works for `localhost`.

## Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `MAPS_API_KEY` | Yes, for live routes | Google Maps Platform key with Routes API and Places API (New) enabled; Elevation API is optional |
| `MAPS_BROWSER_API_KEY` | Yes, for maps | Separate key for Maps JavaScript API, restricted by HTTP referrer and API. It is served by `/api/config` and is public to visitors; do not reuse the server key |
| `PUBLIC_URL` | Recommended | The address people use, for example `https://plan-b-mvp.onrender.com`. It is encoded by `/qr.svg`, shown in `/api/status`, and accepted by the Origin check |
| `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` | For push | Base64url VAPID key pair. If both are unset the server generates a pair once into `data/vapid.json`, which is lost on redeploy and would invalidate every browser subscription, so set them on any public host |
| `VAPID_SUBJECT` | No | Contact for push services, default `mailto:planb-demo@example.invalid`. Use a team mailbox, never a personal address |
| `HOST`, `PORT` | No | Bind address and port. The image sets `0.0.0.0` and `8000`; Render supplies `PORT` itself |
| `PLANB_TRUST_PROXY` | On a host | Number of reverse proxies in front of the app (the image and `render.yaml` set `1`) so the real visitor address is used for rate limiting |
| `PLANB_ADMIN_TOKEN` | For moderation | Secret (32+ random characters) that switches on the operator queue at `/admin/moderation` (404 while unset). Set it as a secret, never in the repo. See `docs/engineering/ride-board-moderation.md` |
| `PLANB_CSP_ENFORCE` | No | `1` (the default) enforces the Content-Security-Policy; `0` sends it as report-only (violations are logged as `CSP violation` warnings via `/api/csp-report`) while you test a new third-party host |
| `PLANB_CORS_ORIGINS` | Native app | Comma list of origins allowed to call the API cross-origin. Default none (same-origin only). For the Capacitor app use `capacitor://localhost,https://localhost,ionic://localhost` |
| `PLANB_QUIET` | No | Set to `1` to stop the server printing a console line for every request. Those lines hold the visitor IP address and the URL, which includes typed address suggestions and weather or fuel coordinates, so the privacy page assumes you decide this on purpose |
| `PLANB_PLAN_LIMIT_PER_HOUR` | No | Searches per visitor address per hour, default 40. Address suggestions (`PLANB_AUTOCOMPLETE_LIMIT_PER_HOUR`, 400) and fuel prices (`PLANB_FUEL_LIMIT_PER_HOUR`, 120) have their own limits |
| `PLANB_DAILY_GOOGLE_CAP` | No | Searches per Brisbane day for everyone together, default 50; `render.yaml` uses 50 |
| `PLANB_DAILY_AUTOCOMPLETE_CAP` | No | Address suggestion requests per Brisbane day for everyone together, default 500; `render.yaml` uses 500 |
| `QLDTRAFFIC_API_KEY` | No | Your own QLDTraffic key; without it the public key published on the Queensland Government open data portal is used |
| `PLANB_DATA_DIR` | No | Where the ride board, push subscriptions, VAPID keys and the cached GTFS index are written, default `apps/plan-b-mvp/data` (`/app/data` in the image) |

Generate a VAPID key pair on your own machine from `apps/plan-b-mvp/`, then paste the two lines into the host's settings:

```bash
python -c "from push import generate_keys; private, public = generate_keys(); print('VAPID_PRIVATE_KEY=' + private); print('VAPID_PUBLIC_KEY=' + public)"
```

A visitor on the same Wi-Fi as the developer machine is limited like any other visitor, but requests that come straight from the machine running the server (no proxy) are exempt from the per-visitor limits, so local development is not throttled. The daily cap applies to everyone.

## Option A: Render

1. Push the branch you want to deploy to GitHub. Render builds from the repository.
2. In the Render dashboard choose **New > Blueprint**, select this repository and set the Blueprint file path to `infra/plan-b-mvp/render.yaml`. Render creates one Docker web service named `plan-b-mvp` using `infra/plan-b-mvp/Dockerfile` with the repository root as the build context.
3. When prompted, enter `MAPS_API_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT`. Leave `PUBLIC_URL` and `MAPS_BROWSER_API_KEY` empty until the first deploy reveals the service address.
4. After the first deploy Render shows the service address (`https://plan-b-mvp-xxxx.onrender.com`). Set `PUBLIC_URL` to it and create a separate browser key restricted to that exact HTTPS referrer and Maps JavaScript API only. Set `MAPS_BROWSER_API_KEY`, then redeploy so maps, the QR code and Origin check use the correct settings.
5. Open the address on a phone and run one search. `GET /api/status` should report `"live_available": true`, `"push": true` and, a minute or so after start, `"gtfs_static": {"state": "ready"}`. Open a route map and check that Google's logo and attribution remain visible.

Notes for Render:

- `render.yaml` uses the `starter` plan. A free instance sleeps after 15 minutes without traffic, which stops background push monitoring and makes the first visitor wait for a cold start; the static GTFS index is rebuilt in the background after each wake-up (about 20 seconds on a laptop, and requests never wait for it).
- The container filesystem is wiped on every deploy. That only loses the ride board, push subscriptions and the cached GTFS index (rebuilt automatically). To keep them, uncomment the `disk` block in `render.yaml`; a disk is mounted root-owned, so also remove the `USER planb` line from the Dockerfile or change the mount's ownership.
- `autoDeploy` is off, so nothing is deployed until you trigger it.

## Option B: Cloudflare quick tunnel (for the day)

A quick tunnel exposes the laptop's server on a temporary HTTPS address with no account, which is enough for a demo and for installing the PWA and receiving push notifications.

1. Start the app on the laptop: `cd apps/plan-b-mvp`, then `python server.py` (it listens on `http://127.0.0.1:8000`).
2. In another terminal run `cloudflared tunnel --url http://localhost:8000`. After a few seconds it prints an address like `https://random-words.trycloudflare.com`.
3. Stop the app, set `PUBLIC_URL` to that address (`PUBLIC_URL=https://random-words.trycloudflare.com python server.py`) and start it again, so the QR code and the Origin check use the tunnel address. Keep the tunnel running; the address changes every time you restart `cloudflared`.
4. Open the tunnel address on a phone. Requests arrive from the laptop's own tunnel process, so the server rate-limits visitors by the forwarded `CF-Connecting-IP` header rather than treating everyone as the developer.

The tunnel is only up while the laptop is awake and online, and anyone with the address can reach the app, so keep the daily cap low and shut the tunnel down after the event. This path was written from Cloudflare's documentation and has not been run end to end; check the Origin handling with one real search through the tunnel before the event, and set `PUBLIC_URL` if a search from the tunnel address is refused.

## Printing the QR code

`GET /qr.svg` returns an SVG QR code of `PUBLIC_URL` (or, if that is unset, the address you opened it from). `GET /qr.svg?url=https://example.org` encodes any `http://` or `https://` address. To print it, open `<your address>/qr.svg` in a browser and print the page, or save the image and place it on a slide or poster. The app also has a **Share / QR** sheet. Scan the printed code with a phone before the event, and print a spare in case the tunnel address changes.

## Google key restrictions, quotas and cost

- Create a **separate key for the public deployment**; do not reuse the team's development key.
- Create one server key for Routes API and Places API (New), plus Elevation API if enabled. Restrict it to those APIs and, where the host has a fixed outbound IP, to that IP.
- Create a separate browser key for Maps JavaScript API only. Restrict it to the deployed HTTPS referrer and required local development referrers. Test restrictions before use; an incorrect restriction makes maps fail to load.
- Google route content is rendered on Google Maps; keep Google's automatically displayed map logo and attribution visible. The app does not place Google route geometry on third-party map tiles.
- In Google Cloud set **per-day quotas** for each billable server API and a **billing budget with alerts**. The app's own caps (`PLANB_PLAN_LIMIT_PER_HOUR`, `PLANB_DAILY_GOOGLE_CAP` and `PLANB_DAILY_AUTOCOMPLETE_CAP`) are a second line of defence, not a replacement.
- A search may make Routes, Places and Elevation requests; cost varies by endpoint, cache state, route fields, usage and current Google prices. The demo mode shows approximate list-price estimates for the tracked requests. Check the current price table in `apps/plan-b-mvp/google_api.py` and Google Cloud billing before use. The daily caps are not a guarantee of a maximum charge because each search can make multiple billable requests.
- Open-Meteo, Translink and QLDTraffic are free to read, but be considerate: the server caches them (weather 10 minutes, traffic 5 minutes, vehicles 15 seconds, alerts 60 seconds).

## Try the image locally

Docker was not available while this was written, so this has not been run:

```bash
docker build -f infra/plan-b-mvp/Dockerfile -t plan-b-mvp .
docker run --rm -p 8000:8000 -e MAPS_API_KEY=your_server_key -e MAPS_BROWSER_API_KEY=your_referrer_restricted_browser_key plan-b-mvp
```

Then open `http://localhost:8000`. Pass both keys with `-e` or `--env-file`; restrict the browser key to the local origin and Maps JavaScript API, and never bake either key into the image.
