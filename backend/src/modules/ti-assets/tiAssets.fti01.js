/**
 * F.TI-01 — Cronograma de Mantenimiento de Equipos Tecnologicos (formato controlado, version 01).
 *
 * Llena la plantilla de Google Sheets (TEMPLATE_ID) con los activos TI activos y su cronograma del año,
 * la exporta a PDF (horizontal, ajustado al ancho) y borra la copia temporal. El mismo PDF puede ir al
 * motor de firma (signature-workflows): se escriben los nombres reales de quien elabora y aprueba en
 * el bloque de firmas para que la firma se ubique sola sobre su nombre.
 *
 * Estructura de la plantilla (verificada 2026-10-20): fila 7 encabezados, fila 8 "EQUIPOS COLABORADORES",
 * fila 9 fila plantilla {{n}}..{{dic}}, filas 10-11 y 13-44 de ejemplo, fila 12 "EQUIPOS CLIENTES/BODEGA",
 * fila 45 "Nota: {{nota}}", filas 49-51 firmas (Elaborado R.Ortiz / Aprobado V.Medina) y fechas.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const signatureWorkflowsService = require("../signature-workflows/signatureWorkflows.service");
const { validateCreateWorkflowPayload } = require("../signature-workflows/signatureWorkflows.validation");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const { extractPages, normalizeTokens } = require("../signature-workflows/signatureAutoPlacement.service");

const TEMPLATE_ID = process.env.TI_FTI01_TEMPLATE_ID || "1W-_4-R9CkeLg_VGIfrXFPS4H3z0lp3qA05EHdxj_E3Y";
const REFERENCE = "Departamento de TI";
const TEMPLATE_ROW_INDEX = 8; // fila 9 (0-based 8)
const TEMPLATE_PREPARED_BY = "R.Ortiz";
const TEMPLATE_APPROVED_BY = "V.Medina";
const LEGEND = "P = programado, E = ejecutado, V = vencido, C = cancelado. Fecha = día/mes planificado.";
const STATUS_LETTER = { pending: "P", completed: "E", overdue: "V", cancelled: "C", canceled: "C", in_maintenance: "P" };
const COLUMNS = 19; // A..S

const pad = (value) => String(value).padStart(2, "0");
const ecuadorDate = (date = new Date()) => {
  const local = new Date(date.getTime() - 5 * 3600 * 1000);
  return `${pad(local.getUTCDate())}-${pad(local.getUTCMonth() + 1)}-${local.getUTCFullYear()}`;
};
// planned_date llega como DATE (medianoche local); se lee en hora de Ecuador.
const dateParts = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() - 5 * 3600 * 1000);
  return { day: local.getUTCDate(), month: local.getUTCMonth() + 1, year: local.getUTCFullYear() };
};

/**
 * Puro. Filas del formato (19 columnas: N°, equipo, responsable, codigo, marca, modelo, serie, ene..dic)
 * por seccion. Colaboradores = custody_type "collaborator"; el resto (bodega, clientes) va a la segunda.
 */
function buildFti01Rows({ assets = [], schedules = [], year }) {
  const byAsset = new Map();
  schedules.forEach((schedule) => {
    const parts = dateParts(schedule.planned_date);
    if (!parts || parts.year !== Number(year)) return;
    // Fecha en una linea y estado debajo: cabe en las columnas angostas de los meses.
    const cell = `${pad(parts.day)}/${pad(parts.month)}
${STATUS_LETTER[schedule.status] || "P"}`;
    if (!byAsset.has(String(schedule.asset_id))) byAsset.set(String(schedule.asset_id), Array(12).fill(""));
    const months = byAsset.get(String(schedule.asset_id));
    months[parts.month - 1] = months[parts.month - 1] ? `${months[parts.month - 1]}\n${cell}` : cell;
  });
  const sections = { collaborators: [], warehouse: [] };
  assets.forEach((asset) => {
    const isCollaborator = asset.custody_type === "collaborator";
    const responsible = isCollaborator
      ? (asset.assigned_to_name || "Colaborador sin identificar")
      : asset.custody_type === "client"
        ? (asset.client_name || "Cliente sin identificar")
        : "Bodega";
    const section = isCollaborator ? sections.collaborators : sections.warehouse;
    section.push([
      section.length + 1,
      asset.name || "",
      responsible,
      asset.asset_code || "",
      asset.brand || "",
      asset.model || "",
      asset.serial_number || "",
      ...(byAsset.get(String(asset.id)) || Array(12).fill("")),
    ]);
  });
  return sections;
}

