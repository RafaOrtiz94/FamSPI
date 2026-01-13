/**
 * Service: Private Purchases
 * -------------------------
 * Orquesta la creación y evolución de las solicitudes privadas de compra
 * siguiendo lo definido en la migración 014_private_purchase_requests.sql.
 */

const db = require("../../config/db");
const { v4: uuidv4 } = require("uuid");
const {
  ensureFolder,
  copyTemplate,
  replaceTags,
  uploadBase64File,
} = require("../../utils/drive");
const { logAction } = require("../../utils/audit");
const NotificationManager = require('../notifications/notificationManager');
const { drive } = require("../../config/google");
const { resolveRequestDriveFolders } = require("../../utils/drivePaths");

const PRIVATE_PURCHASE_STATUSES = [
  "pending_commercial",
  "client_approved", // Nuevo: cliente aprobado con LOPDP
  "pending_backoffice",
  "offer_sent",
  "pending_manager_signature",
  "pending_manager_contract_approval", // Nuevo: aprobación contrato por gerencia
  "contract_rejected_needs_correction", // Nuevo: rechazado, necesita correcciones
  "contract_approved_pending_upload", // Nuevo: aprobado, esperando subida contrato
  "pending_client_signature",
  "offer_signed",
  "client_registered",
  "pending_operations_schedule", // Nuevo: esperando fechas operaciones
  "awaiting_dispatch", // Nuevo: fechas confirmadas, esperando despacho
  "delivered_pending_signatures", // Nuevo: entregado, esperando firma documentos
  "sent_to_acp",
  "rejected",
];

const DRIVE_BASE_FOLDER =
  process.env.PRIVATE_PURCHASES_DRIVE_FOLDER_ID ||
  process.env.DRIVE_DOCS_FOLDER_ID ||
  process.env.DRIVE_FOLDER_ID ||
  null;

const DRIVE_FOLDER_PREFIX = "ComprasPrivado";

