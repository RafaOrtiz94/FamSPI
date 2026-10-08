const db = require("../../config/db");
const {
  normalizeCatalogCode,
  manufacturerKnowledgeFor,
  manufacturerRelationshipsForReactives,
} = require("./businessCaseManufacturerKnowledge.catalog");

const MODEL_VERSION = "hybrid-pro-ultra-0.6.0";
const TARGET_ACCURACY_PERCENT = 99.9;
const MIN_HISTORY_CASES = 5;
const MIN_SUGGESTION_PEERS = 1;
const TARGET_TYPES = new Set(["reactivo", "calibrador", "control", "material"]);
const HISTORICAL_OUTPUT_TYPES = new Set(["calibrador", "control", "material"]);

function normalizeType(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function finiteNonNegative(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function rawProductId(row) {
  const value = String(row?.item_id || row?.productId || "").trim();
  return value || null;
}

function productKey(row) {
  const id = rawProductId(row);
  const type = normalizeType(row?.item_type ?? row?.itemType);
  return id && type ? `${type}::${id}` : null;
}

function rawIdFromProductKey(value) {
  const key = String(value || "");
  const separator = key.indexOf("::");
  return separator >= 0 ? key.slice(separator + 2) : key;
}

function positiveNumber(value) {
  const number = finiteNonNegative(value);
  return number !== null && number > 0 ? number : null;
}

function buildObservedReactiveProfile(peers, targetId) {
  const positivePeers = peers.filter((sample) => (sample.targets.get(targetId)?.quantity || 0) > 0);
  const profile = new Map();
  positivePeers.forEach((sample) => {
    sample.reactives.forEach((demand, reactiveId) => {
      if (demand <= 0) return;
      const current = profile.get(reactiveId) || { support: 0, totalDemand: 0 };
      current.support += 1;
      current.totalDemand += demand;
      profile.set(reactiveId, current);
    });
  });
  return [...profile.entries()]
    .map(([productId, value]) => ({
      productId: rawIdFromProductKey(productId),
      positivePeerSupport: value.support,
      positivePeerCoveragePercent: positivePeers.length
        ? (value.support / positivePeers.length) * 100
        : null,
      averageAnnualDemand: value.support ? value.totalDemand / value.support : null,
    }))
    .sort((left, right) => (
      right.positivePeerSupport - left.positivePeerSupport
      || right.averageAnnualDemand - left.averageAnnualDemand
      || left.productId.localeCompare(right.productId)
    ))
    .slice(0, 10);
}

function buildProductKnowledge(target, formula, peers, targetId) {
  const catalogIds = [...new Set((target.catalogVariants || [])
    .map((value) => Number(value))
    .filter(Number.isFinite))];
  const supplierCode = String(target.productId || "").trim() || null;
  const ambiguousSupplierCode = catalogIds.length > 1;
  const testsPerKit = positiveNumber(
    formula?.testsPerKit
      ?? formula?.values?.testsPerKit
      ?? target.unitsPerKit
      ?? target.yieldPerUnit,
  );
  const stabilityDays = positiveNumber(formula?.values?.stabilityDays ?? target.stabilityDays);
  const determinationId = Number.isFinite(Number(target.determinationId))
    ? Number(target.determinationId)
    : null;
  const metadata = target.metadata && typeof target.metadata === "object"
    ? target.metadata
    : {};
  const performance = target.performance && typeof target.performance === "object"
    ? target.performance
    : {};
  const knownFields = [supplierCode, target.productName, target.itemType, target.equipmentId]
    .filter((value) => value !== null && value !== undefined && value !== "").length;
  const specificationFields = [testsPerKit, stabilityDays, determinationId]
    .filter((value) => value !== null).length;
  const missingFields = [];
  if (!testsPerKit) missingFields.push("tests_per_kit");
  if (!stabilityDays) missingFields.push("stability_days");
  if (!determinationId) missingFields.push("determination_link");
  if (!target.presentation) missingFields.push("presentation");
  const manufacturerEvidence = manufacturerKnowledgeFor({
    productId: supplierCode,
    equipmentName: target.equipmentName,
    formula,
  });

  return {
    identity: {
      catalogId: catalogIds.length === 1 ? catalogIds[0] : null,
      catalogVariants: catalogIds,
      supplierCode,
      status: ambiguousSupplierCode
        ? "ambiguous_supplier_code"
        : catalogIds.length === 1
          ? "verified_catalog"
          : supplierCode
            ? "supplier_code_only"
            : "insufficient",
    },
    classification: {
      itemType: target.itemType,
      equipmentId: target.equipmentId ?? null,
      equipmentName: target.equipmentName || null,
      catalogStatus: target.catalogStatus || null,
      catalogVersion: target.catalogVersion || null,
      supplier: target.supplier || null,
      manufacturerId: metadata.id_fabricante ?? null,
      subcategory: metadata.subcategoria ?? null,
      catalogSource: metadata.source ?? null,
    },
    verifiedSpecifications: {
      testsPerKit,
      stabilityDays,
      consumptionRate: positiveNumber(target.consumptionRate),
      determinationId,
      presentation: target.presentation || null,
      performance,
    },
    observedReactiveProfile: buildObservedReactiveProfile(peers, targetId),
    manufacturerEvidence,
    evidence: {
      sources: [
        catalogIds.length ? "catalog_consumables" : null,
        target.equipmentId ? "catalog_equipment_consumables" : null,
        formula ? "audited_calculation_package" : null,
        peers.length ? "production_business_case_history" : null,
        manufacturerEvidence ? "manufacturer_primary_source" : null,
      ].filter(Boolean),
      knownIdentityAndClassificationFields: knownFields,
      knownSpecificationFields: specificationFields,
      missingFields,
      safeForSimilarity: !ambiguousSupplierCode && Boolean(supplierCode),
      formulaManufacturerStatus: manufacturerEvidence?.formulaComparison?.status || null,
    },
  };
}

function quantile(values, probability) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (position - lower));
}