async function loadFti01Data(year) {
  const { rows: assets } = await db.query(
    `SELECT a.id, a.asset_code, a.name, a.brand, a.model, a.serial_number, a.custody_type,
            COALESCE(cu.fullname, cu.name, cu.email, u.fullname, u.name, u.email) AS assigned_to_name,
            COALESCE(c.nombre_comercial, c.razon_social, cr.commercial_name) AS client_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
       LEFT JOIN public.users cu ON cu.id = a.custodian_user_id
       LEFT JOIN public.clients c ON c.id = a.client_id
       LEFT JOIN public.client_requests cr ON cr.id = c.client_request_id
      WHERE a.active = true
      ORDER BY a.custody_type ASC, a.name ASC, a.id ASC`,
  );
  const { rows: schedules } = await db.query(
    `SELECT m.asset_id, m.planned_date, m.status
       FROM public.ti_asset_maintenance_schedule m
       JOIN public.ti_assets a ON a.id = m.asset_id
      WHERE a.active = true AND m.year = $1
      ORDER BY m.planned_date ASC`,
    [Number(year)],
  );
  return { assets, schedules };
}

/**
 * Copia la plantilla, la llena y la exporta a PDF. La copia se borra siempre.
 * @param {{ year: number, preparedByName?: string, approvedByName?: string, note?: string }} options
 */
