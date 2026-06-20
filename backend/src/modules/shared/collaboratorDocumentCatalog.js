const COLLABORATOR_DOCUMENT_CATALOG = [
  {
    code: "IDENTITY_DOCUMENT",
    label: "Documento de Identidad",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: true,
    aliases: ["CEDULA_COLOR"],
  },
  {
    code: "PASSPORT",
    label: "Pasaporte (cuando aplique)",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: false,
    aliases: ["PASAPORTE_NOTARIADO", "PASAPORTE_COLOR"],
  },
  {
    code: "VOTING_CERTIFICATE",
    label: "Certificado de votacion",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: true,
    aliases: ["CERTIFICADO_VOTACION_COLOR"],
  },
  {
    code: "UTILITY_BILL",
    label: "Servicio basico domicilio",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: true,
    aliases: ["SERVICIO_BASICO"],
  },
  {
    code: "MARRIAGE_CERTIFICATE",
    label: "Acta de matrimonio",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: false,
    aliases: ["ACTA_MATRIMONIO"],
  },
  {
    code: "CHILD_BIRTH_CERTIFICATE",
    label: "Partida de nacimiento (hijos)",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: false,
    aliases: ["CERTIFICADO_NACIMIENTO_HIJOS"],
  },
  {
    code: "SENESCYT_RECORD",
    label: "Registro SENESCYT",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: false,
    aliases: [],
  },
  {
    code: "LABOR_CERTIFICATE",
    label: "Certificados laborales",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["CERTIFICADO_TRABAJO_ANTERIOR"],
  },
  {
    code: "CONTRACT_FAM",
    label: "Contrato FAM",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["CONTRATO_TRABAJO"],
  },
  {
    code: "CONTRACT_MDT",
    label: "Contrato MDT",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: [],
  },
  {
    code: "IESS_ENTRY_NOTICE",
    label: "IESS, aviso de entrada",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["INGRESO_IESS"],
  },
  {
    code: "PERSONNEL_ACTION",
    label: "Accion del personal",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: [],
  },
  {
    code: "INDUCTION_REGISTRY",
    label: "Registro de induccion",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["CRONOGRAMA_INDUCCION"],
  },
  {
    code: "SIGNATURE_CONTROL",
    label: "Control de firmas",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["REGISTRO_FIRMAS"],
  },
  {
    code: "CONFIDENTIALITY_AGREEMENT",
    label: "Convenio de confidencialidad",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["CONVENIO_CONFIDENCIALIDAD"],
  },
  {
    code: "LOPDP_CONSENT",
    label: "Consentimiento LOPDP",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["ALCANCE_LOPDP"],
  },
  {
    code: "IMAGE_USE_AUTHORIZATION",
    label: "Autorizacion de uso de imagen",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: [],
  },
  {
    code: "PAYROLL_DISCOUNT_AUTHORIZATION",
    label: "Autorizacion de descuentos en roles",
    ownerArea: "financiero",
    sourceChannel: "financiero",
    required: true,
    aliases: ["AUTORIZACION_DESCUENTOS"],
  },
  {
    code: "TENTH_ACCUMULATION_FORM",
    label: "Acumulacion / Mensualizacion decimos y fondos de reserva",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["FORMATO_DECIMOS"],
  },
  {
    code: "HR_RESUME",
    label: "Hoja de vida",
    ownerArea: "talento_humano",
    sourceChannel: "talento_humano",
    required: true,
    aliases: ["HOJA_VIDA"],
  },
  {
    code: "CURRICULUM_VITAE",
    label: "Curriculum vitae",
    ownerArea: "profile",
    sourceChannel: "profile",
    required: true,
    aliases: [],
  },
  {
    code: "DELIVERY_COMMUNICATION_TOOLS",
    label: "Acta de entrega de herramientas de comunicacion",
    ownerArea: "automatico",
    sourceChannel: "integracion",
    required: false,
    aliases: [],
  },
  {
    code: "DELIVERY_LOGISTICS_TOOLS",
    label: "Acta de entrega de herramientas de logistica",
    ownerArea: "automatico",
    sourceChannel: "integracion",
    required: false,
    aliases: [],
  },
  {
    code: "DELIVERY_WORK_TOOLS",
    label: "Acta de entrega de herramientas de trabajo",
    ownerArea: "automatico",
    sourceChannel: "integracion",
    required: false,
    aliases: ["ACTA_BIENES"],
  },
  {
    code: "DELIVERY_WORK_CLOTHES",
    label: "Acta de entrega de ropa de trabajo",
    ownerArea: "automatico",
    sourceChannel: "integracion",
    required: false,
    aliases: [],
  },
  {
    code: "DELIVERY_EPP",
    label: "Acta de entrega de EPP",
    ownerArea: "automatico",
    sourceChannel: "integracion",
    required: false,
    aliases: [],
  },
];

const DOCUMENT_CODE_INDEX = new Map();
const DOCUMENT_ALIAS_INDEX = new Map();

const canonicalizeDocumentTypeKey = (docType) =>
  String(docType || "").trim().toUpperCase();

COLLABORATOR_DOCUMENT_CATALOG.forEach((definition) => {
  const canonicalCode = canonicalizeDocumentTypeKey(definition.code);
  DOCUMENT_CODE_INDEX.set(canonicalCode, definition);
  DOCUMENT_ALIAS_INDEX.set(canonicalCode, definition.code);
  (definition.aliases || []).forEach((alias) => {
    const canonicalAlias = canonicalizeDocumentTypeKey(alias);
    if (canonicalAlias) {
      DOCUMENT_ALIAS_INDEX.set(canonicalAlias, definition.code);
    }
  });
});

const normalizeCollaboratorDocumentType = (docType) => {
  const normalized = canonicalizeDocumentTypeKey(docType);
  if (!normalized) return null;
  return DOCUMENT_ALIAS_INDEX.get(normalized) || normalized;
};

const getCollaboratorDocumentDefinition = (docType) => {
  const canonicalType = normalizeCollaboratorDocumentType(docType);
  return canonicalType ? DOCUMENT_CODE_INDEX.get(canonicalType) || null : null;
};

const getRequiredCollaboratorDocumentCodes = () =>
  COLLABORATOR_DOCUMENT_CATALOG.filter((document) => document.required).map(
    (document) => document.code,
  );

const isProfileOwnedCollaboratorDocumentType = (docType) => {
  const definition = getCollaboratorDocumentDefinition(docType);
  return definition?.ownerArea === "profile";
};

module.exports = {
  COLLABORATOR_DOCUMENT_CATALOG,
  getCollaboratorDocumentDefinition,
  getRequiredCollaboratorDocumentCodes,
  isProfileOwnedCollaboratorDocumentType,
  normalizeCollaboratorDocumentType,
};
