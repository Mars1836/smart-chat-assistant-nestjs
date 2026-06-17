#!/usr/bin/env sh
set -eu

IMAGE_NAME="${IMAGE_NAME:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:${APP_PORT:-4000}/}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-10}"
HEALTHCHECK_SLEEP="${HEALTHCHECK_SLEEP:-5}"

if [ -z "$IMAGE_NAME" ]; then
  echo "IMAGE_NAME is required"
  exit 1
fi

export IMAGE_NAME IMAGE_TAG

echo "Deploying image: ${IMAGE_NAME}:${IMAGE_TAG}"
docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d

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
exit 1