function median(values) {
  return quantile(values, 0.5);
}

function totalReactiveDemand(sample) {
  return [...sample.reactives.values()].reduce((sum, value) => sum + value, 0);
}

function reactiveDistance(left, right) {
  const keys = new Set([...left.reactives.keys(), ...right.reactives.keys()]);
  if (!keys.size) return Number.POSITIVE_INFINITY;
  let squared = 0;
  keys.forEach((key) => {
    const leftValue = Math.log1p(left.reactives.get(key) || 0);
    const rightValue = Math.log1p(right.reactives.get(key) || 0);
    squared += (leftValue - rightValue) ** 2;
  });
  return Math.sqrt(squared / keys.size);
}

function reactiveDistanceForKeys(left, right, keys) {
  if (!keys.size) return Number.POSITIVE_INFINITY;
  let squared = 0;
  keys.forEach((key) => {
    const leftValue = Math.log1p(left.reactives.get(key) || 0);
    const rightValue = Math.log1p(right.reactives.get(key) || 0);
    squared += (leftValue - rightValue) ** 2;
  });
  return Math.sqrt(squared / keys.size);
}

function reactiveDemandForKeys(sample, keys) {
  return [...keys].reduce((sum, key) => sum + (sample.reactives.get(key) || 0), 0);
}

function hasCompletedOperationalOutcome(row) {
  const status = normalizeType(row?.dispatch_status);
  const dispatchQuantity = finiteNonNegative(row?.ops_dispatch_qty);
  const dispatchedQuantity = finiteNonNegative(row?.ops_dispatched_qty);
  return status === "despachado"
    || (dispatchQuantity > 0 && dispatchedQuantity !== null && dispatchedQuantity >= dispatchQuantity);
}

