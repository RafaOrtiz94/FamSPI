/**
 * src/modules/servicio/desinfeccion.service.js
 * Servicio para generar el PDF de desinfeccion y subirlo a Drive
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");

// Resuelve la plantilla contemplando ambas grafias del nombre (acento correcto y nombre actual en disco)
const TEMPLATE_FILENAMES = [
  "F.ST-02_V04_DESINFECCI\u00d3N DE INSTRUMENTOS Y PARTES NUEVO.pdf", // esperado (DESINFECCION)
  "F.ST-02_V04_DESINFECCI\u00e0N DE INSTRUMENTOS Y PARTES NUEVO.pdf", // nombre actual en disco
];

const resolveTemplatePath = () => {
  for (const name of TEMPLATE_FILENAMES) {
    const candidate = path.join(__dirname, "..", "..", "data", "plantillas", name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, "..", "..", "data", "plantillas", TEMPLATE_FILENAMES[0]);
};

// Obtiene la firma como buffer (base64 o id de Drive)
const resolveSignatureBuffer = async (firma_ing_SC) => {
  if (!firma_ing_SC) return { signatureBuffer: null, signatureDriveId: null };

  // Si es base64 larga
  if (typeof firma_ing_SC === "string" && firma_ing_SC.length > 100) {
    try {
      const base64Data = firma_ing_SC.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      return { signatureBuffer, signatureDriveId: null };
    } catch (err) {
      logger.warn({ err }, "No se pudo decodificar la firma base64");
      return { signatureBuffer: null, signatureDriveId: null };
    }
  }

  // Caso: ya viene un id de Drive
  try {
    const signatureBuffer = await downloadSignatureFromDrive(firma_ing_SC);
    return { signatureBuffer, signatureDriveId: firma_ing_SC };
  } catch (err) {
    logger.warn({ err }, "No se pudo descargar la firma desde Drive");
    return { signatureBuffer: null, signatureDriveId: null };
  }
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
const downloadSignatureFromDrive = async (fileId) => {
  try {
    const response = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(response.data);
  } catch (err) {
    logger.error({ err, fileId }, "Error descargando firma desde Drive");
    return null;
  }
};

const setFieldText = (form, fieldName, value) => {
  try {
    const field = form.getField(fieldName);
    if (field && typeof field.setText === "function") {
      field.setText(value ?? "");
      return true;
    }
  } catch (err) {
    logger.warn({ fieldName, err }, "No se pudo asignar texto al campo");
  }
  return false;
};

const setFieldSignature = async ({
  pdfDoc,
  form,
  fieldName,
  signatureBuffer,
  textFallback = "",
  fillTextWhenMissing = false,
  fallbackPosition = { pageIndex: 0, x: 415, y: 110, width: 160, height: 60 },
}) => {
  try {
    const targetField = form.getField(fieldName);

    const drawOnWidgetRect = async (image) => {
      if (!targetField || !targetField.acroField || typeof targetField.acroField.getWidgets !== "function") return false;
      const widgets = targetField.acroField.getWidgets();
      if (!widgets || !widgets.length) return false;
      const widget = widgets[0];
      const rect = widget.getRectangle ? widget.getRectangle() : null;
      const page = widget.getPage ? widget.getPage() : pdfDoc.getPage(widget.P());
      if (!rect || !page) return false;
      const [x1, y1, x2, y2] = rect;
      const rectWidth = Math.abs(x2 - x1) || fallbackPosition.width;
      const rectHeight = Math.abs(y2 - y1) || fallbackPosition.height;
      const rectX = Math.min(x1, x2) || fallbackPosition.x;
      const rectY = Math.min(y1, y2) || fallbackPosition.y;
      page.drawImage(image, {
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
      });
      return true;
    };

    if (signatureBuffer) {
      let image;
      try {
        image = await pdfDoc.embedPng(signatureBuffer);
      } catch (err) {
        image = await pdfDoc.embedJpg(signatureBuffer);
      }

      if (targetField && typeof targetField.setImage === "function") {
        targetField.setImage(image);
        if (textFallback && typeof targetField.setText === "function") {
          targetField.setText(textFallback);
        }
        return;
      }

      const drawn = await drawOnWidgetRect(image);
      if (drawn) return;

      const page = pdfDoc.getPage(fallbackPosition.pageIndex || 0);
      if (page) {
        page.drawImage(image, {
          x: fallbackPosition.x,
          y: fallbackPosition.y,
          width: fallbackPosition.width,
          height: fallbackPosition.height,
        });
        return;
      }
    }

    if (fillTextWhenMissing && targetField && typeof targetField.setText === "function") {
      targetField.setText(textFallback);
    }
  } catch (err) {
    logger.warn({ fieldName, err }, "No se pudo asignar firma al campo");
  }
};

// ------------------------------------------------------------
// PDF generation
// ------------------------------------------------------------
const generateDisinfectionPDF = async (disinfectionData, providedSignatureBuffer = null) => {
  console.log("PDF Desinfeccion: inicio", {
    equipo: disinfectionData.equipo,
    responsable: disinfectionData.responsable,
    hasSignature: !!disinfectionData.firma_ing_SC,
    signatureLength: disinfectionData.firma_ing_SC?.length,
    hasAttachments: !!disinfectionData.adjunto_evidencia,
    attachmentCount: disinfectionData.adjunto_evidencia?.length || 0,
  });

  const templatePath = resolveTemplatePath();
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const baseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Firma: base64 (canvas) o id de Drive. Si viene por parámetro, se usa directamente.
  let signatureBuffer = providedSignatureBuffer;
  if (!signatureBuffer && disinfectionData.firma_ing_SC) {
    const resolved = await resolveSignatureBuffer(disinfectionData.firma_ing_SC);
    signatureBuffer = resolved.signatureBuffer;
  }

  // Datos generales
  setFieldText(form, "Fecha", disinfectionData.fecha || "");
  setFieldText(form, "Equipo", disinfectionData.equipo || "");
  setFieldText(form, "parte_repuesto", disinfectionData.parte_repuesto || "");
  setFieldText(form, "Serie", disinfectionData.serie || "");
  setFieldText(form, "Responsable", disinfectionData.responsable || "");

  // Checks de proceso
  if (disinfectionData.chk_general) setFieldText(form, "chk_general", "x");
  if (disinfectionData.chk_PEO) setFieldText(form, "chk_PEO", "x");
  if (disinfectionData.chk_PEO_1) setFieldText(form, "chk_PEO_1", "x");
  if (disinfectionData.chk_OP_1) setFieldText(form, "chk_OP_1", "x");
  if (disinfectionData.chk_en) setFieldText(form, "chk_en", "x");
  if (disinfectionData.chk_en_op) setFieldText(form, "chk_en_op", "x");
  if (disinfectionData.chk_CP) setFieldText(form, "chk_CP", "x");
  if (disinfectionData.chk_CP_op) setFieldText(form, "chk_CP_op", "x");
  if (disinfectionData.chk_lim) setFieldText(form, "chk_lim", "x");
  if (disinfectionData.chk_cloro) setFieldText(form, "chk_cloro", "x");
  if (disinfectionData.chk_OP_cloro) setFieldText(form, "chk_OP_cloro", "x");
  if (disinfectionData.chk_PS) setFieldText(form, "chk_PS", "x");
  if (disinfectionData.chk_PS_peo) setFieldText(form, "chk_PS_peo", "x");
  if (disinfectionData.chk_PS_op) setFieldText(form, "chk_PS_op", "x");
  if (disinfectionData.chk_tras) setFieldText(form, "chk_tras", "x");
  if (disinfectionData.chk_tras_peo) setFieldText(form, "chk_tras_peo", "x");
  if (disinfectionData.chk_tras_op) setFieldText(form, "chk_tras_op", "x");
  if (disinfectionData.chk_CVITE) setFieldText(form, "chk_CVTE", "x");
  if (disinfectionData.chk_DFD) setFieldText(form, "chk_DFD", "x");
  if (disinfectionData.chk_DFD_peo) setFieldText(form, "chk_DFD_peo", "x");
  if (disinfectionData.chk_DFD_o) setFieldText(form, "chk_DFD_o", "x");
  if (disinfectionData.chk_CD) setFieldText(form, "chk_CD", "x");
  if (disinfectionData.chk_CD_peo) setFieldText(form, "chk_CD_peo", "x");
  if (disinfectionData.chk_CD_op) setFieldText(form, "chk_CD_op", "x");

  // Firma
  const signatureNote = signatureBuffer
    ? `Firmado electronicamente el ${new Date().toLocaleDateString("es-EC")}`
    : "Firma no disponible";

  if (signatureBuffer) {
    await setFieldSignature({
      pdfDoc,
      form,
      fieldName: "firma_ing_SC_af_image",
      signatureBuffer,
      textFallback: signatureNote,
      fillTextWhenMissing: true,
      fallbackPosition: { pageIndex: 0, x: 410, y: 105, width: 170, height: 70 },
    });
  }
  setFieldText(form, "firma_ing_SC", signatureNote);

  // Evidencias (hasta 3)
  if (disinfectionData.adjunto_evidencia && Array.isArray(disinfectionData.adjunto_evidencia) && disinfectionData.adjunto_evidencia.length > 0) {
    try {
      const embeddedImages = [];
      for (let i = 0; i < Math.min(disinfectionData.adjunto_evidencia.length, 3); i++) {
        const imageFile = disinfectionData.adjunto_evidencia[i];
        if (imageFile && imageFile.data) {
          let imageBuffer;
          if (Buffer.isBuffer(imageFile.data)) {
            imageBuffer = imageFile.data;
          } else if (typeof imageFile.data === "string" && imageFile.data.includes("base64")) {
            const base64Data = imageFile.data.replace(/^data:image\/\w+;base64,/, "");
            imageBuffer = Buffer.from(base64Data, "base64");
          }

          if (imageBuffer && imageBuffer.length > 0) {
            let embeddedImage;
            try {
              embeddedImage = await pdfDoc.embedPng(imageBuffer);
            } catch (pngErr) {
              embeddedImage = await pdfDoc.embedJpg(imageBuffer);
            }

            if (embeddedImage) {
              embeddedImages.push({ image: embeddedImage, index: i });
            }
          }
        }
      }

      if (embeddedImages.length > 0) {
        embeddedImages.forEach((embeddedImageData, index) => {
          try {
            const firstPage = pdfDoc.getPages()[0];
            const positions = [
              { x: 50, y: 120, width: 150, height: 100 },
              { x: 220, y: 120, width: 150, height: 100 },
              { x: 390, y: 120, width: 150, height: 100 },
            ];
            const pos = positions[index] || positions[positions.length - 1];
            firstPage.drawImage(embeddedImageData.image, {
              x: pos.x,
              y: pos.y,
              width: pos.width,
              height: pos.height,
            });
          } catch (fieldErr) {
            logger.warn({ fieldErr, imageIndex: index }, "No se pudo insertar evidencia en el PDF");
          }
        });

        const adjuntosText = `${embeddedImages.length} evidencia(s) fotografica(s) adjunta(s) en el PDF`;
        setFieldText(form, "adjuntos", adjuntosText);
      }
    } catch (imgErr) {
      logger.error({ imgErr }, "Error procesando evidencias para el PDF");
    }
  }

  // Ajustar tipografia
  try {
    form.getFields().forEach((field) => {
      if (typeof field.updateAppearances === "function") {
        field.updateAppearances(baseFont);
      }
      if (typeof field.setFontSize === "function") {
        field.setFontSize(10);
      }
    });
  } catch (appearanceErr) {
    logger.warn({ appearanceErr }, "No se pudieron ajustar apariencias de campos");
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

// ------------------------------------------------------------
// Drive save
// ------------------------------------------------------------
const saveToDrive = async (
  pdfBuffer,
  disinfectionData,
  imageFiles = [],
  user = null,
  { signatureBuffer = null, signatureDriveId = null } = {}
) => {
  try {
    const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;

    if (!DRIVE_ROOT_FOLDER_ID) {
      logger.warn("DRIVE_ROOT_FOLDER_ID no configurado, omitiendo guardado en Drive");
      return null;
    }

    const servicioTecnicoFolder = await ensureFolder("Servicio Tecnico", DRIVE_ROOT_FOLDER_ID);
    const desinfeccionFolder = await ensureFolder("Desinfeccion", servicioTecnicoFolder.id);

    const timestamp = new Date().toISOString().split("T")[0];
    const userName = user?.name || user?.fullname || user?.email || "Usuario";
    const safeUserName = userName.replace(/[^a-zA-Z0-9\s\-_]/g, "").substring(0, 30);
    const identificativeName = `${disinfectionData.equipo}-${timestamp}-${safeUserName}`;
    const recordFolder = await ensureFolder(identificativeName, desinfeccionFolder.id);

    const pdfBase64 = pdfBuffer.toString("base64");
    const pdfFile = await uploadBase64File(
      `F.ST-02_Desinfeccion_${disinfectionData.equipo}_${timestamp}.pdf`,
      pdfBase64,
      "application/pdf",
      recordFolder.id,
    );

    // Subir la firma como archivo en la misma carpeta si viene como imagen base64
    let signatureFile = null;
    if (signatureBuffer && !signatureDriveId) {
      try {
        const signatureBase64 = signatureBuffer.toString("base64");
        signatureFile = await uploadBase64File(
          `firma_${disinfectionData.responsable || "tecnico"}_${timestamp}.png`,
          signatureBase64,
          "image/png",
          recordFolder.id,
        );
        signatureDriveId = signatureFile?.id || null;
      } catch (sigUploadErr) {
        logger.warn({ sigUploadErr }, "No se pudo subir la firma a Drive");
      }
    }

    const uploadedImages = [];
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        if (imageFile && imageFile.data) {
          try {
            let base64Data = imageFile.data;
            if (Buffer.isBuffer(imageFile.data)) {
              base64Data = imageFile.data.toString("base64");
            }

            const imageName = imageFile.name || `evidencia_${i + 1}_${timestamp}.jpg`;
            const uploadedImage = await uploadBase64File(
              imageName,
              base64Data,
              imageFile.type || "image/jpeg",
              recordFolder.id,
            );
            uploadedImages.push(uploadedImage);
          } catch (imgErr) {
            logger.error({ imgErr, imageIndex: i }, "Error subiendo imagen a Drive");
          }
        }
      }
    }

    return {
      folderId: recordFolder.id,
      pdfFile,
      images: uploadedImages,
      signatureFile,
      signatureDriveId,
    };
  } catch (err) {
    logger.error({ err }, "Error guardando archivos en Google Drive");
    return null;
  }
};

// ------------------------------------------------------------
// Controller
// ------------------------------------------------------------
const generatePDF = async (req, res) => {
  try {
    const disinfectionData = req.body;

    if (!disinfectionData.equipo || !disinfectionData.responsable) {
      return res.status(400).json({
        ok: false,
        message: "Equipo y responsable son obligatorios",
      });
    }

    // Resolver firma una sola vez para reutilizar en PDF y en Drive
    const { signatureBuffer, signatureDriveId } = await resolveSignatureBuffer(disinfectionData.firma_ing_SC);

    const pdfBuffer = await generateDisinfectionPDF(disinfectionData, signatureBuffer);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      logger.error("PDF buffer vacio o invalido");
      return res.status(500).json({
        ok: false,
        message: "Error: PDF generado esta vacio",
      });
    }

    const driveResult = await saveToDrive(
      pdfBuffer,
      disinfectionData,
      disinfectionData.adjunto_evidencia,
      req.userInfo,
      { signatureBuffer, signatureDriveId }
    );
    if (!driveResult) {
      return res.status(500).json({
        ok: false,
        message: "Error guardando archivos en Google Drive",
      });
    }

    res.json({
      ok: true,
      message: "Registro de desinfeccion completado correctamente",
      driveFolderId: driveResult.folderId,
      pdfId: driveResult.pdfFile?.id,
      imageCount: driveResult.images?.length || 0,
      signatureDriveId: driveResult.signatureDriveId || signatureDriveId || null,
    });
  } catch (err) {
    logger.error({ err }, "Error en endpoint de PDF de desinfeccion");
    return res.status(500).json({
      ok: false,
      message: err.message || "Error generando PDF de desinfeccion",
    });
  }
};

module.exports = {
  generateDisinfectionPDF,
  generatePDF,
};
