import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Misma paleta que collaboratorReportsPdf.js (talento) -- consistencia visual
// entre los reportes PDF generados desde distintos modulos.
const COLORS = {
  naval: [30, 41, 59],
  sky: [14, 165, 233],
  ink: [31, 41, 55],
  muted: [107, 114, 128],
  border: [229, 231, 235],
  paper: [249, 250, 251],
  success: [22, 163, 74],
  danger: [220, 38, 38],
  warning: [217, 119, 6],
  white: [255, 255, 255],
};

const STATUS_LABEL = {
  approved: "Aprobado", aprobado: "Aprobado",
  rejected: "Rechazado", rechazado: "Rechazado",
  pending: "Pendiente", pendiente: "Pendiente", pending_final: "Pendiente", aprobacion_parcial: "Pendiente",
  cancelled: "Cancelado", cancelado: "Cancelado",
};

const statusLabel = (status) => STATUS_LABEL[String(status || "").toLowerCase()] || (status || "-");
const statusColor = (status) => {
  const label = statusLabel(status);
  if (label === "Aprobado") return COLORS.success;
  if (label === "Rechazado") return COLORS.danger;
  if (label === "Pendiente") return COLORS.warning;
  return COLORS.muted;
};

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateTime = (value) => {
  if (!value) return "No registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const addHeader = (doc, row) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.naval);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(row?.fullname || row?.user_fullname || "Colaborador", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.sky);
  doc.text(row?.email || row?.user_email || "", 14, 21);
  doc.text(row?.department_name || "Sin departamento", 14, 27);
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(8);
  doc.text(`Generado: ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 27, { align: "right" });
};

const addSectionTitle = (doc, title) => {
  const startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : 40;
  doc.setFillColor(...COLORS.paper);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(14, startY, 182, 7, 1.5, 1.5, "FD");
  doc.setTextColor(...COLORS.naval);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(title, 17, startY + 4.8);
  return startY + 9;
};

const addFooter = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.border);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("FamSPI · Reporte individual de permisos y vacaciones", 14, pageHeight - 5);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - 14, pageHeight - 5, { align: "right" });
  }
};

export function generatePermisosCollaboratorReportPdf(row) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addHeader(doc, row);

  const vac = row?.vacaciones || {};
  const perm = row?.permisos || {};

  autoTable(doc, {
    startY: 38,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
    columnStyles: { 0: { cellWidth: 62, fontStyle: "bold" }, 1: { cellWidth: 55, fontStyle: "bold" }, 2: { cellWidth: 65 } },
    body: [
      ["Vacaciones disponibles (año)", `${vac.dias_disponibles ?? 0} día(s)`, ""],
      ["Vacaciones tomadas", `${vac.dias_aprobados ?? 0} día(s)`, ""],
      ["Vacaciones pendientes", `${vac.dias_pendientes ?? 0} día(s)`, ""],
      ["Saldo actual de vacaciones", `${vac.dias_restantes ?? 0} día(s)`, ""],
      ["Permisos aprobados", String(perm.aprobados ?? perm.aprobacion_completa ?? 0), ""],
      ["Permisos pendientes", String(perm.pendientes ?? 0), ""],
    ],
  });

  const permisoRows = (perm.items || []).map((item) => [
    item.tipo_permiso || "Permiso",
    formatDate(item.fecha_inicio),
    formatDate(item.fecha_fin),
    item.duracion_horas ? `${item.duracion_horas}h` : (item.duracion_dias ? `${item.duracion_dias}d` : "-"),
    statusLabel(item.status),
    item.aprobacion_final_por || item.aprobacion_parcial_por || "-",
    item.documento_url ? "Sí" : "-",
    item.pdf_validacion_legal_url ? "Sí" : "-",
  ]);
  autoTable(doc, {
    startY: addSectionTitle(doc, "Historial de permisos"),
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.6, cellPadding: 2, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
    body: permisoRows.length ? permisoRows : [["Sin registros", "-", "-", "-", "-", "-", "-", "-"]],
    head: [["Tipo", "Inicio", "Fin", "Duración", "Estado", "Aprobó", "Documento", "Firma"]],
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 4 && permisoRows.length) {
        data.cell.styles.textColor = statusColor(permisoRows[data.row.index]?.[4]);
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const vacacionRows = (vac.items || []).map((item) => [
    formatDate(item.fecha_inicio),
    formatDate(item.fecha_fin),
    `${item.duracion_dias ?? 0}d`,
    statusLabel(item.status),
    item.saldo_antes !== undefined ? `${item.saldo_antes}d → ${item.saldo_despues}d` : "-",
    item.aprobacion_final_por || "-",
    item.documento_url ? "Sí" : "-",
    item.pdf_validacion_legal_url ? "Sí" : "-",
  ]);
  autoTable(doc, {
    startY: addSectionTitle(doc, "Historial de vacaciones (saldo antes → después)"),
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.6, cellPadding: 2, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
    body: vacacionRows.length ? vacacionRows : [["-", "-", "-", "-", "-", "-", "-", "-"]],
    head: [["Inicio", "Fin", "Duración", "Estado", "Saldo", "Aprobó", "Documento", "Firma"]],
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 3 && vacacionRows.length) {
        data.cell.styles.textColor = statusColor(vacacionRows[data.row.index]?.[3]);
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  addFooter(doc);
  const safeName = String(row?.fullname || row?.user_fullname || "colaborador").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`reporte_permisos_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
