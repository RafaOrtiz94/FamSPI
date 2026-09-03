/**
 * Collab Deliveries — PDF Report Generator
 * Produces sealed PDF with SHA-256 for general or per-collaborator reports.
 */

const PDFDocument = require("pdfkit");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const { _REPORT_QUERY } = require("./collabDeliveries.service");
const db = require("../../config/db");

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CAT_ES = {
  ropa: "Ropa de trabajo", epp: "EPP", herramienta: "Herramienta de trabajo",
  logistica: "Logística", ti: "Activos TI", suministros: "Suministros", poliza: "Póliza de seguro",
};
const STATUS_ES = { entregado: "Entregado", retirado: "Retirado", perdido: "Perdido", dañado: "Dañado" };

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? "-" : d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Guayaquil" });
}

function fmtDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? "-" : d.toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });
}

function drawHRule(doc, color = "#e2e8f0") {
  const y = doc.y;
  doc.save().strokeColor(color).lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke().restore();
  doc.moveDown(0.3);
}

// ─── PDF builder ───────────────────────────────────────────────────────────────

function buildPdf({ groups, title, subtitle, generatedAt, generatedByName, sha256 }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = 515;
    const generatedAtStr = fmtDateTime(generatedAt);
    const collaboratorCount = Object.keys(groups).length;
    const totalItems = Object.values(groups).reduce((a, g) => a + g.rows.length, 0);

    // ── Cover header ─────────────────────────────────────────────────────────
    doc.rect(40, 40, PW, 80).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(17).font("Helvetica-Bold")
      .text(title, 50, 52, { width: PW - 20 });
    if (subtitle) {
      doc.fontSize(10).font("Helvetica").fillColor("#94a3b8")
        .text(subtitle, 50, 76, { width: PW - 20 });
    }
    doc.fontSize(9).font("Helvetica").fillColor("#64748b")
      .text(`Generado: ${generatedAtStr}${generatedByName ? `  ·  Por: ${generatedByName}` : ""}`, 50, subtitle ? 92 : 76, { width: PW - 20 });
    doc.fillColor("#0f172a").y = 135;
    doc.moveDown(0.5);

    // ── Summary ──────────────────────────────────────────────────────────────
    const statCols = [
      { label: "Colaboradores", value: collaboratorCount },
      { label: "Ítems entregados", value: totalItems },
    ];
    const sw = PW / statCols.length;
    const sy = doc.y;
    statCols.forEach((st, i) => {
      const sx = 40 + i * sw;
      doc.rect(sx + 2, sy, sw - 4, 42).fill(i % 2 === 0 ? "#f8fafc" : "#f1f5f9");
      doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f172a").text(String(st.value), sx + 2, sy + 4, { width: sw - 4, align: "center" });
      doc.fontSize(8).font("Helvetica").fillColor("#64748b").text(st.label, sx + 2, sy + 30, { width: sw - 4, align: "center" });
    });
    doc.y = sy + 52;
    doc.moveDown(1);

    // ── Per-collaborator sections ─────────────────────────────────────────────
    const COL_W = [130, 65, 65, 65, 85, 65, 40];
    const COL_X = COL_W.reduce((acc, w, i) => { acc.push((acc[i - 1] || 40) + (i > 0 ? COL_W[i - 1] : 0)); return acc; }, []);
    const COL_HDR = ["Ítem", "Categoría", "Estado", "Entrega", "Retiro / Fecha", "Acta", "Firmada"];

    Object.values(groups).forEach((group) => {
      if (doc.y > 650) doc.addPage();

      // Collaborator header bar
      doc.rect(40, doc.y, PW, 22).fill("#1e293b");
      const hy = doc.y + 5;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff")
        .text(group.name, 46, hy, { width: PW / 2, continued: true })
        .font("Helvetica").fontSize(8).fillColor("#94a3b8")
        .text(group.email || "", { align: "right", width: PW / 2 - 6 });
      doc.y += 26;

      // Table header
      doc.rect(40, doc.y, PW, 16).fill("#e2e8f0");
      const thY = doc.y + 3;
      COL_HDR.forEach((h, i) => {
        doc.fontSize(7).font("Helvetica-Bold").fillColor("#334155")
          .text(h, COL_X[i] + 2, thY, { width: COL_W[i] - 4, lineBreak: false });
      });
      doc.y = thY + 13;

      // Rows
      group.rows.forEach((r, idx) => {
        if (doc.y > 740) doc.addPage();
        const rowY = doc.y;
        if (idx % 2 === 1) doc.rect(40, rowY, PW, 16).fill("#f8fafc");
        const vals = [
          (r.item_name || "-").slice(0, 22),
          CAT_ES[r.category] || r.category || "-",
          STATUS_ES[r.status] || r.status || "-",
          fmtDate(r.delivery_date),
          r.retiro_at ? fmtDate(r.retiro_at) : (r.renewal_date ? `Renov: ${fmtDate(r.renewal_date)}` : "-"),
          (r.acta_code || "-").slice(0, 14),
          r.acta_firmada_at ? "Sí" : "No",
        ];
        vals.forEach((v, i) => {
          const color = i === 6
            ? (v === "Sí" ? "#16a34a" : "#dc2626")
            : i === 2
              ? (r.status === "retirado" ? "#94a3b8" : "#334155")
              : "#334155";
          doc.fontSize(7.5).font("Helvetica").fillColor(color)
            .text(v, COL_X[i] + 2, rowY + 3, { width: COL_W[i] - 4, lineBreak: false, ellipsis: true });
        });
        doc.y = rowY + 16;

        // Serial / talla / observations sub-row
        const _attrs = (typeof r.attributes === "object" && r.attributes) ? r.attributes : {};
        const tallaStr = r.category === "ropa" && (_attrs.talla || _attrs.cantidad)
          ? [_attrs.talla ? `Talla: ${_attrs.talla}` : "", _attrs.cantidad ? `Cant.: ${_attrs.cantidad}` : ""].filter(Boolean).join("  ·  ")
          : "";
        if (r.serial_number || r.observations || tallaStr) {
          const sub = [
            r.serial_number ? `Serie: ${r.serial_number}` : "",
            tallaStr,
            r.observations ? `Obs: ${String(r.observations).slice(0, 60)}` : "",
          ].filter(Boolean).join("  ·  ");
          doc.fontSize(6.5).font("Helvetica").fillColor("#94a3b8")
            .text(sub, 46, doc.y, { width: PW - 12, lineBreak: false });
          doc.y += 10;
        }
      });
      doc.moveDown(0.8);
    });

    // ── Integrity seal page ───────────────────────────────────────────────────
    doc.addPage();
    doc.rect(40, 40, PW, 100).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold")
      .text("Sello de Integridad del Documento", 50, 52, { width: PW - 20 });
    doc.fontSize(8.5).font("Helvetica").fillColor("#94a3b8")
      .text("Hash SHA-256 calculado sobre el contenido generado. Cualquier modificación invalida este sello.", 50, 72, { width: PW - 20 });
    doc.fontSize(9).font("Courier-Bold").fillColor("#60a5fa")
      .text(sha256 || "(hash pendiente)", 50, 90, { width: PW - 20 });

    doc.y = 160;
    doc.fontSize(9).font("Helvetica").fillColor("#64748b")
      .text("Este reporte fue generado automáticamente por el sistema FAM SPI.", 40, doc.y, { align: "center", width: PW })
      .text(`Generado el ${generatedAtStr}`, { align: "center", width: PW });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("#94a3b8")
      .text("Algoritmo: SHA-256  ·  Sistema: FAM SPI Entregas a Colaboradores", 40, doc.y, { align: "center", width: PW });

    // Page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text(`Página ${i + 1} de ${pageCount}  ·  FAM SPI — Entregas a Colaboradores`, 40, 820, {
          width: PW, align: "center", lineBreak: false,
        });
    }

    doc.end();
  });
}

