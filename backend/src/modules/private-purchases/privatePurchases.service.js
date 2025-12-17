/**
 * Service: Private Purchases
 * -------------------------
 * Orquesta la creación y evolución de las solicitudes privadas de compra
 * siguiendo lo definido en la migración 014_private_purchase_requests.sql.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { v4: uuidv4 } = require("uuid");
const {
  ensureFolder,
  copyTemplate,
  replaceTags,
  uploadBase64File,
} = require("../../utils/drive");
const { logAction } = require("../../utils/audit");
const { createPurchaseRequest } = require("../equipment-purchases/equipmentPurchases.service");

const PRIVATE_PURCHASE_STATUSES = [
  "pending_commercial",
  "pending_backoffice",
  "offer_sent",
  "pending_manager_signature",
  "pending_client_signature",
  "offer_signed",
  "client_registered",
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
  const sanitize = (value) => String(value || "").replace(/[\\/:*?"<>|]/g, "-").trim() || "general";
  const parts = pathStr
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitize(segment));
  let currentParent = DRIVE_BASE_FOLDER;
  for (const segment of parts) {
    const folder = await ensureFolder(segment, currentParent);
    currentParent = folder?.id || currentParent;
  }
  return currentParent;
}

function buildSignedFolderPath(request, user = {}) {
  const sanitize = (value) =>
    String(value || "")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim() || "general";

  const commercial =
    request.created_by_email ||
    request.created_by ||
    user.email ||
    user.mail ||
    "comercial";
  const client = request.client_snapshot?.commercial_name || "cliente";
  return `/Ofertas Firmadas/${sanitize(commercial)}/${sanitize(client)}`;
}

function toEquipmentArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null) return [raw];
  return normalizeEquipmentInput(raw);
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
  const folderRequest = { id };
  const folderId = await ensureRequestFolder(folderRequest, true);

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

  const folderId =
    payload.folder_id ||
    payload.folderId ||
    (payload.folder_path ? await ensurePathFolder(payload.folder_path) : null) ||
    (await ensureRequestFolder(request));

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

    const withBc = await ensureBusinessCaseFromPrivatePurchase({
      request: updated,
      user,
    });

    return {
      ...withBc,
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

  const withBc = await ensureBusinessCaseFromPrivatePurchase({
    request: updated,
    user,
  });

  return {
    ...withBc,
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

async function registerSignedOffer(id, payload = {}, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");
  if (request.status === "sent_to_acp") {
    const err = Object.assign(new Error("La solicitud ya fue cerrada y enviada a ACP"), { status: 400 });
    throw err;
  }

  const { document_id, signed_offer_base64, file_name, mime_type } = payload;
  const decision = (payload.decision || payload.status || "").toString().toLowerCase();

  let documentId = document_id;
  const signedFolderPath =
    payload.signed_folder_path || payload.folder_path || buildSignedFolderPath(request, user);
  const folderId =
    payload.folder_id ||
    payload.folderId ||
    (signedFolderPath ? await ensurePathFolder(signedFolderPath) : null) ||
    request.drive_folder_id ||
    (await ensureRequestFolder(request));

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
    request.status === "pending_manager_signature" ||
    request.status === "offer_sent" ||
    request.status === "pending_client_signature";
  if (!isManagerStage && decision !== "reject") {
    const err = Object.assign(
      new Error("La solicitud no está en etapa de firma de jefe comercial"),
      { status: 400 },
    );
    throw err;
  }
  const nextStatus = "offer_signed";

  const extras = {
    offer_signed_document_id: documentId,
    signed_offer_received_at: new Date(),
    offer_signed_uploaded_at: new Date(),
  };
  if (folderId) extras.drive_folder_id = folderId;
  await logAction({
    user_id: user.id || null,
    module: "private_purchase",
    action: "offer_signed",
    entity: "private_purchase_requests",
    entity_id: id,
  });
  // Firma del jefe comercial: cerrar el flujo interno y asegurar Business Case
  const updated = await updatePrivatePurchaseStatus(id, nextStatus, extras);

  const requestSnapshot = { ...request, ...updated, offer_signed_document_id: documentId };
  return ensureBusinessCaseFromPrivatePurchase({ request: requestSnapshot, user, folderId });
}

async function ensureBusinessCaseFromPrivatePurchase({ request, user, folderId }) {
  if (!request) throw new Error("Solicitud privada no encontrada");
  if (request.equipment_purchase_request_id) return request;

  const equipment = toEquipmentArray(request.equipment);
  const clientSnapshot = request.client_snapshot || {};
  const clientName = clientSnapshot.commercial_name || "Cliente privado";

  try {
    const bcRequest = await createPurchaseRequest({
      user: user || {},
      clientId: request.client_request_id || clientSnapshot.client_request_id || null,
      clientName,
      clientEmail: clientSnapshot.client_email || clientSnapshot.contact_email || null,
      equipment,
      notes: request.notes,
      extra: {
        source: "private_purchase",
        private_purchase_id: request.id,
        signed_offer_document_id: request.offer_signed_document_id || null,
      },
      requestType: "business_case",
    });

    const extras = {
      equipment_purchase_request_id: bcRequest.id,
    };
    if (folderId) extras.drive_folder_id = folderId;

    const updated = await updatePrivatePurchaseStatus(request.id, request.status, extras);

    await logAction({
      user_id: user.id || null,
      module: "private_purchase",
      action: "auto_bc_created",
      entity: "private_purchase_requests",
      entity_id: request.id,
      details: `Business Case ${bcRequest.id} generado automáticamente`,
    });

    return { ...updated, equipment_purchase_request_id: bcRequest.id };
  } catch (error) {
    logger.error(
      "No se pudo iniciar Business Case para compra privada %s: %s",
      request.id,
      error.message,
    );
    const err = Object.assign(new Error("No se pudo iniciar el Business Case"), { status: 500 });
    throw err;
  }
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

module.exports = {
  createPrivatePurchase,
  listPrivatePurchases,
  getPrivatePurchase,
  attachOfferDocument,
  createOfferDocument,
  registerSignedOffer,
  markClientRegistered,
  forwardToACP,
};