function buildSamples(rows, { labelMode = "planning_proxy" } = {}) {
  const grouped = new Map();
  (rows || []).forEach((row) => {
    const equipmentId = Number(row.equipment_id);
    const caseId = String(row.business_case_id || "");
    const key = `${caseId}::${equipmentId}`;
    if (!caseId || !Number.isFinite(equipmentId)) return;
    if (!grouped.has(key)) {
      grouped.set(key, {
        caseId,
        equipmentId,
        reactives: new Map(),
        targets: new Map(),
      });
    }
    const sample = grouped.get(key);
    const id = productKey(row);
    const rawId = rawProductId(row);
    if (!id) return;
    const type = normalizeType(row.item_type);
    if (type === "reactivo") {
      const demand = finiteNonNegative(row.annual_qty);
      if (demand !== null) sample.reactives.set(id, demand);
    }
    if (TARGET_TYPES.has(type)) {
      const operational = hasCompletedOperationalOutcome(row);
      if (labelMode === "operational_dispatch" && !operational) return;
      const quantity = labelMode === "operational_dispatch"
        ? finiteNonNegative(row.ops_dispatched_qty)
        : finiteNonNegative(row.planned_qty);
      if (quantity === null) return;
      sample.targets.set(id, {
        productId: rawId,
        identityKey: id,
        productName: row.name || rawId,
        itemType: type,
        quantity,
        labelSource: labelMode === "operational_dispatch"
          ? "bc_dispatch_items.ops_dispatched_qty"
          : "bc_consumption_items.planned_qty",
      });
    }
  });
  return [...grouped.values()].filter((sample) => totalReactiveDemand(sample) > 0);
}

function buildCurrentSample(equipmentId, consumptions) {
  const reactives = new Map();
  (consumptions || []).forEach((row) => {
    if (Number(row.equipment_id) !== Number(equipmentId)) return;
    if (normalizeType(row.item_type) !== "reactivo") return;
    const id = productKey(row);
    const demand = finiteNonNegative(row.annual_qty);
    if (id && demand !== null) reactives.set(id, demand);
  });
  return { caseId: "current", equipmentId: Number(equipmentId), reactives, targets: new Map() };
}

function estimateTarget(current, peers, targetId) {
  const comparable = peers.filter((sample) => sample.targets.has(targetId));
  if (!comparable.length || totalReactiveDemand(current) <= 0) return null;

  const currentTotal = totalReactiveDemand(current);
  const quantities = comparable.map((sample) => sample.targets.get(targetId).quantity);
  const scaled = comparable.map((sample) => {
    const peerTotal = totalReactiveDemand(sample);
    return peerTotal > 0
      ? sample.targets.get(targetId).quantity * (currentTotal / peerTotal)
      : null;
  }).filter(Number.isFinite);
  const ratios = comparable.map((sample) => {
    const peerTotal = totalReactiveDemand(sample);
    return peerTotal > 0 ? sample.targets.get(targetId).quantity / peerTotal : null;
  }).filter(Number.isFinite);
  const nearest = [...comparable]
    .map((sample) => ({ sample, distance: reactiveDistance(current, sample) }))
    .sort((left, right) => left.distance - right.distance)[0];
  const nearestTotal = nearest ? totalReactiveDemand(nearest.sample) : 0;
  const nearestQuantity = nearest ? nearest.sample.targets.get(targetId).quantity : null;
  const nearestScaled = nearest && nearestTotal > 0
    ? nearestQuantity * (currentTotal / nearestTotal)
    : null;
  const relevantReactiveKeys = new Set();
  comparable
    .filter((sample) => sample.targets.get(targetId).quantity > 0)
    .forEach((sample) => sample.reactives.forEach((demand, key) => {
      if (demand > 0) relevantReactiveKeys.add(key);
    }));
  const targetAwareNearest = relevantReactiveKeys.size
    ? [...comparable]
      .map((sample) => ({
        sample,
        distance: reactiveDistanceForKeys(current, sample, relevantReactiveKeys),
      }))
      .sort((left, right) => left.distance - right.distance)[0]
    : null;
  const targetAwareCurrentDemand = reactiveDemandForKeys(current, relevantReactiveKeys);
  const targetAwarePeerDemand = targetAwareNearest
    ? reactiveDemandForKeys(targetAwareNearest.sample, relevantReactiveKeys)
    : 0;
  const targetAwareQuantity = targetAwareNearest
    ? targetAwareNearest.sample.targets.get(targetId).quantity
    : null;
  const targetAwareNearestScaledQuantity = targetAwareCurrentDemand > 0 && targetAwarePeerDemand > 0
    ? targetAwareQuantity * (targetAwareCurrentDemand / targetAwarePeerDemand)
    : null;
  const estimates = [median(quantities), median(ratios) * currentTotal, nearestScaled]
    .filter(Number.isFinite);

  return {
    peerCount: comparable.length,
    medianQuantity: median(quantities),
    ratioScaledQuantity: ratios.length ? median(ratios) * currentTotal : null,
    nearestQuantity,
    nearestScaledQuantity: nearestScaled,
    nearestDistance: nearest?.distance ?? null,
    targetAwareNearestScaledQuantity,
    targetAwareReactiveCount: relevantReactiveKeys.size,
    positivePeerCount: quantities.filter((quantity) => quantity > 0).length,
    ensembleQuantity: median(estimates),
    empiricalRange: {
      p50: quantile(scaled, 0.5),
      p80: quantile(scaled, 0.8),
      p95: quantile(scaled, 0.95),
    },
  };
}

