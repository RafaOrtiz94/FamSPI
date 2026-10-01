const db = require("../../config/db");
const matrixCalculationService = require("./matrixBusinessCaseCalculation.service");
const registry = require("./matrixCalculationPackages.registry");
const businessCaseOfferService = require("./businessCaseOffer.service");
const sheetReader = require("./businessCaseSheetSyncLocal.service");
const predictiveLabService = require("./businessCasePredictiveLab.service");

const MATRIX_VERSION = "2024-12-06.1";

const DEMAND_PRODUCT_IDS = Object.freeze({
  xp300: Object.freeze({ annualDemand: "3145611001" }),
  xn: Object.freeze({
    annualDemand: "6510167001",
    reticulocyteDemand: "6510272001",
    fluidDemand: "7051409001",
    plateletDemand: "6510299001",
  }),
});

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveModality(contractObject) {
  const normalized = normalizeText(contractObject);
  if (!normalized) return null;
  const effective = /determinacion(?:es)? efectiva(?:s)?/.test(normalized);
  const matches = [
    normalized.includes("todo comprado") ? "todo_comprado" : null,
    effective ? "prueba_efectiva" : null,
    !effective && normalized.includes("determinacion") ? "determinacion" : null,
  ].filter(Boolean);
  return matches.length === 1 ? matches[0] : null;
}

function resolveMatrixEquipment(equipmentName) {
  const normalized = normalizeText(equipmentName);
  if (/\bxp\s*300\b/.test(normalized)) return "XP-300";

  const xnlMatch = normalized.match(/\bxnl\s*(350|450|550)\b/);
  if (xnlMatch) {
    const withoutLicense = normalized.includes("sin licencias");
    const withLicense = normalized.includes("con licencias");
    if (withoutLicense === withLicense) return null;
    if (withoutLicense) return `XNL-${xnlMatch[1]} SIN LICENCIAS`;
    if (withLicense) return `XNL-${xnlMatch[1]} CON LICENCIAS`;
    return null;
  }

  if (/\bxn\s*1000\b/.test(normalized)) {
    const withoutLicense = normalized.includes("sin licencias");
    const withLicense = normalized.includes("con licencias");
    if (withoutLicense === withLicense) return null;
    if (withoutLicense) return "XN-1000 SIN LICENCIAS";
    if (withLicense) return "XN-1000 CON LICENCIAS";
  }
  return null;
}

