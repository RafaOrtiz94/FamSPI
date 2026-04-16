import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const buildVerificationUrl = ({ flowName, record }) => {
  const payload = {
    module: "CA-01-03",
    flowName,
    id: record?.id || "na",
    status: record?.status || "draft",
    generatedAt: new Date().toISOString(),
  };

  const encoded = encodeURIComponent(JSON.stringify(payload));
  return `https://quality.famspi.local/verify?payload=${encoded}`;
};

export const generateCa0103Pdf = async ({ flowName, record, user }) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let cursorY = height - 52;

  page.drawText("FAM SPI - QUALITY MANAGEMENT SYSTEM", {
    x: 50,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: rgb(0.42, 0.15, 0.7),
  });

  cursorY -= 28;
  page.drawText("ACTA DE CIERRE - CA-01-03", {
    x: 50,
    y: cursorY,
    size: 14,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.1),
  });

  cursorY -= 20;
  page.drawText(`Flujo: ${String(flowName || "training").toUpperCase()}`, {
    x: 50,
    y: cursorY,
    size: 10,
    font,
  });

  cursorY -= 28;
  const drawRow = (label, value) => {
    page.drawText(`${label}:`, { x: 50, y: cursorY, size: 10, font: fontBold });
    page.drawText(`${value || "N/A"}`, { x: 175, y: cursorY, size: 10, font });
    cursorY -= 18;
  };

  drawRow("ID de registro", record?.id);
  drawRow("Estado final", String(record?.status || "draft").toUpperCase());
  drawRow("Operador", user?.name || user?.role || "Operador GXP");
  drawRow("Fecha de generacion", new Date().toLocaleString("es-EC"));

  cursorY -= 12;
  page.drawText("OBSERVACIONES", { x: 50, y: cursorY, size: 12, font: fontBold });
  cursorY -= 18;

  page.drawText(record?.notes || "Sin observaciones registradas.", {
    x: 50,
    y: cursorY,
    size: 9,
    font,
    maxWidth: 390,
    lineHeight: 12,
  });

  const verificationUrl = buildVerificationUrl({ flowName, record });
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 140,
  });

  const qrBytes = await fetch(qrDataUrl).then((response) => response.arrayBuffer());
  const qrImage = await pdfDoc.embedPng(qrBytes);

  page.drawText("QR DE TRAZABILIDAD", {
    x: width - 180,
    y: height - 70,
    size: 10,
    font: fontBold,
  });

  page.drawImage(qrImage, {
    x: width - 175,
    y: height - 240,
    width: 120,
    height: 120,
  });

  page.drawText("VALIDACION GXP", {
    x: width - 180,
    y: height - 260,
    size: 9,
    font: fontBold,
  });

  page.drawText("Documento generado localmente con trazabilidad auditiva.", {
    x: width - 180,
    y: height - 275,
    size: 8,
    font,
    maxWidth: 130,
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = pdfUrl;
  link.download = `CA0103_ACTA_${String(record?.id || "registro").slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(pdfUrl);
};