function roundQuantity(value, mode = "ceil") {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, mode === "nearest" ? Math.round(value) : Math.ceil(value));
}

function selectHistoricalPrediction(itemType, estimate) {
  if (!estimate || !HISTORICAL_OUTPUT_TYPES.has(normalizeType(itemType))) return null;
  if (estimate.peerCount < MIN_SUGGESTION_PEERS) return null;
  if (normalizeType(itemType) === "calibrador") {
    return {
      method: "nearest_log_reactive_vector_unscaled",
      quantity: roundQuantity(estimate.nearestQuantity),
    };
  }
  if (normalizeType(itemType) === "control") {
    return {
      method: "target_product_reactive_profile_scaled_rounded",
      quantity: roundQuantity(
        estimate.targetAwareNearestScaledQuantity ?? estimate.nearestScaledQuantity,
        "nearest",
      ),
    };
  }
  return {
    method: "target_product_reactive_profile_scaled",
    quantity: roundQuantity(
      estimate.targetAwareNearestScaledQuantity ?? estimate.nearestScaledQuantity,
    ),
  };
}

function backtest(samples) {
  let actualPositiveTotal = 0;
  let absoluteErrorPositiveTotal = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let toleranceHits = 0;
  let evaluatedRows = 0;
  let availablePredictionRows = 0;
  let positiveTargetRows = 0;
  let exactPositiveRows = 0;
  let folds = 0;

  samples.forEach((holdout) => {
    const peers = samples.filter((sample) => sample.caseId !== holdout.caseId);
    if (!peers.length) return;
    folds += 1;
    holdout.targets.forEach((target, targetId) => {
      if (!HISTORICAL_OUTPUT_TYPES.has(target.itemType)) return;
      const estimated = estimateTarget(holdout, peers, targetId);
      const selectedPrediction = selectHistoricalPrediction(target.itemType, estimated);
      const predicted = selectedPrediction?.quantity ?? 0;
      const actual = target.quantity;
      evaluatedRows += 1;
      if (selectedPrediction) availablePredictionRows += 1;
      if (actual > 0) {
        positiveTargetRows += 1;
        actualPositiveTotal += actual;
        absoluteErrorPositiveTotal += Math.abs(predicted - actual);
        if (predicted === actual) exactPositiveRows += 1;
      }
      if (predicted > 0 && actual > 0) truePositive += 1;
      if (predicted > 0 && actual === 0) falsePositive += 1;
      if (predicted === 0 && actual > 0) falseNegative += 1;
      const tolerance = Math.max(1, actual * 0.001);
      if (Math.abs(predicted - actual) <= tolerance) toleranceHits += 1;
    });
  });

  const wapePositive = actualPositiveTotal > 0
    ? absoluteErrorPositiveTotal / actualPositiveTotal
    : null;
  const precision = truePositive + falsePositive > 0
    ? truePositive / (truePositive + falsePositive)
    : null;
  const recall = truePositive + falseNegative > 0
    ? truePositive / (truePositive + falseNegative)
    : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;

  return {
    method: "leave-one-business-case-out",
    predictor: "type_specific_nearest_neighbor",
    folds,
    evaluatedRows,
    availablePredictionRows,
    positiveTargetRows,
    wapePositive,
    quantityAccuracyPercent: wapePositive === null
      ? null
      : Math.max(0, (1 - wapePositive) * 100),
    predictionCoveragePercent: evaluatedRows > 0
      ? (availablePredictionRows / evaluatedRows) * 100
      : null,
    exactPositivePercent: positiveTargetRows > 0
      ? (exactPositiveRows / positiveTargetRows) * 100
      : null,
    presencePrecisionPercent: precision === null ? null : precision * 100,
    presenceRecallPercent: recall === null ? null : recall * 100,
    presenceF1Percent: f1 === null ? null : f1 * 100,
    withinPointOnePercentOrOneUnit: evaluatedRows > 0
      ? (toleranceHits / evaluatedRows) * 100
      : null,
  };
}

