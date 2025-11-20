/**
 * src/modules/attendance/attendance.service.js
 * --------------------------------------------
 * 📄 PDF Generation Service for Attendance Reports
 * - Generates PDF with company format
 * - Embeds user signatures
 * - Fetches data from Google Drive
 */

const PDFDocument = require("pdfkit");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { google } = require("../../config/oauth");
const { oauth2Client } = require("../../config/oauth");
const { generateCalibrationPDF } = require("./attendance.calibration.service");

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
 * Format time for display
 */
const formatTime = (timestamp) => {
    if (!timestamp) return "---";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-EC", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

/**
 * Calculate total hours worked
 */
const calculateHours = (entryTime, exitTime, lunchStart, lunchEnd) => {
    if (!entryTime || !exitTime) return "---";

    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    let totalMs = exit - entry;

    // Subtract lunch break if both times are present
    if (lunchStart && lunchEnd) {
        const lunchStartTime = new Date(lunchStart);
        const lunchEndTime = new Date(lunchEnd);
        const lunchMs = lunchEndTime - lunchStartTime;
        totalMs -= lunchMs;
    }

    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
};

/**
 * Generate PDF for single user attendance record
 */
const generateAttendancePDF = async (userId, startDate, endDate) => {
    try {
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

        // Create PDF
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));

        // Header
        doc
            .fontSize(20)
            .font("Helvetica-Bold")
            .text("REGISTRO DE ASISTENCIA", { align: "center" });

        doc.moveDown(0.5);

        // Company info (customize as needed)
        doc
            .fontSize(10)
            .font("Helvetica")
            .text("FAM - Familia Agropecuaria Moderna", { align: "center" });

        doc.moveDown(1);

        // Employee information
        doc.fontSize(12).font("Helvetica-Bold").text("Información del Empleado");

        doc.moveDown(0.3);

        doc.fontSize(10).font("Helvetica");
        doc.text(`Nombre: ${user.fullname || "N/A"}`);
        doc.text(`Email: ${user.email || "N/A"}`);
        doc.text(`Cargo: ${user.role || "N/A"}`);
        doc.text(`Departamento: ${user.department_name || "N/A"}`);

        doc.moveDown(1);

        // Period
        doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .text(
                `Período: ${formatDate(startDate)} - ${formatDate(endDate)}`
            );

        doc.moveDown(1);

        // Table header
        const tableTop = doc.y;
        const colWidths = {
            date: 100,
            entry: 70,
            lunchOut: 70,
            lunchIn: 70,
            exit: 70,
            total: 70,
        };

        doc.fontSize(9).font("Helvetica-Bold");

        let x = 50;
        doc.text("Fecha", x, tableTop, { width: colWidths.date });
        x += colWidths.date;
        doc.text("Entrada", x, tableTop, { width: colWidths.entry });
        x += colWidths.entry;
        doc.text("Salida Alm.", x, tableTop, { width: colWidths.lunchOut });
        x += colWidths.lunchOut;
        doc.text("Entrada Alm.", x, tableTop, { width: colWidths.lunchIn });
        x += colWidths.lunchIn;
        doc.text("Salida", x, tableTop, { width: colWidths.exit });
        x += colWidths.exit;
        doc.text("Total", x, tableTop, { width: colWidths.total });

        // Draw line under header
        doc
            .moveTo(50, tableTop + 15)
            .lineTo(550, tableTop + 15)
            .stroke();

        doc.moveDown(1.5);

        // Table rows
        doc.font("Helvetica").fontSize(8);

        records.forEach((record, index) => {
            const rowY = doc.y;

            // Check if we need a new page
            if (rowY > 700) {
                doc.addPage();
                doc.y = 50;
            }

            let x = 50;

            // Date
            doc.text(
                new Date(record.date).toLocaleDateString("es-EC"),
                x,
                doc.y,
                { width: colWidths.date }
            );
            x += colWidths.date;

            // Entry time
            doc.text(formatTime(record.entry_time), x, rowY, {
                width: colWidths.entry,
            });
            x += colWidths.entry;

            // Lunch out
            doc.text(formatTime(record.lunch_start_time), x, rowY, {
                width: colWidths.lunchOut,
            });
            x += colWidths.lunchOut;

            // Lunch in
            doc.text(formatTime(record.lunch_end_time), x, rowY, {
                width: colWidths.lunchIn,
            });
            x += colWidths.lunchIn;

            // Exit
            doc.text(formatTime(record.exit_time), x, rowY, {
                width: colWidths.exit,
            });
            x += colWidths.exit;

            // Total hours
            doc.text(
                calculateHours(
                    record.entry_time,
                    record.exit_time,
                    record.lunch_start_time,
                    record.lunch_end_time
                ),
                x,
                rowY,
                { width: colWidths.total }
            );

            doc.moveDown(0.8);
        });

        doc.moveDown(2);

        // Signature section
        if (signatureBuffer) {
            doc.fontSize(10).font("Helvetica-Bold").text("Firma del Empleado:");
            doc.moveDown(0.5);

            try {
                doc.image(signatureBuffer, {
                    fit: [150, 50],
                    align: "left",
                });
            } catch (imgErr) {
                logger.warn("Could not embed signature image in PDF");
                doc.fontSize(8).font("Helvetica-Oblique").text("(Firma no disponible)");
            }
        } else {
            doc.fontSize(10).font("Helvetica-Bold").text("Firma del Empleado:");
            doc.moveDown(0.5);
            doc
                .fontSize(8)
                .font("Helvetica-Oblique")
                .text("(El empleado no ha registrado su firma)");
        }

        doc.moveDown(1);

        // Footer
        doc
            .fontSize(8)
            .font("Helvetica")
            .text(
                `Generado el: ${new Date().toLocaleString("es-EC")}`,
                50,
                doc.page.height - 50,
                { align: "center" }
            );

        // Finalize PDF
        doc.end();

        return new Promise((resolve, reject) => {
            doc.on("end", () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on("error", reject);
        });
    } catch (err) {
        logger.error({ err }, "Error generating attendance PDF");
        throw err;
    }
};

/**
 * Generate PDF endpoint handler
 */
const generatePDF = async (req, res) => {
    try {
        const { userId } = req.params;
        const { start, end } = req.query;

        // Allow calibration access even if the route falls through due to ordering issues
        if (userId === "calibrate") {
            return generateCalibrationPDF(req, res);
        }

        if (!start || !end) {
            return res.status(400).json({
                ok: false,
                message: "Fechas de inicio y fin requeridas (start, end)",
            });
        }

        const pdfBuffer = await generateAttendancePDF(userId, start, end);

        // Set response headers
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
