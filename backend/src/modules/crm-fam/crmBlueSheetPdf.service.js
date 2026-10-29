/**
 * crmBlueSheetPdf.service.js
 * Exporta un Blue Sheet completo a PDF (objetivo, situacion, compradores,
 * resultados, competidores, fortalezas, red flags, scorecard, acciones) --
 * para compartir/imprimir antes de una reunion con el cliente o con
 * gerencia, sin tener que armar un resumen a mano cada vez.
 */
const PDFDocument = require("pdfkit");
const service = require("./crm.service");

const ROLE_LABELS = { economic_buyer: "Comprador económico", user_buyer: "Comprador usuario", technical_buyer: "Comprador técnico", coach: "Coach" };
const RECEPT_LABELS = { growth: "Crecimiento", trouble: "Problema", even_keel: "Neutral", overconfident: "Sobreconfiado" };
const STATUS_LABELS = { draft: "Borrador", in_progress: "En progreso", ready_for_review: "En revisión", observed: "Observado", approved: "Aprobado", needs_update: "Necesita actualización" };
const SEV_LABELS = { low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico" };
const PRI_LABELS = { low: "Bajo", medium: "Medio", high: "Alto", urgent: "Urgente" };

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function sectionHeader(doc, title, PW) {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.6);
  doc.rect(40, doc.y, PW, 20).fill("#1e293b");
  doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold").text(title, 46, doc.y - 15);
  doc.y += 8;
  doc.fillColor("#0f172a");
}

function bodyText(doc, label, value, PW) {
  if (doc.y > 740) doc.addPage();
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#475569").text(label, 40, doc.y);
  doc.fontSize(9).font("Helvetica").fillColor("#1e293b").text(value || "N/A", 40, doc.y + 12, { width: PW });
  doc.moveDown(0.6);
}

function simpleTable(doc, { columns, rows, PW }) {
  if (!rows.length) {
    doc.fontSize(9).fillColor("#64748b").text("Sin registros.", 40, doc.y);
    doc.moveDown(0.5);
    return;
  }
  const colWidths = columns.map((c) => c.width);
  const colX = colWidths.reduce((acc, w, i) => { acc.push((acc[i - 1] ?? 40) + (i > 0 ? colWidths[i - 1] : 0)); return acc; }, []);

  if (doc.y > 740) doc.addPage();
  doc.rect(40, doc.y, PW, 16).fill("#e2e8f0");
  const thY = doc.y + 3;
  columns.forEach((c, i) => {
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#334155").text(c.header, colX[i] + 2, thY, { width: colWidths[i] - 4 });
  });
  doc.y = thY + 13;

  rows.forEach((row, idx) => {
    const heights = columns.map((c, i) => doc.fontSize(8).heightOfString(String(c.value(row) ?? "-"), { width: colWidths[i] - 4 }));
    const rowHeight = Math.max(14, ...heights) + 4;
    if (doc.y + rowHeight > 780) { doc.addPage(); doc.y = 40; }
    const rowY = doc.y;
    if (idx % 2 === 1) doc.rect(40, rowY, PW, rowHeight).fill("#f8fafc");
    columns.forEach((c, i) => {
      doc.fontSize(8).font("Helvetica").fillColor("#334155").text(String(c.value(row) ?? "-"), colX[i] + 2, rowY + 2, { width: colWidths[i] - 4 });
    });
    doc.y = rowY + rowHeight;
  });
  doc.moveDown(0.5);
}

