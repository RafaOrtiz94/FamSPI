/**
 * src/modules/servicio/asistencia-entrenamiento.service.js
 * --------------------------------------------
 * PDF Generation Service for Training Attendance List Records
 * - Fills F.ST-05_V03_LISTA DE ASISTENCIA ENTRENAMIENTOS template
 * - Handles signature embedding and Google Drive storage
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const { securePdfForm } = require("../../utils/pdfFormSecurity");
const { registerFst05TrainingDocument } = require("./trainingWorkflow.service");

const TEMPLATE_PATH = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "plantillas",
    "F.ST-05_V03_LISTA DE ASISTENCIA ENTRENAMIENTOS.pdf"
);

const MAX_TEMPLATE_ATTENDEES = 7;

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

const toMark = (value) => {
    if (value === true || value === 1) return "X";
    const normalized = String(value || "").trim().toLowerCase();
    if (["x", "si", "sí", "true", "1", "ok", "presente"].includes(normalized)) return "X";
    return "";
};

const resolveTemplateDayFieldName = (day, attendeePosition) => (
    attendeePosition === 1 ? `Dia_${day}` : `Dia_${day}_${attendeePosition}`
);

const normalizeIncomingAttendees = (attendanceData = {}) => {
    const incoming = Array.isArray(attendanceData.attendees) ? attendanceData.attendees : [];
    if (incoming.length > 0) {
        return incoming
            .map((attendee, index) => ({
                id: index + 1,
                nombre: String(attendee?.nombre || attendee?.name || attendee?.full_name || "").trim(),
                cargo: String(attendee?.cargo || attendee?.role || attendee?.role_title || "").trim(),
                email: String(attendee?.email || "").trim(),
                asistencia: {
                    dia1: toMark(attendee?.asistencia?.dia1 ?? attendee?.attendance?.day1) === "X",
                    dia2: toMark(attendee?.asistencia?.dia2 ?? attendee?.attendance?.day2) === "X",
                    dia3: toMark(attendee?.asistencia?.dia3 ?? attendee?.attendance?.day3) === "X",
                },
            }))
            .filter((attendee) => attendee.nombre);
    }

    const parsed = [];
    for (let i = 1; i <= 42; i += 1) {
        const nombre = String(attendanceData[`Nombres_Apellidos${i}`] || "").trim();
        const cargo = String(attendanceData[`Cargo${i}`] || "").trim();
        const email = String(attendanceData[`Correo_Electrónico${i}`] || attendanceData[`Correo_Electronico${i}`] || "").trim();
        if (!nombre && !cargo && !email) {
            if (i > MAX_TEMPLATE_ATTENDEES) break;
            continue;
        }
        parsed.push({
            id: i,
            nombre,
            cargo,
            email,
            asistencia: {
                dia1: toMark(i === 1 ? (attendanceData.Dia_1 ?? attendanceData.Dia_1_1) : attendanceData[`Dia_1_${i}`]) === "X",
                dia2: toMark(i === 1 ? (attendanceData.Dia_2 ?? attendanceData.Dia_2_1) : attendanceData[`Dia_2_${i}`]) === "X",
                dia3: toMark(i === 1 ? (attendanceData.Dia_3 ?? attendanceData.Dia_3_1) : attendanceData[`Dia_3_${i}`]) === "X",
            },
        });
    }
    return parsed;
};

const buildTemplateAttendanceData = (attendanceData = {}, attendees = []) => {
    const payload = { ...attendanceData };

    for (let i = 1; i <= MAX_TEMPLATE_ATTENDEES; i += 1) {
        payload[`Nombres_Apellidos${i}`] = "";
        payload[`Cargo${i}`] = "";
        payload[`Correo_Electrónico${i}`] = "";
        payload[resolveTemplateDayFieldName(1, i)] = "";
        payload[resolveTemplateDayFieldName(2, i)] = "";
        payload[resolveTemplateDayFieldName(3, i)] = "";
    }

    attendees.slice(0, MAX_TEMPLATE_ATTENDEES).forEach((attendee, index) => {
        const position = index + 1;
        payload[`Nombres_Apellidos${position}`] = attendee.nombre || "";
        payload[`Cargo${position}`] = attendee.cargo || "";
        payload[`Correo_Electrónico${position}`] = attendee.email || "";
        payload[resolveTemplateDayFieldName(1, position)] = attendee.asistencia?.dia1 ? "X" : "";
        payload[resolveTemplateDayFieldName(2, position)] = attendee.asistencia?.dia2 ? "X" : "";
        payload[resolveTemplateDayFieldName(3, position)] = attendee.asistencia?.dia3 ? "X" : "";
    });

    return payload;
};

/**
 * Generate PDF for training attendance list
 */