function deterministicMap(equipmentResult) {
  const result = new Map();
  (equipmentResult?.calculation?.items || []).forEach((item) => {
    const id = rawProductId(item);
    const quantity = finiteNonNegative(item.calculatedQuantity);
    if (id && quantity !== null) result.set(id, { ...item, quantity });
  });
  return result;
}

function catalogTargets(equipmentId, catalogItems, consumptions, historicalSamples) {
  const result = new Map();
  const accept = (row) => {
    if (Number(row.equipment_id ?? row.equipmentId) !== Number(equipmentId)) return;
    const type = normalizeType(row.item_type ?? row.itemType);
    const id = productKey(row);
    const rawId = rawProductId(row);
    if (!TARGET_TYPES.has(type) || !id) return;
    const previous = result.get(id);
    const catalogId = Number(row.catalog_id ?? row.catalogId);
    const catalogVariants = new Set(previous?.catalogVariants || []);
    if (Number.isFinite(catalogId)) catalogVariants.add(catalogId);
    result.set(id, {
      ...previous,
      productId: rawId,
      identityKey: id,
      productName: row.name || row.productName || previous?.productName || rawId,
      itemType: type,
      equipmentId: Number(row.equipment_id ?? row.equipmentId),
      equipmentName: row.equipment_name || row.equipmentName || previous?.equipmentName || null,
      unitsPerKit: row.units_per_kit ?? row.unitsPerKit ?? previous?.unitsPerKit ?? null,
      yieldPerUnit: row.yield_per_unit ?? row.yieldPerUnit ?? previous?.yieldPerUnit ?? null,
      determinationId: row.determination_id ?? row.determinationId ?? previous?.determinationId ?? null,
      consumptionRate: row.consumption_rate ?? row.consumptionRate ?? previous?.consumptionRate ?? null,
      catalogStatus: row.catalog_status ?? row.catalogStatus ?? previous?.catalogStatus ?? null,
      catalogVersion: row.catalog_version ?? row.catalogVersion ?? previous?.catalogVersion ?? null,
      supplier: row.supplier ?? previous?.supplier ?? null,
      metadata: row.metadata ?? previous?.metadata ?? null,
      performance: row.performance ?? previous?.performance ?? null,
      presentation: row.presentation ?? previous?.presentation ?? null,
      registeredQuantity: finiteNonNegative(
        row.planned_qty ?? row.plannedQty,
      ) ?? previous?.registeredQuantity ?? null,
      catalogVariants: [...catalogVariants],
    });
  };
  (catalogItems || []).forEach(accept);
  (consumptions || []).forEach(accept);
  historicalSamples
    .filter((sample) => Number(sample.equipmentId) === Number(equipmentId))
    .forEach((sample) => sample.targets.forEach((target) => accept({
      ...target,
      equipment_id: equipmentId,
      item_id: target.productId,
      item_type: target.itemType,
      name: target.productName,
    })));
  return [...result.values()];
}

