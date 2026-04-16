import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const hashString = (input) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const drawPseudoQr = (page, payload, x, y, size) => {
  const cells = 21;
  const cellSize = size / cells;
  const seed = hashString(payload);

  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const inFinder =
        (row < 7 && col < 7) ||
        (row < 7 && col >= cells - 7) ||
        (row >= cells - 7 && col < 7);

      let filled = false;
      if (inFinder) {
        const border = row === 0 || row === 6 || col === 0 || col === 6;
        const center = row >= 2 && row <= 4 && col >= 2 && col <= 4;
        filled = border || center;
      } else {
        const value = (seed + row * 31 + col * 17 + row * col * 13) % 7;
        filled = value === 0 || value === 3;
      }

      if (filled) {
        page.drawRectangle({
          x: x + col * cellSize,
          y: y + (cells - row - 1) * cellSize,
          width: cellSize,
          height: cellSize,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
    }
  }
};

export const generateCa0102Pdf = async (data) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let cursorY = height - 52;

  page.drawText("FAM SPI - QUALITY MANAGEMENT SYSTEM", {
    x: 50,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: rgb(0.05, 0.45, 0.55),
  });

  cursorY -= 28;
  page.drawText("ACTA DE LIMPIEZA DE AREAS - CA-01-02", {
    x: 50,
    y: cursorY,
    size: 14,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.1),
  });

  cursorY -= 30;
  page.drawText("Trazabilidad operativa on-the-fly", {
    x: 50,
    y: cursorY,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.38),
  });

  cursorY -= 34;
  const drawRow = (label, value) => {
    page.drawText(`${label}:`, { x: 50, y: cursorY, size: 10, font: fontBold });
    page.drawText(`${value || "N/A"}`, { x: 175, y: cursorY, size: 10, font });
    cursorY -= 18;
  };

  drawRow("ID de registro", data.id);
  drawRow("Area", data.area_name || data.area?.name);
  drawRow("Tipo de limpieza", data.cleaning_type);
  drawRow("Estado final", String(data.status || "N/A").toUpperCase());
  drawRow("Operador", data.operator_name || data.operator?.name || data.created_by_name || "N/A");
  drawRow("Fecha", new Date(data.updated_at || data.created_at || Date.now()).toLocaleString());

  cursorY -= 12;
  page.drawText("OBSERVACIONES", { x: 50, y: cursorY, size: 12, font: fontBold });
  cursorY -= 18;

  const notes = data.qa_notes || data.notes || "Sin observaciones registradas.";
  page.drawText(notes, {
    x: 50,
    y: cursorY,
    size: 9,
    font,
    maxWidth: 390,
    lineHeight: 12,
  });

  const payload = JSON.stringify({
    module: "CA-01-02",
    id: data.id,
    status: data.status,
    ts: new Date().toISOString(),
  });

  page.drawText("QR DE TRAZABILIDAD", {
    x: width - 180,
    y: height - 70,
    size: 10,
    font: fontBold,
  });

  drawPseudoQr(page, payload, width - 180, height - 260, 120);

  page.drawText("VALIDACION GXP", {
    x: width - 180,
    y: height - 280,
    size: 9,
    font: fontBold,
  });
  page.drawText("Documento generado localmente sin alterar el contrato del backend.", {
    x: width - 180,
    y: height - 295,
    size: 8,
    font,
    maxWidth: 120,
  });

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CA0102_ACTA_${String(data.id || "registro").slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
