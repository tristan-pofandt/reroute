# Plan B MVP deployment

Operational configuration for running the [Plan B MVP](../../apps/plan-b-mvp/README.md) somewhere other than a developer laptop, for example on an investor demo day. Nothing here has been deployed by an agent: the files were written and checked for syntax only, and the Docker image and the Render blueprint have not been built or applied.

| File | Purpose |
| --- | --- |
| `Dockerfile` | `python:3.13-slim` image that installs `apps/plan-b-mvp/requirements.txt` and runs `gunicorn -w 1 --threads 8 server:app`, listening on `HOST` (0.0.0.0) and `PORT` (8000) |
| `Dockerfile.dockerignore` | Keeps `.env` files, local `data/`, caches and tests out of the image (BuildKit reads it automatically) |
| `render.yaml` | Render Blueprint for one Docker web service; secrets are `sync: false` so they are typed into the dashboard |

## Read this first

- **A Terms of Use and Privacy Policy page is still required before public use.** Google's Routes API policy requires them for an app that shows Google routes to the public, and this repository does not contain them yet. A demo to invited investors on a QR code is still public use of the Google key, so write them first or keep the audience small and known.
- **Never commit keys.** `MAPS_API_KEY` and `VAPID_PRIVATE_KEY` live only in the host's environment settings. `.env` files are git-ignored and excluded from the image.
- **Use one worker.** The push monitor thread, the static GTFS loader and the feed caches live inside the Python process, so the container runs gunicorn with `-w 1` and eight threads. Do not scale it out to several instances without moving that state elsewhere.
- **Web Push and installing the app need HTTPS.** Both Render and a Cloudflare tunnel provide it. Plain `http://` on a laptop only works for `localhost`.

## Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `MAPS_API_KEY` | Yes, for live routes | Google Maps Platform key with Routes API and Places API (New) enabled; Elevation API is optional |
| `PUBLIC_URL` | Recommended | The address people use, for example `https://plan-b-mvp.onrender.com`. It is encoded by `/qr.svg`, shown in `/api/status`, and accepted by the Origin check |
| `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` | For push | Base64url VAPID key pair. If both are unset the server generates a pair once into `data/vapid.json`, which is lost on redeploy and would invalidate every browser subscription, so set them on any public host |
| `VAPID_SUBJECT` | No | Contact for push services, default `mailto:planb-demo@example.invalid`. Use a team mailbox, never a personal address |
| `HOST`, `PORT` | No | Bind address and port. The image sets `0.0.0.0` and `8000`; Render supplies `PORT` itself |
| `PLANB_TRUST_PROXY` | On a host | Number of reverse proxies in front of the app (the image and `render.yaml` set `1`) so the real visitor address is used for rate limiting |
| `PLANB_PLAN_LIMIT_PER_HOUR` | No | Searches per visitor address per hour, default 40. Address suggestions (`PLANB_AUTOCOMPLETE_LIMIT_PER_HOUR`, 400) and fuel prices (`PLANB_FUEL_LIMIT_PER_HOUR`, 120) have their own limits |
| `PLANB_DAILY_GOOGLE_CAP` | No | Searches per Brisbane day for everyone together, default 1500. `render.yaml` lowers it to 300 |
| `PLANB_DAILY_AUTOCOMPLETE_CAP` | No | Address suggestion requests per Brisbane day for everyone together, default 15000 |
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
3. When prompted, enter `MAPS_API_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT`. Leave `PUBLIC_URL` empty for the first deploy.
4. After the first deploy Render shows the service address (`https://plan-b-mvp-xxxx.onrender.com`). Set `PUBLIC_URL` to it and redeploy so the QR code and Origin check use it.
5. Open the address on a phone and run one search. `GET /api/status` should report `"live_available": true`, `"push": true` and, a minute or so after start, `"gtfs_static": {"state": "ready"}`.

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
- Under **API restrictions** allow only Routes API and Places API (New), plus Elevation API if you enabled it.
- The key is used from the server, so browser (HTTP referrer) restrictions do not apply. Use an **IP address restriction** only when the host has a fixed outbound address; check the host's documentation first, because a wrong restriction makes every search fail. A tunnel from a laptop on a changing network cannot be IP-restricted reliably, which is another reason to keep the caps low.
- In Google Cloud set **per-day quotas** for each of those APIs and a **billing budget with alerts**. The app's own caps (`PLANB_PLAN_LIMIT_PER_HOUR` and `PLANB_DAILY_GOOGLE_CAP`) are a second line of defence, not a replacement.
- A search makes one Routes request for public transport (about USD 0.005), one traffic-aware Routes request for driving (about USD 0.01) and, when not cached, fuel price (about USD 0.035), car park (about USD 0.032) and elevation lookups, so a first search costs roughly USD 0.02 to 0.10 at list prices before Google's free monthly usage. The demo mode of the app shows the count and approximate cost for each search; the price table is in `apps/plan-b-mvp/google_api.py` and was last checked on 2026-10-21. At the default cap of 1500 searches a day the worst case is well over USD 100 a day, which is why `render.yaml` sets 300.
- Open-Meteo, Translink and QLDTraffic are free to read, but be considerate: the server caches them (weather 10 minutes, traffic 5 minutes, vehicles 15 seconds, alerts 60 seconds).

## Try the image locally

Docker was not available while this was written, so this has not been run:

```bash
docker build -f infra/plan-b-mvp/Dockerfile -t plan-b-mvp .
docker run --rm -p 8000:8000 -e MAPS_API_KEY=your_key_here plan-b-mvp
```

Then open `http://localhost:8000`. Pass the key with `-e` or `--env-file`; never bake it into the image.
