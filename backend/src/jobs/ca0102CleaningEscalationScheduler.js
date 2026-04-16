const cron = require("node-cron");
const db = require("../config/db");
const logger = require("../config/logger");

/**
 * CRON Job - CA-01-02 Limpieza de Áreas
 * Verifica que los registros de limpieza en áreas de alto riesgo
 * no lleven más de 24h sin verificación QA.
 * Escalamiento: actualiza `qa_notes` con alerta de SLA vencido.
 */

const ESCALATION_THRESHOLD_HOURS = 24;

const escalateOverdueLogs = async () => {
  logger.info("CA-01-02 SLA Scheduler: Iniciando revisión de registros sin verificar...");

  const client = await db.connect();
  try {
    // Selección concurrentemente segura con FOR UPDATE SKIP LOCKED
    const { rows: overdueLogs } = await client.query(`
      SELECT l.id, l.area_id, a.name AS area_name, a.risk_level, l.created_at
      FROM public.ca0102_cleaning_logs l
      JOIN public.ca0102_areas a ON l.area_id = a.id
      WHERE l.status = 'executed'
        AND a.risk_level IN ('high', 'sterile')
        AND l.deleted_at IS NULL
        AND l.created_at < NOW() - INTERVAL '${ESCALATION_THRESHOLD_HOURS} hours'
      FOR UPDATE SKIP LOCKED
    `);

    if (overdueLogs.length === 0) {
      logger.info("CA-01-02 SLA Scheduler: Sin registros vencidos.");
      return;
    }

    for (const log of overdueLogs) {
      await client.query(`
        UPDATE public.ca0102_cleaning_logs
        SET qa_notes = CONCAT(COALESCE(qa_notes, ''), ' | ⚠ SLA VENCIDO: Verificación QA requerida urgentemente (>24h en área ${log.risk_level.toUpperCase()}).')
        WHERE id = $1
      `, [log.id]);

      logger.warn({ logId: log.id, area: log.area_name, riskLevel: log.risk_level },
        "CA-01-02: SLA vencido detectado — escalamiento inyectado en qa_notes.");
    }

  } catch (err) {
    logger.error({ err }, "CA-01-02 SLA Scheduler: Error durante escalamiento.");
  } finally {
    client.release();
  }
};

// Ejecutar cada 30 minutos
cron.schedule("*/30 * * * *", escalateOverdueLogs);

module.exports = { escalateOverdueLogs };