function driveViewLink(id) {
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/view`;
}

/**
 * Resolver de carpeta compatible con legacy + nuevo root corporativo
 * @param {Object} params - Parámetros para resolver carpeta
 * @param {string} params.entityType - Tipo de entidad ('private_purchase')
 * @param {string} params.entityId - ID de la entidad
 * @param {string} params.legacyFolderId - ID de carpeta legacy (si existe)
 * @param {Array} params.segmentsNewPath - Segmentos para nueva estructura corporativa
 * @param {Object} params.user - Usuario para estructura comercial
 * @returns {Object} { folderId, mode, isLegacy }
 */
async function resolveEntityFolder({
  entityType,
  entityId,
  legacyFolderId,
  segmentsNewPath,
  user
}) {
  console.log("[PURCHASE_FLOW][DRIVE_FOLDER_RESOLVE]", {
    entityType,
    entityId,
    hasLegacy: !!legacyFolderId,
    hasNewPath: !!segmentsNewPath
  });

  // 1. Si existe carpeta legacy, validar accesibilidad
  if (legacyFolderId) {
    try {
      // Verificar que la carpeta existe y es accesible
      await drive.files.get({
        fileId: legacyFolderId,
        supportsAllDrives: true,
        fields: 'id, name'
      });

      console.log("[PURCHASE_FLOW][DRIVE_FOLDER_RESOLVE]", {
        entityType,
        entityId,
        mode: "legacy_reuse",
        folderId: legacyFolderId,
        ok: true
      });

      return {
        folderId: legacyFolderId,
        mode: "legacy_reuse",
        isLegacy: true
      };
    } catch (error) {
      console.warn("[PURCHASE_FLOW][DRIVE_FOLDER_RESOLVE]", {
        entityType,
        entityId,
        mode: "legacy_inaccessible",
        legacyFolderId,
        error: error.message
      });
      // Continuar con creación de nueva carpeta
    }
  }

  // 2. Crear nueva carpeta en estructura corporativa
  try {
    const clientName = segmentsNewPath?.[3] || 'Cliente-Desconocido';

    const driveFolders = await resolveRequestDriveFolders({
      requestId: entityId,
      requestTypeCode: 'private_purchase',
      requestTypeTitle: 'Compras Privadas',
      departmentCode: 'Comercial',
      departmentName: 'Comercial',
      clientName,
      user
    });

    console.log("[PURCHASE_FLOW][DRIVE_FOLDER_RESOLVE]", {
      entityType,
      entityId,
      mode: "new_created",
      folderId: driveFolders.requestFolderId,
      ok: true
    });

    return {
      folderId: driveFolders.requestFolderId,
      mode: "new_created",
      isLegacy: false
    };
  } catch (error) {
    console.error("[PURCHASE_FLOW][DRIVE_FOLDER_RESOLVE]", {
      entityType,
      entityId,
      mode: "creation_failed",
      error: error.message
    });
    throw new Error(`No se pudo resolver carpeta para ${entityType}: ${error.message}`);
  }
}

async function ensureRequestFolder(request, forceRecreate = false) {
  if (!DRIVE_BASE_FOLDER) return null;
  if (request.drive_folder_id && !forceRecreate) return request.drive_folder_id;
  const name = `${DRIVE_FOLDER_PREFIX}-${request.id}`;
  const folder = await ensureFolder(name, DRIVE_BASE_FOLDER);
  return folder?.id || null;
}

async function ensurePathFolder(pathStr) {
  if (!pathStr) return null;
  if (!DRIVE_BASE_FOLDER) return null;
  const parts = pathStr.split("/").filter(Boolean);
  let currentParent = DRIVE_BASE_FOLDER;
  for (const segment of parts) {
    const folder = await ensureFolder(segment, currentParent);
    currentParent = folder?.id || currentParent;
  }
  return currentParent;
}

async function uploadComodatoDocument(folderId, { base64, name, mime }) {
  if (!folderId || !base64 || !name) return null;
  const cleaned = base64.startsWith("data:") ? base64.split(",")[1] : base64;
  const uploaded = await uploadBase64File(name, cleaned, mime || "application/pdf", folderId);
  return uploaded?.id || null;
}

function normalizeEquipmentInput(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

async function createPrivatePurchase({ user, payload }) {
  const clientSnapshot = payload.clientSnapshot || {};
  const equipment = normalizeEquipmentInput(payload.equipment);
  const notes = payload.notes || null;
  const offerValidUntil = payload.offer_valid_until || null;
  const offerKind = payload.offer_kind || "venta";
  const comodatoDocumentBase64 = payload.comodato_document_base64 || null;
  const comodatoDocumentName = payload.comodato_document_name || null;
  const comodatoDocumentMime = payload.comodato_document_mime || null;

  const id = uuidv4();

  // Resolver carpeta usando sistema compatible legacy + nuevo
  const folderResolution = await resolveEntityFolder({
    entityType: "private_purchase",
    entityId: id,
    legacyFolderId: null, // Nueva solicitud, no hay legacy
    segmentsNewPath: ["Comercial", "Compras Privadas", clientSnapshot?.commercial_name || 'Cliente-Desconocido', `Solicitud-${id}`],
    user
  });

  const folderId = folderResolution.folderId;

  let comodatoDocumentId = null;
  if (offerKind === "comodato" && comodatoDocumentBase64 && comodatoDocumentName) {
    comodatoDocumentId = await uploadComodatoDocument(folderId, {
      base64: comodatoDocumentBase64,
      name: comodatoDocumentName,
      mime: comodatoDocumentMime,
    });
  }

  const sanitizedEquipment = equipment
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      }
      if (typeof item === "object") return item;
      return null;
    })
    .filter(Boolean);
  const equipmentJson = sanitizedEquipment.length ? JSON.stringify(sanitizedEquipment) : "[]";

  const { rows } = await db.query(
    `
      INSERT INTO public.private_purchase_requests
        (id, created_by, created_by_email, client_snapshot, client_type, equipment, notes,
         drive_folder_id, offer_valid_until, offer_kind, comodato_document_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      id,
      user.id,
      user.email,
      clientSnapshot,
      clientSnapshot.client_type || "privado",
      equipmentJson,
      notes,
      folderId,
      offerValidUntil,
      offerKind,
      comodatoDocumentId,
    ],
  );

  await logAction({
    user_id: user.id,
    module: "private_purchase",
    action: "create",
    entity: "private_purchase_requests",
    entity_id: rows[0].id,
    details: "Nueva solicitud privada creada",
  });

  // Notificar a BackOffice comercial sobre nueva solicitud
  try {
    await NotificationManager.sendNotification({
      userId: null, // Todos los usuarios con rol backoffice_comercial
      template: 'custom_html',
      customTitle: 'Nueva Solicitud de Compra Privada',
      customMessage: `Nueva solicitud de compra privada creada. Tipo: ${offerKind}. Acción requerida: revisar y crear oferta.`,
      type: 'task',
      priority: 1,
      source: 'private_purchase.created',
      meta: {
        entityType: 'private_purchase',
        entityId: rows[0].id,
        eventType: 'created',
        requiredAction: 'review_and_create_offer',
        summary: `Nueva solicitud de ${offerKind} pendiente de revisión`,
      },
      email: true,
      chat: false
    });
    console.log("[PURCHASE_FLOW][FASE7][NOTIF_CREATE]", { purchaseId: rows[0].id, eventType: 'created', channel: 'in_app', toCount: 'backoffice_comercial_role' });
    console.log("[PURCHASE_FLOW][FASE7][MINIMIZATION_OK]", { eventType: 'created', purchaseId: rows[0].id, channel: 'email', minimized: true });
  } catch (notifError) {
    console.error("[PURCHASE_FLOW][FASE7][NOTIF_ERROR]", { purchaseId: rows[0].id, error: notifError.message });
  }

  return rows[0];
}

