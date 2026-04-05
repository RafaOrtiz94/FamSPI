const SITE_INSPECTION_RESULT = Object.freeze({
  COMPLIANT: "compliant",
  NON_COMPLIANT: "non_compliant",
});

const SITE_INSPECTION_STATUS = Object.freeze({
  PENDING: "pending",
  NON_COMPLIANT_REINSPECTION_PENDING: "non_compliant_reinspection_pending",
  READY_FOR_INSTALLATION: "ready_for_installation",
});

const FST07_CHECKLIST_SECTIONS = Object.freeze([
  {
    key: "area",
    label: "1. Área física",
    items: [
      {
        key: "area_min_space",
        label: "El área cumple los requerimientos mínimos de espacio requeridos por el equipo",
        allows_na: false,
      },
      {
        key: "area_pressure_temperature",
        label: "El área cumple con las condiciones de presión y temperatura requeridas por el equipo",
        allows_na: false,
      },
      {
        key: "area_humidity",
        label: "La humedad del ambiente es la máxima permitida por el equipo",
        allows_na: false,
      },
      {
        key: "area_free_dust",
        label: "El área se encuentra libre de polvo y/o contaminación para el buen funcionamiento del equipo",
        allows_na: false,
      },
    ],
  },
  {
    key: "electrical",
    label: "2. Condiciones eléctricas",
    items: [
      {
        key: "electrical_dedicated_outlets",
        label: "El área posee tomas eléctricas dedicadas",
        allows_na: false,
      },
      {
        key: "electrical_polarized_outlets",
        label: "El área posee tomas eléctricas polarizadas",
        allows_na: false,
      },
      {
        key: "electrical_breakers",
        label: "Las tomas eléctricas están protegidas por brakers adecuados para la carga del equipo",
        allows_na: false,
      },
      {
        key: "electrical_power_capacity",
        label: "La conexión eléctrica garantiza el consumo de potencia del equipo",
        allows_na: false,
      },
      {
        key: "electrical_ups",
        label: "Posee el área una toma protegida por un UPS central",
        allows_na: true,
      },
      {
        key: "electrical_grounding",
        label: "El área posee conexión a tierra que garantice un voltaje menor a 1 V entre neutro tierra",
        allows_na: false,
      },
    ],
  },
  {
    key: "water",
    label: "3. Requerimientos de agua",
    items: [
      {
        key: "water_intake",
        label: "El área tiene las tomas de agua requeridas",
        allows_na: true,
      },
      {
        key: "water_pressure",
        label: "La presión de agua es adecuada (mín. 30 PSI)",
        allows_na: true,
      },
      {
        key: "water_drain",
        label: "El área tiene los desagües necesarios",
        allows_na: true,
      },
      {
        key: "water_quality",
        label: "La calidad del agua es la adecuada",
        allows_na: true,
      },
    ],
  },
  {
    key: "remote",
    label: "4. Conectividad remota",
    items: [
      {
        key: "remote_network_points",
        label: "Tiene el laboratorio puntos de red en las cercanías de la ubicación del equipo",
        allows_na: false,
      },
      {
        key: "remote_internet",
        label: "Tiene el laboratorio conexión a internet para acceso remoto",
        allows_na: false,
      },
    ],
  },
]);

const FST07_CHECKLIST_ITEMS = Object.freeze(
  FST07_CHECKLIST_SECTIONS.flatMap((section) =>
    (Array.isArray(section.items) ? section.items : []).map((item) => ({
      section_key: section.key,
      section_label: section.label,
      ...item,
    })),
  ),
);

const FST07_ITEM_KEYS = Object.freeze(FST07_CHECKLIST_ITEMS.map((item) => item.key));

const createSiteInspectionError = (message, { status = 400, code = "SITE_INSPECTION_INVALID", details } = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
};

const normalizeDateOnlyInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];

  const esDateMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (esDateMatch) {
    const [, dd, mm, yyyy] = esDateMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
};

const normalizeChecklistAnswer = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "SI" || normalized === "NO" || normalized === "N/A") return normalized;
  return "";
};

const createEmptyFst07Checklist = () => {
  const draft = {};
  FST07_ITEM_KEYS.forEach((key) => {
    draft[key] = "";
  });
  return draft;
};

const normalizeInspectionResult = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === SITE_INSPECTION_RESULT.COMPLIANT) return SITE_INSPECTION_RESULT.COMPLIANT;
  if (normalized === SITE_INSPECTION_RESULT.NON_COMPLIANT) return SITE_INSPECTION_RESULT.NON_COMPLIANT;
  return "";
};

