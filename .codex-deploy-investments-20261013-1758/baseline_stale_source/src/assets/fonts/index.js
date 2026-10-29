/**
 * Centralized Times New Roman font loader for pdf-lib.
 * Reads from bundled TTF files (identical across environments).
 *
 * Usage:
 *   const { loadTimesNewRoman } = require("../../assets/fonts");
 *   const { bold, reg } = await loadTimesNewRoman(pdfDoc);
 */

const fs       = require("fs");
const path     = require("path");
const fontkit  = require("@pdf-lib/fontkit");

const DIR = __dirname;

const PATHS = {
  regular: path.join(DIR, "TimesNewRoman-Regular.ttf"),
  bold:    path.join(DIR, "TimesNewRoman-Bold.ttf"),
  italic:  path.join(DIR, "TimesNewRoman-Italic.ttf"),
};

/**
 * Embeds Times New Roman Bold + Regular into a PDFDocument.
 * Returns { bold, reg, italic } (italic is optional, only if needed).
 */
async function loadTimesNewRoman(pdfDoc, { italic = false } = {}) {
  pdfDoc.registerFontkit(fontkit);

  const regBytes  = fs.readFileSync(PATHS.regular);
  const boldBytes = fs.readFileSync(PATHS.bold);

  const reg  = await pdfDoc.embedFont(regBytes,  { subset: true });
  const bold = await pdfDoc.embedFont(boldBytes, { subset: true });

  if (italic) {
    const italicBytes = fs.readFileSync(PATHS.italic);
    const ital = await pdfDoc.embedFont(italicBytes, { subset: true });
    return { bold, reg, ital };
  }

  return { bold, reg };
}

module.exports = { loadTimesNewRoman };
