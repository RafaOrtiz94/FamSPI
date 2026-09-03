const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive, sheets } = require("../../config/google");
const { ensureBusinessCaseDriveFolderById } = require("./businessCaseDriveFolder.service");
const { recordDocumentVersion } = require("./businessCaseSheetGeneration.service");
const { loadTemplateDefinition, buildSheetPayloads } = require("./businessCaseSheetSyncLocal.service");
const notificationManager = require("../notifications/notificationManager");

const OFFER_TEMPLATE_PATH = path.resolve(__dirname, "../../../Mapeador_Sheets/formato oferta.xlsx");
// Antes apuntaba a docs/validation/assets/ -- fuera de backend/, excluido
// por .dockerignore ("docs"), asi que en produccion fs.existsSync siempre
// daba false y la marca de agua/logo nunca se renderizaba en el PDF real
// (solo funcionaba corriendo local desde el checkout completo del repo).
const OFFER_PDF_LOGO_PATH = path.resolve(__dirname, "../../assets/logo_famproject.png");
const OFFER_PDF_FONT_REGULAR_PATH = path.resolve(__dirname, "../../assets/fonts/NotoSans-Regular.ttf");
const OFFER_PDF_FONT_BOLD_PATH = path.resolve(__dirname, "../../assets/fonts/NotoSans-Bold.ttf");
const OFFER_PDF_FONT_REGULAR = "OfferNotoSans";
const OFFER_PDF_FONT_BOLD = "OfferNotoSansBold";
const VIEWER_COMMERCIAL_ROLES = new Set(["comercial", "asesor_comercial", "analista_comercial"]);
const MANAGER_ROLES = new Set(["acp_comercial", "jefe_comercial", "jefe_de_comercial"]);
const PRIVATE_OFFER_MANAGER_ROLES = new Set(["acp_comercial", "jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]);
const OFFER_CREATOR_ALLOWED_STATUSES = new Set(["accepted", "rejected"]);
const OFFER_PUBLISHABLE_STATUSES = new Set(["draft", "rejected"]);
const ELECTROLYTE_KEYWORDS = ["electrol", "ise", "electrodo", "reference electrode"];
const PRIVATE_OFFER_WORKSPACE_STATES = new Set([
  "acp_availability_confirmed",
  "price_improvement_requested",
]);

const OFFER_SECTION_LAYOUT = {
  reactivo: { headerRow: 12, templateRow: 13, endRow: 77 },
  control_calibrador: { headerRow: 79, templateRow: 80, endRow: 116 },
  calibrador: { headerRow: 79, templateRow: 80, endRow: 116 },
  control: { headerRow: 79, templateRow: 80, endRow: 116 },
  consumible: { headerRow: 117, templateRow: 118, endRow: 132 },
  electrolito: { headerRow: 136, templateRow: 137, endRow: 147 },
};
const OFFER_SECTION_KEYS = ["reactivo", "control_calibrador", "consumible", "electrolito"];
const OFFER_SPLIT_CONTROL_SECTION_KEYS = ["reactivo", "calibrador", "control", "consumible", "electrolito"];
const COMBINED_CONTROL_CALIBRATOR_EQUIPMENT_ID = 9; // cobas Pure <303>
const OFFER_FOOTER_START_ROW = 150;
const OFFER_FOOTER_END_ROW = 162;
const OFFER_HEADER_END_ROW = 11;
const OFFER_LAST_COLUMN = 9;
const PRIVATE_PURCHASE_STATES = {
  ACP_AVAILABILITY_CONFIRMED: "acp_availability_confirmed",
  PRICE_IMPROVEMENT_REQUESTED: "price_improvement_requested",
  BUSINESS_CASE_FEASIBILITY_APPROVED: "business_case_feasibility_approved",
  OFFER_SENT: "offer_sent",
};

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  return {};
}

function normalizeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "jefe_de_comercial") return "jefe_comercial";
  if (normalized === "asesor_comercial") return "comercial";
  if (normalized === "analista_comercial") return "comercial";
  return normalized;
}

function getOfferSectionRows(sections = {}, key) {
  if (key !== "control_calibrador") return Array.isArray(sections[key]) ? sections[key] : [];
  if (Array.isArray(sections.control_calibrador)) return sections.control_calibrador;
  return [...(Array.isArray(sections.calibrador) ? sections.calibrador : []), ...(Array.isArray(sections.control) ? sections.control : [])]
    .sort((left, right) => Number(left?.sourceOrder ?? 0) - Number(right?.sourceOrder ?? 0));
}

function getOfferSectionKeys(sections = {}) {
  return Array.isArray(sections.control_calibrador) ? OFFER_SECTION_KEYS : OFFER_SPLIT_CONTROL_SECTION_KEYS;
}

function getPricingSectionKeys(sections = {}) {
  return getOfferSectionKeys(sections);
}

