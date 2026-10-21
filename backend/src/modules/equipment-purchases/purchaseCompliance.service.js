const db = require("../../config/db");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const {
  PROCEDURE_TYPES,
  REQUIREMENTS,
  SHARED_DOCUMENT_TYPES,
  buildRequirements,
  findRequirement,
} = require("./purchaseCompliance.rules");

function serviceError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function roleTokens(user = {}) {
  return [user.role, user.role_name, user.scope, user.roles, user.scopes, user.extra_roles]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .flatMap((value) => {
      if (value && typeof value === "object") return [value.name || value.role || value.code || value.slug || ""];
      return String(value || "").split(/[\s,;|]+/);
    })
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function assertAcpComercial(user) {
  if (!roleTokens(user).includes("acp_comercial")) {
    throw serviceError(403, "COMPLIANCE_ACP_ONLY", "Esta herramienta es exclusiva de ACP Comercial.");
  }
}

async function getPurchase(purchaseId, executor = db) {
  const { rows } = await executor.query(
    `SELECT id, purchase_type, procedure_type, presupuesto_referencial,
            drive_folder_id, process_code, client_name
       FROM public.equipment_purchase_requests
      WHERE id = $1`,
    [purchaseId],
  );
  const purchase = rows[0];
  if (!purchase) throw serviceError(404, "REQUEST_NOT_FOUND", "La compra pública no existe.");
  if (purchase.purchase_type !== "public") {
    throw serviceError(409, "COMPLIANCE_PUBLIC_ONLY", "El control documental solo aplica a compras públicas.");
  }
  return purchase;
}

async function ensureItems(purchaseId, executor = db) {
  const values = [];
  const placeholders = REQUIREMENTS.map((requirement, index) => {
    values.push(purchaseId, requirement.key);
    const offset = index * 2;
    return `($${offset + 1}, $${offset + 2})`;
  });
  await executor.query(
    `INSERT INTO public.public_purchase_compliance_items (purchase_id, requirement_key)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (purchase_id, requirement_key) DO NOTHING`,
    values,
  );
}

async function currentSharedDocuments(executor = db) {
  const { rows } = await executor.query(
    `SELECT d.*, u.fullname AS uploaded_by_name
       FROM public.public_purchase_compliance_shared_documents d
       LEFT JOIN public.users u ON u.id = d.uploaded_by
      WHERE d.is_current = true
      ORDER BY d.document_type`,
  );
  const byType = new Map(rows.map((row) => [row.document_type, row]));
  return SHARED_DOCUMENT_TYPES.map((definition) => ({
    ...definition,
    document: byType.get(definition.key) || null,
  }));
}

function decorateItems(purchase, itemRows, evidenceRows) {
  const itemByKey = new Map(itemRows.map((row) => [row.requirement_key, row]));
  const evidenceByItem = new Map();
  evidenceRows.forEach((row) => {
    const list = evidenceByItem.get(row.compliance_item_id) || [];
    list.push(row);
    evidenceByItem.set(row.compliance_item_id, list);
  });

  const requirements = buildRequirements(purchase);
  let priorRequiredComplete = true;
  return requirements.map((requirement) => {
    const stored = itemByKey.get(requirement.key);
    const effectiveStatus = requirement.required || requirement.independent
      ? (stored?.status || "pending")
      : "not_applicable";
    const unlocked = requirement.independent || (requirement.required && priorRequiredComplete && !requirement.condition_pending);
    const item = {
      ...requirement,
      id: stored?.id || null,
      status: effectiveStatus,
      stored_status: stored?.status || "pending",
      notes: stored?.notes || null,
      completed_at: stored?.completed_at || null,
      completed_by_name: stored?.completed_by_name || null,
      evidence: evidenceByItem.get(stored?.id) || [],
      is_unlocked: unlocked || ["completed", "not_applicable"].includes(effectiveStatus),
    };
    if (requirement.required) {
      priorRequiredComplete = priorRequiredComplete && ["completed", "not_applicable"].includes(effectiveStatus);
    }
    return item;
  });
}

async function getCompliance({ purchaseId, user }) {
  assertAcpComercial(user);
  const purchase = await getPurchase(purchaseId);
  await ensureItems(purchaseId);
  const [{ rows: items }, { rows: evidence }, sharedDocuments, { rows: events }] = await Promise.all([
    db.query(
      `SELECT i.*, u.fullname AS completed_by_name
         FROM public.public_purchase_compliance_items i
         LEFT JOIN public.users u ON u.id = i.completed_by
        WHERE i.purchase_id = $1`,
      [purchaseId],
    ),
    db.query(
      `SELECT e.*, u.fullname AS uploaded_by_name
         FROM public.public_purchase_compliance_evidence e
         JOIN public.public_purchase_compliance_items i ON i.id = e.compliance_item_id
         LEFT JOIN public.users u ON u.id = e.uploaded_by
        WHERE i.purchase_id = $1
        ORDER BY e.uploaded_at DESC`,
      [purchaseId],
    ),
    currentSharedDocuments(),
    db.query(
      `SELECT e.*, u.fullname AS actor_name
         FROM public.public_purchase_compliance_events e
         LEFT JOIN public.users u ON u.id = e.actor_user_id
        WHERE e.purchase_id = $1
        ORDER BY e.created_at DESC
        LIMIT 50`,
      [purchaseId],
    ),
  ]);
  const decorated = decorateItems(purchase, items, evidence);
  const required = decorated.filter((item) => item.required);
  const completed = required.filter((item) => ["completed", "not_applicable"].includes(item.status));
  return {
    purchase: {
      id: purchase.id,
      procedure_type: purchase.procedure_type,
      presupuesto_referencial: purchase.presupuesto_referencial,
      process_code: purchase.process_code,
      client_name: purchase.client_name,
    },
    procedure_types: Object.values(PROCEDURE_TYPES),
    items: decorated,
    shared_documents: sharedDocuments,
    progress: {
      required: required.length,
      completed: completed.length,
      percentage: required.length ? Math.round((completed.length / required.length) * 100) : 0,
      next_requirement_key: required.find((item) => item.status === "pending")?.key || null,
    },
    events,
  };
}

async function updateProcedureType({ purchaseId, procedureType, user }) {
  assertAcpComercial(user);
  if (!Object.values(PROCEDURE_TYPES).includes(procedureType)) {
    throw serviceError(400, "INVALID_COMPLIANCE_PROCEDURE", "Selecciona un procedimiento de compra válido.");
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const purchase = await getPurchase(purchaseId, client);
    await ensureItems(purchaseId, client);
    const { rows: progressed } = await client.query(
      `SELECT i.requirement_key
         FROM public.public_purchase_compliance_items i
        WHERE i.purchase_id = $1
          AND (
            i.status <> 'pending'
            OR (
              i.requirement_key <> 'contracting_need'
              AND EXISTS (
                SELECT 1 FROM public.public_purchase_compliance_evidence e
                 WHERE e.compliance_item_id = i.id
              )
            )
          )
        LIMIT 1`,
      [purchaseId],
    );
    if (progressed.length && purchase.procedure_type !== procedureType) {
      throw serviceError(409, "COMPLIANCE_PROCEDURE_LOCKED", "No se puede cambiar el procedimiento después de iniciar el checklist.");
    }
    await client.query(
      `UPDATE public.equipment_purchase_requests SET procedure_type = $2, updated_at = now() WHERE id = $1`,
      [purchaseId, procedureType],
    );
    await client.query(
      `INSERT INTO public.public_purchase_compliance_events
        (purchase_id, action, details, actor_user_id)
       VALUES ($1, 'procedure_selected', $2::jsonb, $3)`,
      [purchaseId, JSON.stringify({ procedure_type: procedureType }), user.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getCompliance({ purchaseId, user });
}

function validateFile(file) {
  if (!file?.buffer?.length) throw serviceError(400, "FILE_REQUIRED", "Selecciona un archivo para continuar.");
}

async function ensurePurchaseComplianceFolder(purchase) {
  let parentId = purchase.drive_folder_id || null;
  if (!parentId) {
    const root = await ensureFolder("Compras Públicas");
    const purchaseFolder = await ensureFolder(`Expediente ${purchase.process_code || purchase.id}`, root.id);
    parentId = purchaseFolder.id;
    await db.query(
      `UPDATE public.equipment_purchase_requests SET drive_folder_id = $2 WHERE id = $1 AND drive_folder_id IS NULL`,
      [purchase.id, parentId],
    );
  }
  return ensureFolder("Cumplimiento documental", parentId);
}

async function uploadEvidence({ purchaseId, requirementKey, file, user }) {
  assertAcpComercial(user);
  validateFile(file);
  const definition = findRequirement(requirementKey);
  if (!definition) throw serviceError(404, "COMPLIANCE_REQUIREMENT_NOT_FOUND", "El requisito no existe.");
  const before = await getCompliance({ purchaseId, user });
  const item = before.items.find((entry) => entry.key === requirementKey);
  if (!item?.required && !item?.independent) throw serviceError(409, "COMPLIANCE_ITEM_NOT_REQUIRED", "Este documento no aplica al procedimiento seleccionado.");
  if (!item.is_unlocked) throw serviceError(409, "COMPLIANCE_SEQUENCE_LOCKED", "Completa primero el requisito obligatorio anterior.");
  if (definition.shared_library) {
    throw serviceError(409, "COMPLIANCE_USE_SHARED_LIBRARY", "Los documentos habilitantes se cargan en la biblioteca reutilizable.");
  }
  const purchase = await getPurchase(purchaseId);
  const baseFolder = await ensurePurchaseComplianceFolder(purchase);
  const itemFolder = await ensureFolder(`${definition.code} - ${definition.title}`, baseFolder.id);
  const uploaded = await uploadBase64File(file.originalname, file.buffer.toString("base64"), file.mimetype, itemFolder.id);
  await db.query(
    `INSERT INTO public.public_purchase_compliance_evidence
      (compliance_item_id, document_name, drive_file_id, drive_file_url, mime_type, file_size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [item.id, uploaded.name || file.originalname, uploaded.id, uploaded.webViewLink || null, file.mimetype, file.size, user.id],
  );
  await db.query(
    `INSERT INTO public.public_purchase_compliance_events
      (purchase_id, requirement_key, action, details, actor_user_id)
     VALUES ($1, $2, 'evidence_uploaded', $3::jsonb, $4)`,
    [purchaseId, requirementKey, JSON.stringify({ document_name: uploaded.name || file.originalname, drive_file_id: uploaded.id }), user.id],
  );
  return getCompliance({ purchaseId, user });
}

async function updateItemStatus({ purchaseId, requirementKey, status, notes, user }) {
  assertAcpComercial(user);
  if (!["pending", "completed", "not_applicable"].includes(status)) {
    throw serviceError(400, "INVALID_COMPLIANCE_STATUS", "El estado solicitado no es válido.");
  }
  const definition = findRequirement(requirementKey);
  if (!definition) throw serviceError(404, "COMPLIANCE_REQUIREMENT_NOT_FOUND", "El requisito no existe.");
  const snapshot = await getCompliance({ purchaseId, user });
  const item = snapshot.items.find((entry) => entry.key === requirementKey);
  if (!item.required && !item.independent) throw serviceError(409, "COMPLIANCE_ITEM_NOT_REQUIRED", "Este requisito no aplica al procedimiento seleccionado.");

  if (status !== "pending") {
    if (!item.is_unlocked || item.condition_pending) {
      throw serviceError(409, "COMPLIANCE_SEQUENCE_LOCKED", item.condition_message || "Completa primero el requisito obligatorio anterior.");
    }
    if (status === "not_applicable" && (!definition.allows_not_applicable || !String(notes || "").trim())) {
      throw serviceError(400, "COMPLIANCE_NA_REASON_REQUIRED", "Solo este requisito admite No aplica y requiere una justificación.");
    }
  } else {
    const currentIndex = snapshot.items.findIndex((entry) => entry.key === requirementKey);
    const laterCompleted = snapshot.items.slice(currentIndex + 1)
      .some((entry) => entry.required && ["completed", "not_applicable"].includes(entry.status));
    if (laterCompleted) throw serviceError(409, "COMPLIANCE_REOPEN_BLOCKED", "Reabre primero los requisitos posteriores ya completados.");
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    if (status === "completed" && definition.shared_library) {
      const shared = await currentSharedDocuments(client);
      const missing = shared.filter((entry) => !entry.document);
      if (missing.length) {
        throw serviceError(409, "COMPLIANCE_SHARED_DOCUMENTS_INCOMPLETE", "Carga todos los documentos habilitantes vigentes.", { missing: missing.map((entry) => entry.key) });
      }
      for (const entry of shared) {
        const document = entry.document;
        await client.query(
          `INSERT INTO public.public_purchase_compliance_evidence
            (compliance_item_id, shared_document_id, document_name, drive_file_id, drive_file_url, mime_type, file_size_bytes, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (compliance_item_id, shared_document_id) WHERE shared_document_id IS NOT NULL DO NOTHING`,
          [item.id, document.id, document.document_name, document.drive_file_id, document.drive_file_url, document.mime_type, document.file_size_bytes, user.id],
        );
      }
    } else if (status === "completed") {
      const { rows } = await client.query(
        `SELECT 1 FROM public.public_purchase_compliance_evidence WHERE compliance_item_id = $1 LIMIT 1`,
        [item.id],
      );
      if (!rows.length) throw serviceError(409, "COMPLIANCE_EVIDENCE_REQUIRED", "Carga al menos una evidencia antes de completar el requisito.");
    }

    await client.query(
      `UPDATE public.public_purchase_compliance_items
          SET status = $2,
              notes = $3,
              completed_by = CASE WHEN $2 = 'pending' THEN NULL ELSE $4 END,
              completed_at = CASE WHEN $2 = 'pending' THEN NULL ELSE now() END,
              updated_at = now()
        WHERE id = $1`,
      [item.id, status, String(notes || "").trim() || null, user.id],
    );
    await client.query(
      `INSERT INTO public.public_purchase_compliance_events
        (purchase_id, requirement_key, action, details, actor_user_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [purchaseId, requirementKey, status === "pending" ? "requirement_reopened" : "requirement_resolved", JSON.stringify({ status, notes: String(notes || "").trim() || null }), user.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getCompliance({ purchaseId, user });
}

async function listSharedDocuments({ user }) {
  assertAcpComercial(user);
  return currentSharedDocuments();
}

async function uploadSharedDocument({ documentType, file, notes, user }) {
  assertAcpComercial(user);
  validateFile(file);
  const definition = SHARED_DOCUMENT_TYPES.find((entry) => entry.key === documentType);
  if (!definition) throw serviceError(404, "COMPLIANCE_SHARED_TYPE_NOT_FOUND", "El tipo de documento habilitante no existe.");
  const root = await ensureFolder("Compras Públicas");
  const folder = await ensureFolder("Documentos habilitantes reutilizables", root.id);
  const uploaded = await uploadBase64File(file.originalname, file.buffer.toString("base64"), file.mimetype, folder.id);
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT id FROM public.public_purchase_compliance_shared_documents WHERE document_type = $1 FOR UPDATE`,
      [documentType],
    );
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM public.public_purchase_compliance_shared_documents WHERE document_type = $1`,
      [documentType],
    );
    await client.query(
      `UPDATE public.public_purchase_compliance_shared_documents SET is_current = false
        WHERE document_type = $1 AND is_current = true`,
      [documentType],
    );
    await client.query(
      `INSERT INTO public.public_purchase_compliance_shared_documents
        (document_type, version, document_name, drive_file_id, drive_file_url, mime_type, file_size_bytes, notes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [documentType, Number(rows[0].next_version), uploaded.name || file.originalname, uploaded.id, uploaded.webViewLink || null, file.mimetype, file.size, String(notes || "").trim() || null, user.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return currentSharedDocuments();
}

module.exports = {
  getCompliance,
  updateProcedureType,
  uploadEvidence,
  updateItemStatus,
  listSharedDocuments,
  uploadSharedDocument,
};
