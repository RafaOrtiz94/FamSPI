const cron = require('node-cron');
const db = require('../config/db');
const logger = require('../config/logger');
const { STATUS } = require('../modules/equipment-purchases/equipmentPurchases.service');

/**
 * Job para verificar y cancelar reservas expiradas
 * Se ejecuta todos los días a las 00:00
 */
function startExpiredReservationsJob() {
    // Ejecutar a medianoche todos los días
    cron.schedule('0 0 * * *', async () => {
        logger.info('⏰ Iniciando job de verificación de reservas expiradas...');

        try {
            const { rows } = await db.query(
                `UPDATE equipment_purchase_requests
            SET status = $1,
                cancelled_at = now(),
                cancellation_reason = 'Cancelación automática por expiración de reserva (60 días)',
                updated_at = now()
          WHERE status NOT IN ($2, $3)
            AND reservation_expires_at IS NOT NULL
            AND reservation_expires_at < now()
          RETURNING id, client_name, reservation_expires_at`,
                [STATUS.CANCELLED, STATUS.COMPLETED, STATUS.CANCELLED]
            );

            if (rows.length > 0) {
                logger.info(`✅ Se cancelaron ${rows.length} reservas expiradas automáticamente.`);
                rows.forEach(row => {
                    logger.info(`   - Solicitud ${row.id} (${row.client_name}) expiró el ${new Date(row.reservation_expires_at).toLocaleDateString()}`);
                });
            } else {
                logger.info('✅ No se encontraron reservas expiradas para cancelar.');
            }

        } catch (error) {
            logger.error('❌ Error en job de reservas expiradas:', error);
        }
    });

    logger.info('✅ Job de verificación de reservas expiradas programado (00:00 diario)');
}

module.exports = startExpiredReservationsJob;
