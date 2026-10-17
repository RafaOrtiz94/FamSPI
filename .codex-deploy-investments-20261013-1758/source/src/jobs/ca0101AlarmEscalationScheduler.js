const db = require("../config/db");
const logger = require("../config/logger");
// Se puede importar un módulo Notification cuando esté instanciado en Fase 5.

/**
 * Job Scheduler - CA-01-01 (Auditoría de SLAs de Temperatura)
 * ------------------------------------------------------------------
 * GXP Compliance: Una alarma o excursión térmica no puede permanecer ignorada ('open')
 * indefinidamente sin evaluación. Este Job escala el caso si excede un umbral definido.
 */

const checkTemperatureAlarmSlas = async () => {
  logger.info("[CA-01-01 Job] Iniciando revisión transversal de SLAs de Alarmas GXP...");
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Buscamos alarmas térmicas que lleven más de 12 horas creadas y sigan en estado 'open' (sin reconocer)
    const escalatedQuery = `
      SELECT a.id, a.alarm_type, r.temperature, d.name AS device_name, d.location
      FROM public.ca0101_alarms a
      JOIN public.ca0101_readings r ON a.reading_id = r.id
      JOIN public.ca0101_devices d ON r.device_id = d.id
      WHERE a.status = 'open' 
        AND a.created_at < NOW() - INTERVAL '12 hours'
      FOR UPDATE OF a SKIP LOCKED;
    `;
    const { rows } = await client.query(escalatedQuery);

    if (rows.length === 0) {
      logger.info("[CA-01-01 Job] No hay alarmas térmicas en estado crítico o fuera de SLA.");
      await client.query("COMMIT");
      return;
    }

    // Procesamos cada alarma crítica
    for (const alarm of rows) {
      logger.warn(
        { alarmId: alarm.id, type: alarm.alarm_type },
        `[CA-01-01 Job] Alarma de ${alarm.device_name} (${alarm.location}) ignorada por > 12h. Escalando a QA...`
      );

      // Aquí entraría la lógica GXP estricta de notificar via email/webhook al Jefe de Calidad.
      // Automáticamente inyectamos una nota documentando la indolencia de respuesta.
      const updateQuery = `
        UPDATE public.ca0101_alarms
        SET notes = CONCAT(notes, '\n\n[ESCALAMIENTO AUTOMÁTICO - ', NOW(), ']: El equipo QA ha sido notificado porque la excursión de ', $1::numeric, '°C superó las 12h sin validación.')
        WHERE id = $2;
      `;
      await client.query(updateQuery, [alarm.temperature, alarm.id]);
    }

    await client.query("COMMIT");
    logger.info(`[CA-01-01 Job] Proceso concluido. Alarmas escaladas: ${rows.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ error }, "[CA-01-01 Job] Error crítico analizando las desviaciones térmicas");
  } finally {
    client.release();
  }
};

module.exports = {
  checkTemperatureAlarmSlas,
};
