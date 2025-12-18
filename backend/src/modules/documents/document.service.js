/**
 * ============================================================
 * 📄 Service: Documents (SPI Fam)
 * ------------------------------------------------------------
 * Crea, firma y exporta documentos de Google Docs
 * con trazabilidad y auditoría extendida.
 * ============================================================
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive, docs } = require("../../config/google");
const {
  createFolder,
  copyTemplate,
  replaceTags,
  uploadBase64File,
  exportPdf: exportPdfUtil,
} = require("../../utils/drive");
const { logAction } = require("../../utils/audit");
const documentHashService = require("../../services/signatures/documentHash.service");
const advancedSignatureService = require("../../services/signatures/advancedSignature.service");
const digitalSealService = require("../../services/signatures/digitalSeal.service");
const QRCode = require("qrcode");

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL || "https://spi.local").replace(/\/$/, "");

// ============================================================
// 🔹 Helpers internos
// ============================================================

async function setDomainReader(fileId) {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  if (!domain) return;
  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: { type: "domain", role: "reader", domain },
    });
  } catch (e) {
    logger.warn({ e }, "setDomainReader failed");
  }
}

function driveViewLink(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}
function driveUcLink(id) {
  return `https://drive.google.com/uc?id=${id}`;
}

async function fetchDocStructure(documentId) {
  const { data } = await docs.documents.get({ documentId });
  return data;
}

function findTagRange(doc, tagText) {
  const target = `{{${tagText}}}`;
  const content = doc.body?.content || [];
  for (const el of content) {
    const p = el.paragraph?.elements || [];
    for (const e of p) {
      const t = e.textRun?.content || "";
      const pos = t.indexOf(target);
      if (pos >= 0) {
        return { startIndex: e.startIndex + pos, endIndex: e.startIndex + pos + target.length };
      }
    }
  }
  return null;
}

async function replaceTagWithInlineImage({ documentId, tag, base64, parentFolderId }) {
  const file = await uploadBase64File(`${tag}.png`, base64, "image/png", parentFolderId);
  await setDomainReader(file.id);
  const doc = await fetchDocStructure(documentId);
  const range = findTagRange(doc, tag);
  if (!range) throw Object.assign(new Error(`No se encontró el tag {{${tag}}}`), { status: 400 });

  const deleteReq = {
    deleteContentRange: { range: { startIndex: range.startIndex, endIndex: range.endIndex } },
  };
  const insertReq = {
    insertInlineImage: {
      location: { index: range.startIndex },
      uri: driveUcLink(file.id),
      objectSize: { height: { magnitude: 60, unit: "PT" } },
    },
  };

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: [deleteReq, insertReq] },
  });

  return { imageFileId: file.id, webViewLink: file.webViewLink };
}

// ============================================================
// 🧾 Crear documento desde plantilla
// ============================================================
async function createFromTemplate({
  request_id,
  mantenimiento_id = null,
  template_id,
  folder_id,
  title,
  data = {},
  images = {},
  created_by,
}) {
  const client = await db.getClient();
  const start = Date.now();
  try {
    await client.query("BEGIN");

    const baseFolder = process.env.DRIVE_DOCS_FOLDER_ID || process.env.DRIVE_FOLDER_ID;
    const folder =
      folder_id || (await createFolder(`REQ-${request_id}`, baseFolder)).id;
    const name = title || `Documento-REQ-${request_id}`;
    const doc = await copyTemplate(template_id, name, folder);

    if (data && Object.keys(data).length) await replaceTags(doc.id, data);

    for (const [tag, b64] of Object.entries(images || {})) {
      try {
        await replaceTagWithInlineImage({ documentId: doc.id, tag, base64: b64, parentFolderId: folder });
      } catch (e) {
        logger.warn({ tag, e }, "replaceTagWithInlineImage warning");
      }
    }

    const { rows: [row] } = await client.query(
      `INSERT INTO documents (
         request_id, request_type_id, doc_drive_id, folder_drive_id, version_number, signed
       )
       SELECT r.id, r.request_type_id, $1, $2, COALESCE(r.version_number,1), false
       FROM requests r WHERE r.id=$3
       RETURNING *`,
      [doc.id, folder, request_id]
    );

    await client.query("COMMIT");

    await logAction({
      usuario_id: created_by,
      usuario_email: null,
      rol: null,
      modulo: "documents",
      accion: "crear_desde_plantilla",
      descripcion: `Documento generado desde plantilla ${template_id}`,
      contexto: { request_id, mantenimiento_id },
      duracion_ms: Date.now() - start,
    });

    return {
      id: row.id,
      doc_drive_id: doc.id,
      folder_drive_id: folder,
      link: driveViewLink(doc.id),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "❌ createFromTemplate error");
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// ✍️ Firmar documento (inserta imagen en {{TAG}})
// ============================================================
async function signAtTag({ documentId, userId, base64, tag, role_at_sign }) {
  const { rows } = await db.query(`SELECT * FROM documents WHERE id=$1 OR doc_drive_id=$1`, [documentId]);
  const doc = rows[0];
  if (!doc) throw Object.assign(new Error("Documento no encontrado"), { status: 404 });

  await replaceTagWithInlineImage({
    documentId: doc.doc_drive_id,
    tag,
    base64,
    parentFolderId: doc.folder_drive_id,
  });

  await db.query(
    `INSERT INTO document_signatures (document_id, signer_user_id, role_at_sign, signed_at)
     VALUES ($1,$2,$3,now())`,
    [doc.id, userId, role_at_sign || null]
  );

  await db.query(`UPDATE documents SET signed=true, updated_at=now() WHERE id=$1`, [doc.id]);

  await logAction({
    usuario_id: userId,
    usuario_email: null,
    rol: null,
    modulo: "documents",
    accion: "firmar_tag",
    descripcion: `Firma añadida en ${tag}`,
    contexto: { request_id: doc.request_id },
  });

  return { document_id: doc.id, doc_drive_id: doc.doc_drive_id };
}

async function downloadPdfBuffer(fileId) {
  const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
}

async function exportPdfForSignature(documentId) {
  // Generamos y descargamos el PDF exacto que será firmado para asegurar integridad
  const exported = await exportPdf(documentId);
  const pdfBuffer = await downloadPdfBuffer(exported.id);
  return { pdfBuffer, exported };
}

async function applyAdvancedSignature({
  documentId,
  user,
  consentText,
  roleAtSign,
  authorizedRole,
  sessionId,
  ip,
  userAgent,
}) {
  if (!user?.id) {
    const err = new Error("Usuario requerido para firmar");
    err.status = 401;
    throw err;
  }

  if (!consentText || typeof consentText !== "string" || consentText.trim().length === 0) {
    const err = new Error("Se requiere consentimiento expreso para la firma");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { pdfBuffer, exported } = await exportPdfForSignature(documentId);

    const hashRecord = await documentHashService.createHash({
      documentId,
      documentBuffer: pdfBuffer,
      userId: user.id,
      client,
    });

    // La firma avanzada une hash + identidad + sesión para manifestar voluntad y trazabilidad
    const signatureRecord = await advancedSignatureService.signDocument({
      documentHash: hashRecord,
      user,
      consentText,
      roleAtSign,
      ip,
      userAgent,
      sessionId,
      client,
    });

    // Sello institucional posterior a la firma para representación corporativa
    const sealRecord = await digitalSealService.applySeal({
      documentHash: hashRecord,
      authorizedRole: authorizedRole || user.role,
      client,
    });

    await client.query("COMMIT");

    const verificationUrl = `${PUBLIC_BASE_URL}/api/verificar/${sealRecord.verification_token}`;
    const qr = await QRCode.toDataURL(verificationUrl);

    return {
      hash: hashRecord,
      signature: signatureRecord,
      seal: { ...sealRecord, verification_url: verificationUrl, qr },
      pdf: exported,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// 📄 Exportar documento a PDF
// ============================================================
async function exportPdf(documentIdOrDriveId) {
  let doc = null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(documentIdOrDriveId)) {
    const { rows } = await db.query(`SELECT * FROM documents WHERE doc_drive_id=$1`, [documentIdOrDriveId]);
    doc = rows[0];
  } else {
    const { rows } = await db.query(`SELECT * FROM documents WHERE id=$1`, [documentIdOrDriveId]);
    doc = rows[0];
  }
  if (!doc) throw Object.assign(new Error("Documento no encontrado"), { status: 404 });

  const pdfFile = await exportPdfUtil(doc.doc_drive_id, doc.folder_drive_id);
  await db.query(
    `UPDATE documents SET pdf_drive_id=$1, updated_at=now() WHERE id=$2`,
    [pdfFile.id, doc.id]
  );

  await logAction({
    usuario_id: null,
    modulo: "documents",
    accion: "exportar_pdf",
    descripcion: `Documento exportado a PDF`,
    contexto: { request_id: doc.request_id },
  });

  return { id: pdfFile.id, link: pdfFile.webViewLink };
}

// ============================================================
// 🔍 Consultas varias
// ============================================================
async function getDocument(documentId) {
  const { rows } = await db.query(`SELECT * FROM documents WHERE id=$1 OR doc_drive_id=$1`, [documentId]);
  return rows[0] || null;
}

async function listByRequest(requestId) {
  const { rows } = await db.query(
    `SELECT * FROM documents WHERE request_id=$1 ORDER BY created_at DESC`,
    [requestId]
  );
  return rows;
}

module.exports = {
  createFromTemplate,
  signAtTag,
  exportPdf,
  applyAdvancedSignature,
  getDocument,
  listByRequest,
};
