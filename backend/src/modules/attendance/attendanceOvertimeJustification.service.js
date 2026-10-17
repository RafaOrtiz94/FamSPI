const PDFDocument = require("pdfkit");
const db = require("../../config/db");
const { pdfHelpers } = require("./attendanceMonthlyReport.service");

const { drawBrandHeader, pdfEnsureSpace, pdfResetX, pdfTable, streamPdfToBuffer } = pdfHelpers;

const NAVY = "#0F172A";
const SLATE = "#334155";
const MUTED = "#94A3B8";

const TIMEZONE = "America/Guayaquil";
// ponytail: Ecuador es UTC-5 fijo (sin horario de verano); si cambia, usar Intl con TIMEZONE.
const EC_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPERATIONAL_TYPES = ["operacion_campo", "operacion_de_campo", "salida_oficina", "viaje", "campo"];
const MIN_EXCEPTION_SECONDS = 60; // registros abiertos y cerrados en segundos = pruebas del flujo
const MAX_EXIT_SECONDS = 16 * 60 * 60;
const LATE_TOLERANCE_MINUTES = 6; // misma tolerancia que attendance.controller.js
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
// No describen trabajo tecnico: la marcacion misma, ruido del sistema, inicios de sesion y carga automatica del dashboard.
const NON_WORK_MODULES = ["attendance", "notifications", "auth", "dashboard"];
const MODULE_LABELS = {
  "business-case": "Business Case",
  "crm-fam": "CRM",
  "signature-workflows": "Firmas de documentos",
  "ti-assets": "Activos TI",
  "support-tickets": "Tickets de soporte",
  "collab-deliveries": "Entregas a colaboradores",
  collaborators: "Colaboradores",
  permisos: "Permisos",
  vacaciones: "Vacaciones",
  mantenimientos: "Mantenimientos",
  requests: "Solicitudes",
  equipment_purchases: "Compras de equipos",
};
const HEADER_BAR = "#1E293B";
const LIGHT = "#F8FAFC";

function parseClockMinutes(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}

const WORKDAY_START_MIN = parseClockMinutes(process.env.ATTENDANCE_WORKING_DAY_START, 9 * 60);
const WORKDAY_END_MIN = parseClockMinutes(process.env.ATTENDANCE_WORKING_DAY_END, 18 * 60);

