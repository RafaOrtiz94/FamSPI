/**
 * Utils: Google Drive / Docs
 * ---------------------------
 * - Crear carpetas, copiar plantillas y reemplazar {{etiquetas}}
 * - Subir archivos y firmas (base64)
 * - Exportar DOCX a PDF
 */

const { drive, docs } = require("../config/google");
const { Readable } = require("stream");
const logger = require("../config/logger");

// Convierte buffer/base64 en stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** 📁 Crear carpeta dentro de Drive */
async function createFolder(name, parentId) {
  try {
    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name,
        mimeType: FOLDER_MIME,
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id, name, webViewLink",
    });
    return data;
  } catch (err) {
    logger.error({ err }, "❌ createFolder");
    throw err;
  }
}

/** 🔎 Buscar carpeta por nombre dentro de un parent */
async function findFolder(name, parentId) {
  if (!parentId) return null;
  try {
    const escapedName = name.replace(/'/g, "\\'");
    const q = [
      `'${parentId}' in parents`,
      `name = '${escapedName}'`,
      `mimeType = '${FOLDER_MIME}'`,
      "trashed = false",
    ].join(" and ");

    const { data } = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      q,
      fields: "files(id, name, webViewLink)",
    });

    return data.files?.[0] || null;
  } catch (err) {
    logger.error({ err }, "❌ findFolder");
    return null;
  }
}

/** ♻️ Obtiene o crea carpeta dentro de un parent */
async function ensureFolder(name, parentId) {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

/** 📄 Copiar plantilla y crear documento editable */
async function copyTemplate(templateId, name, parentId) {
  if (!templateId) {
    const err = new Error("No se recibió un fileId de plantilla para copiar en Drive.");
    err.status = 500;
    throw err;
  }
  try {
    const { data } = await drive.files.copy({
      fileId: templateId,
      supportsAllDrives: true,
      requestBody: {
        name,
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id, name, webViewLink",
    });
    return data;
  } catch (err) {
    logger.error({ err }, "❌ copyTemplate");
    throw err;
  }
}

/** 🧩 Reemplazar placeholders en documento ({{TAG}}) */
async function replaceTags(documentId, replacements = {}) {
  try {
    const requests = [];
    for (const [rawKey, value] of Object.entries(replacements)) {
      const val = value ?? "";
      const tokens = [];
      if (/^\s*({{.*}}|<<.*>>)\s*$/.test(rawKey)) {
        tokens.push(rawKey.trim());
      } else {
        tokens.push(`{{${rawKey}}}`, `<<${rawKey}>>`);
      }
      tokens.forEach((text) =>
        requests.push({
          replaceAllText: {
            containsText: { text, matchCase: false },
            replaceText: val,
          },
        })
      );
    }

    if (!requests.length) return true;

    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
    return true;
  } catch (err) {
    logger.error({ err }, "❌ replaceTags");
    throw err;
  }
}

/** 📤 Subir archivo o firma PNG */
async function uploadBase64File(name, base64, mimeType = "image/png", parentId) {
  try {
    const buffer = Buffer.from(base64, "base64");
    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name, parents: parentId ? [parentId] : undefined },
      media: { mimeType, body: bufferToStream(buffer) },
      fields: "id, name, mimeType, webViewLink, webContentLink",
    });
    return data;
  } catch (err) {
    logger.error({ err }, "❌ uploadBase64File");
    throw err;
  }
}

/** 📤 Subir archivo desde multer (file.buffer) */
async function uploadFileToDrive(file, path) {
  try {
    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: path.split('/').pop() }, // Extract filename from path
      media: { mimeType: file.mimetype, body: bufferToStream(file.buffer) },
      fields: "id, name, mimeType, webViewLink, webContentLink",
    });

    // Make file publicly accessible
    try {
      await drive.permissions.create({
        fileId: data.id,
        supportsAllDrives: true,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr) {
      logger.warn({ permErr }, "No se pudo hacer público el archivo (se usa link por defecto)");
    }

    return data;
  } catch (err) {
    logger.error({ err }, "❌ uploadFileToDrive");
    throw err;
  }
}

/** 🧾 Exportar documento a PDF y subirlo */
async function exportPdf(docId, targetFolderId, filename) {
  try {
    const res = await drive.files.export(
      { fileId: docId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    const pdfBuffer = Buffer.from(res.data);
    const safeName = (() => {
      if (!filename) return `export-${docId}.pdf`;
      return filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    })();
    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: safeName,
        parents: targetFolderId ? [targetFolderId] : undefined,
      },
      media: { mimeType: "application/pdf", body: bufferToStream(pdfBuffer) },
      fields: "id, name, webViewLink",
    });
    return data;
  } catch (err) {
    logger.error({ err }, "❌ exportPdf");
    throw err;
  }
}

module.exports = {
  createFolder,
  ensureFolder,
  findFolder,
  copyTemplate,
  replaceTags,
  uploadBase64File,
  uploadFileToDrive,
  exportPdf,
};