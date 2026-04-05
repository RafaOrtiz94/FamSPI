const PDFDocument = require("pdfkit");

const toDateLabel = (value) => {
  if (!value) return "N/D";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const safeText = (value, fallback = "N/D") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const checklistRowsFromData = (checklist = {}) => {
  const source = checklist && typeof checklist === "object" ? checklist : {};
  return [
    { key: "guide_vs_proforma", label: "Guia coincide con proforma", value: source.guide_vs_proforma || "" },
    { key: "packaging_integrity", label: "Empaque en buen estado", value: source.packaging_integrity || "" },
    { key: "tilt_indicator", label: "Indicadores de inclinacion sin alerta", value: source.tilt_indicator || "" },
    { key: "handling_indicator", label: "Indicadores de manipulacion sin alerta", value: source.handling_indicator || "" },
    { key: "serial_match", label: "Serie del equipo coincide", value: source.serial_match || "" },
    { key: "accessories_match", label: "Accesorios completos", value: source.accessories_match || "" },
  ];
};

const normalizeChecklistLabel = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "OK") return "OK";
  if (raw === "ISSUE") return "OBSERVADO";
  if (raw === "NA") return "N/A";
  return "PENDIENTE";
};

const buildFst14FileName = ({ clientName, generatedAt = new Date() } = {}) => {
  const safeClient = String(clientName || "Cliente")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .slice(0, 80) || "Cliente";
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  return `F.ST-14 - ${safeClient} - ${dateLabel}.pdf`;
};

const generateFst14PdfBuffer = async ({
  clientName,
  clientAddress,
  equipmentName,
  inspectionDate,
  responsibleName,
  logisticsValidatorName,
  dispatchRequiredDate,
  guideReference,
  proformaReference,
  checklist,
  findings,
  correctiveActions,
  logisticsChainNotes,
  result,
  photos = [],
  isPreinstallation = true,
}) => {
  const generatedAt = new Date();
  const checklistRows = checklistRowsFromData(checklist);
  const resultLabel = String(result || "").trim().toLowerCase() === "failed" ? "NO APROBADO" : "APROBADO";
  const subtitle = isPreinstallation
    ? "F.ST-14 - RECEPCION VISUAL PREINSTALACION"
    : "F.ST-14 - RECEPCION VISUAL DE INSTALACION";

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica-Bold").fontSize(13).text(subtitle, { align: "center" });
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Fecha de registro: ${toDateLabel(inspectionDate || generatedAt)}`);
    doc.text(`Cliente: ${safeText(clientName)}`);
    doc.text(`Direccion: ${safeText(clientAddress)}`);
    doc.text(`Equipo: ${safeText(equipmentName)}`);
    doc.text(`Fecha requerida de despacho: ${toDateLabel(dispatchRequiredDate)}`);
    doc.text(`Guia: ${safeText(guideReference)}`);
    doc.text(`Proforma: ${safeText(proformaReference)}`);
    doc.text(`Tecnico inspector: ${safeText(responsibleName)}`);
    doc.text(`Validacion logistica: ${safeText(logisticsValidatorName, "Pendiente")}`);

    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Checklist de recepcion visual");
    doc.font("Helvetica");
    checklistRows.forEach((row, index) => {
      doc.text(`${index + 1}. ${row.label}`, { continued: true });
      doc.font("Helvetica-Bold").text(`  [${normalizeChecklistLabel(row.value)}]`);
      doc.font("Helvetica");
    });

    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Hallazgos");
    doc.font("Helvetica").text(safeText(findings, "Sin hallazgos registrados"));

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Acciones derivadas");
    doc.font("Helvetica").text(safeText(correctiveActions, "Sin acciones registradas"));

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Cadena de custodia / traslado");
    doc.font("Helvetica").text(safeText(logisticsChainNotes, "Sin observaciones"));

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text(`Resultado F.ST-14: ${resultLabel}`);
    doc.font("Helvetica").text(`Evidencias fotograficas adjuntas: ${Array.isArray(photos) ? photos.length : 0}`);

    doc.moveDown(0.8);
    doc.text("Firma tecnico: ______________________________");
    doc.text("Firma cliente/logistica: ____________________");
    doc.text("Sello cliente (si aplica): ___________________");
    doc.moveDown(0.4);
    doc
      .fontSize(8)
      .fillColor("#475569")
      .text(`Registro digital generado por SPI - ${generatedAt.toISOString()}`);

    doc.end();
  });

  return {
    buffer,
    generatedAt: generatedAt.toISOString(),
    templateMode: "pdfkit_fallback",
  };
};

module.exports = {
  buildFst14FileName,
  generateFst14PdfBuffer,
};
