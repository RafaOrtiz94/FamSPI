const PDFDocument = require("pdfkit");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");

const normalizeText = (value, fallback = null) => {
  const text = String(value || "").trim();
  if (text) return text;
  return fallback;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const toDateTimeLabel = (value) => {
  if (!value) return "N/D";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  return date.toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDateLabel = (value) => {
  if (!value) return "N/D";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const sanitizeToken = (value, fallback = "NA") => {
  const normalized = String(value || "").trim().replace(/[^\w.-]+/g, "_");
  return normalized || fallback;
};

const buildDriveLink = (fileId) => {
  const id = normalizeText(fileId);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/view`;
};

const buildFst11FileName = ({
  sourceType,
  sourceId,
  clientName,
  generatedAt = new Date(),
} = {}) => {
  const source = `${sanitizeToken(sourceType, "source")}_${sanitizeToken(sourceId, "id")}`;
  const safeClient = sanitizeToken(clientName || "cliente", "cliente").slice(0, 80);
  const datePart = generatedAt.toISOString().slice(0, 10);
  return `F.ST-11_Retiro_${source}_${safeClient}_${datePart}.pdf`;
};

const normalizeWorkflowState = (workflow = {}) => {
  const state = workflow && typeof workflow === "object" ? workflow : {};
  return {
    coordination: state.coordination && typeof state.coordination === "object" ? state.coordination : {},
    provider_case: state.provider_case && typeof state.provider_case === "object" ? state.provider_case : {},
    work_order: state.work_order && typeof state.work_order === "object" ? state.work_order : {},
    disinfection: state.disinfection && typeof state.disinfection === "object" ? state.disinfection : {},
    packaging: state.packaging && typeof state.packaging === "object" ? state.packaging : {},
    logistics: state.logistics && typeof state.logistics === "object" ? state.logistics : {},
    withdrawal_act:
      state.withdrawal_act && typeof state.withdrawal_act === "object" ? state.withdrawal_act : {},
  };
};

const generateFst11PdfBuffer = async ({
  sourceType,
  sourceId,
  requestId,
  clientName,
  equipmentName,
  workflowStatus,
  workflowState = {},
  generatedBy,
  notes,
} = {}) => {
  const generatedAt = new Date();
  const state = normalizeWorkflowState(workflowState);
  const packages = safeArray(state.packaging?.packages);
  const packageLines = packages.length
    ? packages.map((pkg, index) => {
        const label = normalizeText(pkg.package_label || pkg.label, `BULTO-${index + 1}`);
        const kind = normalizeText(pkg.package_type || pkg.tipo, "N/D");
        const weight = Number.isFinite(Number(pkg.package_weight_kg))
          ? `${Number(pkg.package_weight_kg)} kg`
          : "N/D";
        const items = safeArray(pkg.items_summary).join(", ");
        return `${index + 1}. ${label} | Tipo: ${kind} | Peso: ${weight} | Contenido: ${
          items || "N/D"
        }`;
      })
    : ["Sin bultos registrados"];

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica-Bold").fontSize(14).text("F.ST-11 - ACTA DE RETIRO / DESINSTALACION", {
      align: "center",
    });
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Fecha de emisión: ${toDateTimeLabel(generatedAt)}`);
    doc.text(`Workflow origen: ${String(sourceType || "").toUpperCase()} / ${sourceId || "N/D"}`);
    doc.text(`Solicitud comercial (F.ST-21): ${requestId || "N/D"}`);
    doc.text(`Cliente: ${clientName || "N/D"}`);
    doc.text(`Equipo principal: ${equipmentName || "N/D"}`);
    doc.text(`Estado de workflow al emitir: ${workflowStatus || "N/D"}`);

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Coordinación de retiro");
    doc.font("Helvetica");
    doc.text(`Fecha programada: ${toDateLabel(state.coordination?.scheduled_date)}`);
    doc.text(
      `Coordinado por: ${normalizeText(state.coordination?.coordinated_by_email, "N/D")}`,
    );
    doc.text(`Contacto cliente: ${normalizeText(state.coordination?.contact_name, "N/D")}`);
    doc.text(`Telefono contacto: ${normalizeText(state.coordination?.contact_phone, "N/D")}`);

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Control técnico");
    doc.font("Helvetica");
    doc.text(
      `WO retiro: ${normalizeText(state.work_order?.work_order_number, "N/D")} (estado: ${
        normalizeText(state.work_order?.status, "pending")
      })`,
    );
    doc.text(
      `F.ST-02 (desinfección): ${
        normalizeText(state.disinfection?.status, "pending")
      } | Archivo: ${normalizeText(state.disinfection?.fst02_file_id, "N/D")}`,
    );
    doc.text(
      `Cambio de partes: ${
        state.disinfection?.part_change_required ? "Sí" : "No"
      }`,
    );
    if (state.disinfection?.part_change_notes) {
      doc.text(`Notas cambio de partes: ${state.disinfection.part_change_notes}`);
    }

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Embalaje, etiquetado y bultos");
    doc.font("Helvetica");
    doc.text(
      `Estado embalaje: ${normalizeText(state.packaging?.status, "pending")} | Bultos: ${
        Number.isFinite(Number(state.packaging?.total_packages))
          ? Number(state.packaging.total_packages)
          : packages.length
      }`,
    );
    packageLines.forEach((line) => doc.text(line));

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Logística de salida");
    doc.font("Helvetica");
    doc.text(`Fecha de retiro: ${toDateLabel(state.logistics?.pickup_date)}`);
    doc.text(`Ejecutado en: ${toDateTimeLabel(state.logistics?.picked_up_at)}`);
    doc.text(`Transportista: ${normalizeText(state.logistics?.carrier_name, "N/D")}`);
    doc.text(
      `Guía/Tracking: ${normalizeText(state.logistics?.tracking_reference, "N/D")}`,
    );

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Observaciones");
    doc.font("Helvetica").text(normalizeText(notes, "Sin observaciones adicionales."));

    doc.moveDown(1);
    doc.text("Firma técnico SPI: ______________________________");
    doc.text("Firma cliente / responsable retiro: _____________");
    doc.text("Firma logística: ________________________________");

    doc.moveDown(0.6);
    doc
      .fontSize(8)
      .fillColor("#475569")
      .text(
        `Documento operacional generado por SPI (modo fallback PDF) | ${generatedBy || "Sistema"} | ${generatedAt.toISOString()}`,
      );

    doc.end();
  });

  return {
    buffer,
    generated_at: generatedAt.toISOString(),
    template_mode: "pdfkit_fallback",
  };
};

