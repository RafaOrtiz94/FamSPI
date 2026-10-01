/**
 * crmReports.pdf.service.js
 * Exportacion a PDF de los reportes de CRM-Fam (razones de perdida, red
 * flags). Reusa los mismos SELECT que ya expone crm.service.js -- este
 * archivo solo dibuja el PDF, no duplica logica de negocio.
 */
const PDFDocument = require("pdfkit");
const service = require("./crm.service");

function fmtMoney(v) {
  return `$${Number(v || 0).toLocaleString("es-EC", { maximumFractionDigits: 0 })}`;
}

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildTablePdf({ title, subtitle, columns, rows, generatedByName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = 515;

    doc.rect(40, 40, PW, 70).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold").text(title, 50, 52, { width: PW - 20 });
    if (subtitle) {
      doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text(subtitle, 50, 74, { width: PW - 20 });
    }
    doc.fillColor("#0f172a").y = 122;
    doc.fontSize(8.5).font("Helvetica").fillColor("#64748b")
      .text(`Generado: ${fmtDate(new Date())}${generatedByName ? `  ·  Por: ${generatedByName}` : ""}`);
    doc.moveDown(1);

    const colWidths = columns.map((c) => c.width);
    const colX = colWidths.reduce((acc, w, i) => { acc.push((acc[i - 1] ?? 40) + (i > 0 ? colWidths[i - 1] : 0)); return acc; }, []);

    if (!rows.length) {
      doc.fontSize(10).fillColor("#64748b").text("Sin datos para los filtros aplicados.", 40, doc.y + 10);
    } else {
      doc.rect(40, doc.y, PW, 18).fill("#e2e8f0");
      const thY = doc.y + 4;
      columns.forEach((c, i) => {
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#334155").text(c.header, colX[i] + 2, thY, { width: colWidths[i] - 4 });
      });
      doc.y = thY + 15;

      rows.forEach((row, idx) => {
        if (doc.y > 760) { doc.addPage(); doc.y = 40; }
        const rowY = doc.y;
        const heights = columns.map((c, i) => doc.heightOfString(String(c.value(row) ?? "-"), { width: colWidths[i] - 4 }));
        const rowHeight = Math.max(16, ...heights) + 4;
        if (idx % 2 === 1) doc.rect(40, rowY, PW, rowHeight).fill("#f8fafc");
        columns.forEach((c, i) => {
          doc.fontSize(8.5).font("Helvetica").fillColor("#334155")
            .text(String(c.value(row) ?? "-"), colX[i] + 2, rowY + 3, { width: colWidths[i] - 4 });
        });
        doc.y = rowY + rowHeight;
      });
    }

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text(`Página ${i + 1} de ${pageCount}  ·  FAM SPI — CRM-Fam`, 40, 820, { width: PW, align: "center", lineBreak: false });
    }

    doc.end();
  });
}

async function generateLostReasonsPdf({ date_from, date_to } = {}, user) {
  const rows = await service.getLostReasonsReport({ date_from, date_to }, user);
  const generatedByName = user?.fullname || user?.name || user?.email || null;
  const subtitleParts = [];
  if (date_from) subtitleParts.push(`Desde ${fmtDate(date_from)}`);
  if (date_to) subtitleParts.push(`Hasta ${fmtDate(date_to)}`);

  const buffer = await buildTablePdf({
    title: "Razones de pérdida — CRM-Fam",
    subtitle: subtitleParts.join(" · ") || null,
    generatedByName,
    columns: [
      { header: "Razón", width: 260, value: (r) => r.reason_name },
      { header: "# Pérdidas", width: 110, value: (r) => r.count },
      { header: "Pipeline perdido", width: 145, value: (r) => fmtMoney(r.total_pipeline_lost) },
    ],
    rows,
  });

  return { buffer, filename: `reporte_razones_perdida_${new Date().toISOString().slice(0, 10)}.pdf` };
}

async function generateRedFlagsPdf({ severity, status } = {}, user) {
  const rows = await service.getRedFlagsReport({ severity, status }, user);
  const generatedByName = user?.fullname || user?.name || user?.email || null;
  const subtitleParts = [];
  if (severity) subtitleParts.push(`Severidad: ${severity}`);
  if (status) subtitleParts.push(`Estado: ${status}`);

  const buffer = await buildTablePdf({
    title: "Red Flags — CRM-Fam",
    subtitle: subtitleParts.join(" · ") || null,
    generatedByName,
    columns: [
      { header: "Descripción", width: 180, value: (r) => r.flag_title || r.description },
      { header: "Severidad", width: 70, value: (r) => r.severity },
      { header: "Oportunidad", width: 130, value: (r) => r.opportunity_name },
      { header: "Responsable", width: 80, value: (r) => r.owner_name },
      { header: "Fecha", width: 55, value: (r) => fmtDate(r.created_at) },
    ],
    rows,
  });

  return { buffer, filename: `reporte_red_flags_${new Date().toISOString().slice(0, 10)}.pdf` };
}

module.exports = { generateLostReasonsPdf, generateRedFlagsPdf };
