const PDFDocument = require("pdfkit");
const businessCaseService = require("./businessCase.service");
const determinationsService = require("./determinations.service");

function createDoc() {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.registerFont("Helvetica", "Helvetica");
  return doc;
}

function addHeader(doc, bc) {
  doc.fontSize(18).text(`Business Case #${bc.business_case_id || bc.id}`, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor("#555").text(`Cliente: ${bc.client_name || "-"}`);
  doc.text(`Estado: ${bc.status || "-"}`);
  doc.text(`Etapa: ${bc.bc_stage || "-"}`);
  doc.moveDown();
}

function addSummary(doc, calculations = {}) {
  doc.fontSize(14).fillColor("#111").text("Resumen de cálculos", { underline: true });
  doc.moveDown(0.3);
  const summary = [
    `Costo mensual: $${calculations.monthlyCost ?? "-"}`,
    `Costo anual: $${calculations.annualCost ?? "-"}`,
    `Consumo total: ${calculations.totalConsumption ?? "-"}`,
    `Total pruebas: ${calculations.totalTests ?? "-"}`,
    `Utilización: ${calculations.utilization ?? 0}%`,
  ];
  summary.forEach((line) => doc.fontSize(11).fillColor("#333").text(line));
  if (calculations.warnings?.length) {
    doc.moveDown(0.4).fillColor("#d97706").text("Alertas:");
    calculations.warnings.forEach((w) => doc.fontSize(10).text(`• ${w}`));
  }
  doc.moveDown();
}

function addDeterminationsTable(doc, determinations = []) {
  doc.fontSize(14).fillColor("#111").text("Determinaciones", { underline: true });
  doc.moveDown(0.4);
  if (!determinations.length) {
    doc.fontSize(11).fillColor("#666").text("No hay determinaciones registradas");
    return;
  }

  const headers = ["Nombre", "Categoría", "Cantidad", "Consumo", "Costo"]; // 5 cols
  const widths = [160, 100, 70, 90, 90];
  const startX = doc.x;
  const startY = doc.y;

  headers.forEach((h, idx) => {
    doc.fontSize(10).fillColor("#0f172a").text(h, startX + widths.slice(0, idx).reduce((a, b) => a + b, 0), startY, {
      width: widths[idx],
      continued: idx < headers.length - 1,
    });
  });
  doc.moveDown();

  determinations.forEach((det) => {
    const row = [
      det.name || det.roche_code || "-",
      det.category || "-",
      det.monthly_quantity ?? "-",
      det.calculated_consumption ?? "-",
      det.calculated_cost ? `$${det.calculated_cost}` : "-",
    ];
    row.forEach((value, idx) => {
      doc
        .fontSize(10)
        .fillColor("#334155")
        .text(String(value), startX + widths.slice(0, idx).reduce((a, b) => a + b, 0), doc.y, {
          width: widths[idx],
          continued: idx < headers.length - 1,
        });
    });
    doc.moveDown();
  });
}

async function generateBusinessCasePdf(businessCaseId) {
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
  const determinations = await determinationsService.getDeterminations(businessCaseId);
  const calculations = (await businessCaseService.getCalculations(businessCaseId)) || {};

  return new Promise((resolve, reject) => {
    const doc = createDoc();
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    addHeader(doc, bc);
    addSummary(doc, calculations);
    addDeterminationsTable(doc, determinations);

    doc.end();
  });
}

module.exports = {
  generateBusinessCasePdf,
};
