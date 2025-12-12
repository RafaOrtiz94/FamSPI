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

const PRIVATE_PURCHASE_STATUSES = [
  "pending_commercial",
  "pending_backoffice",
  "offer_sent",
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

  if (typeof status === "string" && PRIVATE_PURCHASE_STATUSES.includes(status)) {
    params.push(status);
    filters.push(`status = $${params.length}`);
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

  const templateId = payload.template_id || payload.templateId;
  if (!templateId) {
    throw Object.assign(new Error("template_id es requerido"), { status: 400 });
  }

  const folderId =
    payload.folder_id || payload.folderId || (await ensureRequestFolder(request));

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

async function registerSignedOffer(id, payload = {}, user = {}) {
  const request = await getPrivatePurchase(id);
  if (!request) throw new Error("Solicitud privada no encontrada");

  const { document_id, signed_offer_base64, file_name, mime_type } = payload;

  let documentId = document_id;
  const folderId =
    request.drive_folder_id || (await ensureRequestFolder(request));

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
  return updatePrivatePurchaseStatus(id, "offer_signed", extras);
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
