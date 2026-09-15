/**
 * signatureWorkflows.pdf.js
 *
 * Embeds signer visuals on original pages and appends a "Hoja de Validacion
 * de Firma Colectiva" evidence page matching the frontend validation sheet.
 *
 * Exports:
 *   appendSignatureBlock({ sourcePdfBase64, workflow, signers, document, verificationBaseUrl })
 *   -> Promise<string>  base64-encoded final PDF
 */

const { PDFDocument, rgb } = require("pdf-lib");
const QRCode = require("qrcode");
const { loadTimesNewRoman } = require("../../assets/fonts");

// ─── Palette (mirrors signatureValidationSheetPdf.js) ────────────────────────
const C_NAVY  = rgb(0.07, 0.23, 0.37);
const C_WHITE = rgb(1, 1, 1);
const C_BLACK = rgb(0.08, 0.08, 0.08);
const C_GREY  = rgb(0.50, 0.50, 0.50);
const C_LIGHT = rgb(0.78, 0.78, 0.78);
const C_GREEN = rgb(0.05, 0.43, 0.18);
const C_AMBER = rgb(0.62, 0.38, 0.04);
const C_BLUE  = rgb(0.07, 0.40, 0.70);

// Tamaños de fuente (Times New Roman — norma APA)
const FS_TITLE  = 12;
const FS_BODY   = 10;
const FS_SMALL  = 8.5;
const FS_MICRO  = 7.5;
const FS_HASH   = 6.5;

