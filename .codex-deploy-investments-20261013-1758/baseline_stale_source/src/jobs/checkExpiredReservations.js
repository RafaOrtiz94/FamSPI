const db = require('../config/db');
const logger = require('../config/logger');
const { STATUS } = require('../modules/equipment-purchases/equipmentPurchases.service');
const { broadcastPurchaseUpdate } = require('../modules/equipment-purchases/purchaseEvents');

/**
 * Job para verificar y cancelar reservas expiradas
 * Se ejecuta todos los días a las 00:00 (ahora via Cloud Scheduler)
 */
function startExpiredReservationsJob() {
    // Esta función se mantiene por compatibilidad pero ya no programa el job
    // El scheduling ahora se maneja externamente via Cloud Scheduler
    logger.info('⚠️  Job de reservas expiradas - Scheduling movido a Cloud Scheduler');
    logger.info('⚠️  Use el endpoint POST /internal/jobs/equipment/reservations/expired');
}

async function runOnce() {
    logger.info('⏰ Ejecutando job de verificación de reservas expiradas...');

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

            for (const row of rows) {
                try {
                    const { rows: updatedRows } = await db.query(
                        'SELECT * FROM equipment_purchase_requests WHERE id = $1',
                        [row.id]
                    );
                    const updatedRequest = updatedRows[0];
                    if (updatedRequest) {
                        broadcastPurchaseUpdate({
                            request: updatedRequest,
                            action: 'reservation_expired',
                            meta: { reason: 'auto_cancel' }
                        });
                    }
                } catch (eventError) {
                    logger.warn({ eventError, purchaseId: row.id }, 'No se pudo emitir evento de reserva expirada');
                }
            }
        } else {
            logger.info('✅ No se encontraron reservas expiradas para cancelar.');
        }

        return { success: true, cancelled: rows.length };

    } catch (error) {
        logger.error('❌ Error en job de reservas expiradas:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { startExpiredReservationsJob, runOnce };