function confidenceFor({ comparableCases, validation }) {
  if (comparableCases < MIN_HISTORY_CASES || validation.positiveTargetRows === 0) return "insufficient";
  if (validation.quantityAccuracyPercent >= TARGET_ACCURACY_PERCENT) return "high";
  if (validation.quantityAccuracyPercent >= 90) return "medium";
  return "low";
}

function comparePredictionToRegistered(suggestedQuantity, registeredQuantity) {
  if (suggestedQuantity === null || suggestedQuantity === undefined) {
    return { status: "prediction_unavailable", exactMatch: null, absoluteError: null };
  }
  if (registeredQuantity === null || registeredQuantity === undefined) {
    return { status: "awaiting_registered_quantity", exactMatch: null, absoluteError: null };
  }
  const suggested = Number(suggestedQuantity);
  const registered = Number(registeredQuantity);
  if (!Number.isFinite(suggested) || !Number.isFinite(registered)) {
    return { status: "awaiting_registered_quantity", exactMatch: null, absoluteError: null };
  }
  const absoluteError = Math.abs(suggested - registered);
  return {
    status: absoluteError === 0 ? "exact_match" : "different",
    exactMatch: absoluteError === 0,
    absoluteError,
  };
}

function summarizeCurrentCaseLearning(items) {
  const outputs = items.filter((item) => HISTORICAL_OUTPUT_TYPES.has(item.itemType));
  const evaluated = outputs.filter((item) => item.learningFeedback.exactMatch !== null);
  const exactMatches = evaluated.filter((item) => item.learningFeedback.exactMatch).length;
  return {
    labelSource: "bc_consumption_items.planned_qty",
    validationGrade: "planning_proxy_only",
    outputProducts: outputs.length,
    evaluatedProducts: evaluated.length,
    exactMatchProducts: exactMatches,
    differentProducts: evaluated.length - exactMatches,
    awaitingRegisteredQuantity: outputs.filter(
      (item) => item.learningFeedback.status === "awaiting_registered_quantity",
    ).length,
    predictionUnavailable: outputs.filter(
      (item) => item.learningFeedback.status === "prediction_unavailable",
    ).length,
    exactMatchPercent: evaluated.length ? (exactMatches / evaluated.length) * 100 : null,
  };
}

