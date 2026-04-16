const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const logger = require("../../config/logger");
const {
  getDocumentTemplateByCode,
  listDocumentTemplateCatalog,
} = require("./documentTemplateRegistry.service");

const CACHE_TTL_MS = Number.parseInt(process.env.DOCUMENT_COMPATIBILITY_CACHE_MS || "300000", 10);
const compatibilityCache = new Map();

const DOCUMENT_FIELD_ALIASES = Object.freeze({
  "F.ST-02": Object.freeze({
    chk_CVITE: ["chk_CVTE"],
    chk_CVTE: ["chk_CVITE"],
    chk_DFD_o: ["chk_DFD_op"],
    chk_DFD_op: ["chk_DFD_o"],
  }),
  "F.ST-09": Object.freeze({
    frima_af_image: ["firma_af_image"],
    firma_af_image: ["frima_af_image"],
    "ANÁLISIS": ["ANALISIS"],
    ANALISIS: ["ANÁLISIS"],
  }),
});

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .trim();

const toUniqueArray = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );

const getFieldAliases = ({ documentCode, fieldName }) => {
  const normalizedCode = String(documentCode || "").trim().toUpperCase();
  const dictionary = DOCUMENT_FIELD_ALIASES[normalizedCode] || {};
  const aliases = dictionary[fieldName] || [];
  return toUniqueArray(aliases);
};

const loadPdfFieldNames = async (templatePath) => {
  if (!templatePath || !fs.existsSync(templatePath)) {
    return {
      ok: false,
      code: "TEMPLATE_NOT_FOUND",
      message: `Template no encontrado en ruta: ${templatePath || "N/A"}`,
      fields: [],
    };
  }

  try {
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const fields = toUniqueArray(form.getFields().map((field) => field.getName()));
    return { ok: true, fields };
  } catch (error) {
    logger.warn({ error, templatePath }, "No se pudo cargar template PDF para validacion");
    return {
      ok: false,
      code: "TEMPLATE_READ_ERROR",
      message: "No se pudo leer o parsear el template PDF",
      fields: [],
    };
  }
};

const compareFieldContracts = ({ documentCode = null, expectedFields = [], actualFields = [] }) => {
  const expected = toUniqueArray(expectedFields);
  const actual = toUniqueArray(actualFields);
  const actualSet = new Set(actual);
  const normalizedActualMap = new Map(actual.map((field) => [normalize(field), field]));

  const missingExact = [];
  const fuzzyMatches = [];
  const aliasMatches = [];
  const consumedActualFields = new Set();
  expected.forEach((field) => {
    if (actualSet.has(field)) {
      consumedActualFields.add(field);
      return;
    }

    const aliases = getFieldAliases({ documentCode, fieldName: field });
    const aliasCandidate = aliases.find((alias) => actualSet.has(alias)) || null;
    if (aliasCandidate) {
      aliasMatches.push({
        expected_field: field,
        template_field: aliasCandidate,
        reason: "field_matched_by_alias",
      });
      consumedActualFields.add(aliasCandidate);
      return;
    }

    const normalizedField = normalize(field);
    const fuzzyCandidate = normalizedActualMap.get(normalizedField) || null;
    if (fuzzyCandidate) {
      fuzzyMatches.push({
        expected_field: field,
        template_field: fuzzyCandidate,
        reason: "name_matches_only_after_normalization",
      });
      consumedActualFields.add(fuzzyCandidate);
      return;
    }
    missingExact.push(field);
  });

  const expectedSet = new Set(expected);
  const unexpectedFields = actual.filter(
    (field) => !expectedSet.has(field) && !consumedActualFields.has(field),
  );
  const expectedNormalized = new Set(expected.map((field) => normalize(field)));
  const suspiciousNearFields = actual
    .filter(
      (field) =>
        !expectedSet.has(field) &&
        !consumedActualFields.has(field) &&
        expectedNormalized.has(normalize(field)),
    )
    .map((field) => ({
      template_field: field,
      possible_expected_field: expected.find((expectedField) => normalize(expectedField) === normalize(field)) || null,
    }));

  return {
    expected_count: expected.length,
    actual_count: actual.length,
    exact_match_count: expected.length - missingExact.length - fuzzyMatches.length - aliasMatches.length,
    alias_match_count: aliasMatches.length,
    missing_exact_fields: missingExact,
    alias_matches: aliasMatches,
    fuzzy_mismatches: fuzzyMatches,
    unexpected_template_fields: unexpectedFields,
    suspicious_near_fields: suspiciousNearFields,
    is_compatible: missingExact.length === 0,
  };
};

