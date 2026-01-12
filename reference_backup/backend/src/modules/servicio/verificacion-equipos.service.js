/**
 * src/modules/servicio/verificacion-equipos.service.js
 * --------------------------------------------
 * 📄 PDF Generation Service for Equipment Verification Records
 * - Fills F.ST-09_V03_VERIFICACIÓN DE EQUIPOS NUEVOS template
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
    "F.ST-09_V03_VERIFICACIÓN DE EQUIPOS NUEVOS.pdf"
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
 * Download multiple images from Google Drive for annexes
 */
const downloadAnnexesFromDrive = async (fileIds) => {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return [];
    }

    const annexBuffers = [];
    for (const fileId of fileIds) {
        try {
            const response = await drive.files.get(
                { fileId, alt: "media", supportsAllDrives: true },
                { responseType: "arraybuffer" }
            );
            annexBuffers.push(Buffer.from(response.data));
        } catch (err) {
            logger.warn({ err, fileId }, "Error downloading annex from Drive");
        }
    }
    return annexBuffers;
};

/**
 * Generate PDF for equipment verification record
 */
const generateEquipmentVerificationPDF = async (verificationData) => {
    console.log("🔧 Backend: Starting equipment verification PDF generation", {
        fecha: verificationData.Fecha,
        cliente: verificationData.Cliente,
        equipo: verificationData.Equipo,
        serie: verificationData.Serie,
        hasResultados: !!verificationData.RESULTADOS,
        hasAnalisis: !!verificationData.ANALISIS,
        hasSignature: !!verificationData.firma_af_image,
        annexesCount: Array.isArray(verificationData.anexos_af_image) ? verificationData.anexos_af_image.length : 0
    });

    // Load template
    console.log("🔧 Backend: Loading equipment verification PDF template");
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const baseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    console.log("🔧 Backend: PDF template loaded successfully");

    // Handle signature - can be base64 data or Google Drive file ID
    let signatureBuffer = null;
    if (verificationData.firma_af_image) {
        // Check if it's base64 data (starts with signature-like string)
        if (typeof verificationData.firma_af_image === 'string' && verificationData.firma_af_image.length > 100) {
            // Assume it's base64 data from the frontend
            try {
                const base64Data = verificationData.firma_af_image.replace(/^data:image\/\w+;base64,/, '');
                signatureBuffer = Buffer.from(base64Data, 'base64');
                logger.info("Verification signature processed as base64 data");
            } catch (err) {
                logger.warn({ err }, "Error processing verification signature as base64");
            }
        } else {
            // Try to download from Google Drive
            signatureBuffer = await downloadSignatureFromDrive(verificationData.firma_af_image);
        }
    }

    // Handle annexes/evidencia - multiple images
    let annexBuffers = [];
    if (verificationData.anexos_af_image && Array.isArray(verificationData.anexos_af_image)) {
        // Check if they are base64 data or Google Drive file IDs
        const base64Annexes = verificationData.anexos_af_image.filter(annex =>
            typeof annex === 'string' && annex.length > 100 && annex.includes('data:image')
        );

        if (base64Annexes.length > 0) {
            // Process base64 annexes
            annexBuffers = base64Annexes.map(annex => {
                try {
                    const base64Data = annex.replace(/^data:image\/\w+;base64,/, '');
                    return Buffer.from(base64Data, 'base64');
                } catch (err) {
                    logger.warn({ err }, "Error processing annex as base64");
                    return null;
                }
            }).filter(buffer => buffer !== null);
        } else {
            // Try to download from Google Drive
            annexBuffers = await downloadAnnexesFromDrive(verificationData.anexos_af_image);
        }
    }

    // 2️⃣ DATOS GENERALES DEL EQUIPO
    setFieldText(form, "Fecha", verificationData.Fecha || "");
    setFieldText(form, "Cliente", verificationData.Cliente || "");
    setFieldText(form, "Equipo", verificationData.Equipo || "");
    setFieldText(form, "Serie", verificationData.Serie || "");

    // 3️⃣ RESULTADOS (Estado inicial, pruebas funcionales, etc.)
    setFieldText(form, "RESULTADOS", verificationData.RESULTADOS || "");

    // 4️⃣ ANÁLISIS (Interpretación técnica, recomendación)
    setFieldText(form, "ANALISIS", verificationData.ANALISIS || "");

    // 5️⃣ FIRMA DEL ESPECIALISTA
    // Set signature in image field
    if (signatureBuffer) {
        try {
            console.log("🔧 Backend: Attempting to embed verification specialist signature, buffer size:", signatureBuffer.length);
            let signatureImage = await pdfDoc.embedPng(signatureBuffer);
            console.log("🔧 Backend: Verification specialist signature image embedded in PDF document");

            const signatureField = form.getField("firma_af_image");
            console.log("🔧 Backend: Retrieved verification specialist signature field:", !!signatureField);

            if (signatureField) {
                console.log("🔧 Backend: Verification specialist signature field type:", signatureField.constructor.name);
                console.log("🔧 Backend: Field has setImage method:", typeof signatureField.setImage === "function");

                if (typeof signatureField.setImage === "function") {
                    signatureField.setImage(signatureImage);
                    console.log("🔧 Backend: Verification specialist signature embedded successfully in image field");
                } else {
                    console.log("🔧 Backend: Field doesn't have setImage method, signature not embedded");
                }
            } else {
                console.log("🔧 Backend: Verification specialist signature field not found");
            }
        } catch (sigErr) {
            console.error({ sigErr }, "🔧 Backend: Error embedding verification specialist signature image");
        }
    } else {
        console.log("🔧 Backend: No verification specialist signature buffer available");
    }

    // TODO: Handle anexos_af_image field for evidence photos
    // The template might have a specific field for annexes or they might be added as attachments

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
        logger.warn({ appearanceErr }, "No se pudieron ajustar apariencias de campos de verificación");
    }

    // Don't flatten the form to avoid corruption
    // form.flatten();

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};

