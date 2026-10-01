import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = {
  naval: [30, 41, 59],
  action: [37, 99, 235],
  sky: [14, 165, 233],
  slate: [51, 65, 85],
  ink: [31, 41, 55],
  muted: [107, 114, 128],
  border: [229, 231, 235],
  paper: [249, 250, 251],
  success: [22, 163, 74],
  danger: [220, 38, 38],
  white: [255, 255, 255],
};

const resolveDocumentType = (document = {}) =>
  String(document?.canonical_doc_type || document?.doc_type || "")
    .trim()
    .toUpperCase();

const resolveDocumentUrl = (document = {}) =>
  document?.signed_url ||
  document?.draft_drive_url ||
  document?.drive_url ||
  document?.file_url ||
  "";

const formatDateTime = (value) => {
  if (!value) return "No registrado";
  try {
    return new Date(value).toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_error) {
    return String(value);
  }
};

const formatDateOnly = (value) => {
  if (!value) return "No registrado";
  try {
    return new Date(value).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (_error) {
    return String(value);
  }
};

const formatStructuredValue = (value) => {
  if (value === null || value === undefined || value === "") return "No registrado";
  if (Array.isArray(value)) {
    if (value.length === 0) return "No registrado";
    return value
      .map((entry, index) => {
        if (entry && typeof entry === "object") {
          const pairs = Object.entries(entry)
            .filter(([, itemValue]) => itemValue !== null && itemValue !== undefined && String(itemValue).trim() !== "")
            .map(([key, itemValue]) => `${key}: ${itemValue}`);
          return pairs.length > 0 ? `${index + 1}. ${pairs.join(", ")}` : `${index + 1}. Sin detalle`;
        }
        return `${index + 1}. ${entry}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const pairs = Object.entries(value)
      .filter(([, itemValue]) => itemValue !== null && itemValue !== undefined && String(itemValue).trim() !== "")
      .map(([key, itemValue]) => `${key}: ${itemValue}`);
    return pairs.length > 0 ? pairs.join("\n") : "No registrado";
  }
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
};

const getProfileFieldRows = (profileData = {}, sections = []) =>
  (sections || []).flatMap((section) =>
    (section?.fields || []).map((field) => {
      const value = profileData?.[section.key]?.[field.key];
      return [
        section?.title || section?.key || "Seccion",
        field?.label || field?.key || "Campo",
        formatStructuredValue(value),
      ];
    }),
  );

const buildDocumentRows = (documents = [], documentDefinitions = []) => {
  const documentsByType = new Map(
    (documents || []).map((document) => [resolveDocumentType(document), document]),
  );

  return (documentDefinitions || []).map((definition) => {
    const doc = documentsByType.get(String(definition?.key || "").trim().toUpperCase());
    return [
      definition?.label || definition?.key || "Documento",
      doc ? "Cargado" : "Pendiente",
      doc?.file_name || "Sin archivo",
      formatDateTime(doc?.uploaded_at || doc?.created_at),
      resolveDocumentUrl(doc) || "Sin enlace",
    ];
  });
};

const buildChecklistRows = (
  checklistSections = [],
  profileData = {},
  documents = [],
) => {
  const documentTypes = new Set((documents || []).map((document) => resolveDocumentType(document)));

  return (checklistSections || []).flatMap((section) =>
    (section?.items || []).map((item) => {
      const complete =
        item?.type === "doc"
          ? documentTypes.has(String(item?.docType || "").trim().toUpperCase())
          : Boolean(profileData?.onboarding?.[item?.flagKey]);

      return [
        section?.title || "Checklist",
        item?.label || item?.docType || item?.flagKey || "Item",
        item?.type === "doc" ? "Documento" : "Validacion",
        complete ? "Completo" : "Pendiente",
      ];
    }),
  );
};

const buildQualificationRows = (qualifications = []) =>
  (qualifications || []).map((qualification) => [
    qualification?.title || "Registro academico",
    qualification?.qualification_type || "Sin clasificacion",
    qualification?.institution || qualification?.issuer || "No registrada",
    qualification?.registration_number || qualification?.metadata?.registration_number || "No registrado",
    formatDateOnly(qualification?.issue_date),
    resolveDocumentUrl(qualification) || "Sin enlace",
  ]);

const addSectionTitle = (doc, title) => {
  const startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : 24;
  doc.setFillColor(...COLORS.action);
  doc.roundedRect(14, startY, 182, 8, 2, 2, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, 18, startY + 5.3);
  return startY + 10;
};

const addCover = (doc, reportTitle, summaryLines = []) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.naval);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(reportTitle, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.sky);
  doc.text(`Generado: ${formatDateTime(new Date().toISOString())}`, 14, 24);

  let y = 46;
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumen del reporte", 14, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  summaryLines.forEach((line) => {
    doc.text(`• ${line}`, 16, y);
    y += 6;
  });
};

const addCollaboratorHeader = (doc, collaborator, index, total) => {
  if (index > 0) doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(...COLORS.naval);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(collaborator?.name || `Colaborador ${index + 1}`, 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Registro ${index + 1} de ${total}`, 14, 21);
  doc.text(collaborator?.subtitle || "Sin referencia adicional", 72, 21);
};

const addSummaryTable = (doc, collaborator) => {
  const profileCompletion = collaborator?.profileCompletion || {};
  const checklistCompletion = collaborator?.checklistCompletion || {};
  const qualifications = collaborator?.qualifications || [];
  const documents = collaborator?.documents || [];

  autoTable(doc, {
    startY: 34,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: "bold" },
      1: { cellWidth: 120 },
    },
    body: [
      ["Email", collaborator?.email || "No registrado"],
      ["Area / departamento", collaborator?.departmentName || "No registrado"],
      ["Estado laboral", collaborator?.statusLabel || "No registrado"],
      ["Completitud ficha", `${profileCompletion.done || 0}/${profileCompletion.total || 0}`],
      ["Completitud checklist", `${checklistCompletion.done || 0}/${checklistCompletion.total || 0}`],
      ["Documentos cargados", String(documents.length || 0)],
      ["Credenciales vigentes", String(qualifications.length || 0)],
    ],
  });
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
    doc.text("FamSPI · Workspace Talento Humano · Reporte de expediente", 14, pageHeight - 5);
    doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - 14, pageHeight - 5, { align: "right" });
  }
};