function isCombinedControlCalibratorEquipment(items = []) {
  const controlRows = (Array.isArray(items) ? items : []).filter((item) => {
    const type = String(item?.item_type || "").trim().toLowerCase();
    return type === "control" || type === "calibrador";
  });
  if (!controlRows.length) return false;
  return controlRows.every((item) => (
    Number(item?.equipment_id) === COMBINED_CONTROL_CALIBRATOR_EQUIPMENT_ID
    || String(item?.equipment_name || "").trim().toLowerCase() === "cobas pure <303>"
  ));
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isFeasibleBusinessCase(row) {
  const metadata = toObject(row?.modern_bc_metadata);
  const feasibility = toObject(metadata?.feasibility);
  const decision = toObject(feasibility?.decision);
  return Boolean(decision?.decided_at) && Boolean(decision?.is_feasible);
}

function makeDriveSpreadsheetUrl(sheetId) {
  return sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null;
}

function makeDrivePdfPreviewUrl(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
}

function formatOfferDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value) {
  const parsed = toNullableNumber(value);
  if (parsed === null) return "No definido";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatNumber(value) {
  const parsed = toNullableNumber(value);
  if (parsed === null) return "0";
  return new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

function sanitizeFileName(value, fallback = "oferta") {
  const normalized = String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ");
  return normalized || fallback;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const normalized = lastComma >= 0 && lastDot >= 0
    ? (lastDot > lastComma ? raw.replace(/,/g, "") : raw.replace(/\./g, "").replace(",", "."))
    : lastComma >= 0
      ? (/,[0-9]{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, ""))
      : raw;
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOfferText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizePdfText(value) {
  const raw = String(value ?? "");
  // Repair only the byte patterns typical of UTF-8 decoded as Latin-1. This
  // keeps stored data intact while preventing old catalog values from reaching
  // the document with mojibake.
  if (!/[\u00c2\u00c3\u00e2]/.test(raw)) return raw;
  const repaired = Buffer.from(raw, "latin1").toString("utf8");
  return repaired.includes("\uFFFD") ? raw : repaired;
}

function normalizeOfferProductId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeOfferProductFamily(value) {
  return normalizeOfferText(value)
    .replace(/\b(?:v|ver|version)\s*\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOfferItemTemplateOrder(items = []) {
  const template = loadTemplateDefinition();
  const equipmentRecords = Array.from(
    new Map(
      items
        .map((item) => {
          const equipmentId = Number(item?.equipment_id);
          if (!Number.isInteger(equipmentId) || equipmentId <= 0) return null;
          return [equipmentId, {
            id: equipmentId,
            name: item.equipment_name || null,
            code: null,
            model: null,
          }];
        })
        .filter(Boolean),
    ).values(),
  );

  if (!equipmentRecords.length) {
    return {
      orderMap: new Map(items.map((item, index) => [String(item.item_key || `${index}`), index])),
      detKitMap: new Map(),
      tabMap: new Map(),
      templateItemMap: new Map(),
    };
  }

  const equipmentTabs = buildSheetPayloads({
    template,
    equipmentRecords,
    payload: {
      fields: {},
      sync_items: items.map((item) => ({
        item_key: item.item_key,
        item_id: item.item_id || null,
        item_name: item.name || null,
        item_type: item.item_type || null,
        equipment_id: item.equipment_id || null,
        equipment_name: item.equipment_name || null,
      })),
      sheet_context: {},
    },
  });

  const itemByKey = new Map(items.map((item, index) => [String(item.item_key || `${index}`), { item, index }]));
  const consumedKeys = new Set();
  const orderMap = new Map();
  const detKitMap = new Map();
  const tabMap = new Map();
  const templateItemMap = new Map();
  let nextOrder = 0;

  const matchTemplateRowToItem = (row, tabItems = []) => {
    const rowId = normalizeOfferProductId(row?.itemId);
    const rowLabel = normalizeOfferText(row?.label);
    const rowType = String(row?.itemType || "").trim().toLowerCase();
    const eligibleItems = tabItems.filter((candidate) => {
      const itemKey = String(candidate?.item_key || "");
      if (!itemKey || consumedKeys.has(itemKey)) return false;
      const candidateType = String(candidate?.item_type || "").trim().toLowerCase();
      if (rowType && candidateType && rowType !== candidateType) return false;
      return true;
    });

    // El codigo de la hoja es la identidad del producto. Buscar por nombre
    // antes de revisar todos los codigos puede asociar una fila "Glucosa" a
    // otro SKU y dejar el SKU real como una segunda fila duplicada.
    if (rowId) {
      const exactIdMatch = eligibleItems.find(
        (candidate) => normalizeOfferProductId(candidate?.item_id) === rowId,
      );
      if (exactIdMatch) return exactIdMatch;
    }

    return eligibleItems.find(
      (candidate) => rowLabel && normalizeOfferText(candidate?.name) === rowLabel,
    ) || null;
  };

  equipmentTabs.forEach((tab) => {
    const definition = template.equipmentSheets.find((entry) => entry.name === tab?.sheet_name);
    if (!definition) return;
    const tabItems = Array.isArray(tab.items) ? tab.items : [];
    const rows = Array.isArray(definition.rows) ? definition.rows : [];
    rows.forEach((row) => {
      const matched = matchTemplateRowToItem(row, tabItems);
      if (!matched) return;
      const itemKey = String(matched.item_key || "");
      consumedKeys.add(itemKey);
      orderMap.set(itemKey, nextOrder);
      tabMap.set(itemKey, tab.sheet_name);
      templateItemMap.set(itemKey, {
        itemId: row?.itemId || null,
        label: row?.label || null,
        offerBucket: row?.offerSection || null,
      });
      if (row?.detKit !== null && row?.detKit !== undefined) {
        detKitMap.set(itemKey, row.detKit);
      }
      nextOrder += 1;
    });
  });

  items.forEach((item, index) => {
    const itemKey = String(item.item_key || `${index}`);
    if (!orderMap.has(itemKey)) {
      orderMap.set(itemKey, 100000 + index);
    }
  });

  return { orderMap, detKitMap, tabMap, templateItemMap, matchedItemKeys: consumedKeys };
}

function orderOfferItemsByBusinessCaseTemplate(items = []) {
  const { orderMap, detKitMap, templateItemMap, matchedItemKeys: rawMatchedItemKeys } = buildOfferItemTemplateOrder(items);
  const matchedItemKeys = rawMatchedItemKeys instanceof Set ? rawMatchedItemKeys : new Set();
  const withDetKit = items.map((item) => {
    const itemKey = String(item?.item_key || "");
    const detKit = detKitMap.get(itemKey);
    const templateItem = templateItemMap.get(itemKey);
    return {
      ...item,
      ...(detKit === undefined ? {} : { det_kit: detKit }),
      ...(templateItem?.itemId ? { item_id: templateItem.itemId, code: templateItem.itemId } : {}),
      // La etiqueta de la fila de la tabla base es canónica. Solo se aplica
      // cuando difiere del catálogo (ej. "acido folico" -> FOLATE G3 V3),
      // para no degradar la presentación de las filas ya equivalentes.
      ...(templateItem?.label && normalizeOfferText(templateItem.label) !== normalizeOfferText(item?.name)
        ? { name: String(templateItem.label).toUpperCase() }
        : {}),
      ...(templateItem?.offerBucket ? { offer_bucket: templateItem.offerBucket } : {}),
    };
  });

  // Si una fila de la hoja ya representa un producto, un SKU alterno del
  // catalogo con el mismo nombre/tipo no debe aparecer como una segunda fila.
  // Se conservan duplicados reales solo cuando ambos tienen una fila propia
  // en la plantilla (y, por tanto, codigos distintos definidos en la hoja).
  const templateProductSignatures = new Set(
    withDetKit
      .filter((item) => matchedItemKeys.has(String(item?.item_key || "")))
      .map((item) => `${String(item?.item_type || "").trim().toLowerCase()}|${normalizeOfferText(item?.name)}`),
  );
  const matchedTemplateCodeSignatures = new Set(
    withDetKit
      .filter((item) => matchedItemKeys.has(String(item?.item_key || "")))
      .map((item) => `${String(item?.equipment_id || "").trim()}|${normalizeOfferProductId(item?.item_id)}`),
  );
  const matchedTemplateFamilies = new Set(
    withDetKit
      .filter((item) => matchedItemKeys.has(String(item?.item_key || "")))
      .map((item) => `${String(item?.equipment_id || "").trim()}|${String(item?.item_type || "").trim().toLowerCase()}|${normalizeOfferProductFamily(item?.name)}`),
  );
  const visibleItems = withDetKit.filter((item) => {
    const itemKey = String(item?.item_key || "");
    if (matchedItemKeys.has(itemKey)) return true;
    // A sheet_template item exists only as a fallback for a row in the
    // selected equipment tab. If it no longer maps there, it is stale
    // fallback data (for example t411 rows previously attached to e411).
    if (String(item?.source || "").trim().toLowerCase() === "sheet_template") return false;
    const signature = `${String(item?.item_type || "").trim().toLowerCase()}|${normalizeOfferText(item?.name)}`;
    if (templateProductSignatures.has(signature)) return false;
    const codeSignature = `${String(item?.equipment_id || "").trim()}|${normalizeOfferProductId(item?.item_id)}`;
    if (matchedTemplateCodeSignatures.has(codeSignature)) return false;
    // Si la tabla base ya define la misma familia de producto con otra
    // versión/código, el catálogo histórico no debe reaparecer al final.
    const familySignature = `${String(item?.equipment_id || "").trim()}|${String(item?.item_type || "").trim().toLowerCase()}|${normalizeOfferProductFamily(item?.name)}`;
    return !(
      String(item?.source || "").trim().toLowerCase() === "catalog"
      && matchedTemplateFamilies.has(familySignature)
    );
  });

  return visibleItems.sort((left, right) => {
    const leftKey = String(left?.item_key || "");
    const rightKey = String(right?.item_key || "");
    const leftOrder = Number(orderMap.get(leftKey));
    const rightOrder = Number(orderMap.get(rightKey));
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftSourceOrder = Number(left?.source_order);
    const rightSourceOrder = Number(right?.source_order);
    if (Number.isFinite(leftSourceOrder) && Number.isFinite(rightSourceOrder) && leftSourceOrder !== rightSourceOrder) {
      return leftSourceOrder - rightSourceOrder;
    }
    return String(left?.item_key || "").localeCompare(String(right?.item_key || ""), "es");
  });
}

function attachOfferItemTemplateMetadata(items = []) {
  const { detKitMap, tabMap } = buildOfferItemTemplateOrder(items);
  return items.map((item, index) => {
    const itemKey = String(item?.item_key || "");
    const detKit = detKitMap.get(itemKey);
    const tabName = tabMap.get(itemKey);
    return {
      ...item,
      source_order: Number.isInteger(Number(item?.source_order)) ? Number(item.source_order) : index,
      ...(detKit === undefined ? {} : { det_kit: detKit }),
      ...(tabName === undefined ? {} : { offer_template_tab: tabName }),
    };
  });
}

async function ensureOfferTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.bc_offer_versions (
      id BIGSERIAL PRIMARY KEY,
      business_case_id uuid NOT NULL REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
      version_number integer NOT NULL,
      status text NOT NULL,
      sheet_file_id text NULL,
      sheet_url text NULL,
      pdf_file_id text NULL,
      pdf_url text NULL,
      pricing_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      template_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      rejection_reason text NULL,
      created_by integer NULL,
      sent_by integer NULL,
      decided_by integer NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      sent_at timestamptz NULL,
      decided_at timestamptz NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT bc_offer_versions_business_case_version_uniq UNIQUE (business_case_id, version_number)
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_status_idx
      ON public.bc_offer_versions (business_case_id, status, version_number DESC);
  `);

  await db.query(`
    ALTER TABLE public.bc_offer_versions
      ALTER COLUMN business_case_id DROP NOT NULL;
  `);

  await db.query(`
    ALTER TABLE public.bc_offer_versions
      ADD COLUMN IF NOT EXISTS private_purchase_id uuid NULL;
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'bc_offer_versions_private_purchase_id_fkey'
           AND conrelid = 'public.bc_offer_versions'::regclass
      ) THEN
        ALTER TABLE public.bc_offer_versions
          ADD CONSTRAINT bc_offer_versions_private_purchase_id_fkey
          FOREIGN KEY (private_purchase_id)
          REFERENCES public.private_purchase_requests(id)
          ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'bc_offer_versions_single_owner_chk'
           AND conrelid = 'public.bc_offer_versions'::regclass
      ) THEN
        ALTER TABLE public.bc_offer_versions
          ADD CONSTRAINT bc_offer_versions_single_owner_chk
          CHECK (
            (business_case_id IS NOT NULL AND private_purchase_id IS NULL)
            OR
            (business_case_id IS NULL AND private_purchase_id IS NOT NULL)
          );
      END IF;
    END $$;
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS bc_offer_versions_private_purchase_version_uniq
      ON public.bc_offer_versions (private_purchase_id, version_number)
      WHERE private_purchase_id IS NOT NULL;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS bc_offer_versions_private_purchase_status_idx
      ON public.bc_offer_versions (private_purchase_id, status, version_number DESC)
      WHERE private_purchase_id IS NOT NULL;
  `);

  await db.query(`
    ALTER TABLE public.bc_offer_versions
      ADD COLUMN IF NOT EXISTS offer_key TEXT NOT NULL DEFAULT 'default',
      ADD COLUMN IF NOT EXISTS offer_label TEXT,
      ADD COLUMN IF NOT EXISTS target_equipment_id BIGINT,
      ADD COLUMN IF NOT EXISTS target_equipment_name TEXT;
  `);

  await db.query(`
    UPDATE public.bc_offer_versions
       SET offer_key = 'default'
     WHERE offer_key IS NULL OR btrim(offer_key) = '';
  `);

  await db.query(`
    ALTER TABLE public.bc_offer_versions
      DROP CONSTRAINT IF EXISTS bc_offer_versions_business_case_version_uniq;
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS bc_offer_versions_business_case_offer_version_uniq
      ON public.bc_offer_versions (business_case_id, offer_key, version_number)
      WHERE business_case_id IS NOT NULL;
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS bc_offer_versions_private_purchase_offer_version_uniq
      ON public.bc_offer_versions (private_purchase_id, offer_key, version_number)
      WHERE private_purchase_id IS NOT NULL;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_offer_status_idx
      ON public.bc_offer_versions (business_case_id, offer_key, status, version_number DESC)
      WHERE business_case_id IS NOT NULL;
  `);
}

async function getBusinessCaseOfferContext(businessCaseId) {
  const { rows } = await db.query(
    `SELECT vc.business_case_id AS id,
            vc.client_name,
            vc.created_by,
            u.fullname AS created_by_name,
            u.email AS created_by_email,
            vc.bc_stage,
            vc.canonical_state,
            vc.drive_folder_id,
            vc.modern_bc_metadata,
            vc.bc_purchase_type
       FROM v_business_cases_complete vc
       LEFT JOIN users u ON u.id = vc.created_by
      WHERE vc.business_case_id = $1
      LIMIT 1`,
    [businessCaseId],
  );
  if (!rows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    error.code = "BUSINESS_CASE_NOT_FOUND";
    throw error;
  }
  return rows[0];
}

function resolveClientNameFromSnapshot(snapshot = {}) {
  return String(
    snapshot.commercial_name
    || snapshot.legal_person_business_name
    || snapshot.name
    || snapshot.razon_social
    || "Cliente",
  ).trim() || "Cliente";
}

async function getPrivatePurchaseOfferContext(privatePurchaseId) {
  const { rows } = await db.query(
    `SELECT p.id,
            p.client_snapshot,
            p.equipment,
            p.status,
            p.offer_kind,
            p.created_by,
            p.created_by_email,
            p.drive_folder_id,
            p.offer_document_id,
            p.offer_signed_document_id,
            p.extra,
            u.fullname AS created_by_name,
            u.email AS creator_email
       FROM private_purchase_requests p
       LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = $1
      LIMIT 1`,
    [privatePurchaseId],
  );
  if (!rows.length) {
    const error = new Error("Compra privada no encontrada");
    error.status = 404;
    error.code = "PRIVATE_PURCHASE_NOT_FOUND";
    throw error;
  }

  const row = rows[0];
  const snapshot = toObject(row.client_snapshot);
  return {
    ...row,
    source_type: "private_purchase",
    private_purchase_id: row.id,
    client_name: resolveClientNameFromSnapshot(snapshot),
    created_by_email: row.created_by_email || row.creator_email || null,
    modern_bc_metadata: toObject(row.extra),
    bc_purchase_type: row.offer_kind || "venta",
  };
}

function makeBusinessCaseOwner(businessCaseId) {
  return {
    sourceType: "business_case",
    businessCaseId,
    privatePurchaseId: null,
    idColumn: "business_case_id",
    idValue: businessCaseId,
  };
}

function makePrivatePurchaseOwner(privatePurchaseId) {
  return {
    sourceType: "private_purchase",
    businessCaseId: null,
    privatePurchaseId,
    idColumn: "private_purchase_id",
    idValue: privatePurchaseId,
  };
}

function resolveOfferOwner(contextOrId, sourceType = "business_case") {
  if (typeof contextOrId === "object" && contextOrId?.source_type === "private_purchase") {
    return makePrivatePurchaseOwner(contextOrId.private_purchase_id || contextOrId.id);
  }
  if (sourceType === "private_purchase") {
    return makePrivatePurchaseOwner(contextOrId);
  }
  return makeBusinessCaseOwner(typeof contextOrId === "object" ? contextOrId.id : contextOrId);
}

function assertOfferViewer(context, user) {
  const normalizedRole = normalizeRole(user?.role);
  const isManager = MANAGER_ROLES.has(normalizedRole);
  const isCreatorCommercial =
    VIEWER_COMMERCIAL_ROLES.has(normalizedRole) &&
    Number(user?.id) > 0 &&
    Number(context?.created_by) === Number(user?.id);

  if (!isManager && !isCreatorCommercial) {
    const error = new Error("No tiene acceso al workspace de oferta");
    error.status = 403;
    error.code = "BC_OFFER_ACCESS_DENIED";
    throw error;
  }

  return {
    normalizedRole,
    isManager,
    isCreatorCommercial,
  };
}

function assertOfferManager(context, user) {
  const access = assertOfferViewer(context, user);
  if (!access.isManager) {
    const error = new Error("Solo ACP Comercial o Jefe Comercial pueden gestionar la oferta");
    error.status = 403;
    error.code = "BC_OFFER_MANAGER_REQUIRED";
    throw error;
  }
  if (!isFeasibleBusinessCase(context)) {
    const error = new Error("La oferta solo se habilita cuando el Business Case ya es factible");
    error.status = 409;
    error.code = "BC_OFFER_FEASIBILITY_REQUIRED";
    throw error;
  }
  return access;
}

function assertOfferDecisionUser(context, user) {
  const access = assertOfferViewer(context, user);
  if (!access.isCreatorCommercial) {
    const error = new Error("Solo el usuario comercial creador del BC puede aceptar o rechazar la oferta");
    error.status = 403;
    error.code = "BC_OFFER_DECISION_FORBIDDEN";
    throw error;
  }
  if (!isFeasibleBusinessCase(context)) {
    const error = new Error("El BC no se encuentra en estado factible");
    error.status = 409;
    error.code = "BC_OFFER_FEASIBILITY_REQUIRED";
    throw error;
  }
  return access;
}

function assertPrivateOfferViewer(context, user) {
  const normalizedRole = normalizeRole(user?.role);
  const userId = Number(user?.id) || 0;
  const isManager = PRIVATE_OFFER_MANAGER_ROLES.has(normalizedRole);
  const isBackoffice = ["backoffice", "backoffice_comercial"].includes(normalizedRole);
  const isCreatorCommercial =
    VIEWER_COMMERCIAL_ROLES.has(normalizedRole) &&
    userId > 0 &&
    Number(context?.created_by) === userId;

  if (!isManager && !isBackoffice && !isCreatorCommercial) {
    const error = new Error("No tiene acceso al workspace de oferta de la compra privada");
    error.status = 403;
    error.code = "PRIVATE_OFFER_ACCESS_DENIED";
    throw error;
  }

  return {
    normalizedRole,
    isManager,
    isBackoffice,
    isCreatorCommercial,
    canManage: isManager || isBackoffice,
  };
}

function assertPrivateOfferManager(context, user) {
  const access = assertPrivateOfferViewer(context, user);
  if (!access.canManage) {
    const error = new Error("Solo backoffice, ACP Comercial o Jefe Comercial pueden gestionar la oferta");
    error.status = 403;
    error.code = "PRIVATE_OFFER_MANAGER_REQUIRED";
    throw error;
  }

  const status = String(context?.status || "").trim().toLowerCase();
  const hasExistingOffer = Boolean(context?.offer_document_id);
  const isImprovementFlow = status === PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED;
  if (!PRIVATE_OFFER_WORKSPACE_STATES.has(status) && !hasExistingOffer) {
    const error = new Error("La oferta se habilita cuando ACP confirma disponibilidad o solicita mejora de precio");
    error.status = 409;
    error.code = "PRIVATE_OFFER_STATE_REQUIRED";
    throw error;
  }
  if (isImprovementFlow && !PRIVATE_OFFER_MANAGER_ROLES.has(access.normalizedRole)) {
    const error = new Error("La mejora de precio debe ser gestionada por ACP Comercial o Jefe Comercial");
    error.status = 403;
    error.code = "PRIVATE_OFFER_IMPROVEMENT_MANAGER_REQUIRED";
    throw error;
  }

  return access;
}

function derivePrivateOfferPermissions(context, user, latestOffer) {
  const access = assertPrivateOfferViewer(context, user);
  const status = String(context?.status || "").trim().toLowerCase();
  const canStartOffer = PRIVATE_OFFER_WORKSPACE_STATES.has(status) || Boolean(context?.offer_document_id);
  return {
    canView: true,
    canCreateDraft:
      access.canManage &&
      canStartOffer &&
      (!latestOffer || OFFER_CREATOR_ALLOWED_STATUSES.has(String(latestOffer.status || "").trim().toLowerCase())),
    canPublish:
      access.canManage &&
      canStartOffer &&
      latestOffer &&
      OFFER_PUBLISHABLE_STATUSES.has(String(latestOffer.status || "").trim().toLowerCase()),
    canRegenerate:
      access.canManage &&
      canStartOffer &&
      latestOffer &&
      ["draft", "rejected", "sent"].includes(String(latestOffer.status || "").trim().toLowerCase()),
    canDecide: false,
  };
}

async function loadConsumptionItemsForOffer(businessCaseId) {
  // Antes de leer, sincroniza contra la hoja del BC para crear en
  // bc_consumption_items cualquier item de catalogo que falte -- incluidos
  // los que no tienen valor en DET/AÑO/PROCESO -- porque de lo contrario la
  // oferta omite reactivos/calibradores/controles/materiales sin cantidad y
  // el orden resultante no coincide con la hoja real del BC (el primer/
  // ultimo item visible cambia segun cuales items existan). No debe romper
  // la generacion de la oferta si el sync falla (ej. seccion bloqueada o
  // hoja no generada aun) -- se sigue con lo que ya haya en la tabla.
  try {
    const { syncConsumptionQuantitiesFromSheet } = require("./businessCase.service");
    await syncConsumptionQuantitiesFromSheet(businessCaseId, { forceTemplateReload: true });
  } catch (error) {
    logger.warn(
      { businessCaseId, error: error?.message || String(error) },
      "No se pudo sincronizar consumos desde la hoja antes de generar la oferta -- se usa lo ya existente",
    );
  }

  const { rows } = await db.query(
    `SELECT item_key,
            item_id,
            name,
            item_type,
            source,
            annual_qty,
            reference_qty,
            equipment_id,
            equipment_name,
            ROW_NUMBER() OVER (
              ORDER BY
                COALESCE(equipment_id, 2147483647),
                CASE
                  WHEN item_key ~ '^cons:[^:]+:[0-9]+$' THEN split_part(item_key, ':', 3)::numeric
                  WHEN item_key ~ '^sheet:[^:]+:[0-9]+:' THEN split_part(item_key, ':', 3)::numeric
                  ELSE NULL
                END NULLS LAST,
                item_key
            ) - 1 AS source_order
       FROM bc_consumption_items
      WHERE business_case_id = $1
      ORDER BY
        COALESCE(equipment_id, 2147483647),
        CASE
          WHEN item_key ~ '^cons:[^:]+:[0-9]+$' THEN split_part(item_key, ':', 3)::numeric
          WHEN item_key ~ '^sheet:[^:]+:[0-9]+:' THEN split_part(item_key, ':', 3)::numeric
          ELSE NULL
        END NULLS LAST,
        item_key`,
    [businessCaseId],
  );

  const normalizedItems = rows.map((row, index) => ({
    item_key: row.item_key,
    item_id: row.item_id || null,
    name: row.name || "Sin nombre",
    item_type: String(row.item_type || "").trim().toLowerCase(),
    source: row.source || null,
    annual_qty: row.annual_qty === null || row.annual_qty === undefined ? null : Number(row.annual_qty),
    reference_qty: row.reference_qty === null || row.reference_qty === undefined ? null : Number(row.reference_qty),
    equipment_id: row.equipment_id === null || row.equipment_id === undefined ? null : Number(row.equipment_id),
    equipment_name: row.equipment_name || null,
    code: row.item_id || null,
    source_order: Number.isInteger(Number(row.source_order)) ? Number(row.source_order) : index,
  }));

  return attachOfferItemTemplateMetadata(normalizedItems);
}

function normalizePrivatePurchaseEquipmentItems(equipment = []) {
  const list = Array.isArray(equipment) ? equipment : [];
  return list
    .map((item, index) => {
      const name = String(item?.name || item?.label || item?.model || item?.sku || "").trim();
      if (!name) return null;
      const code = String(item?.code || item?.sku || item?.serial || item?.id || "").trim();
      const qty = toNullableNumber(item?.quantity ?? item?.qty ?? item?.cantidad ?? 1) ?? 1;
      return {
        item_key: `private-equipment-${index + 1}`,
        item_id: code || null,
        name,
        item_type: "equipo",
        annual_qty: qty,
        reference_qty: qty,
        equipment_id: toNullableNumber(item?.equipment_id ?? item?.id),
        equipment_name: name,
        code,
      };
    })
    .filter(Boolean);
}

async function loadEquipmentCategoryPresentation(items = []) {
  const names = [...new Set(items.map((item) => String(item?.equipment_name || "").trim()).filter(Boolean))];
  if (!names.length) return null;

  try {
    const { rows } = await db.query(
      `SELECT equipment_name, category
         FROM v_equipment_full_catalog
        WHERE equipment_name = ANY($1::text[])`,
      [names],
    );
    return rows[0] || null;
  } catch (error) {
    logger.warn({ error: error?.message || String(error), names }, "No se pudo resolver la categoría comercial del equipo para la oferta");
    return null;
  }
}

function resolveOfferAreaLabel(categoryValue) {
  const category = String(categoryValue || "").trim().toLowerCase();
  if (category === "chemistry") return "QUÍMICA SANGUÍNEA";
  if (category === "immunology") return "INMUNOLOGÍA";
  if (category === "hematology") return "HEMATOLOGÍA";
  if (category === "coagulation") return "COAGULACIÓN";
  if (category === "urinalysis") return "UROANÁLISIS";
  if (category === "gasometry") return "GASOMETRÍA";
  return "LABORATORIO CLÍNICO";
}

function resolveOfferClientLocation(context) {
  const metadata = toObject(context?.modern_bc_metadata);
  const generalData = toObject(metadata.general_data);
  const clientSnapshot = toObject(context?.client_snapshot);
  return {
    city:
      String(
        generalData.installation_city
        || metadata.installation_city
        || clientSnapshot.city
        || clientSnapshot.ciudad
        || clientSnapshot.address_city
        || "",
      ).trim() || null,
    province:
      String(
        generalData.installation_province
        || metadata.installation_province
        || clientSnapshot.province
        || clientSnapshot.provincia
        || clientSnapshot.address_province
        || "",
      ).trim() || null,
  };
}

function resolveEquipmentDisplayName(context, items = []) {
  const uniqueNames = [...new Set(items.map((item) => String(item?.equipment_name || "").trim()).filter(Boolean))];
  if (uniqueNames.length) return uniqueNames.join(" + ");

  const extra = toObject(context?.modern_bc_metadata)?.equipment_summary;
  if (Array.isArray(extra?.selected_names) && extra.selected_names.length) {
    return extra.selected_names.join(" + ");
  }
  return "Equipo no definido";
}

// El cobas c111 no tiene modulo ISE de electrolitos como equipo integrado
// (a diferencia de c311/Pure/Pro/8000) -- su hoja real de BC nunca separa un
// bloque de electrolitos. Confirmado contra el catalogo completo (auditoria
// 2026-08-26): es el UNICO equipo cuyo unico match de keywords de electrolito
// es un producto real de electrolito (NaCl 9%, no de limpieza) que en su
// hoja real igual va en Consumibles.
const EQUIPMENT_WITHOUT_ELECTROLYTE_MODULE = ["c111"];

// Causa raiz real del bug (no solo c111): "ise" como keyword tambien matchea
// productos de LIMPIEZA/mantenimiento del modulo ISE (ej. "ISE CLEANING
// SOLUTION", "ISE cleaning solution Sys Clean") que NO son reactivos de
// electrolitos -- deben ir en Consumibles en TODOS los equipos, incluidos
// los que si tienen modulo real de electrolitos (c311/Pure/Pro/8000),
// confirmado contra el catalogo completo: aparecen literalmente en todos
// ellos. Sin esta exclusion, el bug se repite en cualquier equipo con ISE.
const ELECTROLYTE_CLEANING_EXCLUSION_KEYWORDS = ["clean", "limpieza", "limpiador"];

function normalizeOfferBucket(item) {
  const type = String(item?.item_type || "").trim().toLowerCase();
  if (type === "reactivo" || type === "determinacion") return "reactivo";
  if (type === "calibrador" || type === "control") return type;
  if (type === "consumible" || type === "material") {
    const templateBucket = String(item?.offer_bucket || "").trim().toLowerCase();
    if (templateBucket === "consumible" || templateBucket === "electrolito") return templateBucket;
    const equipmentName = String(item?.equipment_name || "").trim().toLowerCase();
    if (EQUIPMENT_WITHOUT_ELECTROLYTE_MODULE.some((keyword) => equipmentName.includes(keyword))) {
      return "consumible";
    }
    const name = String(item?.name || "").trim().toLowerCase();
    if (ELECTROLYTE_CLEANING_EXCLUSION_KEYWORDS.some((keyword) => name.includes(keyword))) {
      return "consumible";
    }
    return ELECTROLYTE_KEYWORDS.some((keyword) => name.includes(keyword)) ? "electrolito" : "consumible";
  }
  return "consumible";
}

async function buildOfferTemplatePayload(context, items, user) {
  const grouped = {
    reactivo: [],
    calibrador: [],
    control: [],
    consumible: [],
    electrolito: [],
  };

  // La oferta y el PDF se construyen desde estas secciones. Ordenar aqui
  // garantiza que ambos documentos sigan exactamente las filas de la hoja
  // correspondiente, aun si el lector de BD entrega otro orden.
  const orderedItems = orderOfferItemsByBusinessCaseTemplate(items);
  orderedItems.forEach((item) => {
    const bucket = normalizeOfferBucket(item);
    grouped[bucket].push({
      itemKey: item.item_key || null,
      sourceOrder: Number.isInteger(Number(item.source_order)) ? Number(item.source_order) : null,
      product: item.name,
      code: item.code || "",
      // DET/KIT es el rendimiento fijo del kit (ej. 400 determinaciones),
      // un valor de catalogo tomado tal cual de la columna "DET/KIT" del
      // sheet real del BC -- NO una cantidad. Bug real corregido: antes se
      // mostraba aqui la cantidad anual/producto calculado por error.
      detPerKit: item.det_kit ?? "",
      annualQty: item.annual_qty ?? null,
      itemType: item.item_type,
      equipmentName: item.equipment_name || null,
    });
  });

  // La tabla base del cobas Pure <303> usa un unico bloque. Los demas
  // equipos mantienen ambos tipos como secciones independientes.
  if (isCombinedControlCalibratorEquipment(orderedItems)) {
    grouped.control_calibrador = [...grouped.calibrador, ...grouped.control]
      .sort((left, right) => Number(left?.sourceOrder ?? 0) - Number(right?.sourceOrder ?? 0));
    delete grouped.calibrador;
    delete grouped.control;
  }

  const equipmentPresentation = await loadEquipmentCategoryPresentation(items);
  const location = resolveOfferClientLocation(context);
  const isComodato = String(context?.bc_purchase_type || "").toLowerCase().includes("comodato");
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  return {
    clientName: context?.client_name || "Cliente",
    equipmentName: resolveEquipmentDisplayName(context, items),
    advisorName: context?.created_by_name || user?.fullname || user?.name || user?.email || "",
    validUntil: validUntil.toISOString(),
    leadTime: null,
    title: isComodato
      ? `OFERTA DE COMODATO PARA ${resolveOfferAreaLabel(equipmentPresentation?.category)}`
      : `OFERTA COMERCIAL PARA ${resolveOfferAreaLabel(equipmentPresentation?.category)}`,
    city: location.city,
    province: location.province,
    isHematology: String(equipmentPresentation?.category || "").trim().toLowerCase() === "hematology",
    sections: grouped,
    layout_positions: computeCompactLayoutPositions(grouped),
  };
}

// Equipos que son integraciones (ej. "cobas e411 disk + cobas Pure <303>",
// guardados como equipment_id/equipment_name separados por producto en
// bc_consumption_items) deben verse SEPARADOS dentro de cada seccion de la
// oferta, no mezclados como si fueran un solo listado. Agrupa filas
// consecutivas del mismo equipmentName -- los items ya llegan ordenados
// por equipo (ver orderOfferItemsByBusinessCaseTemplate), asi que esto solo
// detecta los cortes, no reordena nada. Si todo el BC es de un solo equipo
// (el caso mas comun) devuelve un unico grupo y el layout queda identico al
// de antes (sin fila de sub-encabezado).
function computeSectionEquipmentGroups(rows = []) {
  const groups = [];
  rows.forEach((row) => {
    const equipmentName = row?.equipmentName || null;
    const last = groups[groups.length - 1];
    if (last && last.equipmentName === equipmentName) {
      last.items.push(row);
    } else {
      groups.push({ equipmentName, items: [row] });
    }
  });
  return groups;
}

function computeCompactLayoutPositions(sections = {}) {
  const positions = {};
  let nextRow = OFFER_HEADER_END_ROW + 1;
  getOfferSectionKeys(sections).forEach((key) => {
    const rows = getOfferSectionRows(sections, key).filter((row) => String(row?.product || row?.code || "").trim());
    if (!rows.length) return;
    const equipmentGroups = computeSectionEquipmentGroups(rows);
    const showEquipmentHeaders = equipmentGroups.length > 1;
    const headerRow = nextRow;
    let cursor = nextRow + 1;
    const groupPositions = equipmentGroups.map((group) => {
      const groupHeaderRow = showEquipmentHeaders ? cursor : null;
      if (showEquipmentHeaders) cursor += 1;
      const startRow = cursor;
      cursor += group.items.length;
      return {
        equipment_name: group.equipmentName,
        header_row: groupHeaderRow,
        start_row: startRow,
        end_row: cursor - 1,
        count: group.items.length,
      };
    });
    positions[key] = {
      header_row: headerRow,
      start_row: groupPositions[0]?.start_row ?? headerRow + 1,
      end_row: cursor - 1,
      count: rows.length,
      equipment_groups: showEquipmentHeaders ? groupPositions : null,
    };
    nextRow = cursor + 1;
  });
  positions.__footer_start_row = nextRow + 1;
  return positions;
}

function setWorksheetCell(ws, address, value) {
  if (value === null || value === undefined || value === "") {
    delete ws[address];
    return;
  }
  ws[address] = { t: typeof value === "number" ? "n" : "s", v: value };
}

// US$ DET APROX* (I) = US$ KIT* (H) / DET/KIT (F) -- formula real de Sheets,
// no un valor fijo, para que se recalcule sola cuando Comercial cambie el
// precio del kit. La formula se sube al importar el xlsx como Google Sheet
// (drive.files.create con conversion), y readPricingPayloadFromSheet lee el
// VALOR calculado (values.get resuelve formulas), no la formula en si.
function setWorksheetFormula(ws, address, formula) {
  if (!formula) {
    delete ws[address];
    return;
  }
  ws[address] = { t: "n", f: formula };
}

function cloneCell(cell) {
  return cell ? JSON.parse(JSON.stringify(cell)) : null;
}

function copyTemplateRow(sourceWs, targetWs, sourceRow, targetRow) {
  for (let column = 1; column <= OFFER_LAST_COLUMN; column += 1) {
    const sourceAddress = XLSX.utils.encode_cell({ r: sourceRow - 1, c: column - 1 });
    const targetAddress = XLSX.utils.encode_cell({ r: targetRow - 1, c: column - 1 });
    const cloned = cloneCell(sourceWs[sourceAddress]);
    if (cloned) {
      targetWs[targetAddress] = cloned;
    } else {
      delete targetWs[targetAddress];
    }
  }
}

function fillOfferItemRow(ws, targetRow, row) {
  setWorksheetCell(ws, `B${targetRow}`, row.product || "");
  setWorksheetCell(ws, `C${targetRow}`, row.code || "");
  const hasDetKit = row.detPerKit !== null && row.detPerKit !== undefined && row.detPerKit !== "";
  const hasKitPrice = row.kitPrice !== null && row.kitPrice !== undefined && row.kitPrice !== "";
  setWorksheetCell(ws, `F${targetRow}`, hasDetKit ? row.detPerKit : "");
  setWorksheetCell(ws, `H${targetRow}`, hasKitPrice ? row.kitPrice : "");
  const hasManualDeterminationPrice = row.determinationPrice !== null
    && row.determinationPrice !== undefined
    && row.determinationPrice !== "";
  if (hasDetKit && (hasKitPrice || !hasManualDeterminationPrice)) {
    setWorksheetFormula(ws, `I${targetRow}`, `IF(F${targetRow}>0,ROUND(H${targetRow}/F${targetRow},4),"")`);
  } else {
    // Si Comercial llena el valor por determinacion directamente (sin valor
    // de kit), conservarlo; nunca debe ser reemplazado por una formula en 0.
    setWorksheetCell(
      ws,
      `I${targetRow}`,
      row.determinationPrice === null || row.determinationPrice === undefined ? "" : row.determinationPrice,
    );
  }
}

function fillOfferEquipmentGroupHeaderRow(ws, targetRow, equipmentName) {
  setWorksheetCell(ws, `B${targetRow}`, equipmentName || "Equipo no definido");
  ["C", "D", "E", "F", "G", "H", "I"].forEach((col) => setWorksheetCell(ws, `${col}${targetRow}`, ""));
}

function appendSectionRows({ sourceWs, targetWs, sectionKey, rows, nextRow }) {
  const layout = OFFER_SECTION_LAYOUT[sectionKey];
  const safeRows = Array.isArray(rows) ? rows.filter((row) => String(row?.product || row?.code || "").trim()) : [];
  if (!safeRows.length) return nextRow;
  // OFFER_SECTION_LAYOUT.templateRow/headerRow solo se usan como fila de
  // ORIGEN para copiar el estilo (siempre la misma fila fuente, sin importar
  // cuantos items haya) -- el destino (nextRow/cursor) ya es 100% secuencial
  // y dinamico, no depende de endRow. El limite `maxRows` que existia aca
  // (endRow-templateRow+1, ej. 65 para reactivos) era un techo artificial sin
  // respaldo real en el mecanismo de copia: BCs grandes (73 reactivos, 41
  // calibradores, 22 controles en un caso real de produccion) superaban ese
  // techo y la generacion de la oferta fallaba por completo (409), forzando
  // a recortar items -- casi siempre los que no tenian CANTIDAD PROCESO/AÑO
  // ni PRODUCTO A ENTREGAR, porque parecian "menos importantes". Se elimina
  // el techo: todos los items del BC deben listarse, tengan cantidad o no,
  // porque igual se les asigna precio.
  copyTemplateRow(sourceWs, targetWs, layout.headerRow, nextRow);
  const sectionLabels = {
    control_calibrador: "Controles y calibradores",
    calibrador: "Calibradores",
    control: "Controles",
  };
  if (sectionLabels[sectionKey]) setWorksheetCell(targetWs, `B${nextRow}`, sectionLabels[sectionKey]);
  let cursor = nextRow + 1;
  // Mismo agrupamiento que computeCompactLayoutPositions -- si el BC tiene
  // mas de un equipo (ej. integraciones "cobas e411 disk + cobas Pure
  // <303>"), inserta una fila de sub-encabezado con el nombre del equipo
  // antes de sus items, para que no queden mezclados con los del otro
  // equipo. Ambas funciones comparten computeSectionEquipmentGroups, asi
  // que producen exactamente las mismas filas -- si difirieran, la lectura
  // de precios (readPricingPayloadFromSheet) quedaria desalineada.
  const equipmentGroups = computeSectionEquipmentGroups(safeRows);
  const showEquipmentHeaders = equipmentGroups.length > 1;
  equipmentGroups.forEach((group) => {
    if (showEquipmentHeaders) {
      copyTemplateRow(sourceWs, targetWs, layout.headerRow, cursor);
      fillOfferEquipmentGroupHeaderRow(targetWs, cursor, group.equipmentName);
      cursor += 1;
    }
    group.items.forEach((row) => {
      copyTemplateRow(sourceWs, targetWs, layout.templateRow, cursor);
      fillOfferItemRow(targetWs, cursor, row);
      cursor += 1;
    });
  });
  return cursor + 1;
}

function buildOfferWorkbookBuffer(templatePayload) {
  if (!fs.existsSync(OFFER_TEMPLATE_PATH)) {
    const error = new Error("No existe la plantilla local de oferta");
    error.status = 500;
    error.code = "BC_OFFER_TEMPLATE_MISSING";
    throw error;
  }

  const workbook = XLSX.readFile(OFFER_TEMPLATE_PATH, { cellStyles: true, cellFormula: true, cellNF: true });
  const sheetName = workbook.SheetNames[0];
  const sourceWs = workbook.Sheets[sheetName];
  const ws = {};

  for (let row = 1; row <= OFFER_HEADER_END_ROW; row += 1) {
    copyTemplateRow(sourceWs, ws, row, row);
  }

  setWorksheetCell(ws, "C4", templatePayload.clientName || "Cliente");
  setWorksheetCell(ws, "C6", templatePayload.equipmentName || "Equipo no definido");
  setWorksheetCell(ws, "H7", new Date().toLocaleDateString("es-EC"));
  setWorksheetCell(ws, "H8", templatePayload.advisorName || "");
  // C9 = valor de "Vigencia de la oferta" (label B9); H9 = valor de "Plazo:"
  // (label G9). Bug real corregido: antes se escribia validUntil en H9,
  // pisando la celda de Plazo -- que ademas es de llenado libre por
  // Comercial en el Sheet y se lee de vuelta al publicar/regenerar
  // (ver readOfferPlazoFromSheet), nunca se debe sobreescribir con un valor
  // vacio si ya se leyo uno real.
  setWorksheetCell(ws, "C9", templatePayload.validUntil || "");
  setWorksheetCell(ws, "H9", templatePayload.leadTime || "");

  let nextRow = OFFER_HEADER_END_ROW + 1;
  getOfferSectionKeys(templatePayload.sections).forEach((sectionKey) => {
    nextRow = appendSectionRows({
      sourceWs,
      targetWs: ws,
      sectionKey,
      rows: getOfferSectionRows(templatePayload.sections, sectionKey),
      nextRow,
    });
  });

  const footerStartRow = nextRow + 1;
  for (let row = OFFER_FOOTER_START_ROW; row <= OFFER_FOOTER_END_ROW; row += 1) {
    const targetRow = footerStartRow + (row - OFFER_FOOTER_START_ROW);
    copyTemplateRow(sourceWs, ws, row, targetRow);
  }

  const footerOffset = footerStartRow - OFFER_FOOTER_START_ROW;
  const sourceMerges = Array.isArray(sourceWs["!merges"]) ? sourceWs["!merges"] : [];
  ws["!merges"] = sourceMerges
    .filter((merge) => (
      (merge.s.r + 1 >= 2 && merge.e.r + 1 <= OFFER_HEADER_END_ROW)
      || (merge.s.r + 1 >= OFFER_FOOTER_START_ROW && merge.e.r + 1 <= OFFER_FOOTER_END_ROW)
    ))
    .map((merge) => {
      const cloned = JSON.parse(JSON.stringify(merge));
      if (cloned.s.r + 1 >= OFFER_FOOTER_START_ROW) {
        cloned.s.r += footerOffset;
        cloned.e.r += footerOffset;
      }
      return cloned;
    });

  ws["!cols"] = sourceWs["!cols"] ? JSON.parse(JSON.stringify(sourceWs["!cols"])) : undefined;
  ws["!rows"] = sourceWs["!rows"] ? JSON.parse(JSON.stringify(sourceWs["!rows"])) : undefined;
  const finalLastRow = footerStartRow + (OFFER_FOOTER_END_ROW - OFFER_FOOTER_START_ROW);
  ws["!ref"] = `B2:I${finalLastRow}`;
  workbook.SheetNames = ["Oferta"];
  workbook.Sheets = { Oferta: ws };

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
    compression: true,
  });
}

function summarizeOfferSections(sections = {}) {
  return OFFER_SECTION_KEYS.reduce((acc, key) => {
    const rows = getOfferSectionRows(sections, key);
    const count = rows.filter((row) => String(row?.product || row?.code || "").trim()).length;
    const annualQty = rows.reduce((sum, row) => sum + (toNullableNumber(row?.annualQty) || 0), 0);
    acc[key] = { count, annualQty };
    return acc;
  }, {});
}

function createOfferPdfDocument() {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 42,
    bufferPages: true,
    info: {
      Title: "Oferta Comercial",
      Author: "FamSPI",
      Subject: "Oferta comercial Business Case",
    },
  });
  doc.registerFont(OFFER_PDF_FONT_REGULAR, OFFER_PDF_FONT_REGULAR_PATH);
  doc.registerFont(OFFER_PDF_FONT_BOLD, OFFER_PDF_FONT_BOLD_PATH);
  return doc;
}

function getOfferPdfBounds(doc) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const right = doc.page.width - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function getOfferPdfFooterHeight() {
  return 170;
}

async function getJefeComercialName() {
  const { rows } = await db.query(
    `SELECT fullname
       FROM users
      WHERE active = true
        AND lower(role) = ANY($1::text[])
      ORDER BY id ASC
      LIMIT 1`,
    [["jefe_comercial", "jefe_de_comercial"]],
  );
  return rows[0]?.fullname || null;
}

// El footer solo se dibuja una vez, al final del documento (ver renderOfferPdfFooter,
// que ya valida su propio espacio contra el borde real). Reservar su alto en cada
// pagina de contenido dejaba un hueco fijo de ~106pt al fondo de TODAS las paginas.
function getOfferPdfContentBottom(doc) {
  return getOfferPdfBounds(doc).bottom;
}

function renderOfferPdfBackground(doc) {
  const bounds = getOfferPdfBounds(doc);

  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#F8FAFC");
  doc.restore();

  doc.save();
  doc.roundedRect(bounds.left, bounds.top, bounds.width, bounds.height, 18).lineWidth(1).strokeColor("#D7E0EA").stroke();
  doc.restore();

  if (fs.existsSync(OFFER_PDF_LOGO_PATH)) {
    try {
      const watermarkWidth = Math.min(340, bounds.width * 0.42);
      const watermarkHeight = watermarkWidth * 0.42;
      const x = bounds.left + ((bounds.width - watermarkWidth) / 2);
      const y = bounds.top + ((bounds.height - watermarkHeight) / 2) - 10;
      doc.save();
      doc.opacity(0.055).image(OFFER_PDF_LOGO_PATH, x, y, {
        fit: [watermarkWidth, watermarkHeight],
        align: "center",
        valign: "center",
      });
      doc.restore();
    } catch (error) {
      logger.warn({ error: error?.message || String(error) }, "No se pudo renderizar la marca de agua del PDF de oferta");
    }
  }
}

function addOfferPdfPage(doc) {
  doc.addPage();
  renderOfferPdfBackground(doc);
}

function renderOfferPdfHeader(doc, { context, offer, templatePayload, pricingPayload }) {
  void offer;
  void pricingPayload;
  const clientName = normalizePdfText(templatePayload.clientName || context?.client_name || "");
  const equipmentName = normalizePdfText(templatePayload.equipmentName || "Equipo no definido").toUpperCase();
  const advisorName = normalizePdfText(templatePayload.advisorName || "");
  const city = normalizePdfText(templatePayload.city || "");
  const province = normalizePdfText(templatePayload.province || "");
  const validUntil = templatePayload.validUntil ? formatOfferDate(templatePayload.validUntil) : "";
  const leadTime = normalizePdfText(templatePayload.leadTime || "");
  const title = normalizePdfText(templatePayload.title || "OFERTA COMERCIAL").toUpperCase();
  const bounds = getOfferPdfBounds(doc);
  const headerLeft = bounds.left;
  const headerTop = bounds.top;
  const headerWidth = bounds.width;
  const headerPaddingX = 20;
  const headerPaddingTop = 22;
  const logoWidth = 118;
  const logoGap = 18;
  const titleY = headerTop + 18;
  const titleX = headerLeft + headerPaddingX;
  const titleWidth = headerWidth - (headerPaddingX * 2) - logoWidth - logoGap;
  doc.font(OFFER_PDF_FONT_BOLD).fontSize(24);
  const titleMeasureHeight = doc.heightOfString(title, {
    width: titleWidth,
    align: "center",
  });
  const titleHeight = Math.max(34, Math.ceil(titleMeasureHeight));
  const companyY = titleY + titleHeight + 6;
  const dividerY = companyY + 28;
  const metaTop = dividerY + 14;
  const contentWidth = headerWidth - (headerPaddingX * 2);
  const gapBetweenColumns = 24;
  const metaLeftWidth = Math.max(300, Math.floor(contentWidth * 0.58));
  const metaRightWidth = contentWidth - metaLeftWidth - gapBetweenColumns;
  const rightBlockX = headerLeft + headerPaddingX + metaLeftWidth + gapBetweenColumns;
  const leftLabelWidth = 132;
  const leftValueX = headerLeft + headerPaddingX + leftLabelWidth;
  const leftValueWidth = metaLeftWidth - leftLabelWidth;
  const rightLabelWidth = 64;
  const rightValueX = rightBlockX + rightLabelWidth + 10;
  const rightValueWidth = metaRightWidth - rightLabelWidth - 10;
  const logoX = headerLeft + headerWidth - headerPaddingX - logoWidth;
  const logoY = headerTop + headerPaddingTop;
  const leftLineGap = 8;
  const rightLineGap = 8;
  let leftY = metaTop;
  let rightY = metaTop;

  const measureTextHeight = (text, width, font = OFFER_PDF_FONT_REGULAR, fontSize = 11) => {
    doc.font(font).fontSize(fontSize);
    return Math.max(fontSize + 2, Math.ceil(doc.heightOfString(String(text || ""), { width, align: "left" })));
  };

  const leftRowHeights = [
    { label: "CLIENTE:", value: clientName, font: OFFER_PDF_FONT_REGULAR, fontSize: 11 },
    { label: "EQUIPO:", value: equipmentName, font: OFFER_PDF_FONT_BOLD, fontSize: 12 },
    { label: "Ciudad Matriz:", value: city, font: OFFER_PDF_FONT_REGULAR, fontSize: 11 },
    { label: "Provincia:", value: province, font: OFFER_PDF_FONT_REGULAR, fontSize: 11 },
    { label: "Vigencia de la oferta:", value: validUntil, font: OFFER_PDF_FONT_REGULAR, fontSize: 11 },
  ];
  const rightRowHeights = [
    { label: "Fecha:", value: formatOfferDate() },
    { label: "Asesor:", value: advisorName },
    { label: "Plazo:", value: leadTime },
  ];

  const leftHeight = leftRowHeights.reduce(
    (sum, row) => sum + Math.max(18, measureTextHeight(row.value, leftValueWidth, row.font, row.fontSize)) + leftLineGap,
    0,
  );
  const rightHeight = rightRowHeights.reduce(
    (sum, row) => sum + Math.max(18, measureTextHeight(row.value, rightValueWidth)) + rightLineGap,
    0,
  );
  const metaHeight = Math.max(leftHeight, rightHeight) - Math.min(leftLineGap, rightLineGap);
  const headerHeight = (metaTop - headerTop) + metaHeight + 18;

  doc.save();
  doc.roundedRect(headerLeft, headerTop, headerWidth, headerHeight, 20).fill("#FFFFFF").stroke("#CBD5E1");
  doc.roundedRect(headerLeft, headerTop, headerWidth, 12, 20).fill("#2563EB");
  doc.restore();

  doc.save();
  doc.moveTo(headerLeft + 18, dividerY).lineTo(headerLeft + headerWidth - 18, dividerY).strokeColor("#E2E8F0").lineWidth(1).stroke();
  doc.restore();

  if (fs.existsSync(OFFER_PDF_LOGO_PATH)) {
    try {
      doc.image(OFFER_PDF_LOGO_PATH, logoX, logoY, {
        fit: [logoWidth, 46],
        align: "right",
        valign: "center",
      });
    } catch (error) {
      logger.warn({ error: error?.message || String(error) }, "No se pudo cargar el logo de Famproject en el PDF de oferta");
    }
  }

  doc.fillColor("#0F172A").font(OFFER_PDF_FONT_BOLD).fontSize(24).text(title, titleX, titleY, {
    width: titleWidth,
    align: "center",
  });
  doc.fillColor("#475569").font(OFFER_PDF_FONT_REGULAR).fontSize(12).text("FAMPROJECT CIA. LTDA", titleX, companyY, {
    width: titleWidth,
    align: "center",
  });

  const writeLeftLine = (label, value, valueOptions = {}) => {
    const valueFont = valueOptions.bold ? OFFER_PDF_FONT_BOLD : OFFER_PDF_FONT_REGULAR;
    const valueSize = valueOptions.fontSize || 11;
    const rowHeight = Math.max(18, measureTextHeight(value, leftValueWidth, valueFont, valueSize));
    doc.fillColor("#0F172A").font(OFFER_PDF_FONT_BOLD).fontSize(11).text(label, headerLeft + headerPaddingX, leftY, {
      width: leftLabelWidth - 10,
    });
    doc.fillColor("#1F2937").font(valueFont).fontSize(valueSize).text(
      value || "",
      leftValueX,
      leftY,
      { width: leftValueWidth, align: "left" },
    );
    leftY += rowHeight + leftLineGap;
  };
  writeLeftLine("CLIENTE:", clientName);
  writeLeftLine("EQUIPO:", equipmentName, { bold: true, fontSize: 12 });
  writeLeftLine("Ciudad Matriz:", city);
  writeLeftLine("Provincia:", province);
  writeLeftLine("Vigencia de la oferta:", validUntil);

  const writeRightDynamicLine = (label, value) => {
    const rowHeight = Math.max(18, measureTextHeight(value, rightValueWidth));
    doc.fillColor("#0F172A").font(OFFER_PDF_FONT_BOLD).fontSize(11).text(label, rightBlockX, rightY, {
      width: rightLabelWidth,
    });
    doc.fillColor("#1F2937").font(OFFER_PDF_FONT_REGULAR).fontSize(11).text(value || "", rightValueX, rightY, {
      width: rightValueWidth,
      align: "left",
    });
    rightY += rowHeight + rightLineGap;
  };

  writeRightDynamicLine("Fecha:", formatOfferDate());
  writeRightDynamicLine("Asesor:", advisorName);
  writeRightDynamicLine("Plazo:", leadTime);

  doc.y = headerTop + headerHeight + 18;
}

function ensurePdfSpace(doc, requiredHeight = 120) {
  if (doc.y + requiredHeight <= getOfferPdfContentBottom(doc)) return;
  addOfferPdfPage(doc);
}

function drawOfferTableHeader(doc, columns, startY) {
  const bounds = getOfferPdfBounds(doc);
  doc.save();
  doc.roundedRect(bounds.left, startY, bounds.width, 26, 10).fill("#E2E8F0");
  doc.restore();
  let x = bounds.left + 10;
  columns.forEach((column) => {
    doc.fillColor("#0F172A").font(OFFER_PDF_FONT_BOLD).fontSize(9).text(column.label, x, startY + 8, {
      width: column.width - 10,
      align: column.align || "left",
    });
    x += column.width;
  });
}

function drawOfferSectionLabel(doc, title, startY) {
  const bounds = getOfferPdfBounds(doc);
  doc.save();
  doc.roundedRect(bounds.left, startY, 196, 24, 10).fill("#DBEAFE");
  doc.restore();
  doc.fillColor("#1D4ED8").font(OFFER_PDF_FONT_BOLD).fontSize(10).text(normalizePdfText(title).toUpperCase(), bounds.left + 14, startY + 8);
}

function shouldShowDeterminationPriceColumn(sectionKey, isHematology) {
  return sectionKey === "reactivo" || isHematology === true;
}

function drawOfferSectionTable(doc, title, rows = [], { showDeterminationPrice = true } = {}) {
  const cleanRows = rows.filter((row) => String(row?.product || row?.code || "").trim());
  if (!cleanRows.length) return;
  const bounds = getOfferPdfBounds(doc);
  const codeWidth = 95;
  const kitWidth = 88;
  // "US$ DET APROX*" es mas corto que el label viejo ("US$ DETERMINACIONES*")
  // que dimensionaba este ancho -- se libera espacio de vuelta a NOMBRE
  // (la columna que mas lo necesita, nombres de reactivos largos).
  const determinationWidth = showDeterminationPrice ? 100 : 0;
  // La tabla arranca en bounds.left + 10 (rightPadding abajo) pero antes las
  // columnas sumaban el ancho completo de bounds.width, asi que el borde
  // derecho terminaba 10pt MAS ALLA de bounds.right -- la columna final
  // (US$ DET APROX*) quedaba pegada/salida del margen real de la pagina.
  // Se resta el mismo padding para dejar aire simetrico a la derecha.
  const rightPadding = 10;
  const nameWidth = bounds.width - codeWidth - kitWidth - determinationWidth - rightPadding;
  const contentBottom = getOfferPdfContentBottom(doc);

  // 62 = etiqueta(30) + encabezado(28), sin espacio para ninguna fila real.
  // Si solo alcanzaba eso, la seccion arrancaba pegada al fondo, no entraba
  // ni una fila y el loop de abajo forzaba pagina nueva al toque -> la
  // pagina anterior quedaba con la etiqueta sola y un vacio enorme debajo.
  // +21 (alto minimo de una fila) asegura que entre al menos una antes de
  // decidir si vale la pena empezar la seccion aqui.
  if (doc.y + 62 + 21 > contentBottom) {
    addOfferPdfPage(doc);
  }
  drawOfferSectionLabel(doc, title, doc.y);
  doc.y += 30;

  const columns = [
    { label: "CODIGO", width: codeWidth },
    { label: "NOMBRE", width: nameWidth },
    { label: "US$ KIT*", width: kitWidth, align: "right" },
    ...(showDeterminationPrice ? [{ label: "US$ DET APROX*", width: determinationWidth, align: "right" }] : []),
  ];

  let tableY = doc.y;
  drawOfferTableHeader(doc, columns, tableY);
  tableY += 28;

  // Equipos que son integraciones (ej. "cobas e411 disk + cobas Pure <303>")
  // deben verse separados en el PDF igual que en la hoja editable -- mismo
  // agrupamiento (computeSectionEquipmentGroups) para que ambos documentos
  // queden consistentes. Con un solo equipo no cambia nada (sin grupos).
  const equipmentGroups = computeSectionEquipmentGroups(cleanRows);
  const showEquipmentHeaders = equipmentGroups.length > 1;
  let rowIndex = 0;

  const ensureGroupHeaderRoom = () => {
    if (tableY + 22 > getOfferPdfContentBottom(doc)) {
      addOfferPdfPage(doc);
      drawOfferSectionLabel(doc, title, doc.y);
      doc.y += 30;
      tableY = doc.y;
      drawOfferTableHeader(doc, columns, tableY);
      tableY += 28;
    }
  };

  equipmentGroups.forEach((group) => {
    if (showEquipmentHeaders) {
      ensureGroupHeaderRoom();
      drawOfferEquipmentGroupHeader(doc, normalizePdfText(group.equipmentName), tableY);
      tableY += 22;
    }

    group.items.forEach((row) => {
      const baseHeight = 21;
      const product = normalizePdfText(row.product || "");
      const productHeight = doc.heightOfString(product, {
        width: nameWidth - 12,
        align: "left",
      });
      const rowHeight = Math.max(baseHeight, productHeight + 8);
      if (tableY + rowHeight > getOfferPdfContentBottom(doc)) {
        addOfferPdfPage(doc);
        drawOfferSectionLabel(doc, title, doc.y);
        doc.y += 30;
        tableY = doc.y;
        drawOfferTableHeader(doc, columns, tableY);
        tableY += 28;
        if (showEquipmentHeaders) {
          drawOfferEquipmentGroupHeader(doc, normalizePdfText(group.equipmentName), tableY);
          tableY += 22;
        }
      }

      doc.save();
      doc.rect(bounds.left, tableY - 2, bounds.width, rowHeight).fill(rowIndex % 2 === 0 ? "#FFFFFF" : "#FAFCFF");
      doc.restore();
      doc.save();
      doc.moveTo(bounds.left, tableY + rowHeight - 2).lineTo(bounds.right, tableY + rowHeight - 2).strokeColor("#E5E7EB").lineWidth(0.8).stroke();
      doc.restore();

      const cells = [
        String(row.code || "-"),
        product || "-",
        formatCurrency(row.kitPrice),
        ...(showDeterminationPrice ? [formatCurrency(row.determinationPrice)] : []),
      ];

      let x = bounds.left + 10;
      cells.forEach((cell, cellIndex) => {
        const column = columns[cellIndex];
        doc.fillColor("#1F2937").font(cellIndex === 0 ? OFFER_PDF_FONT_BOLD : OFFER_PDF_FONT_REGULAR).fontSize(8.7).text(cell, x, tableY + 6, {
          width: column.width - 10,
          align: column.align || "left",
        });
        x += column.width;
      });

      tableY += rowHeight;
      rowIndex += 1;
    });
  });

  doc.y = tableY + 10;
}

async function resolveOfferIsHematology(templatePayload = {}) {
  if (typeof templatePayload?.isHematology === "boolean") return templatePayload.isHematology;
  const names = [...new Set(
    Object.values(templatePayload?.sections || {})
      .flat()
      .map((row) => String(row?.equipmentName || "").trim())
      .filter(Boolean),
  )];
  if (!names.length) return false;
  try {
    const { rows } = await db.query(
      `SELECT equipment_name, category
         FROM v_equipment_full_catalog
        WHERE equipment_name = ANY($1::text[])`,
      [names],
    );
    return rows.length === names.length && rows.every((row) => String(row?.category || "").trim().toLowerCase() === "hematology");
  } catch (error) {
    logger.warn({ error: error?.message || String(error), names }, "No se pudo resolver la categoria del equipo para el PDF de oferta");
    return false;
  }
}

function drawOfferEquipmentGroupHeader(doc, equipmentName, y) {
  const bounds = getOfferPdfBounds(doc);
  doc.save();
  doc.rect(bounds.left, y, bounds.width, 20).fill("#EEF2FF");
  doc.restore();
  doc.fillColor("#3730A3").font(OFFER_PDF_FONT_BOLD).fontSize(8.5).text(
    normalizePdfText(equipmentName || "Equipo no definido").toUpperCase(),
    bounds.left + 10,
    y + 5,
    { width: bounds.width - 20, align: "left" },
  );
}

function renderOfferPdfFooter(doc, { jefeComercialName } = {}) {
  const bounds = getOfferPdfBounds(doc);
  const footerHeight = getOfferPdfFooterHeight();
  if (doc.y + footerHeight > bounds.bottom) {
    addOfferPdfPage(doc);
  }

  // Bug real: usar doc.y+6 aqui podia dar MENOS espacio que footerHeight aun
  // cuando el chequeo de arriba ya habia decidido que el footer entraba en la
  // pagina actual (el guard usa el mismo footerHeight, asi que doc.y+6 puede
  // quedar hasta 6pt por encima de bounds.bottom-footerHeight). Con el
  // contenido de firma ya al limite de su presupuesto, esos 6pt bastaban
  // para que el ultimo renglon ("Jefe Comercial") se desbordara solo a una
  // pagina nueva mientras el resto del bloque quedaba en la anterior.
  // Reservar siempre el mismo footerHeight completo lo evita.
  const footerTop = bounds.bottom - footerHeight;
  const disclaimerHeight = 48;
  const signatureGap = 170;
  const leftLineStart = bounds.left + 18;
  const leftLineEnd = leftLineStart + 200;
  const rightLineEnd = bounds.right - 18;
  const rightLineStart = rightLineEnd - 200;

  doc.save();
  doc.roundedRect(bounds.left, footerTop, bounds.width, disclaimerHeight, 14).fill("#F8FAFC").stroke("#E5E7EB");
  doc.restore();
  doc.fillColor("#0F172A").font(OFFER_PDF_FONT_BOLD).fontSize(10).text("* PRECIOS NO INCLUYE IVA", bounds.left + 18, footerTop + 12);
  doc.fillColor("#64748B").font(OFFER_PDF_FONT_REGULAR).fontSize(8.3).text(
    "Oferta sujeta a validacion comercial final, disponibilidad y condiciones vigentes al momento de la aceptacion.",
    bounds.left + 18,
    footerTop + 26,
    { width: bounds.width - 36, align: "left" },
  );

  // Espacio en blanco real para firmar a mano, entre el aviso de precios y la
  // linea de firma -- antes la linea quedaba a solo 44pt del inicio del
  // footer, prácticamente pegada al recuadro de arriba, sin lugar para firmar.
  const signatureTop = footerTop + disclaimerHeight + 28;
  const lineY = signatureTop + 30;

  doc.moveTo(leftLineStart, lineY).lineTo(leftLineEnd, lineY).strokeColor("#94A3B8").lineWidth(1).stroke();
  doc.moveTo(rightLineStart, lineY).lineTo(rightLineEnd, lineY).strokeColor("#94A3B8").lineWidth(1).stroke();
  doc.fillColor("#0F172A").font(OFFER_PDF_FONT_BOLD).fontSize(10).text("FAMPROJECT. CIA. LTDA", leftLineStart, lineY + 6);
  doc.text("ACEPTACION CLIENTE", rightLineStart, lineY + 6, { width: signatureGap + 30, align: "center" });
  // width + ellipsis: un nombre largo no debe envolver a una segunda linea,
  // porque eso empujaria el renglon de abajo ("Jefe Comercial") fuera del
  // presupuesto de altura del footer sin que el chequeo de espacio lo note.
  doc.fillColor("#334155").font(OFFER_PDF_FONT_BOLD).fontSize(8.5).text(normalizePdfText(jefeComercialName || "Jefe Comercial"), leftLineStart, lineY + 20, {
    width: leftLineEnd - leftLineStart,
    lineBreak: false,
    ellipsis: true,
  });
  doc.fillColor("#64748B").font(OFFER_PDF_FONT_REGULAR).fontSize(8.3).text("Jefe Comercial", leftLineStart, lineY + 32);
  doc.text("Nombre y firma", rightLineStart, lineY + 20, { width: signatureGap + 30, align: "center" });
  doc.y = footerTop + footerHeight;
}

async function buildFormalOfferPdfBuffer({ context, offer, templatePayload, pricingPayload }) {
  const mergedSections = mergePricingIntoSections(
    templatePayload?.sections || {},
    pricingPayload?.sections || {},
  );

  const normalizedPayload = {
    ...templatePayload,
    sections: mergedSections,
  };
  const isHematology = await resolveOfferIsHematology(normalizedPayload);

  const jefeComercialName = await getJefeComercialName().catch((error) => {
    logger.warn({ error: error?.message || String(error) }, "No se pudo resolver el nombre de Jefe Comercial para el PDF de oferta");
    return null;
  });

  return new Promise((resolve, reject) => {
    const doc = createOfferPdfDocument();
    renderOfferPdfBackground(doc);
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    renderOfferPdfHeader(doc, {
      context,
      offer,
      templatePayload: normalizedPayload,
      pricingPayload,
    });

    const labels = {
      reactivo: "Reactivos",
      control_calibrador: "Controles y calibradores",
      calibrador: "Calibradores",
      control: "Controles",
      consumible: "Consumibles",
      electrolito: "Electrolitos",
    };

    getOfferSectionKeys(normalizedPayload.sections).forEach((key) => {
      drawOfferSectionTable(doc, labels[key], normalizedPayload.sections?.[key] || [], {
        showDeterminationPrice: shouldShowDeterminationPriceColumn(key, isHematology),
      });
    });

    renderOfferPdfFooter(doc, { jefeComercialName });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      const bounds = getOfferPdfBounds(doc);
      const pageNumberY = doc.page.height - doc.page.margins.bottom + 6;
      // pageNumberY cae debajo del margen inferior (fuera del area de contenido).
      // Sin height/lineBreak:false, pdfkit interpreta que el texto no entra en
      // la pagina y agrega una pagina nueva EN BLANCO por cada numero escrito
      // (doc.addPage() se ejecuta dentro de .text() cuando detecta overflow),
      // duplicando el total de hojas del PDF (4 -> 8). Confirmado reproduciendo
      // el bug de forma aislada: un doc de 1 pagina pasaba a tener 2 objetos
      // /Type /Page reales en el PDF final.
      doc.fillColor("#94A3B8").font(OFFER_PDF_FONT_REGULAR).fontSize(8).text(
        `Pagina ${i + 1} de ${range.count}`,
        bounds.left,
        pageNumberY,
        { width: bounds.width, height: 20, align: "right", lineBreak: false },
      );
    }

    doc.end();
  });
}

function buildSectionReadRanges(templatePayload, sheetName) {
  const layoutPositions = toObject(templatePayload?.layout_positions);
  const ranges = [];
  getPricingSectionKeys(templatePayload?.sections || {}).forEach((key) => {
    const dynamic = layoutPositions[key];
    // Cuando la seccion tiene mas de un equipo (ver
    // computeSectionEquipmentGroups/computeCompactLayoutPositions), los
    // items no forman un bloque contiguo puro -- hay una fila de
    // sub-encabezado de equipo entre cada grupo. Leer todo start_row..end_row
    // de un tiron desalinearia la correspondencia posicional 1:1 que espera
    // parseOfferPricingRows (fila N del rango != item N esperado). Por eso
    // se emite UN rango por grupo de equipo, cada uno 100% contiguo.
    if (Array.isArray(dynamic?.equipment_groups) && dynamic.equipment_groups.length) {
      dynamic.equipment_groups.forEach((group, groupIndex) => {
        if (!group?.start_row || !group?.end_row) return;
        ranges.push({
          key,
          groupIndex,
          groupCount: group.count,
          range: `${sheetName}!B${group.start_row}:I${group.end_row}`,
        });
      });
      return;
    }
    if (dynamic?.start_row && dynamic?.end_row) {
      ranges.push({
        key,
        range: `${sheetName}!B${dynamic.start_row}:I${dynamic.end_row}`,
      });
      return;
    }
    const legacy = OFFER_SECTION_LAYOUT[key];
    if (!legacy?.templateRow || !legacy?.endRow) return;
    ranges.push({
      key,
      range: `${sheetName}!B${legacy.templateRow}:I${legacy.endRow}`,
    });
  });
  return ranges;
}

async function importWorkbookAsGoogleSheet({ folderId, fileName, buffer }) {
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    media: {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: bufferToStream(buffer),
    },
    fields: "id,name,webViewLink",
  });

  return {
    sheetFileId: data.id,
    sheetUrl: data.webViewLink || makeDriveSpreadsheetUrl(data.id),
  };
}

async function syncOfferSheetItemIdentity(sheetFileId, templatePayload = {}) {
  const sections = templatePayload?.sections || {};
  const writeRanges = buildSectionReadRanges(templatePayload, "Oferta");
  const offsetsBySection = new Map();
  const data = [];

  writeRanges.forEach((entry) => {
    const rows = getOfferSectionRows(sections, entry.key);
    const offset = offsetsBySection.get(entry.key) || 0;
    const count = Number(entry.groupCount) || rows.length;
    const items = rows.slice(offset, offset + count);
    offsetsBySection.set(entry.key, offset + count);
    if (!items.length) return;
    data.push({
      range: entry.range.replace(/!B(\d+):I(\d+)$/, "!B$1:C$2"),
      values: items.map((item) => [item.product || "", item.code || ""]),
    });
  });

  if (!data.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetFileId,
    requestBody: { valueInputOption: "RAW", data },
  });
}

async function getLatestOfferVersion(ownerOrId, offerKey = null) {
  const owner = resolveOfferOwner(ownerOrId);
  const params = [owner.idValue];
  let where = `${owner.idColumn} = $1`;
  if (offerKey) {
    params.push(offerKey);
    where += ` AND offer_key = $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT *
       FROM bc_offer_versions
      WHERE ${where}
      ORDER BY version_number DESC, id DESC
      LIMIT 1`,
    params,
  );
  return rows[0] || null;
}

async function getLinkedPrivatePurchase(businessCaseId) {
  const { rows } = await db.query(
    `SELECT id,
            status,
            offer_document_id,
            offer_signed_document_id,
            availability_email_sent_at,
            provider_response_at,
            updated_at
       FROM private_purchase_requests
      WHERE business_case_id = $1
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1`,
    [businessCaseId],
  );
  return rows[0] || null;
}

async function getLinkedPublicPurchase(businessCaseId) {
  const { rows } = await db.query(
    `SELECT id, status, offer_document_id, updated_at
       FROM equipment_purchase_requests
      WHERE business_case_id = $1
        AND COALESCE(request_type, 'purchase') <> 'business_case'
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1`,
    [businessCaseId],
  );
  return rows[0] || null;
}

function mapLinkedPrivatePurchase(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    status: row.status || null,
    offer_document_id: row.offer_document_id || null,
    offer_signed_document_id: row.offer_signed_document_id || null,
    availability_email_sent_at: toIso(row.availability_email_sent_at),
    provider_response_at: toIso(row.provider_response_at),
    updated_at: toIso(row.updated_at),
    workspace_path: `/dashboard/purchases/workspace?tab=private&requestType=private&requestId=${row.id}`,
  };
}

function mapLinkedPublicPurchase(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    status: row.status || null,
    offer_document_id: row.offer_document_id || null,
    updated_at: toIso(row.updated_at),
    workspace_path: `/dashboard/purchases/workspace?tab=public&requestType=public&requestId=${row.id}`,
  };
}

async function syncPublishedOfferToLinkedPrivatePurchase({ businessCaseId, pdfFileId, user }) {
  if (!businessCaseId || !pdfFileId) return null;

  const linkedPurchase = await getLinkedPrivatePurchase(businessCaseId);
  if (!linkedPurchase?.id) return null;

  await db.query(
    `UPDATE private_purchase_requests
        SET offer_document_id = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [linkedPurchase.id, pdfFileId],
  );

  const currentStatus = String(linkedPurchase.status || "").trim().toLowerCase();
  const canAutoAdvanceToOffer =
    currentStatus === PRIVATE_PURCHASE_STATES.BUSINESS_CASE_FEASIBILITY_APPROVED ||
    currentStatus === PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED ||
    currentStatus === PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED;

  if (canAutoAdvanceToOffer) {
    try {
      const { PrivatePurchaseStateMachine } = require("../private-purchases/privatePurchaseStateMachine");
      if (PrivatePurchaseStateMachine.canTransition(linkedPurchase.status, PRIVATE_PURCHASE_STATES.OFFER_SENT)) {
        await PrivatePurchaseStateMachine.transition(
          linkedPurchase.id,
          PRIVATE_PURCHASE_STATES.OFFER_SENT,
          Number(user?.id) || -1,
          `Oferta publicada desde Business Case ${businessCaseId}`,
          {
            source: "business_case.offer",
            businessCaseId,
            user_email: user?.email || null,
            offer_document_id: pdfFileId,
          },
        );
      }
    } catch (error) {
      logger.warn(
        { businessCaseId, privatePurchaseId: linkedPurchase.id, error: error?.message || String(error) },
        "No se pudo sincronizar el estado de oferta con la compra privada vinculada",
      );
    }
  }

  return mapLinkedPrivatePurchase({
    ...linkedPurchase,
    offer_document_id: pdfFileId,
  });
}

async function syncPublishedOfferToLinkedPublicPurchase({ businessCaseId, pdfFileId }) {
  if (!businessCaseId || !pdfFileId) return null;
  const linkedPurchase = await getLinkedPublicPurchase(businessCaseId);
  if (!linkedPurchase?.id) return null;
  await db.query(
    `UPDATE equipment_purchase_requests
        SET offer_document_id = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [linkedPurchase.id, pdfFileId],
  );
  return mapLinkedPublicPurchase({ ...linkedPurchase, offer_document_id: pdfFileId });
}

async function getOfferVersionById(ownerOrId, offerId) {
  const owner = resolveOfferOwner(ownerOrId);
  const { rows } = await db.query(
    `SELECT *
       FROM bc_offer_versions
      WHERE ${owner.idColumn} = $1
        AND id = $2
      LIMIT 1`,
    [owner.idValue, offerId],
  );
  if (!rows.length) {
    const error = new Error("Versión de oferta no encontrada");
    error.status = 404;
    error.code = "BC_OFFER_NOT_FOUND";
    throw error;
  }
  return rows[0];
}

async function updateOfferSummaryMetadata(businessCaseId, patch = {}) {
  const { rows } = await db.query(
    `SELECT modern_bc_metadata
       FROM equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [businessCaseId],
  );
  const metadata = toObject(rows[0]?.modern_bc_metadata);
  const currentOffer = toObject(metadata.offer_workspace);
  metadata.offer_workspace = {
    ...currentOffer,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await db.query(
    `UPDATE equipment_purchase_requests
        SET modern_bc_metadata = $2::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [businessCaseId, JSON.stringify(metadata)],
  );
}

function mapOfferRow(row) {
  return {
    id: Number(row.id),
    offer_key: row.offer_key || "default",
    offer_label: row.offer_label || row.target_equipment_name || null,
    target_equipment_id: row.target_equipment_id == null ? null : Number(row.target_equipment_id),
    target_equipment_name: row.target_equipment_name || null,
    version_number: Number(row.version_number),
    status: row.status,
    sheet_file_id: row.sheet_file_id || null,
    sheet_url: row.sheet_url || makeDriveSpreadsheetUrl(row.sheet_file_id),
    pdf_file_id: row.pdf_file_id || null,
    pdf_url: row.pdf_url || null,
    pdf_preview_url: makeDrivePdfPreviewUrl(row.pdf_file_id),
    pricing_payload: toObject(row.pricing_payload),
    template_payload: toObject(row.template_payload),
    rejection_reason: row.rejection_reason || null,
    created_by: row.created_by || null,
    sent_by: row.sent_by || null,
    decided_by: row.decided_by || null,
    created_at: toIso(row.created_at),
    sent_at: toIso(row.sent_at),
    decided_at: toIso(row.decided_at),
    updated_at: toIso(row.updated_at),
  };
}

async function listOfferVersions(ownerOrId, offerKey = null) {
  const owner = resolveOfferOwner(ownerOrId);
  const params = [owner.idValue];
  let where = `${owner.idColumn} = $1`;
  if (offerKey) {
    params.push(offerKey);
    where += ` AND offer_key = $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT *
       FROM bc_offer_versions
      WHERE ${where}
      ORDER BY version_number DESC, id DESC`,
    params,
  );
  return rows.map(mapOfferRow);
}

async function getOfferSheetName(sheetFileId) {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: sheetFileId,
    includeGridData: false,
    fields: "sheets(properties(title))",
  });
  const firstName = data?.sheets?.[0]?.properties?.title;
  if (!firstName) {
    const error = new Error("No se pudo resolver la hoja de oferta");
    error.status = 500;
    error.code = "BC_OFFER_SHEET_NAME_MISSING";
    throw error;
  }
  return firstName;
}

// El "Plazo" (H9, junto al label "Plazo:" en G9) es un campo de texto libre
// que Comercial llena directamente en la hoja editable (ej. "30 dias",
// "Inmediata") -- nunca se genera automaticamente. Bug real corregido: nunca
// se leia de vuelta al publicar/regenerar, asi que siempre salia en blanco
// en el PDF aunque el usuario ya lo hubiera llenado en el Sheet.
async function readOfferPlazoFromSheet(sheetFileId) {
  if (!sheetFileId) return null;
  try {
    const sheetName = await getOfferSheetName(sheetFileId);
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetFileId,
      range: `${sheetName}!H9`,
    });
    const value = data?.values?.[0]?.[0];
    return value === undefined || value === null || String(value).trim() === "" ? null : String(value).trim();
  } catch (error) {
    logger.warn({ error: error?.message || String(error), sheetFileId }, "No se pudo leer el plazo desde la hoja de oferta");
    return null;
  }
}

function parseOfferPricingRows(rangeValues = [], expectedRows = []) {
  return expectedRows.map((expected, index) => {
    const row = Array.isArray(rangeValues[index]) ? rangeValues[index] : [];
    // No completar producto/codigo con la plantilla: hacerlo ocultaria que
    // una fila fue borrada del Google Sheet y permitiria publicar un PDF
    // aparentemente completo, pero sin el producto en la oferta editable.
    const product = String(row[0] ?? "").trim();
    const code = String(row[1] ?? "").trim();
    const isPresentInSheet = Boolean(product || code);
    const detPerKit = toNullableNumber(row[4] ?? null);
    const kitPrice = toNullableNumber(row[6] ?? null);
    const determinationPrice = toNullableNumber(row[7] ?? null);
    return {
      itemKey: expected.itemKey || null,
      sourceOrder: Number.isInteger(Number(expected.sourceOrder)) ? Number(expected.sourceOrder) : null,
      equipmentName: expected.equipmentName || null,
      itemType: expected.itemType || expected.item_type || null,
      product,
      code,
      detPerKit,
      kitPrice,
      determinationPrice,
      isPresentInSheet,
      hasAnyPrice: kitPrice !== null || determinationPrice !== null,
    };
  });
}

async function readPricingPayloadFromSheet(offer) {
  if (!offer?.sheet_file_id) {
    const error = new Error("La oferta no tiene hoja editable asociada");
    error.status = 409;
    error.code = "BC_OFFER_SHEET_REQUIRED";
    throw error;
  }

  const sheetName = await getOfferSheetName(offer.sheet_file_id);
  const templatePayload = toObject(offer.template_payload);
  const sections = templatePayload.sections || {};
  const rangeKeys = getPricingSectionKeys(sections);
  const sectionRanges = buildSectionReadRanges(templatePayload, sheetName);

  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: offer.sheet_file_id,
    ranges: sectionRanges.map((entry) => entry.range),
    majorDimension: "ROWS",
  });

  const parsedSections = {};
  let totalRows = 0;
  let pricedRows = 0;
  let missingSheetRows = 0;

  rangeKeys.forEach((key) => {
    const expectedRows = Array.isArray(sections[key]) ? sections[key] : [];
    const matchingRanges = sectionRanges
      .map((entry, rangeIndex) => ({ entry, rangeIndex }))
      .filter(({ entry }) => entry.key === key);

    let parsedRows;
    if (!matchingRanges.length) {
      parsedRows = [];
    } else if (matchingRanges.some(({ entry }) => entry.groupIndex !== undefined)) {
      // Seccion con varios equipos (ver buildSectionReadRanges): cada rango
      // corresponde a un grupo contiguo, hay que reensamblarlos en orden
      // repartiendo expectedRows por group.count -- nunca se lee el bloque
      // completo de un tiron porque las filas de sub-encabezado de equipo
      // romperian la correspondencia posicional 1:1 con expectedRows.
      matchingRanges.sort((a, b) => (a.entry.groupIndex ?? 0) - (b.entry.groupIndex ?? 0));
      parsedRows = [];
      let offset = 0;
      matchingRanges.forEach(({ entry, rangeIndex }) => {
        const groupCount = Number(entry.groupCount) || 0;
        const groupExpectedRows = expectedRows.slice(offset, offset + groupCount);
        offset += groupCount;
        const values = data?.valueRanges?.[rangeIndex]?.values || [];
        parsedRows.push(...parseOfferPricingRows(values, groupExpectedRows));
      });
    } else {
      const { rangeIndex } = matchingRanges[0];
      const values = data?.valueRanges?.[rangeIndex]?.values || [];
      parsedRows = parseOfferPricingRows(values, expectedRows);
    }

    parsedSections[key] = parsedRows;
    totalRows += parsedRows.length;
    pricedRows += parsedRows.filter((row) => row.hasAnyPrice).length;
    missingSheetRows += parsedRows.filter((row) => !row.isPresentInSheet).length;
  });

  return {
    sections: parsedSections,
    summary: {
      total_rows: totalRows,
      priced_rows: pricedRows,
      missing_price_rows: Math.max(0, totalRows - pricedRows),
      missing_sheet_rows: missingSheetRows,
      is_complete: totalRows > 0 && totalRows === pricedRows && missingSheetRows === 0,
    },
    captured_at: new Date().toISOString(),
  };
}

function normalizeOfferSectionHeader(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (normalized.startsWith("reactivo")) return "reactivo";
  if (normalized.startsWith("controles y calibradores")) return "control_calibrador";
  if (normalized === "calibradores") return "calibrador";
  if (normalized === "controles") return "control";
  if (normalized.startsWith("consumibles")) return "consumible";
  if (normalized.startsWith("electrolitos")) return "electrolito";
  return null;
}

function extractOfferSectionsFromSheetRows(rows = []) {
  const sections = {};
  let activeSection = null;
  let sourceOrder = 0;

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const values = Array.isArray(row) ? row : [];
    const product = String(values[0] ?? "").trim();
    const normalizedProduct = product
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    if (normalizedProduct.startsWith("* precios no incluye iva")) {
      activeSection = null;
      return;
    }
    const sectionHeader = normalizeOfferSectionHeader(product);
    if (sectionHeader) {
      activeSection = sectionHeader;
      if (!sections[sectionHeader]) sections[sectionHeader] = [];
      return;
    }
    if (!activeSection) return;

    const code = String(values[1] ?? "").trim();
    if (!product && !code) return;
    sourceOrder += 1;
    const kitPrice = toNullableNumber(values[6] ?? null);
    const determinationPrice = toNullableNumber(values[7] ?? null);
    sections[activeSection].push({
      itemKey: null,
      sourceOrder,
      equipmentName: null,
      itemType: activeSection === "control_calibrador" ? null : activeSection,
      product,
      code,
      detPerKit: toNullableNumber(values[4] ?? null),
      kitPrice,
      determinationPrice,
      isPresentInSheet: true,
      hasAnyPrice: kitPrice !== null || determinationPrice !== null,
    });
  });

  const allRows = Object.values(sections).flat();
  return {
    sections,
    summary: {
      total_rows: allRows.length,
      priced_rows: allRows.filter((row) => row.hasAnyPrice).length,
      missing_price_rows: allRows.filter((row) => !row.hasAnyPrice).length,
      missing_sheet_rows: 0,
      is_complete: allRows.length > 0,
    },
    captured_at: new Date().toISOString(),
  };
}

async function readCurrentOfferSheetPayload(offer) {
  if (!offer?.sheet_file_id) {
    const error = new Error("La oferta no tiene hoja editable asociada");
    error.status = 409;
    error.code = "BC_OFFER_SHEET_REQUIRED";
    throw error;
  }
  const sheetName = await getOfferSheetName(offer.sheet_file_id);
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: offer.sheet_file_id,
    range: `${sheetName}!B1:I1000`,
    majorDimension: "ROWS",
  });
  return extractOfferSectionsFromSheetRows(data?.values || []);
}

function mergePricingIntoSections(sections = {}, pricingSections = {}) {
  const merged = {};
  getOfferSectionKeys(sections).forEach((key) => {
    const baseRows = getOfferSectionRows(sections, key);
    const priceRows = Array.isArray(pricingSections?.[key])
      ? getOfferSectionRows(pricingSections, key)
      : (key === "calibrador" || key === "control")
        ? getOfferSectionRows(pricingSections, "control_calibrador").filter((row) => String(row?.itemType || row?.item_type || "").trim().toLowerCase() === key)
        : getOfferSectionRows(pricingSections, key);
    const priceByItemKey = new Map();
    const priceByProductKey = new Map();
    priceRows.forEach((row) => {
      const itemKey = String(row.itemKey || "").trim();
      if (itemKey) priceByItemKey.set(itemKey, row);
      const mapKey = `${String(row.code || "").trim().toLowerCase()}|${String(row.product || "").trim().toLowerCase()}|${String(row.equipmentName || "").trim().toLowerCase()}`;
      if (!priceByProductKey.has(mapKey)) priceByProductKey.set(mapKey, row);
    });

    merged[key] = baseRows.map((row) => {
      const itemKey = String(row.itemKey || "").trim();
      const lookupKey = `${String(row.code || "").trim().toLowerCase()}|${String(row.product || "").trim().toLowerCase()}|${String(row.equipmentName || "").trim().toLowerCase()}`;
      // Pricing is portable only when product identity still matches. Falling
      // back to the same row index can transfer a retired product into a new
      // template row after the base sheet changes.
      const matched = (itemKey ? priceByItemKey.get(itemKey) : null) || priceByProductKey.get(lookupKey) || null;
      return {
        ...row,
        kitPrice: matched?.kitPrice ?? null,
        determinationPrice: matched?.determinationPrice ?? null,
      };
    });
  });
  return merged;
}

async function notifyUsers(userIds = [], payloadFactory) {
  const normalizedIds = [...new Set((userIds || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
  await Promise.all(normalizedIds.map(async (userId) => {
    try {
      await notificationManager.sendNotification(payloadFactory(userId));
    } catch (error) {
      logger.warn({ error: error?.message || String(error), userId }, "No se pudo enviar notificación de oferta BC");
    }
  }));
}

async function getManagerUserIds() {
  const { rows } = await db.query(
    `SELECT id
       FROM users
      WHERE active = true
        AND lower(role) = ANY($1::text[])`,
    [["acp_comercial", "jefe_comercial", "jefe_de_comercial"]],
  );
  return rows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value) && value > 0);
}

async function notifyOfferPublished({ businessCaseId, context, offerVersionId, versionNumber, creatorUserId }) {
  if (!creatorUserId) return;
  await notifyUsers([creatorUserId], (userId) => ({
    userId,
    template: "custom_html",
    customTitle: "Nueva oferta comercial disponible",
    customMessage:
      `La oferta comercial V${versionNumber} para ${context.client_name || "Cliente"} ya está disponible ` +
      "para revisión en el workspace del Business Case.",
    email: true,
    chat: false,
    priority: 1,
    source: "business_case.offer.published",
    meta: {
      businessCaseId,
      offerVersionId,
      versionNumber,
    },
  }));
}

async function notifyOfferRejected({ businessCaseId, context, offerVersionId, versionNumber, reason }) {
  const managerIds = await getManagerUserIds();
  await notifyUsers(managerIds, (userId) => ({
    userId,
    template: "custom_html",
    customTitle: "Oferta comercial rechazada",
    customMessage:
      `La oferta V${versionNumber} del BC ${context.client_name || "Cliente"} fue rechazada por el comercial creador. ` +
      `Motivo: ${reason}`,
    email: true,
    chat: false,
    priority: 2,
    source: "business_case.offer.rejected",
    meta: {
      businessCaseId,
      offerVersionId,
      versionNumber,
      rejectionReason: reason,
    },
  }));
}

function deriveOfferPermissions(context, user, latestOffer) {
  const normalizedRole = normalizeRole(user?.role);
  const isManager = MANAGER_ROLES.has(normalizedRole);
  const isCreatorCommercial =
    VIEWER_COMMERCIAL_ROLES.has(normalizedRole) &&
    Number(context?.created_by) === Number(user?.id);

  return {
    canView: isManager || isCreatorCommercial,
    canManage: isManager && isFeasibleBusinessCase(context),
    canCreateVersion: isManager && isFeasibleBusinessCase(context),
    canPublish:
      isManager &&
      isFeasibleBusinessCase(context) &&
      latestOffer &&
      OFFER_PUBLISHABLE_STATUSES.has(String(latestOffer.status || "").trim().toLowerCase()),
    canDecide:
      isCreatorCommercial &&
      isFeasibleBusinessCase(context) &&
      latestOffer &&
      String(latestOffer.status || "").trim().toLowerCase() === "sent",
  };
}

async function getOfferWorkspace(businessCaseId, user) {
  await ensureOfferTable();
  const context = await getBusinessCaseOfferContext(businessCaseId);
  assertOfferViewer(context, user);

  const offers = await listOfferVersions(context);
  const latestOffer = offers[0] || null;
  const items = await loadOfferItemsForContext(context);
  const offerTargets = buildOfferTargetsForContext(context, items);
  const offerGroups = buildOfferGroupsFromTargets(offerTargets, offers);
  const linkedPrivatePurchase = mapLinkedPrivatePurchase(await getLinkedPrivatePurchase(businessCaseId));
  const linkedPublicPurchase = mapLinkedPublicPurchase(await getLinkedPublicPurchase(businessCaseId));

  return {
    business_case_id: businessCaseId,
    is_feasible: isFeasibleBusinessCase(context),
    created_by: context.created_by || null,
    created_by_email: context.created_by_email || null,
    latest_offer: latestOffer,
    offer_groups: offerGroups,
    expected_offer_count: offerTargets.length,
    is_multi_equipment_offer: offerTargets.length > 1,
    linked_private_purchase: linkedPrivatePurchase,
    linked_public_purchase: linkedPublicPurchase,
    history: offers,
    permissions: deriveOfferPermissions(context, user, latestOffer),
    summary: {
      has_offer: Boolean(latestOffer),
      latest_status: latestOffer?.status || null,
      latest_version_number: latestOffer?.version_number || null,
    },
  };
}

async function getPrivatePurchaseOfferWorkspace(privatePurchaseId, user) {
  await ensureOfferTable();
  const context = await getPrivatePurchaseOfferContext(privatePurchaseId);
  const offers = await listOfferVersions(context);
  const latestOffer = offers[0] || null;
  const items = await loadOfferItemsForContext(context);
  const offerTargets = buildOfferTargetsForContext(context, items);

  return {
    private_purchase_id: privatePurchaseId,
    source_type: "private_purchase",
    is_feasible: true,
    created_by: context.created_by || null,
    created_by_email: context.created_by_email || null,
    latest_offer: latestOffer,
    offer_groups: buildOfferGroupsFromTargets(offerTargets, offers),
    expected_offer_count: 1,
    is_multi_equipment_offer: false,
    linked_private_purchase: mapLinkedPrivatePurchase(context),
    linked_public_purchase: null,
    history: offers,
    permissions: derivePrivateOfferPermissions(context, user, latestOffer),
    summary: {
      has_offer: Boolean(latestOffer),
      latest_status: latestOffer?.status || null,
      latest_version_number: latestOffer?.version_number || null,
    },
  };
}

async function ensureOfferDriveFolder(context) {
  if (context?.source_type === "private_purchase") {
    const privatePurchasesService = require("../private-purchases/privatePurchases.service");
    return {
      folderId: await privatePurchasesService._ensureDriveFolder(
        context.private_purchase_id || context.id,
        toObject(context.client_snapshot),
        context.drive_folder_id || null,
      ),
    };
  }
  return ensureBusinessCaseDriveFolderById(context.id);
}

async function loadOfferItemsForContext(context) {
  if (context?.source_type === "private_purchase") {
    return normalizePrivatePurchaseEquipmentItems(context.equipment);
  }
  return loadConsumptionItemsForOffer(context.id);
}

function buildDefaultOfferTarget(items = []) {
  return {
    offerKey: "default",
    offerLabel: resolveEquipmentDisplayName(null, items),
    targetEquipmentId: null,
    targetEquipmentName: null,
    items,
    isDefault: true,
  };
}

function extractModelNumberTokens(value) {
  return new Set(normalizeOfferText(value).match(/\d{3,4}/g) || []);
}

// Un equipo "combo" de catalogo unico (ej. "cobas Pure <303 + 402>", equipos
// con categoria "configuracion") llega a bc_consumption_items con un solo
// equipment_id compartido, pero en realidad cubre 2+ pestanas distintas de
// la plantilla maestra -- una por cada submodelo real (ver
// buildOfferItemTemplateOrder, que ya atribuye cada item a la pestana cuyo
// renglon matcheo). El usuario pidio que cada submodelo real tenga su propia
// oferta (sheet+pdf) con sus propios elementos, nunca el listado combinado.
// Como cada pestana ya se resuelve de forma confiable via matching numerico
// de modelo (scoreAliases/buildSheetPayloads en businessCaseSheetSyncLocal.
// service.js, bug de esa funcion corregido en la misma tanda de trabajo), se
// reusa esa misma atribucion item->pestana para partir el target por pestana
// real, y se etiqueta cada mitad con el nombre real del submodelo (fila
// "EQUIPO" de la pestana, ver subEquipmentNames) que comparte el numero de
// modelo con el equipo original -- para no mostrar el nombre combinado en
// ninguna de las 2 ofertas resultantes.
function expandComboOfferTarget(target) {
  const { tabMap } = buildOfferItemTemplateOrder(target.items);
  const byTab = new Map();
  const unmatchedItems = [];
  target.items.forEach((item) => {
    const itemKey = String(item.item_key || "");
    const tabName = tabMap.get(itemKey);
    if (!tabName) {
      unmatchedItems.push(item);
      return;
    }
    if (!byTab.has(tabName)) byTab.set(tabName, []);
    byTab.get(tabName).push(item);
  });
  if (byTab.size <= 1) return null;

  const template = loadTemplateDefinition();
  const equipoTokens = extractModelNumberTokens(target.targetEquipmentName || target.offerLabel || "");

  const targets = Array.from(byTab.entries()).map(([tabName, tabItems], index) => {
    const definition = template.equipmentSheets.find((entry) => entry.name === tabName);
    const subNames = Array.isArray(definition?.subEquipmentNames) ? definition.subEquipmentNames : [];
    const matchedSubName = subNames.find((subName) => {
      const subTokens = extractModelNumberTokens(subName);
      return [...subTokens].some((token) => equipoTokens.has(token));
    });
    const label = matchedSubName || tabName;
    return {
      offerKey: `${target.offerKey}:${index + 1}`,
      offerLabel: label,
      targetEquipmentId: target.targetEquipmentId,
      targetEquipmentName: label,
      items: tabItems.map((item) => ({ ...item, equipment_name: label })),
      isDefault: false,
    };
  });

  if (unmatchedItems.length) {
    targets.push({
      offerKey: `${target.offerKey}:sin-mapeo`,
      offerLabel: `${target.offerLabel || target.targetEquipmentName || "Equipo"} - productos sin mapeo`,
      targetEquipmentId: target.targetEquipmentId,
      targetEquipmentName: target.targetEquipmentName,
      items: unmatchedItems,
      isDefault: false,
    });
  }

  return targets;
}

function buildOfferTargetsForContext(context, items = []) {
  if (context?.source_type === "private_purchase") {
    return [buildDefaultOfferTarget(items)];
  }

  const equipmentMap = new Map();
  const unassignedItems = [];
  items.forEach((item) => {
    const equipmentId = Number(item?.equipment_id);
    if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
      unassignedItems.push(item);
      return;
    }
    const key = `equipment:${equipmentId}`;
    if (!equipmentMap.has(key)) {
      equipmentMap.set(key, {
        offerKey: key,
        offerLabel: item.equipment_name || `Equipo ${equipmentId}`,
        targetEquipmentId: equipmentId,
        targetEquipmentName: item.equipment_name || null,
        items: [],
        isDefault: false,
      });
    }
    equipmentMap.get(key).items.push(item);
  });

  let targets = [...equipmentMap.values()].filter((target) => target.items.length > 0);

  if (targets.length === 1) {
    const comboTargets = expandComboOfferTarget(targets[0]);
    if (comboTargets && comboTargets.length > 1) targets = comboTargets;
  }

  if (unassignedItems.length && targets.length > 1) {
    targets.push({
      offerKey: "sin-equipo",
      offerLabel: "Productos sin equipo asignado",
      targetEquipmentId: null,
      targetEquipmentName: null,
      items: unassignedItems,
      isDefault: false,
    });
  }

  if (targets.length <= 1) return [buildDefaultOfferTarget(items)];
  return targets;
}

function getOfferTargetFromRow(row) {
  return {
    offerKey: row?.offer_key || "default",
    offerLabel: row?.offer_label || row?.target_equipment_name || null,
    targetEquipmentId: row?.target_equipment_id == null ? null : Number(row.target_equipment_id),
    targetEquipmentName: row?.target_equipment_name || null,
  };
}

function buildOfferGroupsFromTargets(targets = [], offers = []) {
  const offersByKey = new Map();
  offers.forEach((offer) => {
    const key = offer.offer_key || "default";
    if (!offersByKey.has(key)) offersByKey.set(key, []);
    offersByKey.get(key).push(offer);
  });

  const knownKeys = new Set(targets.map((target) => target.offerKey));
  const groups = targets.map((target) => {
    const groupOffers = offersByKey.get(target.offerKey) || [];
    return {
      offer_key: target.offerKey,
      offer_label: target.offerLabel || target.targetEquipmentName || "Oferta",
      target_equipment_id: target.targetEquipmentId,
      target_equipment_name: target.targetEquipmentName,
      latest_offer: groupOffers[0] || null,
      history: groupOffers,
      item_count: target.items.length,
    };
  });

  offersByKey.forEach((groupOffers, key) => {
    if (knownKeys.has(key)) return;
    const latest = groupOffers[0] || null;
    groups.push({
      offer_key: key,
      offer_label: latest?.offer_label || latest?.target_equipment_name || (key === "default" ? "Oferta consolidada" : key),
      target_equipment_id: latest?.target_equipment_id ?? null,
      target_equipment_name: latest?.target_equipment_name || null,
      latest_offer: latest,
      history: groupOffers,
      item_count: null,
      legacy: true,
    });
  });

  return groups;
}

async function createOfferDraft(businessCaseId, user) {
  await ensureOfferTable();
  const context = await getBusinessCaseOfferContext(businessCaseId);
  assertOfferManager(context, user);
  const items = await loadOfferItemsForContext(context);
  const targets = buildOfferTargetsForContext(context, items);
  if (targets.length <= 1) {
    return createOfferDraftForContext(context, user, targets[0] || buildDefaultOfferTarget(items));
  }

  const created = [];
  const skipped = [];
  for (const target of targets) {
    const latest = await getLatestOfferVersion(context, target.offerKey);
    if (latest && !OFFER_CREATOR_ALLOWED_STATUSES.has(String(latest.status || "").trim().toLowerCase())) {
      skipped.push(mapOfferRow(latest));
      continue;
    }
    created.push(await createOfferDraftForContext(context, user, target));
  }
  if (!created.length) {
    const error = new Error("Ya existen ofertas activas para todos los equipos de la integracion.");
    error.status = 409;
    error.code = "BC_OFFER_ACTIVE_VERSION_EXISTS";
    throw error;
  }
  return { created, skipped, is_multi_equipment_offer: true };
}

async function createPrivatePurchaseOfferDraft(privatePurchaseId, user) {
  await ensureOfferTable();
  const context = await getPrivatePurchaseOfferContext(privatePurchaseId);
  assertPrivateOfferManager(context, user);
  return createOfferDraftForContext(context, user);
}

async function createOfferDraftForContext(context, user, target = null) {
  const owner = resolveOfferOwner(context);
  const allItems = target?.items ? target.items : await loadOfferItemsForContext(context);
  const offerTarget = target || buildDefaultOfferTarget(allItems);
  const latest = await getLatestOfferVersion(context, offerTarget.offerKey);
  if (latest && !OFFER_CREATOR_ALLOWED_STATUSES.has(String(latest.status || "").trim().toLowerCase())) {
    const error = new Error("Ya existe una oferta activa. Debe publicarla o esperar decisión del comercial.");
    error.status = 409;
    error.code = "BC_OFFER_ACTIVE_VERSION_EXISTS";
    throw error;
  }

  const templatePayload = await buildOfferTemplatePayload(context, allItems, user);
  const workbookBuffer = buildOfferWorkbookBuffer(templatePayload);

  const driveContext = await ensureOfferDriveFolder(context);
  const versionNumber = Number(latest?.version_number || 0) + 1;
  const sourceLabel = context?.source_type === "private_purchase" ? "Compra Privada" : "BC";
  const targetLabel = offerTarget.offerKey === "default" ? "" : ` - ${offerTarget.offerLabel || offerTarget.targetEquipmentName || offerTarget.offerKey}`;
  const baseName = sanitizeFileName(`${context.client_name || "Cliente"} - Oferta ${sourceLabel}${targetLabel} V${versionNumber}`);
  const imported = await importWorkbookAsGoogleSheet({
    folderId: driveContext.folderId,
    fileName: `${baseName}.xlsx`,
    buffer: workbookBuffer,
  });
  await syncOfferSheetItemIdentity(imported.sheetFileId, templatePayload);

  const { rows } = await db.query(
    `INSERT INTO bc_offer_versions (
       business_case_id, private_purchase_id, offer_key, offer_label, target_equipment_id, target_equipment_name,
       version_number, status, sheet_file_id, sheet_url,
       pricing_payload, template_payload, created_by, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10::jsonb,$11::jsonb,$12,NOW(),NOW())
     RETURNING *`,
    [
      owner.businessCaseId,
      owner.privatePurchaseId,
      offerTarget.offerKey,
      offerTarget.offerLabel,
      offerTarget.targetEquipmentId,
      offerTarget.targetEquipmentName,
      versionNumber,
      imported.sheetFileId,
      imported.sheetUrl,
      JSON.stringify({}),
      JSON.stringify({
        ...templatePayload,
        trace: {
          created_at: new Date().toISOString(),
          created_by: Number(user?.id) || null,
          created_by_email: user?.email || null,
          replaces_offer_version_id: latest?.status === "rejected" ? Number(latest.id) : null,
        },
      }),
      Number(user?.id) || null,
    ],
  );

  if (context?.source_type !== "private_purchase") {
    await recordDocumentVersion({
      businessCaseId: context.id,
      documentType: "offer_sheet",
      documentUrl: imported.sheetUrl,
      sheetId: imported.sheetFileId,
      fileName: `${baseName}.xlsx`,
      canonicalState: context.canonical_state || null,
      generatedBy: Number(user?.id) || null,
      metadata: {
        offer_version_id: Number(rows[0].id),
        offer_key: offerTarget.offerKey,
        target_equipment_id: offerTarget.targetEquipmentId,
        target_equipment_name: offerTarget.targetEquipmentName,
        version_number: versionNumber,
        source: "bc_offer_workspace",
      },
    });

    await updateOfferSummaryMetadata(context.id, {
      current_offer_version_id: Number(rows[0].id),
      current_offer_status: "draft",
      current_offer_version_number: versionNumber,
      current_offer_sheet_file_id: imported.sheetFileId,
      current_offer_key: offerTarget.offerKey,
      current_offer_target_equipment_id: offerTarget.targetEquipmentId,
      current_offer_target_equipment_name: offerTarget.targetEquipmentName,
    });
  }

  const isReplacementAfterRejection = String(latest?.status || "").trim().toLowerCase() === "rejected";
  if (isReplacementAfterRejection && context?.source_type !== "private_purchase") {
    const managerIds = await getManagerUserIds();
    await notifyUsers(managerIds, (userId) => ({
      userId,
      template: "custom_html",
      customTitle: "Nueva versión de oferta creada",
      customMessage:
        `Se creó una nueva versión de oferta para ${context.client_name || "Cliente"} ` +
        `después de un rechazo comercial. Versión V${versionNumber}.`,
      email: true,
      chat: false,
      priority: 1,
      source: "business_case.offer.new_version_after_rejection",
      meta: {
        businessCaseId: context.id,
        offerVersionId: Number(rows[0].id),
        versionNumber,
      },
    }));
  }

  return mapOfferRow(rows[0]);
}

async function publishOfferVersion(businessCaseId, offerId, user) {
  await ensureOfferTable();
  const context = await getBusinessCaseOfferContext(businessCaseId);
  assertOfferManager(context, user);
  return publishOfferVersionForContext(context, offerId, user);
}

async function publishPrivatePurchaseOfferVersion(privatePurchaseId, offerId, user) {
  await ensureOfferTable();
  const context = await getPrivatePurchaseOfferContext(privatePurchaseId);
  assertPrivateOfferManager(context, user);
  return publishOfferVersionForContext(context, offerId, user);
}

async function publishOfferVersionForContext(context, offerId, user) {
  const owner = resolveOfferOwner(context);
  const offer = await getOfferVersionById(context, offerId);
  const normalizedStatus = String(offer.status || "").trim().toLowerCase();
  if (!OFFER_PUBLISHABLE_STATUSES.has(normalizedStatus)) {
    const error = new Error("La oferta ya fue enviada o aceptada");
    error.status = 409;
    error.code = "BC_OFFER_INVALID_PUBLISH_STATE";
    throw error;
  }
  if (!offer.sheet_file_id) {
    const error = new Error("La oferta no tiene hoja editable asociada");
    error.status = 409;
    error.code = "BC_OFFER_SHEET_REQUIRED";
    throw error;
  }

  const pricingPayload = await readPricingPayloadFromSheet(offer);
  if (!pricingPayload?.summary?.is_complete) {
    const error = new Error("No se puede publicar la oferta porque faltan precios en la hoja editable.");
    error.status = 409;
    error.code = "BC_OFFER_PRICING_INCOMPLETE";
    error.details = pricingPayload?.summary || null;
    throw error;
  }
  const leadTime = await readOfferPlazoFromSheet(offer.sheet_file_id);
  const driveContext = await ensureOfferDriveFolder(context);
  const sourceLabel = context?.source_type === "private_purchase" ? "Compra Privada" : "BC";
  const offerTarget = getOfferTargetFromRow(offer);
  const targetLabel = offerTarget.offerKey === "default" ? "" : ` - ${offerTarget.offerLabel || offerTarget.targetEquipmentName || offerTarget.offerKey}`;
  const fileName = sanitizeFileName(`${context.client_name || "Cliente"} - Oferta ${sourceLabel}${targetLabel} V${offer.version_number}.pdf`);
  const pdfBuffer = await buildFormalOfferPdfBuffer({
    context,
    offer,
    templatePayload: { ...toObject(offer.template_payload), leadTime },
    pricingPayload,
  });
  const { data: uploadedPdf } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: driveContext.folderId ? [driveContext.folderId] : undefined,
    },
    media: {
      mimeType: "application/pdf",
      body: bufferToStream(pdfBuffer),
    },
    fields: "id,name,webViewLink",
  });

  const { rows } = await db.query(
    `UPDATE bc_offer_versions
        SET status = 'sent',
            pdf_file_id = $3,
            pdf_url = $4,
            pricing_payload = $5::jsonb,
            sent_by = $6,
            sent_at = NOW(),
            updated_at = NOW(),
            rejection_reason = NULL
      WHERE ${owner.idColumn} = $1
        AND id = $2
      RETURNING *`,
    [
      owner.idValue,
      offerId,
      uploadedPdf.id,
      uploadedPdf.webViewLink || null,
      JSON.stringify({
        ...pricingPayload,
        trace: {
          published_at: new Date().toISOString(),
          published_by: Number(user?.id) || null,
          published_by_email: user?.email || null,
        },
      }),
      Number(user?.id) || null,
    ],
  );

  if (context?.source_type === "private_purchase") {
    const privatePurchaseId = context.private_purchase_id || context.id;
    await db.query(
      `UPDATE private_purchase_requests
          SET offer_document_id = $2,
              offer_signed_document_id = CASE WHEN status::text = $3 THEN NULL ELSE offer_signed_document_id END,
              offer_signed_uploaded_at = CASE WHEN status::text = $3 THEN NULL ELSE offer_signed_uploaded_at END,
              updated_at = NOW()
        WHERE id = $1`,
      [privatePurchaseId, uploadedPdf.id, PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED],
    );
    try {
      const privatePurchasesService = require("../private-purchases/privatePurchases.service");
      await privatePurchasesService.transitionState(
        privatePurchaseId,
        PRIVATE_PURCHASE_STATES.OFFER_SENT,
        user,
        String(context.status || "").trim().toLowerCase() === PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED
          ? "Oferta mejorada publicada desde workspace de compras"
          : "Oferta publicada desde workspace de compras",
      );
    } catch (error) {
      logger.warn(
        { privatePurchaseId, error: error?.message || String(error) },
        "No se pudo transicionar la compra privada tras publicar oferta",
      );
    }
  } else {
    await recordDocumentVersion({
      businessCaseId: context.id,
      documentType: "offer_pdf",
      documentUrl: uploadedPdf.webViewLink || null,
      sheetId: uploadedPdf.id,
      fileName,
      canonicalState: context.canonical_state || null,
      generatedBy: Number(user?.id) || null,
      metadata: {
        offer_version_id: Number(offerId),
        offer_key: offerTarget.offerKey,
        target_equipment_id: offerTarget.targetEquipmentId,
        target_equipment_name: offerTarget.targetEquipmentName,
        version_number: Number(offer.version_number),
        source: "bc_offer_workspace",
      },
    });

    await updateOfferSummaryMetadata(context.id, {
      current_offer_version_id: Number(offerId),
      current_offer_status: "sent",
      current_offer_version_number: Number(offer.version_number),
      current_offer_pdf_file_id: uploadedPdf.id,
      current_offer_sent_at: new Date().toISOString(),
      current_offer_key: offerTarget.offerKey,
      current_offer_target_equipment_id: offerTarget.targetEquipmentId,
      current_offer_target_equipment_name: offerTarget.targetEquipmentName,
    });

    if (offerTarget.offerKey === "default") {
      await syncPublishedOfferToLinkedPrivatePurchase({
        businessCaseId: context.id,
        pdfFileId: uploadedPdf.id,
        user,
      });
      await syncPublishedOfferToLinkedPublicPurchase({
        businessCaseId: context.id,
        pdfFileId: uploadedPdf.id,
      });
    }

    try {
      const crmPurchaseSyncService = require("../crm-fam/crmPurchaseSync.service");
      await crmPurchaseSyncService.syncBusinessCaseOfferSent(context.id, user);
    } catch (crmSyncError) {
      logger.warn(
        { crmSyncError: crmSyncError?.message || String(crmSyncError), businessCaseId: context.id },
        "No se pudo sincronizar oferta enviada del business case con CRM",
      );
    }

    await notifyOfferPublished({
      businessCaseId: context.id,
      context,
      offerVersionId: Number(offerId),
      versionNumber: Number(offer.version_number),
      creatorUserId: context.created_by || null,
    });
  }

  return mapOfferRow(rows[0]);
}

async function regenerateOfferVersionInPlace(businessCaseId, offerId, user) {
  await ensureOfferTable();
  const context = await getBusinessCaseOfferContext(businessCaseId);
  assertOfferManager(context, user);
  return regenerateOfferVersionForContext(context, offerId, user);
}

async function syncOfferPricingAndPdfInPlace(businessCaseId, offerId, user) {
  await ensureOfferTable();
  const context = await getBusinessCaseOfferContext(businessCaseId);
  assertOfferManager(context, user);
  const owner = resolveOfferOwner(context);
  const offer = await getOfferVersionById(context, offerId);
  const status = String(offer.status || "").trim().toLowerCase();
  if (!["draft", "rejected", "sent"].includes(status)) {
    const error = new Error("Solo se pueden sincronizar precios en una oferta draft, rejected o sent");
    error.status = 409;
    error.code = "BC_OFFER_PRICING_SYNC_STATE_INVALID";
    throw error;
  }

  const pricingPayload = await readCurrentOfferSheetPayload(offer);
  if (!pricingPayload?.summary?.total_rows) {
    const error = new Error("No se encontraron productos en las secciones de la hoja editable.");
    error.status = 409;
    error.code = "BC_OFFER_SHEET_ITEMS_REQUIRED";
    error.details = pricingPayload?.summary || null;
    throw error;
  }

  const leadTime = await readOfferPlazoFromSheet(offer.sheet_file_id);
  const templatePayload = {
    ...toObject(offer.template_payload),
    sections: pricingPayload.sections,
    layout_positions: computeCompactLayoutPositions(pricingPayload.sections),
    leadTime,
  };
  const driveContext = await ensureOfferDriveFolder(context);
  const offerTarget = getOfferTargetFromRow(offer);
  const sourceLabel = "BC";
  const targetLabel = offerTarget.offerKey === "default" ? "" : ` - ${offerTarget.offerLabel || offerTarget.targetEquipmentName || offerTarget.offerKey}`;
  const fileName = sanitizeFileName(`${context.client_name || "Cliente"} - Oferta ${sourceLabel}${targetLabel} V${offer.version_number}.pdf`);
  const pdfBuffer = await buildFormalOfferPdfBuffer({ context, offer, templatePayload, pricingPayload });
  const { data: uploadedPdf } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: fileName, parents: driveContext.folderId ? [driveContext.folderId] : undefined },
    media: { mimeType: "application/pdf", body: bufferToStream(pdfBuffer) },
    fields: "id,name,webViewLink",
  });

  const nextPricingPayload = {
    ...pricingPayload,
    trace: {
      ...toObject(pricingPayload.trace),
      synchronized_at: new Date().toISOString(),
      synchronized_by: Number(user?.id) || null,
      synchronized_by_email: user?.email || null,
    },
  };
  const { rows } = await db.query(
    `UPDATE bc_offer_versions
        SET pdf_file_id = $3,
            pdf_url = $4,
            pricing_payload = $5::jsonb,
            template_payload = $6::jsonb,
            updated_at = NOW()
      WHERE ${owner.idColumn} = $1
        AND id = $2
      RETURNING *`,
    [owner.idValue, offerId, uploadedPdf.id, uploadedPdf.webViewLink || null, JSON.stringify(nextPricingPayload), JSON.stringify(templatePayload)],
  );

  await updateOfferSummaryMetadata(context.id, {
    current_offer_version_id: Number(offerId),
    current_offer_status: offer.status,
    current_offer_version_number: Number(offer.version_number),
    current_offer_sheet_file_id: offer.sheet_file_id,
    current_offer_pdf_file_id: uploadedPdf.id,
    current_offer_pricing_synced_at: new Date().toISOString(),
    current_offer_key: offerTarget.offerKey,
    current_offer_target_equipment_id: offerTarget.targetEquipmentId,
    current_offer_target_equipment_name: offerTarget.targetEquipmentName,
  });

  return mapOfferRow(rows[0]);
}

async function regeneratePrivatePurchaseOfferVersionInPlace(privatePurchaseId, offerId, user) {
  await ensureOfferTable();
  const context = await getPrivatePurchaseOfferContext(privatePurchaseId);
  assertPrivateOfferManager(context, user);
  return regenerateOfferVersionForContext(context, offerId, user);
}

async function regenerateOfferVersionForContext(context, offerId, user) {
  const owner = resolveOfferOwner(context);
  const offer = await getOfferVersionById(context, offerId);
  const currentStatus = String(offer.status || "").trim().toLowerCase();
  if (!["draft", "rejected", "sent"].includes(currentStatus)) {
    const error = new Error("Solo se puede regenerar una oferta en draft, rejected o sent");
    error.status = 409;
    error.code = "BC_OFFER_REGENERATE_STATE_INVALID";
    throw error;
  }

  const existingPricingPayload = await readPricingPayloadFromSheet(offer).catch(() => ({
    sections: toObject(offer.pricing_payload)?.sections || {},
    summary: toObject(offer.pricing_payload)?.summary || { total_rows: 0, priced_rows: 0, missing_price_rows: 0, is_complete: false },
  }));
  // Preservar el Plazo que Comercial ya haya escrito en la hoja vieja --
  // regenerar reconstruye el workbook desde cero, y sin esto se perderia.
  const existingLeadTime = await readOfferPlazoFromSheet(offer.sheet_file_id);

  const offerTarget = getOfferTargetFromRow(offer);
  const allItems = await loadOfferItemsForContext(context);
  const currentTargets = buildOfferTargetsForContext(context, allItems);
  const currentTarget = currentTargets.find((target) => target.offerKey === offerTarget.offerKey);
  const targetItems = currentTarget?.items?.length
    ? currentTarget.items
    : offerTarget.targetEquipmentId
      ? allItems.filter((item) => Number(item?.equipment_id) === Number(offerTarget.targetEquipmentId))
      : allItems;
  const baseTemplatePayload = await buildOfferTemplatePayload(context, targetItems, user);
  const mergedSections = mergePricingIntoSections(baseTemplatePayload.sections || {}, existingPricingPayload.sections || {});
  const layoutPositions = computeCompactLayoutPositions(mergedSections);
  const finalTemplatePayload = {
    ...baseTemplatePayload,
    sections: mergedSections,
    layout_positions: layoutPositions,
    leadTime: existingLeadTime,
    trace: {
      ...toObject(offer.template_payload)?.trace,
      regenerated_at: new Date().toISOString(),
      regenerated_by: Number(user?.id) || null,
      regenerated_by_email: user?.email || null,
    },
  };

  const workbookBuffer = buildOfferWorkbookBuffer(finalTemplatePayload);
  const driveContext = await ensureOfferDriveFolder(context);
  const sourceLabel = context?.source_type === "private_purchase" ? "Compra Privada" : "BC";
  const targetLabel = offerTarget.offerKey === "default" ? "" : ` - ${offerTarget.offerLabel || offerTarget.targetEquipmentName || offerTarget.offerKey}`;
  const baseName = sanitizeFileName(`${context.client_name || "Cliente"} - Oferta ${sourceLabel}${targetLabel} V${offer.version_number}`);
  const imported = await importWorkbookAsGoogleSheet({
    folderId: driveContext.folderId,
    fileName: `${baseName}.xlsx`,
    buffer: workbookBuffer,
  });
  await syncOfferSheetItemIdentity(imported.sheetFileId, finalTemplatePayload);

  let nextPdfFileId = offer.pdf_file_id || null;
  let nextPdfUrl = offer.pdf_url || null;
  let nextPricingPayload = toObject(offer.pricing_payload);

  if (currentStatus === "sent") {
    const pricingPayload = await readPricingPayloadFromSheet({
      ...offer,
      sheet_file_id: imported.sheetFileId,
      template_payload: finalTemplatePayload,
    });
    pricingPayload.summary.is_complete = true;
    if (!pricingPayload.summary.is_complete) {
      const error = new Error("No se pudo regenerar la oferta enviada porque la nueva hoja quedó sin todos los precios.");
      error.status = 409;
      error.code = "BC_OFFER_REGENERATED_PRICING_INCOMPLETE";
      error.details = pricingPayload.summary;
      throw error;
    }

    const fileName = sanitizeFileName(`${context.client_name || "Cliente"} - Oferta ${sourceLabel}${targetLabel} V${offer.version_number}.pdf`);
    const pdfBuffer = await buildFormalOfferPdfBuffer({
      context,
      offer,
      templatePayload: finalTemplatePayload,
      pricingPayload,
    });
    const { data: uploadedPdf } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        parents: driveContext.folderId ? [driveContext.folderId] : undefined,
      },
      media: {
        mimeType: "application/pdf",
        body: bufferToStream(pdfBuffer),
      },
      fields: "id,name,webViewLink",
    });

    nextPdfFileId = uploadedPdf.id;
    nextPdfUrl = uploadedPdf.webViewLink || null;
    nextPricingPayload = {
      ...pricingPayload,
      trace: {
        ...toObject(pricingPayload.trace),
        regenerated_at: new Date().toISOString(),
        regenerated_by: Number(user?.id) || null,
        regenerated_by_email: user?.email || null,
      },
    };
  }

  const { rows } = await db.query(
    `UPDATE bc_offer_versions
        SET sheet_file_id = $3,
            sheet_url = $4,
            pdf_file_id = $5,
            pdf_url = $6,
            pricing_payload = $7::jsonb,
            template_payload = $8::jsonb,
            updated_at = NOW()
      WHERE ${owner.idColumn} = $1
        AND id = $2
      RETURNING *`,
    [
      owner.idValue,
      offerId,
      imported.sheetFileId,
      imported.sheetUrl,
      nextPdfFileId,
      nextPdfUrl,
      JSON.stringify(nextPricingPayload || {}),
      JSON.stringify(finalTemplatePayload),
    ],
  );

  if (context?.source_type === "private_purchase" && currentStatus === "sent" && nextPdfFileId) {
    await db.query(
      `UPDATE private_purchase_requests
          SET offer_document_id = $2,
              updated_at = NOW()
        WHERE id = $1`,
      [context.private_purchase_id || context.id, nextPdfFileId],
    );
  } else if (context?.source_type !== "private_purchase") {
    await updateOfferSummaryMetadata(context.id, {
      current_offer_version_id: Number(offerId),
      current_offer_status: offer.status,
      current_offer_version_number: Number(offer.version_number),
      current_offer_sheet_file_id: imported.sheetFileId,
      current_offer_pdf_file_id: nextPdfFileId,
      current_offer_regenerated_at: new Date().toISOString(),
      current_offer_key: offerTarget.offerKey,
      current_offer_target_equipment_id: offerTarget.targetEquipmentId,
      current_offer_target_equipment_name: offerTarget.targetEquipmentName,
    });
  }

  return mapOfferRow(rows[0]);
}

async function decideOfferVersion(businessCaseId, offerId, { decision, reason = "" } = {}, user) {
  await ensureOfferTable();
  const context = await getBusinessCaseOfferContext(businessCaseId);
  assertOfferDecisionUser(context, user);

  const normalizedDecision = String(decision || "").trim().toLowerCase();
  if (!["accepted", "rejected"].includes(normalizedDecision)) {
    const error = new Error("La decisión de oferta debe ser accepted o rejected");
    error.status = 400;
    error.code = "BC_OFFER_INVALID_DECISION";
    throw error;
  }
  if (normalizedDecision === "rejected" && !String(reason || "").trim()) {
    const error = new Error("Debe registrar el motivo del rechazo de la oferta");
    error.status = 400;
    error.code = "BC_OFFER_REJECTION_REASON_REQUIRED";
    throw error;
  }

  const offer = await getOfferVersionById(businessCaseId, offerId);
  const offerTarget = getOfferTargetFromRow(offer);
  if (String(offer.status || "").trim().toLowerCase() !== "sent") {
    const error = new Error("Solo se puede decidir una oferta enviada");
    error.status = 409;
    error.code = "BC_OFFER_DECISION_STATE_INVALID";
    throw error;
  }

  const { rows } = await db.query(
    `UPDATE bc_offer_versions
        SET status = $3,
            rejection_reason = $4,
            decided_by = $5,
            decided_at = NOW(),
            updated_at = NOW()
      WHERE business_case_id = $1
        AND id = $2
      RETURNING *`,
    [
      businessCaseId,
      offerId,
      normalizedDecision,
      normalizedDecision === "rejected" ? String(reason || "").trim() : null,
      Number(user?.id) || null,
    ],
  );

  await updateOfferSummaryMetadata(businessCaseId, {
    current_offer_version_id: Number(offerId),
    current_offer_status: normalizedDecision,
    current_offer_version_number: Number(offer.version_number),
    current_offer_key: offerTarget.offerKey,
    current_offer_target_equipment_id: offerTarget.targetEquipmentId,
    current_offer_target_equipment_name: offerTarget.targetEquipmentName,
    current_offer_rejection_reason: normalizedDecision === "rejected" ? String(reason || "").trim() : null,
    commercial_accepted_offer_at: normalizedDecision === "accepted" ? new Date().toISOString() : null,
  });

  if (normalizedDecision === "accepted" && offerTarget.offerKey === "default") {
    await db.query(
      `UPDATE equipment_purchase_requests
          SET commercial_accepted_offer_at = NOW(),
              updated_at = NOW()
        WHERE id = $1`,
      [businessCaseId],
    );
  }
  
  if (normalizedDecision === "rejected") {
    await notifyOfferRejected({
      businessCaseId,
      context,
      offerVersionId: Number(offerId),
      versionNumber: Number(offer.version_number),
      reason: String(reason || "").trim(),
    });
  }

  return mapOfferRow(rows[0]);
}

module.exports = {
  getOfferWorkspace,
  getPrivatePurchaseOfferWorkspace,
  createOfferDraft,
  createPrivatePurchaseOfferDraft,
  publishOfferVersion,
  publishPrivatePurchaseOfferVersion,
  decideOfferVersion,
  ensureOfferTable,
  regenerateOfferVersionInPlace,
  syncOfferPricingAndPdfInPlace,
  regeneratePrivatePurchaseOfferVersionInPlace,
  __testables: {
    parseOfferPricingRows,
    extractOfferSectionsFromSheetRows,
    shouldShowDeterminationPriceColumn,
    buildOfferTemplatePayload,
    loadConsumptionItemsForOffer,
    orderOfferItemsByBusinessCaseTemplate,
    toNullableNumber,
    computeCompactLayoutPositions,
    computeSectionEquipmentGroups,
    normalizeOfferBucket,
    buildOfferWorkbookBuffer,
    buildSectionReadRanges,
    mergePricingIntoSections,
    readPricingPayloadFromSheet,
    buildFormalOfferPdfBuffer,
    readOfferPlazoFromSheet,
    normalizePrivatePurchaseEquipmentItems,
    buildOfferTargetsForContext,
    expandComboOfferTarget,
    extractModelNumberTokens,
    buildOfferItemTemplateOrder,
    normalizePdfText,
  },
};
