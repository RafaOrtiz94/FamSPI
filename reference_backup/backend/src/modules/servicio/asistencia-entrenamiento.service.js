/**
 * src/modules/servicio/asistencia-entrenamiento.service.js
 * --------------------------------------------
 * 📄 PDF Generation Service for Training Attendance List Records
 * - Fills F.ST-05_V03_LISTA DE ASISTENCIA ENTRENAMIENTOS template
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
    "F.ST-05_V03_LISTA DE ASISTENCIA ENTRENAMIENTOS.pdf"
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
 * Generate PDF for training attendance list
 */
const generateAttendanceListPDF = async (attendanceData) => {
    console.log("📝 Backend: Starting training attendance list PDF generation", {
        ordenNumero: attendanceData.Num_Orden,
        cliente: attendanceData.ORDCliente,
        equipo: attendanceData.ORDEquipo,
        hasAttendees: !!attendanceData.Nombres_Apellidos1,
        hasSignature: !!attendanceData.Firma_Especialista
    });

    // Load template
    console.log("📝 Backend: Loading training attendance list PDF template");
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const baseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    console.log("📝 Backend: PDF template loaded successfully");

    // Handle signature - can be base64 data or Google Drive file ID
    let signatureBuffer = null;
    if (attendanceData.Firma_Especialista) {
        // Check if it's base64 data (starts with signature-like string)
        if (typeof attendanceData.Firma_Especialista === 'string' && attendanceData.Firma_Especialista.length > 100) {
            // Assume it's base64 data from the frontend
            try {
                const base64Data = attendanceData.Firma_Especialista.replace(/^data:image\/\w+;base64,/, '');
                signatureBuffer = Buffer.from(base64Data, 'base64');
                logger.info("Attendance signature processed as base64 data");
            } catch (err) {
                logger.warn({ err }, "Error processing attendance signature as base64");
            }
        } else {
            // Try to download from Google Drive
            signatureBuffer = await downloadSignatureFromDrive(attendanceData.Firma_Especialista);
        }
    }

    // 1️⃣ DATOS GENERALES DEL ENTRENAMIENTO
    setFieldText(form, "Num_Orden", attendanceData.Num_Orden || "");
    setFieldText(form, "ORDFecha", attendanceData.ORDFecha || "");
    setFieldText(form, "ORDCliente", attendanceData.ORDCliente || "");
    setFieldText(form, "ORDEquipo", attendanceData.ORDEquipo || "");
    setFieldText(form, "ORDSerie", attendanceData.ORDSerie || "");
    setFieldText(form, "ORDResponsable", attendanceData.ORDResponsable || "");

    // 2️⃣ TABLA DE ASISTENCIA (Hasta 7 asistentes)
    // Nombres y Apellidos
    for (let i = 1; i <= 7; i++) {
        setFieldText(form, `Nombres_Apellidos${i}`, attendanceData[`Nombres_Apellidos${i}`] || "");
        setFieldText(form, `Cargo${i}`, attendanceData[`Cargo${i}`] || "");
        setFieldText(form, `Correo_Electrónico${i}`, attendanceData[`Correo_Electrónico${i}`] || "");
    }

    // 3️⃣ ASISTENCIA POR DÍA (Hasta 3 días, 7 asistentes cada uno)
    for (let day = 1; day <= 3; day++) {
        for (let attendee = 1; attendee <= 7; attendee++) {
            const fieldName = `Dia_${day}_${attendee}`;
            const value = attendanceData[fieldName];
            // Set attendance mark (typically "✔️" for present, "" for absent)
            setFieldText(form, fieldName, value || "");
        }
    }

    // 4️⃣ FIRMA DEL ESPECIALISTA
    // Set signature in image field
    if (signatureBuffer) {
        try {
            console.log("📝 Backend: Attempting to embed attendance specialist signature, buffer size:", signatureBuffer.length);
            let signatureImage = await pdfDoc.embedPng(signatureBuffer);
            console.log("📝 Backend: Attendance specialist signature image embedded in PDF document");

            const signatureField = form.getField("Firma_Especialista");
            console.log("📝 Backend: Retrieved attendance specialist signature field:", !!signatureField);

            if (signatureField) {
                console.log("📝 Backend: Attendance specialist signature field type:", signatureField.constructor.name);
                console.log("📝 Backend: Field has setImage method:", typeof signatureField.setImage === "function");

                if (typeof signatureField.setImage === "function") {
                    signatureField.setImage(signatureImage);
                    console.log("📝 Backend: Attendance specialist signature embedded successfully in image field");
                } else {
                    console.log("📝 Backend: Field doesn't have setImage method, signature not embedded");
                }
            } else {
                console.log("📝 Backend: Attendance specialist signature field not found");
            }
        } catch (sigErr) {
            console.error({ sigErr }, "📝 Backend: Error embedding attendance specialist signature image");
        }
    } else {
        console.log("📝 Backend: No attendance specialist signature buffer available");
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
        logger.warn({ appearanceErr }, "No se pudieron ajustar apariencias de campos de asistencia");
    }

    // Don't flatten the form to avoid corruption
    // form.flatten();

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};