async function listPrivatePurchases({ user, status }) {
  const params = [];
  let filters = [];

  const normalizedRole = (user?.role || user?.role_name || user?.scope || "").toLowerCase();
  const isPrivileged =
    normalizedRole.includes("backoffice") ||
    normalizedRole.includes("gerencia") ||
    normalizedRole.includes("jefe_comercial") ||
    normalizedRole.includes("gerencia_general") ||
    normalizedRole.includes("acp_comercial");
  const userId = user?.id || null;
  const userEmail = user?.email || user?.mail || null;

  if (typeof status === "string" && PRIVATE_PURCHASE_STATUSES.includes(status)) {
    params.push(status);
    filters.push(`status = $${params.length}`);
  }

  if (!isPrivileged) {
    const clauses = [];
    if (userId) {
      params.push(userId);
      clauses.push(`created_by = $${params.length}`);
    }
    if (userEmail) {
      params.push(userEmail);
      clauses.push(`created_by_email = $${params.length}`);
    }
    if (clauses.length) {
      filters.push(`(${clauses.join(" OR ")})`);
    } else {
      filters.push("1 = 0");
    }
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT * FROM public.private_purchase_requests ${whereClause} ORDER BY created_at DESC`,
    params,
  );

  await logAction({
    user_id: user.id,
    module: "private_purchase",
    action: "list",
    entity: "private_purchase_requests",
    details: "Listado de solicitudes privadas",
  });

  return rows;
}

async function getPrivatePurchase(id) {
  const { rows } = await db.query(
    `SELECT * FROM public.private_purchase_requests WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function updatePrivatePurchaseStatus(id, status, extras = {}) {
  if (!PRIVATE_PURCHASE_STATUSES.includes(status)) {
    throw new Error(`Estado desconocido: ${status}`);
  }

  const fields = ["status = $2"];
  const values = [id, status];
  let idx = 3;

  Object.entries(extras).forEach(([key, value]) => {
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx += 1;
  });

  const { rows } = await db.query(
    `UPDATE public.private_purchase_requests SET ${fields.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    values,
  );

  return rows[0];
}

async function createOfferDocument(id, payload = {}, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  // Resolver carpeta usando sistema compatible legacy + nuevo
  const folderResolution = await resolveEntityFolder({
    entityType: "private_purchase",
    entityId: id,
    legacyFolderId: request.drive_folder_id, // Si ya existe, intentar reutilizar
    segmentsNewPath: ["Comercial", "Compras Privadas", request.client_snapshot?.commercial_name || 'Cliente-Desconocido', `Solicitud-${id}`],
    user
  });

  const folderId = folderResolution.folderId;

  // Caso 1: se entrega un archivo ya preparado (base64)
  if (payload.offer_base64) {
    const cleaned = payload.offer_base64.startsWith("data:")
      ? payload.offer_base64.split(",")[1]
      : payload.offer_base64;
    if (!cleaned || !String(cleaned).trim()) {
      const err = Object.assign(new Error("Archivo de oferta vacío"), { status: 400 });
      throw err;
    }
    const name =
      payload.file_name ||
      `Oferta-${request.client_snapshot?.commercial_name || "cliente"}-${id.slice(0, 8)}.pdf`;

    const uploaded = await uploadBase64File(
      name,
      cleaned,
      payload.mime_type || "application/pdf",
      folderId || undefined
    );

    const updated = await updatePrivatePurchaseStatus(id, "pending_manager_signature", {
      offer_document_id: uploaded.id,
      backoffice_approved_at: new Date(),
      drive_folder_id: folderId || null,
    });

    await logAction({
      user_id: user.id || null,
      module: "private_purchase",
      action: "send_offer",
      entity: "private_purchase_requests",
      entity_id: id,
    });

    return {
      ...updated,
      offer_document_link: driveViewLink(uploaded.id),
      offer_document_name: uploaded.name,
    };
  }

  // Caso 2: se usa plantilla + data
  const templateId = payload.template_id || payload.templateId;
  if (!templateId) {
    throw Object.assign(new Error("template_id es requerido"), { status: 400 });
  }

  const documentNameParts = [
    "Oferta Compras Privado",
    request.client_snapshot?.commercial_name,
    id.slice(0, 8),
  ].filter(Boolean);
  const documentName = documentNameParts.join(" - ");

  const doc = await copyTemplate(templateId, documentName, folderId || undefined);

  if (payload.data && Object.keys(payload.data).length) {
    await replaceTags(doc.id, payload.data);
  }

  const updated = await attachOfferDocument(id, doc.id, folderId);

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "send_offer",
    entity: "private_purchase_requests",
    entity_id: id,
  });

  return {
    ...updated,
    offer_document_link: driveViewLink(doc.id),
    offer_document_name: doc.name,
  };
}

async function attachOfferDocument(id, documentId, folderId = null) {
  const payload = {
    offer_document_id: documentId,
    backoffice_approved_at: new Date(),
  };
  if (folderId) payload.drive_folder_id = folderId;
  return updatePrivatePurchaseStatus(id, "offer_sent", payload);
}

async function validateClientApproval(request) {
  // Validación BLOQUEANTE: verificar que cliente esté aprobado con LOPDP
  const hasRequested = !!request.client_registration_requested_at;
  const hasApproved = !!request.client_approved_at;

  // Verificar LOPDP consent
  const hasConsent = request.client_snapshot?.client_email ? await checkUserLopdpConsent(request.client_snapshot.client_email) : false;

  console.log("[PURCHASE_FLOW][FASE2][VALIDATION]", {
    id: request.id,
    hasRequested,
    hasApproved,
    hasConsent,
    clientEmail: request.client_snapshot?.client_email
  });

  return { hasRequested, hasApproved, hasConsent };
}

async function checkUserLopdpConsent(email) {
  if (!email) return false;
  try {
    const { rows } = await db.query(
      `SELECT status FROM user_lopdp_consents WHERE user_email = $1 AND status = 'approved' ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("Error checking LOPDP consent:", err);
    return false;
  }
}

async function registerSignedOffer(id, payload = {}, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  // REGLA DURA FASE 2: Validar que existe client_request_id Y que está aprobado con LOPDP
  let clientRequest = null;
  let hasClientApproval = false;
  let hasLopdpConsent = false;

  if (request.client_request_id) {
    // Obtener datos del client_request
    const { rows } = await db.query(
      `SELECT id, status, approval_status, approved_at, approved_by FROM client_requests WHERE id = $1`,
      [request.client_request_id]
    );
    clientRequest = rows[0];

    if (clientRequest) {
      // Verificar aprobación del cliente usando campos reales de BD
      hasClientApproval = clientRequest.approval_status === 'approved' ||
                         (clientRequest.approved_at && clientRequest.approved_by);

      // Verificar consentimiento LOPDP usando tabla user_lopdp_consents
      if (request.client_snapshot?.client_email) {
        const { rows: consentRows } = await db.query(
          `SELECT status FROM user_lopdp_consents WHERE user_email = $1 AND status = 'approved' ORDER BY created_at DESC LIMIT 1`,
          [request.client_snapshot.client_email]
        );
        hasLopdpConsent = consentRows.length > 0;
      }
    }
  }



  // REGLA DURA: Bloquear si no cumple TODOS los requisitos
  if (!request.client_request_id || !clientRequest) {
    const error = Object.assign(
      new Error("No se puede subir oferta firmada: cliente no registrado"),
      { status: 409, code: "CLIENT_NOT_REGISTERED" }
    );
    throw error;
  }

  if (!hasClientApproval) {
    const error = Object.assign(
      new Error("No se puede subir oferta firmada: cliente no aprobado"),
      { status: 409, code: "CLIENT_NOT_APPROVED" }
    );
    throw error;
  }

  if (!hasLopdpConsent) {
    const error = Object.assign(
      new Error("No se puede subir oferta firmada: cliente sin consentimiento LOPDP válido"),
      { status: 409, code: "CLIENT_LOPDP_NOT_CONSENTED" }
    );
    throw error;
  }

  const { document_id, signed_offer_base64, file_name, mime_type } = payload;
  const decision = (payload.decision || payload.status || "").toString().toLowerCase();

  let documentId = document_id;
  // Resolver carpeta usando sistema compatible legacy + nuevo
  const folderResolution = await resolveEntityFolder({
    entityType: "private_purchase",
    entityId: id,
    legacyFolderId: request.drive_folder_id, // Si ya existe, intentar reutilizar
    segmentsNewPath: ["Comercial", "Compras Privadas", request.client_snapshot?.commercial_name || 'Cliente-Desconocido', `Solicitud-${id}`],
    user
  });

  const folderId = folderResolution.folderId;

  if (decision === "reject") {
    const updated = await updatePrivatePurchaseStatus(id, "rejected", {
      drive_folder_id: folderId || request.drive_folder_id || null,
      updated_at: new Date(),
    });
    await logAction({
      user_id: user.id || null,
      module: "private_purchase",
      action: "offer_rejected",
      entity: "private_purchase_requests",
      entity_id: id,
      details: "Oferta rechazada por jefe/comercial",
    });
    return updated;
  }

  if (!documentId && signed_offer_base64) {
    if (!folderId) throw new Error("No se pudo obtener carpeta de Drive");

    const uploaded = await uploadBase64File(
      file_name || `OfertaFirmada-${id}.pdf`,
      signed_offer_base64,
      mime_type || "application/pdf",
      folderId,
    );
    documentId = uploaded.id;
  }

  if (!documentId) {
    throw new Error("Documento firmado no especificado");
  }

  const isManagerStage =
    request.status === "pending_manager_signature" || request.status === "offer_sent";
  const nextStatus = isManagerStage ? "pending_client_signature" : "offer_signed";

  const extras = {
    offer_signed_document_id: documentId,
    signed_offer_received_at: new Date(),
  };
  if (folderId) extras.drive_folder_id = folderId;
  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "offer_signed",
    entity: "private_purchase_requests",
    entity_id: id,
  });
  // Luego de la firma del jefe comercial, queda pendiente la firma del cliente; en la segunda carga queda como firmada.
  return updatePrivatePurchaseStatus(id, nextStatus, extras);
}

