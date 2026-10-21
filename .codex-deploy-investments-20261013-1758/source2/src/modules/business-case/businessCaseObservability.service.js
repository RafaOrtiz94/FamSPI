const logger = require("../../config/logger");

const API_RETENTION_MS = 15 * 60 * 1000; // 15 min
const FRONT_RETENTION_MS = 60 * 60 * 1000; // 60 min

class BusinessCaseObservabilityService {
  constructor() {
    this.apiEvents = [];
    this.frontEvents = [];
    this.lastAlerts = new Map();
    this.thresholds = {
      rpmSpike: Number(process.env.BC_OBS_SPIKE_RPM || 120),
      p95WarnMs: Number(process.env.BC_OBS_P95_WARN_MS || 1200),
      errorRateWarn: Number(process.env.BC_OBS_ERROR_RATE_WARN || 0.1),
      alertCooldownMs: Number(process.env.BC_OBS_ALERT_COOLDOWN_MS || 5 * 60 * 1000),
    };
  }

  normalizePath(path = "") {
    return String(path || "")
      .replace(/\?.*$/, "")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:id");
  }

  cleanup(now = Date.now()) {
    const minApiTs = now - API_RETENTION_MS;
    const minFrontTs = now - FRONT_RETENTION_MS;
    this.apiEvents = this.apiEvents.filter((item) => item.ts >= minApiTs);
    this.frontEvents = this.frontEvents.filter((item) => item.ts >= minFrontTs);
  }

