/**
 * TI Assets — Maintenance Schedule Report Generator
 * Produces a complete PDF informe del cronograma de mantenimientos,
 * computes SHA-256, uploads to Drive, and persists metadata in DB.
 */

const PDFDocument = require("pdfkit");
const { Readable } = require("stream");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const { uploadBase64File, ensureFolder } = require("../../utils/drive");

const REPORT_FOLDER_NAME = "Cronogramas TI Mantenimiento";

const STATUS_ES = {
  pending: "Pendiente",
  completed: "Completado",
  overdue: "Vencido",
  in_maintenance: "En mantenimiento",
};

const ASSET_STATUS_ES = {
  unassigned: "Sin asignar",
  assigned: "Asignado",
  damaged: "Dañado",
  in_maintenance: "En mantenimiento",
  retired: "Dado de baja",
  available: "Disponible",
};

// ─── DB schema ────────────────────────────────────────────────────────────────

async function ensureReportsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_maintenance_reports (
      id BIGSERIAL PRIMARY KEY,
      period TEXT NOT NULL,
      sha256 VARCHAR(64) NOT NULL,
      drive_file_id TEXT,
      drive_url TEXT,
      file_size_bytes INTEGER,
      assets_count INTEGER,
      schedules_count INTEGER,
      generated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_ti_maintenance_reports_generated_at
       ON public.ti_maintenance_reports(generated_at DESC)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_ti_maintenance_reports_period
       ON public.ti_maintenance_reports(period)`
  );
}

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

function normalizeReportPeriod({ year, month, periodType = "annual" } = {}) {
  const safePeriodType = String(periodType || "annual").toLowerCase() === "monthly" ? "monthly" : "annual";
  const safeYear = Number(year || new Date().getFullYear());
  const safeMonth = safePeriodType === "monthly" ? Number(month || (new Date().getMonth() + 1)) : null;
  const period = safePeriodType === "monthly" ? `${safeYear}-${String(safeMonth).padStart(2, "0")}` : String(safeYear);
  const periodLabel = safePeriodType === "monthly" ? `Mes ${period}` : `Año ${safeYear}`;
  return { safePeriodType, safeYear, safeMonth, period, periodLabel };
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchReportData({ year, month, periodType = "annual" } = {}) {
  // Assets
  const { rows: assets } = await db.query(
    `SELECT a.id, a.name, a.brand, a.model, a.serial_number, a.status,
            a.characteristics, a.purchase_date, a.maintenance_frequency_months,
            COALESCE(u.fullname, u.name, u.email) AS assigned_to_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
      WHERE a.active = true
      ORDER BY a.name ASC`
  );

  // Schedules
  let wherePeriod = "";
  let params = [];
  if (String(periodType) === "monthly") {
    wherePeriod = `AND EXTRACT(YEAR FROM m.planned_date) = $1 AND EXTRACT(MONTH FROM m.planned_date) = $2`;
    params = [Number(year), Number(month)];
  } else {
    wherePeriod = year ? `AND m.year = $1` : "";
    params = year ? [Number(year)] : [];
  }
  const { rows: schedules } = await db.query(
    `SELECT m.id, m.asset_id, m.planned_date, m.max_due_date,
            m.coordinated_withdrawal_date, m.status, m.notes, m.completed_at,
            a.name AS asset_name
       FROM public.ti_asset_maintenance_schedule m
       JOIN public.ti_assets a ON a.id = m.asset_id
      WHERE a.active = true ${wherePeriod}
      ORDER BY m.planned_date ASC`,
    params
  );

  // Stats
  const stats = {
    total: schedules.length,
    pending: schedules.filter((s) => s.status === "pending").length,
    completed: schedules.filter((s) => s.status === "completed").length,
    overdue: schedules.filter((s) => s.status === "overdue").length,
  };

  // Group schedules by asset_id
  const schedulesByAsset = {};
  schedules.forEach((s) => {
    if (!schedulesByAsset[s.asset_id]) schedulesByAsset[s.asset_id] = [];
    schedulesByAsset[s.asset_id].push(s);
  });

  return { assets, schedules, schedulesByAsset, stats };
}

// ─── PDF builder ───────────────────────────────────────────────────────────────

function fmtDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val).slice(0, 19).replace("T", " ");
  return d.toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function drawHRule(doc, color = "#e2e8f0") {
  const { x, y } = doc;
  doc.save().strokeColor(color).lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke().restore();
  doc.moveDown(0.3);
}

function buildPdf({ assets, schedulesByAsset, stats, periodLabel, generatedAt, generatedByName, sha256Placeholder }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_W = 515; // usable width (595 - 2*40)
    const period = periodLabel || "Todos los periodos";
    const generatedAtStr = fmtDateTime(generatedAt);

    // ── Cover / Header ──────────────────────────────────────────────────────
    doc.rect(40, 40, PAGE_W, 70).fill("#0f172a");
    doc
      .fillColor("#ffffff")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Cronograma de Mantenimiento TI", 50, 55, { width: PAGE_W - 20 });
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text(`Período: ${period}   ·   Generado: ${generatedAtStr}`, 50, 82, { width: PAGE_W - 20 });
    if (generatedByName) {
      doc.text(`Por: ${generatedByName}`, 50, 96, { width: PAGE_W - 20 });
    }

    doc.fillColor("#0f172a").moveDown(2.5);

    // ── Summary stats ───────────────────────────────────────────────────────
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("Resumen");
    drawHRule(doc);

    const statCols = [
      { label: "Equipos activos", value: assets.length },
      { label: "Total cronogramas", value: stats.total },
      { label: "Pendientes", value: stats.pending },
      { label: "Completados", value: stats.completed },
      { label: "Vencidos", value: stats.overdue },
    ];
    const sw = PAGE_W / statCols.length;
    const sy = doc.y;
    statCols.forEach((st, i) => {
      const sx = 40 + i * sw;
      doc.rect(sx + 2, sy, sw - 4, 44).fill(i % 2 === 0 ? "#f8fafc" : "#f1f5f9");
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#0f172a").text(String(st.value), sx + 2, sy + 4, { width: sw - 4, align: "center" });
      doc.fontSize(8).font("Helvetica").fillColor("#64748b").text(st.label, sx + 2, sy + 30, { width: sw - 4, align: "center" });
    });
    doc.y = sy + 54;
    doc.moveDown(1);

    // ── Per-asset sections ─────────────────────────────────────────────────
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("Detalle por equipo");
    drawHRule(doc);

    assets.forEach((asset) => {
      const assetSchedules = schedulesByAsset[asset.id] || [];

      // Asset card header
      if (doc.y > 680) doc.addPage();

      doc.rect(40, doc.y, PAGE_W, 20).fill("#1e293b");
      doc
        .fillColor("#ffffff")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(asset.name, 46, doc.y + 4, { width: PAGE_W / 2, continued: true })
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#94a3b8")
        .text(
          `${ASSET_STATUS_ES[asset.status] || asset.status}  ·  ${asset.brand || "-"} ${asset.model || "-"}`,
          { align: "right", width: PAGE_W / 2 - 6 }
        );
      doc.y += 24;

      // Asset info row
      const infoY = doc.y;
      const infoCols = [
        ["Serie", asset.serial_number || "-"],
        ["Asignado a", asset.assigned_to_name || "Sin asignación"],
        ["Fecha compra", fmtDate(asset.purchase_date)],
        ["Frec. (meses)", String(asset.maintenance_frequency_months || 12)],
      ];
      const iw = PAGE_W / infoCols.length;
      infoCols.forEach(([label, val], i) => {
        const ix = 40 + i * iw;
        doc.fontSize(7).font("Helvetica").fillColor("#64748b").text(label, ix, infoY, { width: iw });
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(val, ix, infoY + 10, { width: iw });
      });
      doc.y = infoY + 28;

      if (!assetSchedules.length) {
        doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text("Sin cronograma registrado", 46, doc.y);
        doc.moveDown(0.8);
        return;
      }

      // Schedule table header
      const colW = [95, 95, 105, 80, 140];
      const colX = [
        40,
        40 + colW[0],
        40 + colW[0] + colW[1],
        40 + colW[0] + colW[1] + colW[2],
        40 + colW[0] + colW[1] + colW[2] + colW[3],
      ];
      const headers = ["Fecha planificada", "Fecha máxima", "Coord. retiro", "Estado", "Notas"];

      doc.rect(40, doc.y, PAGE_W, 18).fill("#e2e8f0");
      const hy = doc.y + 3;
      headers.forEach((h, i) => {
        doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#334155").text(h, colX[i] + 2, hy, { width: colW[i] - 4 });
      });
      doc.y = hy + 15;

      assetSchedules.forEach((s, idx) => {
        if (doc.y > 725) doc.addPage();
        const rowY = doc.y;
        if (idx % 2 === 1) doc.rect(40, rowY, PAGE_W, 18).fill("#f8fafc");

        const statusColor = s.status === "completed" ? "#16a34a" : s.status === "overdue" ? "#dc2626" : "#334155";
        const rowValues = [
          fmtDate(s.planned_date),
          fmtDate(s.max_due_date),
          fmtDate(s.coordinated_withdrawal_date),
          STATUS_ES[s.status] || s.status,
          s.notes ? String(s.notes).slice(0, 40) : "-",
        ];
        rowValues.forEach((v, i) => {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor(i === 3 ? statusColor : "#334155")
            .text(v, colX[i] + 2, rowY + 3, { width: colW[i] - 4, lineBreak: false, ellipsis: true });
        });
        doc.y = rowY + 18;
      });

      doc.moveDown(0.6);
    });

    // ── Footer / Integrity block ──────────────────────────────────────────
    doc.addPage();
    doc.rect(40, 40, PAGE_W, 80).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text("Integridad del documento", 50, 50, { width: PAGE_W - 20 });
    doc.fontSize(8).font("Helvetica").fillColor("#94a3b8")
      .text("El siguiente hash SHA-256 identifica de forma única este informe. Cualquier modificación al archivo altera el hash.", 50, 68, { width: PAGE_W - 20 });
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#60a5fa")
      .text(sha256Placeholder || "(hash se calcula al generar el buffer final)", 50, 86, { width: PAGE_W - 20 });

    doc.y = 140;
    doc.fontSize(9).fillColor("#64748b").font("Helvetica")
      .text(`Generado automáticamente por el sistema FAM SPI`, 40, doc.y, { align: "center", width: PAGE_W })
      .text(`${generatedAtStr}  ·  ${period}`, { align: "center", width: PAGE_W });

    // Page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text(`Página ${i + 1} de ${pageCount}  ·  FAM SPI Cronograma TI`, 40, 820, {
          width: PAGE_W,
          align: "center",
          lineBreak: false,
        });
    }

    doc.end();
  });
}

// ─── Main generate function ────────────────────────────────────────────────────

async function generateAndStoreMaintenanceReport({ year, month, periodType = "annual", userId, generatedByName, rootFolderId } = {}) {
  await ensureReportsTable();

  const { safePeriodType, safeYear, safeMonth, period, periodLabel } = normalizeReportPeriod({
    year,
    month,
    periodType,
  });
  const generatedAt = new Date();

  const { assets, schedulesByAsset, stats } = await fetchReportData({ year: safeYear, month: safeMonth, periodType: safePeriodType });

  // Generate PDF buffer (placeholder hash first pass)
  const pdfBuffer = await buildPdf({
    assets,
    schedulesByAsset,
    stats,
    periodLabel,
    generatedAt,
    generatedByName,
    sha256Placeholder: null,
  });

  const sha256 = computeSha256HexFromBuffer(pdfBuffer);
  const fileSizeBytes = pdfBuffer.length;

  // Persist report record (one current row per period; update latest, delete duplicates)
  const { rows: existingRows } = await db.query(
    `SELECT id, drive_file_id
       FROM public.ti_maintenance_reports
      WHERE period = $1
      ORDER BY generated_at DESC, id DESC`,
    [period],
  );
  const previousDriveFileId = existingRows[0]?.drive_file_id || null;

  // Upload/update in Drive
  let driveFileId = null;
  let driveUrl = null;
  try {
    const folderParent = rootFolderId || process.env.DRIVE_ROOT_FOLDER_ID;
    let folderId = null;
    if (folderParent) {
      const folder = await ensureFolder(REPORT_FOLDER_NAME, folderParent);
      folderId = folder?.id || null;
    }

    const filename = `Cronograma_TI_${safePeriodType}_${period}.pdf`;
    if (previousDriveFileId) {
      const { data: updated } = await drive.files.update({
        fileId: previousDriveFileId,
        supportsAllDrives: true,
        requestBody: {
          name: filename,
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType: "application/pdf",
          body: bufferToStream(pdfBuffer),
        },
        fields: "id, name, webViewLink, webContentLink",
      });
      driveFileId = updated?.id || null;
      driveUrl = updated?.webViewLink || updated?.webContentLink || null;
    } else {
      const base64 = pdfBuffer.toString("base64");
      const uploaded = await uploadBase64File(filename, base64, "application/pdf", folderId);
      driveFileId = uploaded?.id || null;
      driveUrl = uploaded?.webViewLink || uploaded?.webContentLink || null;
    }
  } catch (driveErr) {
    logger.warn({ driveErr }, "[TI REPORT] Drive upload failed, storing metadata only");
  }

  let record = null;
  if (existingRows.length) {
    const keepId = existingRows[0].id;
    await db.query(
      `UPDATE public.ti_maintenance_reports
          SET sha256 = $1,
              drive_file_id = $2,
              drive_url = $3,
              file_size_bytes = $4,
              assets_count = $5,
              schedules_count = $6,
              generated_by = $7,
              generated_at = $8,
              metadata = $9::jsonb
        WHERE id = $10`,
      [
        sha256,
        driveFileId,
        driveUrl,
        fileSizeBytes,
        assets.length,
        stats.total,
        userId || null,
        generatedAt,
        JSON.stringify({ stats, period_type: safePeriodType, year: safeYear, month: safeMonth }),
        keepId,
      ],
    );
    await db.query(`DELETE FROM public.ti_maintenance_reports WHERE period = $1 AND id <> $2`, [period, keepId]);
    const { rows } = await db.query(`SELECT * FROM public.ti_maintenance_reports WHERE id = $1 LIMIT 1`, [keepId]);
    record = rows[0] || null;
  } else {
    const { rows } = await db.query(
      `INSERT INTO public.ti_maintenance_reports
         (period, sha256, drive_file_id, drive_url, file_size_bytes,
          assets_count, schedules_count, generated_by, generated_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       RETURNING *`,
      [
        period,
        sha256,
        driveFileId,
        driveUrl,
        fileSizeBytes,
        assets.length,
        stats.total,
        userId || null,
        generatedAt,
        JSON.stringify({ stats, period_type: safePeriodType, year: safeYear, month: safeMonth }),
      ]
    );
    record = rows[0];
  }

  logger.info({ reportId: record.id, sha256, period }, "[TI REPORT] Generated successfully");

  return { ...record, sha256, drive_url: driveUrl, pdfBuffer };
}

async function listReports({ limit = 50 } = {}) {
  await ensureReportsTable();
  const { rows } = await db.query(
    `SELECT DISTINCT ON (r.period)
            r.id, r.period, r.sha256, r.drive_file_id, r.drive_url,
            r.file_size_bytes, r.assets_count, r.schedules_count,
            r.generated_at, r.metadata,
            COALESCE(u.fullname, u.name, u.email) AS generated_by_name
       FROM public.ti_maintenance_reports r
       LEFT JOIN public.users u ON u.id = r.generated_by
      ORDER BY r.period, r.generated_at DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getReportByPeriod({ year, month, periodType = "annual" } = {}) {
  await ensureReportsTable();
  const { period } = normalizeReportPeriod({ year, month, periodType });
  const { rows } = await db.query(
    `SELECT *
       FROM public.ti_maintenance_reports
      WHERE period = $1
      ORDER BY generated_at DESC, id DESC
      LIMIT 1`,
    [period],
  );
  return rows[0] || null;
}

async function downloadReportPdfFromDrive({ year, month, periodType = "annual" } = {}) {
  const report = await getReportByPeriod({ year, month, periodType });
  if (!report?.drive_file_id) return null;
  const response = await drive.files.get(
    { fileId: report.drive_file_id, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return {
    report,
    pdfBuffer: Buffer.from(response.data),
  };
}

module.exports = {
  generateAndStoreMaintenanceReport,
  listReports,
  ensureReportsTable,
  getReportByPeriod,
  downloadReportPdfFromDrive,
};


