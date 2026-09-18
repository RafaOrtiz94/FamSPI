/**
 * Versionado de la plantilla base del Business Case.
 * -----------------------------------------------------
 * Solo jefe_comercial puede subir una version nueva del Excel base (nuevas
 * filas de inversiones/reparaciones en las tablas de equipos). El sistema
 * parsea su estructura (pestañas + encabezados) con el mismo tipo de
 * deteccion por texto que ya usa el motor de sync (no rangos fijos), arma
 * un reporte de diferencias contra la version activa, y solo la activa
 * cuando jefe_comercial confirma -- nunca en automatico sin revision.
 */
const { Readable } = require("stream");
const XLSX = require("xlsx");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../utils/drive");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const {
  clearSheetCaches,
  resolveTemplatePath,
  loadTemplateDefinition,
  buildRecordAliases,
  extractNumericAliasTokens,
  extractModelFamilyAliases,
  normalizeCompact,
  buildSheetPayloads,
} = require("./businessCaseSheetSyncLocal.service");
const fs = require("fs");

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const HEADER_SCAN_ROWS = 15;

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// ─── Estructura y diff ────────────────────────────────────────────────────

function extractHeaderLabels(ws) {
  if (!ws || !ws["!ref"]) return [];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const maxRow = Math.min(range.e.r, range.s.r + HEADER_SCAN_ROWS);
  let bestRow = range.s.r;
  let bestCount = -1;
  for (let r = range.s.r; r <= maxRow; r++) {
    let count = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "string" && cell.v.trim()) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestRow = r;
    }
  }
  const labels = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: bestRow, c })];
    if (cell && typeof cell.v === "string" && cell.v.trim()) {
      labels.push(String(cell.v).trim().toUpperCase());
    }
  }
  return labels;
}

function extractStructureSnapshot(workbook) {
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = extractHeaderLabels(workbook.Sheets[sheetName]);
  }
  return { sheetNames: workbook.SheetNames.slice(), sheets };
}

function diffSnapshots(oldSnapshot, newSnapshot) {
  // Sin version anterior no hay nada real que comparar -- listar "todo
  // agregado" (cada pestaña/columna del primer archivo) es ruido, no un diff.
  if (!oldSnapshot) {
    return { is_first_version: true, sheets_added: [], sheets_removed: [], sheet_changes: [], has_changes: false };
  }
  const oldSheets = new Set(oldSnapshot?.sheetNames || []);
  const newSheets = new Set(newSnapshot.sheetNames);
  const sheetsAdded = [...newSheets].filter((name) => !oldSheets.has(name));
  const sheetsRemoved = [...oldSheets].filter((name) => !newSheets.has(name));

  const sheetChanges = [];
  for (const sheetName of newSnapshot.sheetNames) {
    if (!oldSheets.has(sheetName)) continue;
    const oldLabels = new Set(oldSnapshot?.sheets?.[sheetName] || []);
    const newLabels = new Set(newSnapshot.sheets[sheetName] || []);
    const columnsAdded = [...newLabels].filter((label) => !oldLabels.has(label));
    const columnsRemoved = [...oldLabels].filter((label) => !newLabels.has(label));
    if (columnsAdded.length || columnsRemoved.length) {
      sheetChanges.push({ sheet: sheetName, columns_added: columnsAdded, columns_removed: columnsRemoved });
    }
  }

  return {
    is_first_version: !oldSnapshot,
    sheets_added: sheetsAdded,
    sheets_removed: sheetsRemoved,
    sheet_changes: sheetChanges,
    has_changes: Boolean(sheetsAdded.length || sheetsRemoved.length || sheetChanges.length),
  };
}

// ─── Drive ────────────────────────────────────────────────────────────────

async function uploadXlsxCopy(buffer, filename, folderId) {
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: XLSX_MIME, body: bufferToStream(buffer) },
    fields: "id, webViewLink",
  });
  return data;
}

// Sube el mismo xlsx pero forzando conversion a Google Sheets nativo (unico
// formato valido para drive.files.copy por cada BC nuevo) -- distinto del
// xlsx plano de arriba, que se guarda solo para poder re-parsear estructura.
async function uploadAsNativeSheet(buffer, filename, folderId) {
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: `${filename} (Sheet)`,
      parents: [folderId],
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    media: { mimeType: XLSX_MIME, body: bufferToStream(buffer) },
    fields: "id, webViewLink",
  });
  return data;
}

