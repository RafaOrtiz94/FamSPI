const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { uploadJustificante } = require("./permisos.drive");

const TEMPLATE_PATH = path.join(__dirname, "../../data/plantillas/F.RH-10_V01_SOLICITUD DE PERMISO.pdf");

/**
 * Generar PDF F.RH-10 con datos de la solicitud
 */
async function generateFRH10(solicitud) {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.warn("Plantilla F.RH-10 no encontrada:", TEMPLATE_PATH);
      return null;
    }

    // Cargar plantilla
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Llenar campos según tipo de solicitud
    if (solicitud.tipo_solicitud === "permiso") {
      fillPermisoFields(form, solicitud);
    } else if (solicitud.tipo_solicitud === "vacaciones") {
      fillVacacionesFields(form, solicitud);
    }

    // Llenar datos comunes
    fillCommonFields(form, solicitud);

    // Guardar PDF
    const pdfBytes = await pdfDoc.save();

    // Subir a Drive
    const user = {
      email: solicitud.user_email,
      fullname: solicitud.user_fullname,
      id: solicitud.user_id,
    };

    const driveFile = await uploadJustificante({
      user,
      solicitudId: solicitud.id,
      tipoJustificante: "F.RH-10",
      fileBuffer: Buffer.from(pdfBytes),
      fileName: `F.RH-10_${solicitud.id}.pdf`,
      mimeType: "application/pdf",
    });

    return driveFile.webViewLink;
  } catch (error) {
    console.error("Error generando PDF F.RH-10:", error);
    return null;
  }
}

/**
 * Llenar campos de permiso
 */
function fillPermisoFields(form, solicitud) {
  try {
    // Marcar tipo de permiso
    const checkboxes = {
      estudios: "per_est",
      personal: "per_ap",
      salud: "per_sal",
      calamidad: "per_cd",
    };

    const checkboxField = checkboxes[solicitud.tipo_permiso];
    if (checkboxField) {
      try {
        form.getCheckBox(checkboxField).check();
      } catch (e) {
        console.warn(`Checkbox ${checkboxField} no encontrado en formulario`);
      }
    }

    // Fechas
    if (solicitud.fecha_inicio) {
      try {
        form.getTextField("per_desde").setText(formatDate(solicitud.fecha_inicio));
      } catch (e) {
        console.warn("Campo per_desde no encontrado");
      }
    }

    if (solicitud.fecha_fin) {
      try {
        form.getTextField("per_hasta").setText(formatDate(solicitud.fecha_fin));
      } catch (e) {
        console.warn("Campo per_hasta no encontrado");
      }
    }

    // Duración
    if (solicitud.duracion_dias) {
      try {
        form.getTextField("per_dia").setText(solicitud.duracion_dias.toString());
      } catch (e) {
        console.warn("Campo per_dia no encontrado");
      }
    }

    if (solicitud.duracion_horas) {
      try {
        form.getTextField("per_horas").setText(solicitud.duracion_horas.toString());
      } catch (e) {
        console.warn("Campo per_horas no encontrado");
      }
    }
  } catch (error) {
    console.error("Error llenando campos de permiso:", error);
  }
}

/**
 * Llenar campos de vacaciones
 */
function fillVacacionesFields(form, solicitud) {
  try {
    if (solicitud.periodo_vacaciones) {
      try {
        form.getTextField("vac_periodo").setText(solicitud.periodo_vacaciones);
      } catch (e) {
        console.warn("Campo vac_periodo no encontrado");
      }
    }

    if (solicitud.fecha_inicio) {
      try {
        form.getTextField("vac_fecha_inicio").setText(formatDate(solicitud.fecha_inicio));
      } catch (e) {
        console.warn("Campo vac_fecha_inicio no encontrado");
      }
    }

    if (solicitud.fecha_fin) {
      try {
        form.getTextField("vac_fecha_fin").setText(formatDate(solicitud.fecha_fin));
      } catch (e) {
        console.warn("Campo vac_fecha_fin no encontrado");
      }
    }

    if (solicitud.duracion_dias) {
      try {
        form.getTextField("total_dias").setText(solicitud.duracion_dias.toString());
      } catch (e) {
        console.warn("Campo total_dias no encontrado");
      }
    }
  } catch (error) {
    console.error("Error llenando campos de vacaciones:", error);
  }
}

