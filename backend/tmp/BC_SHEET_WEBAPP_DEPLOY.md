# Business Case Sheets - Deploy Guide

## 1. Apps Script WebApp

1. Create a new Apps Script project in the same Google account that owns the template.
2. Paste `backend/tmp/business_case_sheet_webapp.gs` as `Code.gs`.
3. Open `Project Settings -> Script properties` and set:
   - `BC_TEMPLATE_FILE_ID`
   - `BC_OUTPUT_FOLDER_ID` (optional)
   - `BC_AUTH_TOKEN`
   - `BC_SIGNING_SECRET`
   - `BC_EXPECTED_MAPPING_VERSION` (example: `BC_MAPPING_v2026_01_15`)
   - `BC_MAX_TIMESTAMP_SKEW_MS` (optional, default `300000`)
4. Verify `FIELD_TO_CELL` and `INVESTMENT_ITEMS` in `Code.gs` match your final template version.
5. Deploy:
   - `Deploy -> New deployment -> Web app`
   - Execute as: `Me`
   - Access: `Anyone with the link` (security handled by HMAC + token)
6. Save the WebApp URL.

## 2. Backend env vars

Set in backend runtime:

- `BC_SHEET_WEBAPP_URL=<webapp_url>`
- `BC_SHEET_WEBAPP_SECRET=<same as BC_SIGNING_SECRET>`
- `BC_SHEET_WEBAPP_TOKEN=<same as BC_AUTH_TOKEN>`
- `BC_SHEET_MAPPING_VERSION=BC_MAPPING_v2026_01_15`
- `BC_SHEET_WEBAPP_TIMEOUT_MS=12000`
- `BC_SHEET_CIRCUIT_FAILURE_THRESHOLD=5`
- `BC_SHEET_CIRCUIT_RESET_MS=60000`
- `BC_SHEET_MAX_ATTEMPTS=3`
- `BC_SHEET_JOB_INTERVAL_MS=15000`
- `BC_SHEET_JOB_BATCH_LIMIT=10`
- `DRIVE_ROOT_FOLDER_ID=0AILKwXtcdfRFUk9PVA`
- `BC_DRIVE_PUBLIC_FOLDER_NAME=Publicos` (optional)
- `BC_DRIVE_PRIVATE_FOLDER_NAME=Privados` (optional)

## 3. API endpoints

- `POST /api/v1/business-case/:id/sheets/generate`
- `GET /api/v1/business-case/:id/sheets/jobs/latest`
- `GET /api/v1/business-case/:id/sheets/jobs/:jobId`
- `GET /api/v1/business-case/sheets/metrics` (admin)
- `POST /internal/jobs/business-case/sheets/process-queue` (JOBS_KEY)

## 4. Request example (enqueue)

```json
{
  "request_id": "f6f24194-9edf-4f6f-b976-4379485fc48d",
  "idempotency_key": "bc-sheet-001",
  "mapping_version": "BC_MAPPING_v2026_01_15",
  "fields": {
    "client_name": "Cliente Demo",
    "process_code": "SIE-001",
    "contract_object": "Adquisicion de equipos"
  },
  "inversiones": {
    "Servidor": { "cantidad": 1, "precio": 3200 }
  }
}
```

## 5. Operational notes

- Queue is persisted in `bc_sheet_generation_jobs`.
- Worker updates `equipment_purchase_requests.modern_bc_metadata.bc_sheet_generation`.
- Retries use exponential backoff and stop at `max_attempts`.
- Metrics endpoint exposes counters, latency (24h), and circuit breaker state.
- Drive hierarchy for BC documents: `DRIVE_ROOT_FOLDER_ID/{Publicos|Privados}/{Cliente}/BC-{id}`.