  percentile(values = [], p = 95) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[index] || 0;
  }

  maybeAlert(key, message, payload) {
    const now = Date.now();
    const lastAt = this.lastAlerts.get(key) || 0;
    if (now - lastAt < this.thresholds.alertCooldownMs) return;
    this.lastAlerts.set(key, now);
    logger.warn(payload, message);
  }

  recordApiCall({ method, path, statusCode, durationMs }) {
    const now = Date.now();
    const endpoint = `${String(method || "GET").toUpperCase()} ${this.normalizePath(path)}`;
    this.apiEvents.push({
      ts: now,
      endpoint,
      method: String(method || "GET").toUpperCase(),
      path: this.normalizePath(path),
      statusCode: Number(statusCode || 0),
      durationMs: Number(durationMs || 0),
    });
    this.cleanup(now);
    this.evaluateEndpointHealth(endpoint, now);
  }

  evaluateEndpointHealth(endpoint, now = Date.now()) {
    const since = now - 60 * 1000;
    const events = this.apiEvents.filter((item) => item.endpoint === endpoint && item.ts >= since);
    if (!events.length) return;

    const rpm = events.length;
    const durations = events.map((item) => item.durationMs);
    const p95 = this.percentile(durations, 95);
    const errorCount = events.filter((item) => item.statusCode >= 500).length;
    const errorRate = errorCount / events.length;

    if (rpm >= this.thresholds.rpmSpike) {
      this.maybeAlert(
        `rpm:${endpoint}`,
        "[BC][OBS] Pico de trafico detectado en endpoint",
        { endpoint, rpm, threshold: this.thresholds.rpmSpike },
      );
    }
    if (p95 >= this.thresholds.p95WarnMs) {
      this.maybeAlert(
        `p95:${endpoint}`,
        "[BC][OBS] Latencia p95 elevada en endpoint",
        { endpoint, p95, threshold: this.thresholds.p95WarnMs },
      );
    }
    if (errorRate >= this.thresholds.errorRateWarn) {
      this.maybeAlert(
        `err:${endpoint}`,
        "[BC][OBS] Tasa de error elevada en endpoint",
        { endpoint, errorRate, errors: errorCount, total: events.length, threshold: this.thresholds.errorRateWarn },
      );
    }
  }

  registerFrontendEvents(events = [], context = {}) {
    const now = Date.now();
    const safeEvents = Array.isArray(events) ? events : [];
    const accepted = [];

    for (const event of safeEvents) {
      if (!event || typeof event !== "object") continue;
      const section = String(event.section || event.module || "unknown").trim().slice(0, 80);
      const type = String(event.type || "event").trim().slice(0, 80);
      const durationMs = Number(event.durationMs || 0);
      const success = event.success !== false;
      accepted.push({
        ts: now,
        section,
        type,
        success,
        durationMs: Number.isFinite(durationMs) ? durationMs : 0,
        meta: {
          source: event.source || null,
          role: context?.role || null,
          user: context?.user || null,
        },
      });
    }

    if (accepted.length) {
      this.frontEvents.push(...accepted);
      this.cleanup(now);
    }

    return accepted.length;
  }

  getSnapshot() {
    const now = Date.now();
    this.cleanup(now);
    const since5m = now - 5 * 60 * 1000;
    const apiRecent = this.apiEvents.filter((item) => item.ts >= since5m);
    const frontRecent = this.frontEvents.filter((item) => item.ts >= since5m);

    const endpoints = this.buildEndpointRows(apiRecent);

    const sectionMap = new Map();
    for (const event of frontRecent) {
      const key = `${event.section}:${event.type}`;
      if (!sectionMap.has(key)) sectionMap.set(key, []);
      sectionMap.get(key).push(event);
    }
    const frontend = Array.from(sectionMap.entries())
      .map(([key, events]) => {
        const [section, type] = key.split(":");
        const durations = events.map((item) => item.durationMs);
        const failures = events.filter((item) => !item.success).length;
        return {
          section,
          type,
          total: events.length,
          avg_ms: events.length ? Number((durations.reduce((acc, cur) => acc + cur, 0) / events.length).toFixed(2)) : 0,
          p95_ms: this.percentile(durations, 95),
          failure_rate: events.length ? Number((failures / events.length).toFixed(4)) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      window_minutes: 5,
      captured_at: new Date(now).toISOString(),
      thresholds: this.thresholds,
      api: {
        total_events: apiRecent.length,
        endpoints,
      },
      frontend: {
        total_events: frontRecent.length,
        breakdown: frontend,
      },
    };
  }

  buildEndpointRows(events = []) {
    const endpointMap = new Map();
    for (const event of events) {
      if (!endpointMap.has(event.endpoint)) endpointMap.set(event.endpoint, []);
      endpointMap.get(event.endpoint).push(event);
    }
    return Array.from(endpointMap.entries())
      .map(([endpoint, events]) => {
        const durations = events.map((item) => item.durationMs);
        const errors = events.filter((item) => item.statusCode >= 500).length;
        return {
          endpoint,
          total: events.length,
          p50_ms: this.percentile(durations, 50),
          p95_ms: this.percentile(durations, 95),
          error_rate: events.length ? Number((errors / events.length).toFixed(4)) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  getOperationalDashboard() {
    const now = Date.now();
    this.cleanup(now);
    const since15m = now - 15 * 60 * 1000;
    const apiRecent = this.apiEvents.filter((item) => item.ts >= since15m);
    const endpointRows = this.buildEndpointRows(apiRecent);
    const durations = apiRecent.map((item) => item.durationMs);
    const errors = apiRecent.filter((item) => item.statusCode >= 500).length;
    const total = apiRecent.length;

    return {
      window_minutes: 15,
      captured_at: new Date(now).toISOString(),
      summary: {
        total_requests: total,
        total_errors: errors,
        error_rate: total ? Number((errors / total).toFixed(4)) : 0,
        p50_ms: this.percentile(durations, 50),
        p95_ms: this.percentile(durations, 95),
      },
      top_endpoints: endpointRows.slice(0, 10),
      top_latency: [...endpointRows]
        .sort((a, b) => b.p95_ms - a.p95_ms)
        .slice(0, 10),
      top_error_rate: endpointRows
        .filter((row) => row.total >= 5)
        .sort((a, b) => b.error_rate - a.error_rate)
        .slice(0, 10),
      thresholds: {
        p95_warn_ms: this.thresholds.p95WarnMs,
        error_rate_warn: this.thresholds.errorRateWarn,
      },
    };
  }
}

module.exports = new BusinessCaseObservabilityService();
