/**
 * integration-reconcile-report.js
 *
 * Uso:
 *   node scripts/integration-reconcile-report.js
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const db = require("../src/config/db");

const EMPTY_REPORT = Object.freeze({
  pending: 0,
  processing: 0,
  sent: 0,
  failed: 0,
  dead: 0,
  oldestPendingAgeSec: 0,
});

async function buildReport() {
  const { rows: countRows } = await db.query(
    `
    SELECT status, COUNT(*)::int AS total
    FROM public.integration_outbox
    GROUP BY status
    `,
  );

  const counts = { ...EMPTY_REPORT };
  for (const row of countRows || []) {
    const status = String(row.status || "").trim().toLowerCase();
    const total = Number.parseInt(String(row.total || "0"), 10) || 0;
    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] = total;
    }
  }

  const { rows: pendingRows } = await db.query(
    `
    SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0)::int AS oldest_pending_age_sec
    FROM public.integration_outbox
    WHERE status = 'pending'
    `,
  );

  counts.oldestPendingAgeSec = Number.parseInt(
    String(pendingRows?.[0]?.oldest_pending_age_sec || "0"),
    10,
  ) || 0;

  return counts;
}

async function main() {
  try {
    const report = await buildReport();
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    // Tabla no creada aun: devolver reporte vacio sin romper operacion.
    if (error?.code === "42P01") {
      process.stdout.write(`${JSON.stringify(EMPTY_REPORT)}\n`);
      return;
    }
    throw error;
  } finally {
    if (db.pool && typeof db.pool.end === "function") {
      await db.pool.end();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ error: error?.message || String(error), code: error?.code || null })}\n`,
    );
    process.exit(1);
  });