/**
 * Save attendance files to Google Drive with proper folder structure
 */
const saveAttendanceToDrive = async (pdfBuffer, attendanceData, user = null) => {
    try {
        console.log("📝 Backend: Starting training attendance Google Drive save process", {
            hasPDF: !!pdfBuffer,
            pdfSize: pdfBuffer?.length,
            ordenNumero: attendanceData.Num_Orden,
            cliente: attendanceData.ORDCliente,
            user: user?.email || user?.name || 'No user'
        });

        const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;

        if (!DRIVE_ROOT_FOLDER_ID) {
            console.log("📝 Backend: DRIVE_ROOT_FOLDER_ID not configured");
            logger.warn("DRIVE_ROOT_FOLDER_ID no configurado, omitiendo guardado en Drive");
            return null;
        }

        // 1. Create Servicio Técnico folder
        console.log("📝 Backend: Creating Servicio Técnico folder");
        const servicioTecnicoFolder = await ensureFolder("Servicio Técnico", DRIVE_ROOT_FOLDER_ID);
        console.log("📝 Backend: Servicio Técnico folder created", { id: servicioTecnicoFolder.id });

        // 2. Create Entrenamiento folder
        console.log("📝 Backend: Creating Entrenamiento folder");
        const entrenamientoFolder = await ensureFolder("Entrenamiento", servicioTecnicoFolder.id);
        console.log("📝 Backend: Entrenamiento folder created", { id: entrenamientoFolder.id });

        // 3. Create identificative folder (order number + client + date + user)
        const timestamp = new Date().toISOString().split('T')[0];
        const userName = user?.name || user?.fullname || user?.email || 'Usuario';
        const safeUserName = userName.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30); // Clean and limit length
        const safeClient = (attendanceData.ORDCliente || 'Cliente').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30);
        const identificativeName = `${attendanceData.Num_Orden}-${safeClient}-${timestamp}-${safeUserName}`;
        console.log("📝 Backend: Creating attendance record folder", { name: identificativeName });
        const recordFolder = await ensureFolder(identificativeName, entrenamientoFolder.id);
        console.log("📝 Backend: Attendance record folder created", { id: recordFolder.id });

        // 4. Save PDF
        const pdfBase64 = pdfBuffer.toString('base64');
        const pdfFile = await uploadBase64File(
            `F.ST-05_Lista_Asistencia_${attendanceData.Num_Orden}_${timestamp}.pdf`,
            pdfBase64,
            "application/pdf",
            recordFolder.id
        );

        return {
            folderId: recordFolder.id,
            pdfFile: pdfFile,
            images: [] // No additional images for attendance list
        };

    } catch (err) {
        logger.error({ err }, "Error guardando archivos de asistencia de entrenamiento en Google Drive");
        // Don't throw error, just log it - PDF generation should still work
        return null;
    }
};

/**
 * Generate PDF endpoint handler for training attendance list
 */
