/**
 * ============================================================
 * 📂 Service: Files
 * ------------------------------------------------------------
 * Maneja subida, descarga, metadatos y eliminación de archivos
 * con integración a Google Drive y auditoría extendida.
 * ============================================================
 */

const { drive } = require("../../config/google");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { Readable } = require("stream");

// ============================================================
// 🔼 Subir archivos (buffer → stream → Drive + BD)
// ============================================================
async function uploadFiles({ requestId, mantenimientoId = null, userId, files }) {
  const folderBase =
    process.env.DRIVE_ATTACHMENTS_FOLDER_ID ||
    process.env.DRIVE_REQUESTS_FOLDER_ID ||
    process.env.DRIVE_DOCS_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID;

  if (!folderBase) {
    throw new Error("No se ha configurado una carpeta destino para adjuntos");
  }

  const uploaded = [];

  for (const f of files) {
    const originalName = f.originalname || f.name || `archivo-${Date.now()}`;
    const mimeType = f.mimetype || f.type || "application/octet-stream";

    try {
      // 📦 Convertir buffer en stream
      const fileStream = new Readable();
      fileStream._read = () => {};
      fileStream.push(f.buffer);
      fileStream.push(null);

      // 🚀 Subir archivo a Drive
      const { data } = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: originalName,
          parents: [folderBase],
        },
        media: { mimeType, body: fileStream },
        fields: "id, name, mimeType, webViewLink, webContentLink, size",
      });

      const driveLink = data.webViewLink || data.webContentLink || null;
      const size = Number(data.size || f.size || 0) || null;

      uploaded.push({
        id: data.id,
        name: data.name || originalName,
        mimeType: data.mimeType || mimeType,
        driveLink,
        size,
      });

      // 🧾 Registrar archivo en BD
      await db.query(
        `INSERT INTO request_attachments (
          request_id,
          drive_file_id,
          filename,
          mimetype,
          mime_type,
          uploaded_by,
          drive_link,
          size,
          title
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          requestId,
          data.id,
          originalName,
          mimeType,
          data.mimeType || mimeType,
          userId,
          driveLink,
          size,
          originalName,
        ]
      );

      // 🧠 Registrar auditoría
      await logAction({
        usuario_id: userId,
        usuario_email: null,
        rol: null,
        modulo: "files",
        accion: "subir",
        descripcion: `Archivo ${originalName} subido al Drive`,
        datos_nuevos: { name: originalName, mime: mimeType },
        contexto: {
          request_id: requestId,
          mantenimiento_id: mantenimientoId,
        },
      });
    } catch (err) {
      logger.error({ err }, `❌ Error subiendo archivo ${f.originalname || "sin_nombre"}`);
      throw err;
    }
  }

  return uploaded;
}

// ============================================================
// 📋 Listar archivos por solicitud
// ============================================================
async function listByRequest(requestId) {
  const { rows } = await db.query(
    `SELECT
        id,
        drive_file_id,
        filename,
        title,
        COALESCE(mime_type, mimetype) AS mime_type,
        drive_link,
        uploaded_by,
        size,
        created_at
     FROM request_attachments
     WHERE request_id=$1
     ORDER BY created_at DESC`,
    [requestId]
  );

  return rows.map((row) => ({
    ...row,
    uploaded_at: row.created_at,
  }));
}

// ============================================================
// 📄 Obtener metadatos desde Drive
// ============================================================
async function getMetadata(fileId) {
  const { data } = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields:
      "id, name, mimeType, size, createdTime, webViewLink, owners, modifiedTime",
  });
  return data;
}

// ============================================================
// ⬇️ Descargar archivo (stream)
// ============================================================
async function downloadFile(fileId) {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  const meta = await getMetadata(fileId);
  return {
    stream: res.data,
    name: meta.name,
    mimeType: meta.mimeType,
  };
}

// ============================================================
// 🗑️ Eliminar archivo (Drive + BD)
// ============================================================
async function deleteFile(fileId, userId) {
  try {
    // 🗑️ Borrar en Drive
    await drive.files.delete({ fileId, supportsAllDrives: true });

    // 🗃️ Borrar en BD
    const { rows } = await db.query(
      `DELETE FROM request_attachments 
       WHERE drive_file_id=$1
       RETURNING request_id`,
      [fileId]
    );

    const deleted = rows[0];

    // 🧠 Registrar auditoría
    await logAction({
      usuario_id: userId,
      usuario_email: null,
      rol: null,
      modulo: "files",
      accion: "eliminar",
      descripcion: `Archivo eliminado (${fileId})`,
      contexto: {
        request_id: deleted?.request_id || null,
      },
    });
  } catch (err) {
    logger.error({ err }, "❌ Error eliminando archivo en Drive/BD");
    throw err;
  }
}

module.exports = {
  uploadFiles,
  listByRequest,
  getMetadata,
  downloadFile,
  deleteFile,
};
