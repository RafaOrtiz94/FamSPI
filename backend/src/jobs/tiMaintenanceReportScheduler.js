/**
 * TI Maintenance Report — Auto-generation Scheduler
 * Generates the annual maintenance schedule report automatically.
 * Runs on the 1st of each month at 07:00 (Ecuador time).
 * Can also be triggered manually via API.
 */

const logger = require("../config/logger");
const { generateAndStoreMaintenanceReport } = require("../modules/ti-assets/tiAssets.report");

const INTERVAL_HOURS = Number(process.env.TI_REPORT_AUTO_INTERVAL_HOURS || 720); // ~monthly
const AUTO_ENABLED = String(process.env.TI_REPORT_AUTO_ENABLED || "false").toLowerCase() === "true";

let _timer = null;
let _running = false;

async function runReportGeneration() {
  if (_running) {
    logger.warn("[TI REPORT SCHEDULER] Skipping run: previous run still in progress");
    return null;
  }
  _running = true;
  const year = new Date().getFullYear();
  logger.info(`[TI REPORT SCHEDULER] Starting auto-generation for year ${year}`);
  try {
    const result = await generateAndStoreMaintenanceReport({
      year,
      userId: null,
      generatedByName: "Sistema (automático)",
    });
    logger.info(
      { reportId: result.id, sha256: result.sha256, assets: result.assets_count },
      `[TI REPORT SCHEDULER] Report generated successfully`
    );
    return result;
  } catch (err) {
    logger.error({ err }, "[TI REPORT SCHEDULER] Auto-generation failed");
    return null;
  } finally {
    _running = false;
  }
}

function startTiMaintenanceReportJob() {
  if (!AUTO_ENABLED) {
    logger.info("[TI REPORT SCHEDULER] Auto-generation disabled (TI_REPORT_AUTO_ENABLED=false)");
    return;
  }
  if (_timer) return;
  const intervalMs = INTERVAL_HOURS * 3600 * 1000;
  // Fire first run after a short delay so the server finishes booting
  setTimeout(async () => {
    await runReportGeneration();
    _timer = setInterval(runReportGeneration, intervalMs);
  }, 30000);
  logger.info(`[TI REPORT SCHEDULER] Scheduled every ${INTERVAL_HOURS}h`);
}

module.exports = { startTiMaintenanceReportJob, runReportGeneration };
