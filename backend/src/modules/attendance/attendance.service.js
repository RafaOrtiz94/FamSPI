/**
 * src/modules/attendance/attendance.service.js
 * --------------------------------------------
 * 📄 PDF Generation Service for Attendance Reports
 * - Fills predefined PDF form template with attendance data
 * - Embeds employee signatures where available
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { google, oauth2Client } = require("../../config/oauth");

const TEMPLATE_PATH = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "plantillas",
    "F.RH-09_V01_PLANTILLA_RA.pdf"
);

/**
 * Download signature image from Google Drive
 */
const downloadSignatureFromDrive = async (fileId) => {
    try {
        const drive = google.drive({ version: "v3", auth: oauth2Client });
        const response = await drive.files.get(
            { fileId, alt: "media" },
            { responseType: "arraybuffer" }
        );
        return Buffer.from(response.data);
    } catch (err) {
        logger.error({ err, fileId }, "Error downloading signature from Drive");
        return null;
    }
};

/**
 * Format time in HH:mm 24h format
 */
const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

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
 * Attempt to set an image into a field (button) or fall back to text note
 */
const setFieldSignature = async (pdfDoc, form, fieldName, signatureBuffer) => {
    try {
        const field = form.getField(fieldName);
        if (!field) return;

        if (signatureBuffer) {
            let image;
            try {
                image = await pdfDoc.embedPng(signatureBuffer);
            } catch (err) {
                image = await pdfDoc.embedJpg(signatureBuffer);
            }

            if (typeof field.setImage === "function") {
                field.setImage(image);
                return;
            }

            if (typeof field.setText === "function") {
                field.setText("Firma registrada");
                return;
            }
        }

        if (typeof field.setText === "function") {
            field.setText("Firma no disponible");
        }
    } catch (err) {
        logger.warn({ fieldName, err }, "No se pudo asignar firma al campo");
    }
};

/**
 * Generate PDF for single user attendance record using predefined template
 */
const generateAttendancePDF = async (userId, startDate, endDate) => {
    // Fetch attendance records
    const attendanceQuery = await db.query(
        `
      SELECT
        a.*,
        u.fullname,
        u.email,
        u.role,
        u.lopdp_internal_signature_file_id,
        d.name AS department_name
      FROM user_attendance_records a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE a.user_id = $1 AND a.date BETWEEN $2 AND $3
      ORDER BY a.date ASC
      `,
        [userId, startDate, endDate]
    );

    const records = attendanceQuery.rows;

    if (records.length === 0) {
        throw new Error("No se encontraron registros de asistencia");
    }

    const user = records[0];

    // Download signature if available
    let signatureBuffer = null;
    if (user.lopdp_internal_signature_file_id) {
        signatureBuffer = await downloadSignatureFromDrive(
            user.lopdp_internal_signature_file_id
        );
    }

    // Load template
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Set fixed fields
    const periodDate = new Date(startDate);
    setFieldText(form, "nombre_usuario", user.fullname || "");
    setFieldText(form, "ra_ano", `${periodDate.getFullYear()}`);
    setFieldText(
        form,
        "ra_mes",
        `${String(periodDate.getMonth() + 1).padStart(2, "0")}`
    );

    // Build map by day for quick lookup
    const recordsByDay = new Map();
    records.forEach((record) => {
        const day = new Date(record.date).getDate();
        recordsByDay.set(day, record);
    });

    // Populate daily fields
    for (let day = 1; day <= 31; day += 1) {
        const record = recordsByDay.get(day);

        const horaEntrada = record ? formatTime(record.entry_time) : "";
        const horaSalidaAlmuerzo = record
            ? formatTime(record.lunch_start_time)
            : "";
        const horaEntradaAlmuerzo = record
            ? formatTime(record.lunch_end_time)
            : "";
        const horaSalida = record ? formatTime(record.exit_time) : "";

        setFieldText(form, `hora_entrada_${day}`, horaEntrada);
        setFieldText(form, `hora_salida_${day}`, horaSalida);
        setFieldText(form, `hora_entrada_a_${day}`, horaSalidaAlmuerzo);
        setFieldText(form, `hora_salida_a_${day}`, horaEntradaAlmuerzo);
        setFieldText(form, `ra_observaciones_${day}`, "");

        await setFieldSignature(
            pdfDoc,
            form,
            `firma_fila_${day}`,
            signatureBuffer
        );
    }

    // Signatures at the bottom of the template
    await setFieldSignature(pdfDoc, form, "firma_uno", signatureBuffer);
    await setFieldSignature(pdfDoc, form, "firma_dos", signatureBuffer);

    form.flatten();

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};

/**
 * Generate PDF endpoint handler
 */
const generatePDF = async (req, res) => {
    try {
        const { userId } = req.params;
        const { start, end } = req.query;

        if (!start || !end) {
            return res.status(400).json({
                ok: false,
                message: "Fechas de inicio y fin requeridas (start, end)",
            });
        }

        const pdfBuffer = await generateAttendancePDF(userId, start, end);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=asistencia-${userId}-${start}-${end}.pdf`
        );

        res.send(pdfBuffer);
    } catch (err) {
        logger.error({ err }, "Error en endpoint de PDF");
        return res.status(500).json({
            ok: false,
            message: err.message || "Error generando PDF",
        });
    }
};

module.exports = {
    generateAttendancePDF,
    generatePDF,
};
