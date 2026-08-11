/**
 * Utils: Google Drive / Docs
 * ---------------------------
 * - Crear carpetas, copiar plantillas y reemplazar {{etiquetas}}
 * - Subir archivos y firmas (base64)
 * - Exportar DOCX a PDF
 */

const { drive, docs } = require("../config/google");
const { Readable } = require("stream");
const logger = require("../config/logger");

const { HASH_ALGORITHM, computeSha256HexFromBuffer, registerIntegrity } = require("./documentHash");

// Convierte buffer/base64 en stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => { };
  readable.push(buffer);
  readable.push(null);
  return readable;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

const DEFAULT_FILE_FIELDS = [
  "id",
  "name",
  "mimeType",
  "parents",
  "driveId",
  "ownedByMe",
  "owners(emailAddress,displayName)",
  "shared",
  "webViewLink",
].join(",");

/** 📁 Crear carpeta dentro de Drive */
async function createFolder(name, parentId) {
  try {
    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name,
        mimeType: FOLDER_MIME,
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id, name, webViewLink",
    });
    return data;
  } catch (err) {
    logger.error({ err }, "❌ createFolder");
    throw err;
  }
}

/** 🔎 Buscar carpeta por nombre dentro de un parent */
async function findFolder(name, parentId) {
  if (!parentId) return null;
  try {
    const escapedName = name.replace(/'/g, "\\'");
    const q = [
      `'${parentId}' in parents`,
      `name = '${escapedName}'`,
      `mimeType = '${FOLDER_MIME}'`,
      "trashed = false",
    ].join(" and ");

    const { data } = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      q,
      fields: "files(id, name, webViewLink)",
    });

    return data.files?.[0] || null;
  } catch (err) {
    logger.error({ err }, "❌ findFolder");
    return null;
  }
}

/** ♻️ Obtiene o crea carpeta dentro de un parent */
async function ensureFolder(name, parentId) {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

async function ensureFolderPath(names = [], rootId) {
  if (!rootId) {
    const err = new Error("Se requiere rootId para resolver la ruta de carpetas");
    err.status = 500;
    throw err;
  }

  let parentId = rootId;
  let currentFolder = await getFileMetadata(rootId);

  for (const rawName of names) {
    const name = String(rawName || "").trim();
    if (!name) continue;
    currentFolder = await ensureFolder(name, parentId);
    parentId = currentFolder.id;
  }

  return currentFolder;
}

async function getFileMetadata(fileId, fields = DEFAULT_FILE_FIELDS) {
  if (!fileId) return null;

  try {
    const { data } = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields,
    });
    return data || null;
  } catch (err) {
    logger.error({ err, fileId }, "❌ getFileMetadata");
    throw err;
  }
}

async function moveFileToFolder(fileId, targetFolderId) {
  if (!fileId || !targetFolderId) {
    const err = new Error("fileId y targetFolderId son requeridos para mover archivos en Drive");
    err.status = 400;
    throw err;
  }

  const current = await getFileMetadata(fileId, "id,name,parents,webViewLink");
  const parents = Array.isArray(current?.parents) ? current.parents.filter(Boolean) : [];

  if (parents.includes(targetFolderId)) {
    return current;
  }

  const { data } = await drive.files.update({
    fileId,
    supportsAllDrives: true,
    addParents: targetFolderId,
    removeParents: parents.join(",") || undefined,
    fields: DEFAULT_FILE_FIELDS,
  });

  return data;
}

async function deleteFile(fileId) {
  if (!fileId) return false;
  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    return true;
  } catch (err) {
    logger.error({ err, fileId }, "❌ deleteFile");
    throw err;
  }
}

/** 📄 Copiar plantilla y crear documento editable (siempre como Google Doc nativo) */
async function copyTemplate(templateId, name, parentId) {
  if (!templateId) {
    const err = new Error("No se recibió un fileId de plantilla para copiar en Drive.");
    err.status = 500;
    throw err;
  }
  try {
    const { data } = await drive.files.copy({
      fileId: templateId,
      supportsAllDrives: true,
      requestBody: {
        name,
        parents: parentId ? [parentId] : undefined,
        // Fuerza conversión a Google Doc nativo si la plantilla es un archivo Office (.docx)
        // Necesario para poder usar Docs API (batchUpdate) y exportar a PDF con files.export
        mimeType: "application/vnd.google-apps.document",
      },
      fields: "id, name, webViewLink",
    });
    return data;
  } catch (err) {
    logger.error({ err }, "❌ copyTemplate");
    throw err;
  }
}

