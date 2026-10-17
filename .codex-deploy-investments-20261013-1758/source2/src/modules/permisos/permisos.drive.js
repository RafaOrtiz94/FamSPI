const fs = require("fs");
const path = require("path");
const { drive } = require("../../config/google");
const { ensureFolder, replaceTags, exportPdf } = require("../../utils/drive");

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;
const VACATION_TEMPLATE_PATH = path.join(__dirname, "../../data/plantillas/Vacation_Format.docx");

/**
 * Crear carpeta específica para una solicitud
 * Formato: Talento Humano/Permisos/NombreColaborador_Fecha/
 */
async function createSolicitudFolder({ user, fecha_inicio, solicitudId }) {
  const root = await ensureFolder("Talento Humano", DRIVE_ROOT_FOLDER_ID);
  const permisosFolder = await ensureFolder("Permisos", root.id);

  // Nombre de la carpeta: NombreColaborador_Fecha
  const userName = user.fullname || user.name || user.email || `Usuario-${user.id}`;
  const fecha = fecha_inicio || new Date().toISOString().split("T")[0];
  const folderName = `${userName}_${fecha}`;

  const solicitudFolder = await ensureFolder(folderName, permisosFolder.id);

  return {
    folderId: solicitudFolder.id,
    folderName: folderName,
  };
}

/**
 * Subir documento de vacaciones a Drive
 * Se guarda en: Talento Humano/Permisos/NombreColaborador_Fecha/
 */
async function uploadVacationDocument({ user, fecha_inicio, fecha_fin, fecha_regreso, periodo, dias, solicitudId }) {
  if (!VACATION_TEMPLATE_ID) {
    console.warn("VACATION_TEMPLATE_ID no configurado. No se puede generar documento de vacaciones.");
    return {};
  }

  // Crear carpeta específica para esta solicitud
  const { folderId, folderName } = await createSolicitudFolder({ user, fecha_inicio, solicitudId });

  const name = `Vacaciones - ${user.fullname || user.name || user.email} - ${fecha_inicio}`;

  // Crear documento desde plantilla
  const created = await templateService.createDocumentFromTemplate(
    VACATION_TEMPLATE_ID,
    folderId,
    name,
    {
      F_Solicitud: new Date().toLocaleDateString("es-EC"),
      F_Inicio: fecha_inicio,
      F_Final: fecha_fin,
      Periodo: periodo || "",
      Dias: dias?.toString() || "",
      F_Regreso: fecha_regreso,
      Nombre_Solicitante: user.fullname || user.name || user.email,
      Cedula_Solicitante: user.cedula || user.identificacion || "",
    }
  );

  let pdf = null;
  try {
    pdf = await exportPdf(created.id, folderId, `${name}.pdf`);
  } catch (err) {
    console.warn("No se pudo exportar PDF de vacaciones:", err.message);
  }

  return {
    drive_doc_id: created.id,
    drive_doc_link: created.webViewLink,
    drive_pdf_id: pdf?.id || null,
    drive_pdf_link: pdf?.webViewLink || null,
    folderId,
    folderName,
  };
}

/**
 * Subir justificante a Drive
 * Se guarda en la MISMA carpeta que el acta: Talento Humano/Permisos/NombreColaborador_Fecha/
 */
async function uploadJustificante({ user, solicitudId, fecha_inicio, fileBuffer, fileName, mimeType, existingFolderId }) {
  const { Readable } = require("stream");

  // Si ya existe el folderId (del acta), usarlo. Si no, crear uno nuevo
  let folderId = existingFolderId;

  // Verificar si la carpeta existe y es válida
  if (folderId) {
    try {
      await drive.files.get({
        fileId: folderId,
        fields: "id, name",
        supportsAllDrives: true,
      });
    } catch (err) {
      console.warn(`Carpeta ${folderId} no encontrada, creando nueva...`);
      folderId = null; // Forzar creación de nueva carpeta
    }
  }

  if (!folderId) {
    const folderInfo = await createSolicitudFolder({ user, fecha_inicio, solicitudId });
    folderId = folderInfo.folderId;
  }

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  // Convertir buffer a stream
  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const media = {
    mimeType: mimeType,
    body: bufferStream,
  };

  const { data: file } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: fileMetadata,
    media: media,
    fields: "id, webViewLink",
  });

  // Dar permisos de lectura (intentar, pero no fallar si no funciona)
  try {
    await drive.permissions.create({
      fileId: file.id,
      supportsAllDrives: true,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
  } catch (permError) {
    console.warn(`No se pudieron dar permisos al archivo ${file.id}:`, permError.message);
    // Continuar de todos modos, el archivo fue subido exitosamente
  }

  return {
    fileId: file.id,
    webViewLink: file.webViewLink,
    folderId: folderId,
  };
}

module.exports = {
  createSolicitudFolder,
  uploadVacationDocument,
  uploadJustificante,
  uploadStudyEnrollmentDocument: async function uploadStudyEnrollmentDocument({
    user,
    fileBuffer,
    fileName,
    mimeType,
  }) {
    const { Readable } = require("stream");
    const root = await ensureFolder("Talento Humano", DRIVE_ROOT_FOLDER_ID);
    const enrollmentsFolder = await ensureFolder("Matriculas Estudios", root.id);
    const userFolder = await ensureFolder(
      user?.fullname || user?.name || user?.email || `Usuario-${user?.id || "sin-id"}`,
      enrollmentsFolder.id
    );

    const safeName = fileName || `matricula_${Date.now()}.pdf`;
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);

    const { data: created } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: safeName,
        parents: [userFolder.id],
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body: stream,
      },
      fields: "id, webViewLink",
    });

    try {
      await drive.permissions.create({
        fileId: created.id,
        supportsAllDrives: true,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (_) {
      // no-op: link puede quedar solo interno si politicas de drive lo requieren.
    }

    return {
      fileId: created.id,
      webViewLink: created.webViewLink,
      folderId: userFolder.id,
    };
  },
};
