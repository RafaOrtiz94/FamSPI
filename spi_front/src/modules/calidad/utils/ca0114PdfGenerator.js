import { jsPDF } from "jspdf";

const generateAreaPdf = async (record) => {
  const doc = new jsPDF();
  const margin = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Calificación de Área Controlada", margin, 25);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Área: ${record?.area_name || "N/A"}`, margin, 40);
  doc.text(`Código: ${record?.area_code || "N/A"}`, margin, 48);
  doc.text(`Tipo: ${record?.area_type || "N/A"}`, margin, 56);
  doc.text(`Clasificación: ${record?.classification_level || "N/A"}`, margin, 64);
  doc.text(`Estado: ${record?.status || "pending"}`, margin, 72);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("QR:", margin, 95);

  const qrSize = 30;
  doc.setFillColor(0,0,0);
  doc.rect(margin, 100, qrSize, qrSize, "F");

  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.text("GXP", margin, qrSize + 105);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generado: ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 15);
  doc.text("Áreas Calificadas GXP - FamSPI", margin, doc.internal.pageSize.getHeight() - 9);

  return doc;
};

const downloadAreaPdf = async (record, filename = "area_calificada.pdf") => {
  const doc = await generateAreaPdf(record);
  doc.save(filename);
};

const getAreaPdfBase64 = async (record) => {
  const doc = await generateAreaPdf(record);
  return doc.output("datauristring");
};

export default { generateAreaPdf, downloadAreaPdf, getAreaPdfBase64 };