const generateAttendanceListPDFEndpoint = async (req, res) => {
    try {
        const attendanceData = req.body;

        // Validation rules - Num_Orden obligatorio
        if (!attendanceData.Num_Orden) {
            return res.status(400).json({
                ok: false,
                message: "El número de orden (Num_Orden) es obligatorio",
            });
        }

        // ORDFecha obligatoria
        if (!attendanceData.ORDFecha) {
            return res.status(400).json({
                ok: false,
                message: "La fecha del entrenamiento (ORDFecha) es obligatoria",
            });
        }

        // ORDResponsable obligatorio
        if (!attendanceData.ORDResponsable) {
            return res.status(400).json({
                ok: false,
                message: "El responsable (ORDResponsable) es obligatorio",
            });
        }

        // At least one attendee required
        let hasAttendees = false;
        for (let i = 1; i <= 7; i++) {
            if (attendanceData[`Nombres_Apellidos${i}`] && attendanceData[`Nombres_Apellidos${i}`].trim()) {
                hasAttendees = true;

                // If attendee name exists, cargo and email are required
                if (!attendanceData[`Cargo${i}`] || !attendanceData[`Correo_Electrónico${i}`]) {
                    return res.status(400).json({
                        ok: false,
                        message: `Para el asistente ${i} (${attendanceData[`Nombres_Apellidos${i}`]}), el cargo y correo electrónico son obligatorios`,
                    });
                }

                // Check if attendee has at least one attendance mark
                let hasAttendance = false;
                for (let day = 1; day <= 3; day++) {
                    if (attendanceData[`Dia_${day}_${i}`] && attendanceData[`Dia_${day}_${i}`].trim()) {
                        hasAttendance = true;
                        break;
                    }
                }

                if (!hasAttendance) {
                    return res.status(400).json({
                        ok: false,
                        message: `El asistente ${i} (${attendanceData[`Nombres_Apellidos${i}`]}) debe tener al menos una marca de asistencia`,
                    });
                }
            }
        }

        if (!hasAttendees) {
            return res.status(400).json({
                ok: false,
                message: "Debe registrar al menos un asistente",
            });
        }

        // Specialist signature required
        if (!attendanceData.Firma_Especialista || attendanceData.Firma_Especialista.length < 10) {
            return res.status(400).json({
                ok: false,
                message: "La firma del especialista es obligatoria",
            });
        }

        const pdfBuffer = await generateAttendanceListPDF(attendanceData);

        // Check if buffer is valid
        if (!pdfBuffer || pdfBuffer.length === 0) {
            logger.error("Attendance PDF buffer is empty or invalid");
            return res.status(500).json({
                ok: false,
                message: "Error: PDF de asistencia generado está vacío",
            });
        }

        logger.info(`PDF de lista de asistencia generado correctamente, tamaño: ${pdfBuffer.length} bytes`);

        // Save to Google Drive (required - if this fails, return error)
        const driveResult = await saveAttendanceToDrive(pdfBuffer, attendanceData, req.userInfo);

        if (!driveResult) {
            logger.error("Error guardando archivos de asistencia en Google Drive");
            return res.status(500).json({
                ok: false,
                message: "Error guardando archivos en Google Drive",
            });
        }

        logger.info({
            folderId: driveResult.folderId,
            pdfId: driveResult.pdfFile?.id,
            imageCount: driveResult.images?.length || 0
        }, "Archivos de lista de asistencia guardados en Google Drive");

        // Return success without downloading PDF
        res.json({
            ok: true,
            message: "Lista de asistencia de entrenamiento registrada correctamente",
            driveFolderId: driveResult.folderId,
            pdfId: driveResult.pdfFile?.id,
            ordenNumero: attendanceData.Num_Orden,
            cliente: attendanceData.ORDCliente
        });
    } catch (err) {
        logger.error({ err }, "Error en endpoint de PDF de lista de asistencia");
        return res.status(500).json({
            ok: false,
            message: err.message || "Error generando PDF de lista de asistencia",
        });
    }
};

module.exports = {
    generateAttendanceListPDF,
    generateAttendanceListPDFEndpoint,
};