// ─── Consultas ────────────────────────────────────────────────────────────

async function getActiveVersion() {
  const { rows } = await db.query(
    `SELECT * FROM business_case_template_versions WHERE status = 'active' LIMIT 1`,
  );
  return rows[0] || null;
}

async function getStatus() {
  const { rows } = await db.query(
    `SELECT id, filename, status, uploaded_by_name, uploaded_at, activated_at, diff_report
       FROM business_case_template_versions
      ORDER BY uploaded_at DESC
      LIMIT 20`,
  );
  return {
    active: rows.find((row) => row.status === "active") || null,
    latest: rows[0] || null,
    history: rows,
  };
}

// ─── Escritura ────────────────────────────────────────────────────────────

async function uploadNewVersion({ buffer, filename, user, folderId }) {
  if (!buffer || buffer.length === 0) {
    const err = new Error("Debes adjuntar el archivo Excel de la plantilla base.");
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    const err = new Error("El archivo supera el limite de 15MB.");
    err.status = 400;
    throw err;
  }
  if (!folderId) {
    const err = new Error("No hay carpeta de Drive configurada para la plantilla base (BC_TEMPLATE_DRIVE_FOLDER_ID).");
    err.status = 500;
    throw err;
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true });
  } catch (error) {
    const err = new Error("El archivo no es un Excel valido o esta corrupto.");
    err.status = 400;
    throw err;
  }
  if (!workbook.SheetNames.length) {
    const err = new Error("El archivo no tiene ninguna pestaña legible.");
    err.status = 400;
    throw err;
  }

  const newSnapshot = extractStructureSnapshot(workbook);
  const activeVersion = await getActiveVersion();
  const diffReport = diffSnapshots(activeVersion?.structure_snapshot || null, newSnapshot);

  const xlsxSha256 = computeSha256HexFromBuffer(buffer);
  const [xlsxUpload, sheetUpload] = await Promise.all([
    uploadXlsxCopy(buffer, filename, folderId),
    uploadAsNativeSheet(buffer, filename, folderId),
  ]);

  const { rows } = await db.query(
    `INSERT INTO business_case_template_versions (
       filename, xlsx_drive_file_id, xlsx_drive_url, xlsx_sha256,
       sheet_drive_file_id, sheet_drive_url, status, structure_snapshot,
       diff_report, uploaded_by, uploaded_by_name
     ) VALUES ($1,$2,$3,$4,$5,$6,'pending_review',$7,$8,$9,$10)
     RETURNING *`,
    [
      filename, xlsxUpload.id, xlsxUpload.webViewLink, xlsxSha256,
      sheetUpload.id, sheetUpload.webViewLink, JSON.stringify(newSnapshot),
      JSON.stringify(diffReport), user.id, user.fullname || user.email || "Usuario",
    ],
  );

  return rows[0];
}

