const crypto = require("crypto");

function decodeBase64Pdf(base64Value) {
  if (!base64Value || typeof base64Value !== "string") {
    const error = new Error("document.pdf_base64 es obligatorio");
    error.status = 400;
    throw error;
  }

  const cleaned = base64Value.replace(/^data:application\/pdf;base64,/, "").trim();
  let buffer;
  try {
    buffer = Buffer.from(cleaned, "base64");
  } catch (_error) {
    const error = new Error("document.pdf_base64 no es un base64 valido");
    error.status = 400;
    throw error;
  }

  if (!buffer.length) {
    const error = new Error("document.pdf_base64 esta vacio");
    error.status = 400;
    throw error;
  }

  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    const error = new Error("document.pdf_base64 debe contener un PDF valido");
    error.status = 400;
    throw error;
  }

  return { cleaned, buffer };
}

function validateCreateWorkflowPayload(body = {}) {
  const sourceModule = String(body.source_module || "").trim();
  const sourceEntity = String(body.source_entity || "").trim();
  const documentType = String(body.document_type || "").trim();
  const sourceEntityId = Number(body.source_entity_id);
  const title = String(body.title || "").trim();
  const document = body.document || {};
  const signers = Array.isArray(body.signers) ? body.signers : [];

  if (!sourceModule) {
    const error = new Error("source_module es obligatorio");
    error.status = 400;
    throw error;
  }
  if (!sourceEntity) {
    const error = new Error("source_entity es obligatorio");
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(sourceEntityId) || sourceEntityId <= 0) {
    const error = new Error("source_entity_id debe ser numerico y mayor a cero");
    error.status = 400;
    throw error;
  }
  if (!documentType) {
    const error = new Error("document_type es obligatorio");
    error.status = 400;
    throw error;
  }
  if (!title) {
    const error = new Error("title es obligatorio");
    error.status = 400;
    throw error;
  }
  if (!String(document.filename || "").trim()) {
    const error = new Error("document.filename es obligatorio");
    error.status = 400;
    throw error;
  }
  if (!signers.length) {
    const error = new Error("Debe incluir al menos un firmante");
    error.status = 400;
    throw error;
  }

  const seenOrders = new Set();
  const seenSignerEmails = new Set();
  const seenSignerUserIds = new Set();
  const normalizedSigners = signers.map((signer, index) => {
    const sequenceOrder = Number(signer.sequence_order);
    if (!Number.isFinite(sequenceOrder) || sequenceOrder <= 0) {
      const error = new Error(`signers[${index}].sequence_order debe ser numerico y mayor a cero`);
      error.status = 400;
      throw error;
    }
    if (seenOrders.has(sequenceOrder)) {
      const error = new Error(`sequence_order duplicado: ${sequenceOrder}`);
      error.status = 400;
      throw error;
    }
    seenOrders.add(sequenceOrder);

    const email = String(signer.email || "").trim().toLowerCase();
    const name = String(signer.name || "").trim();
    if (!email) {
      const error = new Error(`signers[${index}].email es obligatorio`);
      error.status = 400;
      throw error;
    }
    if (!name) {
      const error = new Error(`signers[${index}].name es obligatorio`);
      error.status = 400;
      throw error;
    }

    const userId = signer.user_id ? Number(signer.user_id) : null;
    if (seenSignerEmails.has(email) || (userId && seenSignerUserIds.has(userId))) {
      const error = new Error(`firmante duplicado: ${email}`);
      error.status = 400;
      throw error;
    }
    seenSignerEmails.add(email);
    if (userId) seenSignerUserIds.add(userId);

    return {
      user_id: userId,
      email,
      name,
      role: String(signer.role || "").trim().toLowerCase() || null,
      sequence_order: sequenceOrder,
      is_required: signer.is_required !== false,
    };
  }).sort((a, b) => a.sequence_order - b.sequence_order);

  const { cleaned, buffer } = decodeBase64Pdf(document.pdf_base64);
  const sourceSha256 =
    String(document.source_sha256 || "").trim().toLowerCase() ||
    crypto.createHash("sha256").update(buffer).digest("hex");

  return {
    sourceModule,
    sourceEntity,
    sourceEntityId,
    documentType,
    title,
    description: String(body.description || "").trim() || null,
    document: {
      filename: String(document.filename || "").trim(),
      pdf_base64: cleaned,
      source_sha256: sourceSha256,
    },
    signers: normalizedSigners,
    meta: body.meta && typeof body.meta === "object" ? body.meta : {},
  };
}

function validateSignerActionPayload(body = {}, { requireConsent = false, requireReason = false } = {}) {
  if (requireConsent && body.consent !== true) {
    const error = new Error("Se requiere consentimiento expreso");
    error.status = 400;
    throw error;
  }

  if (requireReason) {
    const reason = String(body.reason || "").trim();
    if (!reason) {
      const error = new Error("reason es obligatorio");
      error.status = 400;
      throw error;
    }
  }

  let signaturePlacement = null;
  if (body.signature_placement && typeof body.signature_placement === "object") {
    const { page_number, x_pct, y_pct } = body.signature_placement;
    const pg = Number(page_number);
    const xp = Number(x_pct);
    const yp = Number(y_pct);
    if (
      Number.isFinite(pg) &&
      pg >= 1 &&
      Number.isFinite(xp) &&
      xp >= 0 &&
      xp <= 100 &&
      Number.isFinite(yp) &&
      yp >= 0 &&
      yp <= 100
    ) {
      signaturePlacement = { page_number: pg, x_pct: xp, y_pct: yp };
    }
  }

  return {
    consent_text: String(body.consent_text || "").trim() || null,
    session_id: String(body.session_id || "").trim() || null,
    signature_visual_base64: String(body.signature_visual_base64 || "").trim() || null,
    signature_placement: signaturePlacement,
    reason: String(body.reason || "").trim() || null,
  };
}

module.exports = {
  validateCreateWorkflowPayload,
  validateSignerActionPayload,
};
