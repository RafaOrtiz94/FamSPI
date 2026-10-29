/**
 * Motor puro de reglas de consumibles.
 *
 * Los adaptadores se seleccionan por coincidencia exacta. No existe fallback
 * entre familias, equipos o tipos de producto. Los adaptadores registrados
 * viven en consumableRuleAdapters.js: agregar uno exige una formula y evidencia
 * previamente validadas, y debe declarar su fuente.
 */

const { RULE_ADAPTERS } = require("./consumableRuleAdapters");
const { evaluateOfficialDocument } = require("./consumableDocumentRule");

const REASON_MESSAGES = Object.freeze({
  PRODUCT_CODE_MISSING: "El producto no tiene un codigo de proveedor verificable.",
  SPEC_NOT_FOUND: "No existe una ficha tecnica vigente para el producto.",
  PROCESS_DURATION_MISSING: "El Business Case no tiene una duracion de proceso positiva.",
  RULE_ADAPTER_NOT_REGISTERED: "No existe una regla validada para esta familia, equipo y tipo de producto.",
});

function cleanSelectorValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function buildSelector(identity = {}) {
  return Object.freeze({
    family: cleanSelectorValue(identity.family),
    equipmentCode: cleanSelectorValue(identity.equipmentCode),
    equipmentName: cleanSelectorValue(identity.equipmentName),
    itemType: cleanSelectorValue(identity.itemType),
  });
}

function selectorMatches(adapterSelector, selector) {
  if (!adapterSelector || typeof adapterSelector !== "object") return false;
  return ["family", "equipmentCode", "equipmentName", "itemType"]
    .every((field) => cleanSelectorValue(adapterSelector[field]) === selector[field]);
}

function findExactAdapter(selector, adapters = RULE_ADAPTERS) {
  return (Array.isArray(adapters) ? adapters : [])
    .find((adapter) => selectorMatches(adapter?.selector, selector)) || null;
}

function reason(code, details = {}) {
  return {
    code,
    message: REASON_MESSAGES[code] || "No existe una regla calculable para el producto.",
    ...details,
  };
}

function evaluateConsumableRule(context, { adapters = RULE_ADAPTERS } = {}) {
  const selector = buildSelector(context?.identity);
  const reasons = [];
  const adapter = findExactAdapter(selector, adapters);
  if (!context?.identity?.supplierCode) reasons.push(reason("PRODUCT_CODE_MISSING"));
  // Un adaptador cuyos parametros vienen de otra fuente auditada lo declara con requiresSpec:false.
  if (!context?.spec && adapter?.requiresSpec !== false) reasons.push(reason("SPEC_NOT_FOUND"));
  if (!(Number(context?.processDurationMonths) > 0)) reasons.push(reason("PROCESS_DURATION_MISSING"));
  if (!adapter) reasons.push(reason("RULE_ADAPTER_NOT_REGISTERED", { selector }));

  if (reasons.length) {
    return {
      status: "no_rule",
      reason: reasons[0],
      reasons,
      quantity: null,
      unit: null,
      formula: null,
      rule: null,
      verified: false,
    };
  }

  const result = adapter.calculate(context) || {};
  const rule = {
    id: adapter.id,
    version: adapter.version,
    selector,
    source: adapter.source || null,
  };
  // El adaptador puede declarar que no tiene base para este producto: sigue sin fabricar cantidad.
  if (result.status === "no_rule") {
    const fallbackReason = reason("RULE_NOT_APPLICABLE");
    return {
      status: "no_rule",
      reason: result.reason || fallbackReason,
      reasons: result.reasons || [result.reason || fallbackReason],
      quantity: null,
      unit: null,
      formula: null,
      rule,
      verified: false,
    };
  }
  // Verificado solo si el adaptador no lo niega y su base esta verificada: la ficha del producto,
  // o -cuando no usa ficha- lo que el propio adaptador declare.
  const specVerified = context.spec?.verification_status === "verified";
  const baseVerified = adapter.requiresSpec === false ? result.verified === true : specVerified;
  return {
    ...result,
    status: result.status || "calculated",
    rule,
    verified: baseVerified && result.verified !== false,
  };
}

const SOURCE_LABELS = Object.freeze({
  audited_formula: "Formula validada",
  official_document: "Documento oficial del producto",
});

function compareSources(auditedFormula, officialDocument) {
  const a = auditedFormula.status === "calculated" ? auditedFormula.quantity : null;
  const b = officialDocument.status === "calculated" ? officialDocument.quantity : null;
  if (a === null && b === null) return { status: "none", difference: null };
  if (a === null || b === null) return { status: "single_source", difference: null };
  return { status: a === b ? "match" : "differs", difference: b - a };
}

/**
 * Cada producto se calcula con dos fuentes independientes:
 *   - audited_formula:   la formula validada (adaptador exacto por familia/equipo/tipo);
 *   - official_document: la ficha tecnica vigente del fabricante.
 * La cantidad principal es la de la formula validada cuando existe; si no, la del documento.
 * Los campos de primer nivel son los de la fuente principal; `sources` conserva ambas.
 */
function evaluateConsumableSources(context, options = {}) {
  const auditedFormula = { source: "audited_formula", label: SOURCE_LABELS.audited_formula, ...evaluateConsumableRule(context, options) };
  const officialDocument = { source: "official_document", label: SOURCE_LABELS.official_document, ...evaluateOfficialDocument(context) };
  const primary = auditedFormula.status === "calculated" || officialDocument.status !== "calculated"
    ? auditedFormula
    : officialDocument;
  // Sin ninguna fuente calculable, el motivo mas util es el del documento si el equipo no tiene formula.
  const fallbackReason = auditedFormula.reason?.code === "RULE_ADAPTER_NOT_REGISTERED" && officialDocument.reason
    ? officialDocument
    : auditedFormula;
  const top = primary.status === "calculated" ? primary : { ...primary, reason: fallbackReason.reason, reasons: fallbackReason.reasons };
  return {
    ...top,
    primarySource: primary.status === "calculated" ? primary.source : null,
    agreement: compareSources(auditedFormula, officialDocument),
    sources: { auditedFormula, officialDocument },
  };
}

module.exports = {
  evaluateConsumableSources,
  compareSources,
  RULE_ADAPTERS,
  buildSelector,
  selectorMatches,
  findExactAdapter,
  evaluateConsumableRule,
};