/**
 * Save verification files to Google Drive with proper folder structure
 */
const saveVerificationToDrive = async (pdfBuffer, verificationData, user = null) => {
    try {
        console.log("🔧 Backend: Starting equipment verification Google Drive save process", {
            hasPDF: !!pdfBuffer,
            pdfSize: pdfBuffer?.length,
            fecha: verificationData.Fecha,
            cliente: verificationData.Cliente,
            equipo: verificationData.Equipo,
            serie: verificationData.Serie,
            user: user?.email || user?.name || 'No user'
        });

        const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;

        if (!DRIVE_ROOT_FOLDER_ID) {
            console.log("🔧 Backend: DRIVE_ROOT_FOLDER_ID not configured");
            logger.warn("DRIVE_ROOT_FOLDER_ID no configurado, omitiendo guardado en Drive");
            return null;
        }

        // 1. Create Servicio Técnico folder
        console.log("🔧 Backend: Creating Servicio Técnico folder");
        const servicioTecnicoFolder = await ensureFolder("Servicio Técnico", DRIVE_ROOT_FOLDER_ID);
        console.log("🔧 Backend: Servicio Técnico folder created", { id: servicioTecnicoFolder.id });

        // 2. Create Verificación folder
        console.log("🔧 Backend: Creating Verificación folder");
        const verificacionFolder = await ensureFolder("Verificación", servicioTecnicoFolder.id);
        console.log("🔧 Backend: Verificación folder created", { id: verificacionFolder.id });

        // 3. Create identificative folder (client + equipment + series + date + user)
        const timestamp = new Date().toISOString().split('T')[0];
        const userName = user?.name || user?.fullname || user?.email || 'Usuario';
        const safeUserName = userName.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30); // Clean and limit length
        const safeClient = (verificationData.Cliente || 'Cliente').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30);
        const safeEquipo = (verificationData.Equipo || 'Equipo').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30);
        const identificativeName = `${safeClient}-${safeEquipo}-${verificationData.Serie || 'SN'}-${timestamp}-${safeUserName}`;
        console.log("🔧 Backend: Creating verification record folder", { name: identificativeName });
        const recordFolder = await ensureFolder(identificativeName, verificacionFolder.id);
        console.log("🔧 Backend: Verification record folder created", { id: recordFolder.id });

        // 4. Save PDF
        const pdfBase64 = pdfBuffer.toString('base64');
        const pdfFile = await uploadBase64File(
            `F.ST-09_Verificación_Equipo_${verificationData.Equipo || 'Equipo'}_${timestamp}.pdf`,
            pdfBase64,
            "application/pdf",
            recordFolder.id
        );

        return {
            folderId: recordFolder.id,
            pdfFile: pdfFile,
            images: [] // Annexes are embedded in PDF or could be uploaded separately
        };

    } catch (err) {
        logger.error({ err }, "Error guardando archivos de verificación de equipos en Google Drive");
        // Don't throw error, just log it - PDF generation should still work
        return null;
    }
};