function buildEquipmentPrediction({
  equipment,
  catalogItems,
  consumptions,
  historicalSamples,
  operationalHistoricalSamples = [],
  deterministicEquipmentResult,
}) {
  const equipmentId = Number(equipment.equipment_id);
  const current = buildCurrentSample(equipmentId, consumptions);
  const peers = historicalSamples.filter((sample) => sample.equipmentId === equipmentId);
  const operationalPeers = operationalHistoricalSamples.filter(
    (sample) => sample.equipmentId === equipmentId && sample.targets.size > 0,
  );
  const validation = backtest(operationalPeers);
  const proxyValidation = backtest(peers);
  const deterministic = deterministicMap(deterministicEquipmentResult);
  const targets = catalogTargets(equipmentId, catalogItems, consumptions, historicalSamples);
  const manufacturerRelationshipCandidates = manufacturerRelationshipsForReactives(
    current.reactives,
    equipment.equipment_name,
  );
  const manufacturerRelationshipKeys = new Set(manufacturerRelationshipCandidates.map(
    (candidate) => `${candidate.itemType}::${candidate.productId}`,
  ));
  const enoughHistory = operationalPeers.length >= MIN_HISTORY_CASES;
  const meetsTarget = validation.quantityAccuracyPercent !== null
    && validation.quantityAccuracyPercent >= TARGET_ACCURACY_PERCENT;
  const correctionEligible = enoughHistory && meetsTarget;
  const blockers = [];
  if (!enoughHistory) {
    blockers.push({
      code: "INSUFFICIENT_COMPARABLE_HISTORY",
      message: `Se requieren al menos ${MIN_HISTORY_CASES} Business Cases con despacho final comparable; existen ${operationalPeers.length}.`,
    });
  }
  if (validation.quantityAccuracyPercent === null) {
    blockers.push({
      code: "BACKTEST_NOT_MEASURABLE",
      message: "No existen resultados positivos suficientes para medir la exactitud de cantidades.",
    });
  } else if (!meetsTarget) {
    blockers.push({
      code: "TARGET_ACCURACY_NOT_MET",
      message: `El backtest no alcanza el umbral obligatorio de ${TARGET_ACCURACY_PERCENT}%.`,
    });
  }

  const response = {
    version: MODEL_VERSION,
    mode: "shadow_read_only",
    targetAccuracyPercent: TARGET_ACCURACY_PERCENT,
    automaticCorrectionEligible: correctionEligible,
    offerWriteEnabled: false,
    usagePolicy: {
      allowed: ["manual_quantity_review", "candidate_prioritization"],
      prohibited: ["automatic_offer_write", "automatic_dispatch", "automatic_purchase"],
    },
    historicalSuggestionSource: "bc_consumption_items.planned_qty",
    trainingObservationPolicy: {
      capture: "all_business_case_consumption_records",
      eligibleForHistoricalSuggestionAfterState: "canonical_state != DRAFT_INICIAL",
      currentCaseExcludedFromPeers: true,
      comparisonStatus: "planning_proxy_only",
    },
    validationLabelSource: "bc_dispatch_items.ops_dispatched_qty (solo despachos completos)",
    comparableCases: peers.length,
    operationalValidationCases: operationalPeers.length,
    confidence: confidenceFor({ comparableCases: operationalPeers.length, validation }),
    validation,
    proxyValidation,
    historicalModel: {
      name: "type_specific_nearest_neighbor",
      calibrador: "nearest_log_reactive_vector_unscaled",
      control: "target_product_reactive_profile_scaled_rounded",
      material: "target_product_reactive_profile_scaled",
      minimumSuggestionPeers: MIN_SUGGESTION_PEERS,
    },
    manufacturerRelationshipCandidates,
    blockers,
    productKnowledgeCoverage: {
      totalProducts: targets.length,
      verifiedCatalogIdentity: targets.filter((target) => target.catalogVariants?.length === 1).length,
      ambiguousSupplierCodes: targets.filter((target) => target.catalogVariants?.length > 1).length,
      auditedFormulaProducts: targets.filter((target) => deterministic.has(target.productId)).length,
      manufacturerEvidenceProducts: targets.filter((target) => manufacturerKnowledgeFor({
        productId: target.productId,
        equipmentName: target.equipmentName,
      })).length,
    },
    items: targets.map((target) => {
      const formula = deterministic.get(target.productId);
      const historical = HISTORICAL_OUTPUT_TYPES.has(target.itemType)
        ? estimateTarget(current, peers, target.identityKey)
        : null;
      const productKnowledge = buildProductKnowledge(
        target,
        formula,
        peers,
        target.identityKey,
      );
      const selectedHistorical = productKnowledge.evidence.safeForSimilarity
        ? selectHistoricalPrediction(target.itemType, historical)
        : null;
      const manufacturerLinkedFromCurrentReactives = manufacturerRelationshipKeys.has(
        `${target.itemType}::${normalizeCatalogCode(target.productId)}`,
      );
      const historicalSuggestion = selectedHistorical?.quantity ?? null;
      const deterministicQuantity = formula ? roundQuantity(formula.quantity) : null;
      const suggestedQuantity = deterministicQuantity ?? historicalSuggestion;
      return {
        ...target,
        productKnowledge,
        manufacturerLinkedFromCurrentReactives,
        deterministicQuantity,
        historical: historical ? {
          peerCount: historical.peerCount,
          medianQuantity: roundQuantity(historical.medianQuantity),
          ratioScaledQuantity: roundQuantity(historical.ratioScaledQuantity),
          nearestQuantity: roundQuantity(historical.nearestQuantity),
          nearestScaledQuantity: roundQuantity(historical.nearestScaledQuantity),
          targetAwareNearestScaledQuantity: roundQuantity(historical.targetAwareNearestScaledQuantity),
          targetAwareReactiveCount: historical.targetAwareReactiveCount,
          ensembleQuantity: roundQuantity(historical.ensembleQuantity),
          selectedQuantity: historicalSuggestion,
          selectedMethod: selectedHistorical?.method || null,
          positivePeerCount: historical.positivePeerCount,
        } : null,
        empiricalRange: historical ? {
          p50: roundQuantity(historical.empiricalRange.p50),
          p80: roundQuantity(historical.empiricalRange.p80),
          p95: roundQuantity(historical.empiricalRange.p95),
        } : null,
        suggestedQuantity,
        learningFeedback: comparePredictionToRegistered(
          suggestedQuantity,
          target.registeredQuantity,
        ),
        recommendationSource: deterministicQuantity !== null
          ? "audited_formula"
          : historicalSuggestion !== null
            ? "experimental_history"
            : "unavailable",
        decisionSupportStatus: deterministicQuantity !== null
          ? productKnowledge.evidence.formulaManufacturerStatus === "requires_review"
            ? "formula_manufacturer_review_required"
            : "formula_ready_shadow"
          : productKnowledge.identity.status === "ambiguous_supplier_code"
            ? "ambiguous_product_identity"
          : historicalSuggestion !== null
            ? "historical_review_required"
            : "insufficient_evidence",
        quantityValidated: deterministicQuantity !== null,
        manufacturerValidated: productKnowledge.evidence.formulaManufacturerStatus === "supported",
        publishable: false,
      };
    }),
  };
  response.learningSummary = summarizeCurrentCaseLearning(response.items);
  return response;
}

