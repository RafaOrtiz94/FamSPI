const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const FULL_ACCESS_ROLES = new Set([
  "talento_humano",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
  "analista_talento_humano",
  "asistente_talento_humano",
  "auxiliar_talento_humano",
  "rh",
  "rrhh",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "admin",
  "administrador",
]);

const FINANCIAL_ROLES = new Set([
  "finanzas",
  "financiero",
  "jefe_finanzas",
  "jefe_financiero",
]);

const TI_ROLES = new Set(["ti", "jefe_ti", "admin_ti"]);
const LOGISTICS_ROLES = new Set([
  "logistica",
  "jefe_logistica",
  "operaciones",
  "jefe_operaciones",
]);

const FINANCIAL_DOCUMENT_CODES = new Set(["PAYROLL_DISCOUNT_AUTHORIZATION"]);
const TI_DOCUMENT_CODES = new Set(["DELIVERY_COMMUNICATION_TOOLS"]);
const LOGISTICS_DOCUMENT_CODES = new Set([
  "DELIVERY_LOGISTICS_TOOLS",
  "DELIVERY_WORK_TOOLS",
  "DELIVERY_WORK_CLOTHES",
  "DELIVERY_EPP",
]);

const TI_FLAG_KEYS = new Set([
  "correo_corporativo",
  "accesos_bitrix",
  "accesos_silver",
  "credenciales_roche",
  "acceso_links_interes",
  "computadora_entregada",
  "salida_equipos",
  "salida_cuentas",
  "eliminacion_accesos_sistemas",
  "ti_retirado",
]);

const FINANCIAL_FLAG_KEYS = new Set([
  "liquidacion",
  "liquidacion_mdt_finiquito",
  "firma_roles_pago_pendientes",
]);

const LOGISTICS_FLAG_KEYS = new Set([
  "celular_entregado",
  "uniformes_entregados",
  "epp_entregados",
  "herramientas_trabajo_entregadas",
  "logistica_entregada",
  "ropa_retirada",
  "epp_retirado",
  "herramientas_trabajo_retiradas",
  "logistica_retirada",
  "acta_descargo_herramientas",
  "acta_descargo_uniformes",
]);

export const resolveTalentWorkspaceAccess = (role) => {
  const normalizedRole = normalizeRole(role);

  if (FULL_ACCESS_ROLES.has(normalizedRole)) {
    return {
      scope: "full",
      normalizedRole,
      canEditProfile: true,
      canViewProfile: true,
      canViewComments: true,
      canCreateRequests: true,
      banner: null,
    };
  }

  if (FINANCIAL_ROLES.has(normalizedRole)) {
    return {
      scope: "financial",
      normalizedRole,
      canEditProfile: false,
      canViewProfile: false,
      canViewComments: false,
      canCreateRequests: false,
      banner:
        "Vista limitada a la revision de validaciones financieras y a los documentos financieros visibles dentro del expediente laboral.",
    };
  }

  if (TI_ROLES.has(normalizedRole)) {
    return {
      scope: "ti",
      normalizedRole,
      canEditProfile: false,
      canViewProfile: false,
      canViewComments: false,
      canCreateRequests: false,
      banner:
        "Vista limitada al control de herramientas de comunicacion, accesos, actas tecnologicas y checklist operativo asignado al area de TI.",
    };
  }

  if (LOGISTICS_ROLES.has(normalizedRole)) {
    return {
      scope: "logistics",
      normalizedRole,
      canEditProfile: false,
      canViewProfile: false,
      canViewComments: false,
      canCreateRequests: false,
      banner:
        "Vista limitada al control de herramientas de trabajo, logistica, ropa de trabajo, EPP y validaciones operativas asignadas a esta area.",
    };
  }

  return {
    scope: "restricted",
    normalizedRole,
    canEditProfile: false,
    canViewProfile: false,
    canViewComments: false,
    canCreateRequests: false,
    banner: "Vista limitada a funciones especificas del expediente laboral segun los permisos del area asignada.",
  };
};

export const filterDocumentDefinitionsByAccess = (definitions = [], access) => {
  if (access?.scope === "full") return definitions;
  if (access?.scope === "financial") {
    return definitions.filter((definition) =>
      FINANCIAL_DOCUMENT_CODES.has(String(definition?.key || "").trim().toUpperCase()),
    );
  }
  if (access?.scope === "ti") {
    return definitions.filter((definition) =>
      TI_DOCUMENT_CODES.has(String(definition?.key || "").trim().toUpperCase()),
    );
  }
  if (access?.scope === "logistics") {
    return definitions.filter((definition) =>
      LOGISTICS_DOCUMENT_CODES.has(String(definition?.key || "").trim().toUpperCase()),
    );
  }
  return [];
};

export const canUploadDocumentInAccess = (definition, access) => {
  if (String(definition?.ownerArea || "").trim().toLowerCase() === "automatico") {
    return false;
  }
  if (access?.scope === "full") return true;
  if (access?.scope === "financial") {
    return FINANCIAL_DOCUMENT_CODES.has(String(definition?.key || "").trim().toUpperCase());
  }
  return false;
};

const hasAnyVisibleItem = (items = []) => Array.isArray(items) && items.length > 0;

export const filterChecklistSectionsByAccess = (
  sections = [],
  access,
) => {
  if (access?.scope === "full") return sections;

  const allowedFlags =
    access?.scope === "financial"
      ? FINANCIAL_FLAG_KEYS
      : access?.scope === "ti"
        ? TI_FLAG_KEYS
        : access?.scope === "logistics"
          ? LOGISTICS_FLAG_KEYS
          : new Set();

  const allowedDocs =
    access?.scope === "financial"
      ? FINANCIAL_DOCUMENT_CODES
      : access?.scope === "ti"
        ? TI_DOCUMENT_CODES
        : access?.scope === "logistics"
          ? LOGISTICS_DOCUMENT_CODES
          : new Set();

  return sections
    .map((section) => {
      const visibleItems = (section?.items || []).filter((item) => {
        if (item?.type === "doc") {
          return allowedDocs.has(String(item?.docType || "").trim().toUpperCase());
        }
        return allowedFlags.has(String(item?.flagKey || "").trim());
      });

      return hasAnyVisibleItem(visibleItems)
        ? { ...section, items: visibleItems }
        : null;
    })
    .filter(Boolean);
};

export const computeChecklistCompletionBySections = (
  sections = [],
  profileData = {},
  documents = [],
  resolveDocumentType,
) => {
  const types = new Set(
    (documents || []).map((document) =>
      typeof resolveDocumentType === "function"
        ? resolveDocumentType(document)
        : String(document?.canonical_doc_type || document?.doc_type || "").trim().toUpperCase(),
    ),
  );

  let total = 0;
  let done = 0;

  (sections || []).forEach((section) => {
    (section?.items || []).forEach((item) => {
      total += 1;
      if (item?.type === "doc") {
        if (types.has(String(item?.docType || "").trim().toUpperCase())) done += 1;
      } else if (profileData?.onboarding?.[item?.flagKey]) {
        done += 1;
      }
    });
  });

  return {
    total,
    done,
    complete: total > 0 && done === total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
};
