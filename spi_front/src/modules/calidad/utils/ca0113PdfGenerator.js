import { jsPDF } from "jspdf";

const generateCommunicationPdf = async (record) => {
  const doc = new jsPDF();
  const margin = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Comunicación Interna/terna", margin, 25);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Título: ${record?.title || "N/A"}`, margin, 40);
  doc.text(`Tipo: ${record?.communication_type || "N/A"}`, margin, 48);
  doc.text(`Prioridad: ${record?.priority || "N/A"}`, margin, 56);
  doc.text(`Canal: ${record?.channel || "N/A"}`, margin, 64);
  doc.text(`Estado: ${record?.status || "draft"}`, margin, 72);

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
  doc.text("Comunicaciones GXP - FamSPI", margin, doc.internal.pageSize.getHeight() - 9);

  return doc;
};

const downloadCommunicationPdf = async (record, filename = "comunicacion.pdf") => {
  const doc = await generateCommunicationPdf(record);
  doc.save(filename);
};

const getCommunicationPdfBase64 = async (record) => {
  const doc = await generateCommunicationPdf(record);
  return doc.output("datauristring");
};

export default { generateCommunicationPdf, downloadCommunicationPdf, getCommunicationPdfBase64 };