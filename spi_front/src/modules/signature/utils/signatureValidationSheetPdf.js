/**
 * signatureValidationSheetPdf.js
 * Hoja de validación de firma colectiva FamSign — pdf-lib + qrcode.
 *
 * NOTAS:
 *  - pdf-lib StandardFonts usan WinAnsi: NO soportan checkmarks (✓), em-dash (—), etc.
 *    Solo caracteres Latin-1 seguros.
 *  - fetch() con data: URLs falla en Firefox. Usar atob() para convertir base64.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C_NAVY  = rgb(0.07, 0.23, 0.37);
const C_WHITE = rgb(1, 1, 1);
const C_BLACK = rgb(0.08, 0.08, 0.08);
const C_GREY  = rgb(0.50, 0.50, 0.50);
const C_LIGHT = rgb(0.78, 0.78, 0.78);
const C_GREEN = rgb(0.05, 0.43, 0.18);
const C_AMBER = rgb(0.62, 0.38, 0.04);

const PW = 595.28;
const PH = 841.89;
const M  = 48;
const CW = PW - M * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte base64 a Uint8Array sin usar fetch (cross-browser). */
function b64ToBytes(b64) {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

/** Elimina caracteres fuera de WinAnsi (Latin-1) que hacen fallar pdf-lib. */
function safe(text) {
  return String(text || "")
    .replace(/[–—]/g, "-")   // em/en dash -> hyphen
    .replace(/[‘’]/g, "'")   // curly single quotes
    .replace(/[“”]/g, '"')   // curly double quotes
    .replace(/[^\x00-\xFF]/g, "?");    // cualquier otro fuera de Latin-1
}

/** Fecha en hora local del navegador con offset explícito. */
function fmt(value) {
  if (!value) return "N/A";
  try {
    const d = new Date(value);
    const p = (n) => String(n).padStart(2, "0");
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const abs = Math.abs(off);
    const tz = `UTC${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())} (${tz})`;
  } catch { return String(value); }
}

/** Recorta texto hasta que quepa en maxWidth puntos. */
function clip(text, font, size, maxW) {
  let t = safe(text);
  if (!maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  if (t !== safe(text)) t += "...";
  return t;
}

function draw(page, text, opts) {
  page.drawText(clip(text, opts.font, opts.size, opts.maxWidth), opts);
}

// ─── Generador principal ──────────────────────────────────────────────────────
export async function generateSignatureValidationSheet({ workflow, signers = [], documents = [] }) {
  const verificationToken = workflow.verification_token || null;
  const verificationUrl = verificationToken
    ? `${window.location.origin}/verificar/famsign/${verificationToken}`
    : null;

  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([PW, PH]);
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ── QR Code ───────────────────────────────────────────────────────────────
  let qrImage = null;
  if (verificationUrl) {
    try {
      const qrB64 = (await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 160,
        color: { dark: "#0a1628", light: "#ffffff" },
      })).split(",")[1];
      qrImage = await pdfDoc.embedPng(b64ToBytes(qrB64));
    } catch { /* QR no critico */ }
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  const HEADER_H = 72;
  page.drawRectangle({ x: 0, y: PH - HEADER_H, width: PW, height: HEADER_H, color: C_NAVY });

  const QR_SIZE = 56;
  if (qrImage) {
    page.drawImage(qrImage, {
      x: PW - M - QR_SIZE,
      y: PH - HEADER_H + (HEADER_H - QR_SIZE) / 2,
      width: QR_SIZE, height: QR_SIZE,
    });
  }

  page.drawText("HOJA DE VALIDACION DE FIRMA COLECTIVA", {
    x: M, y: PH - 26, font: bold, size: 12, color: C_WHITE,
  });
  page.drawText("FamSign - FamSPI", {
    x: M, y: PH - 43, font: reg, size: 9, color: rgb(0.75, 0.85, 0.95),
  });
  page.drawText("Este documento acredita la autenticidad e integridad de las firmas electronicas registradas.", {
    x: M, y: PH - 59, font: reg, size: 7.5, color: rgb(0.68, 0.78, 0.90),
  });

  let y = PH - HEADER_H - 22;

  // ── Datos del workflow ────────────────────────────────────────────────────
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
  draw(page, codeText, { x: M, y, font: bold, size: 11, color: C_BLACK });
  const codeW = bold.widthOfTextAtSize(codeText, 11);
  draw(page, statusLabel, { x: M + codeW + 10, y, font: bold, size: 9, color: statusColor });

  y -= 16;
  draw(page, workflow.title || "Sin titulo", { x: M, y, font: bold, size: 13, color: C_BLACK, maxWidth: CW });
  y -= 14;

  const moduleLabel = `Modulo: ${workflow.source_module || "N/A"}  |  Entidad: ${workflow.source_entity || "N/A"}  |  ID: ${workflow.source_entity_id || "N/A"}`;
  draw(page, moduleLabel, { x: M, y, font: reg, size: 8, color: C_GREY, maxWidth: CW });
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
    draw(page, label, { x: cx, y, font: bold, size: 7.5, color: C_GREY });
    draw(page, val, { x: cx, y: y - 12, font: reg, size: 7.5, color: C_BLACK, maxWidth: dateColW - 4 });
  });
  y -= 30;

  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.75, color: C_LIGHT });
  y -= 18;

  // ── Firmantes ─────────────────────────────────────────────────────────────
  draw(page, "FIRMANTES", { x: M, y, font: bold, size: 10, color: C_NAVY });
  y -= 14;

  const sorted = [...signers].sort((a, b) => Number(a.sequence_order || 0) - Number(b.sequence_order || 0));

  for (const signer of sorted) {
    if (y < 140) break;

    const isSigned = String(signer.status || "").toLowerCase() === "signed";
    const badgeText = isSigned ? "[FIRMADO]" : "[PENDIENTE]";
    const badgeColor = isSigned ? C_GREEN : C_AMBER;

    // Nombre
    const nameText = `${signer.sequence_order}. ${safe(signer.name_snapshot || "Desconocido")}`;
    draw(page, nameText, { x: M, y, font: bold, size: 10, color: C_BLACK, maxWidth: CW - 90 });
    const badgeW = bold.widthOfTextAtSize(badgeText, 8.5);
    draw(page, badgeText, { x: PW - M - badgeW, y, font: bold, size: 8.5, color: badgeColor });
    y -= 13;

    // Cargo + cedula + email
    const cedulaStr = signer.cedula_snapshot ? `C.I. ${safe(signer.cedula_snapshot)}  |  ` : "";
    const roleEmail = `${safe(signer.role_snapshot || "sin cargo")}  |  ${cedulaStr}${safe(signer.email_snapshot || "N/A")}`;
    draw(page, roleEmail, { x: M, y, font: reg, size: 8, color: C_GREY, maxWidth: CW });
    y -= 12;

    // Fecha de firma
    if (isSigned && signer.signed_at) {
      draw(page, `Firmado el: ${fmt(signer.signed_at)}`, { x: M, y, font: reg, size: 7.5, color: C_GREY, maxWidth: CW });
      y -= 11;
    }

    // Imagen de firma (base64 PNG)
    if (isSigned && signer.signature_visual_base64 && y - 32 > 140) {
      try {
        const raw = signer.signature_visual_base64.includes(",")
          ? signer.signature_visual_base64.split(",")[1]
          : signer.signature_visual_base64;
        const sigImg = await pdfDoc.embedPng(b64ToBytes(raw));
        page.drawImage(sigImg, { x: M, y: y - 30, width: 86, height: 28, opacity: 0.88 });
        y -= 34;
      } catch { /* firma visual no disponible */ }
    }

    // Hash SHA
    if (signer.signature_hash_sha256) {
      const hashText = `SHA-256: ${signer.signature_hash_sha256.slice(0, 48)}...`;
      draw(page, hashText, { x: M, y, font: reg, size: 6.5, color: C_LIGHT, maxWidth: CW });
      y -= 10;
    }

    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.4, color: C_LIGHT });
    y -= 14;
  }

  // ── Integridad del documento ──────────────────────────────────────────────
  const doc = documents[0] || null;
  if (doc && y > 160) {
    y -= 4;
    draw(page, "INTEGRIDAD DEL DOCUMENTO", { x: M, y, font: bold, size: 10, color: C_NAVY });
    y -= 14;
    draw(page, `Archivo: ${safe(doc.filename || "N/A")}`, { x: M, y, font: reg, size: 8, color: C_BLACK, maxWidth: CW });
    y -= 11;
    draw(page, `SHA base:  ${doc.source_sha256 || "N/A"}`, { x: M, y, font: reg, size: 6.5, color: C_GREY, maxWidth: CW });
    y -= 10;
    if (doc.final_sha256) {
      draw(page, `SHA final: ${doc.final_sha256}`, { x: M, y, font: reg, size: 6.5, color: C_GREY, maxWidth: CW });
    }
  }

  // ── Footer con QR + URL ───────────────────────────────────────────────────
  const FY = 56;
  page.drawLine({ start: { x: M, y: FY + 56 }, end: { x: PW - M, y: FY + 56 }, thickness: 0.5, color: C_LIGHT });

  if (qrImage) {
    const QRF = 46;
    page.drawImage(qrImage, { x: M, y: FY + 4, width: QRF, height: QRF });
    draw(page, "Escanea para verificar", { x: M, y: FY - 2, font: bold, size: 7, color: C_GREY });
    const urlX = M + QRF + 8;
    draw(page, "URL de verificacion:", { x: urlX, y: FY + 42, font: bold, size: 7.5, color: C_GREY });
    draw(page, verificationUrl || "Token no disponible", {
      x: urlX, y: FY + 29, font: reg, size: 7, color: C_NAVY, maxWidth: CW - QRF - 12,
    });
    draw(page, "Generado: " + fmt(new Date().toISOString()), {
      x: urlX, y: FY + 16, font: reg, size: 6.5, color: C_GREY, maxWidth: CW - QRF - 12,
    });
  }

  const disclaimer = "Las firmas son evidencias digitales internas registradas en FamSPI. No tiene validez juridica externa.";
  const dW = reg.widthOfTextAtSize(disclaimer, 6.5);
  page.drawText(disclaimer, { x: (PW - dW) / 2, y: FY - 6, font: reg, size: 6.5, color: C_LIGHT });

  // ── Descarga ──────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `FAMSIGN_VALIDACION_${safe(workflow.workflow_code || String(workflow.id))}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