const generateAttendanceListPDF = async (attendanceData) => {
    console.log("[Attendance PDF] Starting training attendance list PDF generation", {
        ordenNumero: attendanceData.Num_Orden,
        cliente: attendanceData.ORDCliente,
        equipo: attendanceData.ORDEquipo,
        hasAttendees: !!attendanceData.Nombres_Apellidos1,
        attendeesCount: (Array.isArray(attendanceData.attendees) ? attendanceData.attendees.length : undefined) || 0,
        specialistSignatureProvided: !!attendanceData.Firma_Especialista
    });

    // Load template
    console.log("[Attendance PDF] Loading training attendance list PDF template");
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const baseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    console.log("[Attendance PDF] PDF template loaded successfully");

    // 1. DATOS GENERALES DEL ENTRENAMIENTO
    setFieldText(form, "Num_Orden", attendanceData.Num_Orden || "");
    setFieldText(form, "ORDFecha", attendanceData.ORDFecha || "");
    setFieldText(form, "ORDCliente", attendanceData.ORDCliente || "");
    setFieldText(form, "ORDEquipo", attendanceData.ORDEquipo || "");
    setFieldText(form, "ORDSerie", attendanceData.ORDSerie || "");
    setFieldText(form, "ORDResponsable", attendanceData.ORDResponsable || "");

    // 2. TABLA DE ASISTENCIA (Hasta 7 asistentes)
    // Nombres y Apellidos
    for (let i = 1; i <= 7; i++) {
        setFieldText(form, `Nombres_Apellidos${i}`, attendanceData[`Nombres_Apellidos${i}`] || "");
        setFieldText(form, `Cargo${i}`, attendanceData[`Cargo${i}`] || "");
        setFieldText(form, `Correo_Electrónico${i}`, attendanceData[`Correo_Electrónico${i}`] || "");
    }

    for (let day = 1; day <= 3; day += 1) {
        for (let attendee = 1; attendee <= MAX_TEMPLATE_ATTENDEES; attendee += 1) {
            const fieldName = resolveTemplateDayFieldName(day, attendee);
            const value = attendanceData[fieldName];
            setFieldText(form, fieldName, value || "");
        }
    }

    if (attendanceData.Firma_Especialista) {
        logger.info(
            "F.ST-05 no contiene campo nativo de firma especialista; la firma se gestiona por FamSign y metadata de workflow",
        );
    }


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

    securePdfForm(form);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};

/**
 * Save attendance files to Google Drive with proper folder structure
 */