/**
 * Llenar campos comunes
 */
function fillCommonFields(form, solicitud) {
  try {
    const setTextField = (candidateNames = [], value) => {
      if (value === null || value === undefined || String(value).trim() === "") return;
      for (const fieldName of candidateNames) {
        try {
          form.getTextField(fieldName).setText(String(value));
          return true;
        } catch (e) {
          // try next alias
        }
      }
      console.warn(`Campos no encontrados en formulario: ${candidateNames.join(", ")}`);
      return false;
    };

    // Observaciones
    if (solicitud.observaciones && Array.isArray(solicitud.observaciones)) {
      try {
        if (solicitud.observaciones[0]) form.getTextField("ob_1").setText(solicitud.observaciones[0]);
      } catch (e) { }
      try {
        if (solicitud.observaciones[1]) form.getTextField("ob_2").setText(solicitud.observaciones[1]);
      } catch (e) { }
      try {
        if (solicitud.observaciones[2]) form.getTextField("ob_3").setText(solicitud.observaciones[2]);
      } catch (e) { }
    }

    // Solicitante
    if (solicitud.user_fullname) {
      setTextField(["Sol_por", "sol_por"], solicitud.user_fullname);
    }

    if (solicitud.firma_solicitante_texto) {
      setTextField(["Firma", "firma", "Frima", "frima"], solicitud.firma_solicitante_texto);
    }

    if (solicitud.user_document_id) {
      setTextField(["DI", "di"], solicitud.user_document_id);
    }

    if (solicitud.created_at) {
      setTextField(["Fecha", "fecha"], formatDate(solicitud.created_at));
    }

    // Aprobador
    if (solicitud.approver_fullname || solicitud.aprobacion_final_por) {
      setTextField(
        ["Apr_por", "apr_por"],
        solicitud.approver_fullname || solicitud.aprobacion_final_por
      );
    }

    if (solicitud.firma_aprobador_texto) {
      setTextField(["Firma_2", "firma_2", "Frima_2", "frima_2"], solicitud.firma_aprobador_texto);
    }

    if (solicitud.approver_document_id) {
      setTextField(["DI_2", "di_2"], solicitud.approver_document_id);
    }

    if (solicitud.aprobacion_final_at) {
      setTextField(["Fecha_2", "fecha_2"], formatDate(solicitud.aprobacion_final_at));
    }
  } catch (error) {
    console.error("Error llenando campos comunes:", error);
  }
}

/**
 * Genera constancia legal de validacion de firma avanzada.
 * Este documento sirve como respaldo de autenticidad, integridad y trazabilidad.
 */
