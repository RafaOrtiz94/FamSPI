import { jsPDF } from "jspdf";

const generateRiesgoPdf = async (record) => {
  const doc = new jsPDF();
  const margin = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Acta de Gestión de Riesgos", margin, 25);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Proceso: ${record?.process_name || "N/A"}`, margin, 40);
  doc.text(`Modo de Falla: ${record?.failure_mode || "N/A"}`, margin, 48);
  doc.text(`RPN: ${record?.risk_level || "N/A"}`, margin, 56);
  doc.text(`Estado: ${record?.status || "active"}`, margin, 64);

  const qrData = JSON.stringify({ id: record?.id, ts: new Date().toISOString() });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("QR:", margin, 90);

  const qrSize = 30;
  doc.setFillColor(0,0,0);
  doc.rect(margin, 95, qrSize, qrSize, "F");

  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.text("GXP", margin, qrSize + 100);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generado: ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 15);
  doc.text("Gestión de Riesgos GXP - FamSPI", margin, doc.internal.pageSize.getHeight() - 9);

  return doc;
};

const downloadRiesgoPdf = async (record, filename = "riesgo.pdf") => {
  const doc = await generateRiesgoPdf(record);
  doc.save(filename);
};

const getRiesgoPdfBase64 = async (record) => {
  const doc = await generateRiesgoPdf(record);
  return doc.output("datauristring");
};

export default { generateRiesgoPdf, downloadRiesgoPdf, getRiesgoPdfBase64 };