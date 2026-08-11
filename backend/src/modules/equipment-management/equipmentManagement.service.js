const db = require("../../config/db");
const { deleteFile: deleteDriveFile, ensureFolderPath, uploadFileToDrive } = require("../../utils/drive");

const DEFAULT_STATUS = "in_storage";
const INSTALLED_STATUS = "installed_client";

const toIntOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTextOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDateOrNull = (value) => {
  const text = toTextOrNull(value);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const normalizeCondition = (value) => {
  const text = toTextOrNull(value);
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized === "nuevo") return "nuevo";
  if (["cu", "c.u.", "c/u", "usado"].includes(normalized)) return "cu";
  return null;
};

const sanitizeFolderName = (value) => {
  const text = toTextOrNull(value) || "sin-dato";
  return text.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
};

const normalizeDocumentType = (value) => {
  const text = toTextOrNull(value);
  if (!text) return "otro";
  const normalized = text.toLowerCase();
  const allowed = new Set(["proforma_puesta_marcha", "kit_arranque", "acta_entrega", "acta_retiro", "mantenimiento", "otro"]);
  return allowed.has(normalized) ? normalized : "otro";
};

const getDriveRootFolderId = () =>
  process.env.DRIVE_EQUIPMENT_FOLDER_ID ||
  process.env.DRIVE_ATTACHMENTS_FOLDER_ID ||
  process.env.DRIVE_DOCS_FOLDER_ID ||
  process.env.DRIVE_FOLDER_ID;

async function listStatuses() {
  const { rows } = await db.query(
    `SELECT code, label, color_token, lifecycle_group, is_available_for_negotiation, sort_order, description
       FROM public.equipment_asset_status_catalog
      ORDER BY sort_order ASC, label ASC`,
  );
  return rows;
}