// Devuelve un Date cuyos getters UTC dan el "reloj de pared" de Ecuador.
const toEc = (value) => new Date(new Date(value).getTime() + EC_OFFSET_MS);
const dayKeyOf = (value) => toEc(value).toISOString().slice(0, 10);
const hhmm = (value) => (value ? toEc(value).toISOString().slice(11, 16) : "-");
const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function hoursLabel(seconds) {
  const minutes = Math.round(Number(seconds || 0) / 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

const decimalHours = (seconds) => (Number(seconds || 0) / 3600).toFixed(2).replace(".", ",");

function dayLabel(dayKey) {
  const d = new Date(`${dayKey}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}`;
}

// Segundos del intervalo [start, end) que caen fuera de la jornada de lunes a viernes.
// Sabados y domingos cuentan completos.
function offHoursSeconds(start, end) {
  if (!start || !end) return 0;
  const s = toEc(start).getTime();
  const e = toEc(end).getTime();
  if (!(e > s)) return 0;
  let insideMs = 0;
  for (let t = Math.floor(s / DAY_MS) * DAY_MS; t < e; t += DAY_MS) {
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const workStart = t + WORKDAY_START_MIN * 60000;
    const workEnd = t + WORKDAY_END_MIN * 60000;
    insideMs += Math.max(0, Math.min(e, workEnd) - Math.max(s, workStart));
  }
  return Math.round((e - s - insideMs) / 1000);
}

const isOffHours = (value) => offHoursSeconds(value, new Date(new Date(value).getTime() + 1000)) > 0;

function resolvePeriod({ year, month }) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2020 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
    const err = new Error("Periodo invalido: year (2020-2100) y month (1-12) son requeridos");
    err.status = 400;
    throw err;
  }
  const pad = (n) => String(n).padStart(2, "0");
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-EC", { month: "long", year: "numeric", timeZone: "UTC" });
  // from/to cubren el mes calendario completo: 00:00 del dia 1 hasta 00:00 del dia 1 siguiente (hora Ecuador).
  return { year: y, month: m, from: `${y}-${pad(m)}-01`, to: `${next.y}-${pad(next.m)}-01`, label, key: `${y}-${pad(m)}` };
}

async function fetchReportData({ email, period }) {
  const userResult = await db.query("SELECT id, fullname, email FROM users WHERE LOWER(email) = LOWER($1)", [email]);
  if (userResult.rows.length !== 1) {
    const err = new Error(`No se encontro un unico usuario con correo ${email}`);
    err.status = 404;
    throw err;
  }
  const user = userResult.rows[0];
  const params = [user.id, period.from, period.to];

  const tsRange = (col) =>
    `${col} >= ($2::timestamp AT TIME ZONE '${TIMEZONE}') AND ${col} < ($3::timestamp AT TIME ZONE '${TIMEZONE}')`;

  const [attendance, exceptions, closures, lateJustified, actions] = await Promise.all([
    db.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS day, entry_time, lunch_start_time, lunch_end_time, exit_time, overtime_hours
         FROM user_attendance_records
        WHERE user_id = $1 AND date >= $2::date AND date < $3::date
        ORDER BY date`,
      params
    ),
    db.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS day, start_time, return_time, operational_category,
              operational_destination_label, operational_destination_city
         FROM attendance_exceptions
        WHERE user_id = $1 AND date >= $2::date AND date < $3::date
          AND LOWER(COALESCE(type, '')) = ANY($4::text[])
        ORDER BY start_time`,
      [...params, OPERATIONAL_TYPES]
    ),
    db.query(
      `SELECT e.created_at, t.code, t.title
         FROM support_ticket_events e
         JOIN support_tickets t ON t.id = e.ticket_id
        WHERE e.actor_user_id = $1 AND e.new_status IN ('resuelto', 'cerrado') AND ${tsRange("e.created_at")}
        ORDER BY e.created_at`,
      params
    ),
    db.query(
      `SELECT to_char(attendance_date, 'YYYY-MM-DD') AS day
         FROM attendance_late_justifications
        WHERE user_id = $1 AND attendance_date >= $2::date AND attendance_date < $3::date
          AND LOWER(COALESCE(status, 'approved')) IN ('approved', 'aprobado')`,
      params
    ),
    // auditoria.logs.fecha es timestamp sin zona guardado en UTC
    db.query(
      `SELECT (fecha AT TIME ZONE 'UTC') AS ts, modulo
         FROM auditoria.logs
        WHERE usuario_id = $1 AND ${tsRange("(fecha AT TIME ZONE 'UTC')")}
          AND NOT (modulo = ANY($4::text[]))
        ORDER BY fecha`,
      [...params, NON_WORK_MODULES]
    ),
  ]);

  return {
    user,
    attendance: attendance.rows,
    exceptions: exceptions.rows,
    closures: closures.rows,
    actions: actions.rows,
    lateJustifiedDays: lateJustified.rows.map((row) => row.day),
  };
}