async function loadHistoricalRows(businessCaseId, equipmentIds) {
  if (!equipmentIds.length) return [];
  const { rows } = await db.query(
    `SELECT c.business_case_id, c.equipment_id, c.catalog_id, c.item_id, c.name, c.item_type,
            c.annual_qty, c.planned_qty, d.ops_dispatch_qty,
            d.ops_dispatched_qty
       FROM bc_consumption_items c
       JOIN bc_equipment_selection selected
         ON selected.business_case_id = c.business_case_id
        AND selected.equipment_id = c.equipment_id
       JOIN v_business_cases_complete vc
         ON vc.business_case_id = c.business_case_id
       LEFT JOIN bc_dispatch_items d
         ON d.business_case_id = c.business_case_id
        AND d.item_key = c.item_key
      WHERE c.business_case_id <> $1
        AND vc.canonical_state <> 'DRAFT_INICIAL'
        AND c.equipment_id = ANY($2::bigint[])
        AND LOWER(c.item_type) IN ('reactivo', 'calibrador', 'control', 'material')
      ORDER BY c.business_case_id, c.equipment_id, c.item_key`,
    [businessCaseId, equipmentIds],
  );
  return rows;
}

async function buildPredictivePreview({
  businessCaseId,
  equipment,
  consumptions,
  catalogItems,
  deterministicEquipmentResults,
}) {
  const equipmentIds = [...new Set((equipment || [])
    .map((row) => Number(row.equipment_id))
    .filter(Number.isFinite))];
  const historicalRows = await loadHistoricalRows(businessCaseId, equipmentIds);
  const historicalSamples = buildSamples(historicalRows);
  const operationalHistoricalSamples = buildSamples(historicalRows, {
    labelMode: "operational_dispatch",
  });
  const byEquipmentId = new Map((deterministicEquipmentResults || [])
    .map((entry) => [Number(entry.equipmentId), entry]));

  return new Map((equipment || []).map((row) => [
    Number(row.equipment_id),
    buildEquipmentPrediction({
      equipment: row,
      catalogItems,
      consumptions,
      historicalSamples,
      operationalHistoricalSamples,
      deterministicEquipmentResult: byEquipmentId.get(Number(row.equipment_id)),
    }),
  ]));
}

module.exports = {
  buildPredictivePreview,
  __testables: {
    normalizeType,
    quantile,
    buildSamples,
    buildCurrentSample,
    reactiveDistance,
    estimateTarget,
    selectHistoricalPrediction,
    backtest,
    buildEquipmentPrediction,
    buildProductKnowledge,
    buildObservedReactiveProfile,
    comparePredictionToRegistered,
    summarizeCurrentCaseLearning,
  },
};
