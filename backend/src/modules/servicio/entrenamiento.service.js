/**
 * src/modules/servicio/entrenamiento.service.js
 * --------------------------------------------
 * 📄 PDF Generation Service for Training Date Coordination Records
 * - Fills F.ST-04_V03_COORDINACION DE LA FECHA DE ENTRENAMIENTO template
 * - Handles signature embedding and Google Drive storage
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");

const TEMPLATE_PATH = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "plantillas",
    "F.ST-04_V03_COORDINACION DE LA FECHA DE ENTRENAMIENTO.pdf"
);

/**
 * Safely set a form field text value
 */
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

/**
 * Download signature image from Google Drive (service account)
 */
const downloadSignatureFromDrive = async (fileId) => {
    try {
        const response = await drive.files.get(
            { fileId, alt: "media", supportsAllDrives: true },
            { responseType: "arraybuffer" }
        );
        return Buffer.from(response.data);
    } catch (err) {
        logger.error({ err, fileId }, "Error downloading signature from Drive");
        return null;
    }
};

/**
 * Generate PDF for training coordination record
 */
const generateTrainingCoordinationPDF = async (trainingData) => {
    console.log("🏫 Backend: Starting training coordination PDF generation", {
        ordenNumero: trainingData.ORDNumero,
        cliente: trainingData.ORDCliente,
        equipo: trainingData.ORDEquipo,
        hasSignature: !!trainingData.Firma_af_image,
        hasObservations: !!(trainingData.Obs_1 || trainingData.Obs_2 || trainingData.Obs_3 || trainingData.Obs_4)
    });

    // Load template
    console.log("🏫 Backend: Loading training coordination PDF template");
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const baseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    console.log("🏫 Backend: PDF template loaded successfully");

    // Handle signature - can be base64 data or Google Drive file ID
    let signatureBuffer = null;
    if (trainingData.Firma_af_image) {
        // Check if it's base64 data (starts with signature-like string)
        if (typeof trainingData.Firma_af_image === 'string' && trainingData.Firma_af_image.length > 100) {
            // Assume it's base64 data from the frontend
            try {
                const base64Data = trainingData.Firma_af_image.replace(/^data:image\/\w+;base64,/, '');
                signatureBuffer = Buffer.from(base64Data, 'base64');
                logger.info("Training signature processed as base64 data");
            } catch (err) {
                logger.warn({ err }, "Error processing training signature as base64");
            }
        } else {
            // Try to download from Google Drive
            signatureBuffer = await downloadSignatureFromDrive(trainingData.Firma_af_image);
        }
    }

    // 1️⃣ DATOS GENERALES DE LA ORDEN
    setFieldText(form, "ORDNumero", trainingData.ORDNumero || "");
    setFieldText(form, "ORDCliente", trainingData.ORDCliente || "");
    setFieldText(form, "ORDEquipo", trainingData.ORDEquipo || "");
    setFieldText(form, "ORDSerie", trainingData.ORDSerie || "");
    setFieldText(form, "ORDResponsable", trainingData.ORDResponsable || "");

    // 3️⃣ PLANIFICACIÓN DEL ENTRENAMIENTO
    // Fechas
    setFieldText(form, "Fecha_Inicio", trainingData.Fecha_Inicio || "");
    setFieldText(form, "Fecha_final", trainingData.Fecha_final || "");

    // Duración
    setFieldText(form, "Dias", trainingData.Dias?.toString() || "");
    setFieldText(form, "Horas", trainingData.Horas?.toString() || "");
    setFieldText(form, "Num_P", trainingData.Num_P?.toString() || "");

    // 4️⃣ OBSERVACIONES
    setFieldText(form, "Obs_1", trainingData.Obs_1 || "");
    setFieldText(form, "Obs_2", trainingData.Obs_2 || "");
    setFieldText(form, "Obs_3", trainingData.Obs_3 || "");
    setFieldText(form, "Obs_4", trainingData.Obs_4 || "");

    // 5️⃣ FIRMAS Y VALIDACIÓN FINAL
    // Set signature in image field
    if (signatureBuffer) {
        try {
            console.log("🏫 Backend: Attempting to embed training signature, buffer size:", signatureBuffer.length);
            let signatureImage = await pdfDoc.embedPng(signatureBuffer);
            console.log("🏫 Backend: Training signature image embedded in PDF document");

            const signatureField = form.getField("Firma_af_image");
            console.log("🏫 Backend: Retrieved training signature field:", !!signatureField);

            if (signatureField) {
                console.log("🏫 Backend: Training signature field type:", signatureField.constructor.name);
                console.log("🏫 Backend: Field has setImage method:", typeof signatureField.setImage === "function");

                if (typeof signatureField.setImage === "function") {
                    signatureField.setImage(signatureImage);
                    console.log("🏫 Backend: Training signature embedded successfully in image field");
                } else {
                    console.log("🏫 Backend: Field doesn't have setImage method, signature not embedded");
                }
            } else {
                console.log("🏫 Backend: Training signature field not found");
            }
        } catch (sigErr) {
            console.error({ sigErr }, "🏫 Backend: Error embedding training signature image");
        }
    } else {
        console.log("🏫 Backend: No training signature buffer available");
    }

    // Ajustar tipografía para evitar letras exageradas
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
        logger.warn({ appearanceErr }, "No se pudieron ajustar apariencias de campos de entrenamiento");
    }

    // Don't flatten the form to avoid corruption
    // form.flatten();

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};

