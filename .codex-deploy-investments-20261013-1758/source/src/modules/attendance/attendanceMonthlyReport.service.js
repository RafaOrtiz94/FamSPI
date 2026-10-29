const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const db = require("../../config/db");
const { computeSha256HexFromBuffer, HASH_ALGORITHM } = require("../../utils/documentHash");
const { buildAttendanceRangeQuery, enrichAttendanceRowsGeo } = require("./attendanceReports.service");

const NAVY = "#0F172A";
const SLATE = "#334155";
const MUTED = "#94A3B8";
const HEADER_BAR = "#1E293B";
const LIGHT = "#F8FAFC";
const AMBER = "#B45309";

function streamPdfToBuffer(pdf) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.end();
  });
}

function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// pg parsea columnas DATE como objetos Date en UTC medianoche (pg-types usa
// Date.UTC internamente) - normalizamos siempre a "YYYY-MM-DD" para que el
// ordenamiento y el formato de fecha no dependan de Date.toString().
function normalizeDateKey(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value || "").slice(0, 10);
}

function fmtDate(dateKey) {
  if (!dateKey) return "-";
  const d = new Date(`${normalizeDateKey(dateKey)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return normalizeDateKey(dateKey);
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toSecondsFromHours(hoursValue) {
  const h = Number(hoursValue || 0);
  if (!h) return 0;
  return Math.max(0, Math.round(h * 3600));
}

function toDurationLabel(secondsValue) {
  const totalSeconds = Math.max(0, Math.round(Number(secondsValue || 0)));
  if (!totalSeconds) return "-";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateWorkedSecondsFromRealMarks(row = {}) {
  const entry = toDateOrNull(row.entry_time);
  const exit = toDateOrNull(row.exit_time || row.return_time);
  if (!entry || !exit || exit <= entry) return 0;

  let workedMs = exit.getTime() - entry.getTime();
  const lunchStart = toDateOrNull(row.lunch_start_time);
  const lunchEnd = toDateOrNull(row.lunch_end_time);
  if (lunchStart && lunchEnd && lunchEnd > lunchStart && lunchEnd > entry && lunchStart < exit) {
    const boundedStart = Math.max(lunchStart.getTime(), entry.getTime());
    const boundedEnd = Math.min(lunchEnd.getTime(), exit.getTime());
    if (boundedEnd > boundedStart) {
      const realLunchMs = boundedEnd - boundedStart;
      const minimumLunchMs = 60 * 60 * 1000;
      workedMs -= Math.max(realLunchMs, minimumLunchMs);
    }
  }

  return Math.max(0, Math.round(workedMs / 1000));
}

function timeOffDisplay(row) {
  if (row.permission_label) return row.permission_label;
  const type = String(row.time_off_type || "").toLowerCase();
  if (type.includes("vacac")) return "Vacaciones";
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "";
}

function isOperational(row) {
  if (isTelework(row)) return false;
  return ["operacion_campo", "operacion_de_campo", "salida_oficina", "viaje", "campo"].includes(
    String(row.exception_type || "").trim().toLowerCase()
  );
}

function isTelework(row) {
  return String(row.operational_category || "").trim().toLowerCase() === "teletrabajo";
}

// "Doble marcacion": el acta F.RH siempre registra horarios fijos
// (09:00/14:00/15:00/18:00), incluso en jornadas normales - por eso NO se usa
// como senal de doble marcacion por si sola (marcaria "Si" casi todos los dias).
// La doble marcacion real ocurre solo en operacion de campo: el acta registra
// el horario fijo mientras el horario real de campo queda preservado aparte en
// attendance_exceptions (op_lunch_start_time/op_lunch_end_time, fix de esta
// misma sesion). Por eso el flag solo aplica a dias operativos.
function hasDoubleMarking(row) {
  if (!isOperational(row)) return false;
  const pairs = [
    [row.entry_time, row.acta_entry_time],
    [row.lunch_start_time, row.acta_lunch_start_time],
    [row.lunch_end_time, row.acta_lunch_end_time],
    [row.exit_time, row.acta_exit_time],
    [row.op_lunch_start_time, row.lunch_start_time],
    [row.op_lunch_end_time, row.lunch_end_time],
  ];
  return pairs.some(([real, acta]) => {
    if (!real || !acta) return false;
    return new Date(real).getTime() !== new Date(acta).getTime();
  });
}

// Normaliza un dia de asistencia a un registro unico con todos los campos
// pedidos: marcaciones reales, marcaciones operativas (inicio, almuerzo
// operativo, regreso) y regularizacion (acta) - lo consumen tanto el PDF
// como el Excel, para no duplicar la logica de negocio entre formatos.
function buildDayRecord(d) {
  const double = hasDoubleMarking(d);
  const telework = isTelework(d);
  const realOvertimeSeconds = Number.isFinite(Number(d.real_overtime_seconds))
    ? Math.max(0, Math.round(Number(d.real_overtime_seconds || 0)))
    : toSecondsFromHours(d.real_overtime_hours);
  const totalWorkedSeconds = calculateWorkedSecondsFromRealMarks(d);
  return {
    fecha: fmtDate(d.date),
    entradaReal: fmtTime(d.entry_time),
    entradaRegularizada: fmtTime(d.acta_entry_time),
    inicioOperativo: fmtTime(d.start_time),
    inicioTeletrabajo: telework ? fmtTime(d.start_time) : "-",
    almuerzoRealEntrada: fmtTime(d.lunch_start_time),
    almuerzoRealSalida: fmtTime(d.lunch_end_time),
    almuerzoOperativoEntrada: fmtTime(d.op_lunch_start_time),
    almuerzoOperativoSalida: fmtTime(d.op_lunch_end_time),
    almuerzoTeletrabajoSalida: telework ? fmtTime(d.lunch_start_time) : "-",
    almuerzoTeletrabajoRegreso: telework ? fmtTime(d.lunch_end_time) : "-",
    almuerzoRegularizadoEntrada: fmtTime(d.acta_lunch_start_time),
    almuerzoRegularizadoSalida: fmtTime(d.acta_lunch_end_time),
    regresoOperativo: fmtTime(d.return_time),
    cierreTeletrabajo: telework ? fmtTime(d.return_time || d.exit_time) : "-",
    ciudadTeletrabajo: telework ? (d.operational_destination_city || "-") : "-",
    salidaReal: fmtTime(d.exit_time),
    salidaRegularizada: fmtTime(d.acta_exit_time),
    totalTrabajadoSegundos: totalWorkedSeconds,
    totalTrabajado: toDurationLabel(totalWorkedSeconds),
    tipo: telework ? "Teletrabajo" : isOperational(d) ? "Operativa" : "Normal",
    dobleMarcacion: double,
    extraSegundos: realOvertimeSeconds,
    extraDuracion: toDurationLabel(realOvertimeSeconds),
    permiso: timeOffDisplay(d) || "",
  };
}

async function fetchMonthlyReportData({ start, end, userIds, requesterId }) {
  const { query, params, filterRows } = await buildAttendanceRangeQuery({
    start,
    end,
    isAdminScope: true,
    hasExplicitTarget: false,
    targetUserId: null,
    userIds,
    departmentId: null,
    requesterId,
  });

  const result = await db.query(query, params);
  const filteredRows = filterRows(result.rows) || [];
  // Normalizar la fecha ANTES de enriquecer: buildAttendanceRegularization usa
  // record.date internamente para construir los horarios de acta, y pg entrega
  // esta columna como objeto Date (no string) - sin normalizar primero, el
  // calculo de acta_* falla en silencio y cae de vuelta al horario real.
  filteredRows.forEach((row) => { row.date = normalizeDateKey(row.date); });
  const rows = enrichAttendanceRowsGeo(filteredRows);

  const byUser = new Map();
  rows.forEach((row) => {
    const key = row.user_id;
    if (!byUser.has(key)) {
      byUser.set(key, {
        user_id: key,
        fullname: row.fullname || row.email || "Colaborador",
        department_name: row.department_name || "Sin departamento",
        rawDays: [],
      });
    }
    byUser.get(key).rawDays.push(row);
  });

  const collaborators = [...byUser.values()].sort((a, b) => a.fullname.localeCompare(b.fullname));
  collaborators.forEach((c) => {
    c.rawDays.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    c.days = c.rawDays.map(buildDayRecord);
    c.totalTrabajadoSegundos = c.days.reduce((s, d) => s + d.totalTrabajadoSegundos, 0);
    c.totalExtraSegundos = c.days.reduce((s, d) => s + d.extraSegundos, 0);
    c.doubleMarkDays = c.days.filter((d) => d.dobleMarcacion).length;
    c.timeOffDays = c.days.filter((d) => d.permiso).length;
  });

  return { collaborators };
}

// ── PDF ──────────────────────────────────────────────────────────────────

function pdfEnsureSpace(pdf, neededHeight) {
  const bottom = pdf.page.height - pdf.page.margins.bottom;
  if (pdf.y + neededHeight > bottom) pdf.addPage();
}

function pdfResetX(pdf) {
  pdf.x = pdf.page.margins.left;
}

function drawBrandHeader(pdf, subtitle) {
  pdf.fontSize(18).font("Helvetica-Bold").fillColor(NAVY).text("FamSPI", { align: "left" });
  pdf.fontSize(9).font("Helvetica").fillColor(MUTED).text(subtitle);
  pdf.moveDown(0.6);
  pdf.moveTo(pdf.page.margins.left, pdf.y)
    .lineTo(pdf.page.width - pdf.page.margins.right, pdf.y)
    .strokeColor("#E2E8F0")
    .stroke();
  pdf.moveDown(0.6);
}

function pdfTable(pdf, { columns, rows, emptyLabel, fontSize = 8 }) {
  pdfResetX(pdf);
  const startX = pdf.page.margins.left;
  const rowHeight = 18;
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
    if (row.__highlight) pdf.rect(startX, rowY, tableWidth, rowHeight).fill("#FEF3C7");
    pdf.fontSize(fontSize).font("Helvetica");
    cols.forEach((col) => {
      const value = String(row[col.key] ?? "-");
      pdf.fillColor(col.colorKey && row[col.colorKey] ? row[col.colorKey] : SLATE)
        .text(value, x + 3, rowY + 5, cellOptions(col));
      x += col.width;
    });
    pdf.y = rowY + rowHeight;
  });
  pdfResetX(pdf);
  pdf.moveDown(0.4);
}

const DAILY_COLUMNS = [
  { key: "fecha", label: "Fecha", width: 55 },
  { key: "entradaReal", label: "Entrada Real", width: 45 },
  { key: "entradaRegularizada", label: "Entrada Reg.", width: 45 },
  { key: "inicioOperativo", label: "Inicio Oper.", width: 48 },
  { key: "inicioTeletrabajo", label: "Inicio TT", width: 42 },
  { key: "almuerzoReal", label: "Almuerzo Real", width: 62 },
  { key: "almuerzoOperativo", label: "Almuerzo Oper.", width: 62 },
  { key: "almuerzoTeletrabajo", label: "Almuerzo TT", width: 62 },
  { key: "almuerzoRegularizado", label: "Almuerzo Reg.", width: 62 },
  { key: "regresoOperativo", label: "Regreso Oper.", width: 48 },
  { key: "cierreTeletrabajo", label: "Cierre TT", width: 42 },
  { key: "salidaReal", label: "Salida Real", width: 45 },
  { key: "salidaRegularizada", label: "Salida Reg.", width: 45 },
  { key: "totalTrabajado", label: "Total horas", width: 62, align: "right" },
  { key: "tipo", label: "Tipo", width: 42 },
  { key: "dobleMarcacion", label: "Doble Marc.", width: 42, colorKey: "__dobleColor" },
  { key: "extra", label: "Extra real", width: 58, align: "right" },
  { key: "permiso", label: "Permiso/Vac.", width: 100 },
];

function buildPdfRow(d) {
  return {
    fecha: d.fecha,
    entradaReal: d.entradaReal,
    entradaRegularizada: d.entradaRegularizada,
    inicioOperativo: d.inicioOperativo,
    inicioTeletrabajo: d.inicioTeletrabajo,
    almuerzoReal: d.almuerzoRealEntrada !== "-" || d.almuerzoRealSalida !== "-"
      ? `${d.almuerzoRealEntrada}-${d.almuerzoRealSalida}` : "-",
    almuerzoOperativo: d.almuerzoOperativoEntrada !== "-" || d.almuerzoOperativoSalida !== "-"
      ? `${d.almuerzoOperativoEntrada}-${d.almuerzoOperativoSalida}` : "-",
    almuerzoTeletrabajo: d.almuerzoTeletrabajoSalida !== "-" || d.almuerzoTeletrabajoRegreso !== "-"
      ? `${d.almuerzoTeletrabajoSalida}-${d.almuerzoTeletrabajoRegreso}` : "-",
    almuerzoRegularizado: d.almuerzoRegularizadoEntrada !== "-" || d.almuerzoRegularizadoSalida !== "-"
      ? `${d.almuerzoRegularizadoEntrada}-${d.almuerzoRegularizadoSalida}` : "-",
    regresoOperativo: d.regresoOperativo,
    cierreTeletrabajo: d.cierreTeletrabajo,
    salidaReal: d.salidaReal,
    salidaRegularizada: d.salidaRegularizada,
    totalTrabajado: d.totalTrabajado,
    tipo: d.tipo,
    dobleMarcacion: d.dobleMarcacion ? "Si" : "-",
    __dobleColor: d.dobleMarcacion ? AMBER : undefined,
    extra: d.extraDuracion,
    permiso: d.permiso || "-",
    __highlight: d.dobleMarcacion,
  };
}

function buildPdfBuffer({ collaborators, periodLabel }) {
  const pdf = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const generatedAt = new Date().toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
  const monthlyExtraSeconds = collaborators.reduce(
    (sum, collaborator) => sum + Number(collaborator.totalExtraSegundos || 0),
    0
  );

  drawBrandHeader(pdf, `Reporte mensual de asistencia — ${periodLabel} — generado ${generatedAt}`);
  pdf.fontSize(13).font("Helvetica-Bold").fillColor(NAVY).text("Resumen general");
  pdf.moveDown(0.3);
  pdf
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(NAVY)
    .text(`Total mensual de extras reales: ${toDurationLabel(monthlyExtraSeconds)}`);
  pdf.moveDown(0.4);
  pdfTable(pdf, {
    columns: [
      { key: "fullname", label: "Colaborador", width: 190 },
      { key: "department_name", label: "Departamento", width: 130 },
      { key: "days", label: "Dias c/registro", width: 80, align: "right" },
      { key: "totalHours", label: "Total horas", width: 100, align: "right" },
      { key: "extra", label: "Extra real", width: 100, align: "right" },
      { key: "doble", label: "Dias doble marc.", width: 90, align: "right" },
      { key: "timeoff", label: "Permisos/Vac.", width: 80, align: "right" },
    ],
    rows: collaborators.map((c) => ({
      fullname: c.fullname,
      department_name: c.department_name,
      days: c.days.length,
      totalHours: toDurationLabel(c.totalTrabajadoSegundos),
      extra: toDurationLabel(c.totalExtraSegundos),
      doble: c.doubleMarkDays,
      timeoff: c.timeOffDays,
    })),
    emptyLabel: "No hay colaboradores con registros en el periodo.",
  });

  collaborators.forEach((c) => {
    pdf.addPage();
    drawBrandHeader(pdf, `Reporte mensual de asistencia — ${periodLabel}`);
    pdf.fontSize(13).font("Helvetica-Bold").fillColor(NAVY).text(c.fullname);
    pdf.fontSize(9).font("Helvetica").fillColor(MUTED).text(c.department_name);
    pdf.moveDown(0.2);
    pdf.fontSize(9).font("Helvetica").fillColor(SLATE).text(
      `Dias con registro: ${c.days.length}  |  Total horas: ${toDurationLabel(c.totalTrabajadoSegundos)}  |  Extra real: ${toDurationLabel(c.totalExtraSegundos)}  |  Dias con doble marcacion: ${c.doubleMarkDays}  |  Permisos/vacaciones: ${c.timeOffDays}`
    );
    pdf.moveDown(0.4);

    pdfTable(pdf, {
      columns: DAILY_COLUMNS,
      rows: c.days.map(buildPdfRow),
      emptyLabel: "Sin registros en el periodo.",
      fontSize: 7,
    });
  });

  return streamPdfToBuffer(pdf);
}

// ── Excel ────────────────────────────────────────────────────────────────

function sanitizeSheetName(name, usedNames) {
  let base = String(name || "Colaborador").replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 28) || "Colaborador";
  let candidate = base;
  let i = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base} (${i})`.slice(0, 31);
    i += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function buildExcelBuffer({ collaborators, periodLabel }) {
  const workbook = XLSX.utils.book_new();
  const monthlyExtraSeconds = collaborators.reduce(
    (sum, collaborator) => sum + Number(collaborator.totalExtraSegundos || 0),
    0
  );

  const summaryRows = [
    {
      Colaborador: "TOTAL MENSUAL",
      Departamento: "",
      "Dias con registro": collaborators.reduce((sum, c) => sum + c.days.length, 0),
      "Total horas": "",
      "Total horas (segundos)": "",
      "Extra real": toDurationLabel(monthlyExtraSeconds),
      "Extra real (segundos)": monthlyExtraSeconds,
      "Dias con doble marcacion": collaborators.reduce((sum, c) => sum + Number(c.doubleMarkDays || 0), 0),
      "Permisos/Vacaciones": collaborators.reduce((sum, c) => sum + Number(c.timeOffDays || 0), 0),
    },
    ...collaborators.map((c) => ({
      Colaborador: c.fullname,
      Departamento: c.department_name,
      "Dias con registro": c.days.length,
      "Total horas": toDurationLabel(c.totalTrabajadoSegundos),
      "Total horas (segundos)": c.totalTrabajadoSegundos,
      "Extra real": toDurationLabel(c.totalExtraSegundos),
      "Extra real (segundos)": c.totalExtraSegundos,
      "Dias con doble marcacion": c.doubleMarkDays,
      "Permisos/Vacaciones": c.timeOffDays,
    })),
  ];
  const summarySheet = XLSX.utils.json_to_sheet(
    summaryRows.length ? summaryRows : [{ Nota: "No hay colaboradores con registros en el periodo" }]
  );
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

  const usedNames = new Set(["Resumen"]);
  collaborators.forEach((c) => {
    const excelRows = c.days.map((d) => ({
      Fecha: d.fecha,
      "Entrada Real": d.entradaReal,
      "Entrada Regularizada": d.entradaRegularizada,
      "Inicio Operativo": d.inicioOperativo,
      "Inicio Teletrabajo": d.inicioTeletrabajo,
      "Almuerzo Real Entrada": d.almuerzoRealEntrada,
      "Almuerzo Real Salida": d.almuerzoRealSalida,
      "Almuerzo Operativo Entrada": d.almuerzoOperativoEntrada,
      "Almuerzo Operativo Salida": d.almuerzoOperativoSalida,
      "Almuerzo Teletrabajo Salida": d.almuerzoTeletrabajoSalida,
      "Almuerzo Teletrabajo Regreso": d.almuerzoTeletrabajoRegreso,
      "Almuerzo Regularizado Entrada": d.almuerzoRegularizadoEntrada,
      "Almuerzo Regularizado Salida": d.almuerzoRegularizadoSalida,
      "Regreso Operativo": d.regresoOperativo,
      "Cierre Teletrabajo": d.cierreTeletrabajo,
      "Ciudad Teletrabajo": d.ciudadTeletrabajo,
      "Salida Real": d.salidaReal,
      "Salida Regularizada": d.salidaRegularizada,
      "Total horas": d.totalTrabajado,
      "Total horas (segundos)": d.totalTrabajadoSegundos,
      Tipo: d.tipo,
      "Doble Marcacion": d.dobleMarcacion ? "Si" : "No",
      "Extra real": d.extraDuracion,
      "Extra real (segundos)": d.extraSegundos,
      "Permiso/Vacacion": d.permiso || "",
    }));
    const sheet = XLSX.utils.json_to_sheet(
      excelRows.length ? excelRows : [{ Nota: "Sin registros en el periodo" }]
    );
    XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(c.fullname, usedNames));
  });

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

// ── entrypoint ───────────────────────────────────────────────────────────

async function generateMonthlyAttendanceReportBuffer({ start, end, userIds, requesterId, periodLabel, format = "pdf" }) {
  const { collaborators } = await fetchMonthlyReportData({ start, end, userIds, requesterId });
  const normalizedFormat = String(format || "pdf").toLowerCase() === "excel" ? "excel" : "pdf";

  const buffer = normalizedFormat === "excel"
    ? await buildExcelBuffer({ collaborators, periodLabel })
    : await buildPdfBuffer({ collaborators, periodLabel });

  const hashSha256 = computeSha256HexFromBuffer(buffer);
  return {
    buffer,
    hashSha256,
    hashAlgorithm: HASH_ALGORITHM || "SHA-256",
    format: normalizedFormat,
    contentType: normalizedFormat === "excel"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf",
    fileExt: normalizedFormat === "excel" ? "xlsx" : "pdf",
  };
}

module.exports = {
  generateMonthlyAttendanceReportBuffer,
  __private: {
    buildDayRecord,
    buildExcelBuffer,
    calculateWorkedSecondsFromRealMarks,
    hasDoubleMarking,
    isOperational,
    isTelework,
    toDurationLabel,
  },
};
