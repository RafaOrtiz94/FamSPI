import { jsPDF } from "jspdf";

const generateHygienePdf = async (record) => {
  const doc = new jsPDF();
  const margin = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Acta de Higiene Personal", margin, 25);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Área: ${record?.hygiene_area || "N/A"}`, margin, 40);
  doc.text(`Tipo: ${record?.evaluation_type || "N/A"}`, margin, 48);
  doc.text(`Resultado: ${record?.result || "N/A"}`, margin, 56);
  doc.text(`Estado: ${record?.status || "pending"}`, margin, 64);
  doc.text(`Observaciones: ${record?.observations || "N/A"}`, margin, 72);

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
  doc.text("Higiene Personal GXP - FamSPI", margin, doc.internal.pageSize.getHeight() - 9);

  return doc;
};

const downloadHygienePdf = async (record, filename = "higiene.pdf") => {
  const doc = await generateHygienePdf(record);
  doc.save(filename);
};

const getHygienePdfBase64 = async (record) => {
  const doc = await generateHygienePdf(record);
  return doc.output("datauristring");
};

export default { generateHygienePdf, downloadHygienePdf, getHygienePdfBase64 };