/** 🧩 Reemplazar placeholders en documento ({{TAG}}) */
async function replaceTags(documentId, replacements = {}) {
  try {
    const requests = [];
    for (const [rawKey, value] of Object.entries(replacements)) {
      const val = value ?? "";
      const tokens = [];
      if (/^\s*({{.*}}|<<.*>>)\s*$/.test(rawKey)) {
        tokens.push(rawKey.trim());
      } else {
        tokens.push(`{{${rawKey}}}`, `<<${rawKey}>>`);
      }
      tokens.forEach((text) =>
        requests.push({
          replaceAllText: {
            containsText: { text, matchCase: false },
            replaceText: val,
          },
        })
      );
    }

    if (!requests.length) return true;

    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
    return true;
  } catch (err) {
    logger.error({ err }, "❌ replaceTags");
    throw err;
  }
}

function collectTextRanges(content = [], literalText, ranges = []) {
  if (!Array.isArray(content) || !literalText) return ranges;

  for (const element of content) {
    if (element?.paragraph?.elements) {
      for (const paragraphElement of element.paragraph.elements) {
        const textRun = paragraphElement?.textRun;
        const raw = String(textRun?.content || "");
        if (!raw) continue;

        let searchIndex = 0;
        while (true) {
          const foundIndex = raw.indexOf(literalText, searchIndex);
          if (foundIndex === -1) break;
          const startIndex = Number(paragraphElement.startIndex || 0) + foundIndex;
          const endIndex = startIndex + literalText.length;
          if (endIndex > startIndex) {
            ranges.push({ startIndex, endIndex });
          }
          searchIndex = foundIndex + literalText.length;
        }
      }
    }

    if (element?.table?.tableRows) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells || []) {
          collectTextRanges(cell.content || [], literalText, ranges);
        }
      }
    }

    if (element?.tableOfContents?.content) {
      collectTextRanges(element.tableOfContents.content || [], literalText, ranges);
    }
  }

  return ranges;
}

async function updateDocsTextStyleByLiteral(documentId, literalText, textStyle = {}, fields = "") {
  try {
    const normalizedText = String(literalText || "").trim();
    if (!documentId || !normalizedText) return 0;

    const { data: doc } = await docs.documents.get({ documentId });
    const ranges = collectTextRanges(doc?.body?.content || [], normalizedText, []);
    if (!ranges.length) return 0;

    const normalizedFields = String(fields || "").trim()
      || Object.keys(textStyle || {}).join(",");
    if (!normalizedFields) return 0;

    const requests = ranges.map((range) => ({
      updateTextStyle: {
        range,
        textStyle,
        fields: normalizedFields,
      },
    }));

    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    return ranges.length;
  } catch (err) {
    logger.error({ err, documentId, literalText }, "❌ updateDocsTextStyleByLiteral");
    throw err;
  }
}

/**
 * Insert dynamic item rows into a Google Docs table and fill cell values.
 *
 * Template requirement: the target table must have at least 1 row (the header).
 * This function appends N data rows below it and fills each cell.
 *
 * Returns true if the table was found and rows were inserted, false otherwise.
 *
 * @param {string}   documentId
 * @param {number}   tableIndex     0-based index among top-level tables in body
 * @param {Array}    items          array of data items
 * @param {Function} getCellValues  (item, rowIndex) => string[]
 * @param {Object}   options        Optional settings
 * @param {boolean}  options.allowEmpty  If true, leave empty values as is instead of "N/A"
 */
