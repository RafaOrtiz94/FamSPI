import { jsPDF } from "jspdf";

const generateDocumentPdf = async (record) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Documento de Gestión y Control", margin, 25);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Código: ${record?.documentCode || "N/A"}`, margin, 40);
  doc.text(`Título: ${record?.title || "N/A"}`, margin, 48);
  doc.text(`Estado: ${record?.status || "draft"}`, margin, 56);
  doc.text(`Versión: ${record?.currentVersion || 1}`, margin, 64);

  const qrData = JSON.stringify({
    id: record?.id,
    code: record?.documentCode,
    status: record?.status,
    timestamp: new Date().toISOString(),
  });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("QR de Trazabilidad:", margin, 85);

  const qrSize = 30;
  const qrX = margin;
  const qrY = 90;
  doc.setFillColor(0, 0, 0);
  doc.rect(qrX, qrY, qrSize, qrSize, "F");

  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text("Trazabilidad GXP", qrX, qrY + qrSize + 5);

  doc.setFontSize(10);
  doc.text("Datos del Documento:", margin, 135);
  doc.setFontSize(9);
  doc.text(`ID: ${record?.id || "N/A"}`, margin, 143);
  doc.text(`Categoría: ${record?.category || "N/A"}`, margin, 151);
  doc.text(`Carpeta: ${record?.folderId || "N/A"}`, margin, 159);

  doc.setFontSize(8);
  doc.setTextColor(150);
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.text(`Generado: ${new Date().toLocaleString()}`, margin, footerY);
  doc.text("Sistema de Gestión Documental GXP/ISO - FamSPI", margin, footerY + 6);

  return doc;
};

const downloadPdf = async (record, filename = "documento.pdf") => {
  const doc = await generateDocumentPdf(record);
  doc.save(filename);
};

const getPdfBase64 = async (record) => {
  const doc = await generateDocumentPdf(record);
  return doc.output("datauristring");
};

export default {
  generateDocumentPdf,
  downloadPdf,
  getPdfBase64,
};