async function listModels({ search = null, category = null } = {}) {
  const params = [];
  const where = [];

  if (search) {
    params.push(`%${String(search).trim()}%`);
    where.push(`(
      em.name ILIKE $${params.length}
      OR em.manufacturer ILIKE $${params.length}
      OR em.model ILIKE $${params.length}
      OR em.category ILIKE $${params.length}
    )`);
  }

  if (category) {
    params.push(category);
    where.push(`em.category = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT
        em.id,
        em.name,
        em.manufacturer,
        em.model,
        em.category,
        em.description,
        COUNT(DISTINCT ea.id)::int AS asset_count,
        COUNT(DISTINCT ea.id) FILTER (WHERE sc.is_available_for_negotiation)::int AS available_count,
        COUNT(DISTINCT ea.id) FILTER (WHERE ea.current_status = 'installed_client')::int AS installed_count,
        COUNT(DISTINCT mp.id) FILTER (WHERE mp.is_active)::int AS procedure_count
       FROM public.equipment_models em
       LEFT JOIN public.equipment_assets ea ON ea.equipment_model_id = em.id
       LEFT JOIN public.equipment_asset_status_catalog sc ON sc.code = ea.current_status
       LEFT JOIN public.maintenance_procedures mp ON mp.equipment_model_id = em.id
       ${whereClause}
      GROUP BY em.id, em.name, em.manufacturer, em.model, em.category, em.description
      ORDER BY em.name ASC`,
    params,
  );
  return rows;
}

async function getModelDetail(modelId) {
  const id = toIntOrNull(modelId);
  const modelResult = await db.query(
    `SELECT id, name, manufacturer, model, category, description
       FROM public.equipment_models
      WHERE id = $1`,
    [id],
  );
  const model = modelResult.rows[0];
  if (!model) {
    const error = new Error("Modelo no encontrado");
    error.status = 404;
    throw error;
  }

  const [consumables, procedures, assets] = await Promise.all([
    db.query(
      `SELECT cec.id, cc.name, cc.type, cc.unit, cec.quantity_per_test, cec.notes
         FROM public.catalog_equipment_consumables cec
         JOIN public.catalog_consumables cc ON cc.id = cec.consumable_id
        WHERE cec.equipment_id = $1
        ORDER BY cc.name ASC`,
      [id],
    ),
    db.query(
      `SELECT
          mp.id,
          mp.procedure_code,
          mp.name,
          mp.maintenance_type,
          mp.interval_months,
          mp.estimated_hours,
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'code', p.code,
                'category', p.category,
                'quantity', mpp.quantity,
                'required', mpp.is_required
              )
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::jsonb
          ) AS parts
         FROM public.maintenance_procedures mp
         LEFT JOIN public.maintenance_procedure_parts mpp ON mpp.procedure_id = mp.id
         LEFT JOIN public.part_catalog p ON p.id = mpp.part_id
        WHERE mp.equipment_model_id = $1
        GROUP BY mp.id
        ORDER BY mp.maintenance_type ASC, mp.name ASC`,
      [id],
    ),
    db.query(
      `SELECT ea.id, ea.serial_number, ea.internal_code, ea.asset_tag, ea.current_status,
              sc.label AS status_label, sc.color_token, ea.current_location, ea.client_id,
              ea.installed_at, ea.sale_price, ea.asset_condition, ea.retired_at,
              ea.delivered_at, ea.updated_at
         FROM public.equipment_assets ea
         JOIN public.equipment_asset_status_catalog sc ON sc.code = ea.current_status
        WHERE ea.equipment_model_id = $1
        ORDER BY ea.updated_at DESC`,
      [id],
    ),
  ]);

  return {
    model,
    consumables: consumables.rows,
    procedures: procedures.rows,
    assets: assets.rows,
  };
}

async function listAssets({ search = null, status = null, model_id = null, availability = null } = {}) {
  const params = [];
  const where = [];

  if (search) {
    params.push(`%${String(search).trim()}%`);
    where.push(`(
      ea.serial_number ILIKE $${params.length}
      OR ea.internal_code ILIKE $${params.length}
      OR ea.asset_tag ILIKE $${params.length}
      OR em.name ILIKE $${params.length}
      OR em.manufacturer ILIKE $${params.length}
      OR em.model ILIKE $${params.length}
      OR ea.current_location ILIKE $${params.length}
    )`);
  }

  if (status) {
    params.push(status);
    where.push(`ea.current_status = $${params.length}`);
  }

  if (model_id) {
    params.push(toIntOrNull(model_id));
    where.push(`ea.equipment_model_id = $${params.length}`);
  }

  if (availability === "available") {
    where.push("sc.is_available_for_negotiation IS TRUE");
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT
        ea.id,
        ea.equipment_model_id,
        ea.serial_number,
        ea.internal_code,
        ea.asset_tag,
        ea.current_status,
        sc.label AS status_label,
        sc.color_token,
        sc.lifecycle_group,
        sc.is_available_for_negotiation,
        ea.client_id,
        ea.client_location_id,
        ea.current_location,
        COALESCE(NULLIF(c.razon_social, ''), NULLIF(cr.commercial_name, '')) AS assigned_client_name,
        COALESCE(NULLIF(c.ruc, ''), NULLIF(cr.ruc_cedula, '')) AS assigned_client_identifier,
        ea.negotiated_by_module,
        ea.negotiation_reference_id,
        ea.installed_at,
        ea.warranty_until,
        ea.sale_price,
        ea.asset_condition,
        ea.retired_at,
        ea.delivered_at,
        ea.notes,
        ea.updated_at,
        em.name AS model_name,
        em.manufacturer,
        em.model,
        em.category
       FROM public.equipment_assets ea
       JOIN public.equipment_models em ON em.id = ea.equipment_model_id
       JOIN public.equipment_asset_status_catalog sc ON sc.code = ea.current_status
       LEFT JOIN public.clients c ON c.id = ea.client_id
       LEFT JOIN public.client_requests cr ON cr.id = ea.client_id
       ${whereClause}
      ORDER BY ea.updated_at DESC, ea.id DESC`,
    params,
  );
  return rows;
}

async function createAsset(payload, userId = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const modelId = toIntOrNull(payload.equipment_model_id);
    const serial = toTextOrNull(payload.serial_number);
    const status = toTextOrNull(payload.current_status) || DEFAULT_STATUS;

    const model = await client.query("SELECT id FROM public.equipment_models WHERE id = $1", [modelId]);
    if (!model.rows.length) {
      const error = new Error("Modelo no encontrado");
      error.status = 400;
      throw error;
    }

    const statusRow = await client.query("SELECT code FROM public.equipment_asset_status_catalog WHERE code = $1", [status]);
    if (!statusRow.rows.length) {
      const error = new Error("Estado de activo no valido");
      error.status = 400;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO public.equipment_assets (
          equipment_model_id, serial_number, internal_code, asset_tag, current_status,
          current_location, notes, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        RETURNING *`,
      [
        modelId,
        serial,
        toTextOrNull(payload.internal_code),
        toTextOrNull(payload.asset_tag),
        status,
        toTextOrNull(payload.current_location),
        toTextOrNull(payload.notes),
        userId,
      ],
    );

    await client.query(
      `INSERT INTO public.equipment_asset_events (asset_id, event_type, to_status, payload, created_by)
       VALUES ($1, 'created', $2, $3::jsonb, $4)`,
      [rows[0].id, status, JSON.stringify({ source: "equipment-management" }), userId],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      error.status = 409;
      error.message = "El serial ya existe en otro activo";
    }
    throw error;
  } finally {
    client.release();
  }
}