// ─── TI assets query ──────────────────────────────────────────────────────────

const _TI_REPORT_QUERY = (whereExtra = "") => `
  SELECT
    COALESCE(a.recipient_user_id, a.previous_user_id)       AS user_id,
    COALESCE(ur.fullname, ur.name, ur.email,
             up.fullname, up.name, up.email)                AS colaborador,
    COALESCE(ur.email, up.email)                            AS email,
    COALESCE(ur.role, up.role)                              AS role,
    a.id                                                    AS delivery_id,
    'ti'::text                                              AS category,
    CASE WHEN a.tipo = 'entrega' THEN 'entregado' ELSE 'retirado' END AS status,
    CASE
      WHEN a.acta_year IS NOT NULL AND a.acta_month IS NOT NULL AND a.acta_day IS NOT NULL
      THEN MAKE_DATE(a.acta_year, a.acta_month, a.acta_day)
      ELSE a.generated_at::date
    END                                                     AS delivery_date,
    COALESCE(ai.serial_imei, ast.serial_number)             AS serial_number,
    ai.physical_condition,
    COALESCE(ast.characteristics, '{}'::jsonb)              AS attributes,
    COALESCE(ai.observations, a.notes)                      AS observations,
    NULL::date                                              AS renewal_date,
    COALESCE(ai.name, ast.name, '(Equipo TI)')              AS item_name,
    NULL::jsonb                                             AS item_attribute_schema,
    a.generated_at::date                                    AS session_date,
    a.tipo                                                  AS session_tipo,
    a.acta_code,
    a.tipo                                                  AS acta_tipo,
    a.signed_at                                             AS acta_firmada_at,
    CASE WHEN a.acta_day IS NOT NULL
         THEN (a.acta_day || '/' || a.acta_month || '/' || a.acta_year)
         ELSE NULL END                                      AS acta_fecha,
    CASE WHEN a.tipo = 'retiro' THEN a.generated_at ELSE NULL END AS retiro_at
  FROM public.ti_asset_actas a
  LEFT JOIN public.ti_asset_actas_items ai  ON ai.acta_id = a.id
  LEFT JOIN public.ti_assets ast            ON ast.id = COALESCE(ai.asset_id, a.asset_id)
  LEFT JOIN public.users ur                 ON ur.id = a.recipient_user_id
  LEFT JOIN public.users up                 ON up.id = a.previous_user_id
  WHERE a.active = true
    AND COALESCE(a.recipient_user_id, a.previous_user_id) IS NOT NULL
    ${whereExtra}
  ORDER BY COALESCE(ur.fullname, ur.name, ur.email,
                    up.fullname, up.name, up.email), a.generated_at
`;