const saveAttendanceToDrive = async (pdfBuffer, attendanceData, user = null) => {
    try {
        console.log("[Attendance PDF] Starting training attendance Google Drive save process", {
            hasPDF: !!pdfBuffer,
            pdfSize: pdfBuffer?.length,
            ordenNumero: attendanceData.Num_Orden,
            cliente: attendanceData.ORDCliente,
            user: user?.email || user?.name || 'No user'
        });

        const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;

        if (!DRIVE_ROOT_FOLDER_ID) {
            console.log("[Attendance PDF] DRIVE_ROOT_FOLDER_ID not configured");
            logger.warn("DRIVE_ROOT_FOLDER_ID no configurado, omitiendo guardado en Drive");
            return null;
        }


        console.log("[Attendance PDF] Creating Servicio Tecnico folder");
        const servicioTecnicoFolder = await ensureFolder("Servicio Técnico", DRIVE_ROOT_FOLDER_ID);
        console.log("[Attendance PDF] Servicio Tecnico folder created", { id: servicioTecnicoFolder.id });

        // 2. Create Entrenamiento folder
        console.log("[Attendance PDF] Creating Entrenamiento folder");
        const entrenamientoFolder = await ensureFolder("Entrenamiento", servicioTecnicoFolder.id);
        console.log("[Attendance PDF] Entrenamiento folder created", { id: entrenamientoFolder.id });

        // 3. Create identificative folder (order number + client + date + user)
        const timestamp = new Date().toISOString().split('T')[0];
        const userName = user?.name || user?.fullname || user?.email || 'Usuario';
        const safeUserName = userName.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30); // Clean and limit length
        const safeClient = (attendanceData.ORDCliente || 'Cliente').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 30);
        const identificativeName = `${attendanceData.Num_Orden}-${safeClient}-${timestamp}-${safeUserName}`;
        console.log("[Attendance PDF] Creating attendance record folder", { name: identificativeName });
        const recordFolder = await ensureFolder(identificativeName, entrenamientoFolder.id);
        console.log("[Attendance PDF] Attendance record folder created", { id: recordFolder.id });

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
        const attendanceData = req.body || {};

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

        const attendees = normalizeIncomingAttendees(attendanceData);
        if (!attendees.length) {
            return res.status(400).json({
                ok: false,
                message: "Debe registrar al menos un asistente",
            });
        }

        for (const attendee of attendees) {
            if (!attendee.cargo || !attendee.email) {
                return res.status(400).json({
                    ok: false,
                    message: `El asistente ${attendee.nombre} debe incluir cargo y correo electrónico`,
                });
            }
            const hasAttendance = Boolean(
                attendee.asistencia?.dia1 || attendee.asistencia?.dia2 || attendee.asistencia?.dia3,
            );
            if (!hasAttendance) {
                return res.status(400).json({
                    ok: false,
                    message: `El asistente ${attendee.nombre} debe tener al menos una marca de asistencia`,
                });
            }
        }

        const overflowAttendees = attendees.slice(MAX_TEMPLATE_ATTENDEES);
        const templateAttendanceData = buildTemplateAttendanceData(attendanceData, attendees);

        const pdfBuffer = await generateAttendanceListPDF(templateAttendanceData);

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
        const driveResult = await saveAttendanceToDrive(pdfBuffer, templateAttendanceData, req.userInfo);

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

        // Registrar documento en tabla documents para habilitar FamSign
        let documentRecord = null;
        try {
            const insert = await db.query(
                `INSERT INTO documents (doc_drive_id, folder_drive_id, signature_status, is_locked)
                 VALUES ($1,$2,'PENDING',false)
                 RETURNING id`,
                [driveResult.pdfFile?.id || null, driveResult.folderId || null]
            );
            documentRecord = insert.rows?.[0] || null;
            logger.info({ documentId: documentRecord?.id }, "Documento registrado para FamSign");
        } catch (docErr) {
            logger.warn({ docErr }, "No se pudo registrar el documento para FamSign");
        }

        const fst05Strategy = {
            template_day_fields: "Dia_1|Dia_2|Dia_3 para asistente 1, Dia_*_2..7 para asistentes 2-7",
            specialist_signature_strategy: "famsign_external_signature",
            attendee_capacity_strategy: overflowAttendees.length
                ? "template_limit_with_workflow_overflow"
                : "template_native_capacity",
            template_capacity: MAX_TEMPLATE_ATTENDEES,
            total_attendees: attendees.length,
            overflow_count: overflowAttendees.length,
        };

        let workflowDetail = null;
        try {
            workflowDetail = await registerFst05TrainingDocument({
                payload: {
                    ...attendanceData,
                    attendees: attendees.map((attendee) => ({
                        full_name: attendee.nombre,
                        role_title: attendee.cargo,
                        email: attendee.email,
                        attendance: {
                            day1: Boolean(attendee.asistencia?.dia1),
                            day2: Boolean(attendee.asistencia?.dia2),
                            day3: Boolean(attendee.asistencia?.dia3),
                        },
                    })),
                },
                document: {
                    file_id: driveResult.pdfFile?.id || null,
                    folder_id: driveResult.folderId || null,
                    link: driveResult.pdfFile?.webViewLink || null,
                },
                user: req.userInfo || req.user || null,
                strategy: fst05Strategy,
            });
        } catch (workflowError) {
            logger.warn({ workflowError }, "No se pudo sincronizar workflow de entrenamiento para F.ST-05");
        }

        // Return success without downloading PDF
        res.json({
            ok: true,
            message: "Lista de asistencia de entrenamiento registrada correctamente",
            driveFolderId: driveResult.folderId,
            pdfId: driveResult.pdfFile?.id,
            ordenNumero: attendanceData.Num_Orden,
            cliente: attendanceData.ORDCliente,
            documentId: documentRecord?.id || null,
            documentBase64: pdfBuffer.toString("base64"),
            workflow: workflowDetail,
            fst05Strategy,
            overflowAttendees: overflowAttendees.length,
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