async function updateAsset(assetId, payload, userId = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query("SELECT * FROM public.equipment_assets WHERE id = $1 FOR UPDATE", [
      toIntOrNull(assetId),
    ]);
    if (!currentResult.rows.length) {
      const error = new Error("Activo no encontrado");
      error.status = 404;
      throw error;
    }

    const current = currentResult.rows[0];
    const nextStatus = toTextOrNull(payload.current_status || payload.status) || current.current_status;
    const statusRow = await client.query("SELECT code FROM public.equipment_asset_status_catalog WHERE code = $1", [
      nextStatus,
    ]);
    if (!statusRow.rows.length) {
      const error = new Error("Estado de activo no valido");
      error.status = 400;
      throw error;
    }

    const condition = Object.prototype.hasOwnProperty.call(payload, "asset_condition")
      ? normalizeCondition(payload.asset_condition)
      : current.asset_condition;
    if (payload.asset_condition && !condition) {
      const error = new Error("Condicion de activo no valida");
      error.status = 400;
      throw error;
    }

    const nextValues = {
      current_status: nextStatus,
      current_location: Object.prototype.hasOwnProperty.call(payload, "current_location")
        ? toTextOrNull(payload.current_location)
        : current.current_location,
      client_id: Object.prototype.hasOwnProperty.call(payload, "client_id") ? toIntOrNull(payload.client_id) : current.client_id,
      sale_price: Object.prototype.hasOwnProperty.call(payload, "sale_price")
        ? toNumberOrNull(payload.sale_price)
        : current.sale_price,
      asset_condition: condition,
      retired_at: Object.prototype.hasOwnProperty.call(payload, "retired_at") ? toDateOrNull(payload.retired_at) : current.retired_at,
      delivered_at: Object.prototype.hasOwnProperty.call(payload, "delivered_at")
        ? toDateOrNull(payload.delivered_at)
        : current.delivered_at,
      notes: Object.prototype.hasOwnProperty.call(payload, "notes") ? toTextOrNull(payload.notes) : current.notes,
    };

    const { rows } = await client.query(
      `UPDATE public.equipment_assets
          SET current_status = $1,
              current_location = $2,
              client_id = $3,
              sale_price = $4,
              asset_condition = $5,
              retired_at = $6,
              delivered_at = $7,
              notes = $8,
              updated_by = $9,
              updated_at = now()
        WHERE id = $10
        RETURNING *`,
      [
        nextValues.current_status,
        nextValues.current_location,
        nextValues.client_id,
        nextValues.sale_price,
        nextValues.asset_condition,
        nextValues.retired_at,
        nextValues.delivered_at,
        nextValues.notes,
        userId,
        toIntOrNull(assetId),
      ],
    );

    await client.query(
      `INSERT INTO public.equipment_asset_events (asset_id, event_type, from_status, to_status, payload, created_by)
       VALUES ($1, 'asset_updated', $2, $3, $4::jsonb, $5)`,
      [
        toIntOrNull(assetId),
        current.current_status,
        nextValues.current_status,
        JSON.stringify({
          previous: {
            current_location: current.current_location,
            client_id: current.client_id,
            sale_price: current.sale_price,
            asset_condition: current.asset_condition,
            retired_at: current.retired_at,
            delivered_at: current.delivered_at,
          },
          next: nextValues,
        }),
        userId,
      ],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function changeAssetStatus(assetId, payload, userId = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const status = toTextOrNull(payload.status);
    const current = await client.query("SELECT * FROM public.equipment_assets WHERE id = $1 FOR UPDATE", [assetId]);
    if (!current.rows.length) {
      const error = new Error("Activo no encontrado");
      error.status = 404;
      throw error;
    }

    const statusRow = await client.query("SELECT code FROM public.equipment_asset_status_catalog WHERE code = $1", [status]);
    if (!statusRow.rows.length) {
      const error = new Error("Estado de activo no valido");
      error.status = 400;
      throw error;
    }

    const previous = current.rows[0].current_status;
    const { rows } = await client.query(
      `UPDATE public.equipment_assets
          SET current_status = $1,
              current_location = COALESCE($2, current_location),
              notes = COALESCE($3, notes),
              updated_by = $4,
              updated_at = now()
        WHERE id = $5
        RETURNING *`,
      [status, toTextOrNull(payload.current_location), toTextOrNull(payload.notes), userId, assetId],
    );

    await client.query(
      `INSERT INTO public.equipment_asset_events (asset_id, event_type, from_status, to_status, payload, created_by)
       VALUES ($1, 'status_changed', $2, $3, $4::jsonb, $5)`,
      [assetId, previous, status, JSON.stringify({ notes: payload.notes || null }), userId],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reserveAsset(assetId, payload, userId = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT ea.*, sc.is_available_for_negotiation
         FROM public.equipment_assets ea
         JOIN public.equipment_asset_status_catalog sc ON sc.code = ea.current_status
        WHERE ea.id = $1
        FOR UPDATE`,
      [assetId],
    );
    if (!current.rows.length) {
      const error = new Error("Activo no encontrado");
      error.status = 404;
      throw error;
    }
    if (!current.rows[0].is_available_for_negotiation) {
      const error = new Error("El activo no esta disponible para negociacion");
      error.status = 409;
      throw error;
    }

    const { rows: reservationRows } = await client.query(
      `INSERT INTO public.equipment_asset_reservations (
          asset_id, source_module, source_reference_id, reserved_for_client_id,
          expires_at, notes, created_by
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        assetId,
        toTextOrNull(payload.source_module) || "manual",
        toIntOrNull(payload.source_reference_id),
        toIntOrNull(payload.reserved_for_client_id),
        payload.expires_at || null,
        toTextOrNull(payload.notes),
        userId,
      ],
    );

    await client.query(
      `UPDATE public.equipment_assets
          SET current_status = 'reserved',
              negotiated_by_module = $1,
              negotiation_reference_id = $2,
              updated_by = $3,
              updated_at = now()
        WHERE id = $4`,
      [
        toTextOrNull(payload.source_module) || "manual",
        toIntOrNull(payload.source_reference_id),
        userId,
        assetId,
      ],
    );

    await client.query(
      `INSERT INTO public.equipment_asset_events (asset_id, event_type, from_status, to_status, payload, created_by)
       VALUES ($1, 'reserved', $2, 'reserved', $3::jsonb, $4)`,
      [assetId, current.rows[0].current_status, JSON.stringify({ reservation_id: reservationRows[0].id }), userId],
    );

    await client.query("COMMIT");
    return reservationRows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function installAsset(assetId, payload, userId = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT * FROM public.equipment_assets WHERE id = $1 FOR UPDATE", [assetId]);
    if (!current.rows.length) {
      const error = new Error("Activo no encontrado");
      error.status = 404;
      throw error;
    }
    const asset = current.rows[0];
    const serial = toTextOrNull(payload.serial_number) || asset.serial_number;
    if (!serial) {
      const error = new Error("El serial es requerido para instalar el activo");
      error.status = 400;
      throw error;
    }

    const { rows } = await client.query(
      `UPDATE public.equipment_assets
          SET serial_number = $1,
              client_id = $2,
              client_location_id = $3,
              current_location = $4,
              current_status = $5,
              installed_at = COALESCE($6::timestamptz, now()),
              warranty_until = $7,
              notes = COALESCE($8, notes),
              updated_by = $9,
              updated_at = now()
        WHERE id = $10
        RETURNING *`,
      [
        serial,
        toIntOrNull(payload.client_id),
        toIntOrNull(payload.client_location_id),
        toTextOrNull(payload.current_location),
        INSTALLED_STATUS,
        payload.installed_at || null,
        payload.warranty_until || null,
        toTextOrNull(payload.notes),
        userId,
        assetId,
      ],
    );

    const eventResult = await client.query(
      `INSERT INTO public.equipment_asset_events (asset_id, event_type, from_status, to_status, payload, created_by)
       VALUES ($1, 'installed', $2, $3, $4::jsonb, $5)
       RETURNING id`,
      [
        assetId,
        asset.current_status,
        INSTALLED_STATUS,
        JSON.stringify({ client_id: payload.client_id || null, client_location_id: payload.client_location_id || null }),
        userId,
      ],
    );

    await client.query(
      `UPDATE public.equipment_asset_reservations
          SET status = 'converted', updated_at = now()
        WHERE asset_id = $1 AND status = 'active'`,
      [assetId],
    );

    const installedAt = rows[0].installed_at || new Date();
    await client.query(
      `INSERT INTO public.equipment_asset_maintenance_schedule (
          asset_id, procedure_id, scheduled_for, source_event_id, created_by
        )
       SELECT
          $1,
          mp.id,
          (($2::date + make_interval(months => mp.interval_months))::date),
          $3,
          $4
         FROM public.maintenance_procedures mp
        WHERE mp.equipment_model_id = $5
          AND mp.is_active IS TRUE
          AND mp.maintenance_type = 'preventivo'
          AND mp.interval_months IS NOT NULL
          AND mp.interval_months > 0
       ON CONFLICT (asset_id, procedure_id, scheduled_for) DO NOTHING`,
      [assetId, installedAt, eventResult.rows[0].id, userId, asset.equipment_model_id],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      error.status = 409;
      error.message = "El serial ya existe en otro activo";
    }
    throw error;
  } finally {
    client.release();
  }
}

async function listAssetTimeline(assetId) {
  const { rows } = await db.query(
    `SELECT
        e.id,
        e.event_type,
        e.from_status,
        from_sc.label AS from_status_label,
        e.to_status,
        to_sc.label AS to_status_label,
        e.payload,
        e.created_by,
        COALESCE(u.fullname, u.name, u.email) AS created_by_name,
        e.created_at
       FROM public.equipment_asset_events e
       LEFT JOIN public.equipment_asset_status_catalog from_sc ON from_sc.code = e.from_status
       LEFT JOIN public.equipment_asset_status_catalog to_sc ON to_sc.code = e.to_status
       LEFT JOIN public.users u ON u.id = e.created_by
      WHERE e.asset_id = $1
      ORDER BY e.created_at DESC, e.id DESC`,
    [assetId],
  );
  return rows;
}

async function getAssetForDocuments(client, assetId) {
  const { rows } = await client.query(
    `SELECT ea.id, ea.serial_number, em.name AS model_name
       FROM public.equipment_assets ea
       JOIN public.equipment_models em ON em.id = ea.equipment_model_id
      WHERE ea.id = $1`,
    [toIntOrNull(assetId)],
  );
  const asset = rows[0];
  if (!asset) {
    const error = new Error("Activo no encontrado");
    error.status = 404;
    throw error;
  }
  return asset;
}

async function listAssetDocuments(assetId) {
  const { rows } = await db.query(
    `SELECT
        d.id,
        d.asset_id,
        d.doc_type,
        d.title,
        d.filename,
        d.mime_type,
        d.size_bytes,
        d.drive_file_id,
        d.drive_link,
        d.notes,
        d.uploaded_by,
        COALESCE(u.fullname, u.name, u.email) AS uploaded_by_name,
        d.created_at,
        d.updated_at
       FROM public.equipment_asset_documents d
       LEFT JOIN public.users u ON u.id = d.uploaded_by
      WHERE d.asset_id = $1
      ORDER BY d.created_at DESC, d.id DESC`,
    [toIntOrNull(assetId)],
  );
  return rows;
}

async function uploadAssetDocument(assetId, file, payload = {}, userId = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const asset = await getAssetForDocuments(client, assetId);
    const rootFolderId = getDriveRootFolderId();
    if (!rootFolderId) {
      const error = new Error("No se ha configurado una carpeta destino para documentos de equipos");
      error.status = 500;
      throw error;
    }

    const assetFolder = await ensureFolderPath(
      [
        "Equipos",
        `${sanitizeFolderName(asset.model_name)} - ${sanitizeFolderName(asset.serial_number || `ID ${asset.id}`)}`,
      ],
      rootFolderId,
    );
    const stored = await uploadFileToDrive(file, file.originalname || `equipo-${asset.id}-${Date.now()}`, assetFolder.id);
    const docType = normalizeDocumentType(payload.doc_type);
    const title = toTextOrNull(payload.title) || file.originalname || stored.name;
    const notes = toTextOrNull(payload.notes);
    const driveLink = stored.webViewLink || stored.webContentLink || `https://drive.google.com/file/d/${stored.id}/view`;

    const { rows } = await client.query(
      `INSERT INTO public.equipment_asset_documents (
          asset_id, doc_type, title, filename, mime_type, size_bytes,
          drive_file_id, drive_link, notes, uploaded_by
        )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        asset.id,
        docType,
        title,
        file.originalname || stored.name,
        stored.mimeType || file.mimetype || null,
        Number(file.size || 0) || null,
        stored.id,
        driveLink,
        notes,
        userId,
      ],
    );

    await client.query(
      `INSERT INTO public.equipment_asset_events (asset_id, event_type, payload, created_by)
       VALUES ($1, 'document_uploaded', $2::jsonb, $3)`,
      [
        asset.id,
        JSON.stringify({
          document_id: rows[0].id,
          doc_type: docType,
          title,
          filename: rows[0].filename,
          drive_file_id: rows[0].drive_file_id,
        }),
        userId,
      ],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteAssetDocument(assetId, documentId, userId = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await getAssetForDocuments(client, assetId);
    const { rows } = await client.query(
      `DELETE FROM public.equipment_asset_documents
        WHERE id = $1 AND asset_id = $2
        RETURNING *`,
      [toIntOrNull(documentId), toIntOrNull(assetId)],
    );
    const deleted = rows[0];
    if (!deleted) {
      const error = new Error("Documento no encontrado");
      error.status = 404;
      throw error;
    }

    await client.query(
      `INSERT INTO public.equipment_asset_events (asset_id, event_type, payload, created_by)
       VALUES ($1, 'document_deleted', $2::jsonb, $3)`,
      [
        toIntOrNull(assetId),
        JSON.stringify({
          document_id: deleted.id,
          doc_type: deleted.doc_type,
          title: deleted.title,
          filename: deleted.filename,
          drive_file_id: deleted.drive_file_id,
        }),
        userId,
      ],
    );
    await client.query("COMMIT");

    try {
      await deleteDriveFile(deleted.drive_file_id);
    } catch (_err) {
      // El registro queda auditado aunque Drive no permita borrar el archivo.
    }

    return { deleted: true, document_id: deleted.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listSchedule({ status = null, from = null, to = null } = {}) {
  const params = [];
  const where = [];
  if (status) {
    params.push(status);
    where.push(`s.status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`s.scheduled_for >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`s.scheduled_for <= $${params.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT
        s.id,
        s.asset_id,
        s.procedure_id,
        s.scheduled_for,
        s.status,
        mp.name AS procedure_name,
        mp.maintenance_type,
        ea.serial_number,
        ea.current_location,
        em.name AS model_name,
        em.manufacturer,
        em.model
       FROM public.equipment_asset_maintenance_schedule s
       JOIN public.maintenance_procedures mp ON mp.id = s.procedure_id
       JOIN public.equipment_assets ea ON ea.id = s.asset_id
       JOIN public.equipment_models em ON em.id = ea.equipment_model_id
       ${whereClause}
      ORDER BY s.scheduled_for ASC, s.id ASC`,
    params,
  );
  return rows;
}

async function createProcedure(payload, userId = null) {
  const { rows } = await db.query(
    `INSERT INTO public.maintenance_procedures (
        equipment_model_id, procedure_code, name, maintenance_type, interval_months,
        estimated_hours, instructions, created_by
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      toIntOrNull(payload.equipment_model_id),
      toTextOrNull(payload.procedure_code),
      toTextOrNull(payload.name),
      toTextOrNull(payload.maintenance_type) || "preventivo",
      toIntOrNull(payload.interval_months),
      payload.estimated_hours || null,
      toTextOrNull(payload.instructions),
      userId,
    ],
  );
  return rows[0];
}

async function createPart(payload) {
  const { rows } = await db.query(
    `INSERT INTO public.part_catalog (code, name, category, unit, brand, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      toTextOrNull(payload.code),
      toTextOrNull(payload.name),
      toTextOrNull(payload.category) || "pieza",
      toTextOrNull(payload.unit) || "unidad",
      toTextOrNull(payload.brand),
      toTextOrNull(payload.description),
    ],
  );
  return rows[0];
}

async function attachPartToProcedure(procedureId, payload) {
  const { rows } = await db.query(
    `INSERT INTO public.maintenance_procedure_parts (procedure_id, part_id, quantity, is_required, notes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (procedure_id, part_id) DO UPDATE SET
       quantity = EXCLUDED.quantity,
       is_required = EXCLUDED.is_required,
       notes = EXCLUDED.notes
     RETURNING *`,
    [
      procedureId,
      toIntOrNull(payload.part_id),
      payload.quantity || 1,
      payload.is_required !== false,
      toTextOrNull(payload.notes),
    ],
  );
  return rows[0];
}

module.exports = {
  toIntOrNull,
  toTextOrNull,
  toNumberOrNull,
  toDateOrNull,
  normalizeCondition,
  normalizeDocumentType,
  listStatuses,
  listModels,
  getModelDetail,
  listAssets,
  createAsset,
  updateAsset,
  changeAssetStatus,
  reserveAsset,
  installAsset,
  listAssetTimeline,
  listAssetDocuments,
  uploadAssetDocument,
  deleteAssetDocument,
  listSchedule,
  createProcedure,
  createPart,
  attachPartToProcedure,
};
