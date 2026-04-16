import { jsPDF } from "jspdf";

const generateIncidentPdf = async (record) => {
  const doc = new jsPDF();
  const margin = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Acta de Incidente/Derrame", margin, 25);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Tipo: ${record?.incident_type || "N/A"}`, margin, 40);
  doc.text(`Severidad: ${record?.severity || "N/A"}`, margin, 48);
  doc.text(`Título: ${record?.title || "N/A"}`, margin, 56);
  doc.text(`Ubicación: ${record?.location || "N/A"}`, margin, 64);
  doc.text(`Estado: ${record?.status || "reported"}`, margin, 72);

  const qrData = JSON.stringify({ id: record?.id, ts: new Date().toISOString() });

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
  doc.text("Incidentes GXP - FamSPI", margin, doc.internal.pageSize.getHeight() - 9);

  return doc;
};

const downloadIncidentPdf = async (record, filename = "incidente.pdf") => {
  const doc = await generateIncidentPdf(record);
  doc.save(filename);
};

const getIncidentPdfBase64 = async (record) => {
  const doc = await generateIncidentPdf(record);
  return doc.output("datauristring");
};

export default { generateIncidentPdf, downloadIncidentPdf, getIncidentPdfBase64 };