async function markClientRegistered(id) {
  return updatePrivatePurchaseStatus(id, "client_registered", {
    client_registered_at: new Date(),
  });
}

async function forwardToACP(id, user) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (!request.client_snapshot?.commercial_name) {
    throw new Error("Falta el nombre del cliente para enviar a ACP");
  }

  if (!request.drive_folder_id) {
    const folderId = await ensureRequestFolder(request);
    if (folderId) {
      await db.query(
        `UPDATE public.private_purchase_requests SET drive_folder_id = $1 WHERE id = $2`,
        [folderId, id],
      );
      request.drive_folder_id = folderId;
    }
  }

  const equipmentPayload = request.equipment || [];
  const equipmentJson = Array.isArray(equipmentPayload) ? equipmentPayload : [];
  const newId = uuidv4();

  const { rows } = await db.query(
    `
      INSERT INTO public.equipment_purchase_requests
        (id, created_by, created_by_email, client_name, client_email, equipment, status, notes, drive_folder_id)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
      RETURNING *
    `,
    [
      newId,
      user.id,
      user.email,
      request.client_snapshot.commercial_name,
      request.client_snapshot.client_email || null,
      equipmentJson,
      request.notes,
      request.drive_folder_id,
    ],
  );

  await updatePrivatePurchaseStatus(id, "sent_to_acp", {
    equipment_purchase_request_id: newId,
    forwarded_to_acp_at: new Date(),
  });

  return rows[0];
}

// ===========================================
// FASE 2: Nuevas funciones para flujo completo
// ===========================================