export const generateCollaboratorWorkspaceReportPdf = ({
  reportTitle,
  summaryLines = [],
  collaborators = [],
  profileSections = [],
  documentDefinitions = [],
  checklistSections = [],
  fileName,
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addCover(doc, reportTitle, summaryLines);

  collaborators.forEach((collaborator, index) => {
    addCollaboratorHeader(doc, collaborator, index, collaborators.length);
    addSummaryTable(doc, collaborator);

    const profileRows = getProfileFieldRows(collaborator?.profileData, profileSections);
    if (profileRows.length > 0) {
      autoTable(doc, {
        startY: addSectionTitle(doc, "Ficha del colaborador"),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2.3, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
        columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 42 }, 2: { cellWidth: 106 } },
        body: profileRows,
        head: [["Seccion", "Campo", "Valor"]],
      });
    }

    const qualificationRows = buildQualificationRows(collaborator?.qualifications);
    autoTable(doc, {
      startY: addSectionTitle(doc, "Titulos y certificaciones"),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.3, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
      body: qualificationRows.length > 0
        ? qualificationRows
        : [["Sin registros", "-", "-", "-", "-", "-"]],
      head: [["Nombre", "Tipo", "Institucion", "Registro", "Emision", "Respaldo"]],
    });

    const documentRows = buildDocumentRows(collaborator?.documents, documentDefinitions);
    autoTable(doc, {
      startY: addSectionTitle(doc, "Documentos del expediente"),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7.6, cellPadding: 2.1, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
      body: documentRows,
      head: [["Documento", "Estado", "Archivo", "Fecha", "Enlace"]],
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 1) {
          const value = String(data.cell.raw || "").toLowerCase();
          data.cell.styles.textColor = value === "cargado" ? COLORS.success : COLORS.danger;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    const checklistRows = buildChecklistRows(
      checklistSections,
      collaborator?.profileData,
      collaborator?.documents,
    );
    autoTable(doc, {
      startY: addSectionTitle(doc, "Checklist operativo"),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.2, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: COLORS.naval, textColor: COLORS.white },
      body: checklistRows,
      head: [["Bloque", "Item", "Tipo", "Estado"]],
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 3) {
          const value = String(data.cell.raw || "").toLowerCase();
          data.cell.styles.textColor = value === "completo" ? COLORS.success : COLORS.danger;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  });

  addFooter(doc);
  doc.save(fileName || `reporte-talento-humano-${new Date().toISOString().slice(0, 10)}.pdf`);
};
