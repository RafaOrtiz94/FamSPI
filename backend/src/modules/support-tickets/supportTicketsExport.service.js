/**
 * Exportacion PDF/Excel del reporte mensual de tickets de soporte TI.
 * Sigue el patron de backend/src/modules/attendance/attendanceMonthlyReport.service.js
 * (pdfkit para PDF, xlsx para Excel, ambos ya usados en el repo).
 */
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

const NAVY = "#182838";
const SLATE = "#334155";
const MUTED = "#7B8B99";
const HEADER_BAR = "#182838";
const LIGHT = "#F3F5F7";

function streamPdfToBuffer(pdf) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.end();
  });
}

function pdfEnsureSpace(pdf, neededHeight) {
  const bottom = pdf.page.height - pdf.page.margins.bottom;
  if (pdf.y + neededHeight > bottom) pdf.addPage();
}

function pdfResetX(pdf) {
  pdf.x = pdf.page.margins.left;
}

function drawBrandHeader(pdf, subtitle) {
  pdf.fontSize(18).font("Helvetica-Bold").fillColor(NAVY).text("FamSPI · Soporte TI", { align: "left" });
  pdf.fontSize(9).font("Helvetica").fillColor(MUTED).text(subtitle);
  pdf.moveDown(0.6);
  pdf.moveTo(pdf.page.margins.left, pdf.y)
    .lineTo(pdf.page.width - pdf.page.margins.right, pdf.y)
    .strokeColor("#DCE3E9")
    .stroke();
  pdf.moveDown(0.6);
}

function pdfTable(pdf, { columns, rows, emptyLabel, fontSize = 9 }) {
  pdfResetX(pdf);
  const startX = pdf.page.margins.left;
  const rowHeight = 20;
  const availableWidth = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
  const rawWidth = columns.reduce((s, c) => s + c.width, 0);
  const scale = rawWidth > availableWidth ? availableWidth / rawWidth : 1;
  const cols = columns.map((c) => ({ ...c, width: Math.floor(c.width * scale) }));
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const cellOptions = (col) => ({
    width: col.width - 6,
    height: rowHeight - 4,
    align: col.align || "left",
    ellipsis: true,
    lineBreak: false,
  });

  const drawHeader = () => {
    pdfEnsureSpace(pdf, rowHeight * 2);
    let x = startX;
    const headerY = pdf.y;
    pdf.rect(startX, headerY, tableWidth, rowHeight).fill(HEADER_BAR);
    pdf.fontSize(fontSize).font("Helvetica-Bold");
    cols.forEach((col) => {
      pdf.fillColor("#FFFFFF").text(col.label, x + 3, headerY + 5, cellOptions(col));
      x += col.width;
    });
    pdf.y = headerY + rowHeight;
  };

  if (!rows.length) {
    pdfEnsureSpace(pdf, rowHeight);
    pdfResetX(pdf);
    pdf.fontSize(9).font("Helvetica-Oblique").fillColor(MUTED).text(emptyLabel);
    pdf.moveDown(0.4);
    return;
  }

  drawHeader();
  rows.forEach((row, idx) => {
    pdfEnsureSpace(pdf, rowHeight);
    if (pdf.y === pdf.page.margins.top) drawHeader();
    let x = startX;
    const rowY = pdf.y;
    if (idx % 2 === 1) pdf.rect(startX, rowY, tableWidth, rowHeight).fill(LIGHT);
    pdf.fontSize(fontSize).font("Helvetica");
    cols.forEach((col) => {
      const value = String(row[col.key] ?? "-");
      pdf.fillColor(SLATE).text(value, x + 3, rowY + 5, cellOptions(col));
      x += col.width;
    });
    pdf.y = rowY + rowHeight;
  });
  pdfResetX(pdf);
  pdf.moveDown(0.4);
}

function pdfSectionTitle(pdf, text) {
  pdfEnsureSpace(pdf, 30);
  pdf.fontSize(12).font("Helvetica-Bold").fillColor(NAVY).text(text);
  pdf.moveDown(0.3);
}