const PW = 595.28;
const PH = 841.89;
const M  = 48;
const CW = PW - M * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safe(text) {
  return String(text || "")
    .replace(/[--]/g, "-")
    .replace(/['']/g, "'")
    .replace(/["]/g, '"')
    .replace(/[^\x00-\xFF]/g, "?");
}

function fmt(value) {
  if (!value) return "N/A";
  try {
    const d = new Date(value);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} (UTC)`;
  } catch { return String(value); }
}

function clip(text, font, size, maxW) {
  let t = safe(text);
  if (!maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  if (t !== safe(text)) t += "...";
  return t;
}

function draw(page, text, opts) {
  const t = clip(text, opts.font, opts.size, opts.maxWidth);
  page.drawText(t, { x: opts.x, y: opts.y, font: opts.font, size: opts.size, color: opts.color });
}

// ─── Main export ──────────────────────────────────────────────────────────────
async function appendSignatureBlock({
  sourcePdfBase64,
  workflow,
  signers = [],
  document: sourceDoc = null,
  verificationBaseUrl = "",
}) {
  try {
    // 1. Load source PDF
    const sourceBytes = Buffer.from(sourcePdfBase64, "base64");
    const pdfDoc = await PDFDocument.load(sourceBytes);

    // 1b. Embed signers' visual signatures at user-chosen coordinates only
    const pdfPages = pdfDoc.getPages();
    const sigW = 110;
    const sigH = 36;

    for (const signer of signers) {
      if (!signer.signature_visual_base64 || !signer.signature_placement) continue;
      try {
        const { page_number, x_pct, y_pct } = signer.signature_placement;
        const pageIndex = Math.max(0, Number(page_number) - 1);
        if (pageIndex >= pdfPages.length) continue;
        const targetPage = pdfPages[pageIndex];
        const { width: pgW, height: pgH } = targetPage.getSize();

        const rawB64 = signer.signature_visual_base64.includes(",")
          ? signer.signature_visual_base64.split(",")[1]
          : signer.signature_visual_base64;
        const imgBytes = Buffer.from(rawB64, "base64");
        const sigImg = await pdfDoc.embedPng(imgBytes);

        const x = Math.min(Math.max(Number(x_pct) * pgW - sigW / 2, 0), pgW - sigW);
        const y = Math.min(Math.max((1 - Number(y_pct)) * pgH - sigH / 2, 0), pgH - sigH);
        targetPage.drawImage(sigImg, { x, y, width: sigW, height: sigH, opacity: 0.88 });
      } catch {
        // skip silently
      }
    }

    // 2. Embed fonts — Times New Roman TTF (norma APA)
    const { bold, reg } = await loadTimesNewRoman(pdfDoc);

    // 3. Add evidence page
    let page = pdfDoc.addPage([PW, PH]);

    // ── QR Code ───────────────────────────────────────────────────────────────
    const verificationToken = workflow.verification_token || null;
    const verificationUrl = verificationToken
      ? `${verificationBaseUrl}/verificar/famsign/${verificationToken}`
      : null;

    let qrImg = null;
    if (verificationUrl) {
      try {
        const qrBuffer = await QRCode.toBuffer(verificationUrl, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 160,
          color: { dark: "#0a1628", light: "#ffffff" },
        });
        qrImg = await pdfDoc.embedPng(qrBuffer);
      } catch { /* QR no critico */ }
    }

    // ── Header ────────────────────────────────────────────────────────────────
    const HEADER_H = 72;
    page.drawRectangle({ x: 0, y: PH - HEADER_H, width: PW, height: HEADER_H, color: C_NAVY });

    const QR_SIZE = 56;
    if (qrImg) {
      page.drawImage(qrImg, {
        x: PW - M - QR_SIZE,
        y: PH - HEADER_H + (HEADER_H - QR_SIZE) / 2,
        width: QR_SIZE,
        height: QR_SIZE,
      });
    }

    page.drawText("HOJA DE VALIDACION DE FIRMA COLECTIVA", {
      x: M, y: PH - 26, font: bold, size: FS_TITLE, color: C_WHITE,
    });
    page.drawText("FamSign - FamSPI", {
      x: M, y: PH - 43, font: reg, size: FS_SMALL, color: rgb(0.75, 0.85, 0.95),
    });
    page.drawText("Este documento acredita la autenticidad e integridad de las firmas electronicas registradas.", {
      x: M, y: PH - 59, font: reg, size: FS_MICRO, color: rgb(0.68, 0.78, 0.90),
    });

    let y = PH - HEADER_H - 22;

    // ── Datos del workflow ─────────────────────────────────────────────────────
    const STATUS_LABELS = {
      completed: "COMPLETADO", rejected: "RECHAZADO", cancelled: "CANCELADO",
      in_progress: "EN PROCESO", partially_signed: "FIRMA PARCIAL", sent: "ENVIADO",
      prepared: "PREPARADO",
    };
    const statusKey = String(workflow.status || "").toLowerCase();
    const statusLabel = STATUS_LABELS[statusKey] || statusKey.toUpperCase();
    const isCompleted = statusKey === "completed";
    const statusColor = isCompleted ? C_GREEN : C_AMBER;

    const codeText = safe(workflow.workflow_code || "");
    draw(page, codeText, { x: M, y, font: bold, size: FS_BODY, color: C_BLACK });
    const codeW = bold.widthOfTextAtSize(codeText, FS_BODY);
    draw(page, statusLabel, { x: M + codeW + 10, y, font: bold, size: FS_SMALL, color: statusColor });

    y -= 16;
    draw(page, workflow.title || "Sin titulo", { x: M, y, font: bold, size: FS_TITLE, color: C_BLACK, maxWidth: CW });
    y -= 15;

    const moduleLabel = `Modulo: ${safe(workflow.source_module || "N/A")}  |  Entidad: ${safe(workflow.source_entity || "N/A")}  |  ID: ${workflow.source_entity_id || "N/A"}`;
    draw(page, moduleLabel, { x: M, y, font: reg, size: FS_SMALL, color: C_GREY, maxWidth: CW });
    y -= 22;

    // Fechas — tres columnas
    const dateColW = CW / 3;
    const dateItems = [
      { label: "Creado:", val: fmt(workflow.created_at) },
      { label: "Completado:", val: fmt(workflow.completed_at) },
      { label: "Expira:", val: fmt(workflow.expires_at) },
    ];
    dateItems.forEach(({ label, val }, i) => {
      const cx = M + i * dateColW;
      draw(page, label, { x: cx, y, font: bold, size: FS_MICRO, color: C_GREY });
      draw(page, val, { x: cx, y: y - 13, font: reg, size: FS_MICRO, color: C_BLACK, maxWidth: dateColW - 4 });
    });
    y -= 30;

    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.75, color: C_LIGHT });
    y -= 18;

    // ── Firmantes ─────────────────────────────────────────────────────────────
    draw(page, "FIRMANTES", { x: M, y, font: bold, size: FS_BODY, color: C_NAVY });
    y -= 15;

    const sorted = [...signers].sort((a, b) => Number(a.sequence_order || 0) - Number(b.sequence_order || 0));

    // Un firmante puede ocupar hasta ~106pt (nombre+badge, cargo, fecha, imagen
    // de firma, hash, separador). Antes, si no cabia en la pagina, el loop
    // simplemente hacia `break` y los firmantes restantes desaparecian de la
    // hoja de validacion. Ahora se agrega una pagina de continuacion.
    const addContinuationPage = () => {
      page = pdfDoc.addPage([PW, PH]);
      draw(page, "FIRMANTES (continuacion)", { x: M, y: PH - M, font: bold, size: FS_BODY, color: C_NAVY });
      return PH - M - 20;
    };

    for (const signer of sorted) {
      if (y < 150) {
        y = addContinuationPage();
      }

      const isSigned = String(signer.status || "").toLowerCase() === "signed";
      const badgeText = isSigned ? "[FIRMADO]" : "[PENDIENTE]";
      const badgeColor = isSigned ? C_GREEN : C_AMBER;

      // Nombre + badge
      const nameText = `${signer.sequence_order}. ${safe(signer.name_snapshot || "Desconocido")}`;
      draw(page, nameText, { x: M, y, font: bold, size: FS_BODY, color: C_BLACK, maxWidth: CW - 90 });
      const badgeW = bold.widthOfTextAtSize(badgeText, FS_SMALL);
      draw(page, badgeText, { x: PW - M - badgeW, y, font: bold, size: FS_SMALL, color: badgeColor });
      y -= 14;

      // Cargo + cedula + email
      const cedulaStr = signer.cedula_snapshot ? `C.I. ${safe(signer.cedula_snapshot)}  |  ` : "";
      const roleEmail = `${safe(signer.role_snapshot || "sin cargo")}  |  ${cedulaStr}${safe(signer.email_snapshot || "N/A")}`;
      draw(page, roleEmail, { x: M, y, font: reg, size: FS_SMALL, color: C_GREY, maxWidth: CW });
      y -= 13;

      // Fecha firma
      if (isSigned && signer.signed_at) {
        draw(page, `Firmado el: ${fmt(signer.signed_at)}`, { x: M, y, font: reg, size: FS_MICRO, color: C_GREY, maxWidth: CW });
        y -= 12;
      }

      // Imagen de firma
      if (isSigned && signer.signature_visual_base64 && y - 38 > 150) {
        try {
          const raw = signer.signature_visual_base64.includes(",")
            ? signer.signature_visual_base64.split(",")[1]
            : signer.signature_visual_base64;
          const sigImg = await pdfDoc.embedPng(Buffer.from(raw, "base64"));
          page.drawImage(sigImg, { x: M, y: y - 36, width: 110, height: 36, opacity: 0.88 });
          y -= 42;
        } catch { /* no disponible */ }
      }

      // Hash SHA
      if (signer.signature_hash_sha256) {
        const hashText = `SHA-256: ${signer.signature_hash_sha256.slice(0, 48)}...`;
        draw(page, hashText, { x: M, y, font: reg, size: FS_HASH, color: C_LIGHT, maxWidth: CW });
        y -= 11;
      }

      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.4, color: C_LIGHT });
      y -= 14;
    }

    // ── Integridad del documento ───────────────────────────────────────────────
    if (sourceDoc) {
      if (y < 170) y = addContinuationPage();
      y -= 4;
      draw(page, "INTEGRIDAD DEL DOCUMENTO", { x: M, y, font: bold, size: FS_BODY, color: C_NAVY });
      y -= 15;
      draw(page, `Archivo: ${safe(sourceDoc.filename || "N/A")}`, { x: M, y, font: reg, size: FS_SMALL, color: C_BLACK, maxWidth: CW });
      y -= 12;
      draw(page, `SHA base:  ${sourceDoc.source_sha256 || "N/A"}`, { x: M, y, font: reg, size: FS_HASH, color: C_GREY, maxWidth: CW });
      y -= 11;
    }

    // ── Footer con QR + URL ───────────────────────────────────────────────────
    const FY = 56;
    page.drawLine({ start: { x: M, y: FY + 56 }, end: { x: PW - M, y: FY + 56 }, thickness: 0.5, color: C_LIGHT });

    if (qrImg) {
      const QRF = 46;
      page.drawImage(qrImg, { x: M, y: FY + 4, width: QRF, height: QRF });
      draw(page, "Escanea para verificar", { x: M, y: FY - 2, font: bold, size: FS_MICRO, color: C_GREY });
      const urlX = M + QRF + 8;
      draw(page, "URL de verificacion:", { x: urlX, y: FY + 42, font: bold, size: FS_MICRO, color: C_GREY });
      draw(page, verificationUrl || "Token no disponible", {
        x: urlX, y: FY + 28, font: reg, size: FS_MICRO, color: C_BLUE, maxWidth: CW - QRF - 12,
      });
      draw(page, `Generado: ${fmt(new Date().toISOString())}`, {
        x: urlX, y: FY + 14, font: reg, size: FS_HASH, color: C_GREY, maxWidth: CW - QRF - 12,
      });
    } else if (verificationUrl) {
      draw(page, `Verificar: ${verificationUrl}`, { x: M, y: FY + 14, font: reg, size: FS_MICRO, color: C_BLUE, maxWidth: CW });
    }

    const disclaimer = "Las firmas son evidencias digitales internas registradas en FamSPI. No tiene validez juridica externa.";
    const dW = reg.widthOfTextAtSize(disclaimer, FS_HASH);
    page.drawText(disclaimer, { x: (PW - dW) / 2, y: FY - 6, font: reg, size: FS_HASH, color: C_LIGHT });

    // 4. Serialize and return base64
    const finalBytes = await pdfDoc.save();
    return Buffer.from(finalBytes).toString("base64");
  } catch (err) {
    console.error("[signatureWorkflows.pdf] appendSignatureBlock failed:", err?.message || err);
    return sourcePdfBase64;
  }
}

module.exports = { appendSignatureBlock };
