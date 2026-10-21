# Plan B MVP: Flask app served by gunicorn.
# Build from the repository root so the app folder is in the build context:
#   docker build -f infra/plan-b-mvp/Dockerfile -t plan-b-mvp .
#   docker run --rm -p 8000:8000 -e MAPS_API_KEY=... plan-b-mvp
FROM python:3.13-slim

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

# The app writes the ride board, push subscriptions, VAPID keys and the cached GTFS index to PLANB_DATA_DIR.
RUN useradd --create-home --uid 10001 planb && mkdir -p /app/data && chown -R planb:planb /app/data
USER planb

EXPOSE 8000

# One worker on purpose: the background push monitor, GTFS loader and feed caches live in the process.
CMD ["sh", "-c", "exec gunicorn --workers 1 --threads 8 --timeout 60 --bind ${HOST}:${PORT} --access-logfile - server:app"]