async function generateBlueSheetPdf(blueSheetId, user) {
  const data = await service.getBlueSheetFullData(blueSheetId, user);
  const { blueSheet: bs, accountName } = data;
  const PW = 515;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), filename: `blue_sheet_${bs.opportunity_name || bs.id}_${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, "_") }));
    doc.on("error", reject);

    // Portada
    doc.rect(40, 40, PW, 90).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(17).font("Helvetica-Bold").text("Blue Sheet — Strategic Selling", 50, 52, { width: PW - 20 });
    doc.fontSize(11).font("Helvetica").fillColor("#94a3b8").text(bs.opportunity_name || "-", 50, 76, { width: PW - 20 });
    if (accountName) doc.fontSize(9).fillColor("#cbd5e1").text(accountName, 50, 94, { width: PW - 20 });
    doc.fillColor("#0f172a").y = 145;
    doc.fontSize(8.5).font("Helvetica").fillColor("#64748b")
      .text(`Estado: ${STATUS_LABELS[bs.status] || bs.status}   ·   Completitud: ${bs.completeness_score ?? 0}%   ·   Generado: ${fmtDate(new Date())}`);
    doc.moveDown(1);

    // General
    sectionHeader(doc, "Objetivo y situación", PW);
    bodyText(doc, "Objetivo de venta", bs.sales_objective_text, PW);
    bodyText(doc, "Situación actual del cliente", bs.customer_situation_current, PW);
    bodyText(doc, "Situación deseada", bs.customer_situation_desired, PW);
    bodyText(doc, "Proceso de compra", bs.buying_process_description, PW);
    bodyText(doc, "Resumen de estrategia", bs.strategy_summary, PW);

    // Compradores
    sectionHeader(doc, `Compradores (${data.buyingInfluences.length})`, PW);
    simpleTable(doc, {
      PW,
      columns: [
        { header: "Nombre", width: 140, value: (r) => r.full_name },
        { header: "Cargo", width: 110, value: (r) => r.job_title },
        { header: "Rol", width: 120, value: (r) => ROLE_LABELS[r.influence_role] || r.influence_role },
        { header: "Receptividad", width: 105, value: (r) => RECEPT_LABELS[r.receptivity] || r.receptivity },
      ],
      rows: data.buyingInfluences,
    });

    // Competidores
    sectionHeader(doc, `Competidores (${data.competitors.length})`, PW);
    simpleTable(doc, {
      PW,
      columns: [
        { header: "Nombre", width: 130, value: (r) => r.competitor_name },
        { header: "Amenaza", width: 70, value: (r) => SEV_LABELS[r.threat_level] || r.threat_level },
        { header: "Fortalezas", width: 155, value: (r) => r.known_strengths },
        { header: "Debilidades", width: 155, value: (r) => r.known_weaknesses },
      ],
      rows: data.competitors,
    });

    // Fortalezas
    sectionHeader(doc, `Fortalezas propias (${data.strengths.length})`, PW);
    simpleTable(doc, {
      PW,
      columns: [
        { header: "Descripción", width: 400, value: (r) => r.strength_description || r.description },
        { header: "Categoría", width: 110, value: (r) => r.category },
      ],
      rows: data.strengths,
    });

    // Red flags
    sectionHeader(doc, `Red flags (${data.redFlags.length})`, PW);
    simpleTable(doc, {
      PW,
      columns: [
        { header: "Descripción", width: 260, value: (r) => r.flag_description || r.flag_title },
        { header: "Severidad", width: 70, value: (r) => SEV_LABELS[r.severity] || r.severity },
        { header: "Estado", width: 70, value: (r) => r.status },
        { header: "Mitigación", width: 110, value: (r) => r.mitigation_plan },
      ],
      rows: data.redFlags,
    });

    // Scorecard
    sectionHeader(doc, `Scorecard (${data.scorecardAnswers.length} respuestas)`, PW);
    simpleTable(doc, {
      PW,
      columns: [
        { header: "Criterio", width: 380, value: (r) => r.criterion_name },
        { header: "Puntaje (0-5)", width: 130, value: (r) => r.score },
      ],
      rows: data.scorecardAnswers,
    });

    // Acciones
    sectionHeader(doc, `Plan de acción (${data.actionItems.length})`, PW);
    simpleTable(doc, {
      PW,
      columns: [
        { header: "Título", width: 230, value: (r) => r.title },
        { header: "Prioridad", width: 80, value: (r) => PRI_LABELS[r.priority] || r.priority },
        { header: "Vence", width: 80, value: (r) => fmtDate(r.due_date) },
        { header: "Estado", width: 120, value: (r) => r.status },
      ],
      rows: data.actionItems,
    });

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text(`Página ${i + 1} de ${pageCount}  ·  FAM SPI — CRM-Fam Blue Sheet`, 40, 820, { width: PW, align: "center", lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { generateBlueSheetPdf };
