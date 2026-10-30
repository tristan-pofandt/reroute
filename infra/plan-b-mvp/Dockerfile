# Plan B MVP: Flask app served by gunicorn.
# Build from the repository root so the app folder is in the build context:
#   docker build -f infra/plan-b-mvp/Dockerfile -t plan-b-mvp .
#   docker run --rm -p 8000:8000 -e MAPS_API_KEY=... plan-b-mvp
# Stage 1: build the React shell (apps/plan-b-mvp/web) into static files. Only web/dist ships from this stage.
FROM node:25-slim AS web
WORKDIR /web
COPY apps/plan-b-mvp/web/package.json apps/plan-b-mvp/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
# Same value as stage 2, so the front-end release tag (crash reports, analytics) matches /healthz.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
# Public domain and contact mailboxes baked into the pages (web/src/config/site.js); empty = the placeholder defaults.
ARG VITE_SITE_DOMAIN=
ARG VITE_SUPPORT_EMAIL=
ARG VITE_ABUSE_EMAIL=
ARG VITE_PRIVACY_EMAIL=
ENV VITE_SITE_DOMAIN=$VITE_SITE_DOMAIN VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL VITE_ABUSE_EMAIL=$VITE_ABUSE_EMAIL VITE_PRIVACY_EMAIL=$VITE_PRIVACY_EMAIL
COPY apps/plan-b-mvp/web/ ./
RUN npm run build

# Stage 2: the Flask app. server.py serves web/dist, and falls back to the plain index.html if it is missing.
FROM python:3.13-slim

# The commit shown by /healthz: docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) ...
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    PLANB_DATA_DIR=/app/data \
    PLANB_TRUST_PROXY=1

WORKDIR /app

COPY apps/plan-b-mvp/requirements.txt ./
RUN pip install -r requirements.txt

COPY apps/plan-b-mvp/ ./
COPY --from=web /web/dist ./web/dist

# The app writes the ride board, push subscriptions, VAPID keys and the cached GTFS index to PLANB_DATA_DIR.
RUN useradd --create-home --uid 10001 planb && mkdir -p /app/data && chown -R planb:planb /app/data
USER planb

EXPOSE 8000

# One worker on purpose: the background push monitor, GTFS loader and feed caches live in the process.
CMD ["sh", "-c", "exec gunicorn --workers 1 --threads 8 --timeout 60 --bind ${HOST}:${PORT} --access-logfile - --access-logformat '%(m)s %(U)s %(s)s %(b)s %(L)s' server:app"]