function resolveFamily(category) {
  const normalized = normalizeText(category);
  if (normalized === "hematology" || normalized === "hematologia") return "hematologia";
  if (["chemistry", "immunology", "quimica", "inmunologia"].includes(normalized)) {
    return "inmuno_quimica";
  }
  return null;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateProcessDepreciation({ unitPrice, percentage, projectedMonths }) {
  const base = toFiniteNumber(unitPrice);
  if (base === null) return null;
  const rate = toFiniteNumber(percentage);
  const months = toFiniteNumber(projectedMonths);
  const safeRate = rate === null || rate < 0 ? 0 : rate;
  const safeMonths = months === null || months <= 0 ? 0 : months;
  return Number((((base * (safeRate / 100)) / 12) * safeMonths).toFixed(2));
}

function calculateAdditionalInvestmentsSubtotal(investments, projectedMonths) {
  const rows = Array.isArray(investments) ? investments : [];
  const warnings = [];
  let subtotal = 0;

  rows.filter((row) => row.selected === true).forEach((row) => {
    const quantity = toFiniteNumber(row.quantity) ?? 0;
    const price = row.unit_price_financial ?? row.unit_price;
    const depreciated = calculateProcessDepreciation({
      unitPrice: price,
      percentage: row.depreciation_percentage,
      projectedMonths,
    });
    if (quantity > 0 && depreciated === null) {
      warnings.push({
        code: "INVESTMENT_PRICE_MISSING",
        message: `La inversion ${row.name || row.catalog_id} no tiene precio utilizable.`,
      });
      return;
    }
    subtotal += quantity * (depreciated ?? 0);
  });

  return { subtotal: Number(subtotal.toFixed(2)), warnings };
}

function demandValueForProduct(items, productId) {
  const matches = (Array.isArray(items) ? items : [])
    .filter((item) => String(item.item_id || "").trim() === String(productId))
    .map((item) => ({
      itemKey: item.item_key,
      name: item.name,
      value: toFiniteNumber(item.annual_qty),
    }));
  const positives = matches.filter((entry) => entry.value !== null && entry.value > 0);
  return {
    value: positives.length ? Math.max(...positives.map((entry) => entry.value)) : 0,
    sources: matches,
    hasConflictingValues: new Set(positives.map((entry) => entry.value)).size > 1,
  };
}

function derivePackageInputs({ packageDefinition, equipment, items, requirements, investments }) {
  const isXp300 = packageDefinition.scope.equipment === "XP-300";
  const demandIds = isXp300 ? DEMAND_PRODUCT_IDS.xp300 : DEMAND_PRODUCT_IDS.xn;
  const projectedMonths = toFiniteNumber(requirements?.projected_deadline_months);
  const equipmentCount = toFiniteNumber(equipment.quantity);
  const investmentResult = calculateAdditionalInvestmentsSubtotal(investments, projectedMonths);
  const inputs = {};
  const evidence = {};
  const blockers = [...investmentResult.warnings];
  const warnings = [];

  Object.keys(packageDefinition.inputs).forEach((inputName) => {
    if (Object.prototype.hasOwnProperty.call(demandIds, inputName)) {
      const demand = demandValueForProduct(items, demandIds[inputName]);
      inputs[inputName] = demand.value;
      evidence[inputName] = {
        source: "bc_consumption_items.annual_qty",
        productId: demandIds[inputName],
        rows: demand.sources,
      };
      if (demand.hasConflictingValues) {
        blockers.push({
          code: "DEMAND_VALUES_CONFLICT",
          input: inputName,
          message: `Existen valores positivos distintos para ${inputName}; no se elegira uno automaticamente.`,
        });
      }
      if (inputName === "annualDemand" && demand.value <= 0) {
        blockers.push({
          code: "ANNUAL_DEMAND_MISSING",
          input: inputName,
          message: `Falta DET/AÑO PROCESO para el producto ancla ${demandIds[inputName]}.`,
        });
      }
      return;
    }

    if (inputName === "contractMonths") {
      inputs[inputName] = projectedMonths;
      evidence[inputName] = {
        source: "bc_requirements.projected_deadline_months",
        value: projectedMonths,
      };
      if (projectedMonths === null || projectedMonths <= 0) {
        blockers.push({
          code: "CONTRACT_MONTHS_MISSING",
          input: inputName,
          message: "Falta la proyeccion de plazo del Business Case.",
        });
      }
      return;
    }

    if (inputName === "equipmentCount") {
      inputs[inputName] = equipmentCount;
      evidence[inputName] = {
        source: "bc_equipment_selection.quantity",
        value: equipmentCount,
      };
      if (equipmentCount === null || equipmentCount <= 0) {
        blockers.push({
          code: "EQUIPMENT_COUNT_MISSING",
          input: inputName,
          message: "Falta una cantidad positiva para el equipo seleccionado.",
        });
      }
      return;
    }

    if (inputName === "additionalInvestmentsSubtotal") {
      inputs[inputName] = investmentResult.subtotal;
      evidence[inputName] = {
        source: "bc_investment_selections",
        value: investmentResult.subtotal,
        rule: "cantidad * depreciacion_del_proceso",
      };
    }
  });

  return { inputs, evidence, blockers, warnings };
}

function serializeNumber(value) {
  const parsed = toFiniteNumber(value);
  return parsed === null ? null : parsed;
}

function annualQuantitySourceForType(itemType) {
  const normalized = normalizeText(itemType).replace(/ /g, "_");
  if (["reactivo", "determinacion"].includes(normalized)) return "DET/AÑO PROCESO";
  if (["control", "calibrador", "consumible", "material"].includes(normalized)) {
    return "PRODUCTO CALCULADO (o PRODUCTO A ENTREGAR/ENVIAR cuando la pestaña no tiene esa columna)";
  }
  return "FUENTE NO CLASIFICADA";
}

function extractProcessPrices(values = {}) {
  const get = (key) => serializeNumber(values[key]);
  return {
    base: get("process.baseUnitValue"),
    commercial: get("process.valueWithMargin"),
    initialTotal: get("process.initialValue"),
    finalTotal: get("process.finalValue"),
    completeBase: get("process.completeUnitValue"),
    completeCommercial: get("process.completeWithMargin"),
    completeInitialTotal: get("process.completeInitialValue"),
    completeFinalTotal: get("process.completeFinalValue"),
    basicBase: get("process.basicUnitValue"),
    basicCommercial: get("process.basicWithMargin"),
    basicInitialTotal: get("process.basicInitialValue"),
    basicFinalTotal: get("process.basicFinalValue"),
    allPurchasedUnit: get("process.allPurchasedUnitValue"),
  };
}

function extractCalculatedItems(calculation, consumptionItems) {
  const grouped = new Map();
  calculation.trace
    .filter((entry) => entry.identity?.kind === "item")
    .forEach((entry) => {
      const identity = entry.identity;
      const key = `${identity.productId}::${identity.occurrence || 1}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          productId: identity.productId,
          productName: identity.productName,
          section: identity.section || null,
          occurrence: identity.occurrence || 1,
          configuration: identity.configuration,
          sourceCells: [],
          values: {},
        });
      }
      const row = grouped.get(key);
      const suffix = entry.ruleId.split(".").pop();
      row.values[suffix] = serializeNumber(entry.value);
      row.sourceCells.push(`${entry.source.sheet}!${entry.source.cell}`);
    });

  return [...grouped.values()].map((row) => {
    const matches = (consumptionItems || []).filter(
      (item) => String(item.item_id || "").trim() === String(row.productId),
    );
    const testsPerKit = row.values.testsPerKit;
    const kitPrice = row.values.allPurchasedPvp;
    return {
      ...row,
      testsPerKit,
      calculatedQuantity: row.values.roundedDeliverable ?? row.values.deliverableQuantity ?? null,
      proposedKitPrice: kitPrice ?? null,
      proposedDeterminationPrice:
        kitPrice !== null && kitPrice !== undefined
          && testsPerKit !== null && testsPerKit !== undefined && testsPerKit > 0
          ? Number((kitPrice / testsPerKit).toFixed(8))
          : null,
      sheetRows: matches.map((item) => ({
        itemKey: item.item_key,
        itemType: item.item_type,
        annualQuantitySource: annualQuantitySourceForType(item.item_type),
        annualQty: serializeNumber(item.annual_qty),
        plannedQty: serializeNumber(item.planned_qty),
      })),
    };
  });
}

function getOfferColumnRules(contractObject) {
  const getVisibility = businessCaseOfferService.__testables?.getOfferPriceColumnVisibility;
  if (typeof getVisibility !== "function") {
    const error = new Error("No se pudo leer la regla vigente de columnas de la oferta.");
    error.code = "OFFER_COLUMN_RULE_UNAVAILABLE";
    throw error;
  }
  return Object.fromEntries(
    ["reactivo", "calibrador", "control", "consumible", "electrolito"]
      .map((section) => [section, getVisibility(section, contractObject)]),
  );
}

async function loadPricingContext(businessCaseId) {
  const { rows: contextRows } = await db.query(
    `SELECT vc.business_case_id AS id, vc.client_name, vc.contract_object,
            vc.modern_bc_metadata
       FROM v_business_cases_complete vc
      WHERE vc.business_case_id = $1
      LIMIT 1`,
    [businessCaseId],
  );
  if (!contextRows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    error.code = "BUSINESS_CASE_NOT_FOUND";
    throw error;
  }

  const [equipmentResult, requirementsResult, consumptionResult, investmentsResult, catalogResult] = await Promise.all([
    db.query(
      `SELECT s.equipment_id, s.quantity, s.is_primary,
              e.equipment_name, e.equipment_code, e.category
         FROM bc_equipment_selection s
         JOIN v_equipment_full_catalog e ON e.equipment_id = s.equipment_id
        WHERE s.business_case_id = $1
        ORDER BY s.is_primary DESC, s.id`,
      [businessCaseId],
    ),
    db.query(
      `SELECT deadline_months, projected_deadline_months
         FROM bc_requirements
        WHERE business_case_id = $1
        LIMIT 1`,
      [businessCaseId],
    ),
    db.query(
      `SELECT item_key, item_id, name, item_type, annual_qty, reference_qty,
              planned_qty, equipment_id, equipment_name
         FROM bc_consumption_items
        WHERE business_case_id = $1
        ORDER BY COALESCE(equipment_name, ''), item_key`,
      [businessCaseId],
    ),
    db.query(
      `SELECT s.catalog_id, s.selected, s.quantity, s.unit_price,
              s.unit_price_financial, s.depreciation_percentage, c.name
         FROM bc_investment_selections s
         JOIN bc_investment_catalog c ON c.id = s.catalog_id
        WHERE s.business_case_id = $1
          AND s.selected = true
        ORDER BY c.display_order NULLS LAST, c.name`,
      [businessCaseId],
    ),
    db.query(
      `SELECT ec.equipment_id, c.id AS catalog_id, c.supplier_code AS item_id,
              c.name, c.type AS item_type, e.equipment_name,
              c.units_per_kit, c.yield_per_unit, c.performance, c.metadata,
              c.supplier, c.status AS catalog_status, c.version AS catalog_version,
              ec.determination_id, ec.consumption_rate
         FROM bc_equipment_selection s
         JOIN v_equipment_full_catalog e ON e.equipment_id = s.equipment_id
         JOIN catalog_equipment_consumables ec ON ec.equipment_id = s.equipment_id
         JOIN catalog_consumables c ON c.id = ec.consumable_id
        WHERE s.business_case_id = $1`,
      [businessCaseId],
    ),
  ]);

  return {
    context: contextRows[0],
    equipment: equipmentResult.rows,
    requirements: requirementsResult.rows[0] || null,
    consumptions: consumptionResult.rows,
    investments: investmentsResult.rows,
    catalogItems: catalogResult.rows.map((row) => ({
      ...row,
      item_key: `cons:${row.equipment_id}:${row.catalog_id}`,
    })),
  };
}

async function readSheetQuantitiesForPreview(data) {
  const metadata = data.context.modern_bc_metadata && typeof data.context.modern_bc_metadata === "object"
    ? data.context.modern_bc_metadata
    : {};
  const sheetId = metadata?.bc_sheet_generation?.last?.sheet_id || null;
  if (!sheetId) {
    const error = new Error("Este Business Case no tiene una hoja de Sheets generada todavia.");
    error.code = "SHEET_NOT_GENERATED";
    throw error;
  }

  const itemsByKey = new Map();
  [...data.catalogItems, ...data.consumptions].forEach((item) => {
    const itemKey = String(item.item_key || "").trim();
    if (!itemKey) return;
    itemsByKey.set(itemKey, {
      ...itemsByKey.get(itemKey),
      ...item,
      item_key: itemKey,
      item_name: item.name || item.item_name || null,
    });
  });
  const syncItems = [...itemsByKey.values()];
  const equipmentTabs = sheetReader.buildSheetPayloads({
    template: sheetReader.loadTemplateDefinition(),
    equipmentRecords: data.equipment.map((equipment) => ({
      id: equipment.equipment_id,
      name: equipment.equipment_name,
      code: equipment.equipment_code,
      model: equipment.equipment_name,
    })),
    payload: { fields: {}, sync_items: syncItems, sheet_context: {} },
  });
  const [annualUpdates, plannedUpdates] = await Promise.all([
    sheetReader.pullAnnualQuantitiesFromGoogleSheet({ sheetId, equipmentTabs }),
    sheetReader.pullMaximumQuantitiesFromGoogleSheet({ sheetId, equipmentTabs }),
  ]);
  const annualByKey = new Map(annualUpdates.map((entry) => [entry.item_key, entry.annual_qty]));
  const plannedByKey = new Map(plannedUpdates.map((entry) => [entry.item_key, entry.planned_qty]));
  const existingByKey = new Map(data.consumptions.map((item) => [item.item_key, item]));
  const touchedKeys = new Set([...annualByKey.keys(), ...plannedByKey.keys()]);

  touchedKeys.forEach((itemKey) => {
    const source = existingByKey.get(itemKey) || itemsByKey.get(itemKey);
    if (!source) return;
    existingByKey.set(itemKey, {
      ...source,
      item_key: itemKey,
      annual_qty: annualByKey.has(itemKey) ? annualByKey.get(itemKey) : source.annual_qty,
      planned_qty: plannedByKey.has(itemKey) ? plannedByKey.get(itemKey) : source.planned_qty,
    });
  });

  return {
    consumptions: [...existingByKey.values()],
    sheetRead: {
      requested: true,
      ok: true,
      readOnly: true,
      annualValuesRead: annualUpdates.length,
      plannedValuesRead: plannedUpdates.length,
    },
  };
}

function blockedEquipmentResult(equipment, scope, error, extra = {}) {
  return {
    equipmentId: Number(equipment.equipment_id),
    equipmentName: equipment.equipment_name,
    equipmentCode: equipment.equipment_code,
    scope,
    status: error?.code === "PACKAGE_QUARANTINED" ? "quarantined" : "unsupported",
    blockers: [{
      code: error?.code || "PACKAGE_NOT_FOUND",
      message: error?.message || "No existe un paquete publicable para este alcance.",
      details: error?.details || null,
    }],
    warnings: extra.warnings || [],
    inputs: extra.inputs || {},
    inputEvidence: extra.evidence || {},
    calculation: null,
  };
}

async function buildPreview(businessCaseId, { refreshFromSheet = false } = {}) {
  const data = await loadPricingContext(businessCaseId);
  let sheetSync = { requested: refreshFromSheet, ok: null, readOnly: true };
  if (refreshFromSheet) {
    try {
      const sheetPreview = await readSheetQuantitiesForPreview(data);
      data.consumptions = sheetPreview.consumptions;
      sheetSync = sheetPreview.sheetRead;
    } catch (error) {
      sheetSync = {
        requested: true,
        ok: false,
        readOnly: true,
        code: error?.code || "SHEET_READ_FAILED",
        message: error?.message || "No se pudo leer el Sheet.",
      };
    }
  }
  const modality = resolveModality(data.context.contract_object);
  const globalBlockers = [];
  if (sheetSync.requested && sheetSync.ok === false) {
    globalBlockers.push({
      code: sheetSync.code || "SHEET_READ_FAILED",
      message: "La lectura del Sheet fallo; el resultado usa datos almacenados y no esta listo para publicarse.",
    });
  }
  if (!modality) {
    globalBlockers.push({
      code: "MODALITY_NOT_RESOLVED",
      message: "El objeto de contratacion no identifica determinacion, determinacion efectiva o todo comprado.",
    });
  }
  if (!data.equipment.length) {
    globalBlockers.push({ code: "EQUIPMENT_NOT_SELECTED", message: "El Business Case no tiene equipos seleccionados." });
  }
  if (data.equipment.length > 1) {
    globalBlockers.push({
      code: "MULTI_EQUIPMENT_ALLOCATION_UNDEFINED",
      message: "Hay mas de un equipo seleccionado y no existe una regla validada para distribuir las inversiones entre configuraciones.",
    });
  }

  const equipmentResults = data.equipment.map((equipment) => {
    const family = resolveFamily(equipment.category);
    const matrixEquipment = resolveMatrixEquipment(equipment.equipment_name);
    const scope = {
      family,
      equipment: matrixEquipment,
      modality,
      version: MATRIX_VERSION,
    };
    if (!family || !matrixEquipment || !modality) {
      return blockedEquipmentResult(equipment, scope, {
        code: !matrixEquipment ? "EQUIPMENT_MAPPING_NOT_FOUND" : "PACKAGE_SELECTOR_INCOMPLETE",
        message: !matrixEquipment
          ? "El equipo real no tiene una equivalencia exacta con una configuracion auditada."
          : "No se puede construir el selector exacto del paquete.",
      });
    }

    let packageDefinition;
    try {
      packageDefinition = registry.getExactPackage(scope);
    } catch (error) {
      return blockedEquipmentResult(equipment, scope, error);
    }

    const equipmentItems = data.consumptions.filter(
      (item) => Number(item.equipment_id) === Number(equipment.equipment_id),
    );
    const derived = derivePackageInputs({
      packageDefinition,
      equipment,
      items: equipmentItems,
      requirements: data.requirements,
      investments: data.investments,
    });
    if (derived.blockers.length) {
      return {
        equipmentId: Number(equipment.equipment_id),
        equipmentName: equipment.equipment_name,
        equipmentCode: equipment.equipment_code,
        scope,
        status: "blocked",
        blockers: derived.blockers,
        warnings: derived.warnings,
        inputs: derived.inputs,
        inputEvidence: derived.evidence,
        calculation: null,
      };
    }

    try {
      const calculation = matrixCalculationService.calculate({ ...scope, inputs: derived.inputs });
      const processPrices = extractProcessPrices(calculation.values);
      const requiresProcessVariant =
        processPrices.completeBase !== null && processPrices.basicBase !== null;
      return {
        equipmentId: Number(equipment.equipment_id),
        equipmentName: equipment.equipment_name,
        equipmentCode: equipment.equipment_code,
        scope,
        status: "calculated",
        blockers: requiresProcessVariant ? [{
          code: "PROCESS_VARIANT_REQUIRED",
          message: "El BC no registra si la oferta usa biometria basica o completa; se muestran ambas sin elegir una.",
        }] : [],
        warnings: derived.warnings,
        inputs: derived.inputs,
        inputEvidence: derived.evidence,
        calculation: {
          packageId: calculation.packageId,
          version: calculation.version,
          sourceSha256: calculation.sourceSha256,
          processPrices,
          items: extractCalculatedItems(calculation, equipmentItems),
          traceCount: calculation.trace.length,
        },
      };
    } catch (error) {
      return blockedEquipmentResult(equipment, scope, error, derived);
    }
  });

  const predictiveByEquipment = await predictiveLabService.buildPredictivePreview({
    businessCaseId,
    equipment: data.equipment,
    consumptions: data.consumptions,
    catalogItems: data.catalogItems,
    deterministicEquipmentResults: equipmentResults,
  });
  equipmentResults.forEach((entry) => {
    entry.predictiveModel = predictiveByEquipment.get(Number(entry.equipmentId)) || null;
  });

  const calculatedCount = equipmentResults.filter((entry) => entry.status === "calculated").length;
  const blockerCount = globalBlockers.length + equipmentResults.reduce(
    (sum, entry) => sum + (entry.blockers?.length || 0),
    0,
  );

  return {
    businessCase: {
      id: data.context.id,
      clientName: data.context.client_name,
      contractObject: data.context.contract_object,
    },
    constructionMode: true,
    offerWriteEnabled: false,
    modality,
    sheetSync,
    offerColumnRules: getOfferColumnRules(data.context.contract_object),
    globalBlockers,
    summary: {
      equipmentCount: data.equipment.length,
      calculatedCount,
      blockedCount: data.equipment.length - calculatedCount,
      blockerCount,
      predictiveTargetAccuracyPercent: 99.9,
      predictiveEligibleCount: equipmentResults.filter(
        (entry) => entry.predictiveModel?.automaticCorrectionEligible === true,
      ).length,
      calculationReady: data.equipment.length > 0 && calculatedCount === data.equipment.length && blockerCount === 0,
    },
    equipment: equipmentResults,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildPreview,
  __testables: {
    normalizeText,
    resolveModality,
    resolveMatrixEquipment,
    resolveFamily,
    calculateProcessDepreciation,
    calculateAdditionalInvestmentsSubtotal,
    demandValueForProduct,
    derivePackageInputs,
    extractProcessPrices,
    extractCalculatedItems,
    annualQuantitySourceForType,
    readSheetQuantitiesForPreview,
  },
};
