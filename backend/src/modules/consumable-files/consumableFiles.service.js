const { v4: uuidv4 } = require("uuid");

const db = require("../../config/db");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");
const { uploadBase64File, ensureFolder } = require("../../utils/drive");
const XLSX = require("xlsx");

const DEFAULT_SECTIONS = [
  { area_code: "inmunologia", label: "Inmunologia", sort_order: 10 },
  { area_code: "quimica", label: "Quimica", sort_order: 20 },
  { area_code: "quimica_sanguinea", label: "Quimica sanguinea", sort_order: 30 },
  { area_code: "otros", label: "Otros", sort_order: 40 },
];

const FILE_EDIT_ROLES = new Set([
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "backoffice",
  "backoffice_comercial",
  "acp_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "gerencia",
  "gerencia_general",
]);

const ORDER_REVIEW_ROLES = new Set(["jefe_operaciones", "gerencia", "gerencia_general"]);
const DISPATCH_ROLES = new Set(["jefe_logistica", "logistica", "gerencia", "gerencia_general"]);
const ORDER_NOTIFICATION_ROLES = ["jefe_operaciones", "jefe_logistica"];
const LIFECYCLE_ROLES = new Set(["jefe_operaciones", "jefe_logistica", "gerencia", "gerencia_general"]);
const STANDALONE_ADVISOR_ROLES = new Set([
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "backoffice",
  "backoffice_comercial",
  "acp_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
]);
// ponytail: solo 'comercial' inicia el flujo de Control de Consumibles (decision de negocio,
// no ampliar a otros roles de venta sin pedirlo explicitamente).
const STANDALONE_CREATE_ROLES = new Set(["comercial"]);

// Documentos previos: el proceso ya ocurrio fuera del sistema (oferta, contrato, inspeccion,
// entrega ya realizadas). Aqui solo se sube evidencia, no se repiten los pasos del flujo de
// compras privadas/publicas.
const STANDALONE_REQUIRED_DOC_TYPES = [
  "signed_offer",
  "contract_client_signed",
  "site_inspection_fst07",
  "delivery_act_fst10",
];
const STANDALONE_OPTIONAL_DOC_TYPES = ["visual_reception_fst14"];
const STANDALONE_DOC_LABELS = {
  signed_offer: "Oferta firmada por el cliente",
  contract_client_signed: "Contrato firmado por el cliente",
  site_inspection_fst07: "Inspeccion de ambiente (F.ST-07)",
  delivery_act_fst10: "Acta de entrega (F.ST-10)",
  visual_reception_fst14: "Evidencia de recepcion visual (F.ST-14)",
};
const STANDALONE_DOC_TYPES = new Set([...STANDALONE_REQUIRED_DOC_TYPES, ...STANDALONE_OPTIONAL_DOC_TYPES]);
const STANDALONE_SECTION_MAP = {
  chemistry: { area_code: "quimica", label: "Quimica", sort_order: 10 },
  immunology: { area_code: "inmunologia", label: "Inmunologia", sort_order: 20 },
  hematology: { area_code: "hematologia", label: "Hematologia", sort_order: 30 },
  bgm: { area_code: "gasometria", label: "Gasometria", sort_order: 40 },
  default: { area_code: "otros", label: "Otros", sort_order: 90 },
};

function buildWorkspacePath(file) {
  const purchaseType = String(file?.purchase_type || "").trim().toLowerCase();
  const purchaseRequestId = purchaseType === "public"
    ? file?.equipment_purchase_request_id
    : file?.private_purchase_request_id;
  if (!purchaseType || !purchaseRequestId) return "/workspace/compras";
  return `/workspace/compras/${purchaseType}/${purchaseRequestId}`;
}

function buildError(message, { status = 400, code = "CONSUMABLE_FILES_ERROR", details = null } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function normalizeText(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normalizeNumeric(value, fieldName, { min = 0, allowZero = true } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw buildError(`${fieldName} invalido`, {
      code: "INVALID_NUMERIC_VALUE",
      details: { field: fieldName },
    });
  }
  if (allowZero ? parsed < min : parsed <= min) {
    throw buildError(`${fieldName} fuera de rango`, {
      code: "INVALID_NUMERIC_RANGE",
      details: { field: fieldName, min },
    });
  }
  return Number(parsed.toFixed(3));
}

function normalizeItemType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["reactivo", "control", "calibrador", "consumible", "material", "otro"].includes(normalized)) {
    return normalized;
  }
  return "otro";
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "si", "yes", "on"].includes(normalized);
}

function normalizeRoleTokens(user) {
  const raw = [
    ...(Array.isArray(user?.roles) ? user.roles : [user?.roles]),
    ...(Array.isArray(user?.role) ? user.role : [user?.role]),
    ...(Array.isArray(user?.scope) ? user.scope : [user?.scope]),
  ];
  return raw
    .flatMap((item) => String(item || "").split(/[,\s]+/))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function hasAnyRole(user, allowedRoles) {
  const roles = normalizeRoleTokens(user);
  return roles.some((role) => allowedRoles.has(role));
}

async function queryWithClient(client, sql, params = []) {
  if (client) return client.query(sql, params);
  return db.query(sql, params);
}

async function listUsersByRoles(roles, client = null) {
  const normalizedRoles = Array.isArray(roles)
    ? roles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (!normalizedRoles.length) return [];
  const { rows } = await queryWithClient(
    client,
    `SELECT id, role, email, fullname AS full_name
       FROM public.users
      WHERE active = true
        AND lower(role) = ANY($1::text[])`,
    [normalizedRoles],
  );
  return rows;
}

function mapStandaloneSection(category) {
  const normalized = String(category || "").trim().toLowerCase();
  return STANDALONE_SECTION_MAP[normalized] || STANDALONE_SECTION_MAP.default;
}

// ponytail: la lista de clientes real (sincronizada desde Odoo) vive en public.client_requests
// (65 filas), no en public.clients (0 filas, tabla legacy). listAccessibleClients en
// clients.service.js ya lee de client_requests — este modulo debe hacer lo mismo. Ver
// [[feedback_client_requests_vs_clients]] si se agrega esa memoria.
async function getClientSnapshot(clientId, client = null) {
  const normalizedClientId = Number(clientId);
  if (!Number.isInteger(normalizedClientId)) {
    throw buildError("client_id invalido", {
      code: "INVALID_CLIENT_ID",
    });
  }
  const { rows } = await queryWithClient(
    client,
    `SELECT id, commercial_name, ruc_cedula, establishment_city, establishment_province
       FROM public.client_requests
      WHERE id = $1
      LIMIT 1`,
    [normalizedClientId],
  );
  if (!rows.length) {
    throw buildError("Cliente no encontrado", {
      status: 404,
      code: "CLIENT_NOT_FOUND",
    });
  }
  const row = rows[0];
  return {
    id: Number(row.id),
    name: normalizeText(row.commercial_name) || `Cliente #${row.id}`,
    legal_name: normalizeText(row.commercial_name),
    commercial_name: normalizeText(row.commercial_name),
    ruc: normalizeText(row.ruc_cedula),
    city: normalizeText(row.establishment_city),
    province: normalizeText(row.establishment_province),
  };
}

async function getAdvisorSnapshot(userId, client = null) {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId)) {
    throw buildError("advisor_user_id invalido", {
      code: "INVALID_ADVISOR_USER_ID",
    });
  }
  const { rows } = await queryWithClient(
    client,
    `SELECT id, email, fullname, role, active
       FROM public.users
      WHERE id = $1
      LIMIT 1`,
    [normalizedUserId],
  );
  if (!rows.length) {
    throw buildError("Asesor no encontrado", {
      status: 404,
      code: "ADVISOR_NOT_FOUND",
    });
  }
  const row = rows[0];
  if (!normalizeBoolean(row.active, true)) {
    throw buildError("El asesor seleccionado no se encuentra activo", {
      status: 409,
      code: "ADVISOR_INACTIVE",
    });
  }
  const role = String(row.role || "").trim().toLowerCase();
  if (!STANDALONE_ADVISOR_ROLES.has(role)) {
    throw buildError("El usuario seleccionado no tiene un rol valido como asesor", {
      status: 409,
      code: "ADVISOR_ROLE_INVALID",
    });
  }
  return {
    id: Number(row.id),
    fullname: normalizeText(row.fullname) || normalizeText(row.email) || `Usuario #${row.id}`,
    email: normalizeText(row.email),
    role,
  };
}

async function getEquipmentModelSnapshots(equipmentIds = [], client = null) {
  const normalizedIds = Array.from(new Set(
    (Array.isArray(equipmentIds) ? equipmentIds : [equipmentIds])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  ));
  if (!normalizedIds.length) return [];
  const { rows } = await queryWithClient(
    client,
    `SELECT
       em.id,
       em.servicio_equipo_id,
       COALESCE(NULLIF(em.name, ''), NULLIF(em.model, ''), NULLIF(em.description, ''), CONCAT('Equipo #', em.id)) AS label,
       LOWER(COALESCE(em.category, '')) AS category,
       COUNT(DISTINCT ec.consumable_id)::int AS consumable_count
     FROM public.equipment_models em
     LEFT JOIN public.catalog_equipment_consumables ec ON ec.equipment_id = em.servicio_equipo_id
     WHERE em.id = ANY($1::int[])
     GROUP BY em.id, em.servicio_equipo_id, em.name, em.model, em.description, em.category
     ORDER BY label ASC`,
    [normalizedIds],
  );
  if (rows.length !== normalizedIds.length) {
    const foundIds = new Set(rows.map((row) => Number(row.id)));
    const missingId = normalizedIds.find((id) => !foundIds.has(id));
    throw buildError(`Equipo no encontrado: ${missingId}`, {
      status: 404,
      code: "EQUIPMENT_MODEL_NOT_FOUND",
    });
  }
  return rows.map((row) => {
    const area = mapStandaloneSection(row.category);
    return {
      id: Number(row.id),
      servicio_equipo_id: row.servicio_equipo_id !== null ? Number(row.servicio_equipo_id) : null,
      label: row.label,
      category: row.category || "otros",
      area_code: area.area_code,
      area_label: area.label,
      consumable_count: Number(row.consumable_count || 0),
    };
  });
}

async function buildStandaloneEquipmentPreview(equipmentIds = [], client = null) {
  const equipment = await getEquipmentModelSnapshots(equipmentIds, client);
  if (!equipment.length) {
    return { equipment: [], sections: [], summary: { equipment_count: 0, consumable_count: 0 } };
  }
  const { rows } = await queryWithClient(
    client,
    `SELECT
       em.id AS equipment_model_id,
       em.servicio_equipo_id,
       COALESCE(NULLIF(em.name, ''), NULLIF(em.model, ''), NULLIF(em.description, ''), CONCAT('Equipo #', em.id)) AS equipment_label,
       LOWER(COALESCE(em.category, '')) AS category,
       c.id AS consumable_id,
       c.name AS consumable_name,
       c.type AS consumable_type,
       c.supplier_code,
       c.units_per_kit,
       c.unit_price
     FROM public.equipment_models em
     INNER JOIN public.catalog_equipment_consumables ec ON ec.equipment_id = em.servicio_equipo_id
     INNER JOIN public.catalog_consumables c ON c.id = ec.consumable_id
     WHERE em.id = ANY($1::int[])
     ORDER BY equipment_label ASC, c.type ASC, c.name ASC`,
    [equipment.map((item) => item.id)],
  );

  const sectionMap = new Map();
  for (const row of rows) {
    const area = mapStandaloneSection(row.category);
    if (!sectionMap.has(area.area_code)) {
      sectionMap.set(area.area_code, {
        area_code: area.area_code,
        label: area.label,
        sort_order: area.sort_order,
        equipment: new Map(),
        items_by_type: {
          reactivo: [],
          calibrador: [],
          control: [],
          material: [],
          otro: [],
        },
      });
    }
    const section = sectionMap.get(area.area_code);
    const equipmentKey = Number(row.equipment_model_id);
    if (!section.equipment.has(equipmentKey)) {
      section.equipment.set(equipmentKey, {
        id: equipmentKey,
        servicio_equipo_id: row.servicio_equipo_id !== null ? Number(row.servicio_equipo_id) : null,
        label: row.equipment_label,
        category: String(row.category || "").trim().toLowerCase() || "otros",
        consumables_total: 0,
      });
    }
    section.equipment.get(equipmentKey).consumables_total += 1;
    const normalizedType = normalizeItemType(row.consumable_type);
    if (!section.items_by_type[normalizedType]) section.items_by_type[normalizedType] = [];
    section.items_by_type[normalizedType].push({
      id: Number(row.consumable_id),
      name: row.consumable_name,
      type: normalizedType,
      supplier_code: row.supplier_code || null,
      units_per_box: row.units_per_kit !== null ? Number(row.units_per_kit) : null,
      unit_price: row.unit_price !== null ? Number(row.unit_price) : null,
      equipment_model_id: equipmentKey,
      equipment_label: row.equipment_label,
    });
  }

  const sections = Array.from(sectionMap.values())
    .map((section) => {
      const itemsByType = Object.fromEntries(
        Object.entries(section.items_by_type).map(([type, items]) => [type, items]),
      );
      const totalItems = Object.values(itemsByType).reduce((acc, items) => acc + items.length, 0);
      return {
        area_code: section.area_code,
        label: section.label,
        sort_order: section.sort_order,
        equipment: Array.from(section.equipment.values()).sort((left, right) => left.label.localeCompare(right.label, "es")),
        items_by_type: itemsByType,
        total_items: totalItems,
      };
    })
    .sort((left, right) => left.sort_order - right.sort_order);

  return {
    equipment,
    sections,
    summary: {
      equipment_count: equipment.length,
      consumable_count: rows.length,
    },
  };
}

