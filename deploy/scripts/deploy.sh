#!/usr/bin/env sh
set -eu

IMAGE_NAME="${IMAGE_NAME:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-20}"
HEALTHCHECK_SLEEP="${HEALTHCHECK_SLEEP:-5}"
REGISTRY="${REGISTRY:-ghcr.io}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-}"

if [ -f .env ] && [ -z "${APP_PORT:-}" ]; then
  APP_PORT="$(grep -E '^APP_PORT=' .env | tail -n 1 | cut -d '=' -f 2- | tr -d '\r' || true)"
  export APP_PORT
fi

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:${APP_PORT:-4000}/}"

if [ -z "$IMAGE_NAME" ]; then
  echo "IMAGE_NAME is required"
  exit 1
fi

export IMAGE_NAME IMAGE_TAG

if [ -n "$REGISTRY_USERNAME" ] && [ -n "$REGISTRY_TOKEN" ]; then
  echo "$REGISTRY_TOKEN" | docker login "$REGISTRY" -u "$REGISTRY_USERNAME" --password-stdin
fi

echo "Deploying image: ${IMAGE_NAME}:${IMAGE_TAG}"
docker compose -f "$COMPOSE_FILE" pull app
docker compose -f "$COMPOSE_FILE" up -d --no-deps app
docker image prune -f

echo "Running health check: ${HEALTHCHECK_URL}"
i=1
while [ "$i" -le "$HEALTHCHECK_RETRIES" ]; do
  if curl -fsS "$HEALTHCHECK_URL" >/dev/null 2>&1; then
    echo "Health check passed"
    exit 0
  fi
  echo "Health check attempt ${i}/${HEALTHCHECK_RETRIES} failed"
  i=$((i + 1))
  sleep "$HEALTHCHECK_SLEEP"
done

echo "Health check failed after ${HEALTHCHECK_RETRIES} retries"
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" logs --tail=200 app
exit 1
