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
            a.custody_type, a.client_id,
            COALESCE(cu.fullname, cu.name, cu.email, u.fullname, u.name, u.email) AS assigned_to_name,
            COALESCE(c.nombre_comercial, c.razon_social, cr.commercial_name) AS client_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
       LEFT JOIN public.users cu ON cu.id = a.custodian_user_id
       LEFT JOIN public.clients c ON c.id = a.client_id
       LEFT JOIN public.client_requests cr ON cr.id = c.client_request_id
      WHERE a.active = true
      ORDER BY a.custody_type ASC, a.name ASC`
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

function getAssetAudience(asset) {
  if (asset.custody_type === "client") {
    return { key: "clients", title: "Equipos de uso de clientes", owner: asset.client_name || "Cliente sin identificar" };
  }
  if (asset.custody_type === "collaborator") {
    return { key: "collaborators", title: "Equipos de colaboradores", owner: asset.assigned_to_name || "Colaborador sin identificar" };
  }
  return { key: "other", title: "Equipos en custodia interna", owner: "Bodega, préstamo o disponibilidad" };
}

function buildPdf({ assets, schedulesByAsset, stats, periodLabel, generatedAt, generatedByName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape", bufferPages: true, autoFirstPage: false });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_WIDTH = 841.89;
    const PAGE_HEIGHT = 595.28;
    const LEFT = 36;
    const RIGHT = 36;
    const CONTENT_W = PAGE_WIDTH - LEFT - RIGHT;
    const CONTENT_BOTTOM = PAGE_HEIGHT - 65;
    const period = periodLabel || "Todos los periodos";
    const generatedAtStr = fmtDateTime(generatedAt);

    const addPage = (sectionTitle = null) => {
      doc.addPage();
      doc.rect(0, 0, PAGE_WIDTH, 58).fill("#182838");
      doc.fillColor("#F3F5F7").font("Helvetica-Bold").fontSize(17)
        .text("Cronograma de mantenimiento TI", LEFT, 17, { width: 430 });
      doc.fillColor("#91B5FF").font("Helvetica").fontSize(9)
        .text(`${period}  |  Generado ${generatedAtStr}`, 490, 20, { width: 315, align: "right" });
      doc.y = 78;
      if (sectionTitle) {
        doc.fillColor("#172B3A").font("Helvetica-Bold").fontSize(12).text(sectionTitle, LEFT, doc.y);
        doc.y += 22;
      }
    };

    addPage();
    doc.fillColor("#172B3A").fontSize(9).font("Helvetica")
      .text(`Responsable de generación: ${generatedByName || "Sistema"}`, LEFT, 72, { width: CONTENT_W });
    doc.y = 98;
    doc.fontSize(12).font("Helvetica-Bold").text("Resumen operativo", LEFT, doc.y);
    doc.y += 21;

    const statCols = [
      { label: "Equipos activos", value: assets.length },
      { label: "Total cronogramas", value: stats.total },
      { label: "Pendientes", value: stats.pending },
      { label: "Completados", value: stats.completed },
      { label: "Vencidos", value: stats.overdue },
    ];
    const sw = CONTENT_W / statCols.length;
    const sy = doc.y;
    statCols.forEach((st, i) => {
      const sx = LEFT + i * sw;
      doc.rect(sx, sy, sw, 45).fill("#F3F5F7");
      if (i) doc.moveTo(sx, sy + 8).lineTo(sx, sy + 37).strokeColor("#DCE3E9").lineWidth(0.6).stroke();
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#172B3A").text(String(st.value), sx + 8, sy + 6, { width: sw - 16, align: "center" });
      doc.fontSize(8).font("Helvetica").fillColor("#586A79").text(st.label, sx + 8, sy + 28, { width: sw - 16, align: "center" });
    });
    doc.y = sy + 65;
    doc.font("Helvetica").fontSize(9).fillColor("#586A79")
      .text("El detalle se organiza por tipo de uso. Cada fila conserva sus fechas de mantenimiento planificada y máxima.", LEFT, doc.y);

    const groups = ["collaborators", "clients", "other"].map((key) => ({
      key,
      assets: assets.filter((asset) => getAssetAudience(asset).key === key),
    })).filter((group) => group.assets.length);
    const colW = [190, 125, 105, 82, 82, 90, 95];
    const headers = ["Equipo", "Responsable / cliente", "Serie", "Planificada", "Fecha máxima", "Estado", "Coordinación"];
    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(LEFT, y, CONTENT_W, 22).fill("#263C50");
      let x = LEFT;
      headers.forEach((header, i) => {
        doc.fillColor("#F3F5F7").font("Helvetica-Bold").fontSize(7.5).text(header, x + 5, y + 7, { width: colW[i] - 10, lineBreak: false });
        x += colW[i];
      });
      doc.y = y + 22;
    };

    groups.forEach((group) => {
      const title = getAssetAudience(group.assets[0]).title;
      addPage(title);
      drawTableHeader();
      let rowIndex = 0;
      group.assets.forEach((asset) => {
        const audience = getAssetAudience(asset);
        const assetSchedules = schedulesByAsset[asset.id] || [];
        const rows = assetSchedules.length ? assetSchedules : [null];
        rows.forEach((schedule) => {
          if (doc.y + 27 > CONTENT_BOTTOM) {
            addPage(`${title} (continuación)`);
            drawTableHeader();
          }
          const y = doc.y;
          if (rowIndex % 2) doc.rect(LEFT, y, CONTENT_W, 27).fill("#F3F5F7");
          const status = schedule ? (STATUS_ES[schedule.status] || schedule.status) : "Sin programación";
          const values = [
            `${asset.name || "Equipo sin nombre"}${asset.brand || asset.model ? `\n${[asset.brand, asset.model].filter(Boolean).join(" ")}` : ""}`,
            audience.owner,
            asset.serial_number || "Sin serie",
            schedule ? fmtDate(schedule.planned_date) : "Pendiente",
            schedule ? fmtDate(schedule.max_due_date) : "Pendiente",
            status,
            schedule ? fmtDate(schedule.coordinated_withdrawal_date) : "-",
          ];
          let x = LEFT;
          values.forEach((value, i) => {
            const statusColor = schedule?.status === "completed" ? "#166344" : schedule?.status === "overdue" ? "#B42336" : "#172B3A";
            doc.fillColor(i === 5 ? statusColor : "#172B3A").font(i === 0 || i === 5 ? "Helvetica-Bold" : "Helvetica")
              .fontSize(i === 0 ? 7.6 : 7.3).text(String(value), x + 5, y + 6, { width: colW[i] - 10, height: 17, ellipsis: true });
            x += colW[i];
          });
          doc.moveTo(LEFT, y + 27).lineTo(LEFT + CONTENT_W, y + 27).strokeColor("#DCE3E9").lineWidth(0.4).stroke();
          doc.y = y + 27;
          rowIndex += 1;
        });
      });
    });

    // Page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text(`Página ${i + 1} de ${pageCount}  |  FAM SPI  |  Documento generado automáticamente`, LEFT, PAGE_HEIGHT - 47, {
          width: CONTENT_W,
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
  __testables: { buildPdf, fetchReportData, getAssetAudience, normalizeReportPeriod },
};
