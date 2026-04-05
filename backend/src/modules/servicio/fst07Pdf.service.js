const PDFDocument = require("pdfkit");
const {
  FST07_CHECKLIST_ITEMS,
  SITE_INSPECTION_RESULT,
  normalizeDateOnlyInput,
  normalizeChecklistAnswer,
} = require("./siteInspectionRules.service");

const formatDateEsLabel = (value) => {
  const normalized = normalizeDateOnlyInput(value);
  if (!normalized) return "N/D";
  const [yyyy, mm, dd] = normalized.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

const sanitizeFileToken = (value, fallback = "Cliente") => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return cleaned || fallback;
};

const buildChecklistRows = (checklist = {}) =>
  FST07_CHECKLIST_ITEMS.map((item) => ({
    section_label: item.section_label,
    label: item.label,
    answer: normalizeChecklistAnswer(checklist?.[item.key]) || "N/D",
  }));

const generateFst07PdfBuffer = async ({
  clientName,
  equipmentName,
  scheduledDate,
  responsibleName,
  result,
  checklist,
  observations,
  recommendations,
  followUpDate,
  isReinspection = false,
  clientSignerName = null,
}) => {
  const now = new Date();
  const checklistRows = buildChecklistRows(checklist);
  const normalizedResult = String(result || "").trim().toLowerCase();
  const resultLabel =
    normalizedResult === SITE_INSPECTION_RESULT.COMPLIANT
      ? "AREA LISTA PARA INSTALACION: SI"
      : "AREA LISTA PARA INSTALACION: NO (REQUIERE REINSPECCION)";
  const subtitle = isReinspection
    ? "F.ST-07 - INSPECCION DE AMBIENTE (REINSPECCION)"
    : "F.ST-07 - INSPECCION DE AMBIENTE";

  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(13).font("Helvetica-Bold").text(subtitle, { align: "center" });
    doc.moveDown(0.6);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Fecha de inspección: ${formatDateEsLabel(scheduledDate)}`);
    doc.text(`Cliente: ${String(clientName || "Cliente").trim() || "Cliente"}`);
    doc.text(`Equipo: ${String(equipmentName || "Equipo no especificado").trim() || "Equipo no especificado"}`);
    doc.text(`Responsable técnico: ${String(responsibleName || "N/D").trim() || "N/D"}`);
    doc.text(`Representante cliente: ${String(clientSignerName || "N/D").trim() || "N/D"}`);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Checklist de inspección");
    doc.moveDown(0.3);
    doc.font("Helvetica");

    let currentSection = "";
    checklistRows.forEach((row, index) => {
      if (row.section_label !== currentSection) {
        currentSection = row.section_label;
        doc.moveDown(0.25);
        doc.font("Helvetica-Bold").text(currentSection);
        doc.font("Helvetica");
      }
      doc.text(`${index + 1}. ${row.label}`, { continued: true });
      doc.font("Helvetica-Bold").text(`  [${row.answer}]`);
      doc.font("Helvetica");
    });

    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Observaciones y recomendaciones");
    doc.font("Helvetica").text(observations || "Sin observaciones");
    doc.moveDown(0.2);
    doc.text(recommendations || "Sin recomendaciones");
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Resultado de inspección");
    doc.font("Helvetica").text(resultLabel);

    if (normalizedResult !== SITE_INSPECTION_RESULT.COMPLIANT) {
      doc.text(`Fecha propuesta para reinspección: ${formatDateEsLabel(followUpDate)}`);
    }

    doc.moveDown(0.6);
    doc.text("Firma Famproject: ________________________________");
    doc.text("Firma Cliente: __________________________________");
    doc.text("Sello Cliente: __________________________________");
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor("#475569").text(`Generado por SPI el ${now.toISOString()}`);
    doc.end();
  });

  return {
    buffer: pdfBuffer,
    generatedAt: now.toISOString(),
  };
};

const buildFst07FileName = ({ clientName, generatedAt = new Date().toISOString() } = {}) => {
  const safeClient = sanitizeFileToken(clientName, "Cliente");
  const datePart = String(generatedAt || new Date().toISOString()).slice(0, 10);
  return `F.ST-07 - ${safeClient} - ${datePart}.pdf`;
};

module.exports = {
  generateFst07PdfBuffer,
  buildFst07FileName,
  formatDateEsLabel,
};
