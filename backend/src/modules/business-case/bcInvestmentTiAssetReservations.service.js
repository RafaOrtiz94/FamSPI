/**
 * bcInvestmentTiAssetReservations.service.js
 *
 * Vincula un activo TI concreto (por serie) a una linea de "Inversiones
 * adicionales" del Business Case. Solo jefe_ti puede reservar (ver
 * businessCase.controller.js). Un activo queda apartado exclusivamente para
 * ese BC hasta que:
 *   - el BC se declare no factible -> se libera (ver releaseAllForBusinessCase,
 *     enganchado desde businessCase.service.js donde se guarda is_feasible).
 *   - el expediente de compras vinculado se marque como entregado -> el activo
 *     pasa a custodia de cliente (reusa moveAssetCustody de ti-assets.service.js,
 *     enganchado desde los state machines de compras privada/publica).
 *   - TI la libera a mano.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { moveAssetCustody } = require("../ti-assets/tiAssets.service");

const RESERVABLE_STATUSES = new Set(["available", "unassigned"]);

function httpError(message, status = 400, code = "BC_TI_RESERVATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

async function appendAssetEvent(dbOrClient, { assetId, eventType, payload, userId }) {
  await dbOrClient.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1, $2, $3::jsonb, $4, now())`,
    [assetId, eventType, JSON.stringify(payload || {}), userId || null],
  );
}

// Activos disponibles para reservar (busqueda por nombre/marca/modelo/serie/caracteristicas).
async function searchReservableAssets({ q, limit = 30 }) {
  const params = [];
  const where = ["a.active = true", "a.status = ANY($1::text[])"];
  params.push(Array.from(RESERVABLE_STATUSES));
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    where.push(`(
      LOWER(a.name) LIKE $${params.length}
      OR LOWER(COALESCE(a.brand,'')) LIKE $${params.length}
      OR LOWER(COALESCE(a.model,'')) LIKE $${params.length}
      OR LOWER(COALESCE(a.serial_number,'')) LIKE $${params.length}
      OR LOWER(a.characteristics::text) LIKE $${params.length}
    )`);
  }
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  params.push(safeLimit);
  const { rows } = await db.query(
    `SELECT a.id, a.asset_code, a.name, a.brand, a.model, a.serial_number, a.characteristics, a.status
       FROM public.ti_assets a
      WHERE ${where.join(" AND ")}
      ORDER BY a.name ASC
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function listReservationsForSelection({ businessCaseId, catalogId }) {
  const { rows } = await db.query(
    `SELECT r.id, r.status, r.reserved_at, r.released_at, r.released_reason,
            a.id AS ti_asset_id, a.asset_code, a.name, a.brand, a.model, a.serial_number, a.characteristics
       FROM public.bc_investment_ti_asset_reservations r
       JOIN public.ti_assets a ON a.id = r.ti_asset_id
      WHERE r.business_case_id = $1 AND r.catalog_id = $2 AND r.status = 'reserved'
      ORDER BY r.reserved_at ASC`,
    [businessCaseId, catalogId],
  );
  return rows;
}

async function reserveAsset({ businessCaseId, catalogId, tiAssetId, user }) {
  const selection = await db.query(
    `SELECT quantity FROM public.bc_investment_selections WHERE business_case_id = $1 AND catalog_id = $2 AND selected = true`,
    [businessCaseId, catalogId],
  );
  if (!selection.rows.length) {
    throw httpError("Primero agrega este item a la lista de inversiones (con cantidad) antes de reservar un activo.", 409, "SELECTION_NOT_FOUND");
  }
  const quantity = Number(selection.rows[0].quantity) || 0;

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const currentCount = await client.query(
      `SELECT count(*)::int AS n FROM public.bc_investment_ti_asset_reservations
        WHERE business_case_id = $1 AND catalog_id = $2 AND status = 'reserved'`,
      [businessCaseId, catalogId],
    );
    if (currentCount.rows[0].n >= quantity) {
      throw httpError(`Ya hay ${quantity} activo(s) reservado(s), igual a la cantidad de este item. Sube la cantidad para reservar otro.`, 409, "QUANTITY_LIMIT_REACHED");
    }

    const assetRows = await client.query(`SELECT * FROM public.ti_assets WHERE id = $1 FOR UPDATE`, [tiAssetId]);
    const asset = assetRows.rows[0];
    if (!asset) throw httpError("Activo TI no encontrado", 404, "ASSET_NOT_FOUND");
    if (!RESERVABLE_STATUSES.has(asset.status)) {
      throw httpError(`El activo ${asset.asset_code || asset.name} no esta disponible (estado actual: ${asset.status}).`, 409, "ASSET_NOT_AVAILABLE");
    }

    const inserted = await client.query(
      `INSERT INTO public.bc_investment_ti_asset_reservations
         (business_case_id, catalog_id, ti_asset_id, status, reserved_by)
       VALUES ($1, $2, $3, 'reserved', $4)
       RETURNING *`,
      [businessCaseId, catalogId, tiAssetId, user?.id || null],
    );

    await client.query(
      `UPDATE public.ti_assets SET status = 'reserved', updated_by = $2, updated_at = now() WHERE id = $1`,
      [tiAssetId, user?.id || null],
    );
    await appendAssetEvent(client, {
      assetId: tiAssetId,
      eventType: "reserved_for_business_case",
      payload: { business_case_id: businessCaseId, catalog_id: catalogId, reservation_id: inserted.rows[0].id },
      userId: user?.id,
    });

    await client.query("COMMIT");
    return listReservationsForSelection({ businessCaseId, catalogId });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function releaseReservation({ reservationId, businessCaseId, user, reason = "manual" }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const rows = await client.query(
      `SELECT * FROM public.bc_investment_ti_asset_reservations WHERE id = $1 AND business_case_id = $2 FOR UPDATE`,
      [reservationId, businessCaseId],
    );
    const reservation = rows.rows[0];
    if (!reservation) throw httpError("Reserva no encontrada", 404, "RESERVATION_NOT_FOUND");
    if (reservation.status !== "reserved") {
      throw httpError("Esta reserva ya no esta activa", 409, "RESERVATION_NOT_ACTIVE");
    }

    await client.query(
      `UPDATE public.bc_investment_ti_asset_reservations
          SET status = 'released', released_at = now(), released_reason = $2
        WHERE id = $1`,
      [reservationId, reason],
    );
    await client.query(
      `UPDATE public.ti_assets SET status = 'available', updated_by = $2, updated_at = now()
        WHERE id = $1 AND status = 'reserved'`,
      [reservation.ti_asset_id, user?.id || null],
    );
    await appendAssetEvent(client, {
      assetId: reservation.ti_asset_id,
      eventType: "reservation_released",
      payload: { business_case_id: businessCaseId, catalog_id: reservation.catalog_id, reservation_id: reservationId, reason },
      userId: user?.id,
    });

    await client.query("COMMIT");
    return listReservationsForSelection({ businessCaseId, catalogId: reservation.catalog_id });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// BC declarado no factible: se liberan todas sus reservas activas. Se llama desde
// businessCase.service.js justo despues de guardar la decision -- nunca debe
// bloquear esa escritura, por eso los llamadores la envuelven en try/catch.
async function releaseAllForBusinessCase(businessCaseId, { reason = "bc_not_feasible" } = {}) {
  const { rows } = await db.query(
    `SELECT id, ti_asset_id, catalog_id FROM public.bc_investment_ti_asset_reservations
      WHERE business_case_id = $1 AND status = 'reserved'`,
    [businessCaseId],
  );
  for (const row of rows) {
    try {
      await releaseReservation({ reservationId: row.id, businessCaseId, user: null, reason });
    } catch (err) {
      logger.warn({ err: err.message, reservationId: row.id }, "[BC_TI_RESERVATIONS] no se pudo liberar una reserva al cerrar BC no factible");
    }
  }
  return rows.length;
}

// Expediente de compras entregado: las reservas activas de ese BC pasan a
// 'delivered' y el activo se mueve a custodia de cliente (moveAssetCustody ya
// deja status='assigned', que es el vocabulario normal de ti_assets para "esta
// unidad esta con alguien", ya no 'reserved').
async function markDeliveredForBusinessCase(businessCaseId, { user = null, reason = "purchase_delivered" } = {}) {
  const bcRows = await db.query(
    `SELECT client_id FROM public.equipment_purchase_requests WHERE id = $1`,
    [businessCaseId],
  );
  const clientId = bcRows.rows[0]?.client_id || null;

  const { rows } = await db.query(
    `SELECT id, ti_asset_id, catalog_id FROM public.bc_investment_ti_asset_reservations
      WHERE business_case_id = $1 AND status = 'reserved'`,
    [businessCaseId],
  );

  for (const row of rows) {
    try {
      if (clientId) {
        await moveAssetCustody({
          assetId: row.ti_asset_id,
          custody_type: "client",
          client_id: clientId,
          usage_context: "client_equipment",
          reason: `Entrega de inversion adicional del Business Case ${businessCaseId}`,
          reference_type: "business_case_investment",
          reference_id: businessCaseId,
          userId: user?.id || null,
        });
      } else {
        logger.warn({ businessCaseId, assetId: row.ti_asset_id }, "[BC_TI_RESERVATIONS] BC sin client_id, no se pudo mover custodia al entregar");
      }
      await db.query(
        `UPDATE public.bc_investment_ti_asset_reservations
            SET status = 'delivered', released_at = now(), released_reason = $2
          WHERE id = $1`,
        [row.id, reason],
      );
    } catch (err) {
      logger.warn({ err: err.message, reservationId: row.id }, "[BC_TI_RESERVATIONS] no se pudo marcar entregada una reserva");
    }
  }
  return rows.length;
}

module.exports = {
  searchReservableAssets,
  listReservationsForSelection,
  reserveAsset,
  releaseReservation,
  releaseAllForBusinessCase,
  markDeliveredForBusinessCase,
};