async function insertDocsTableRows(documentId, tableIndex = 0, items, getCellValues, options = {}) {
  if (!items || !items.length) return false;

  // Step 1: read doc to find the target table
  const { data: docBefore } = await docs.documents.get({ documentId });
  const tables = (docBefore.body.content || []).filter(e => e.table);
  const tableElem = tables[tableIndex];
  if (!tableElem) {
    logger.warn({ documentId, tableIndex }, "insertDocsTableRows: tabla no encontrada, se usará ITEMS_BLOCK como fallback");
    return false;
  }

  const tableStartIndex = tableElem.startIndex;
  const currentRowCount = tableElem.table.tableRows.length;

  // Step 2: insert all rows first (they will inherit header style initially)
  const insertRequests = items.map((_, i) => ({
    insertTableRow: {
      tableCellLocation: {
        tableStartLocation: { index: tableStartIndex },
        rowIndex: currentRowCount - 1 + i,
        columnIndex: 0,
      },
      insertBelow: true,
    },
  }));

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: insertRequests },
  });

  // Step 3: re-read to get updated character indices
  const { data: docAfter } = await docs.documents.get({ documentId });
  const tablesAfter = (docAfter.body.content || []).filter(e => e.table);
  const tableAfter = tablesAfter[tableIndex];
  if (!tableAfter) return false;

  // New rows are appended after the original rows
  const newDataRows = tableAfter.table.tableRows.slice(currentRowCount);

  // Step 4: build requests to fill cells. El estilo (quitar bold) NO se
  // puede calcular aqui todavia -- las celdas nuevas siempre estan vacias en
  // este punto (cellEnd-1 > cellStart es falso), asi que cualquier rango
  // calculado ahora seria vacio. Se recalcula despues de insertar el texto,
  // mas abajo.
  const requests = [];
  for (let rowIdx = 0; rowIdx < items.length; rowIdx++) {
    const row = newDataRows[rowIdx];
    if (!row) continue;
    const cellValues = getCellValues(items[rowIdx], rowIdx);
    for (let colIdx = 0; colIdx < cellValues.length; colIdx++) {
      const cell = row.tableCells?.[colIdx];
      if (!cell) continue;
      const val = options.allowEmpty
        ? String(cellValues[colIdx] ?? "").trim()
        : String(cellValues[colIdx] ?? "").trim() || "N/A";
      const cellStart = cell.content?.[0]?.startIndex;
      if (cellStart == null) continue;

      // Insert the text only if it's not empty
      if (val.length > 0) {
        requests.push({ insertText: { location: { index: cellStart }, text: val } });
      }
    }
  }

  // Process insertText first in reverse order
  const insertReqs = requests.filter(r => r.insertText).sort((a, b) => b.insertText.location.index - a.insertText.location.index);

  if (insertReqs.length) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: insertReqs },
    });
  }

  // Bug real: styleReqs se calculaba ANTES de insertar texto, cuando las
  // celdas nuevas siempre estan vacias (cellEnd-1 > cellStart es falso para
  // una celda vacia) -- asi que styleReqs.length siempre daba 0 y este
  // bloque (el unico que de verdad recalcula rangos DESPUES de insertar
  // texto y quita el bold) nunca se ejecutaba. Las filas nuevas se quedaban
  // con el formato heredado de la fila de al lado (el header, en negrita).
  // La condicion correcta es "se inserto texto", no "el pase vacio encontro algo".
  if (insertReqs.length) {
    // Re-read doc again to get updated indices after inserting text
    const { data: docAfterInsert } = await docs.documents.get({ documentId });
    const tablesAfterInsert = (docAfterInsert.body.content || []).filter(e => e.table);
    const tableAfterInsert = tablesAfterInsert[tableIndex];
    if (tableAfterInsert) {
      const newDataRowsAfterInsert = tableAfterInsert.table.tableRows.slice(currentRowCount);
      const styleRequestsAfterInsert = [];
      for (let rowIdx = 0; rowIdx < items.length; rowIdx++) {
        const row = newDataRowsAfterInsert[rowIdx];
        if (!row) continue;
        for (let colIdx = 0; colIdx < row.tableCells?.length; colIdx++) {
          const cell = row.tableCells[colIdx];
          if (!cell) continue;
          const cellStart = cell.content?.[0]?.startIndex;
          const cellEnd = cell.endIndex;
          if (cellStart == null || cellEnd == null || cellEnd - 1 <= cellStart) continue;
          styleRequestsAfterInsert.push({
            updateTextStyle: {
              range: { startIndex: cellStart, endIndex: cellEnd - 1 },
              textStyle: options.textStyle || { bold: false },
              fields: options.textStyleFields || "bold",
            },
          });
        }
      }
      styleRequestsAfterInsert.sort((a, b) => b.updateTextStyle.range.startIndex - a.updateTextStyle.range.startIndex);
      if (styleRequestsAfterInsert.length) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: { requests: styleRequestsAfterInsert },
        });
      }
    }
  }

  return true;
}