function buildPdfBuffer(report) {
  const pdf = new PDFDocument({ margin: 36, size: "A4" });
  const generatedAt = new Date().toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });

  drawBrandHeader(pdf, `Reporte mensual de tickets de soporte — ${report.period.label} — generado ${generatedAt}`);

  pdfSectionTitle(pdf, "Resumen del mes");
  pdf.fontSize(10).font("Helvetica").fillColor(SLATE).text(
    `Total de tickets: ${report.volume.total}  |  Cumplimiento SLA respuesta: ${report.sla.responseCompliancePct ?? "-"}%  |  Cumplimiento SLA resolucion: ${report.sla.resolutionCompliancePct ?? "-"}%  |  CSAT promedio: ${report.csat.average ?? "-"}`
  );
  pdf.moveDown(0.3);
  pdf.fontSize(10).font("Helvetica").fillColor(SLATE).text(
    `Tiempo promedio primera respuesta: ${report.times.avgResponseMinutes ?? "-"} min  |  Ciclo total: ${report.times.avgCycleMinutes ?? "-"} min  |  Entrega TI: ${report.times.avgDeliveryMinutes ?? "-"} min`
  );
  pdf.moveDown(0.5);

  if (report.kpis.length) {
    pdfSectionTitle(pdf, "KPIs configurados");
    pdfTable(pdf, {
      columns: [
        { key: "name", label: "KPI", width: 200 },
        { key: "value", label: "Valor", width: 90, align: "right" },
        { key: "unit", label: "Unidad", width: 90 },
        { key: "goal", label: "Meta", width: 90, align: "right" },
        { key: "status", label: "Cumple", width: 70 },
      ],
      rows: report.kpis.map((k) => ({
        name: k.name,
        value: k.value ?? "-",
        unit: k.unit || "-",
        goal: k.goal_value ?? "-",
        status: k.meets_goal === null || k.meets_goal === undefined ? "-" : k.meets_goal ? "Si" : "No",
      })),
      emptyLabel: "No hay KPIs configurados.",
    });
  }

  pdfSectionTitle(pdf, "Volumen por tipo");
  pdfTable(pdf, {
    columns: [{ key: "label", label: "Tipo", width: 250 }, { key: "total", label: "Total", width: 120, align: "right" }],
    rows: report.volume.byType.map((r) => ({ label: r.label, total: r.total })),
    emptyLabel: "Sin tickets en el periodo.",
  });

  pdfSectionTitle(pdf, "Volumen por estado");
  pdfTable(pdf, {
    columns: [{ key: "label", label: "Estado", width: 250 }, { key: "total", label: "Total", width: 120, align: "right" }],
    rows: report.volume.byStatus.map((r) => ({ label: r.label, total: r.total })),
    emptyLabel: "Sin tickets en el periodo.",
  });

  pdfSectionTitle(pdf, "Ranking de técnicos");
  pdfTable(pdf, {
    columns: [
      { key: "name", label: "Técnico", width: 180 },
      { key: "resolved", label: "Resueltos", width: 90, align: "right" },
      { key: "delivery", label: "Entrega prom. (min)", width: 110, align: "right" },
      { key: "csat", label: "CSAT prom.", width: 90, align: "right" },
    ],
    rows: report.technicianRanking.map((r) => ({
      name: r.technicianName,
      resolved: r.resolvedCount,
      delivery: r.avgDeliveryMinutes ?? "-",
      csat: r.csatAvg ?? "-",
    })),
    emptyLabel: "Sin tickets resueltos asignados en el periodo.",
  });

  return streamPdfToBuffer(pdf);
}

function buildExcelBuffer(report) {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    { Metrica: "Periodo", Valor: report.period.label },
    { Metrica: "Total de tickets", Valor: report.volume.total },
    { Metrica: "Cumplimiento SLA respuesta (%)", Valor: report.sla.responseCompliancePct },
    { Metrica: "Cumplimiento SLA resolucion (%)", Valor: report.sla.resolutionCompliancePct },
    { Metrica: "CSAT promedio", Valor: report.csat.average },
    { Metrica: "Respuestas CSAT", Valor: report.csat.responses },
    { Metrica: "Tiempo promedio primera respuesta (min)", Valor: report.times.avgResponseMinutes },
    { Metrica: "Tiempo promedio ciclo total (min)", Valor: report.times.avgCycleMinutes },
    { Metrica: "Tiempo promedio entrega TI (min)", Valor: report.times.avgDeliveryMinutes },
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

  if (report.kpis.length) {
    const kpiSheet = XLSX.utils.json_to_sheet(
      report.kpis.map((k) => ({
        KPI: k.name,
        Metrica: k.metric_label,
        Valor: k.value,
        Unidad: k.unit,
        Meta: k.goal_value,
        "Cumple meta": k.meets_goal === null || k.meets_goal === undefined ? "" : k.meets_goal ? "Si" : "No",
      }))
    );
    XLSX.utils.book_append_sheet(workbook, kpiSheet, "KPIs");
  }

  const volumeRows = [
    ...report.volume.byType.map((r) => ({ Dimension: "Tipo", Valor: r.label, Total: r.total })),
    ...report.volume.byStatus.map((r) => ({ Dimension: "Estado", Valor: r.label, Total: r.total })),
    ...report.volume.byPriority.map((r) => ({ Dimension: "Prioridad", Valor: r.label, Total: r.total })),
  ];
  const volumeSheet = XLSX.utils.json_to_sheet(
    volumeRows.length ? volumeRows : [{ Nota: "Sin tickets en el periodo" }]
  );
  XLSX.utils.book_append_sheet(workbook, volumeSheet, "Volumen");

  const slaSheet = XLSX.utils.json_to_sheet(
    report.sla.trend.labels.map((mes, i) => ({
      Mes: mes,
      "SLA respuesta (%)": report.sla.trend.responseData[i],
      "SLA resolucion (%)": report.sla.trend.resolutionData[i],
    }))
  );
  XLSX.utils.book_append_sheet(workbook, slaSheet, "SLA");

  const rankingSheet = XLSX.utils.json_to_sheet(
    report.technicianRanking.length
      ? report.technicianRanking.map((r) => ({
          Tecnico: r.technicianName,
          Resueltos: r.resolvedCount,
          "Entrega promedio (min)": r.avgDeliveryMinutes,
          "CSAT promedio": r.csatAvg,
        }))
      : [{ Nota: "Sin tickets resueltos asignados en el periodo" }]
  );
  XLSX.utils.book_append_sheet(workbook, rankingSheet, "Ranking tecnicos");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

async function generateMonthlyReportBuffer({ report, format = "pdf" }) {
  const normalizedFormat = String(format || "pdf").toLowerCase() === "xlsx" ? "xlsx" : "pdf";
  const buffer = normalizedFormat === "xlsx" ? buildExcelBuffer(report) : await buildPdfBuffer(report);
  const filename = `reporte-ti-${report.period.year}-${String(report.period.month).padStart(2, "0")}.${normalizedFormat}`;

  return {
    buffer,
    filename,
    format: normalizedFormat,
    mimeType: normalizedFormat === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf",
  };
}

module.exports = {
  generateMonthlyReportBuffer,
};