const ensureWithdrawalDriveFolder = async ({
  sourceType,
  sourceId,
  clientName,
}) => {
  const rootFolderId = normalizeText(process.env.DRIVE_ROOT_FOLDER_ID);
  if (!rootFolderId) {
    const error = new Error("DRIVE_ROOT_FOLDER_ID no configurado");
    error.status = 500;
    error.code = "DRIVE_ROOT_NOT_CONFIGURED";
    throw error;
  }

  const servicioFolder = await ensureFolder("Servicio Tecnico", rootFolderId);
  const withdrawalFolder = await ensureFolder("Retiro Equipos", servicioFolder.id);
  const contextFolderName = `${sanitizeToken(sourceType, "source")}_${sanitizeToken(
    sourceId,
    "id",
  )}_${sanitizeToken(clientName || "cliente", "cliente").slice(0, 40)}`;
  const contextFolder = await ensureFolder(contextFolderName, withdrawalFolder.id);
  const fst11Folder = await ensureFolder("F.ST-11", contextFolder.id);
  return {
    rootFolderId,
    servicioFolderId: servicioFolder.id,
    withdrawalFolderId: withdrawalFolder.id,
    contextFolderId: contextFolder.id,
    fst11FolderId: fst11Folder.id,
  };
};

const issueFst11Document = async ({
  sourceType,
  sourceId,
  requestId = null,
  clientName,
  equipmentName,
  workflowStatus,
  workflowState = {},
  notes = null,
  user = null,
} = {}) => {
  const generatedBy =
    normalizeText(user?.fullname) ||
    normalizeText(user?.name) ||
    normalizeText(user?.email) ||
    "Sistema";
  const pdf = await generateFst11PdfBuffer({
    sourceType,
    sourceId,
    requestId,
    clientName,
    equipmentName,
    workflowStatus,
    workflowState,
    generatedBy,
    notes,
  });

  const folders = await ensureWithdrawalDriveFolder({ sourceType, sourceId, clientName });
  const fileName = buildFst11FileName({
    sourceType,
    sourceId,
    clientName,
    generatedAt: new Date(pdf.generated_at),
  });
  const uploaded = await uploadBase64File(
    fileName,
    pdf.buffer.toString("base64"),
    "application/pdf",
    folders.fst11FolderId,
  );

  return {
    file_id: uploaded.id,
    file_name: fileName,
    link: uploaded.webViewLink || buildDriveLink(uploaded.id),
    folder_id: folders.fst11FolderId,
    generated_at: pdf.generated_at,
    template_mode: pdf.template_mode,
  };
};

module.exports = {
  buildDriveLink,
  buildFst11FileName,
  generateFst11PdfBuffer,
  issueFst11Document,
};