const normalizeFst07Checklist = (input = {}, { strict = true } = {}) => {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const normalized = {};

  for (const item of FST07_CHECKLIST_ITEMS) {
    const answer = normalizeChecklistAnswer(source[item.key]);
    if (!answer) {
      if (!strict) {
        normalized[item.key] = "";
        continue;
      }
      throw createSiteInspectionError(`Checklist F.ST-07 incompleto en '${item.key}'`, {
        status: 400,
        code: "SITE_INSPECTION_CHECKLIST_INVALID",
        details: { key: item.key, reason: "required" },
      });
    }
    if (answer === "N/A" && !item.allows_na) {
      throw createSiteInspectionError(`La opción N/A no aplica para '${item.key}'`, {
        status: 400,
        code: "SITE_INSPECTION_CHECKLIST_INVALID",
        details: { key: item.key, reason: "na_not_allowed" },
      });
    }
    normalized[item.key] = answer;
  }

  return normalized;
};

const getSiteInspectionState = (raw = {}) => {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const status =
    source.status ||
    (source.ready_for_installation
      ? SITE_INSPECTION_STATUS.READY_FOR_INSTALLATION
      : SITE_INSPECTION_STATUS.PENDING);

  return {
    status,
    result: source.result || null,
    follow_up_date: normalizeDateOnlyInput(source.follow_up_date) || null,
    report_file_id: source.report_file_id || null,
    report_link: source.report_link || null,
    report_generated_at: source.report_generated_at || null,
    ready_for_installation: Boolean(source.ready_for_installation),
    requires_reinspection: Boolean(source.requires_reinspection),
    checklist: normalizeFst07Checklist(source.checklist || {}, { strict: false }),
    observations: source.observations || null,
    recommendations: source.recommendations || null,
    responsible_name: source.responsible_name || null,
    client_signer_name: source.client_signer_name || null,
    inspected_at: source.inspected_at || null,
    updated_at: source.updated_at || null,
    updated_by: source.updated_by || null,
    updated_by_email: source.updated_by_email || null,
    history: Array.isArray(source.history) ? source.history : [],
  };
};

const assertFollowUpDateConsistency = ({
  result,
  followUpDate,
  scheduledDate,
  allowEqual = true,
}) => {
  const normalizedResult = normalizeInspectionResult(result);
  const normalizedFollowUp = normalizeDateOnlyInput(followUpDate);
  const normalizedScheduled = normalizeDateOnlyInput(scheduledDate);

  if (normalizedResult === SITE_INSPECTION_RESULT.NON_COMPLIANT && !normalizedFollowUp) {
    throw createSiteInspectionError("Debes registrar una fecha de reinspección cuando el área no cumple", {
      status: 400,
      code: "SITE_INSPECTION_FOLLOW_UP_REQUIRED",
    });
  }

  if (
    normalizedResult === SITE_INSPECTION_RESULT.NON_COMPLIANT &&
    normalizedFollowUp &&
    normalizedScheduled
  ) {
    const scheduledTs = new Date(`${normalizedScheduled}T00:00:00`).getTime();
    const followTs = new Date(`${normalizedFollowUp}T00:00:00`).getTime();
    if (!Number.isFinite(followTs)) {
      throw createSiteInspectionError("Formato de fecha inválido para reinspección", {
        status: 400,
        code: "INVALID_DATE_FORMAT",
      });
    }
    if (allowEqual ? followTs < scheduledTs : followTs <= scheduledTs) {
      throw createSiteInspectionError(
        "La fecha de reinspección debe ser igual o posterior a la fecha de inspección",
        {
          status: 409,
          code: "INSPECTION_DATE_OUT_OF_WINDOW",
        },
      );
    }
  }

  return normalizedFollowUp || null;
};

module.exports = {
  SITE_INSPECTION_RESULT,
  SITE_INSPECTION_STATUS,
  FST07_CHECKLIST_SECTIONS,
  FST07_CHECKLIST_ITEMS,
  FST07_ITEM_KEYS,
  createSiteInspectionError,
  normalizeDateOnlyInput,
  normalizeChecklistAnswer,
  createEmptyFst07Checklist,
  normalizeInspectionResult,
  normalizeFst07Checklist,
  getSiteInspectionState,
  assertFollowUpDateConsistency,
};
