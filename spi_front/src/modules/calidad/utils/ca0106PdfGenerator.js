import { jsPDF } from "jspdf";

const generateRecallPdf = async (record) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Acta de Retiro del Mercado", margin, 25);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Lote: ${record?.lotNumber || "N/A"}`, margin, 40);
  doc.text(`Producto: ${record?.productName || "N/A"}`, margin, 48);
  doc.text(`Estado: ${record?.status || "pending"}`, margin, 56);
  doc.text(`Nivel de Recall: ${record?.recallLevel || "N/A"}`, margin, 64);

  const qrData = JSON.stringify({ id: record?.id, lot: record?.lotNumber, status: record?.status, ts: new Date().toISOString() });
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("QR Trazabilidad:", margin, 85);

  const qrSize = 30;
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, 90, qrSize, qrSize, "F");
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.text("GXP", margin, qrSize + 95);

  doc.setFontSize(10);
  doc.text("Detalles:", margin, 115);
  doc.setFontSize(9);
  doc.text(`ID: ${record?.id || "N/A"}`, margin, 123);
  doc.text(`Cantidad: ${record?.quantityTotal || "N/A"}`, margin, 131);
  doc.text(`Canales: ${record?.distributionChannels || "N/A"}`, margin, 139);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generado: ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 15);
  doc.text("Sistema Recall GXP - FamSPI", margin, doc.internal.pageSize.getHeight() - 9);

  return doc;
};

const downloadRecallPdf = async (record, filename = "recall.pdf") => {
  const doc = await generateRecallPdf(record);
  doc.save(filename);
};

const getRecallPdfBase64 = async (record) => {
  const doc = await generateRecallPdf(record);
  return doc.output("datauristring");
};

export default { generateRecallPdf, downloadRecallPdf, getRecallPdfBase64 };