// ─── Group rows by collaborator ────────────────────────────────────────────────

function groupByCollaborator(rows) {
  const groups = {};
  for (const r of rows) {
    const key = r.user_id;
    if (!groups[key]) {
      groups[key] = {
        name: r.colaborador || r.email || `Usuario #${r.user_id}`,
        email: r.email || "",
        rows: [],
      };
    }
    groups[key].rows.push(r);
  }
  // Sort rows within each group: category then delivery_date
  Object.values(groups).forEach((g) => {
    g.rows.sort((a, b) => {
      const catA = a.category || ""; const catB = b.category || "";
      if (catA !== catB) return catA.localeCompare(catB);
      return new Date(a.delivery_date || 0) - new Date(b.delivery_date || 0);
    });
  });
  return groups;
}

async function fetchAllRows(whereCollabExtra = "", whereCollabParams = [], whereTiExtra = "", whereTiParams = []) {
  const [collabResult, tiResult] = await Promise.all([
    db.query(_REPORT_QUERY(whereCollabExtra), whereCollabParams),
    db.query(_TI_REPORT_QUERY(whereTiExtra), whereTiParams),
  ]);
  return [...collabResult.rows, ...tiResult.rows];
}

// ─── Public API ────────────────────────────────────────────────────────────────

async function generateFullReportPdf({ generatedByName } = {}) {
  const rows = await fetchAllRows();
  const groups = groupByCollaborator(rows);
  const generatedAt = new Date();

  // First pass — placeholder hash
  const pdfBuf = await buildPdf({
    groups,
    title: "Reporte General de Entregas a Colaboradores",
    subtitle: null,
    generatedAt,
    generatedByName,
    sha256: null,
  });

  const sha256 = computeSha256HexFromBuffer(pdfBuf);

  // Second pass — embed real hash
  const finalBuf = await buildPdf({
    groups,
    title: "Reporte General de Entregas a Colaboradores",
    subtitle: null,
    generatedAt,
    generatedByName,
    sha256,
  });

  return { buffer: finalBuf, sha256: computeSha256HexFromBuffer(finalBuf), filename: `reporte_general_entregas_${new Date().toISOString().slice(0, 10)}.pdf` };
}

async function generateCollaboratorReportPdf(userId, { generatedByName } = {}) {
  const rows = await fetchAllRows(
    "AND d.user_id = $1", [userId],
    "AND COALESCE(a.recipient_user_id, a.previous_user_id) = $1", [userId],
  );
  if (!rows.length) {
    const err = new Error("Sin entregas para este colaborador");
    err.status = 404;
    throw err;
  }

  const collab = rows[0];
  const collaboratorName = collab.colaborador || collab.email || `Usuario #${userId}`;
  const groups = groupByCollaborator(rows);
  const generatedAt = new Date();

  const pdfBuf = await buildPdf({
    groups,
    title: `Reporte de Entregas — ${collaboratorName}`,
    subtitle: collab.email || null,
    generatedAt,
    generatedByName,
    sha256: null,
  });

  const sha256 = computeSha256HexFromBuffer(pdfBuf);

  const finalBuf = await buildPdf({
    groups,
    title: `Reporte de Entregas — ${collaboratorName}`,
    subtitle: collab.email || null,
    generatedAt,
    generatedByName,
    sha256,
  });

  const safeName = collaboratorName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "").replace(/\s+/g, "_").toLowerCase();
  return {
    buffer: finalBuf,
    sha256: computeSha256HexFromBuffer(finalBuf),
    filename: `reporte_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`,
    collaboratorName,
  };
}

module.exports = { generateFullReportPdf, generateCollaboratorReportPdf };