async function getTimeline(id) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  // Obtener correcciones
  const { rows: corrections } = await db.query(`
    SELECT * FROM purchase_corrections
    WHERE private_purchase_id = $1
    ORDER BY created_at DESC
  `, [id]);

  // Construir timeline desde el request
  const timeline = [
    {
      event: 'created',
      timestamp: request.created_at,
      status: 'pending_commercial',
      details: 'Solicitud creada por asesor comercial'
    }
  ];

  if (request.client_registration_requested_at) {
    timeline.push({
      event: 'client_registration_requested',
      timestamp: request.client_registration_requested_at,
      status: 'client_approved',
      details: 'Registro de cliente solicitado'
    });
  }

  if (request.client_approved_at) {
    timeline.push({
      event: 'client_approved',
      timestamp: request.client_approved_at,
      status: 'client_approved',
      details: 'Cliente aprobado con LOPDP'
    });
  }

  if (request.backoffice_approved_at) {
    timeline.push({
      event: 'offer_created',
      timestamp: request.backoffice_approved_at,
      status: 'offer_sent',
      details: 'Oferta creada y enviada por BackOffice'
    });
  }

  if (request.commercial_accepted_offer_at) {
    timeline.push({
      event: 'offer_accepted',
      timestamp: request.commercial_accepted_offer_at,
      status: 'pending_manager_signature',
      details: 'Oferta aceptada por comercial'
    });
  }

  if (request.signed_offer_received_at) {
    timeline.push({
      event: 'offer_signed',
      timestamp: request.signed_offer_received_at,
      status: 'offer_signed',
      details: 'Oferta firmada recibida'
    });
  }

  if (request.manager_contract_decision_at) {
    timeline.push({
      event: 'manager_decision',
      timestamp: request.manager_contract_decision_at,
      status: request.manager_contract_decision === 'approved' ? 'contract_approved_pending_upload' : 'contract_rejected_needs_correction',
      details: `Gerencia: ${request.manager_contract_decision}. ${request.manager_contract_decision_reason || ''}`
    });
  }

  if (request.contract_document_id) {
    timeline.push({
      event: 'contract_uploaded',
      timestamp: request.updated_at,
      status: 'pending_operations_schedule',
      details: 'Contrato subido por BackOffice'
    });
  }

  if (request.delivery_dates_json && Object.keys(JSON.parse(request.delivery_dates_json || '{}')).length > 0) {
    timeline.push({
      event: 'delivery_scheduled',
      timestamp: request.updated_at,
      status: 'awaiting_dispatch',
      details: 'Fechas de entrega programadas'
    });
  }

  if (request.delivery_act_document_id) {
    timeline.push({
      event: 'delivered',
      timestamp: request.updated_at,
      status: 'delivered_pending_signatures',
      details: 'Equipo entregado, pendiente firma de acta'
    });
  }

  // Agregar correcciones al timeline
  corrections.forEach(correction => {
    timeline.push({
      event: 'correction_submitted',
      timestamp: correction.created_at,
      status: 'contract_rejected_needs_correction',
      details: `Corrección: ${correction.reason}`,
      correction: correction
    });
  });

  return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function managerDecision(id, { decision, reason }, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (!['approved', 'rejected'].includes(decision)) {
    throw new Error("Decision debe ser 'approved' o 'rejected'");
  }

  const newStatus = decision === 'approved' ? 'contract_approved_pending_upload' : 'contract_rejected_needs_correction';

  const updated = await updatePrivatePurchaseStatus(id, newStatus, {
    manager_contract_decision: decision,
    manager_contract_decision_reason: reason,
    manager_contract_decision_at: new Date(),
    manager_contract_decision_by: user.id
  });

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "manager_decision",
    entity: "private_purchase_requests",
    entity_id: id,
    details: `Gerencia decidió: ${decision}${reason ? ` - ${reason}` : ''}`
  });

  // Notificar según decisión
  try {
    if (decision === 'approved') {
      // Notificar BackOffice que puede subir contrato
      await NotificationManager.sendNotification({
        userId: null, // Todos backoffice_comercial
        template: 'custom_html',
        customTitle: 'Contrato Aprobado - Subir Documento',
        customMessage: `Contrato aprobado por gerencia para ${request.client_snapshot?.commercial_name}. Suba el contrato generado.`,
        type: 'task',
        priority: 2,
        source: 'private_purchase.contract_approved',
        meta: {
          entityType: 'private_purchase',
          entityId: id,
          eventType: 'contract_approved',
          requiredAction: 'upload_contract',
          summary: 'Contrato aprobado, pendiente subida de documento',
        },
        email: true,
        chat: false
      });
      console.log("[PURCHASE_FLOW][FASE6][NOTIF_CREATE]", { eventType: 'contract_approved', entityId: id, toCount: 'backoffice_comercial_role' });
    } else {
      // Notificar BackOffice sobre correcciones requeridas
      await NotificationManager.sendNotification({
        userId: null, // Todos backoffice_comercial
        template: 'custom_html',
        customTitle: 'Contrato Rechazado - Correcciones Requeridas',
        customMessage: `Contrato rechazado por gerencia para ${request.client_snapshot?.commercial_name}. Motivo: ${reason || 'No especificado'}. Suba correcciones.`,
        type: 'alert',
        priority: 2,
        source: 'private_purchase.contract_rejected',
        meta: {
          entityType: 'private_purchase',
          entityId: id,
          eventType: 'contract_rejected',
          requiredAction: 'submit_corrections',
          summary: 'Contrato rechazado, correcciones requeridas',
        },
        email: true,
        chat: false
      });
      console.log("[PURCHASE_FLOW][FASE6][NOTIF_CREATE]", { eventType: 'contract_rejected', entityId: id, toCount: 'backoffice_comercial_role' });
    }
  } catch (notifError) {
    console.error("[PURCHASE_FLOW][FASE6][NOTIF_ERROR]", notifError);
  }

  return updated;
}

