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
const { moveAssetCustody, buildInitialConditionPhotos } = require("../ti-assets/tiAssets.service");

const RESERVABLE_STATUSES = new Set(["available", "unassigned"]);

// Columnas de fotos del estado inicial del activo (las mismas que usa el
// modulo ti-assets) -- se necesitan para que jefe_ti pueda ver el activo
// antes de reservarlo, no solo nombre/serie.
const ASSET_PHOTO_COLUMNS = `
  a.initial_condition_photo_1_url, a.initial_condition_photo_1_sha256,
  a.initial_condition_photo_2_url, a.initial_condition_photo_2_sha256`;

function httpError(message, status = 400, code = "BC_TI_RESERVATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

function withPhotos(row, publicBaseUrl) {
  return { ...row, initial_condition_photos: buildInitialConditionPhotos(row, publicBaseUrl) };
}

async function appendAssetEvent(dbOrClient, { assetId, eventType, payload, userId }) {
  await dbOrClient.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1, $2, $3::jsonb, $4, now())`,
    [assetId, eventType, JSON.stringify(payload || {}), userId || null],
  );
}

// Activos disponibles para reservar (busqueda por nombre/marca/modelo/serie/caracteristicas).
async function searchReservableAssets({ q, limit = 30, publicBaseUrl }) {
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
    `SELECT a.id, a.asset_code, a.name, a.brand, a.model, a.serial_number, a.characteristics, a.status,
            ${ASSET_PHOTO_COLUMNS}
       FROM public.ti_assets a
      WHERE ${where.join(" AND ")}
      ORDER BY a.name ASC
      LIMIT $${params.length}`,
    params,
  );
  return rows.map((row) => withPhotos(row, publicBaseUrl));
}

async function listReservationsForSelection({ businessCaseId, catalogId, publicBaseUrl }) {
  const { rows } = await db.query(
    `SELECT r.id, r.status, r.reserved_at, r.released_at, r.released_reason,
            a.id AS ti_asset_id, a.asset_code, a.name, a.brand, a.model, a.serial_number, a.characteristics, a.status AS asset_status,
            ${ASSET_PHOTO_COLUMNS}
       FROM public.bc_investment_ti_asset_reservations r
       JOIN public.ti_assets a ON a.id = r.ti_asset_id
      WHERE r.business_case_id = $1 AND r.catalog_id = $2 AND r.status = 'reserved'
      ORDER BY r.reserved_at ASC`,
    [businessCaseId, catalogId],
  );
  return rows.map((row) => withPhotos(row, publicBaseUrl));
}

// Todas las reservas activas del BC, agrupadas por catalog_id. La usan:
// - el resto de usuarios con acceso a inversiones (no solo jefe_ti) para VER
//   que quedo reservado en cada item, sin tener que abrir uno por uno.
// - la pantalla de precios/cotizacion, para saber si un item ya esta cubierto
//   por inventario TI y por tanto ya no necesita cotizacion.
async function listReservationsForBusinessCase(businessCaseId, { publicBaseUrl } = {}) {
  const { rows } = await db.query(
    `SELECT r.id, r.catalog_id, r.status, r.reserved_at,
            a.id AS ti_asset_id, a.asset_code, a.name, a.brand, a.model, a.serial_number, a.characteristics, a.status AS asset_status,
            ${ASSET_PHOTO_COLUMNS}
       FROM public.bc_investment_ti_asset_reservations r
       JOIN public.ti_assets a ON a.id = r.ti_asset_id
      WHERE r.business_case_id = $1 AND r.status = 'reserved'
      ORDER BY r.catalog_id, r.reserved_at ASC`,
    [businessCaseId],
  );
  return rows.map((row) => withPhotos(row, publicBaseUrl));
}

async function reserveAsset({ businessCaseId, catalogId, tiAssetId, user, publicBaseUrl }) {
  const selection = await db.query(
    `SELECT quantity FROM public.bc_investment_selections WHERE business_case_id = $1 AND catalog_id = $2 AND selected = true`,
    [businessCaseId, catalogId],
  );
  if (!selection.rows.length) {
    throw httpError("Primero agrega este item a la lista de inversiones (con cantidad) antes de reservar un activo.", 409, "SELECTION_NOT_FOUND");
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Sin tope de cantidad: una sola unidad de la inversion (ej. "Computadores x2")
    // puede requerir varios activos TI distintos cada una (CPU, monitor, teclado,
    // mouse...), asi que la cantidad del item es solo una referencia, no un limite.
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
    return listReservationsForSelection({ businessCaseId, catalogId, publicBaseUrl });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function releaseReservation({ reservationId, businessCaseId, user, reason = "manual", publicBaseUrl }) {
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
    return listReservationsForSelection({ businessCaseId, catalogId: reservation.catalog_id, publicBaseUrl });
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
  listReservationsForBusinessCase,
  reserveAsset,
  releaseReservation,
  releaseAllForBusinessCase,
  markDeliveredForBusinessCase,
};
