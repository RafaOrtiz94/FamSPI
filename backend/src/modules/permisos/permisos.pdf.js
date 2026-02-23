const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb, PDFName, PDFArray } = require("pdf-lib");
const QRCode = require("qrcode");
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

    // Adjuntar pagina de constancia legal Fam Sign
    const validationPage = await appendAdvancedSignaturePage(pdfDoc, solicitud);

    // Firma visual tipo rubrica y enlace a hoja de validacion
    await applySignatureVisualDesign(pdfDoc, form, solicitud, validationPage);

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

function formatDateTime(value) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return `${date.toLocaleString("es-EC")} | ${date.toISOString()}`;
}

function extractSignerName(signatureText, fallback = "No disponible") {
  const raw = String(signatureText || "").trim();
  if (!raw) return fallback;
  const cleaned = raw.replace(/^\/s\/\s*/i, "");
  const idx = cleaned.indexOf(" (");
  return idx > 0 ? cleaned.slice(0, idx).trim() : cleaned;
}

function buildSignatureAlias(fullName = "") {
  const name = String(fullName || "").trim();
  if (!name) return "S.Firma";

  const cleaned = name.replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length === 0) return "S.Firma";

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const initial = (first[0] || "S").toUpperCase();
  const lastSafe = (last || "Firma").replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü'-]/g, "");
  const normalizedLast = lastSafe ? `${lastSafe[0].toUpperCase()}${lastSafe.slice(1)}` : "Firma";
  return `${initial}.${normalizedLast}`;
}

async function appendAdvancedSignaturePage(pdfDoc, solicitud) {
  try {
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const marginX = 44;
    let y = 748;

    const draw = (text, opts = {}) => {
      page.drawText(String(text || ""), {
        x: opts.x ?? marginX,
        y: opts.y ?? y,
        size: opts.size || 10,
        font: opts.bold ? bold : font,
        color: rgb(0.12, 0.12, 0.12),
      });
      if (opts.y === undefined) y -= opts.gap || 15;
    };

    const summary = solicitud?.workflow_signature_summary || {};
    const legalUrl = solicitud?.legal_verification_url || "No disponible";
    const legalToken = solicitud?.legal_verification_token || "No disponible";
    const solicitudSigner = extractSignerName(
      solicitud?.firma_solicitante_texto,
      solicitud?.user_fullname || solicitud?.user_email || "No disponible"
    );
    const approverSigner = extractSignerName(
      solicitud?.firma_aprobador_texto,
      solicitud?.approver_fullname || solicitud?.aprobacion_final_por || "No disponible"
    );

    draw("F.RH-10 - Bloque Fam Sign", { size: 15, bold: true, gap: 22 });
    draw("Este anexo forma parte integral del documento y conserva trazabilidad legal del workflow.");
    draw(`Solicitud ID: ${solicitud?.id || "N/A"}`);
    draw(`Estado workflow firma: ${summary?.estado || solicitud?.firma_workflow_estado || "pendiente"}`);
    draw(`Solicitante firmado: ${solicitudSigner}`);
    draw(`Aprobador firmado: ${approverSigner}`);
    draw(`Fecha/hora solicitud: ${formatDateTime(summary?.solicitud?.signed_at || solicitud?.firma_solicitante_at)}`);
    draw(`Fecha/hora aprobacion: ${formatDateTime(summary?.aprobacion?.signed_at || solicitud?.firma_aprobador_at)}`);
    draw(`Hash solicitud: ${summary?.solicitud?.signature_hash_sha256 || solicitud?.firma_solicitante_hash || "No disponible"}`);
    draw(`Hash aprobacion: ${summary?.aprobacion?.signature_hash_sha256 || solicitud?.firma_aprobador_hash || "No disponible"}`);
    draw(
      `Hash encadenamiento previo: ${summary?.aprobacion?.previous_signature_hash_sha256 || solicitud?.firma_aprobador_prev_hash || "No disponible"}`
    );
    draw(`Token de verificacion: ${legalToken}`);

    const boxY = y - 175;
    page.drawRectangle({
      x: marginX,
      y: boxY,
      width: 524,
      height: 165,
      color: rgb(0.97, 0.98, 1),
      borderColor: rgb(0.72, 0.78, 0.9),
      borderWidth: 1,
    });
    draw("Verificacion legal Fam Sign (SPI)", {
      x: marginX + 14,
      y: boxY + 140,
      size: 11,
      bold: true,
      gap: 0,
    });
    draw("Escanee el QR o use la URL para validar autenticidad, integridad y trazabilidad.", {
      x: marginX + 14,
      y: boxY + 124,
      size: 9,
      gap: 0,
    });
    draw("URL de verificacion protegida (no visible en documento)", {
      x: marginX + 14,
      y: boxY + 106,
      size: 8,
      gap: 0,
    });

    if (legalUrl && legalUrl !== "No disponible") {
      const qrDataUrl = await QRCode.toDataURL(legalUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 220,
      });
      const base64 = String(qrDataUrl).split(",")[1];
      if (base64) {
        const qrImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
        page.drawImage(qrImage, {
          x: marginX + 395,
          y: boxY + 24,
          width: 110,
          height: 110,
        });
      }
    }

    draw("Cumple requisitos de evidencia interna: identificacion de firmantes, sello temporal y huella criptografica.", {
      x: marginX + 14,
      y: boxY + 24,
      size: 8,
      gap: 0,
    });
    return page;
  } catch (error) {
    console.warn("No se pudo anexar bloque Fam Sign al F.RH-10:", error.message);
    return null;
  }
}

