#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
RUN_REGION="${RUN_REGION:-us-central1}"
SCHEDULER_LOCATION="${SCHEDULER_LOCATION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-spi-backend}"
JOB_NAME="${JOB_NAME:-db-backup-to-drive}"
SCHEDULE="${SCHEDULE:-0 3 * * *}"
TIME_ZONE="${TIME_ZONE:-America/Guayaquil}"
JOBS_KEY="${JOBS_KEY:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID no definido y gcloud no tiene proyecto activo." >&2
  exit 1
fi

if [[ -z "${JOBS_KEY}" ]]; then
  echo "JOBS_KEY no definido. Exporta JOBS_KEY antes de crear el scheduler." >&2
  exit 1
fi

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${RUN_REGION}" \
  --format='value(status.url)')"

if [[ -z "${SERVICE_URL}" ]]; then
  echo "No se pudo resolver la URL de Cloud Run para ${SERVICE_NAME}." >&2
  exit 1
fi

TARGET_URI="${SERVICE_URL}/internal/jobs/database/backup"

if gcloud scheduler jobs describe "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --location "${SCHEDULER_LOCATION}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${JOB_NAME}" \
    --project "${PROJECT_ID}" \
    --location "${SCHEDULER_LOCATION}" \
    --schedule "${SCHEDULE}" \
    --time-zone "${TIME_ZONE}" \
    --uri "${TARGET_URI}" \
    --http-method POST \
    --headers "x-jobs-key=${JOBS_KEY}"
else
  gcloud scheduler jobs create http "${JOB_NAME}" \
    --project "${PROJECT_ID}" \
    --location "${SCHEDULER_LOCATION}" \
    --schedule "${SCHEDULE}" \
    --time-zone "${TIME_ZONE}" \
    --uri "${TARGET_URI}" \
    --http-method POST \
    --headers "x-jobs-key=${JOBS_KEY}"
fi

echo "Scheduler listo:"
echo "  project: ${PROJECT_ID}"
echo "  service: ${SERVICE_NAME}"
echo "  uri: ${TARGET_URI}"
echo "  schedule: ${SCHEDULE} (${TIME_ZONE})"
