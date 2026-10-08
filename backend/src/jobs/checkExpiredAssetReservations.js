const db = require('../config/db');
const logger = require('../config/logger');

/**
 * Job para expirar reservas de equipment_asset_reservations (inventario
 * de equipment-management) cuyo expires_at ya paso, y devolver el asset a
 * su estado previo. Se dispara via Cloud Scheduler -> POST /internal/jobs
 * (mismo patron que checkExpiredReservations.js, pero esa es otra tabla:
 * equipment_purchase_requests, dominio de compras publicas).
 */
async function runOnce() {
    logger.info('⏰ Ejecutando job de verificación de reservas de equipo expiradas...');

    try {
        const { rows } = await db.query(
            `UPDATE public.equipment_asset_reservations
                SET status = 'expired', updated_at = now()
              WHERE status = 'active'
                AND expires_at IS NOT NULL
                AND expires_at < now()
             RETURNING id, asset_id, previous_status, business_case_id`
        );

        for (const row of rows) {
            await db.query(
                `UPDATE public.equipment_assets
                    SET current_status = COALESCE($1, current_status),
                        negotiated_by_module = NULL,
                        negotiation_reference_id = NULL,
                        updated_at = now()
                  WHERE id = $2 AND current_status = 'reserved'`,
                [row.previous_status, row.asset_id],
            );

            await db.query(
                `INSERT INTO public.equipment_asset_events (asset_id, event_type, from_status, to_status, payload)
                 VALUES ($1, 'expired', 'reserved', $2, $3::jsonb)`,
                [row.asset_id, row.previous_status || 'reserved', JSON.stringify({ reservation_id: row.id, business_case_id: row.business_case_id })],
            );
        }

        logger.info(`✅ Se expiraron ${rows.length} reservas de equipo.`);
        return { success: true, expired: rows.length };
    } catch (error) {
        logger.error('❌ Error en job de reservas de equipo expiradas:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { runOnce };