async function downloadFileBuffer(fileId) {
  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data);
  } catch (err) {
    logger.error({ err, fileId }, "❌ downloadFileBuffer");
    throw err;
  }
}

async function exportPdfBuffer(docId) {
  try {
    const res = await drive.files.export(
      { fileId: docId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data);
  } catch (err) {
    logger.error({ err, docId }, "❌ exportPdfBuffer");
    throw err;
  }
}

async function makeFileAnyoneReadable(fileId) {
  if (!fileId) return false;
  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    return true;
  } catch (err) {
    logger.warn({ err, fileId }, "No se pudo dar permiso anyone-reader al archivo de Drive");
    return false;
  }
}

/** 📤 Subir archivo o firma PNG */
async function uploadBase64File(name, base64, mimeType = "image/png", parentId, options = {}) {
  try {
    const buffer = Buffer.from(base64, "base64");
    const contentHash = computeSha256HexFromBuffer(buffer);

    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name, parents: parentId ? [parentId] : undefined },
      media: { mimeType, body: bufferToStream(buffer) },
      fields: "id, name, mimeType, webViewLink, webContentLink, md5Checksum",
    });

    const result = {
      ...data,
      content_hash_sha256: contentHash,
      hash_algorithm: HASH_ALGORITHM,
      md5_drive: data.md5Checksum,
    };

    if (options?.makeAnyoneReader) {
      await makeFileAnyoneReadable(data.id);
    }

    // Registrar en la tabla central de integridad
    await registerIntegrity(data.id, {
      hash: contentHash,
      algorithm: HASH_ALGORITHM,
      md5: data.md5Checksum,
    });

    return result;
  } catch (err) {
    logger.error({ err }, "❌ uploadBase64File");
    throw err;
  }
}

/** 📤 Subir archivo desde multer (file.buffer) */
async function uploadFileToDrive(file, path, parentId, options = {}) {
  try {
    const filename = path.split("/").pop();
    const base64 = file.buffer.toString("base64");
    return await uploadBase64File(filename, base64, file.mimetype, parentId, options);
  } catch (err) {
    logger.error({ err }, "❌ uploadFileToDrive");
    throw err;
  }
}

/** 🧾 Exportar documento a PDF y subirlo */
async function exportPdf(docId, targetFolderId, filename) {
  try {
    const pdfBuffer = await exportPdfBuffer(docId);
    const contentHash = computeSha256HexFromBuffer(pdfBuffer);

    const safeName = (() => {
      if (!filename) return `export-${docId}.pdf`;
      return filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    })();

    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: safeName,
        parents: targetFolderId ? [targetFolderId] : undefined,
      },
      media: { mimeType: "application/pdf", body: bufferToStream(pdfBuffer) },
      fields: "id, name, webViewLink, md5Checksum",
    });

    const result = {
      ...data,
      content_hash_sha256: contentHash,
      hash_algorithm: HASH_ALGORITHM,
      md5_drive: data.md5Checksum,
    };

    // Registrar en la tabla central de integridad
    await registerIntegrity(data.id, {
      hash: contentHash,
      algorithm: HASH_ALGORITHM,
      md5: data.md5Checksum,
    });

    return result;
  } catch (err) {
    logger.error({ err }, "❌ exportPdf");
    throw err;
  }
}

module.exports = {
  createFolder,
  ensureFolder,
  ensureFolderPath,
  findFolder,
  getFileMetadata,
  moveFileToFolder,
  deleteFile,
  copyTemplate,
  replaceTags,
  updateDocsTextStyleByLiteral,
  insertDocsTableRows,
  downloadFileBuffer,
  exportPdfBuffer,
  makeFileAnyoneReadable,
  uploadBase64File,
  uploadFileToDrive,
  exportPdf,
  drive, // Exportar instancia para cálculos de integridad
};