/**
 * Save files to Google Drive with proper folder structure for training coordination
 */
const saveTrainingToDrive = async (pdfBuffer, trainingData, user = null) => {
    try {
        console.log("🏫 Backend: Starting training coordination Google Drive save process", {
            hasPDF: !!pdfBuffer,
            pdfSize: pdfBuffer?.length,
            ordenNumero: trainingData.ORDNumero,
            cliente: trainingData.ORDCliente,
            user: user?.email || user?.name || 'No user'
        });

        const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;

        if (!DRIVE_ROOT_FOLDER_ID) {
            console.log("🏫 Backend: DRIVE_ROOT_FOLDER_ID not configured");
            logger.warn("DRIVE_ROOT_FOLDER_ID no configurado, omitiendo guardado en Drive");
            return null;
        }

        // 1. Create Servicio Técnico folder
        console.log("🏫 Backend: Creating Servicio Técnico folder");
        const servicioTecnicoFolder = await ensureFolder("Servicio Técnico", DRIVE_ROOT_FOLDER_ID);
        console.log("🏫 Backend: Servicio Técnico folder created", { id: servicioTecnicoFolder.id });

        // 2. Create Entrenamiento folder
        console.log("🏫 Backend: Creating Entrenamiento folder");
        const entrenamientoFolder = await ensureFolder("Entrenamiento", servicioTecnicoFolder.id);
        console.log("🏫 Backend: Entrenamiento folder created", { id: entrenamientoFolder.id });

        // 3. Create identificative folder (order number + client + date + user)
        const timestamp = new Date().toISOString().split('T')[0];
        const userName = user?.name || user?.fullname || user?.email || 'Usuario';
        const safeUserName = userName.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30); // Clean and limit length
        const safeClient = (trainingData.ORDCliente || 'Cliente').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30);
        const identificativeName = `${trainingData.ORDNumero}-${safeClient}-${timestamp}-${safeUserName}`;
        console.log("🏫 Backend: Creating training record folder", { name: identificativeName });
        const recordFolder = await ensureFolder(identificativeName, entrenamientoFolder.id);
        console.log("🏫 Backend: Training record folder created", { id: recordFolder.id });

        // 4. Save PDF
        const pdfBase64 = pdfBuffer.toString('base64');
        const pdfFile = await uploadBase64File(
            `F.ST-04_Coordinacion_Entrenamiento_${trainingData.ORDNumero}_${timestamp}.pdf`,
            pdfBase64,
            "application/pdf",
            recordFolder.id
        );

        return {
            folderId: recordFolder.id,
            pdfFile: pdfFile,
            images: [] // No additional images for training coordination
        };

    } catch (err) {
        logger.error({ err }, "Error guardando archivos de entrenamiento en Google Drive");
        // Don't throw error, just log it - PDF generation should still work
        return null;
    }
};