async function buildStandaloneMetadata({
  file,
  processName = null,
  clientId = undefined,
  contractingEntity = undefined,
  sameEntityAsClient = undefined,
  contractObject = undefined,
  advisorUserId = undefined,
  equipmentIds = undefined,
}, client = null) {
  const previousStandalone = file?.metadata?.standalone && typeof file.metadata.standalone === "object"
    ? file.metadata.standalone
    : {};
  const nextClientId = clientId !== undefined
    ? (clientId === null || clientId === "" ? null : Number(clientId))
    : (file?.client_id !== undefined ? file.client_id : null);
  if (nextClientId !== null && nextClientId !== undefined && !Number.isInteger(nextClientId)) {
    throw buildError("client_id invalido", {
      code: "INVALID_CLIENT_ID",
    });
  }
  const sameEntity = sameEntityAsClient !== undefined
    ? normalizeBoolean(sameEntityAsClient)
    : normalizeBoolean(previousStandalone.same_entity_as_client);
  const selectedEquipmentIds = equipmentIds !== undefined
    ? Array.from(new Set((Array.isArray(equipmentIds) ? equipmentIds : [equipmentIds])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)))
    : Array.from(new Set((Array.isArray(previousStandalone.selected_equipment_ids) ? previousStandalone.selected_equipment_ids : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)));

  const clientSnapshot = nextClientId ? await getClientSnapshot(nextClientId, client) : null;
  const advisorSnapshot = advisorUserId !== undefined
    ? (advisorUserId ? await getAdvisorSnapshot(advisorUserId, client) : null)
    : (previousStandalone.advisor_user_id ? await getAdvisorSnapshot(previousStandalone.advisor_user_id, client) : null);
  const equipmentSnapshot = selectedEquipmentIds.length
    ? await getEquipmentModelSnapshots(selectedEquipmentIds, client)
    : [];
  const nextContractingEntity = (() => {
    if (sameEntity && clientSnapshot?.name) return clientSnapshot.name;
    const direct = contractingEntity !== undefined
      ? normalizeText(contractingEntity)
      : normalizeText(previousStandalone.contracting_entity);
    return direct || null;
  })();
  if (sameEntity && !clientSnapshot) {
    throw buildError("Debes seleccionar un cliente para marcar que es la misma entidad", {
      code: "STANDALONE_CLIENT_REQUIRED_FOR_SAME_ENTITY",
    });
  }
  return {
    // ponytail: consumable_files.client_id tiene FK real a public.clients (vacia/legacy) —
    // clientSnapshot.id es en realidad un id de client_requests, escribirlo ahi violaria la FK.
    // La referencia real queda solo en metadata.standalone.client_id (JSON, sin FK).
    client_id: null,
    metadata: {
      ...(file?.metadata && typeof file.metadata === "object" ? file.metadata : {}),
      standalone: {
        process_name_snapshot: normalizeText(processName) || normalizeText(file?.process_name) || null,
        contracting_entity: nextContractingEntity,
        same_entity_as_client: sameEntity,
        client_id: clientSnapshot?.id || null,
        client_name: clientSnapshot?.name || null,
        client_snapshot: clientSnapshot,
        contract_object: contractObject !== undefined
          ? normalizeText(contractObject)
          : normalizeText(previousStandalone.contract_object),
        advisor_user_id: advisorSnapshot?.id || null,
        advisor_name: advisorSnapshot?.fullname || null,
        advisor_email: advisorSnapshot?.email || null,
        advisor_role: advisorSnapshot?.role || null,
        selected_equipment_ids: equipmentSnapshot.map((item) => item.id),
        selected_equipment: equipmentSnapshot,
        updated_at: new Date().toISOString(),
      },
    },
  };
}

function validateStandaloneRegistration(file) {
  const standalone = file?.metadata?.standalone && typeof file.metadata.standalone === "object"
    ? file.metadata.standalone
    : {};
  if (!normalizeText(standalone.contracting_entity)) {
    throw buildError("Debes registrar la entidad contratante antes de registrar el expediente", {
      code: "STANDALONE_ENTITY_REQUIRED",
    });
  }
  if (!normalizeText(standalone.contract_object)) {
    throw buildError("Debes registrar el objeto de contratacion antes de registrar el expediente", {
      code: "STANDALONE_CONTRACT_OBJECT_REQUIRED",
    });
  }
  if (!Number.isInteger(Number(standalone.advisor_user_id || 0))) {
    throw buildError("Debes seleccionar un asesor antes de registrar el expediente", {
      code: "STANDALONE_ADVISOR_REQUIRED",
    });
  }
  if (!Array.isArray(standalone.selected_equipment_ids) || !standalone.selected_equipment_ids.length) {
    throw buildError("Debes seleccionar al menos un equipo antes de registrar el expediente", {
      code: "STANDALONE_EQUIPMENT_REQUIRED",
    });
  }
  const documents = standalone.documents && typeof standalone.documents === "object" ? standalone.documents : {};
  const missingDocs = STANDALONE_REQUIRED_DOC_TYPES.filter((docType) => !documents[docType]?.file_id);
  if (missingDocs.length) {
    throw buildError(
      `Debes subir estos documentos antes de habilitar el Control de Consumibles: ${missingDocs.map((docType) => STANDALONE_DOC_LABELS[docType]).join(", ")}`,
      { code: "STANDALONE_DOCUMENTS_REQUIRED", details: { missingDocs } },
    );
  }
}

function buildOrderLinesSummary(file, order = {}, detail = null) {
  const allLines = Array.isArray(detail?.sections)
    ? detail.sections.flatMap((section) => Array.isArray(section?.lines) ? section.lines : [])
    : [];
  const sectionByLineId = new Map();
  (detail?.sections || []).forEach((section) => {
    (section?.lines || []).forEach((line) => {
      sectionByLineId.set(Number(line.id), section.label || "Sin area");
    });
  });
  const rows = (order?.lines || []).map((line) => {
    const sourceLine = allLines.find((item) => Number(item.id) === Number(line.consumable_file_line_id));
    return {
      item_name: sourceLine?.item_name || `Linea ${line.consumable_file_line_id}`,
      section_label: sectionByLineId.get(Number(line.consumable_file_line_id)) || "Sin area",
      requested_units: Number(line.requested_units || 0),
      extra_requested_units: Number(line.extra_requested_units || 0),
      remaining_dispatch_units: Number(line.remaining_dispatch_units || 0),
    };
  });
  const compact = rows.slice(0, 4).map((row) => {
    const extraSuffix = row.extra_requested_units > 0 ? `, extra ${row.extra_requested_units}` : "";
    const pendingSuffix = row.remaining_dispatch_units > 0 ? `, pendiente ${row.remaining_dispatch_units}` : "";
    return `${row.item_name} (${row.section_label}): ${row.requested_units}${extraSuffix}${pendingSuffix}`;
  });
  const moreSuffix = rows.length > 4 ? ` y ${rows.length - 4} mas` : "";
  return compact.length ? `${compact.join(" | ")}${moreSuffix}` : `Proceso: ${file.process_name}.`;
}

async function getPurchaseContext({ purchaseType, purchaseRequestId }, client = null) {
  const normalizedType = String(purchaseType || "").trim().toLowerCase();
  const normalizedId = normalizeText(purchaseRequestId);
  if (!["public", "private"].includes(normalizedType) || !normalizedId) {
    throw buildError("purchase_type y purchase_request_id son requeridos", {
      code: "PURCHASE_LINK_REQUIRED",
    });
  }

  if (normalizedType === "public") {
    const { rows } = await queryWithClient(
      client,
      `SELECT
         id,
         client_id,
         client_name,
         client_business_name,
         purchase_type,
         business_case_id,
         extra,
         created_by
       FROM public.equipment_purchase_requests
       WHERE id = $1
       LIMIT 1`,
      [normalizedId],
    );
    if (!rows.length) {
      throw buildError("Compra publica no encontrada", {
        status: 404,
        code: "PUBLIC_PURCHASE_NOT_FOUND",
      });
    }
    const row = rows[0];
    const businessCaseId = row.business_case_id || null;
    const processName =
      normalizeText(row.client_business_name) ||
      normalizeText(row.client_name) ||
      `Proceso compra publica ${row.id}`;
    return {
      purchase_type: "public",
      equipment_purchase_request_id: row.id,
      private_purchase_request_id: null,
      business_case_id: businessCaseId,
      client_id: row.client_id || null,
      process_name: processName,
      process_code: String(row.id),
      purchase_creator_id: row.created_by || null,
    };
  }

  const { rows } = await queryWithClient(
    client,
    `SELECT
       id,
       client_snapshot,
       client_request_id,
       business_case_id,
       created_by
     FROM public.private_purchase_requests
     WHERE id = $1
     LIMIT 1`,
    [normalizedId],
  );
  if (!rows.length) {
    throw buildError("Compra privada no encontrada", {
      status: 404,
      code: "PRIVATE_PURCHASE_NOT_FOUND",
    });
  }
  const row = rows[0];
  const snapshot = row.client_snapshot && typeof row.client_snapshot === "object" ? row.client_snapshot : {};
  const processName =
    normalizeText(snapshot.commercial_name) ||
    normalizeText(snapshot.legal_person_business_name) ||
    `Proceso compra privada ${row.id}`;
  return {
    purchase_type: "private",
    equipment_purchase_request_id: null,
    private_purchase_request_id: row.id,
    business_case_id: row.business_case_id || null,
    client_id: null,
    process_name: processName,
    process_code: String(row.id),
    purchase_creator_id: row.created_by || null,
  };
}

async function getFileHeaderById(fileId, client = null) {
  const { rows } = await queryWithClient(
    client,
    `SELECT *
       FROM public.consumable_files
      WHERE id = $1
      LIMIT 1`,
    [fileId],
  );
  if (!rows.length) {
    throw buildError("Expediente de consumibles no encontrado", {
      status: 404,
      code: "CONSUMABLE_FILE_NOT_FOUND",
    });
  }
  return rows[0];
}

async function getFileHeaderByPurchase({ purchaseType, purchaseRequestId }, client = null) {
  const context = await getPurchaseContext({ purchaseType, purchaseRequestId }, client);
  const sql = context.purchase_type === "public"
    ? `SELECT * FROM public.consumable_files WHERE equipment_purchase_request_id = $1 LIMIT 1`
    : `SELECT * FROM public.consumable_files WHERE private_purchase_request_id = $1 LIMIT 1`;
  const purchaseId = context.purchase_type === "public"
    ? context.equipment_purchase_request_id
    : context.private_purchase_request_id;
  const { rows } = await queryWithClient(client, sql, [purchaseId]);
  return { context, file: rows[0] || null };
}

async function ensureEditableFile(fileId, user, client = null) {
  const file = await getFileHeaderById(fileId, client);
  if (file.status !== "draft") {
    throw buildError("El expediente ya fue registrado y no se puede editar", {
      status: 409,
      code: "CONSUMABLE_FILE_LOCKED",
    });
  }
  if (!hasAnyRole(user, FILE_EDIT_ROLES)) {
    throw buildError("Tu rol no puede editar este expediente", {
      status: 403,
      code: "FORBIDDEN_CONSUMABLE_FILE_EDIT",
    });
  }
  return file;
}

async function insertDefaultSections(fileId, client) {
  for (const section of DEFAULT_SECTIONS) {
    await client.query(
      `INSERT INTO public.consumable_file_sections
         (consumable_file_id, area_code, label, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (consumable_file_id, area_code) DO NOTHING`,
      [fileId, section.area_code, section.label, section.sort_order],
    );
  }
}

async function ensureSectionMapForFile(fileId, areaDefinitions = [], client = null) {
  const sectionMap = new Map();
  for (const definition of areaDefinitions) {
    const { rows } = await queryWithClient(
      client,
      `INSERT INTO public.consumable_file_sections
         (consumable_file_id, area_code, label, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (consumable_file_id, area_code)
       DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, updated_at = NOW()
       RETURNING *`,
      [fileId, definition.area_code, definition.label, Number(definition.sort_order || 0)],
    );
    if (rows[0]) sectionMap.set(definition.area_code, rows[0]);
  }
  return sectionMap;
}