async function generateFti01Pdf({ year, preparedByName = null, approvedByName = null, note = LEGEND } = {}) {
  const { drive, sheets, jwtClient } = require("../../config/google");
  const safeYear = Number(year) || new Date().getFullYear();
  const { collaborators, warehouse } = buildFti01Rows({ ...(await loadFti01Data(safeYear)), year: safeYear });

  const copy = await drive.files.copy({
    fileId: TEMPLATE_ID,
    requestBody: { name: `F.TI-01 ${safeYear} (temporal)` },
    supportsAllDrives: true,
    fields: "id",
  });
  const fileId = copy.data.id;
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: fileId, fields: "sheets.properties(sheetId,title)" });
    const { sheetId, title } = meta.data.sheets[0].properties;
    const rowRange = (start, end) => ({ sheetId, dimension: "ROWS", startIndex: start, endIndex: end });
    const copyTemplateFormat = (start, count) => ({
      copyPaste: {
        source: { sheetId, startRowIndex: TEMPLATE_ROW_INDEX, endRowIndex: TEMPLATE_ROW_INDEX + 1, startColumnIndex: 0, endColumnIndex: COLUMNS },
        destination: { sheetId, startRowIndex: start, endRowIndex: start + count, startColumnIndex: 0, endColumnIndex: COLUMNS },
        pasteType: "PASTE_FORMAT",
      },
    });
    const collaboratorCount = Math.max(collaborators.length, 1);
    const warehouseCount = Math.max(warehouse.length, 1);
    // Tras borrar las filas de ejemplo: fila 9 plantilla (idx 8), fila 10 "CLIENTES/BODEGA" (idx 9).
    const requests = [
      { deleteDimension: { range: rowRange(12, 44) } }, // filas 13-44
      { deleteDimension: { range: rowRange(9, 11) } }, // filas 10-11
      { insertDimension: { range: rowRange(10, 10 + warehouseCount), inheritFromBefore: false } },
      copyTemplateFormat(10, warehouseCount),
    ];
    if (collaboratorCount > 1) {
      requests.push(
        { insertDimension: { range: rowRange(9, 8 + collaboratorCount), inheritFromBefore: true } },
        copyTemplateFormat(9, collaboratorCount - 1),
      );
    }
    const replace = (find, value) => ({ findReplace: { find, replacement: String(value ?? ""), sheetId, matchCase: true } });
    requests.push(
      replace("{{referencia}}", REFERENCE),
      replace("{{anio}}", safeYear),
      replace("{{nota}}", note || ""),
      replace("{{fecha_elaboracion}}", ecuadorDate()),
      // La aprobacion queda con la firma (fecha del sello); el campo se deja vacio.
      replace("{{fecha_aprobacion}}", ""),
    );
    if (preparedByName) requests.push(replace(TEMPLATE_PREPARED_BY, preparedByName));
    if (approvedByName) requests.push(replace(TEMPLATE_APPROVED_BY, approvedByName));
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: fileId, requestBody: { requests } });

    const emptyRow = Array(COLUMNS).fill("");
    const collaboratorStart = TEMPLATE_ROW_INDEX + 1; // fila 9 (1-based)
    const warehouseStart = collaboratorStart + collaboratorCount + 1; // tras la fila de seccion
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: fileId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `'${title}'!A${collaboratorStart}:S${collaboratorStart + collaboratorCount - 1}`, values: collaborators.length ? collaborators : [emptyRow] },
          { range: `'${title}'!A${warehouseStart}:S${warehouseStart + warehouseCount - 1}`, values: warehouse.length ? warehouse : [emptyRow] },
        ],
      },
    });

    // Nombres y codigos largos: ajuste de texto y alto de fila automatico (si no, se cortan en el PDF).
    const dataStart = TEMPLATE_ROW_INDEX;
    const dataEnd = warehouseStart - 1 + warehouseCount;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: dataStart, endRowIndex: dataEnd, startColumnIndex: 0, endColumnIndex: COLUMNS },
              cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } },
              fields: "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment",
            },
          },
          { autoResizeDimensions: { dimensions: { sheetId, dimension: "ROWS", startIndex: dataStart, endIndex: dataEnd } } },
        ],
      },
    });

    const { token } = await jwtClient.getAccessToken();
    const exportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=pdf&gid=${sheetId}`
      + "&size=A4&portrait=false&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=CENTER"
      + "&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4&horizontal_alignment=CENTER";
    const response = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const error = new Error(`No se pudo exportar el F.TI-01 a PDF (HTTP ${response.status})`);
      error.status = 502;
      throw error;
    }
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    return {
      pdfBuffer,
      filename: `F.TI-01_Cronograma_mantenimiento_${safeYear}.pdf`,
      counts: { collaborators: collaborators.length, warehouse: warehouse.length },
    };
  } finally {
    await drive.files.delete({ fileId, supportsAllDrives: true })
      .catch((error) => logger.warn({ fileId, error: error?.message }, "[TI][F.TI-01] No se pudo borrar la copia temporal"));
  }
}

// Alto aproximado del sello de firma sobre el nombre (pt).
const SIGNATURE_ABOVE_NAME_PT = 16;

/**
 * Ubicacion de la firma: centrada sobre el nombre del firmante en el bloque de firmas (ultima aparicion
 * en el documento). La deteccion automatica del motor no sirve aqui: pone el sello a la derecha de la
 * fila, y en el F.TI-01 "Elaborado" y "Aprobado" comparten fila, asi que los dos caerian en el mismo sitio.
 */
async function locateSignaturePlacement(pdfBuffer, name) {
  const target = normalizeTokens(name).join(" ");
  if (!target) return null;
  const pages = await extractPages(pdfBuffer);
  for (const page of [...pages].reverse()) {
    for (const line of page.lines) {
      const item = line.items.find((candidate) => normalizeTokens(candidate.text).join(" ") === target);
      if (!item) continue;
      return {
        page_number: page.pageNumber,
        x_pct: Math.min(1, Math.max(0, (item.x + item.width / 2) / page.width)),
        y_pct: Math.min(1, Math.max(0, 1 - (item.y + SIGNATURE_ABOVE_NAME_PT) / page.height)),
      };
    }
  }
  return null;
}

/**
 * Envia el F.TI-01 a firma: quien elabora y quien aprueba (el motor firma en paralelo, cualquier orden).
 * Sus nombres (ficha de TH) se escriben en el bloque de firmas y cada firma queda ubicada sobre su nombre.
 */
async function startFti01SignatureWorkflow({ year, preparedByUserId, approvedByUserId, actorUser }) {
  const safeYear = Number(year) || new Date().getFullYear();
  if (!preparedByUserId || !approvedByUserId || Number(preparedByUserId) === Number(approvedByUserId)) {
    const error = new Error("Seleccione quien elabora y quien aprueba (dos personas distintas).");
    error.status = 400;
    throw error;
  }
  const [prepared, approved] = await Promise.all([
    signatureWorkflowsService.resolveSignerSnapshot(Number(preparedByUserId)),
    signatureWorkflowsService.resolveSignerSnapshot(Number(approvedByUserId)),
  ]);
  if (!prepared || !approved) {
    const error = new Error("Firmante no encontrado.");
    error.status = 404;
    throw error;
  }
  const { pdfBuffer, filename } = await generateFti01Pdf({ year: safeYear, preparedByName: prepared.name, approvedByName: approved.name });
  const payload = validateCreateWorkflowPayload({
    source_module: "ti-assets",
    source_entity: "fti01",
    source_entity_id: safeYear,
    document_type: "ti_fti01_cronograma_mantenimiento",
    title: `F.TI-01 Cronograma de mantenimiento de equipos tecnológicos ${safeYear}`,
    description: `Elaborado por ${prepared.name}; aprobación de ${approved.name}.`,
    document: {
      filename,
      pdf_base64: pdfBuffer.toString("base64"),
      source_sha256: computeSha256HexFromBuffer(pdfBuffer),
    },
    signers: [
      { user_id: Number(preparedByUserId), email: prepared.email, name: prepared.name, role: prepared.role, sequence_order: 1, is_required: true },
      { user_id: Number(approvedByUserId), email: approved.email, name: approved.name, role: approved.role, sequence_order: 2, is_required: true },
    ],
    meta: { year: safeYear, format_code: "F.TI-01", format_version: "01" },
  });
  const created = await signatureWorkflowsService.createWorkflow({ payload, user: actorUser });
  // Ubicacion fija de cada firma antes de enviar: el motor solo autodetecta a los que no la tienen.
  const placements = await Promise.all([prepared.name, approved.name].map((name) => locateSignaturePlacement(pdfBuffer, name)));
  for (const [index, placement] of placements.entries()) {
    if (!placement) continue;
    await db.query(
      "UPDATE signature_workflow_signers SET signature_placement = $3::jsonb WHERE workflow_id = $1 AND sequence_order = $2",
      [Number(created.workflow.id), index + 1, JSON.stringify(placement)],
    );
  }
  return signatureWorkflowsService.sendWorkflow(Number(created.workflow.id), actorUser);
}

module.exports = { generateFti01Pdf, startFti01SignatureWorkflow, buildFti01Rows, locateSignaturePlacement, TEMPLATE_ID };