// Contabiliza las horas extras dia por dia en dos grupos y descuenta atrasos no justificados:
//  - "sistema": dias de jornada normal; la hora extra sale de las marcaciones de asistencia.
//  - "declarada": dias con salida operacional o teletrabajo registrada por el colaborador; se
//    contabiliza por el registro mismo, aunque no haya otra evidencia en el sistema.
// La justificacion tecnica de cada dia sale de lo que el sistema registra: tickets resueltos o
// cerrados y modulos con actividad fuera de jornada.
function buildReportModel({ attendance = [], exceptions = [], closures = [], actions = [], lateJustifiedDays = [] }) {
  const lateJustified = new Set(lateJustifiedDays);
  const days = new Map();
  const dayOf = (key) => {
    if (!days.has(key)) days.set(key, { key, att: {}, exits: [], hadExit: false, tickets: [], modules: new Map() });
    return days.get(key);
  };
  const notes = [];
  const note = (key, text) => notes.push({ key, text: `${dayLabel(key)}: ${text}` });

  attendance.forEach((row) => { dayOf(row.day).att = row; });

  exceptions.forEach((row) => {
    const seconds = row.start_time && row.return_time
      ? (new Date(row.return_time).getTime() - new Date(row.start_time).getTime()) / 1000
      : 0;
    if (seconds < MIN_EXCEPTION_SECONDS) return;
    const day = dayOf(row.day);
    day.hadExit = true;
    // Una salida de mas de 16 h se olvido abierta: su duracion no es determinable y no se suma.
    if (seconds > MAX_EXIT_SECONDS) {
      note(row.day, `salida operacional abierta hasta ${dayLabel(dayKeyOf(row.return_time))} ${hhmm(row.return_time)}; no se suma.`);
      return;
    }
    if (dayKeyOf(row.start_time) !== dayKeyOf(row.return_time)) {
      note(row.day, `la salida operacional se cerro el ${dayLabel(dayKeyOf(row.return_time))} a las ${hhmm(row.return_time)}.`);
    }
    day.exits.push({ ...row, offSeconds: offHoursSeconds(row.start_time, row.return_time) });
  });

  closures.forEach((row) => {
    const day = days.get(dayKeyOf(row.created_at));
    if (day) day.tickets.push({ ...row, off: isOffHours(row.created_at) });
  });
  actions.filter((row) => isOffHours(row.ts)).forEach((row) => {
    const day = days.get(dayKeyOf(row.ts));
    if (!day) return;
    const label = MODULE_LABELS[row.modulo] || row.modulo;
    const item = day.modules.get(label) || { label, first: row.ts, last: row.ts };
    item.last = row.ts;
    day.modules.set(label, item);
  });

  const rows = [];
  const totals = { systemSeconds: 0, systemDays: 0, declaredSeconds: 0, declaredDays: 0, lateSeconds: 0, lateDays: 0, netSeconds: 0 };

  [...days.values()].sort((a, b) => a.key.localeCompare(b.key)).forEach((day) => {
    const { att } = day;
    const systemSeconds = Math.round(Number(att.overtime_hours || 0) * 3600);
    const exitOffSeconds = day.exits.reduce((sum, exit) => sum + exit.offSeconds, 0);
    // Si asistencia ya calculo hora extra ese dia, la salida operacional no se suma otra vez.
    const extraSeconds = systemSeconds > 0 ? systemSeconds : exitOffSeconds;
    const declared = day.exits.length > 0;

    // Atraso: misma regla del sistema (L-V, tolerancia, sin justificacion aprobada, sin salida operacional ese dia).
    let lateSeconds = 0;
    const weekday = new Date(`${day.key}T00:00:00Z`).getUTCDay();
    if (att.entry_time && weekday >= 1 && weekday <= 5 && !day.hadExit && !lateJustified.has(day.key) && dayKeyOf(att.entry_time) === day.key) {
      const entry = toEc(att.entry_time);
      const lateMinutes = entry.getUTCHours() * 60 + entry.getUTCMinutes() - WORKDAY_START_MIN;
      if (lateMinutes > LATE_TOLERANCE_MINUTES) lateSeconds = lateMinutes * 60;
    }

    if (!extraSeconds && !lateSeconds) return;

    if (extraSeconds > 0 && declared) { totals.declaredSeconds += extraSeconds; totals.declaredDays += 1; }
    if (extraSeconds > 0 && !declared) { totals.systemSeconds += extraSeconds; totals.systemDays += 1; }
    if (lateSeconds > 0) { totals.lateSeconds += lateSeconds; totals.lateDays += 1; }

    if (extraSeconds > 0 && !declared && att.lunch_start_time && att.lunch_end_time && hhmm(att.lunch_start_time) === hhmm(att.lunch_end_time)) {
      note(day.key, "almuerzo sin tiempo marcado; la hora extra no descuenta almuerzo.");
    }

    // En dias declarados sin calculo de asistencia, el horario util es el de la salida operacional.
    const useExitTimes = declared && !systemSeconds;
    const first = day.exits[0] || {};
    const last = day.exits[day.exits.length - 1] || {};
    const closesOtherDay = useExitTimes && dayKeyOf(last.return_time) !== day.key;
    let basis = "Marcacion de asistencia";
    if (declared) {
      const telework = String(first.operational_category || "").toLowerCase() === "teletrabajo";
      basis = [first.operational_destination_label, first.operational_destination_city].filter(Boolean).join(", ")
        || (telework ? "Teletrabajo" : "Salida operacional");
    }

    rows.push({
      key: day.key,
      date: dayLabel(day.key),
      type: extraSeconds ? (declared ? "Declarada" : "Sistema") : "-",
      entry: hhmm(useExitTimes ? first.start_time : att.entry_time),
      exit: `${hhmm(useExitTimes ? last.return_time : att.exit_time)}${closesOtherDay ? " (+1)" : ""}`,
      extra: extraSeconds ? hoursLabel(extraSeconds) : "-",
      late: lateSeconds ? `-${lateSeconds / 60} min` : "-",
      basis: extraSeconds ? basis : "Atraso no justificado",
      technical: extraSeconds ? technicalJustification(day) : "-",
      extraSeconds,
      lateSeconds,
      declared,
    });
  });

  totals.netSeconds = Math.max(0, totals.systemSeconds + totals.declaredSeconds - totals.lateSeconds);
  return { rows, totals, notes: notes.sort((a, b) => a.key.localeCompare(b.key)).map((n) => n.text) };
}

