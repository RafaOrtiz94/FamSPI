# Attendance Production Checklist

## Scope
This checklist is specific to attendance flows in FamSPI:
- Normal attendance
- Operational field exits/entries
- Unexpected exits
- Client visit marks
- Overtime reports (real vs acta)

Timezone baseline for all validations: `America/Guayaquil`.

## 1) Lock working schedule in environment
Configure and deploy:
- `ATTENDANCE_WORKING_DAY_START=09:00`
- `ATTENDANCE_WORKING_DAY_END=18:00`
- `ATTENDANCE_STANDARD_WORK_HOURS=8`
- `APP_TIMEZONE=America/Guayaquil`
- `TZ=America/Guayaquil`

Verification:
- `GET /api/v1/attendance/reportes/rango` returns `meta.workingHours` as configured.

## 2) Overtime real calculation must exclude labor window
Expected behavior:
- Only time outside `meta.workingHours` counts as real overtime.
- Example: field interval `08:00 -> 12:00` counts `01:00:00`.

Verification dataset:
- 08:00 -> 12:00 should be `01:00:00`
- 17:30 -> 19:00 should be `01:00:00`
- 09:00 -> 18:00 should be `00:00:00`

## 3) Geolocation quality gate
Reject/ignore invalid coordinates on mark endpoints:
- `0,0`
- Non numeric
- Out of range latitude/longitude

Operational rule:
- Keep mark action successful when location is invalid, but never persist invalid coordinates.
- Persist source/accuracy/timestamp only if coordinate is valid.

## 4) Nightly geodata cleanup and audit
Run a nightly script that:
- Detects invalid coordinates in attendance + field tables.
- Nullifies invalid geo fields.
- Logs row counts per table.

Runbook command:
```bash
npm run attendance:geo:sanitize -- --apply=true
```

Minimum audit output:
- execution timestamp
- cutoff range
- affected table
- updated rows

## 5) DB performance for attendance reports
Ensure indexes exist:
- `user_attendance_records (user_id, date)`
- `attendance_exceptions (user_id, date)`
- `client_visit_logs (user_email, visit_date)`
- `prospect_visits (user_email, visit_date)`

Check with:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'user_attendance_records',
    'attendance_exceptions',
    'client_visit_logs',
    'prospect_visits'
  );
```

## 6) Safe cleanup script for date ranges
Keep an auditable script with:
- dry-run mode
- apply mode
- per-table before/deleted/after counts
- transaction rollback on error

Use for emergency data cleanup only.

Commands:
```bash
# dry-run desde inicio hasta antes de ayer (Ecuador)
npm run attendance:purge:range

# aplicar rango puntual
npm run attendance:purge:range -- --apply=true --startDate=2026-01-01 --endDate=2026-01-31
```

## 7) Non-crossing flow invariants
Mandatory invariants in backend:
- Unexpected flow cannot start if operational flow is active.
- Operational flow cannot start if unexpected flow is active.
- Only one active flow instance per user per flow type.

Verify via API tests.

## 8) Reporting UX clarity
In attendance reports:
- Show `Real overtime` and `Acta overtime` as separate columns.
- Format durations as `HH:mm:ss`.
- Include formula tooltip/help text for both metrics.

## 9) Role-based QA execution
Execute manual QA by role:
- Collaborator
- Commercial user
- HR
- Admin

Minimum scenarios:
- normal mark cycle
- field operational cycle
- unexpected cycle
- client visit cycle
- late justification limit/cutoff
- approved leave/vacation reflected in acta

## 10) Runtime observability and alerts
Set dashboards/alerts on:
- `5xx` rate for attendance endpoints
- location sync failures
- invalid coordinate rejection count
- timezone mismatch incidents

Implemented log metrics in GCP project:
- `attendance_5xx_count`
- `attendance_location_sync_5xx_count`

Suggested alert thresholds:
- `5xx` > 2% over 10 min
- location sync failures > 5% over 15 min

## Go/No-Go gate
Go only if all are true:
- No blocker in the role-based QA matrix.
- Overtime real matches expected edge-case calculations.
- No invalid coordinates persisted in last 48h sample.
- Attendance endpoints healthy (`5xx` below threshold).