async function activateVersion(versionId, user) {
  const { rows } = await db.query(
    `SELECT * FROM business_case_template_versions WHERE id = $1 LIMIT 1`,
    [versionId],
  );
  const version = rows[0];
  if (!version) {
    const err = new Error("Version de plantilla no encontrada.");
    err.status = 404;
    throw err;
  }
  if (version.status === "active") return version;
  if (version.status !== "pending_review") {
    const err = new Error("Solo se puede activar una version pendiente de revision.");
    err.status = 409;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE business_case_template_versions SET status = 'superseded' WHERE status = 'active'`,
    );
    const { rows: activated } = await client.query(
      `UPDATE business_case_template_versions
          SET status = 'active', activated_by = $2, activated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [versionId, user.id],
    );
    await client.query("COMMIT");
    const activatedVersion = activated[0];

    await refreshLocalTemplateFile(activatedVersion).catch((error) => {
      logger.warn(
        { error: error?.message, versionId },
        "No se pudo refrescar la copia local de la plantilla tras activar la version -- el proximo BC podria usar estructura vieja hasta el proximo reinicio",
      );
    });

    return activatedVersion;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rejectVersion(versionId, user, reason) {
  const { rows } = await db.query(
    `UPDATE business_case_template_versions
        SET status = 'rejected', rejected_by = $2, rejected_at = NOW(),
            diff_report = diff_report || $3::jsonb
      WHERE id = $1 AND status = 'pending_review'
      RETURNING *`,
    [versionId, user.id, JSON.stringify({ rejection_reason: reason || null })],
  );
  if (!rows[0]) {
    const err = new Error("Version de plantilla no encontrada o ya no esta pendiente de revision.");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

// Descarga el xlsx recien activado y sobreescribe la copia local que usa
// loadTemplateDefinition() -- Cloud Run es efimero, esta escritura no
// sobrevive un reinicio de instancia por si sola, por eso ensureLocalTemplate
// tambien se llama al boot (ver businessCase.controller.js/server.js).
async function refreshLocalTemplateFile(version) {
  const buffer = await downloadDriveFile(version.xlsx_drive_file_id);
  const { path: templatePath } = resolveTemplatePath();
  fs.writeFileSync(templatePath, buffer);
  clearSheetCaches();
}

async function downloadDriveFile(fileId) {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data);
}

// Se llama una vez al boot del proceso: si hay una version activa en DB pero
// la copia local no coincide (instancia nueva de Cloud Run, o primera vez
// que corre este codigo), la descarga y la deja lista antes de que llegue
// cualquier request que genere un BC.
async function ensureLocalTemplateMatchesActiveVersion() {
  try {
    const active = await getActiveVersion();
    if (!active) return;
    const { path: templatePath } = resolveTemplatePath();
    if (fs.existsSync(templatePath)) {
      const localHash = computeSha256HexFromBuffer(fs.readFileSync(templatePath));
      if (localHash === active.xlsx_sha256) return;
    }
    await refreshLocalTemplateFile(active);
    logger.info({ versionId: active.id }, "Plantilla base de BC sincronizada desde la version activa en el arranque");
  } catch (error) {
    logger.warn({ error: error?.message }, "No se pudo sincronizar la plantilla base de BC al arrancar, se usa la copia empaquetada");
  }
}

// ─── Catalogo de reactivos/calibradores/controles/materiales por equipo ────
// El xlsx activado solo gobierna la estructura del documento Sheet interno
// de cada BC -- el catalogo que arma la UI (que reactivos/calibradores/
// controles/materiales puede seleccionar comercial por equipo, tablas
// catalog_consumables/catalog_equipment_consumables) es una fuente de datos
// completamente separada, mantenida a mano. Esto compara el contenido real
// de las pestañas de equipo del xlsx activo contra ese catalogo en BD y
// arma un reporte de que agregar/quitar -- nunca se aplica solo, requiere
// confirmacion explicita via applyCatalogDiff (mismo patron que activar una
// version: reporte primero, aplicar solo si jefe_comercial confirma).
// Variantes Unicode de guion/dash que Excel/autocorrect introducen sin que
// nadie lo note (confirmado contra el archivo real: "Calibrator f.a.s.
// CK-MB" en la hoja c111 usa U+2011 NON-BREAKING HYPHEN, no "-" ASCII) --
// sin esto, dos nombres visualmente identicos se comparaban como
// productos DISTINTOS, generando pares falsos "agregar este + quitar ese"
// del MISMO producto en cada diff de catalogo.
const UNICODE_DASH_VARIANTS = /[‐‑‒–—―−]/g;
// "×" (signo de multiplicacion, U+00D7) vs "x" (letra) en medidas como
// "5 × 300 mL" / "5 x 300 mL" -- mismo problema que los guiones: mismo
// producto, byte distinto, falso par agregar+quitar sin esto.
const MULTIPLICATION_SIGN = /×/g;

function normalizeCatalogText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(UNICODE_DASH_VARIANTS, "-")
    .replace(MULTIPLICATION_SIGN, "x")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// catalog_consumables.type acepta "consumible" y "material" como el mismo
// concepto (el parser de sheets solo produce "material") -- se unifican para
// no reportar como "removido"+"agregado" algo que en realidad es lo mismo.
function normalizeCatalogItemType(type) {
  return type === "consumible" ? "material" : type;
}

function buildCatalogItemKey(type, name) {
  return `${normalizeCatalogItemType(type)}::${normalizeCatalogText(name)}`;
}

// Palabras que distinguen variantes de licenciamiento/config de un MISMO
// equipo fisico (confirmado con comercial: comparten reactivos/
// calibradores/controles/materiales) -- se quitan antes de comparar nombres
// para agrupar variantes como "XNL 550 (con licencias)"/"(sin licencias)",
// o "cobas e411 rack"/"disk", sin fusionar equipos genuinamente distintos.
const VARIANT_QUALIFIER_REGEXES = [/\bcon\b/gi, /\bsin\b/gi, /\bwg\b/gi, /\brack\b/gi, /\bdisk\b/gi];
function stripVariantQualifiers(name) {
  let text = String(name || "");
  VARIANT_QUALIFIER_REGEXES.forEach((regex) => {
    text = text.replace(regex, " ");
  });
  return normalizeCatalogText(text).replace(/\s+/g, "");
}

// Alias tecnicos que las pestañas del Excel usan (nomenclatura interna de
// modulo Roche) pero que NO aparecen como substring literal en el nombre
// comercial del equipo en servicio.equipos -- ej. la pestaña "c303 c503"
// nombra los modulos Roche c303/c503, pero el catalogo dice "cobas Pure
// <303>"/"cobas Pro <503> ISE" (confirmado con comercial: un cobas Pure real
// = modulo e402 + modulo c303; un cobas Pro real = modulo e801 + modulo
// c503). Sin este alias explicito, el heuristico letra-antes-del-numero
// (extractModelFamilyAliases) saca basura sin relacion (ej. "e303" de
// "purE303") y nunca coincide con el alias real de la pestaña. Mismos
// datos ya curados en Mapeador_Sheets/equipment_aliases.json para OTRO
// espacio de ids (equipment_models) -- se repiten aqui por nombre porque
// esta funcion matchea equipos de servicio.equipos, no equipment_models.
// Claves normalizadas via normalizeCompact (minusculas, sin acentos/
// puntuacion/espacios) para no depender de que la puntuacion exacta del
// nombre en servicio.equipos coincida caracter por caracter.
const EXTRA_EQUIPMENT_NAME_ALIASES = new Map([
  ["cobaspure303", ["c303"]],
  ["cobaspure402", ["e402"]],
  ["cobaspro503ise", ["c503"]],
  ["cobas8000801", ["e801"]],
  ["cobas6500", ["u6500"]],
  // El tab "AVL 9180" usa el prefijo del fabricante (AVL); el catalogo
  // describe el mismo equipo como "SYSTEM, GENERIC, 9180" -- sin este alias
  // explicito el heuristico letra-antes-del-numero compara "c9180" (de
  // "generiC9180") contra "l9180" (de "avL9180") y nunca coincide.
  ["systemgeneric9180", ["avl9180"]],
]);

// Pestañas que agrupan varios equipos SIN ningun numero de modelo comun en
// el nombre de la pestaña, por lo que el matching por token nunca puede
// resolverlas solo (no hay digito ni alias tecnico para desambiguar). "XN-L"
// cubre toda la familia XNL (350/450/550, con/sin licencias) porque
// confirmado con comercial: todas esas variantes usan los mismos reactivos/
// calibradores/controles/materiales -- distinto del caso "variante de
// licencia" generico (mismo numero de modelo) porque aqui el NUMERO tambien
// cambia entre variantes (350 vs 450 vs 550). Claves normalizadas via
// normalizeCompact, igual que EXTRA_EQUIPMENT_NAME_ALIASES.
const EXPLICIT_SHEET_EQUIPMENT_GROUPS = new Map([
  ["xnl", [
    "xnl550conlicencias",
    "xnl550sinlicencias",
    "xnl450conlicencias",
    "xnl450sinlicencias",
    "xnl350conlicencias",
    "xnl350sinlicencias",
  ]],
]);

async function computeCatalogDiff() {
  const template = loadTemplateDefinition();

  // catalog_equipment_consumables.equipment_id referencia servicio.equipos
  // (id_equipo) -- NO equipment_models (tabla nueva/paralela usada por el
  // resto del catalogo de equipos en UI). Confirmado via
  // information_schema: el FK real de catalog_equipment_consumables
  // apunta a servicio.equipos.id_equipo.
  const { rows: allEquipmentRows } = await db.query(
    `SELECT id_equipo AS id, code, nombre AS name, fabricante AS manufacturer, modelo AS model
       FROM servicio.equipos WHERE estado = 'operativo'`,
  );
  // Los equipos "combo" (ej. "cobas Pure <303 + 402>") son un SKU que agrupa
  // 2 modulos -- comparten numero de modelo con sus componentes individuales
  // (303 y 402 a la vez) y siempre generan ambiguedad falsa en el matching
  // por token (2+ candidatos para el mismo numero, sin ser variantes reales
  // entre si). Se excluyen del matching automatico: su catalogo, si hace
  // falta, se cura a mano en Operaciones.
  const equipmentRows = allEquipmentRows.filter((record) => !String(record.name || "").includes("+"));
  const recordsWithAliases = equipmentRows.map((record) => {
    // No se usa `code` (numero de parte del fabricante) para el
    // alias/matching -- son numeros largos que generan digitos de 3-4
    // cifras sin relacion alguna con el numero de modelo real (confirmado:
    // causaba que "isSingleModelRecord" nunca se activara para casi ningun
    // equipo, dejando pasar falsos positivos como "e411"/"t411"/"u411"
    // compitiendo todos por el token "411").
    const extraAliases = EXTRA_EQUIPMENT_NAME_ALIASES.get(normalizeCompact(record.name)) || [];
    const aliases = [...buildRecordAliases({ name: record.name, model: record.model, id: record.id }), ...extraAliases];
    return {
      ...record,
      aliases,
      numericAliases: extractNumericAliasTokens(aliases),
      modelAliases: extractModelFamilyAliases(aliases),
    };
  });

  const { rows: existingLinks } = await db.query(`
    SELECT ec.equipment_id, c.id AS consumable_id, c.name, c.type
      FROM catalog_equipment_consumables ec
      JOIN catalog_consumables c ON c.id = ec.consumable_id
     WHERE COALESCE(lower(c.status), 'active') IN ('active', 'activo')
  `);
  const existingByEquipment = new Map();
  existingLinks.forEach((row) => {
    if (!existingByEquipment.has(row.equipment_id)) existingByEquipment.set(row.equipment_id, []);
    existingByEquipment.get(row.equipment_id).push(row);
  });

  const equipmentDiffs = [];
  const unmatchedSheets = [];

  // El matching por score de alias solo (>=85) es demasiado permisivo aqui:
  // "cobas" por si solo es un token valido de alias (buildRecordAliases
  // tokeniza nombres multi-palabra) y hace 100 con CUALQUIER equipo "cobas
  // *" -- con ~30 equipos y ~13 pestañas compitiendo a la vez (a diferencia
  // de buildSheetPayloads, que solo matchea los 1-2 equipos de un BC puntual
  // contra sus propias pestañas) eso cruzaba pestañas de equipos distintos
  // (ej. "u6500"/"b123"/"e402 e801" terminaban todas apuntando a "cobas
  // c111"). Mismo criterio que buildSheetPayloads: exige coincidencia de
  // numero de modelo sin conflicto de familia -- se resuelve TOKEN POR
  // TOKEN (no "algun token compartido") para dos casos reales confirmados
  // por el equipo comercial:
  //  1) Pestañas combo (ej. "e402 e801", "c303 c503", "t411 h232"): un
  //     cobas Pure real = modulo e402 + modulo c303; un cobas Pro real =
  //     modulo e801 + modulo c503 -- comparten la MISMA tabla de reactivos/
  //     calibradores/controles/materiales porque la mayoria de items son
  //     iguales entre ambos modulos de esa pestaña (confirmado). Cada
  //     numero de modelo en el nombre de la pestaña se resuelve por
  //     separado; si cada uno matchea exactamente 1 equipo, el diff se
  //     aplica a TODOS los equipos resueltos (no solo al primero).
  //  2) Grupos de variante (ej. "XN-L" cubre XNL 550/450/350 con/sin
  //     licencias; "e411" cubre rack/disk): son variantes de
  //     licenciamiento/config de un mismo equipo fisico, no reactivos
  //     distintos (confirmado) -- si un token matchea 2+ candidatos pero
  //     todos son la misma base una vez quitadas las palabras de variante
  //     (con/sin/wg/rack/disk), se tratan como grupo y se sincronizan
  //     todos igual, en vez de reportarse como ambiguo.
  (template.equipmentSheets || []).forEach((sheetDefinition) => {
    // OJO: la señal numerica/de modelo se toma SOLO del nombre de la
    // pestaña (sheetDefinition.name), NUNCA de sheetDefinition.aliases
    // completo. Ese array tambien incluye texto escaneado de las primeras
    // 8 filas x 9 columnas de contenido de la hoja (collectSheetAliases) --
    // pensado para el caso original (matchear 1-2 equipos de un BC puntual
    // contra sus propias pestañas, donde el ruido es poco riesgo). Aqui se
    // comparan ~30 equipos contra TODAS las pestañas a la vez: un numero de
    // 3 digitos suelto en cualquier celda (codigo, cantidad, etc.) puede
    // coincidir por pura casualidad con el numero de modelo de un equipo
    // no relacionado. Confirmado en pruebas: la pestaña "b101" matcheaba
    // por error contra "cobas b 123 POC system" (un "123" perdido en una
    // celda interna), lo que habria borrado 8 vinculos reales de catalogo
    // al sincronizar. Restringir al nombre de pestaña sacrifica algo de
    // cobertura (una pestaña sin numero en su nombre, ej. "XN-L", queda sin
    // mapear) a cambio de eliminar ese riesgo de raiz.
    const sheetNameAliases = [normalizeCompact(sheetDefinition.name)];

    const matchedEquiposById = new Map();

    // Grupo explicito (ej. "XN-L"): sin numero de modelo en el nombre de la
    // pestaña no hay nada que el matching por token pueda resolver solo --
    // se usa la lista curada a mano en vez de adivinar.
    const explicitGroupKeys = EXPLICIT_SHEET_EQUIPMENT_GROUPS.get(normalizeCompact(sheetDefinition.name));
    if (explicitGroupKeys) {
      recordsWithAliases.forEach((record) => {
        if (explicitGroupKeys.includes(normalizeCompact(record.name))) {
          matchedEquiposById.set(record.id, record);
        }
      });
    }

    const sheetNumericAliases = extractNumericAliasTokens(sheetNameAliases);
    const sheetModelAliases = extractModelFamilyAliases(sheetNameAliases);

    sheetNumericAliases.forEach((token) => {
      const candidates = recordsWithAliases.filter((record) => {
        if (!record.numericAliases.includes(token)) return false;
        const isSingleModelRecord = record.numericAliases.length === 1;
        const hasModelFamilyConflict =
          record.modelAliases.length > 0 &&
          sheetModelAliases.length > 0 &&
          !sheetModelAliases.some((modelToken) => record.modelAliases.includes(modelToken));
        return !isSingleModelRecord || !hasModelFamilyConflict;
      });
      if (candidates.length === 1) {
        matchedEquiposById.set(candidates[0].id, candidates[0]);
      } else if (candidates.length > 1) {
        const baseNames = new Set(candidates.map((record) => stripVariantQualifiers(record.name)));
        if (baseNames.size === 1) {
          candidates.forEach((record) => matchedEquiposById.set(record.id, record));
        }
        // baseNames.size > 1: candidatos genuinamente distintos para el
        // mismo numero (no es un grupo de variantes) -- se ignora este
        // token en vez de adivinar cual es el correcto.
      }
    });

    let matchedEquipos = Array.from(matchedEquiposById.values());

    if (!matchedEquipos.length) {
      // Sin señal numerica util en ninguno de los dos lados: solo se acepta
      // una igualdad exacta del nombre completo (no por token suelto), o un
      // grupo de variantes cuyo nombre base coincide exactamente.
      const exactNameMatches = recordsWithAliases.filter(
        (record) => normalizeCompact(record.name) === normalizeCompact(sheetDefinition.name),
      );
      if (exactNameMatches.length === 1) {
        matchedEquipos = exactNameMatches;
      } else if (exactNameMatches.length > 1) {
        const baseNames = new Set(exactNameMatches.map((record) => stripVariantQualifiers(record.name)));
        if (baseNames.size === 1) matchedEquipos = exactNameMatches;
      }
    }

    if (!matchedEquipos.length) {
      unmatchedSheets.push(sheetDefinition.name);
      return;
    }

    const sheetItemsByKey = new Map();
    (sheetDefinition.rows || []).forEach((row) => {
      const displayName = String(row.rawLabel || row.label || "").trim();
      if (!displayName || !row.itemType) return;
      const key = buildCatalogItemKey(row.itemType, displayName);
      if (!sheetItemsByKey.has(key)) {
        sheetItemsByKey.set(key, { name: displayName, type: normalizeCatalogItemType(row.itemType) });
      }
    });

    matchedEquipos.forEach((equipment) => {
      const existingItems = existingByEquipment.get(equipment.id) || [];
      const existingByKey = new Map(
        existingItems.map((row) => [buildCatalogItemKey(row.type, row.name), row]),
      );

      const added = Array.from(sheetItemsByKey.entries())
        .filter(([key]) => !existingByKey.has(key))
        .map(([, item]) => item);
      const removed = existingItems
        .filter((row) => !sheetItemsByKey.has(buildCatalogItemKey(row.type, row.name)))
        .map((row) => ({ consumable_id: row.consumable_id, name: row.name, type: normalizeCatalogItemType(row.type) }));

      if (added.length || removed.length) {
        equipmentDiffs.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          sheet_name: sheetDefinition.name,
          added,
          removed,
        });
      }
    });
  });

  return {
    equipment: equipmentDiffs,
    unmatched_sheets: unmatchedSheets,
    has_changes: equipmentDiffs.length > 0,
  };
}

