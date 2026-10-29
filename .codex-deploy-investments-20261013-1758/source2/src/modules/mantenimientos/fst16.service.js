const PDFDocument = require("pdfkit");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const {
  getPreventiveAnnualPlanDetail,
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

const ensureFst16Folder = async ({ planYear }) => {
  const root = getDriveRoot();
  if (!root) return null;
  const servicioFolder = await ensureFolder("Servicio Tecnico", root);
  const preventiveFolder = await ensureFolder("Mantenimientos Preventivos", servicioFolder.id);
  const fst16Folder = await ensureFolder("F.ST-16", preventiveFolder.id);
  const yearFolder = await ensureFolder(String(planYear || "SinAnio"), fst16Folder.id);
  return yearFolder.id;
};

const generateFst16PdfBuffer = async ({ plan, generatedBy, notes = null }) => {
  const generatedAt = new Date();
  const items = Array.isArray(plan?.items) ? plan.items : [];

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica-Bold").fontSize(13).text("F.ST-16 - CRONOGRAMA ANUAL DE MANTENIMIENTO PREVENTIVO", {
      align: "center",
    });
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Año: ${plan?.plan_year || "N/D"} | Versión: ${plan?.version || "N/D"}`);
    doc.text(`Plan ID: ${plan?.id || "N/D"} | Estado: ${plan?.status || "draft"}`);
    doc.text(`Generado por: ${generatedBy || "Sistema"} | Fecha: ${toDateTimeLabel(generatedAt)}`);
    doc.text(`Título: ${normalizeText(plan?.title, "Plan preventivo")}`);
    if (plan?.notes) {
      doc.moveDown(0.2);
      doc.text(`Notas: ${plan.notes}`);
    }
    if (notes) {
      doc.moveDown(0.2);
      doc.text(`Observaciones operativas: ${notes}`);
    }

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Resumen");
    doc.font("Helvetica");
    doc.text(`Total planificado: ${items.length}`);
    doc.text(`Completados: ${plan?.completed_items || 0}`);
    doc.text(`Cancelados: ${plan?.cancelled_items || 0}`);
    doc.text(`En ejecución: ${plan?.executing_items || 0}`);

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Detalle por equipo");
    doc.font("Helvetica");
    if (!items.length) {
      doc.text("No existen equipos planificados para este F.ST-16.");
    } else {
      items.forEach((item, index) => {
        const line = [
          `${index + 1}.`,
          normalizeText(item.equipment_name, `Equipo ${item.equipment_id || "N/D"}`),
          `Serie: ${normalizeText(item.equipment_serial, "N/D")}`,
          `Cliente: ${normalizeText(item.client_name, "N/D")}`,
          `Fecha plan: ${toDateLabel(item.planned_date)}`,
          `Estado: ${item.status}`,
          `WO: ${normalizeText(item.work_order_number, "N/D")}`,
        ].join(" | ");
        doc.text(line);
      });
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

const issueFst16Document = async ({
  annualPlanId,
  notes = null,
  user = null,
} = {}) => {
  const plan = await getPreventiveAnnualPlanDetail(annualPlanId);
  if (!plan) {
    const error = new Error("Plan preventivo no encontrado para emitir F.ST-16");
    error.status = 404;
    error.code = "FST16_PLAN_NOT_FOUND";
    throw error;
  }

  const generatedBy =
    normalizeText(user?.fullname) ||
    normalizeText(user?.name) ||
    normalizeText(user?.email) ||
    "Sistema";
  const pdf = await generateFst16PdfBuffer({
    plan,
    generatedBy,
    notes,
  });

  const fileName = `F.ST-16_${sanitizeToken(plan.plan_year)}_V${sanitizeToken(plan.version)}_PLAN_${sanitizeToken(plan.id)}.pdf`;
  let fileId = null;
  let fileLink = null;
  let folderId = null;
  let templateMode = pdf.template_mode;
  let uploadError = null;

  try {
    folderId = await ensureFst16Folder({ planYear: plan.plan_year });
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
    uploadError = error?.message || "Error cargando archivo a Drive";
    templateMode = "pdfkit_native_upload_failed";
  }

  const doc = await registerPreventiveDocument({
    annualPlanId: plan.id,
    planItemId: null,
    documentCode: "F.ST-16",
    driveFileId: fileId,
    driveLink: fileLink,
    templateMode,
    payload: {
      generated_at: pdf.generated_at,
      generated_by: generatedBy,
      notes: normalizeText(notes),
      upload_error: uploadError,
      summary: {
        total_items: plan.items?.length || 0,
        completed_items: plan.completed_items || 0,
        cancelled_items: plan.cancelled_items || 0,
      },
    },
    user,
  });

  return {
    document: doc,
    annual_plan_id: plan.id,
    drive_folder_id: folderId,
    pdf_id: fileId,
    pdf_link: fileLink,
    template_mode: templateMode,
    upload_error: uploadError,
  };
};

module.exports = {
  buildDriveLink,
  generateFst16PdfBuffer,
  issueFst16Document,
};
