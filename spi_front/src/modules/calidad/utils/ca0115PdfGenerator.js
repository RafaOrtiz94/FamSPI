import { jsPDF } from "jspdf";
const generateAuditPdf = async (record) => {
  const doc = new jsPDF(); const margin = 20;
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text("Acta de Auditoría", margin, 25);
  doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text(`Número: ${record?.audit_number || "N/A"}`, margin, 40); doc.text(`Tipo: ${record?.audit_type || "N/A"}`, margin, 48); doc.text(`Alcance: ${record?.scope || "N/A"}`, margin, 56); doc.text(`Estado: ${record?.status || "planned"}`, margin, 64);
  doc.setFontSize(10); doc.setTextColor(100); doc.text("QR:", margin, 85); const qrSize = 30; doc.setFillColor(0,0,0); doc.rect(margin, 90, qrSize, qrSize, "F"); doc.setTextColor(0); doc.setFontSize(8); doc.text("GXP", margin, qrSize + 95); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Generado: ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 15); doc.text("Auditorías GXP - FamSPI", margin, doc.internal.pageSize.getHeight() - 9);
  return doc;
};
const downloadAuditPdf = async (record, filename = "auditoria.pdf") => { const doc = await generateAuditPdf(record); doc.save(filename); };
const getAuditPdfBase64 = async (record) => { const doc = await generateAuditPdf(record); return doc.output("datauristring"); };
export default { generateAuditPdf, downloadAuditPdf, getAuditPdfBase64 };