async function applyCatalogDiff(diff) {
  const client = await db.getClient();
  let addedCount = 0;
  let removedCount = 0;
  try {
    await client.query("BEGIN");
    for (const equipmentDiff of diff.equipment || []) {
      for (const item of equipmentDiff.added || []) {
        const existing = await client.query(
          `SELECT id FROM catalog_consumables WHERE lower(name) = lower($1) AND type = $2 LIMIT 1`,
          [item.name, item.type],
        );
        let consumableId = existing.rows[0]?.id;
        if (!consumableId) {
          const inserted = await client.query(
            `INSERT INTO catalog_consumables (name, type, status, metadata, valid_from)
             VALUES ($1, $2, 'active', '{}', CURRENT_DATE)
             RETURNING id`,
            [item.name, item.type],
          );
          consumableId = inserted.rows[0].id;
        }
        const linkExists = await client.query(
          `SELECT id FROM catalog_equipment_consumables
            WHERE equipment_id = $1 AND consumable_id = $2 AND COALESCE(determination_id, 0) = 0
            LIMIT 1`,
          [equipmentDiff.equipment_id, consumableId],
        );
        if (!linkExists.rows.length) {
          await client.query(
            `INSERT INTO catalog_equipment_consumables (equipment_id, consumable_id, consumption_rate, created_at)
             VALUES ($1, $2, 1, now())`,
            [equipmentDiff.equipment_id, consumableId],
          );
        }
        addedCount += 1;
      }
      for (const item of equipmentDiff.removed || []) {
        await client.query(
          `DELETE FROM catalog_equipment_consumables WHERE equipment_id = $1 AND consumable_id = $2`,
          [equipmentDiff.equipment_id, item.consumable_id],
        );
        removedCount += 1;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { added: addedCount, removed: removedCount };
}

async function syncCatalogFromActiveTemplate() {
  const diff = await computeCatalogDiff();
  const result = await applyCatalogDiff(diff);
  return { ...result, diff };
}

// ─── Catalogo de inversiones adicionales (hoja "BC", bloque "INVERSIONES
// ADICIONALES") ──────────────────────────────────────────────────────────
// Mismo problema que el catalogo de equipos: la lista de inversiones
// seleccionable en la UI vive en bc_investment_catalog, una tabla separada
// del xlsx que hoy se mantiene a mano -- de hecho createInvestmentCatalogItem
// (investments.service.js) rechaza altas manuales ("El catalogo de
// inversiones es fijo. Usa el item Otros") porque se asumia que esta lista
// no cambia. Ahora que la plantilla si puede traer inversiones nuevas o
// quitar filas viejas, hace falta el mismo reporte+confirmacion.
function slugifyInvestmentCode(name) {
  return normalizeCatalogText(name).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

const INVESTMENT_CATALOG_FALLBACK_KEY = normalizeCatalogText("Otros");

async function computeInvestmentCatalogDiff() {
  const template = loadTemplateDefinition();
  const investmentLabels = template.bc?.investmentLabels || new Map();

  const sheetItemsByKey = new Map();
  investmentLabels.forEach((rawLabel) => {
    const label = String(rawLabel || "").trim();
    if (!label) return;
    sheetItemsByKey.set(normalizeCatalogText(label), label);
  });

  const { rows: catalogRows } = await db.query(
    `SELECT id, code, name, is_active FROM bc_investment_catalog`,
  );
  const activeByKey = new Map();
  catalogRows.forEach((row) => {
    if (row.is_active) activeByKey.set(normalizeCatalogText(row.name), row);
  });

  const added = Array.from(sheetItemsByKey.entries())
    .filter(([key]) => !activeByKey.has(key))
    .map(([, name]) => ({ name }));

  const removed = Array.from(activeByKey.entries())
    // "Otros" es el item de respaldo permanente (usado para cualquier
    // inversion que no este en el catalogo) -- nunca se propone quitarlo,
    // exista o no literalmente como fila en el Excel.
    .filter(([key]) => key !== INVESTMENT_CATALOG_FALLBACK_KEY && !sheetItemsByKey.has(key))
    .map(([, row]) => ({ id: row.id, name: row.name }));

  return { added, removed, has_changes: added.length > 0 || removed.length > 0 };
}

async function applyInvestmentCatalogDiff(diff) {
  const client = await db.getClient();
  let addedCount = 0;
  let removedCount = 0;
  try {
    await client.query("BEGIN");
    for (const item of diff.added || []) {
      // investment_class es NOT NULL con CHECK ('operativa'|'financiera') --
      // no hay forma de inferirlo del Excel, se asume 'operativa' (el
      // default mas comun en el catalogo actual) y queda visible en el
      // reporte para que alguien la reclasifique despues si corresponde.
      await client.query(
        `INSERT INTO bc_investment_catalog (code, name, is_active, investment_class, display_order)
         VALUES ($1, $2, true, 'operativa',
           (SELECT COALESCE(MAX(display_order), 0) + 1 FROM bc_investment_catalog))
         ON CONFLICT (code) DO NOTHING`,
        [slugifyInvestmentCode(item.name), item.name],
      );
      addedCount += 1;
    }
    for (const item of diff.removed || []) {
      // Soft-delete: bc_investment_selections/bc_investment_selection_requests
      // referencian catalog_id -- un BC ya guardado no debe perder su
      // seleccion historica solo porque la fila desaparecio del Excel.
      await client.query(
        `UPDATE bc_investment_catalog SET is_active = false, updated_at = now() WHERE id = $1`,
        [item.id],
      );
      removedCount += 1;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { added: addedCount, removed: removedCount };
}

async function syncInvestmentCatalogFromActiveTemplate() {
  const diff = await computeInvestmentCatalogDiff();
  const result = await applyInvestmentCatalogDiff(diff);
  return { ...result, diff };
}

// ─── Reporte de verificacion: pestaña real por equipo ──────────────────────
// Solo lectura, no escribe nada -- para poder revisar equipo por equipo,
// sin crear Business Case de prueba en produccion, que pestaña del Excel
// activo va a usar CADA equipo real del catalogo al generar su documento
// interno. Usa buildSheetPayloads, el MISMO codigo que ya usa la generacion
// real de BC (no una copia/heuristica aparte) -- si aqui sale bien, la
// generacion real de un BC para ese equipo tambien deberia salir bien.
async function buildEquipmentSheetMappingReport() {
  const template = loadTemplateDefinition();
  const { rows: equipmentRows } = await db.query(
    `SELECT id_equipo AS id, code, nombre AS name, fabricante AS manufacturer, modelo AS model
       FROM servicio.equipos WHERE estado = 'operativo' ORDER BY nombre`,
  );

  return equipmentRows.map((record) => {
    let matchedSheets = [];
    try {
      // OJO: buildSheetPayloads devuelve el array directamente, NO
      // { selectedSheets: [...] } -- desestructurar como objeto aqui daba
      // undefined para TODOS los equipos silenciosamente.
      const selectedSheets = buildSheetPayloads({ template, equipmentRecords: [record], payload: {} });
      matchedSheets = (selectedSheets || []).map((sheet) => sheet.sheet_name);
    } catch (error) {
      logger.warn(
        { equipmentId: record.id, error: error?.message },
        "buildEquipmentSheetMappingReport: fallo al resolver pestañas para un equipo",
      );
    }
    return {
      equipment_id: record.id,
      equipment_name: record.name,
      matched_sheets: matchedSheets,
    };
  });
}

module.exports = {
  uploadNewVersion,
  activateVersion,
  rejectVersion,
  getStatus,
  ensureLocalTemplateMatchesActiveVersion,
  computeCatalogDiff,
  syncCatalogFromActiveTemplate,
  computeInvestmentCatalogDiff,
  syncInvestmentCatalogFromActiveTemplate,
  buildEquipmentSheetMappingReport,
  // exportado para tests
  extractStructureSnapshot,
  diffSnapshots,
};
