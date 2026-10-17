const logger = require("../config/logger");
const db = require("../config/db");
const { isOffHours } = require("../utils/offHoursPolicy");
const { registerOffHoursJob } = require("./offHoursCoordinator");

// Desactiva cuentas de pasante (auth_provider=local) cuya account_expires_at
// ya paso hace mas de N dias -- el login ya las rechaza en cuanto vencen
// (ver auth.controller.js::localAuthLogin), pero sin este job la cuenta
// sigue "active=true" indefinidamente: un riesgo de seguridad real, no
// hipotetico (misma logica de "cuentas huerfanas" que offboarding_requested
// ya cubre para colaboradores). El margen de N dias (no desactivar el mismo
// dia que vence) da tiempo a Talento Humano/TI de renovar la pasantia sin
// que la cuenta quede inactiva por un vencimiento de ultimo minuto.
const GRACE_DAYS = Number(process.env.PASANTE_EXPIRY_GRACE_DAYS || 3);
const DEFAULT_INTERVAL_MINUTES = Number(process.env.PASANTE_EXPIRY_INTERVAL_MINUTES || 720); // 12h
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

async function deactivateExpiredPasanteAccounts() {
  const { rows } = await db.query(
    `
    UPDATE users
    SET active = false, updated_at = NOW()
    WHERE auth_provider = 'local'
      AND COALESCE(active, true) = true
      AND account_expires_at IS NOT NULL
      AND account_expires_at < NOW() - ($1 || ' days')::interval
    RETURNING id, email, fullname, account_expires_at
    `,
    [GRACE_DAYS],
  );
  return { deactivated: rows.length, users: rows };
}

async function runOnce() {
  const result = await deactivateExpiredPasanteAccounts();
  if (result.deactivated > 0) {
    logger.info(
      { count: result.deactivated, userIds: result.users.map((u) => u.id) },
      "[PASANTE_EXPIRY] Cuentas de pasante desactivadas por vencimiento",
    );
  }
  return result;
}

let interval = null;

function startPasanteAccountExpiryJob() {
  if (interval) return;
  const everyMs = Math.max(60, DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  logger.info(`Pasante account expiry job configurado cada ${Math.round(everyMs / 60000)} min`);
  if (process.env.ENABLE_JOBS === "true" && SHOULD_RUN_ON_START) {
    runOnce().catch((error) => logger.error({ error }, "Error inicial pasante account expiry job"));
  }
  interval = setInterval(() => {
    if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
    runOnce().catch((error) => logger.error({ error }, "Error pasante account expiry job"));
  }, everyMs);
  registerOffHoursJob({
    name: "pasante_account_expiry",
    runOnce,
    offHoursIntervalMs: everyMs * 2,
  });
}

module.exports = {
  runOnce,
  startPasanteAccountExpiryJob,
  deactivateExpiredPasanteAccounts,
};