function resolveTextField(form, candidateNames = []) {
  for (const fieldName of candidateNames) {
    try {
      const field = form.getTextField(fieldName);
      if (field) return field;
    } catch (_) {
      // try next alias
    }
  }
  return null;
}

function addGoToPageLink(pdfDoc, sourcePage, targetPage, rectangle) {
  if (!sourcePage || !targetPage || !rectangle) return;
  const context = pdfDoc.context;
  const annotsKey = PDFName.of("Annots");
  const destination = context.obj([targetPage.ref, PDFName.of("Fit")]);
  const action = context.obj({
    S: PDFName.of("GoTo"),
    D: destination,
  });
  const link = context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Link"),
    Rect: [rectangle.x, rectangle.y, rectangle.x + rectangle.width, rectangle.y + rectangle.height],
    Border: [0, 0, 0],
    A: action,
  });

  let annotsRefOrArray = sourcePage.node.get(annotsKey);
  if (!annotsRefOrArray) {
    const newAnnotsArray = context.obj([]);
    sourcePage.node.set(annotsKey, newAnnotsArray);
    annotsRefOrArray = sourcePage.node.get(annotsKey);
  }

  const annots = context.lookup(annotsRefOrArray, PDFArray);
  annots.push(link);
}

async function applySignatureVisualDesign(pdfDoc, form, solicitud, validationPage) {
  try {
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    if (!firstPage) return;

    const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const signatures = [
      {
        names: ["Firma", "firma", "Frima", "frima"],
        signer: extractSignerName(
          solicitud?.firma_solicitante_texto,
          solicitud?.user_fullname || solicitud?.user_email || "Solicitante"
        ),
        tiny: "Ver validacion de firma -> hoja 2",
      },
      {
        names: ["Firma_2", "firma_2", "Frima_2", "frima_2"],
        signer: extractSignerName(
          solicitud?.firma_aprobador_texto,
          solicitud?.approver_fullname || solicitud?.aprobacion_final_por || "Aprobador"
        ),
        tiny: "Ver validacion de firma -> hoja 2",
      },
    ];

    signatures.forEach((item) => {
      const field = resolveTextField(form, item.names);
      if (!field) return;
      const widgets = field.acroField.getWidgets();
      const widget = widgets?.[0];
      const rect = widget?.getRectangle?.();
      if (!rect) return;

      // Limpiar el campo para evitar superposicion con la rubrica visual.
      field.setText("");

      const alias = buildSignatureAlias(item.signer);
      firstPage.drawText(alias, {
        x: rect.x + 2,
        y: rect.y + Math.max(2, rect.height * 0.45),
        size: Math.max(10, Math.min(14, rect.height * 0.55)),
        font: italicFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      firstPage.drawText(item.tiny, {
        x: rect.x + 2,
        y: rect.y + 1,
        size: 5.5,
        font: regularFont,
        color: rgb(0.35, 0.35, 0.35),
      });

      if (validationPage) {
        try {
          addGoToPageLink(pdfDoc, firstPage, validationPage, rect);
        } catch (linkError) {
          // El documento sigue siendo valido aunque el visor no soporte enlace interno.
        }
      }
    });
  } catch (error) {
    console.warn("No se pudo aplicar estilo visual de firma:", error.message);
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
 * Genera constancia legal de validacion de Fam Sign.
 * Este documento sirve como respaldo de autenticidad, integridad y trazabilidad.
 */
async function generateFirmaLegalValidationPdf({ solicitud, signatures = [], verification = null }) {
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

    drawLine("SPI Fam - Constancia de Validacion Legal de Fam Sign", { size: 14, bold: true, gap: 20 });
    drawLine(`Documento generado (local): ${now.toLocaleString("es-EC")}`);
    drawLine(`Documento generado (UTC): ${now.toISOString()}`);
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
    if (verification?.token) {
      drawLine(`Token verificacion legal: ${verification.token}`);
    }
    if (verification?.url) {
      drawLine("URL verificacion legal: protegida (acceso solo por QR/token)");
    }
    drawLine("Este registro forma parte del expediente digital interno y su conservacion depende de la politica documental vigente.");

    // Timeline resumido
    y -= 6;
    drawLine("Eventos de firma registrados:", { bold: true });
    if (!timeline.length) {
      drawLine("- Sin eventos disponibles.");
    } else {
      timeline.forEach((event) => {
        if (y < 80) {
          page = pdfDoc.addPage([612, 792]);
          y = 750;
        }
        const eventDate = event?.signed_at ? new Date(event.signed_at).toLocaleString("es-EC") : "N/A";
        const shortHash = event?.signature_hash_sha256 ? String(event.signature_hash_sha256).slice(0, 16) : "N/A";
        drawLine(`- ${event.stage} | ${event.signer_name || event.signer_email || "N/A"} | ${eventDate} | ${shortHash}`);
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