function technicalJustification(day) {
  const ticketList = (items) => items.map((t) => `${t.code} ${String(t.title || "").replace(/\s+/g, " ").trim()}`).join("; ");
  const parts = [];
  const offTickets = day.tickets.filter((t) => t.off);
  const dayTickets = day.tickets.filter((t) => !t.off);
  if (offTickets.length) parts.push(`Tickets cerrados fuera de jornada: ${ticketList(offTickets)}.`);
  if (day.modules.size) {
    parts.push(`Trabajo fuera de jornada en: ${[...day.modules.values()].map((m) => `${m.label} (${hhmm(m.first) === hhmm(m.last) ? hhmm(m.first) : `${hhmm(m.first)}-${hhmm(m.last)}`})`).join(", ")}.`);
  }
  if (dayTickets.length) parts.push(`Tickets resueltos ese dia: ${ticketList(dayTickets)}.`);
  return parts.join(" ") || "Sin detalle tecnico registrado en el sistema.";
}

// Tabla con filas de alto variable: pdfTable recorta cada celda a una linea y aqui la justificacion necesita varias.
function wrappedTable(pdf, { columns, rows, emptyLabel }) {
  const startX = pdf.page.margins.left;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const cell = (col) => ({ width: col.width - 6, align: col.align || "left" });
  const drawHeader = () => {
    const y = pdf.y;
    pdf.rect(startX, y, tableWidth, 18).fill(HEADER_BAR);
    pdf.fontSize(8).font("Helvetica-Bold").fillColor("#FFFFFF");
    let x = startX;
    columns.forEach((col) => { pdf.text(col.label, x + 3, y + 5, { ...cell(col), lineBreak: false }); x += col.width; });
    pdf.y = y + 18;
  };

  if (!rows.length) { writeLine(pdf, emptyLabel, { color: MUTED }); return; }
  drawHeader();
  rows.forEach((row, idx) => {
    pdf.fontSize(8).font("Helvetica");
    const height = Math.max(...columns.map((col) => pdf.heightOfString(String(row[col.key] ?? "-"), cell(col)))) + 8;
    if (pdf.y + height > pdf.page.height - pdf.page.margins.bottom) { pdf.addPage(); drawHeader(); pdf.fontSize(8).font("Helvetica"); }
    const y = pdf.y;
    if (idx % 2 === 1) pdf.rect(startX, y, tableWidth, height).fill(LIGHT);
    let x = startX;
    columns.forEach((col) => { pdf.fillColor(SLATE).text(String(row[col.key] ?? "-"), x + 3, y + 4, cell(col)); x += col.width; });
    pdf.y = y + height;
  });
  pdfResetX(pdf);
}

function writeLine(pdf, text, { bold = false, color = SLATE, size = 9 } = {}) {
  pdfEnsureSpace(pdf, 16);
  pdfResetX(pdf);
  pdf.fontSize(size).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(color).text(text);
}