async function generateFirmaLegalValidationPdf({ solicitud, signatures = [] }) {
  try {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]); // Carta
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const marginX = 48;
    let y = 750;

    const drawLine = (text, opts = {}) => {
      const size = opts.size || 10;
      const fontRef = opts.bold ? boldFont : font;
      page.drawText(String(text || ""), {
        x: marginX,
        y,
        size,
        font: fontRef,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= opts.gap || 14;
    };

    const drawSection = (title) => {
      y -= 6;
      drawLine(title, { size: 11, bold: true, gap: 16 });
    };

    const now = new Date();
    const timeline = Array.isArray(signatures) ? signatures : [];
    const solicitudSig = timeline.find((item) => item.stage === "solicitud") || null;
    const partialSig = timeline.find((item) => item.stage === "aprobacion_parcial") || null;
    const finalSig = timeline.find((item) => item.stage === "aprobacion_final") || null;
    const rechazoSig = timeline.find((item) => item.stage === "rechazo") || null;
    const approvalSig = finalSig || rechazoSig || partialSig || null;

    drawLine("SPI Fam - Constancia de Validacion Legal de Firma Avanzada", { size: 14, bold: true, gap: 20 });
    drawLine(`Documento generado: ${now.toLocaleString("es-EC")}`);
    drawLine(`Solicitud ID: ${solicitud?.id || "N/A"}`);
    drawLine(`Tipo: ${solicitud?.tipo_solicitud || "N/A"}${solicitud?.tipo_permiso ? ` / ${solicitud.tipo_permiso}` : ""}`);
    drawLine(`Estado final: ${solicitud?.status || "N/A"}`);

    drawSection("Autenticidad");
    drawLine(`Solicitante: ${solicitudSig?.signer_name || solicitud?.user_fullname || solicitud?.user_email || "No disponible"}`);
    drawLine(`Aprobador: ${approvalSig?.signer_name || solicitud?.approver_fullname || solicitud?.aprobacion_final_por || "No disponible"}`);

    drawSection("Integridad");
    drawLine(`Hash solicitud (SHA-256): ${solicitudSig?.signature_hash_sha256 || "No disponible"}`);
    drawLine(`Hash aprobacion (SHA-256): ${approvalSig?.signature_hash_sha256 || "No disponible"}`);
    drawLine(`Encadenamiento previo: ${approvalSig?.previous_signature_hash_sha256 || "No disponible"}`);

    drawSection("Trazabilidad");
    drawLine(`Fecha/hora solicitud: ${solicitudSig?.signed_at ? new Date(solicitudSig.signed_at).toLocaleString("es-EC") : "No disponible"}`);
    drawLine(`Fecha/hora aprobacion: ${approvalSig?.signed_at ? new Date(approvalSig.signed_at).toLocaleString("es-EC") : "No disponible"}`);
    drawLine(`Usuario solicitante: ${solicitudSig?.signer_email || solicitud?.user_email || "No disponible"}`);
    drawLine(`Usuario aprobador: ${approvalSig?.signer_email || solicitud?.approver_email || "No disponible"}`);
    drawLine(`IP solicitud: ${solicitudSig?.ip_address || "No disponible"}`);
    drawLine(`IP aprobacion: ${approvalSig?.ip_address || "No disponible"}`);

    drawSection("Workflow y Conservacion");
    drawLine(`Estados de flujo: solicitado -> ${finalSig ? "aprobado" : rechazoSig ? "rechazado" : "en proceso"}`);
    drawLine(`Documento fuente: F.RH-10${solicitud?.pdf_generado_url ? ` (${solicitud.pdf_generado_url})` : ""}`);
    drawLine("Este registro forma parte del expediente digital interno y su conservacion depende de la politica documental vigente.");

    // Timeline resumido
    y -= 6;
    drawLine("Eventos de firma registrados:", { bold: true });
    if (!timeline.length) {
      drawLine("- Sin eventos disponibles.");
    } else {
      timeline.forEach((event) => {
        if (y < 80) {
          y = 750;
          pdfDoc.addPage([612, 792]);
        }
        if (y < 80) {
          page = pdfDoc.addPage([612, 792]);
          y = 750;
        }
        const eventDate = event?.signed_at ? new Date(event.signed_at).toLocaleString("es-EC") : "N/A";
        drawLine(`- ${event.stage} | ${event.signer_name || event.signer_email || "N/A"} | ${eventDate}`);
      });
    }

    const pdfBytes = await pdfDoc.save();
    const user = {
      email: solicitud?.user_email,
      fullname: solicitud?.user_fullname,
      id: solicitud?.user_id,
    };

    const driveFile = await uploadJustificante({
      user,
      solicitudId: solicitud?.id,
      tipoJustificante: "ValidacionLegalFirma",
      fileBuffer: Buffer.from(pdfBytes),
      fileName: `Validacion_Legal_Firma_${solicitud?.id || "SNA"}.pdf`,
      mimeType: "application/pdf",
      existingFolderId: solicitud?.drive_folder_id || null,
    });

    return driveFile.webViewLink;
  } catch (error) {
    console.error("Error generando PDF legal de firma:", error);
    return null;
  }
}

/**
 * Formatear fecha
 */
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("es-EC");
}

module.exports = {
  generateFRH10,
  generateFirmaLegalValidationPdf,
};
