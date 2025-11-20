/**
 * src/modules/attendance/attendance.calibration.service.js
 * ---------------------------------------------------------
 * 🧪 PDF Calibration Generator
 * - Loads base template
 * - Draws coordinate grid, labels
 * - Outputs annotated PDF for measurement
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const logger = require("../../config/logger");

const TEMPLATE_PATH = path.join(
  __dirname,
  "../../data/plantillas/F.RH-09_V01_REGISTRO DE ASISTENCIA .pdf"
);

/**
 * 📌 Generate calibration PDF
 */
const generateCalibrationPDF = async (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.status(404).json({
        ok: false,
        message: `Plantilla no encontrada en: ${TEMPLATE_PATH}`,
      });
    }

    // Load template
    const pdfBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    const page = pages[0];

    const { width, height } = page.getSize();

    // Draw grid every 50px
    const step = 50;
    const lineColor = rgb(0.8, 0.1, 0.1);

    for (let x = 0; x < width; x += step) {
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: height },
        thickness: 0.5,
        color: lineColor,
      });

      page.drawText(`X:${x}`, {
        x: x + 2,
        y: height - 12,
        size: 8,
        color: rgb(0, 0, 0.7),
      });
    }

    for (let y = 0; y < height; y += step) {
      page.drawLine({
        start: { x: 0, y },
        end: { x: width, y },
        thickness: 0.5,
        color: lineColor,
      });

      page.drawText(`Y:${y}`, {
        x: 2,
        y: y + 2,
        size: 8,
        color: rgb(0, 0, 0.7),
      });
    }

    // Footer mark
    page.drawText("🔧 MODO CALIBRACIÓN — NO USAR PARA FIRMAR NI ENVIAR", {
      x: 50,
      y: 20,
      size: 10,
      color: rgb(0.8, 0.1, 0.1),
    });

    const finalPdf = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=CALIBRACION_REGISTRO_ASISTENCIA.pdf`
    );

    res.send(Buffer.from(finalPdf));
  } catch (err) {
    logger.error({ err }, "❌ Error generando PDF de calibración");
    return res.status(500).json({
      ok: false,
      message: "Error generando PDF de calibración",
    });
  }
};

module.exports = { generateCalibrationPDF };