const getCacheKey = (documentCode) => String(documentCode || "").trim().toUpperCase();

const getDocumentCompatibility = async (documentCode, { forceRefresh = false } = {}) => {
  const normalizedCode = getCacheKey(documentCode);
  if (!normalizedCode) {
    return {
      ok: false,
      document_code: null,
      is_compatible: false,
      issues: [{ code: "DOCUMENT_CODE_REQUIRED", message: "document_code es obligatorio" }],
    };
  }

  const now = Date.now();
  const cached = compatibilityCache.get(normalizedCode);
  if (!forceRefresh && cached && now - cached.cachedAt <= CACHE_TTL_MS) {
    return cached.data;
  }

  const templateRecord = await getDocumentTemplateByCode(normalizedCode);
  if (!templateRecord) {
    const missingTemplateResult = {
      ok: false,
      document_code: normalizedCode,
      is_compatible: false,
      issues: [{ code: "DOCUMENT_NOT_REGISTERED", message: "El documento no existe en el catalogo" }],
      checked_at: new Date().toISOString(),
    };
    compatibilityCache.set(normalizedCode, { cachedAt: now, data: missingTemplateResult });
    return missingTemplateResult;
  }

  const expectedFields = toUniqueArray(templateRecord.field_dictionary || []);
  const templatePath = templateRecord.template_path || null;
  const readResult = await loadPdfFieldNames(templatePath);

  const issues = [];
  if (!readResult.ok) {
    issues.push({ code: readResult.code, message: readResult.message });
  }

  const contract = compareFieldContracts({
    documentCode: normalizedCode,
    expectedFields,
    actualFields: readResult.fields || [],
  });

  if (contract.missing_exact_fields.length) {
    issues.push({
      code: "MISSING_TEMPLATE_FIELDS",
      message: "Existen campos esperados por el contrato que no estan en el template",
      count: contract.missing_exact_fields.length,
      fields: contract.missing_exact_fields,
    });
  }

  if (contract.fuzzy_mismatches.length) {
    issues.push({
      code: "FUZZY_FIELD_MISMATCHES",
      message: "Existen campos con coincidencia solo por normalizacion (acentos, formato o typo)",
      count: contract.fuzzy_mismatches.length,
      fields: contract.fuzzy_mismatches,
    });
  }

  const compatibilityData = {
    ok: true,
    document_code: normalizedCode,
    document_name: templateRecord.document_name,
    procedure_code: templateRecord.procedure_code,
    version: templateRecord.version,
    template_path: templatePath,
    expected_fields: expectedFields,
    template_fields: readResult.fields || [],
    contract,
    is_compatible: Boolean(readResult.ok) && contract.is_compatible,
    issues,
    checked_at: new Date().toISOString(),
  };

  compatibilityCache.set(normalizedCode, { cachedAt: now, data: compatibilityData });
  return compatibilityData;
};

const listCatalogCompatibility = async ({ includeInactive = false, forceRefresh = false } = {}) => {
  const catalog = await listDocumentTemplateCatalog({ includeInactive });
  const checks = [];
  for (const item of catalog) {
     
    const compatibility = await getDocumentCompatibility(item.document_code, { forceRefresh });
    checks.push({
      document_code: item.document_code,
      document_name: item.document_name,
      procedure_code: item.procedure_code,
      version: item.version,
      is_compatible: compatibility.is_compatible,
      issues: compatibility.issues || [],
      checked_at: compatibility.checked_at,
    });
  }
  return checks;
};

module.exports = {
  getDocumentCompatibility,
  listCatalogCompatibility,
};