async function syncStandaloneEquipmentLines({ fileId, userId, equipmentIds = [] }, client) {
  const preview = await buildStandaloneEquipmentPreview(equipmentIds, client);
  await client.query(
    `DELETE FROM public.consumable_file_lines l
      USING public.consumable_file_sections s
      WHERE s.id = l.consumable_file_section_id
        AND s.consumable_file_id = $1
        AND l.source_type = 'equipment'
        AND COALESCE(l.snapshot->>'imported_source', '') = 'standalone_equipment'`,
    [fileId],
  );
  if (!preview.sections.length) return preview;
  const sectionMap = await ensureSectionMapForFile(
    fileId,
    preview.sections.map((section) => ({
      area_code: section.area_code,
      label: section.label,
      sort_order: section.sort_order,
    })),
    client,
  );
  for (const section of preview.sections) {
    const targetSection = sectionMap.get(section.area_code);
    if (!targetSection) continue;
    for (const items of Object.values(section.items_by_type || {})) {
      for (const item of items) {
        const equipmentSnapshot = preview.equipment.find((equipment) => equipment.id === item.equipment_model_id) || null;
        const line = buildLinePayload({
          catalogItem: {
            id: item.id,
            name: item.name,
            type: item.type,
            supplier_code: item.supplier_code,
            units_per_kit: item.units_per_box,
            unit_price: item.unit_price,
            metadata: {},
          },
          payload: {
            equipment_id: item.equipment_model_id,
            source_type: "equipment",
            // sin datos reales del BC todavia -> 0, no inventar 1. Lo llena el BC al leerlo.
            box_qty: 0,
            item_key: `${item.type}:${item.id}:standalone:eqm:${item.equipment_model_id}`,
          },
        });
        await client.query(
          `INSERT INTO public.consumable_file_lines (
             consumable_file_section_id,
             item_key,
             item_name,
             item_type,
             source_type,
             catalog_consumable_id,
             equipment_id,
             presentation_unit,
             units_per_box,
             box_qty,
             max_units,
             unit_price,
             business_case_item_key,
             snapshot,
             created_by,
             created_at,
             updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, $13::jsonb, $14, NOW(), NOW()
           )
           ON CONFLICT (consumable_file_section_id, item_key)
           DO UPDATE SET
             item_name = EXCLUDED.item_name,
             item_type = EXCLUDED.item_type,
             source_type = EXCLUDED.source_type,
             catalog_consumable_id = EXCLUDED.catalog_consumable_id,
             equipment_id = EXCLUDED.equipment_id,
             presentation_unit = EXCLUDED.presentation_unit,
             units_per_box = EXCLUDED.units_per_box,
             box_qty = EXCLUDED.box_qty,
             max_units = EXCLUDED.max_units,
             unit_price = EXCLUDED.unit_price,
             snapshot = EXCLUDED.snapshot,
             updated_at = NOW()`,
          [
            Number(targetSection.id),
            line.item_key,
            line.item_name,
            line.item_type,
            line.source_type,
            line.catalog_consumable_id,
            line.equipment_id,
            line.presentation_unit,
            line.units_per_box,
            line.box_qty,
            line.max_units,
            line.unit_price,
            JSON.stringify({
              ...(line.snapshot || {}),
              imported_source: "standalone_equipment",
              equipment_model_id: equipmentSnapshot?.id || item.equipment_model_id,
              legacy_equipment_id: equipmentSnapshot?.servicio_equipo_id || null,
              equipment_label: equipmentSnapshot?.label || item.equipment_label,
              equipment_category: equipmentSnapshot?.category || null,
            }),
            userId,
          ],
        );
      }
    }
  }
  return preview;
}

async function getSectionById(sectionId, client = null) {
  const { rows } = await queryWithClient(
    client,
    `SELECT *
       FROM public.consumable_file_sections
      WHERE id = $1
      LIMIT 1`,
    [sectionId],
  );
  if (!rows.length) {
    throw buildError("Subexpediente no encontrado", {
      status: 404,
      code: "CONSUMABLE_FILE_SECTION_NOT_FOUND",
    });
  }
  return rows[0];
}

async function getLineById(lineId, client = null) {
  const { rows } = await queryWithClient(
    client,
    `SELECT l.*, s.consumable_file_id
       FROM public.consumable_file_lines l
       INNER JOIN public.consumable_file_sections s ON s.id = l.consumable_file_section_id
      WHERE l.id = $1
      LIMIT 1`,
    [lineId],
  );
  if (!rows.length) {
    throw buildError("Linea de consumible no encontrada", {
      status: 404,
      code: "CONSUMABLE_FILE_LINE_NOT_FOUND",
    });
  }
  return rows[0];
}

async function buildFileSummary(consumableFileId, client = null) {
  const { rows } = await queryWithClient(
    client,
    `SELECT
       COALESCE(SUM(l.max_units), 0)::numeric AS total_max_units,
       COUNT(DISTINCT l.id)::int AS total_lines,
       COUNT(DISTINCT o.id)::int AS total_orders,
       COUNT(DISTINCT CASE WHEN o.status = 'extra_pending' THEN o.id END)::int AS orders_pending_extra,
       COUNT(DISTINCT CASE WHEN o.status = 'partially_dispatched' THEN o.id END)::int AS orders_partial
     FROM public.consumable_files f
     LEFT JOIN public.consumable_file_sections s ON s.consumable_file_id = f.id
     LEFT JOIN public.consumable_file_lines l ON l.consumable_file_section_id = s.id
     LEFT JOIN public.consumable_orders o ON o.consumable_file_id = f.id
     WHERE f.id = $1
     GROUP BY f.id`,
    [consumableFileId],
  );
  return rows[0] || {
    total_max_units: 0,
    total_lines: 0,
    total_orders: 0,
    orders_pending_extra: 0,
    orders_partial: 0,
  };
}

async function listFilesOverview({ user = null } = {}) {
  const viewerScoped = hasAnyRole(user, new Set(["jefe_operaciones", "operaciones", "jefe_logistica", "logistica"]))
    || hasAnyRole(user, new Set(["gerencia", "gerencia_general"]));
  const { rows } = await db.query(
    `WITH order_summary AS (
       SELECT
         o.consumable_file_id,
         COUNT(*)::int AS total_orders,
         COUNT(*) FILTER (WHERE o.status = 'extra_pending')::int AS orders_pending_extra,
         COUNT(*) FILTER (WHERE o.status = 'partially_dispatched')::int AS orders_partial,
         COUNT(*) FILTER (WHERE o.status = 'approved')::int AS orders_ready_dispatch,
         MAX(o.created_at) AS latest_order_created_at
       FROM public.consumable_orders o
       GROUP BY o.consumable_file_id
     ),
     latest_order AS (
       SELECT DISTINCT ON (o.consumable_file_id)
         o.consumable_file_id,
         o.id AS latest_order_id,
         o.period AS latest_order_period,
         o.status AS latest_order_status,
         o.created_at AS latest_order_created_at
       FROM public.consumable_orders o
       ORDER BY o.consumable_file_id, o.created_at DESC, o.id DESC
     ),
     lines_summary AS (
       SELECT
         s.consumable_file_id,
         COUNT(l.id)::int AS total_lines,
         COALESCE(SUM(l.max_units), 0)::numeric AS total_max_units
       FROM public.consumable_file_sections s
       LEFT JOIN public.consumable_file_lines l ON l.consumable_file_section_id = s.id
       GROUP BY s.consumable_file_id
     )
     SELECT
       f.id,
       f.origin_type,
       f.purchase_type,
       f.equipment_purchase_request_id,
       f.private_purchase_request_id,
       f.business_case_id,
       f.process_name,
       f.process_code,
       f.status,
       f.registered_at,
       f.created_at,
       f.updated_at,
       COALESCE(ls.total_lines, 0) AS total_lines,
       COALESCE(ls.total_max_units, 0)::numeric AS total_max_units,
       COALESCE(os.total_orders, 0) AS total_orders,
       COALESCE(os.orders_pending_extra, 0) AS orders_pending_extra,
       COALESCE(os.orders_partial, 0) AS orders_partial,
       COALESCE(os.orders_ready_dispatch, 0) AS orders_ready_dispatch,
       lo.latest_order_id,
       lo.latest_order_period,
       lo.latest_order_status,
       lo.latest_order_created_at
     FROM public.consumable_files f
     LEFT JOIN lines_summary ls ON ls.consumable_file_id = f.id
     LEFT JOIN order_summary os ON os.consumable_file_id = f.id
     LEFT JOIN latest_order lo ON lo.consumable_file_id = f.id
     ORDER BY COALESCE(lo.latest_order_created_at, f.updated_at, f.created_at) DESC, f.process_name ASC`,
  );

  const items = rows.map((row) => ({
    id: row.id,
    origin_type: row.origin_type,
    purchase_type: row.purchase_type,
    purchase_request_id: row.purchase_type === "public"
      ? row.equipment_purchase_request_id
      : row.private_purchase_request_id,
    business_case_id: row.business_case_id || null,
    process_name: row.process_name,
    process_code: row.process_code || null,
    status: row.status,
    registered_at: row.registered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total_lines: Number(row.total_lines || 0),
    total_max_units: Number(row.total_max_units || 0),
    total_orders: Number(row.total_orders || 0),
    orders_pending_extra: Number(row.orders_pending_extra || 0),
    orders_partial: Number(row.orders_partial || 0),
    orders_ready_dispatch: Number(row.orders_ready_dispatch || 0),
    latest_order_id: row.latest_order_id ? Number(row.latest_order_id) : null,
    latest_order_period: row.latest_order_period || null,
    latest_order_status: row.latest_order_status || null,
    latest_order_created_at: row.latest_order_created_at || null,
    workspace_path: buildWorkspacePath(row),
  }));

  const visibleItems = viewerScoped
    ? items.filter((item) => item.total_orders > 0 || item.total_lines > 0)
    : items;

  const summary = visibleItems.reduce((acc, item) => {
    acc.total_files += 1;
    acc.pending_extra += item.orders_pending_extra;
    acc.partial_dispatch += item.orders_partial;
    acc.ready_dispatch += item.orders_ready_dispatch;
    return acc;
  }, {
    total_files: 0,
    pending_extra: 0,
    partial_dispatch: 0,
    ready_dispatch: 0,
  });

  return {
    items: visibleItems,
    summary,
  };
}

