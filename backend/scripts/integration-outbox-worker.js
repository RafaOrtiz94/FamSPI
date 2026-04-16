/**
 * integration-outbox-worker.js
 * Ejecutar:
 *   node scripts/integration-outbox-worker.js
 *   node scripts/integration-outbox-worker.js --limit=50 --max-attempts=5
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const logger = require("../src/config/logger");
const {
  processPendingOutboxBatch,
} = require("../src/modules/integrations/integrationOutboxWorker.service");

const readArgValue = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => String(value).startsWith(prefix));
  if (!arg) return null;
  return arg.slice(prefix.length);
};

const asNumber = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function main() {
  const limit = asNumber(
    readArgValue("limit") || process.env.INTEGRATION_OUTBOX_BATCH_LIMIT,
    20,
  );
  const maxAttempts = asNumber(
    readArgValue("max-attempts") || process.env.INTEGRATION_OUTBOX_MAX_ATTEMPTS,
    3,
  );

  const summary = await processPendingOutboxBatch({
    limit,
    maxAttempts,
  });

  logger.info(
    { limit, max_attempts: maxAttempts, summary },
    "[INTEGRATION_OUTBOX] Worker ejecutado",
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error(
      { error: error?.message || String(error), stack: error?.stack || null },
      "[INTEGRATION_OUTBOX] Worker fallo",
    );
    process.exit(1);
  });