/**
 * Generate PDF endpoint handler for training coordination
 */
const generateTrainingPDF = async (req, res) => {
    try {
        const trainingData = req.body;

        // Validation rules
        if (!trainingData.ORDNumero) {
            return res.status(400).json({
                ok: false,
                message: "El número de orden (ORDNumero) es obligatorio",
            });
        }

        if (!trainingData.ORDCliente || !trainingData.ORDEquipo) {
            return res.status(400).json({
                ok: false,
                message: "Cliente y equipo son obligatorios",
            });
        }

        if (!trainingData.Fecha_Inicio || !trainingData.Fecha_final) {
            return res.status(400).json({
                ok: false,
                message: "Las fechas de inicio y finalización son obligatorias",
            });
        }

        // Validate date logic: Fecha_final >= Fecha_Inicio
        const fechaInicio = new Date(trainingData.Fecha_Inicio);
        const fechaFinal = new Date(trainingData.Fecha_final);
        if (fechaFinal < fechaInicio) {
            return res.status(400).json({
                ok: false,
                message: "La fecha de finalización debe ser igual o posterior a la fecha de inicio",
            });
        }

        // Validate duration: Dias > 0, Horas > 0, Num_P >= 1
        if (trainingData.Dias <= 0 || trainingData.Horas <= 0 || trainingData.Num_P < 1) {
            return res.status(400).json({
                ok: false,
                message: "Los valores de duración deben ser mayores a cero y al menos 1 profesional",
            });
        }

        // Require Famproject signature
        if (!trainingData.Firma_af_image || trainingData.Firma_af_image.length < 10) {
            return res.status(400).json({
                ok: false,
                message: "La firma de Famproject es obligatoria",
            });
        }

        const pdfBuffer = await generateTrainingCoordinationPDF(trainingData);

        // Check if buffer is valid
        if (!pdfBuffer || pdfBuffer.length === 0) {
            logger.error("PDF buffer is empty or invalid");
            return res.status(500).json({
                ok: false,
                message: "Error: PDF generado está vacío",
            });
        }

        logger.info(`PDF de coordinación de entrenamiento generado correctamente, tamaño: ${pdfBuffer.length} bytes`);

        // Save to Google Drive (required - if this fails, return error)
        const driveResult = await saveTrainingToDrive(pdfBuffer, trainingData, req.userInfo);

        if (!driveResult) {
            logger.error("Error guardando archivos de entrenamiento en Google Drive");
            return res.status(500).json({
                ok: false,
                message: "Error guardando archivos en Google Drive",
            });
        }

        logger.info({
            folderId: driveResult.folderId,
            pdfId: driveResult.pdfFile?.id,
            imageCount: driveResult.images?.length || 0
        }, "Archivos de coordinación de entrenamiento guardados en Google Drive");

        // Return success without downloading PDF
        res.json({
            ok: true,
            message: "Coordinación de entrenamiento registrada correctamente",
            driveFolderId: driveResult.folderId,
            pdfId: driveResult.pdfFile?.id,
            ordenNumero: trainingData.ORDNumero,
            cliente: trainingData.ORDCliente
        });
    } catch (err) {
        logger.error({ err }, "Error en endpoint de PDF de coordinación de entrenamiento");
        return res.status(500).json({
            ok: false,
            message: err.message || "Error generando PDF de coordinación de entrenamiento",
        });
    }
};

module.exports = {
    generateTrainingCoordinationPDF,
    generateTrainingPDF,
};