async function createStandaloneFile({
  processName,
  processCode = null,
  clientId = null,
  contractingEntity = null,
  sameEntityAsClient = false,
  contractObject = null,
  equipmentIds = [],
  user,
}) {
  if (!hasAnyRole(user, STANDALONE_CREATE_ROLES)) {
    throw buildError("Solo el rol comercial puede crear expedientes de Control de Consumibles", {
      status: 403,
      code: "FORBIDDEN_CONSUMABLE_FILE_CREATE",
    });
  }
  const normalizedProcessName = normalizeText(processName);
  if (!normalizedProcessName) {
    throw buildError("process_name es requerido", {
      code: "PROCESS_NAME_REQUIRED",
    });
  }
  if (!normalizeText(contractObject)) {
    throw buildError("Debes ingresar el objeto de contratacion", {
      code: "STANDALONE_CONTRACT_OBJECT_REQUIRED",
    });
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const id = uuidv4();
    const standalonePayload = await buildStandaloneMetadata({
      processName: normalizedProcessName,
      clientId,
      contractingEntity,
      sameEntityAsClient,
      contractObject,
      advisorUserId: user.id,
      equipmentIds,
    }, client);
    await client.query(
      `INSERT INTO public.consumable_files (
         id,
         origin_type,
         purchase_type,
         equipment_purchase_request_id,
         private_purchase_request_id,
         business_case_id,
         client_id,
         process_name,
         process_code,
         status,
         metadata,
         created_by,
         created_at,
         updated_at
       ) VALUES (
         $1, 'standalone', NULL, NULL, NULL, NULL, $2, $3, $4, 'draft', '{}'::jsonb, $5, NOW(), NOW()
       )`,
      [id, standalonePayload.client_id, normalizedProcessName, normalizeText(processCode), user.id],
    );
    await client.query(
      `UPDATE public.consumable_files
          SET metadata = $1::jsonb,
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(standalonePayload.metadata || {}), id],
    );
    await syncStandaloneEquipmentLines({
      fileId: id,
      userId: user.id,
      equipmentIds: standalonePayload.metadata?.standalone?.selected_equipment_ids || [],
    }, client);
    await client.query("COMMIT");
    return getFileDetail(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getOpenCarryoverMap(consumableFileId, client = null) {
  const { rows } = await queryWithClient(
    client,
    `SELECT
       ol.consumable_file_line_id,
       COALESCE(SUM(dl.pending_units), 0)::numeric AS carryover_units
     FROM public.consumable_dispatch_lines dl
     INNER JOIN public.consumable_order_lines ol ON ol.id = dl.consumable_order_line_id
     INNER JOIN public.consumable_orders o ON o.id = dl.consumable_order_id
     WHERE o.consumable_file_id = $1
       AND dl.pending_units > 0
       AND dl.carried_forward_order_id IS NULL
     GROUP BY ol.consumable_file_line_id`,
    [consumableFileId],
  );
  return new Map(rows.map((row) => [Number(row.consumable_file_line_id), Number(row.carryover_units || 0)]));
}

async function getBaseConsumptionMap(consumableFileId, client = null) {
  const { rows } = await queryWithClient(
    client,
    `SELECT
       ol.consumable_file_line_id,
       COALESCE(SUM(ol.base_requested_units), 0)::numeric AS base_consumed_units
     FROM public.consumable_order_lines ol
     INNER JOIN public.consumable_orders o ON o.id = ol.consumable_order_id
     WHERE o.consumable_file_id = $1
       AND o.status <> 'cancelled'
     GROUP BY ol.consumable_file_line_id`,
    [consumableFileId],
  );
  return new Map(rows.map((row) => [Number(row.consumable_file_line_id), Number(row.base_consumed_units || 0)]));
}

async function getFileDetail(fileId, client = null) {
  const file = await getFileHeaderById(fileId, client);
  const { rows: sections } = await queryWithClient(
    client,
    `SELECT *
       FROM public.consumable_file_sections
      WHERE consumable_file_id = $1
      ORDER BY sort_order ASC, id ASC`,
    [fileId],
  );
  const { rows: lines } = await queryWithClient(
    client,
    `SELECT
       l.*,
       s.area_code,
       s.label AS section_label
     FROM public.consumable_file_lines l
     INNER JOIN public.consumable_file_sections s ON s.id = l.consumable_file_section_id
     WHERE s.consumable_file_id = $1
     ORDER BY s.sort_order ASC,
       CASE l.item_type
         WHEN 'reactivo' THEN 1
         WHEN 'control' THEN 2
         WHEN 'calibrador' THEN 3
         WHEN 'material' THEN 4
         WHEN 'consumible' THEN 5
         ELSE 6
       END ASC,
       l.item_name ASC, l.id ASC`,
    [fileId],
  );
  const { rows: orders } = await queryWithClient(
    client,
    `SELECT *
       FROM public.consumable_orders
      WHERE consumable_file_id = $1
      ORDER BY created_at DESC, id DESC`,
    [fileId],
  );
  const orderIds = orders.map((row) => Number(row.id));
  const { rows: orderLines } = orderIds.length
    ? await queryWithClient(
      client,
      `SELECT *
         FROM public.consumable_order_lines
        WHERE consumable_order_id = ANY($1::bigint[])
        ORDER BY id ASC`,
      [orderIds],
    )
    : { rows: [] };
  const { rows: dispatchLines } = orderIds.length
    ? await queryWithClient(
      client,
      `SELECT *
         FROM public.consumable_dispatch_lines
        WHERE consumable_order_id = ANY($1::bigint[])
        ORDER BY dispatched_at DESC, id DESC`,
      [orderIds],
    )
    : { rows: [] };

  const baseConsumption = await getBaseConsumptionMap(fileId, client);
  const openCarryovers = await getOpenCarryoverMap(fileId, client);
  const summary = await buildFileSummary(fileId, client);

  const linesBySection = new Map();
  for (const line of lines) {
    const lineId = Number(line.id);
    const maxUnits = Number(line.max_units || 0);
    const baseConsumed = Number(baseConsumption.get(lineId) || 0);
    const availableUnits = Math.max(0, Number((maxUnits - baseConsumed).toFixed(3)));
    const carryoverUnits = Number(openCarryovers.get(lineId) || 0);
    const enriched = {
      id: lineId,
      section_id: Number(line.consumable_file_section_id),
      item_key: line.item_key,
      item_name: line.item_name,
      item_type: line.item_type,
      source_type: line.source_type,
      catalog_consumable_id: line.catalog_consumable_id || null,
      equipment_id: line.equipment_id || null,
      presentation_unit: line.presentation_unit,
      units_per_box: Number(line.units_per_box || 0),
      box_qty: Number(line.box_qty || 0),
      max_units: maxUnits,
      unit_price: line.unit_price !== null ? Number(line.unit_price) : null,
      business_case_item_key: line.business_case_item_key || null,
      snapshot: line.snapshot || {},
      created_at: line.created_at,
      updated_at: line.updated_at,
      available_units: availableUnits,
      base_consumed_units: baseConsumed,
      carryover_units: carryoverUnits,
    };
    if (!linesBySection.has(enriched.section_id)) linesBySection.set(enriched.section_id, []);
    linesBySection.get(enriched.section_id).push(enriched);
  }

  const orderLinesByOrder = new Map();
  const dispatchedTotalsByOrderLine = new Map();
  for (const row of orderLines) {
    const orderId = Number(row.consumable_order_id);
    if (!orderLinesByOrder.has(orderId)) orderLinesByOrder.set(orderId, []);
    const enrichedLine = {
      id: Number(row.id),
      consumable_file_line_id: Number(row.consumable_file_line_id),
      carryover_units: Number(row.carryover_units || 0),
      requested_new_units: Number(row.requested_new_units || 0),
      requested_units: Number(row.requested_units || 0),
      available_before_request: Number(row.available_before_request || 0),
      base_requested_units: Number(row.base_requested_units || 0),
      extra_requested_units: Number(row.extra_requested_units || 0),
      approved_extra_units: row.approved_extra_units !== null ? Number(row.approved_extra_units) : null,
      extra_status: row.extra_status || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    orderLinesByOrder.get(orderId).push(enrichedLine);
    dispatchedTotalsByOrderLine.set(enrichedLine.id, 0);
  }

  const dispatchByOrder = new Map();
  for (const row of dispatchLines) {
    const orderId = Number(row.consumable_order_id);
    if (!dispatchByOrder.has(orderId)) dispatchByOrder.set(orderId, []);
    dispatchByOrder.get(orderId).push({
      id: Number(row.id),
      consumable_order_line_id: Number(row.consumable_order_line_id),
      sent_units: Number(row.sent_units || 0),
      pending_units: Number(row.pending_units || 0),
      notes: row.notes || null,
      dispatched_by: row.dispatched_by || null,
      dispatched_at: row.dispatched_at,
      carried_forward_order_id: row.carried_forward_order_id || null,
      carried_forward_at: row.carried_forward_at || null,
    });
    const orderLineId = Number(row.consumable_order_line_id);
    dispatchedTotalsByOrderLine.set(
      orderLineId,
      Number((Number(dispatchedTotalsByOrderLine.get(orderLineId) || 0) + Number(row.sent_units || 0)).toFixed(3)),
    );
  }

  for (const linesForOrder of orderLinesByOrder.values()) {
    for (const line of linesForOrder) {
      const approvedExtra = line.extra_status === "approved"
        ? Number(line.approved_extra_units || 0)
        : 0;
      const approvedUnits = Number((Number(line.carryover_units || 0) + Number(line.base_requested_units || 0) + approvedExtra).toFixed(3));
      const dispatchedUnits = Number(dispatchedTotalsByOrderLine.get(Number(line.id)) || 0);
      line.approved_units = approvedUnits;
      line.dispatched_units = dispatchedUnits;
      line.remaining_dispatch_units = Math.max(0, Number((approvedUnits - dispatchedUnits).toFixed(3)));
    }
  }

  return {
    file: {
      ...file,
      summary,
    },
    sections: sections.map((section) => ({
      id: Number(section.id),
      consumable_file_id: section.consumable_file_id,
      area_code: section.area_code,
      label: section.label,
      sort_order: Number(section.sort_order || 0),
      created_at: section.created_at,
      updated_at: section.updated_at,
      lines: linesBySection.get(Number(section.id)) || [],
    })),
    orders: orders.map((order) => ({
      id: Number(order.id),
      consumable_file_id: order.consumable_file_id,
      period: order.period,
      status: order.status,
      notes: order.notes || null,
      dispatch_notes: order.dispatch_notes || null,
      submitted_at: order.submitted_at,
      approved_at: order.approved_at,
      approved_by: order.approved_by || null,
      requested_by: order.requested_by || null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      lines: orderLinesByOrder.get(Number(order.id)) || [],
      dispatches: dispatchByOrder.get(Number(order.id)) || [],
    })),
  };
}

async function createFileFromPurchase({ purchaseType, purchaseRequestId, processName = null, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { context, file } = await getFileHeaderByPurchase({ purchaseType, purchaseRequestId }, client);
    if (file) {
      await client.query("COMMIT");
      return getFileDetail(file.id);
    }
    const id = uuidv4();
    const finalProcessName = normalizeText(processName) || context.process_name;
    await client.query(
      `INSERT INTO public.consumable_files (
         id,
         origin_type,
         purchase_type,
         equipment_purchase_request_id,
         private_purchase_request_id,
         business_case_id,
         client_id,
         process_name,
         process_code,
         status,
         metadata,
         created_by,
         created_at,
         updated_at
       ) VALUES (
         $1, 'purchase_linked', $2, $3, $4, $5, $6, $7, $8, 'draft', '{}'::jsonb, $9, NOW(), NOW()
       )`,
      [
        id,
        context.purchase_type,
        context.equipment_purchase_request_id,
        context.private_purchase_request_id,
        context.business_case_id,
        context.client_id,
        finalProcessName,
        context.process_code,
        user.id,
      ],
    );
    await insertDefaultSections(id, client);
    await client.query("COMMIT");
    return getFileDetail(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateFileHeader({
  fileId,
  processName,
  processCode = null,
  clientId = undefined,
  contractingEntity = undefined,
  sameEntityAsClient = undefined,
  contractObject = undefined,
  advisorUserId = undefined,
  equipmentIds = undefined,
  user,
}) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const file = await ensureEditableFile(fileId, user, client);
    // ponytail: los datos identitarios de un expediente standalone (nombre, codigo, cliente,
    // entidad, objeto, equipos) quedan inmutables tras la creacion para no perder trazabilidad.
    // Solo se puede seguir subiendo documentos (uploadStandaloneDocument) y trabajar secciones/pedidos.
    if (file.origin_type === "standalone") {
      throw buildError("Los datos del expediente de Control de Consumibles no se pueden editar una vez creado", {
        status: 409,
        code: "STANDALONE_HEADER_IMMUTABLE",
      });
    }
  const normalizedProcessName = normalizeText(processName);
  if (!normalizedProcessName) {
    throw buildError("process_name es requerido", {
      code: "PROCESS_NAME_REQUIRED",
    });
  }
    let nextMetadata = file.metadata && typeof file.metadata === "object" ? file.metadata : {};
    let nextClientId = file.client_id || null;
    await client.query(
      `UPDATE public.consumable_files
          SET process_name = $1,
              process_code = $2,
              client_id = $3,
              metadata = $4::jsonb,
              updated_at = NOW()
        WHERE id = $5`,
      [normalizedProcessName, normalizeText(processCode), nextClientId, JSON.stringify(nextMetadata || {}), fileId],
    );
    if (file.origin_type === "standalone") {
      await syncStandaloneEquipmentLines({
        fileId,
        userId: user.id,
        equipmentIds: nextMetadata?.standalone?.selected_equipment_ids || [],
      }, client);
    }
    await client.query("COMMIT");
    return getFileDetail(fileId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createSection({ fileId, areaCode, label, sortOrder = 0, user }) {
  await ensureEditableFile(fileId, user);
  const normalizedAreaCode = normalizeText(areaCode);
  const normalizedLabel = normalizeText(label);
  if (!normalizedAreaCode || !normalizedLabel) {
    throw buildError("area_code y label son requeridos", {
      code: "SECTION_FIELDS_REQUIRED",
    });
  }
  const { rows } = await db.query(
    `INSERT INTO public.consumable_file_sections
       (consumable_file_id, area_code, label, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (consumable_file_id, area_code)
     DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, updated_at = NOW()
     RETURNING *`,
    [fileId, normalizedAreaCode, normalizedLabel, Number(sortOrder || 0)],
  );
  return rows[0];
}

async function importBusinessCaseLines({ sectionId, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const section = await getSectionById(sectionId, client);
    const file = await ensureEditableFile(section.consumable_file_id, user, client);
    if (!file.business_case_id) {
      throw buildError("Este expediente no tiene business case vinculado", {
        status: 409,
        code: "CONSUMABLE_FILE_WITHOUT_BUSINESS_CASE",
      });
    }

    const { rows: items } = await client.query(
      `SELECT
         item_key,
         item_id,
         name,
         item_type,
         source,
         catalog_id,
         annual_qty,
         equipment_id,
         equipment_name
       FROM public.bc_consumption_items
       WHERE business_case_id = $1
         AND COALESCE(annual_qty, 0) > 0
       ORDER BY name ASC`,
      [file.business_case_id],
    );
    if (!items.length) {
      throw buildError("El business case no tiene consumos configurados para importar", {
        status: 409,
        code: "BUSINESS_CASE_WITHOUT_CONSUMPTION_ITEMS",
      });
    }

    for (const item of items) {
      const maxUnits = Number(item.annual_qty || 0);
      const snapshot = {
        imported_from: "business_case",
        business_case_id: file.business_case_id,
        source: item.source || "business_case",
        item_id: item.item_id || null,
        equipment_name: item.equipment_name || null,
        imported_at: new Date().toISOString(),
      };
      await client.query(
        `INSERT INTO public.consumable_file_lines (
           consumable_file_section_id,
           item_key,
           item_name,
           item_type,
           source_type,
           catalog_consumable_id,
           equipment_id,
           presentation_unit,
           units_per_box,
           box_qty,
           max_units,
           unit_price,
           business_case_item_key,
           snapshot,
           created_by,
           created_at,
           updated_at
         ) VALUES (
           $1, $2, $3, $4, 'business_case', $5, $6, 'unidad', $7, 1, $7, NULL, $8, $9::jsonb, $10, NOW(), NOW()
         )
         ON CONFLICT (consumable_file_section_id, item_key)
         DO UPDATE SET
           item_name = EXCLUDED.item_name,
           item_type = EXCLUDED.item_type,
           source_type = EXCLUDED.source_type,
           catalog_consumable_id = EXCLUDED.catalog_consumable_id,
           equipment_id = EXCLUDED.equipment_id,
           units_per_box = EXCLUDED.units_per_box,
           box_qty = EXCLUDED.box_qty,
           max_units = EXCLUDED.max_units,
           business_case_item_key = EXCLUDED.business_case_item_key,
           snapshot = EXCLUDED.snapshot,
           updated_at = NOW()`,
        [
          sectionId,
          `bc:${item.item_key}`,
          item.name,
          normalizeItemType(item.item_type),
          item.catalog_id || null,
          item.equipment_id || null,
          maxUnits,
          item.item_key,
          JSON.stringify(snapshot),
          user.id,
        ],
      );
    }

    await client.query("COMMIT");
    return getFileDetail(section.consumable_file_id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveCatalogItem(catalogConsumableId, client = null) {
  if (!catalogConsumableId) return null;
  const { rows } = await queryWithClient(
    client,
    `SELECT id, name, type, supplier_code, units_per_kit, unit_price, metadata
       FROM public.catalog_consumables
      WHERE id = $1
      LIMIT 1`,
    [catalogConsumableId],
  );
  return rows[0] || null;
}

function buildLinePayload({
  catalogItem,
  payload,
}) {
  const itemName = normalizeText(payload.item_name) || catalogItem?.name;
  if (!itemName) {
    throw buildError("item_name es requerido", {
      code: "ITEM_NAME_REQUIRED",
    });
  }
  const itemType = normalizeItemType(payload.item_type || catalogItem?.type);
  const unitsPerBox = normalizeNumeric(
    payload.units_per_box ?? catalogItem?.units_per_kit ?? 1,
    "units_per_box",
    { min: 0, allowZero: false },
  );
  // ponytail: allowZero=true a proposito — una linea recien sincronizada desde equipo (sin
  // datos reales del BC todavia) debe quedar en 0 cantidades, no inventarse un 1.
  const boxQty = normalizeNumeric(payload.box_qty ?? 0, "box_qty", { min: 0, allowZero: true });
  const maxUnits = Number((unitsPerBox * boxQty).toFixed(3));
  const itemKey = normalizeText(payload.item_key)
    || `${itemType}:${catalogItem?.id || "manual"}:${itemName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return {
    item_key: itemKey.slice(0, 180),
    item_name: itemName,
    item_type: itemType,
    source_type: normalizeText(payload.source_type, catalogItem ? "catalog" : "manual"),
    catalog_consumable_id: catalogItem?.id || payload.catalog_consumable_id || null,
    equipment_id: payload.equipment_id || null,
    presentation_unit: normalizeText(payload.presentation_unit, "unidad"),
    units_per_box: unitsPerBox,
    box_qty: boxQty,
    max_units: maxUnits,
    unit_price: payload.unit_price !== undefined && payload.unit_price !== null && payload.unit_price !== ""
      ? Number(payload.unit_price)
      : (catalogItem?.unit_price !== null && catalogItem?.unit_price !== undefined ? Number(catalogItem.unit_price) : null),
    business_case_item_key: normalizeText(payload.business_case_item_key),
    snapshot: {
      supplier_code: catalogItem?.supplier_code || null,
      metadata: catalogItem?.metadata || {},
      imported_at: new Date().toISOString(),
    },
  };
}

async function addLine({ sectionId, payload, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const section = await getSectionById(sectionId, client);
    await ensureEditableFile(section.consumable_file_id, user, client);
    const catalogItem = payload.catalog_consumable_id
      ? await resolveCatalogItem(payload.catalog_consumable_id, client)
      : null;
    const line = buildLinePayload({ catalogItem, payload });
    const { rows } = await client.query(
      `INSERT INTO public.consumable_file_lines (
         consumable_file_section_id,
         item_key,
         item_name,
         item_type,
         source_type,
         catalog_consumable_id,
         equipment_id,
         presentation_unit,
         units_per_box,
         box_qty,
         max_units,
         unit_price,
         business_case_item_key,
         snapshot,
         created_by,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, NOW(), NOW()
       )
       ON CONFLICT (consumable_file_section_id, item_key)
       DO UPDATE SET
         item_name = EXCLUDED.item_name,
         item_type = EXCLUDED.item_type,
         source_type = EXCLUDED.source_type,
         catalog_consumable_id = EXCLUDED.catalog_consumable_id,
         equipment_id = EXCLUDED.equipment_id,
         presentation_unit = EXCLUDED.presentation_unit,
         units_per_box = EXCLUDED.units_per_box,
         box_qty = EXCLUDED.box_qty,
         max_units = EXCLUDED.max_units,
         unit_price = EXCLUDED.unit_price,
         business_case_item_key = EXCLUDED.business_case_item_key,
         snapshot = EXCLUDED.snapshot,
         updated_at = NOW()
       RETURNING *`,
      [
        sectionId,
        line.item_key,
        line.item_name,
        line.item_type,
        line.source_type,
        line.catalog_consumable_id,
        line.equipment_id,
        line.presentation_unit,
        line.units_per_box,
        line.box_qty,
        line.max_units,
        line.unit_price,
        line.business_case_item_key,
        JSON.stringify(line.snapshot || {}),
        user.id,
      ],
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateLine({ lineId, payload, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const existing = await getLineById(lineId, client);
    await ensureEditableFile(existing.consumable_file_id, user, client);
    const catalogItem = payload.catalog_consumable_id
      ? await resolveCatalogItem(payload.catalog_consumable_id, client)
      : (existing.catalog_consumable_id ? await resolveCatalogItem(existing.catalog_consumable_id, client) : null);
    const line = buildLinePayload({
      catalogItem,
      payload: {
        ...existing,
        ...payload,
      },
    });
    await client.query(
      `UPDATE public.consumable_file_lines
          SET item_key = $1,
              item_name = $2,
              item_type = $3,
              source_type = $4,
              catalog_consumable_id = $5,
              equipment_id = $6,
              presentation_unit = $7,
              units_per_box = $8,
              box_qty = $9,
              max_units = $10,
              unit_price = $11,
              business_case_item_key = $12,
              snapshot = $13::jsonb,
              updated_at = NOW()
        WHERE id = $14`,
      [
        line.item_key,
        line.item_name,
        line.item_type,
        line.source_type,
        line.catalog_consumable_id,
        line.equipment_id,
        line.presentation_unit,
        line.units_per_box,
        line.box_qty,
        line.max_units,
        line.unit_price,
        line.business_case_item_key,
        JSON.stringify(line.snapshot || {}),
        lineId,
      ],
    );
    await client.query("COMMIT");
    return getLineById(lineId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteLine({ lineId, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const line = await getLineById(lineId, client);
    await ensureEditableFile(line.consumable_file_id, user, client);
    await client.query(`DELETE FROM public.consumable_file_lines WHERE id = $1`, [lineId]);
    await client.query("COMMIT");
    return { id: Number(lineId) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function importEquipmentLines({ sectionId, equipmentId, boxQty = 1, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const section = await getSectionById(sectionId, client);
    const file = await ensureEditableFile(section.consumable_file_id, user, client);
    const normalizedEquipmentId = Number(equipmentId);
    if (!Number.isFinite(normalizedEquipmentId) || normalizedEquipmentId < 1) {
      throw buildError("equipment_id invalido", {
        code: "INVALID_EQUIPMENT_ID",
      });
    }
    const { rows: equipmentRows } = await client.query(
      `SELECT id, servicio_equipo_id
         FROM public.equipment_models
        WHERE id = $1
        LIMIT 1`,
      [normalizedEquipmentId],
    );
    const resolvedLegacyEquipmentId = equipmentRows[0]?.servicio_equipo_id
      ? Number(equipmentRows[0].servicio_equipo_id)
      : normalizedEquipmentId;
    const { rows } = await client.query(
      `SELECT
         c.id,
         c.name,
         c.type,
         c.supplier_code,
         c.units_per_kit,
         c.unit_price,
         c.metadata
       FROM public.catalog_equipment_consumables ec
       INNER JOIN public.catalog_consumables c ON c.id = ec.consumable_id
       WHERE ec.equipment_id = $1
       ORDER BY c.name ASC`,
      [resolvedLegacyEquipmentId],
    );
    if (!rows.length) {
      throw buildError("El equipo no tiene consumibles vinculados", {
        status: 404,
        code: "EQUIPMENT_CONSUMABLES_NOT_FOUND",
      });
    }
    for (const row of rows) {
      const line = buildLinePayload({
        catalogItem: row,
        payload: {
          equipment_id: normalizedEquipmentId,
          source_type: file.business_case_id ? "business_case" : "equipment",
          box_qty: boxQty,
          item_key: `${normalizeItemType(row.type)}:${row.id}:eq:${normalizedEquipmentId}`,
        },
      });
      await client.query(
        `INSERT INTO public.consumable_file_lines (
           consumable_file_section_id,
           item_key,
           item_name,
           item_type,
           source_type,
           catalog_consumable_id,
           equipment_id,
           presentation_unit,
           units_per_box,
           box_qty,
           max_units,
           unit_price,
           business_case_item_key,
           snapshot,
           created_by,
           created_at,
           updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, $13::jsonb, $14, NOW(), NOW()
         )
         ON CONFLICT (consumable_file_section_id, item_key)
         DO UPDATE SET
           box_qty = EXCLUDED.box_qty,
           max_units = EXCLUDED.max_units,
           unit_price = EXCLUDED.unit_price,
           updated_at = NOW()`,
        [
          sectionId,
          line.item_key,
          line.item_name,
          line.item_type,
          line.source_type,
          line.catalog_consumable_id,
          line.equipment_id,
          line.presentation_unit,
          line.units_per_box,
          line.box_qty,
          line.max_units,
          line.unit_price,
          JSON.stringify(line.snapshot || {}),
          user.id,
        ],
      );
    }
    await client.query("COMMIT");
    return getFileDetail(section.consumable_file_id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function registerFile({ fileId, user }) {
  const file = await ensureEditableFile(fileId, user);
  if (file.origin_type === "standalone") validateStandaloneRegistration(file);
  const { rows: lineRows } = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM public.consumable_file_lines l
       INNER JOIN public.consumable_file_sections s ON s.id = l.consumable_file_section_id
      WHERE s.consumable_file_id = $1`,
    [fileId],
  );
  if (!Number(lineRows[0]?.total || 0)) {
    throw buildError("No puedes registrar un expediente sin lineas base", {
      code: "CONSUMABLE_FILE_EMPTY",
    });
  }
  await db.query(
    `UPDATE public.consumable_files
        SET status = 'registered',
            registered_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [fileId],
  );
  return getFileDetail(fileId);
}

async function previewStandaloneCatalog({ equipmentIds = [] }) {
  return buildStandaloneEquipmentPreview(equipmentIds);
}

async function ensureStandaloneDriveFolder(file, client = null) {
  const standalone = file?.metadata?.standalone && typeof file.metadata.standalone === "object"
    ? file.metadata.standalone
    : {};
  if (standalone.drive_folder_id) return standalone.drive_folder_id;

  const baseFolderId = process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID || process.env.DRIVE_DOCS_FOLDER_ID || null;
  const root = await ensureFolder("Control de Consumibles", baseFolderId);
  const safeClient = String(standalone.client_name || file?.process_name || "Cliente")
    .trim()
    .replace(/[/:*?"<>|]/g, "-");
  const folder = await ensureFolder(`CC-${file.id}-${safeClient || "Cliente"}`, root?.id || null);

  const nextMetadata = {
    ...(file?.metadata && typeof file.metadata === "object" ? file.metadata : {}),
    standalone: { ...standalone, drive_folder_id: folder.id },
  };
  await queryWithClient(
    client,
    `UPDATE public.consumable_files SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(nextMetadata), file.id],
  );
  return folder.id;
}

async function uploadStandaloneDocument({ fileId, docType, fileBase64, fileName, mimeType, user }) {
  if (!STANDALONE_DOC_TYPES.has(docType)) {
    throw buildError("Tipo de documento invalido", { code: "INVALID_STANDALONE_DOC_TYPE" });
  }
  if (!fileBase64 || !fileName) {
    throw buildError("Archivo requerido", { code: "STANDALONE_DOC_FILE_REQUIRED" });
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const file = await ensureEditableFile(fileId, user, client);
    if (file.origin_type !== "standalone") {
      throw buildError("Este expediente no admite documentos previos", { code: "STANDALONE_DOC_NOT_APPLICABLE" });
    }
    const folderId = await ensureStandaloneDriveFolder(file, client);
    const stored = await uploadBase64File(fileName, fileBase64, mimeType || "application/pdf", folderId);

    const standalone = file.metadata?.standalone && typeof file.metadata.standalone === "object"
      ? file.metadata.standalone
      : {};
    const nextMetadata = {
      ...(file.metadata && typeof file.metadata === "object" ? file.metadata : {}),
      standalone: {
        ...standalone,
        drive_folder_id: folderId,
        documents: {
          ...(standalone.documents && typeof standalone.documents === "object" ? standalone.documents : {}),
          [docType]: {
            file_id: stored.id,
            file_name: fileName,
            uploaded_at: new Date().toISOString(),
            uploaded_by: user.id,
          },
        },
      },
    };
    await client.query(
      `UPDATE public.consumable_files SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(nextMetadata), fileId],
    );
    await client.query("COMMIT");
    return getFileDetail(fileId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ponytail: mismo heuristico de deteccion de columnas que
// businessCase.controller.js#_detectXlsxColumns (parse-quantities-file). Duplicado a proposito:
// son modulos sin relacion, no vale la pena acoplar business-case <-> consumable-files por esto.
function _normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

// ponytail: "producto a entregar" / "producto a enviar" es el encabezado real que usa la
// plantilla de Business Case (ver businessCaseSheetSyncLocal.service.js#findHeaderRow) para la
// cantidad maxima comprometida — se prioriza sobre "cantidad"/"anual" (que es consumo anual,
// no el maximo). Si no aparece, se cae a los sinonimos genericos para Excel sueltos.
//
// Las pestanas de equipo del BC tienen 5+ filas de metadata (CLIENTE, FECHA, MODALIDAD...)
// ANTES de la tabla real de items (fila ~8+), asi que hay que evaluar cada fila candidata
// buscando nameCol+qtyCol juntas, no solo "la primera fila con 2 celdas de texto" (eso
// atrapaba la fila de metadata y nunca llegaba a la tabla real).
function _detectColumnsInRow(row) {
  const headers = (row || []).map((h) => _normalizeForMatch(String(h || "")));
  let nameCol = null;
  let qtyCol = null;
  let fallbackQtyCol = null;
  let detKitCol = null;
  headers.forEach((h, i) => {
    if (nameCol === null && (h === "nombre" || h === "reactivo" || h === "descripcion" || h === "producto" || h === "item" || h === "name" || h === "material" || h === "control" || h === "calibrador")) nameCol = i;
    if (qtyCol === null && (h.includes("productoaentregar") || h.includes("productoaenviar") || h.includes("maxima"))) qtyCol = i;
    if (fallbackQtyCol === null && (h.includes("anual") || h.includes("cantidad") || h === "qty")) fallbackQtyCol = i;
    // "DET/KIT" (determinaciones por kit/caja) — token real de la plantilla BC, ver
    // GENERIC_SHEET_TOKENS en businessCaseSheetSyncLocal.service.js.
    if (detKitCol === null && h === "detkit") detKitCol = i;
  });
  if (qtyCol === null) qtyCol = fallbackQtyCol;
  return { nameCol, qtyCol, detKitCol };
}

function _detectXlsxColumns(data) {
  const maxRows = Math.min(30, data.length);
  for (let i = 0; i < maxRows; i++) {
    const { nameCol, qtyCol, detKitCol } = _detectColumnsInRow(data[i]);
    if (nameCol !== null && qtyCol !== null) {
      return { headerRowIdx: i, nameCol, qtyCol, detKitCol };
    }
  }
  // ninguna fila tenia ambas columnas: usar la vieja heuristica generica como ultimo recurso.
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(6, data.length); i++) {
    const textCount = (data[i] || []).filter((c) => typeof c === "string" && c.trim().length > 1).length;
    if (textCount >= 2) { headerRowIdx = i; break; }
  }
  const { nameCol, qtyCol, detKitCol } = _detectColumnsInRow(data[headerRowIdx]);
  return { headerRowIdx, nameCol, qtyCol, detKitCol };
}

// ponytail: escaneo de la columna A buscando las etiquetas de la hoja "BC" del template de
// Business Case (mismas etiquetas que BC_LABEL_FIELD_MAP en businessCaseSheetSyncLocal.service.js,
// solo los 4 campos que le sirven a Control de Consumibles). A diferencia del parser de ese
// modulo (que busca la celda VACIA para escribir), aqui buscamos la celda CON VALOR para leer.
const BC_HEADER_LABEL_MAP = new Map([
  ["cliente", "client_name"],
  ["entidadcontratante", "contracting_entity"],
  ["codigodelproceso", "process_code"],
  ["objetodecontratacion", "contract_object"],
]);

function _readFilledCell(ws, rowNumber, startColumn = 2, endColumn = 5) {
  for (let col = startColumn; col <= endColumn; col += 1) {
    const address = `${String.fromCharCode(64 + col)}${rowNumber}`;
    const value = ws?.[address]?.v;
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function _extractBcHeaderFields(workbook) {
  const result = {};
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    for (let row = 0; row < data.length; row++) {
      const label = _normalizeForMatch(String(data[row]?.[0] || ""));
      const fieldKey = BC_HEADER_LABEL_MAP.get(label);
      if (fieldKey && !result[fieldKey]) {
        result[fieldKey] = _readFilledCell(ws, row + 1);
      }
    }
    if (Object.keys(result).length === BC_HEADER_LABEL_MAP.size) break;
  }
  return result;
}

// ponytail: no existe un flujo de "solicitud de asignacion" en el sistema (solo asignacion
// directa restringida a jefe_operaciones, ver clients.service.js#assignClient). En vez de
// construir una entidad de aprobacion nueva, se reutiliza el mismo mecanismo de notificacion
// que ya usa este modulo (notifyOrderRecipients) para avisar a jefe_operaciones y que asigne
// desde la pantalla de Clientes que ya existe.
async function requestClientAssignment({ clientId, clientLabel, user }) {
  if (!hasAnyRole(user, STANDALONE_CREATE_ROLES)) {
    throw buildError("Tu rol no puede solicitar asignacion de clientes", {
      status: 403,
      code: "FORBIDDEN_CLIENT_ASSIGNMENT_REQUEST",
    });
  }
  const normalizedClientId = Number(clientId);
  if (!Number.isInteger(normalizedClientId)) {
    throw buildError("client_id invalido", { code: "INVALID_CLIENT_ID" });
  }
  const recipients = await listUsersByRoles(["jefe_operaciones", "jefe_de_operaciones"]);
  if (!recipients.length) {
    throw buildError("No hay jefe de operaciones activo para recibir la solicitud", {
      status: 409,
      code: "NO_ASSIGNMENT_RECIPIENTS",
    });
  }
  const requesterName = user.fullname || user.name || user.email || `Usuario #${user.id}`;
  await Promise.all(recipients.map((recipient) => notificationManager.sendNotification({
    userId: recipient.id,
    customTitle: "Solicitud de asignacion de cliente",
    customMessage: `${requesterName} solicita que se le asigne el cliente "${clientLabel || normalizedClientId}" (id ${normalizedClientId}) para un expediente de Control de Consumibles.`,
    type: "info",
    source: "consumable_files_client_assignment_request",
    priority: 2,
    data: {
      client_id: normalizedClientId,
      client_label: clientLabel || null,
      requested_by: user.id,
    },
    email: true,
    chat: false,
  })));
  return { ok: true, notified: recipients.length };
}

async function previewStandaloneBusinessCaseFile({ fileBase64, fileName, user }) {
  if (!hasAnyRole(user, STANDALONE_CREATE_ROLES)) {
    throw buildError("Tu rol no puede leer un business case resuelto", {
      status: 403,
      code: "FORBIDDEN_STANDALONE_BC_PREVIEW",
    });
  }
  if (!fileBase64 || !fileName) {
    throw buildError("Archivo requerido", { code: "STANDALONE_DOC_FILE_REQUIRED" });
  }
  let workbook;
  try {
    workbook = XLSX.read(Buffer.from(fileBase64, "base64"), { type: "buffer", raw: false });
  } catch {
    throw buildError("No se pudo leer el archivo. Verifica que sea un Excel o CSV valido.", { code: "STANDALONE_BC_FILE_UNREADABLE" });
  }

  const header = _extractBcHeaderFields(workbook);

  let clientMatch = null;
  if (header.client_name) {
    const { rows } = await db.query(
      `SELECT
         cr.id,
         cr.commercial_name,
         ca.assigned_to_email AS advisor_email,
         COALESCE(u.fullname, u.name, ca.assigned_to_email) AS advisor_name
       FROM public.client_requests cr
       LEFT JOIN public.client_assignments ca
         ON ca.client_request_id = cr.id
        AND ca.is_active = TRUE
        AND (ca.starts_at IS NULL OR ca.starts_at <= NOW())
        AND (ca.ends_at IS NULL OR ca.ends_at >= NOW())
       LEFT JOIN public.users u ON LOWER(u.email) = LOWER(ca.assigned_to_email)
       WHERE cr.commercial_name ILIKE $1
       LIMIT 2`,
      [`%${header.client_name}%`],
    );
    if (rows.length === 1) {
      clientMatch = {
        id: rows[0].id,
        label: rows[0].commercial_name,
        advisor_email: rows[0].advisor_email || null,
        advisor_name: rows[0].advisor_name || null,
      };
    }
  }

  const sheetItems = [];
  const sheetDiagnostics = [];
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    if (!data.length) {
      sheetDiagnostics.push({ sheet_name: sheetName, empty: true });
      continue;
    }
    const { headerRowIdx, nameCol, qtyCol, detKitCol } = _detectXlsxColumns(data);
    const diag = {
      sheet_name: sheetName,
      header_row_index: headerRowIdx,
      header_row_raw: data[headerRowIdx] || [],
      name_col: nameCol,
      qty_col: qtyCol,
      det_kit_col: detKitCol,
      rows_after_header: Math.max(0, data.length - (headerRowIdx + 1)),
    };
    if (nameCol === null || qtyCol === null) {
      diag.item_count_gt0 = 0;
      diag.item_count_total = 0;
      sheetDiagnostics.push(diag);
      continue;
    }
    const items = [];
    let totalRowsSeen = 0;
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i];
      const rawName = String(row[nameCol] || "").trim();
      if (!rawName) continue;
      totalRowsSeen++;
      const qtyRaw = String(row[qtyCol] || "").replace(",", ".").replace(/[^0-9.]/g, "");
      const qty = parseFloat(qtyRaw);
      // solo cuenta si de verdad sincronizaria una cantidad maxima (>0); una hoja con
      // filas en 0 no aporta nada real y no deberia mostrarse como "equipo detectado".
      if (!Number.isFinite(qty) || qty <= 0) continue;
      items.push({ item_name: rawName, max_units: Math.round(qty) });
    }
    diag.item_count_gt0 = items.length;
    diag.item_count_total = totalRowsSeen;
    sheetDiagnostics.push(diag);
    if (items.length) sheetItems.push({ sheet_name: sheetName, item_count: items.length });
  }

  const equipmentMatches = [];
  if (sheetItems.length) {
    const { rows: equipmentRows } = await db.query(
      `SELECT id, COALESCE(NULLIF(name, ''), NULLIF(model, ''), NULLIF(description, ''), CONCAT('Equipo #', id)) AS label
         FROM public.equipment_models`,
    );
    // ponytail: una pestana puede representar varios equipos combinados (ej. "C303 C503"
    // cubre cobas Pure 303 + cobas Pro 503). El nombre corto de la pestana no hace substring
    // match contra el nombre largo del catalogo, asi que se matchea por codigo numerico
    // (3+ digitos) compartido en vez de texto completo.
    // Los codigos se extraen del texto ORIGINAL (sin normalizar) porque normalizeForMatch
    // quita espacios/simbolos primero y eso fusiona numeros separados (ej. "8000 <801>" ->
    // "8000801" en vez de "8000" y "801" por separado).
    // IMPORTANTE: el match exige que TODOS los codigos del equipo esten en la hoja (subconjunto),
    // no que "alguno" coincida. El catalogo tiene equipos "combo" (ej. "cobas Pure <303 + 402>",
    // codigos {303,402}) que integran dos modulos — con un match por "algun codigo comparte" ese
    // combo terminaba marcando match parcial con AMBAS hojas individuales (303 con la hoja de
    // 303, 402 con la de 402), aunque el combo nunca aparece completo en ninguna de las dos.
    // Exigir subconjunto excluye esos falsos positivos: el combo solo matchea si su nombre de
    // hoja trae sus dos codigos juntos.
    // El codigo real siempre va entre "< >" en este catalogo (ej. "cobas Pure <303>"). El resto
    // del nombre puede traer otro numero que NO es codigo (ej. "cobas 8000 <801>": 8000 es la
    // serie del modelo, no un codigo) — si se extraen digitos de todo el texto, ese numero de
    // serie rompe el subconjunto y da falso negativo. Por eso se extrae solo lo que esta dentro
    // de los "< >"; si no hay brackets, se cae a extraer del texto completo.
    const equipmentWithCodes = equipmentRows.map((row) => {
      const bracketMatch = String(row.label).match(/<([^>]+)>/);
      const codeSource = bracketMatch ? bracketMatch[1] : String(row.label);
      return { ...row, codes: new Set((codeSource.match(/\d{3,}/g)) || []) };
    });
    for (const sheet of sheetItems) {
      const sheetCodes = new Set((String(sheet.sheet_name).match(/\d{3,}/g)) || []);
      const matches = equipmentWithCodes.filter((row) => (
        row.codes.size && Array.from(row.codes).every((code) => sheetCodes.has(code))
      ));
      equipmentMatches.push({
        sheet_name: sheet.sheet_name,
        item_count: sheet.item_count,
        equipment_ids: matches.map((row) => row.id),
        equipment_labels: matches.map((row) => row.label),
      });
    }
  }

  return {
    process_code: header.process_code || null,
    contracting_entity: header.contracting_entity || null,
    contract_object: header.contract_object || null,
    client_name_raw: header.client_name || null,
    client_match: clientMatch,
    equipment_matches: equipmentMatches,
    sheet_diagnostics: sheetDiagnostics,
  };
}

async function importStandaloneBusinessCaseFile({ fileId, sectionId, fileBase64, fileName, mimeType, user }) {
  if (!fileBase64 || !fileName) {
    throw buildError("Archivo requerido", { code: "STANDALONE_DOC_FILE_REQUIRED" });
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const file = await ensureEditableFile(fileId, user, client);
    if (file.origin_type !== "standalone") {
      throw buildError("Este expediente no admite carga de business case", { code: "STANDALONE_DOC_NOT_APPLICABLE" });
    }
    if (sectionId) {
      const section = await getSectionById(sectionId, client);
      if (!section || section.consumable_file_id !== fileId) {
        throw buildError("Subexpediente invalido", { code: "SECTION_NOT_FOUND" });
      }
    }

    let workbook;
    try {
      workbook = XLSX.read(Buffer.from(fileBase64, "base64"), { type: "buffer", raw: false });
    } catch {
      throw buildError("No se pudo leer el archivo. Verifica que sea un Excel o CSV valido.", { code: "STANDALONE_BC_FILE_UNREADABLE" });
    }

    // ponytail: sin sectionId (ej. justo tras crear el expediente) se aplica sobre todas
    // las lineas del expediente en vez de exigir subir el archivo una vez por subexpediente.
    const { rows: existingLines } = sectionId
      ? await client.query(
        `SELECT id, item_name, units_per_box, box_qty, max_units FROM public.consumable_file_lines WHERE consumable_file_section_id = $1`,
        [sectionId],
      )
      : await client.query(
        `SELECT l.id, l.item_name, l.units_per_box, l.box_qty, l.max_units
           FROM public.consumable_file_lines l
           INNER JOIN public.consumable_file_sections s ON s.id = l.consumable_file_section_id
          WHERE s.consumable_file_id = $1`,
        [fileId],
      );
    const byNormName = new Map();
    existingLines.forEach((line) => {
      const key = _normalizeForMatch(line.item_name);
      if (key && !byNormName.has(key)) byNormName.set(key, line);
    });

    const matched = [];
    const unmatchedNames = [];
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
      if (!data.length) continue;
      const { headerRowIdx, nameCol, qtyCol, detKitCol } = _detectXlsxColumns(data);
      if (nameCol === null || qtyCol === null) continue;
      for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        const rawName = String(row[nameCol] || "").trim();
        if (!rawName) continue;
        // qty = "CANTIDADES MAXIMAS / CAJA" (columna PRODUCTO A ENTREGAR/ENVIAR del BC).
        // qty <= 0 se salta: no hay nada real que sincronizar para esa fila.
        const qtyRaw = String(row[qtyCol] || "").replace(",", ".").replace(/[^0-9.]/g, "");
        const qty = parseFloat(qtyRaw);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const line = byNormName.get(_normalizeForMatch(rawName));
        if (!line) {
          unmatchedNames.push(rawName);
          continue;
        }
        // DET/KIT tambien se lee del archivo; si la fila no lo trae, se conserva lo que ya
        // tenia la linea (nunca se inventa un valor).
        const detKitRaw = detKitCol !== null ? String(row[detKitCol] || "").replace(",", ".").replace(/[^0-9.]/g, "") : "";
        const detKit = parseFloat(detKitRaw);
        const unitsPerBox = Number.isFinite(detKit) && detKit > 0 ? detKit : Number(line.units_per_box || 1);
        const boxQty = Math.round(qty);
        const maxUnits = Number((unitsPerBox * boxQty).toFixed(3));
        await client.query(
          `UPDATE public.consumable_file_lines
              SET units_per_box = $1, box_qty = $2, max_units = $3, updated_at = NOW()
            WHERE id = $4`,
          [unitsPerBox, boxQty, maxUnits, line.id],
        );
        matched.push({ line_id: line.id, item_name: line.item_name, units_per_box: unitsPerBox, box_qty: boxQty, max_units: maxUnits });
      }
    }

    const folderId = await ensureStandaloneDriveFolder(file, client);
    const stored = await uploadBase64File(fileName, fileBase64, mimeType || "application/octet-stream", folderId);
    const standalone = file.metadata?.standalone && typeof file.metadata.standalone === "object"
      ? file.metadata.standalone
      : {};
    const nextMetadata = {
      ...(file.metadata && typeof file.metadata === "object" ? file.metadata : {}),
      standalone: {
        ...standalone,
        drive_folder_id: folderId,
        business_case_file: {
          file_id: stored.id,
          file_name: fileName,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user.id,
          matched_count: matched.length,
          unmatched_count: unmatchedNames.length,
        },
      },
    };
    await client.query(
      `UPDATE public.consumable_files SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(nextMetadata), fileId],
    );

    await client.query("COMMIT");
    const detail = await getFileDetail(fileId);
    return { ...detail, import_summary: { matched, unmatched_names: unmatchedNames } };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelFile({ fileId, user, reason = null }) {
  if (!hasAnyRole(user, LIFECYCLE_ROLES)) {
    throw buildError("Tu rol no puede cancelar expedientes de consumibles", {
      status: 403,
      code: "FORBIDDEN_CONSUMABLE_FILE_CANCEL",
    });
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const file = await getFileHeaderById(fileId, client);
    if (file.status === "cancelled") {
      throw buildError("El expediente ya se encuentra cancelado", {
        status: 409,
        code: "CONSUMABLE_FILE_ALREADY_CANCELLED",
      });
    }
    const { rows: orders } = await client.query(
      `SELECT id, status
         FROM public.consumable_orders
        WHERE consumable_file_id = $1
        FOR UPDATE`,
      [fileId],
    );
    const blockedOrder = orders.find((order) => ["approved", "partially_dispatched", "dispatched"].includes(String(order.status || "").toLowerCase()));
    if (blockedOrder) {
      throw buildError("No se puede cancelar el expediente porque tiene pedidos aprobados o despachados", {
        status: 409,
        code: "CONSUMABLE_FILE_CANCEL_BLOCKED_BY_ORDER",
      });
    }
    if (orders.length) {
      await client.query(
        `UPDATE public.consumable_orders
            SET status = 'cancelled',
                notes = COALESCE(notes, '') || CASE WHEN $2 IS NOT NULL THEN CONCAT(E'\\n\\nCancelado administrativamente: ', $2) ELSE '' END,
                updated_at = NOW()
          WHERE consumable_file_id = $1`,
        [fileId, normalizeText(reason)],
      );
    }
    await client.query(
      `UPDATE public.consumable_files
          SET status = 'cancelled',
              metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cancellation_reason}', to_jsonb(COALESCE($2::text, 'cancelled')), true),
              updated_at = NOW()
        WHERE id = $1`,
      [fileId, normalizeText(reason)],
    );
    await client.query("COMMIT");
    return getFileDetail(fileId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function searchCatalog({ q = "", type = null, limit = 20 }) {
  const params = [];
  const where = [];
  const normalizedQ = normalizeText(q);
  if (normalizedQ) {
    params.push(`%${normalizedQ.toLowerCase()}%`);
    where.push(`(LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(supplier_code, '')) LIKE $${params.length})`);
  }
  const normalizedType = normalizeText(type);
  if (normalizedType) {
    params.push(normalizeItemType(normalizedType));
    where.push(`type = $${params.length}`);
  }
  params.push(Math.min(100, Math.max(1, Number(limit || 20))));
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT id, name, type, supplier_code, units_per_kit, unit_price, metadata
       FROM public.catalog_consumables
       ${whereSql}
      ORDER BY name ASC
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function notifyOrderRecipients({ file, order, hasExtra, detail = null }) {
  try {
    const rows = await listUsersByRoles(ORDER_NOTIFICATION_ROLES);
    if (!rows.length) return;
    const orderSummary = buildOrderLinesSummary(file, order, detail);
    await Promise.all(rows.map((user) => notificationManager.sendNotification({
      userId: user.id,
      customTitle: hasExtra ? "Pedido de consumibles con excedente" : "Nuevo pedido de consumibles",
      customMessage: `Proceso: ${file.process_name}. Periodo: ${order.period}. Pedido #${order.id}. ${orderSummary}. Abrir: ${buildWorkspacePath(file)}`,
      type: hasExtra ? "warning" : "info",
      source: "consumable_files_order",
      priority: 2,
      data: {
        consumable_file_id: file.id,
        consumable_order_id: order.id,
        period: order.period,
        has_extra: hasExtra,
        workspace_path: buildWorkspacePath(file),
      },
      email: true,
      chat: false,
    })));
  } catch (error) {
    logger.warn({ error: error.message, fileId: file.id, orderId: order.id }, "No se pudo notificar pedido de consumibles");
  }
}

async function notifyExtraReviewed({ file, order, decision, detail = null }) {
  try {
    const recipientIds = new Set();
    if (order?.requested_by) recipientIds.add(String(order.requested_by));
    const logisticsUsers = decision === "approved"
      ? await listUsersByRoles(["jefe_logistica", "logistica"])
      : [];
    logisticsUsers.forEach((user) => recipientIds.add(String(user.id)));
    if (!recipientIds.size) return;
    const title = decision === "approved"
      ? "Excedente de consumibles aprobado"
      : "Excedente de consumibles rechazado";
    const message = `Proceso: ${file.process_name}. Pedido #${order.id}. El excedente fue ${decision === "approved" ? "aprobado" : "rechazado"}. ${buildOrderLinesSummary(file, order, detail)}. Abrir: ${buildWorkspacePath(file)}`;
    await Promise.all(Array.from(recipientIds).map((userId) => notificationManager.sendNotification({
      userId,
      customTitle: title,
      customMessage: message,
      type: decision === "approved" ? "info" : "warning",
      source: "consumable_files_extra_review",
      priority: 2,
      data: {
        consumable_file_id: file.id,
        consumable_order_id: order.id,
        decision,
        workspace_path: buildWorkspacePath(file),
      },
      email: true,
      chat: false,
    })));
  } catch (error) {
    logger.warn({ error: error.message, fileId: file?.id || null, orderId: order?.id || null }, "No se pudo notificar revision de excedente");
  }
}

async function notifyDispatchRegistered({ file, order, detail = null }) {
  try {
    const recipientIds = new Set();
    if (order?.requested_by) recipientIds.add(String(order.requested_by));
    const opsUsers = await listUsersByRoles(["jefe_operaciones"]);
    opsUsers.forEach((user) => recipientIds.add(String(user.id)));
    if (!recipientIds.size) return;
    await Promise.all(Array.from(recipientIds).map((userId) => notificationManager.sendNotification({
      userId,
      customTitle: "Despacho de consumibles registrado",
      customMessage: `Proceso: ${file.process_name}. Pedido #${order.id}. Estado actual: ${String(order.status || "").replace(/_/g, " ")}. ${buildOrderLinesSummary(file, order, detail)}. Abrir: ${buildWorkspacePath(file)}`,
      type: order.status === "dispatched" ? "success" : "info",
      source: "consumable_files_dispatch",
      priority: 1,
      data: {
        consumable_file_id: file.id,
        consumable_order_id: order.id,
        order_status: order.status,
        workspace_path: buildWorkspacePath(file),
      },
      email: true,
      chat: false,
    })));
  } catch (error) {
    logger.warn({ error: error.message, fileId: file?.id || null, orderId: order?.id || null }, "No se pudo notificar despacho de consumibles");
  }
}

async function createOrder({ fileId, period, notes = null, lines = [], user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const file = await getFileHeaderById(fileId, client);
    if (file.status !== "registered") {
      throw buildError("El expediente debe estar registrado para crear pedidos", {
        status: 409,
        code: "CONSUMABLE_FILE_NOT_REGISTERED",
      });
    }
    if (!hasAnyRole(user, FILE_EDIT_ROLES)) {
      throw buildError("Tu rol no puede crear pedidos en este expediente", {
        status: 403,
        code: "FORBIDDEN_CONSUMABLE_ORDER_CREATE",
      });
    }
    const normalizedPeriod = normalizeText(period);
    if (!normalizedPeriod) {
      throw buildError("period es requerido", {
        code: "ORDER_PERIOD_REQUIRED",
      });
    }
    const normalizedLines = Array.isArray(lines)
      ? lines
        .map((row) => ({
          consumable_file_line_id: Number(row.consumable_file_line_id || row.file_line_id || row.id),
          requested_new_units: Number(row.requested_new_units ?? row.requested_units ?? 0),
        }))
        .filter((row) => Number.isFinite(row.consumable_file_line_id) && Number.isFinite(row.requested_new_units) && row.requested_new_units >= 0)
      : [];
    if (!normalizedLines.length) {
      throw buildError("Debes enviar al menos una linea para el pedido", {
        code: "ORDER_LINES_REQUIRED",
      });
    }

    const lineIds = normalizedLines.map((row) => row.consumable_file_line_id);
    const { rows: fileLines } = await client.query(
      `SELECT
         l.*,
         s.consumable_file_id
       FROM public.consumable_file_lines l
       INNER JOIN public.consumable_file_sections s ON s.id = l.consumable_file_section_id
       WHERE s.consumable_file_id = $1
         AND l.id = ANY($2::bigint[])
       ORDER BY l.id ASC
       FOR UPDATE`,
      [fileId, lineIds],
    );
    if (fileLines.length !== lineIds.length) {
      throw buildError("Una o mas lineas no pertenecen al expediente", {
        code: "ORDER_LINE_NOT_ALLOWED",
      });
    }

    const baseConsumption = await getBaseConsumptionMap(fileId, client);
    const { rows: carryoverRows } = await client.query(
      `SELECT
         dl.id AS dispatch_line_id,
         ol.consumable_file_line_id,
         dl.pending_units
       FROM public.consumable_dispatch_lines dl
       INNER JOIN public.consumable_order_lines ol ON ol.id = dl.consumable_order_line_id
       INNER JOIN public.consumable_orders o ON o.id = dl.consumable_order_id
       WHERE o.consumable_file_id = $1
         AND dl.pending_units > 0
         AND dl.carried_forward_order_id IS NULL
       FOR UPDATE`,
      [fileId],
    );
    const carryoverByLine = new Map();
    const carryoverDispatchIdsByLine = new Map();
    for (const row of carryoverRows) {
      const lineId = Number(row.consumable_file_line_id);
      carryoverByLine.set(lineId, Number((Number(carryoverByLine.get(lineId) || 0) + Number(row.pending_units || 0)).toFixed(3)));
      if (!carryoverDispatchIdsByLine.has(lineId)) carryoverDispatchIdsByLine.set(lineId, []);
      carryoverDispatchIdsByLine.get(lineId).push(Number(row.dispatch_line_id));
    }

    const { rows: orderRows } = await client.query(
      `INSERT INTO public.consumable_orders (
         consumable_file_id,
         period,
         status,
         notes,
         submitted_at,
         requested_by,
         created_at,
         updated_at
       ) VALUES ($1, $2, 'draft', $3, NOW(), $4, NOW(), NOW())
       RETURNING *`,
      [fileId, normalizedPeriod, normalizeText(notes), user.id],
    );
    const order = orderRows[0];

    let hasExtra = false;
    for (const requested of normalizedLines) {
      const fileLine = fileLines.find((row) => Number(row.id) === requested.consumable_file_line_id);
      const carryoverUnits = Number(carryoverByLine.get(requested.consumable_file_line_id) || 0);
      const maxUnits = Number(fileLine.max_units || 0);
      const baseConsumed = Number(baseConsumption.get(requested.consumable_file_line_id) || 0);
      const availableBefore = Math.max(0, Number((maxUnits - baseConsumed).toFixed(3)));
      const baseRequested = Math.min(availableBefore, Number(requested.requested_new_units || 0));
      const extraRequested = Math.max(0, Number((requested.requested_new_units - baseRequested).toFixed(3)));
      if (extraRequested > 0) hasExtra = true;
      const requestedUnits = Number((carryoverUnits + requested.requested_new_units).toFixed(3));

      await client.query(
        `INSERT INTO public.consumable_order_lines (
           consumable_order_id,
           consumable_file_line_id,
           carryover_units,
           requested_new_units,
           requested_units,
           available_before_request,
           base_requested_units,
           extra_requested_units,
           approved_extra_units,
           extra_status,
           created_at,
           updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
         )`,
        [
          order.id,
          requested.consumable_file_line_id,
          carryoverUnits,
          Number(requested.requested_new_units.toFixed(3)),
          requestedUnits,
          availableBefore,
          Number(baseRequested.toFixed(3)),
          extraRequested,
          hasExtra ? null : 0,
          extraRequested > 0 ? "pending" : null,
        ],
      );
    }

    if (carryoverRows.length) {
      await client.query(
        `UPDATE public.consumable_dispatch_lines
            SET carried_forward_order_id = $1,
                carried_forward_at = NOW()
          WHERE id = ANY($2::bigint[])`,
        [order.id, carryoverRows.map((row) => Number(row.dispatch_line_id))],
      );
    }

    const nextStatus = hasExtra ? "extra_pending" : "approved";
    await client.query(
      `UPDATE public.consumable_orders
          SET status = $2,
              approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END,
              approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE NULL END,
              updated_at = NOW()
        WHERE id = $1`,
      [order.id, nextStatus, hasExtra ? null : user.id],
    );

    await client.query("COMMIT");
    const detail = await getFileDetail(fileId);
    const refreshedOrder = detail.orders.find((row) => row.id === Number(order.id)) || { id: Number(order.id), period: normalizedPeriod };
    await notifyOrderRecipients({ file, order: refreshedOrder, hasExtra, detail });
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reviewExtra({ orderId, decision, lines = [], user }) {
  if (!hasAnyRole(user, ORDER_REVIEW_ROLES)) {
    throw buildError("Tu rol no puede revisar excedentes", {
      status: 403,
      code: "FORBIDDEN_EXTRA_REVIEW",
    });
  }
  const normalizedDecision = String(decision || "").trim().toLowerCase();
  if (!["approved", "rejected"].includes(normalizedDecision)) {
    throw buildError("decision invalida", {
      code: "INVALID_EXTRA_DECISION",
    });
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT *
         FROM public.consumable_orders
        WHERE id = $1
        FOR UPDATE`,
      [orderId],
    );
    if (!rows.length) {
      throw buildError("Pedido no encontrado", {
        status: 404,
        code: "CONSUMABLE_ORDER_NOT_FOUND",
      });
    }
    const order = rows[0];
    if (order.status !== "extra_pending") {
      throw buildError("El pedido no esta pendiente de revision de excedentes", {
        status: 409,
        code: "ORDER_NOT_EXTRA_PENDING",
      });
    }
    const requestedLines = Array.isArray(lines) ? lines : [];
    const customById = new Map(
      requestedLines
        .map((line) => [Number(line.order_line_id || line.id), line])
        .filter(([lineId]) => Number.isFinite(lineId)),
    );
    const { rows: orderLines } = await client.query(
      `SELECT *
         FROM public.consumable_order_lines
        WHERE consumable_order_id = $1
        FOR UPDATE`,
      [orderId],
    );
    for (const line of orderLines) {
      const extraRequested = Number(line.extra_requested_units || 0);
      if (extraRequested <= 0) continue;
      const custom = customById.get(Number(line.id));
      let approvedExtraUnits = 0;
      if (normalizedDecision === "approved") {
        approvedExtraUnits = custom && custom.approved_extra_units !== undefined
          ? Math.max(0, Math.min(extraRequested, Number(custom.approved_extra_units || 0)))
          : extraRequested;
      }
      const nextStatus = approvedExtraUnits > 0 ? "approved" : "rejected";
      await client.query(
        `UPDATE public.consumable_order_lines
            SET approved_extra_units = $2,
                extra_status = $3,
                updated_at = NOW()
          WHERE id = $1`,
        [line.id, approvedExtraUnits, nextStatus],
      );
    }
    await client.query(
      `UPDATE public.consumable_orders
          SET status = 'approved',
              approved_at = NOW(),
              approved_by = $2,
              updated_at = NOW()
        WHERE id = $1`,
      [orderId, user.id],
    );
    await client.query("COMMIT");
    const detail = await getFileDetail(order.consumable_file_id);
    const refreshedOrder = detail.orders.find((row) => row.id === Number(orderId)) || { id: Number(orderId), requested_by: order.requested_by };
    await notifyExtraReviewed({
      file: detail.file,
      order: refreshedOrder,
      decision: normalizedDecision,
      detail,
    });
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function dispatchOrder({ orderId, lines = [], notes = null, user }) {
  if (!hasAnyRole(user, DISPATCH_ROLES)) {
    throw buildError("Tu rol no puede registrar despachos", {
      status: 403,
      code: "FORBIDDEN_ORDER_DISPATCH",
    });
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT *
         FROM public.consumable_orders
        WHERE id = $1
        FOR UPDATE`,
      [orderId],
    );
    if (!rows.length) {
      throw buildError("Pedido no encontrado", {
        status: 404,
        code: "CONSUMABLE_ORDER_NOT_FOUND",
      });
    }
    const order = rows[0];
    if (!["approved", "partially_dispatched"].includes(order.status)) {
      throw buildError("El pedido no esta listo para despacho", {
        status: 409,
        code: "ORDER_NOT_DISPATCHABLE",
      });
    }
    const customByLine = new Map(
      (Array.isArray(lines) ? lines : [])
        .map((row) => [Number(row.order_line_id || row.id), Number(row.sent_units || 0)])
        .filter(([lineId, sentUnits]) => Number.isFinite(lineId) && Number.isFinite(sentUnits) && sentUnits >= 0),
    );
    const { rows: orderLines } = await client.query(
      `SELECT *
         FROM public.consumable_order_lines
        WHERE consumable_order_id = $1
        ORDER BY id ASC
        FOR UPDATE`,
      [orderId],
    );
    const { rows: dispatchSums } = await client.query(
      `SELECT
         consumable_order_line_id,
         COALESCE(SUM(sent_units), 0)::numeric AS sent_units
       FROM public.consumable_dispatch_lines
       WHERE consumable_order_id = $1
       GROUP BY consumable_order_line_id`,
      [orderId],
    );
    const sentByLine = new Map(
      dispatchSums.map((row) => [Number(row.consumable_order_line_id), Number(row.sent_units || 0)]),
    );
    let hasPending = false;
    let dispatchedAnyUnits = false;
    for (const line of orderLines) {
      const approvedExtra = line.extra_status === "approved"
        ? Number(line.approved_extra_units || 0)
        : 0;
      const approvedTotal = Number((Number(line.carryover_units || 0) + Number(line.base_requested_units || 0) + approvedExtra).toFixed(3));
      const alreadySent = Number(sentByLine.get(Number(line.id)) || 0);
      const remainingBeforeDispatch = Math.max(0, Number((approvedTotal - alreadySent).toFixed(3)));
      const sentUnits = customByLine.has(Number(line.id))
        ? Math.min(remainingBeforeDispatch, Number(customByLine.get(Number(line.id)) || 0))
        : remainingBeforeDispatch;
      const pendingUnits = Math.max(0, Number((remainingBeforeDispatch - sentUnits).toFixed(3)));
      if (sentUnits > 0) dispatchedAnyUnits = true;
      if (pendingUnits > 0) hasPending = true;
      await client.query(
        `UPDATE public.consumable_dispatch_lines
            SET pending_units = 0
          WHERE consumable_order_id = $1
            AND consumable_order_line_id = $2
            AND pending_units > 0`,
        [orderId, line.id],
      );
      await client.query(
        `INSERT INTO public.consumable_dispatch_lines (
           consumable_order_id,
           consumable_order_line_id,
           sent_units,
           pending_units,
           notes,
           dispatched_by,
           dispatched_at,
           created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [orderId, line.id, sentUnits, pendingUnits, normalizeText(notes), user.id],
      );
    }
    if (!dispatchedAnyUnits) {
      throw buildError("Debes registrar al menos una unidad enviada para continuar", {
        status: 409,
        code: "DISPATCH_WITHOUT_SENT_UNITS",
      });
    }
    await client.query(
      `UPDATE public.consumable_orders
          SET status = $2,
              dispatch_notes = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [orderId, hasPending ? "partially_dispatched" : "dispatched", normalizeText(notes)],
    );
    await client.query("COMMIT");
    const detail = await getFileDetail(order.consumable_file_id);
    const refreshedOrder = detail.orders.find((row) => row.id === Number(orderId)) || { id: Number(orderId), status: hasPending ? "partially_dispatched" : "dispatched", requested_by: order.requested_by };
    await notifyDispatchRegistered({
      file: detail.file,
      order: refreshedOrder,
      detail,
    });
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelOrder({ orderId, user, reason = null }) {
  if (!hasAnyRole(user, LIFECYCLE_ROLES)) {
    throw buildError("Tu rol no puede cancelar pedidos de consumibles", {
      status: 403,
      code: "FORBIDDEN_CONSUMABLE_ORDER_CANCEL",
    });
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT *
         FROM public.consumable_orders
        WHERE id = $1
        FOR UPDATE`,
      [orderId],
    );
    if (!rows.length) {
      throw buildError("Pedido no encontrado", {
        status: 404,
        code: "CONSUMABLE_ORDER_NOT_FOUND",
      });
    }
    const order = rows[0];
    if (order.status === "cancelled") {
      throw buildError("El pedido ya esta cancelado", {
        status: 409,
        code: "CONSUMABLE_ORDER_ALREADY_CANCELLED",
      });
    }
    if (["partially_dispatched", "dispatched"].includes(String(order.status || "").toLowerCase())) {
      throw buildError("No se puede cancelar un pedido con despacho registrado", {
        status: 409,
        code: "CONSUMABLE_ORDER_CANCEL_BLOCKED_BY_DISPATCH",
      });
    }
    await client.query(
      `UPDATE public.consumable_orders
          SET status = 'cancelled',
              notes = COALESCE(notes, '') || CASE WHEN $2 IS NOT NULL THEN CONCAT(E'\\n\\nCancelado administrativamente: ', $2) ELSE '' END,
              updated_at = NOW()
        WHERE id = $1`,
      [orderId, normalizeText(reason)],
    );
    await client.query("COMMIT");
    return getFileDetail(order.consumable_file_id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  normalizeText,
  normalizeNumeric,
  normalizeItemType,
  normalizeBoolean,
  hasAnyRole,
  cancelFile,
  cancelOrder,
  createStandaloneFile,
  createFileFromPurchase,
  getFileDetail,
  listFilesOverview,
  getFileHeaderByPurchase,
  previewStandaloneCatalog,
  updateFileHeader,
  createSection,
  importBusinessCaseLines,
  addLine,
  updateLine,
  deleteLine,
  importEquipmentLines,
  registerFile,
  searchCatalog,
  createOrder,
  reviewExtra,
  dispatchOrder,
  uploadStandaloneDocument,
  importStandaloneBusinessCaseFile,
  previewStandaloneBusinessCaseFile,
  requestClientAssignment,
  STANDALONE_REQUIRED_DOC_TYPES,
  STANDALONE_OPTIONAL_DOC_TYPES,
  STANDALONE_DOC_LABELS,
};
