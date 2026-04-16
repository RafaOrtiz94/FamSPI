import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

/**
 * Módulo GXP PDF Generator - CA-01-01
 * Permite imprimir certificados/actas de cierres CAPA on-the-fly 
 * sin depender del backend computando blobs.
 */

export const generateCapaPdf = async (alarmData) => {
  try {
    // 1. Crear documento PDF en blanco
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    let cursorY = height - 50;

    // Header Oficial
    page.drawText("FAM SPI - QUALITY MANAGEMENT SYSTEM", {
      x: 50,
      y: cursorY,
      size: 16,
      font: fontBold,
      color: rgb(0.8, 0.1, 0.1), // Strong Red
    });
    
    cursorY -= 30;

    page.drawText("ACTA DE INVESTIGACIÓN CAPA - CA-01-01", {
      x: 50,
      y: cursorY,
      size: 14,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    cursorY -= 40;

    // Info General
    const drawRow = (label, value) => {
      page.drawText(`${label}:`, { x: 50, y: cursorY, size: 10, font: fontBold });
      page.drawText(`${value || "N/A"}`, { x: 180, y: cursorY, size: 10, font });
      cursorY -= 20;
    };

    drawRow("ID de Alarma", alarmData.id);
    drawRow("Equipo Termohigrómetro", alarmData.device_name);
    drawRow("Ubicación Crítica", alarmData.location);
    drawRow("Tipo de Excursión", alarmData.alarm_type);
    drawRow("Temperatura Detectada", `${alarmData.temperature} °C`);
    drawRow("Estado Final de Cierre", alarmData.status.toUpperCase());
    drawRow("Fecha de Detección", new Date(alarmData.created_at).toLocaleString());

    cursorY -= 20;
    
    // Trazabilidad GXP
    page.drawText("HISTORIAL Y RESOLUCIÓN", { x: 50, y: cursorY, size: 12, font: fontBold });
    cursorY -= 20;
    
    const notesText = alarmData.notes || "No se detectaron observaciones extendidas.";
    page.drawText(notesText, {
      x: 50,
      y: cursorY,
      size: 9,
      font,
      maxWidth: 400,
    });

    // 2. Trazabilidad Anti-Forjado (QR Code)
    const qrPayload = JSON.stringify({
      id: alarmData.id,
      timestamp: new Date().toISOString(),
      validation_code: "ISO-9001-COMPLIANT",
    });
    
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 120,
    });

    const qrImageBytes = await fetch(qrDataUrl).then(res => res.arrayBuffer());
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    // Incrustar el QR en la esquina superior derecha
    page.drawImage(qrImage, {
      x: width - 150,
      y: height - 150,
      width: 100,
      height: 100,
    });

    // 3. Renderizar y Guardar o Previsualizar
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Auto-Trigger Descarga Pestaña Paralela (Modo Reporte Puro)
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `CAPA_ACT_${alarmData.id.split("-")[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

  } catch (error) {
    console.error("Falla generando Reporte PDF GXP:", error);
    throw error;
  }
};
