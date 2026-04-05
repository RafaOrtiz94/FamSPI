const PDFDocument = require("pdfkit");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const {
  getPlanItemById,
  registerPreventiveDocument,
} = require("./preventivePlanning.service");

const normalizeText = (value, fallback = null) => {
  const text = String(value || "").trim();
  return text || fallback;
};

const sanitizeToken = (value, fallback = "NA") => {
  const token = String(value || "").trim().replace(/[^\w.-]+/g, "_");
  return token || fallback;
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

const toDateTimeLabel = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
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

const buildDriveLink = (fileId) =>
  normalizeText(fileId) ? `https://drive.google.com/file/d/${fileId}/view` : null;

const getDriveRoot = () =>
  normalizeText(process.env.DRIVE_ROOT_FOLDER_ID) || normalizeText(process.env.DRIVE_MANTENIMIENTOS_FOLDER_ID);

const ensureFst17Folder = async ({ planYear, equipmentName }) => {
  const root = getDriveRoot();
  if (!root) return null;
  const servicioFolder = await ensureFolder("Servicio Tecnico", root);
  const preventiveFolder = await ensureFolder("Mantenimientos Preventivos", servicioFolder.id);
  const fst17Folder = await ensureFolder("F.ST-17", preventiveFolder.id);
  const yearFolder = await ensureFolder(String(planYear || "SinAnio"), fst17Folder.id);
  const equipmentFolder = await ensureFolder(
    sanitizeToken(equipmentName, "Equipo"),
    yearFolder.id,
  );
  return equipmentFolder.id;
};

const generateFst17PdfBuffer = async ({ item, generatedBy, notes = null }) => {
  const generatedAt = new Date();
  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica-Bold").fontSize(13).text("F.ST-17 - CRONOGRAMA PREVENTIVO POR EQUIPO", {
      align: "center",
    });
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Plan anual ID: ${item?.annual_plan_id || "N/D"} | Año: ${item?.plan_year || "N/D"} | Versión: ${item?.version || "N/D"}`);
    doc.text(`Ítem ID: ${item?.id || "N/D"} | Estado: ${item?.status || "planned"}`);
    doc.text(`Equipo: ${normalizeText(item?.equipment_name, `#${item?.equipment_id || "N/D"}`)}`);
    doc.text(`Serie: ${normalizeText(item?.equipment_serial, "N/D")}`);
    doc.text(`Cliente/propietario: ${normalizeText(item?.client_name, "N/D")}`);
    doc.text(`Condición: Garantía=${item?.warranty_status || "unknown"} | Contrato=${item?.contract_type || "unknown"}`);
    doc.text(`Fecha planificada: ${toDateLabel(item?.planned_date)} (mes ${item?.planned_month || "N/D"})`);
    doc.text(`WO: ${normalizeText(item?.work_order_number, "Pendiente de generación")}`);
    doc.text(`Última ejecución: ${toDateTimeLabel(item?.last_execution_at)}`);
    doc.text(`Resultado de ejecución: ${normalizeText(item?.execution_result, "N/D")}`);
    doc.text(`Generado por: ${generatedBy || "Sistema"} | Fecha: ${toDateTimeLabel(generatedAt)}`);
    if (item?.coordination_window) {
      doc.text(`Ventana coordinada: ${item.coordination_window}`);
    }
    if (item?.notes) {
      doc.moveDown(0.2);
      doc.text(`Notas del ítem: ${item.notes}`);
    }
    if (notes) {
      doc.moveDown(0.2);
      doc.text(`Observaciones operativas: ${notes}`);
    }

    doc.moveDown(0.8);
    doc
      .fontSize(8)
      .fillColor("#475569")
      .text(
        "Documento operacional generado por SPI (modo nativo PDFKit) para ST-01-02.",
      );

    doc.end();
  });

  return {
    buffer,
    generated_at: generatedAt.toISOString(),
    template_mode: "pdfkit_native",
  };
};

const issueFst17Document = async ({
  planItemId,
  notes = null,
  user = null,
} = {}) => {
  const item = await getPlanItemById(planItemId);
  if (!item) {
    const error = new Error("Ítem preventivo no encontrado para emitir F.ST-17");
    error.status = 404;
    error.code = "FST17_ITEM_NOT_FOUND";
    throw error;
  }

  const generatedBy =
    normalizeText(user?.fullname) ||
    normalizeText(user?.name) ||
    normalizeText(user?.email) ||
    "Sistema";
  const pdf = await generateFst17PdfBuffer({
    item,
    generatedBy,
    notes,
  });

  const fileName = `F.ST-17_PLAN_${sanitizeToken(item.annual_plan_id)}_ITEM_${sanitizeToken(item.id)}_${sanitizeToken(item.equipment_name, "equipo")}.pdf`;
  let fileId = null;
  let fileLink = null;
  let folderId = null;
  let templateMode = pdf.template_mode;
  let uploadError = null;

  try {
    folderId = await ensureFst17Folder({
      planYear: item.plan_year,
      equipmentName: item.equipment_name,
    });
    if (folderId) {
      const uploaded = await uploadBase64File(
        fileName,
        pdf.buffer.toString("base64"),
        "application/pdf",
        folderId,
      );
      fileId = uploaded.id;
      fileLink = uploaded.webViewLink || buildDriveLink(uploaded.id);
    } else {
      templateMode = "pdfkit_native_without_drive";
    }
  } catch (error) {
    uploadError = error?.message || "Error cargando F.ST-17 a Drive";
    templateMode = "pdfkit_native_upload_failed";
  }

  const doc = await registerPreventiveDocument({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    documentCode: "F.ST-17",
    driveFileId: fileId,
    driveLink: fileLink,
    templateMode,
    payload: {
      generated_at: pdf.generated_at,
      generated_by: generatedBy,
      notes: normalizeText(notes),
      upload_error: uploadError,
      plan_item_status: item.status,
      work_order_number: item.work_order_number,
    },
    user,
  });

  return {
    document: doc,
    annual_plan_id: item.annual_plan_id,
    plan_item_id: item.id,
    drive_folder_id: folderId,
    pdf_id: fileId,
    pdf_link: fileLink,
    template_mode: templateMode,
    upload_error: uploadError,
  };
};

module.exports = {
  buildDriveLink,
  generateFst17PdfBuffer,
  issueFst17Document,
};
