# BC Sheet Generation - 5 Production Recommendations

1. **Queue-first architecture (already implemented)**
   - Keep frontend request fast with `202 Accepted`.
   - Process generation asynchronously via worker (`bc_sheet_generation_jobs`).
   - Benefit: avoids blocking API threads and prevents timeout cascades.

2. **Strict idempotency + deterministic payload hash (already implemented)**
   - Use `Idempotency-Key` and hashed canonical payload to avoid duplicate sheet creation.
   - Return same stored response for retries.
   - Benefit: safe retries from frontend, API gateway, or network failures.

3. **Defense-in-depth on WebApp calls (already implemented)**
   - Use short-lived signed payload (`timestamp` + HMAC SHA256) and shared auth token.
   - Add circuit breaker and timeout in backend client.
   - Benefit: limits abuse and protects backend from repeated downstream failures.

4. **Operational observability and SLOs (partially implemented)**
   - Expose queue counters, latency p50/p95, and circuit breaker state.
   - Add dashboards/alerts for:
     - `ready_to_process` backlog threshold
     - failure ratio (last 15m)
     - p95 generation latency
   - Benefit: early detection before user impact.

5. **Versioned mapping governance (ready for rollout)**
   - Lock each request with `mapping_version`.
   - Reject unknown versions at WebApp (`MAPPING_VERSION_ERROR`).
   - Keep change log for every mapping update and run smoke tests before enabling new version.
   - Benefit: prevents silent corruption when template or field map changes.