/**
 * Generate PDF endpoint handler for equipment verification
 */
const generateEquipmentVerificationPDFEndpoint = async (req, res) => {
    try {
        const verificationData = req.body;

        // Validation rules
        if (!verificationData.Fecha) {
            return res.status(400).json({
                ok: false,
                message: "La fecha (Fecha) es obligatoria",
            });
        }

        if (!verificationData.Cliente) {
            return res.status(400).json({
                ok: false,
                message: "El cliente (Cliente) es obligatorio",
            });
        }

        if (!verificationData.Equipo) {
            return res.status(400).json({
                ok: false,
                message: "El equipo (Equipo) es obligatorio",
            });
        }

        if (!verificationData.Serie) {
            return res.status(400).json({
                ok: false,
                message: "La serie (Serie) es obligatoria",
            });
        }

        // Validate that RESULTADOS is not empty and has meaningful content
        if (!verificationData.RESULTADOS || verificationData.RESULTADOS.trim().length < 10) {
            return res.status(400).json({
                ok: false,
                message: "Los RESULTADOS son obligatorios y deben contener detalles técnicos (mínimo 10 caracteres)",
            });
        }

        // Validate that ANALISIS is not empty and has meaningful content
        if (!verificationData.ANALISIS || verificationData.ANALISIS.trim().length < 10) {
            return res.status(400).json({
                ok: false,
                message: "El ANÁLISIS es obligatorio y debe contener interpretación técnica (mínimo 10 caracteres)",
            });
        }

        // Specialist signature required
        if (!verificationData.firma_af_image || verificationData.firma_af_image.length < 10) {
            return res.status(400).json({
                ok: false,
                message: "La firma del especialista es obligatoria",
            });
        }

        const pdfBuffer = await generateEquipmentVerificationPDF(verificationData);

        // Check if buffer is valid
        if (!pdfBuffer || pdfBuffer.length === 0) {
            logger.error("Verification PDF buffer is empty or invalid");
            return res.status(500).json({
                ok: false,
                message: "Error: PDF de verificación generado está vacío",
            });
        }

        logger.info(`PDF de verificación de equipo generado correctamente, tamaño: ${pdfBuffer.length} bytes`);

        // Save to Google Drive (required - if this fails, return error)
        const driveResult = await saveVerificationToDrive(pdfBuffer, verificationData, req.userInfo);

        if (!driveResult) {
            logger.error("Error guardando archivos de verificación en Google Drive");
            return res.status(500).json({
                ok: false,
                message: "Error guardando archivos en Google Drive",
            });
        }

        logger.info({
            folderId: driveResult.folderId,
            pdfId: driveResult.pdfFile?.id,
            imageCount: driveResult.images?.length || 0
        }, "Archivos de verificación de equipos guardados en Google Drive");

        // Return success without downloading PDF
        res.json({
            ok: true,
            message: "Verificación de equipo registrada correctamente",
            driveFolderId: driveResult.folderId,
            pdfId: driveResult.pdfFile?.id,
            fecha: verificationData.Fecha,
            cliente: verificationData.Cliente,
            equipo: verificationData.Equipo,
            serie: verificationData.Serie
        });
    } catch (err) {
        logger.error({ err }, "Error en endpoint de PDF de verificación de equipos");
        return res.status(500).json({
            ok: false,
            message: err.message || "Error generando PDF de verificación de equipos",
        });
    }
};

module.exports = {
    generateEquipmentVerificationPDF,
    generateEquipmentVerificationPDFEndpoint,
};