function buildPdfBuffer({ user, period, model }) {
  const pdf = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const generatedAt = new Date().toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: TIMEZONE });
  const { totals } = model;
  const summaryRow = (concept, seconds, days, sign = "") => ({
    concept,
    hours: seconds ? `${sign}${hoursLabel(seconds)}` : "0h 00m",
    decimal: seconds ? `${sign}${decimalHours(seconds)}` : "0,00",
    days,
  });

  drawBrandHeader(pdf, `Horas extras - ${period.label} - generado ${generatedAt}`);
  writeLine(pdf, user.fullname || user.email, { bold: true, color: NAVY, size: 13 });
  writeLine(pdf, `Mes calendario completo. Jornada: lunes a viernes de ${clock(WORKDAY_START_MIN)} a ${clock(WORKDAY_END_MIN)}.`, { color: MUTED, size: 8 });
  pdf.moveDown(0.6);

  pdfTable(pdf, {
    columns: [
      { key: "concept", label: "Concepto", width: 285 },
      { key: "hours", label: "Horas", width: 80, align: "right" },
      { key: "decimal", label: "Decimal", width: 70, align: "right" },
      { key: "days", label: "Dias", width: 50, align: "right" },
    ],
    rows: [
      summaryRow("Horas extras por sistema (marcacion en jornada normal)", totals.systemSeconds, totals.systemDays),
      summaryRow("Horas extras declaradas (salida operacional o teletrabajo)", totals.declaredSeconds, totals.declaredDays),
      summaryRow("Atrasos no justificados", totals.lateSeconds, totals.lateDays, "-"),
      summaryRow("TOTAL NETO", totals.netSeconds, totals.systemDays + totals.declaredDays),
    ],
    emptyLabel: "-",
  });
  pdf.moveDown(0.6);

  writeLine(pdf, `Marcaciones normales - ${hoursLabel(totals.systemSeconds)}`, { bold: true, color: NAVY, size: 10 });
  pdf.moveDown(0.2);
  wrappedTable(pdf, {
    columns: [
      { key: "date", label: "Fecha", width: 55 },
      { key: "entry", label: "Entrada", width: 45 },
      { key: "exit", label: "Salida", width: 45 },
      { key: "extra", label: "Extra", width: 50, align: "right" },
      { key: "late", label: "Atraso", width: 50, align: "right" },
      { key: "technical", label: "Justificacion tecnica", width: 517 },
    ],
    rows: model.rows.filter((row) => !row.declared),
    emptyLabel: "Sin horas extras ni atrasos no justificados en marcaciones normales.",
  });
  pdf.moveDown(0.8);

  writeLine(pdf, `Salidas operacionales - ${hoursLabel(totals.declaredSeconds)}`, { bold: true, color: NAVY, size: 10 });
  pdf.moveDown(0.2);
  wrappedTable(pdf, {
    columns: [
      { key: "date", label: "Fecha", width: 55 },
      { key: "entry", label: "Inicio", width: 45 },
      { key: "exit", label: "Cierre", width: 60 },
      { key: "extra", label: "Extra", width: 50, align: "right" },
      { key: "basis", label: "Destino / motivo", width: 180 },
      { key: "technical", label: "Justificacion tecnica", width: 372 },
    ],
    rows: model.rows.filter((row) => row.declared),
    emptyLabel: "Sin salidas operacionales con horas extras en el periodo.",
  });

  if (model.notes.length) {
    pdf.moveDown(0.4);
    writeLine(pdf, "Observaciones", { bold: true, color: NAVY, size: 10 });
    model.notes.forEach((text) => writeLine(pdf, `- ${text}`, { size: 8 }));
  }

  return streamPdfToBuffer(pdf);
}

async function generateOvertimeJustificationReport({ email, year, month }) {
  const period = resolvePeriod({ year, month });
  const { user, ...data } = await fetchReportData({ email, period });
  const model = buildReportModel(data);
  const buffer = await buildPdfBuffer({ user, period, model });
  const safeName = String(user.fullname || user.email).normalize("NFD").replace(/[^\w ]/g, "").trim().replace(/\s+/g, "_");
  return {
    buffer,
    fileName: `Horas_extras_${period.key}_${safeName}.pdf`,
    period,
    user,
    totals: model.totals,
  };
}

module.exports = {
  generateOvertimeJustificationReport,
  __private: { buildReportModel, offHoursSeconds, resolvePeriod },
};