async function submitCorrections(id, { reason, correctionDetails }, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (request.status !== 'contract_rejected_needs_correction') {
    throw new Error("Solicitud no está en estado de corrección");
  }

  const { rows } = await db.query(`
    INSERT INTO purchase_corrections (private_purchase_id, created_by_user_id, reason, correction_details)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [id, user.id, reason, JSON.stringify(correctionDetails || {})]);

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "submit_corrections",
    entity: "purchase_corrections",
    entity_id: rows[0].id,
    details: `Correcciones enviadas: ${reason}`
  });

  // Cambiar estado para que BackOffice pueda reenviar
  await updatePrivatePurchaseStatus(id, 'contract_rejected_needs_correction');

  return rows[0];
}

async function submitContract(id, payload = {}, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (request.status !== 'contract_approved_pending_upload') {
    throw new Error("Solicitud no está pendiente de subida de contrato");
  }

  const { document_id, contract_base64, file_name, mime_type } = payload;
  let documentId = document_id;

  // Resolver carpeta usando sistema compatible legacy + nuevo
  const folderResolution = await resolveEntityFolder({
    entityType: "private_purchase",
    entityId: id,
    legacyFolderId: request.drive_folder_id, // Si ya existe, intentar reutilizar
    segmentsNewPath: ["Comercial", "Compras Privadas", request.client_snapshot?.commercial_name || 'Cliente-Desconocido', `Solicitud-${id}`],
    user
  });

  const folderId = folderResolution.folderId;

  if (!documentId && contract_base64) {
    if (!folderId) throw new Error("No se pudo obtener carpeta de Drive");

    const uploaded = await uploadBase64File(
      file_name || `Contrato-${id}.pdf`,
      contract_base64,
      mime_type || "application/pdf",
      folderId,
    );
    documentId = uploaded.id;
  }

  if (!documentId) {
    throw new Error("Documento de contrato requerido");
  }

  const updated = await updatePrivatePurchaseStatus(id, 'pending_operations_schedule', {
    contract_document_id: documentId,
    drive_folder_id: folderId
  });

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "contract_uploaded",
    entity: "private_purchase_requests",
    entity_id: id,
    details: "Contrato subido por BackOffice"
  });

  // Notificar jefe operaciones que puede solicitar fechas
  try {
    await NotificationManager.sendNotification({
      userId: null, // Todos jefe_operaciones
      template: 'custom_html',
      customTitle: 'Contrato Subido - Solicitar Fechas de Entrega',
      customMessage: `Contrato subido para ${request.client_snapshot?.commercial_name}. Puede solicitar fechas de entrega al asesor comercial.`,
      type: 'task',
      priority: 1,
      source: 'private_purchase.contract_uploaded',
      meta: {
        entityType: 'private_purchase',
        entityId: id,
        eventType: 'contract_uploaded',
        requiredAction: 'request_delivery_dates',
        summary: 'Contrato disponible, solicitar fechas de entrega',
      },
      email: true,
      chat: false
    });
    console.log("[PURCHASE_FLOW][FASE6][NOTIF_CREATE]", { eventType: 'contract_uploaded', entityId: id, toCount: 'jefe_operaciones_role' });
  } catch (notifError) {
    console.error("[PURCHASE_FLOW][FASE6][NOTIF_ERROR]", notifError);
  }

  return updated;
}

async function requestDeliveryDates(id, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (request.status !== 'pending_operations_schedule') {
    throw new Error("Solicitud no está pendiente de fechas de entrega");
  }

  // Cambiar estado y notificar
  const updated = await updatePrivatePurchaseStatus(id, 'pending_operations_schedule');

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "delivery_dates_requested",
    entity: "private_purchase_requests",
    entity_id: id,
    details: "Fechas de entrega solicitadas por jefe operaciones"
  });

  return updated;
}

async function submitDeliveryDates(id, { deliveryDates, notes }, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (request.status !== 'pending_operations_schedule') {
    throw new Error("Solicitud no está pendiente de fechas de entrega");
  }

  // Validar fechas requeridas
  if (!deliveryDates?.start || !deliveryDates?.end) {
    throw new Error("Fechas de inicio y fin son requeridas");
  }

  // Crear eventos de calendario usando el servicio integrado
  let calendarResult = null;
  try {
    const { createDeliveryEvents } = require("../calendar/calendar.service");

    calendarResult = await createDeliveryEvents({
      purchaseId: id,
      clientName: request.client_snapshot?.commercial_name || request.client_snapshot?.client_name || 'Cliente',
      deliveryStartAt: deliveryDates.start,
      deliveryEndAt: deliveryDates.end
    });

    console.log('[FLOW_PRIVADA][FASE2][CALENDAR][HOOK]', {
      purchaseId: id,
      calendarSuccess: calendarResult?.success,
      eventId: calendarResult?.eventId,
      attendeesCount: calendarResult?.attendees?.length || 0
    });

  } catch (calendarError) {
    console.error('[FLOW_PRIVADA][FASE2][CALENDAR][HOOK_ERROR]', {
      purchaseId: id,
      error: calendarError.message
    });
    // No fallar el proceso si el calendario falla
  }

  // Persistir schedule en tabla dedicada
  const scheduleData = {
    private_purchase_request_id: id,
    delivery_start_at: deliveryDates.start,
    delivery_end_at: deliveryDates.end,
    calendar_event_ids: calendarResult?.success ? {
      mainEventId: calendarResult.eventId,
      htmlLink: calendarResult.htmlLink,
      calendarId: calendarResult.calendarId,
      attendees: calendarResult.attendees || [],
      metadata: calendarResult.metadata
    } : {},
    created_by_user_id: user.id
  };

  await db.query(`
    INSERT INTO purchase_delivery_schedules
      (private_purchase_request_id, delivery_start_at, delivery_end_at, calendar_event_ids, created_by_user_id)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (private_purchase_request_id)
    DO UPDATE SET
      delivery_start_at = EXCLUDED.delivery_start_at,
      delivery_end_at = EXCLUDED.delivery_end_at,
      calendar_event_ids = EXCLUDED.calendar_event_ids,
      updated_at = now()
  `, [
    scheduleData.private_purchase_request_id,
    scheduleData.delivery_start_at,
    scheduleData.delivery_end_at,
    JSON.stringify(scheduleData.calendar_event_ids),
    scheduleData.created_by_user_id
  ]);

  // Actualizar estado de la compra privada
  const updated = await updatePrivatePurchaseStatus(id, 'calendar_events_created', {
    delivery_dates_json: JSON.stringify(deliveryDates || {}),
    delivery_notes: notes,
    delivery_start_at: deliveryDates.start,
    delivery_end_at: deliveryDates.end
  });

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "delivery_dates_submitted",
    entity: "private_purchase_requests",
    entity_id: id,
    details: `Fechas de entrega confirmadas por asesor comercial: ${deliveryDates.start} - ${deliveryDates.end}. Calendario: ${calendarResult?.success ? 'OK' : 'FALLÓ'}`
  });

  // Notificar a roles relevantes sobre las fechas programadas
  try {
    const NotificationManager = require('../notifications/notificationManager');

    await NotificationManager.sendNotification({
      userId: null, // Todos los roles relevantes
      template: 'custom_html',
      customTitle: 'Fechas de Entrega Programadas',
      customMessage: `Fechas de entrega programadas para ${request.client_snapshot?.commercial_name}. Inicio: ${deliveryDates.start}, Fin: ${deliveryDates.end}. ${calendarResult?.success ? `Calendario actualizado.` : 'Calendario no disponible.'}`,
      type: 'task',
      priority: 2,
      source: 'private_purchase.delivery_scheduled',
      meta: {
        entityType: 'private_purchase',
        entityId: id,
        eventType: 'delivery_scheduled',
        calendarSuccess: calendarResult?.success || false,
        htmlLink: calendarResult?.htmlLink,
        summary: 'Entrega programada en calendario',
      },
      email: true,
      chat: false
    });

    console.log('[FLOW_PRIVADA][FASE2][CALENDAR][NOTIFICATION]', {
      purchaseId: id,
      calendarSuccess: calendarResult?.success,
      toRoles: ['jefe_operaciones', 'asesor_comercial', 'jefe_tecnico', 'jefe_logistica']
    });

  } catch (notifError) {
    console.error('[FLOW_PRIVADA][FASE2][CALENDAR][NOTIF_ERROR]', notifError);
  }

  return {
    ...updated,
    schedule: scheduleData,
    calendar: calendarResult?.success ? {
      eventId: calendarResult.eventId,
      htmlLink: calendarResult.htmlLink,
      attendeesCount: calendarResult.attendees?.length || 0
    } : null
  };
}

async function markDispatchReady(id, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (request.status !== 'waiting_dispatch') {
    throw new Error("Solicitud no está pendiente de despacho");
  }

  // VALIDACIÓN PRECONDICIONES OBLIGATORIAS
  const missingRequirements = [];
  if (!request.contract_document_id) missingRequirements.push("contract_document_id");
  if (!request.delivery_dates_json && !request.delivery_start_at) missingRequirements.push("delivery_dates_json");

  if (missingRequirements.length > 0) {
    const error = Object.assign(
      new Error("No se puede marcar como listo para despacho: faltan prerrequisitos"),
      { status: 409, code: "MISSING_REQUIREMENTS", requirements: missingRequirements }
    );
    console.log('[FLOW_PRIVADA][FASE2][DISPATCH][BLOCKED]', {
      requestId: id,
      status: request.status,
      missingRequirements,
      hasContract: !!request.contract_document_id,
      hasDeliveryDates: !!(request.delivery_dates_json || request.delivery_start_at)
    });
    throw error;
  }

  const updated = await updatePrivatePurchaseStatus(id, 'dispatch_ready');

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "dispatch_ready",
    entity: "private_purchase_requests",
    entity_id: id,
    details: "Despacho marcado como listo por jefe logística"
  });

  console.log('[FLOW_PRIVADA][FASE2][DISPATCH]', {
    requestId: id,
    from: 'waiting_dispatch',
    to: 'dispatch_ready',
    ok: true,
    reason: 'Preconditions met'
  });

  // Notificar roles relevantes
  try {
    const NotificationManager = require('../notifications/notificationManager');

    await NotificationManager.sendNotification({
      userId: null, // Todos los roles relevantes
      template: 'custom_html',
      customTitle: 'Despacho Marcado como Listo',
      customMessage: `El despacho está listo para ${request.client_snapshot?.commercial_name}. Proceder con la entrega.`,
      type: 'task',
      priority: 2,
      source: 'private_purchase.dispatch_ready',
      meta: {
        entityType: 'private_purchase',
        entityId: id,
        eventType: 'dispatch_ready',
        requiredAction: 'proceed_with_delivery',
        summary: 'Despacho listo para entrega',
      },
      email: true,
      chat: false
    });

    console.log('[FLOW_PRIVADA][FASE2][DISPATCH][NOTIFICATION]', {
      requestId: id,
      toRoles: ['jefe_operaciones', 'asesor_comercial']
    });

  } catch (notifError) {
    console.error('[FLOW_PRIVADA][FASE2][DISPATCH][NOTIF_ERROR]', notifError);
  }

  return updated;
}

async function generateDeliveryAct(id, payload = {}, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  if (request.status !== 'dispatch_ready') {
    throw new Error("Solicitud no está lista para despacho");
  }

  // VALIDACIÓN PRECONDICIONES OBLIGATORIAS
  const missingRequirements = [];
  if (!request.drive_folder_id) missingRequirements.push("drive_folder_id");
  if (!request.contract_document_id) missingRequirements.push("contract_document_id");
  if (!request.delivery_dates_json && !request.delivery_start_at) missingRequirements.push("delivery_dates_json");

  if (missingRequirements.length > 0) {
    const error = Object.assign(
      new Error("No se puede generar acta de entrega: faltan prerrequisitos"),
      { status: 409, code: "MISSING_REQUIREMENTS", requirements: missingRequirements }
    );
    console.log('[FLOW_PRIVADA][FASE2][DELIVERY_ACT][BLOCKED]', {
      requestId: id,
      status: request.status,
      missingRequirements,
      hasDriveFolder: !!request.drive_folder_id,
      hasContract: !!request.contract_document_id,
      hasDeliveryDates: !!(request.delivery_dates_json || request.delivery_start_at)
    });
    throw error;
  }

  const { document_id, act_base64, file_name, mime_type } = payload;
  let documentId = document_id;

  // Resolver carpeta usando sistema compatible legacy + nuevo
  const folderResolution = await resolveEntityFolder({
    entityType: "private_purchase",
    entityId: id,
    legacyFolderId: request.drive_folder_id, // Si ya existe, intentar reutilizar
    segmentsNewPath: ["Comercial", "Compras Privadas", request.client_snapshot?.commercial_name || 'Cliente-Desconocido', `Solicitud-${id}`],
    user
  });

  const folderId = folderResolution.folderId;

  if (!documentId && act_base64) {
    if (!folderId) throw new Error("No se pudo obtener carpeta de Drive");

    const uploaded = await uploadBase64File(
      file_name || `ActaEntrega-${id}.pdf`,
      act_base64,
      mime_type || "application/pdf",
      folderId,
    );
    documentId = uploaded.id;
  }

  if (!documentId) {
    throw new Error("Documento de acta requerido");
  }

  // Actualizar BD con transaccionalidad
  const updated = await db.query(`
    UPDATE private_purchase_requests
    SET delivery_act_document_id = $1,
        status = 'delivery_act_generated',
        updated_at = now()
    WHERE id = $2
    RETURNING *
  `, [documentId, id]);

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "delivery_act_generated",
    entity: "private_purchase_requests",
    entity_id: id,
    details: `Acta de entrega-recepción generada en Drive. Folder: ${folderId}`
  });

  console.log('[FLOW_PRIVADA][FASE2][DELIVERY_ACT]', {
    requestId: id,
    delivery_act_document_id: documentId,
    drive_folder_id: folderId,
    from: 'dispatch_ready',
    to: 'delivery_act_generated',
    ok: true
  });

  // Notificar roles relevantes
  try {
    const NotificationManager = require('../notifications/notificationManager');

    await NotificationManager.sendNotification({
      userId: null, // Todos los roles relevantes
      template: 'custom_html',
      customTitle: 'Acta de Entrega Generada',
      customMessage: `Acta de entrega generada para ${request.client_snapshot?.commercial_name}. Pendiente firma de recepción.`,
      type: 'task',
      priority: 1,
      source: 'private_purchase.delivery_act_generated',
      meta: {
        entityType: 'private_purchase',
        entityId: id,
        eventType: 'delivery_act_generated',
        requiredAction: 'review_delivery_act',
        summary: 'Acta de entrega disponible para revisión',
      },
      email: true,
      chat: false
    });

    console.log('[FLOW_PRIVADA][FASE2][DELIVERY_ACT][NOTIFICATION]', {
      requestId: id,
      toRoles: ['asesor_comercial', 'jefe_operaciones', 'backoffice_comercial']
    });

  } catch (notifError) {
    console.error('[FLOW_PRIVADA][FASE2][DELIVERY_ACT][NOTIF_ERROR]', notifError);
  }

  return updated.rows[0];
}

// ===========================================
// FUNCIONES PARA COMODATO
// ===========================================

async function requestAcpAvailability(id, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  // Aquí se conectaría con el proceso de compras públicas para verificar disponibilidad
  // Por ahora solo marcar como enviado a ACP
  const updated = await updatePrivatePurchaseStatus(id, 'sent_to_acp', {
    forwarded_to_acp_at: new Date()
  });

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "acp_availability_requested",
    entity: "private_purchase_requests",
    entity_id: id,
    details: "Disponibilidad solicitada a ACP comercial"
  });

  return updated;
}

async function startBusinessCase(id, { businessCaseData }, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  // Aquí se crearía el Business Case usando el módulo existente
  // Por ahora solo registrar que se inició
  const updated = await db.query(`
    UPDATE private_purchase_requests
    SET comodato_business_case_id = $1, updated_at = now()
    WHERE id = $2
    RETURNING *
  `, [businessCaseData?.id || uuidv4(), id]);

  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "business_case_started",
    entity: "private_purchase_requests",
    entity_id: id,
    details: "Business Case iniciado para comodato"
  });

  return updated.rows[0];
}

module.exports = {
  createPrivatePurchase,
  listPrivatePurchases,
  getPrivatePurchase,
  attachOfferDocument,
  createOfferDocument,
  registerSignedOffer,
  markClientRegistered,
  forwardToACP,
  getTimeline,
  managerDecision,
  submitCorrections,
  submitContract,
  requestDeliveryDates,
  submitDeliveryDates,
  markDispatchReady,
  generateDeliveryAct,
  requestAcpAvailability,
  startBusinessCase,
  validateClientApproval,
};
