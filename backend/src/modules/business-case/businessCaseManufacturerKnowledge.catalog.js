const EVIDENCE_RETRIEVED_AT = "2026-09-27";

function normalizeCatalogCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.replace(/^0+(?=\d)/, "");
}

const SOURCES = Object.freeze({
  sysmexXnCheck: Object.freeze({
    title: "Sysmex XN Check - Products Detail",
    url: "https://www.sysmex-europe.com/products/products-detail/xn-check/",
    publisher: "Sysmex Europe SE",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  sysmexXnCheckBf: Object.freeze({
    title: "Sysmex XN Check BF - Products Detail",
    url: "https://www.sysmex-europe.com/products/products-detail/xn-check-bf/",
    publisher: "Sysmex Europe SE",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  sysmexXnlBrochure: Object.freeze({
    title: "XN-L Series Automated Hematology Analyzers brochure",
    url: "https://www.sysmex.com/-/media/project/sysmex/sysmex/documents/brochures/xn-l-series-automated-hematology-analyzers-brochure.pdf",
    publisher: "Sysmex America, Inc.",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  sysmexXnlManual: Object.freeze({
    title: "XN-L Series General Information manual",
    url: "https://sysmex.com/US/en/ifuguides/xnl%20330%20430%20530%20general%20information%20manual.pdf",
    publisher: "Sysmex Corporation",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rocheCfas: Object.freeze({
    title: "Calibrator for automated systems (C.f.a.s.), 03510581001V12.0",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/741865b5-bb9b-ec11-0f91-005056a772fd?countryIsoCode=gb",
    publisher: "Roche Diagnostics GmbH",
    documentVersion: "2023-01, V12.0",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rochePccMulti2: Object.freeze({
    title: "PreciControl ClinChem Multi 2, 05618878001V6.0",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/7cfc1ab9-d781-ed11-1a91-005056a772fd?countryIsoCode=us",
    publisher: "Roche Diagnostics GmbH",
    documentVersion: "2024-12, V6.0",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rochePccMulti1: Object.freeze({
    title: "PreciControl ClinChem Multi 1",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/c95fcd16-b84a-ed11-1691-005056a772fd?countryIsoCode=ae",
    publisher: "Roche Diagnostics GmbH",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rocheLdlc3: Object.freeze({
    title: "LDL-Cholesterol Gen.3, 08057966500V7.0",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/9d81542d-1156-ef11-2691-005056a772fd?countryIsoCode=be",
    publisher: "Roche Diagnostics GmbH",
    documentVersion: "2024-08, V7.0",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rocheUrea: Object.freeze({
    title: "Urea/BUN, REF 08058806190",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/9ce9e0ef-3303-f111-3291-005056a772fd?countryIsoCode=be",
    publisher: "Roche Diagnostics GmbH",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rocheGlucose: Object.freeze({
    title: "Glucose HK Gen.3, REF 08057800190",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/d6c2ba0d-5e34-ef11-2491-005056a772fd?countryIsoCode=be",
    publisher: "Roche Diagnostics GmbH",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rocheTriglycerides: Object.freeze({
    title: "Triglycerides, REF 08058687190",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/37217ee0-40b1-ef11-2d91-005056a71a5d?countryIsoCode=be",
    publisher: "Roche Diagnostics GmbH",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rocheHba1cAssay: Object.freeze({
    title: "Tina-quant Hemoglobin A1c",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/9b435696-0de9-ef11-2891-005056a772fd?countryIsoCode=au",
    publisher: "Roche Diagnostics GmbH",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
  rocheHba1cCfas: Object.freeze({
    title: "C.f.a.s. HbA1c, 04542282001V10.0",
    url: "https://elabdoc-prod.roche.com/eLD/api/downloads/e56b6a86-1504-ec11-0d91-005056a71a5d?countryIsoCode=us",
    publisher: "Roche Diagnostics GmbH",
    documentVersion: "2025-03, V10.0",
    retrievedAt: EVIDENCE_RETRIEVED_AT,
  }),
});

const PRODUCT_KNOWLEDGE = Object.freeze({
  "7051506001": Object.freeze({
    manufacturer: "Sysmex",
    productFamily: "XN Check",
    equipmentNamePatterns: ["xn-l", "xnl"],
    auditedFormulaFacts: Object.freeze({ stabilityDays: 56 }),
    facts: Object.freeze({
      levels: 3,
      vialVolumeMl: 3,
      periodOfUseDays: 56,
      openVialStabilityDays: 7,
      compatibleSeries: ["XN-L Series"],
    }),
    sourceKeys: ["sysmexXnCheck"],
  }),
  "7051409001": Object.freeze({
    manufacturer: "Sysmex",
    productFamily: "XN Check BF",
    equipmentNamePatterns: ["xn-l", "xnl"],
    auditedFormulaFacts: Object.freeze({ stabilityDays: 56 }),
    facts: Object.freeze({
      levels: 2,
      vialVolumeMl: 3,
      periodOfUseDays: 56,
      openVialStabilityDays: 30,
      requiresBodyFluidMode: true,
      compatibleSeries: ["XN-L Series"],
    }),
    sourceKeys: ["sysmexXnCheckBf"],
  }),
  "6952291001": Object.freeze({
    manufacturer: "Sysmex",
    productFamily: "CELLCLEAN AUTO",
    equipmentNamePatterns: ["xn-l", "xnl"],
    auditedFormulaFacts: Object.freeze({ stabilityDays: 150 }),
    facts: Object.freeze({
      maintenanceIntervalDays: 7,
      internalCatalogUnitsPerPackage: 20,
      derivedCoverageDaysUsingInternalPresentation: 140,
      use: "weekly_cleaning_sequence",
    }),
    sourceKeys: ["sysmexXnlBrochure", "sysmexXnlManual"],
  }),
  "10759350190": Object.freeze({
    manufacturer: "Roche",
    productFamily: "C.f.a.s.",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    facts: Object.freeze({
      package: "12 x 3 mL",
      reconstitutedStabilityHoursAt15To25C: 8,
      reconstitutedStabilityDaysAt2To8C: 2,
      reconstitutedStabilityDaysFrozenOnce: 28,
    }),
    sourceKeys: ["rocheCfas"],
  }),
  "5947626190": Object.freeze({
    manufacturer: "Roche",
    productFamily: "PreciControl ClinChem Multi 1",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    facts: Object.freeze({ package: "4 x 5 mL", pairedControlLevel: 1 }),
    sourceKeys: ["rochePccMulti1"],
  }),
  "5947774190": Object.freeze({
    manufacturer: "Roche",
    productFamily: "PreciControl ClinChem Multi 2",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    facts: Object.freeze({
      package: "4 x 5 mL",
      pairedControlLevel: 2,
      generalReconstitutedStabilityHoursAt15To25C: 12,
      generalReconstitutedStabilityDaysAt2To8C: 5,
      runDailyAndAfterCalibration: true,
      localQcPolicyStillRequired: true,
    }),
    sourceKeys: ["rochePccMulti2"],
  }),
  "12172623122": Object.freeze({
    manufacturer: "Roche",
    productFamily: "C.f.a.s. Lipids",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    facts: Object.freeze({
      package: "3 x 1 mL",
      linkedAssay: "LDL-Cholesterol Gen.3",
      linkedAssayCatalogCode: "8057966190",
      calibrationAfterReagentLotChange: true,
    }),
    sourceKeys: ["rocheLdlc3"],
  }),
  "4528417190": Object.freeze({
    manufacturer: "Roche",
    productFamily: "C.f.a.s. HbA1c",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    facts: Object.freeze({
      package: "3 x 2 mL",
      reconstitutedStabilityHoursAt15To25C: 8,
      reconstitutedStabilityDaysAt2To8C: 2,
      reconstitutedStabilityDaysFrozenOnce: 90,
    }),
    sourceKeys: ["rocheHba1cCfas"],
  }),
});

const ROCHE_CLINCHEM_COMMON = Object.freeze({
  calibrators: ["10759350190"],
  controls: ["5947626190", "5947774190"],
  materials: ["8063494190"],
});

const ASSAY_RELATIONSHIPS = Object.freeze({
  "8058806190": Object.freeze({
    assay: "Urea/BUN",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    ...ROCHE_CLINCHEM_COMMON,
    sourceKeys: ["rocheUrea"],
  }),
  "8057800190": Object.freeze({
    assay: "Glucose HK Gen.3",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    ...ROCHE_CLINCHEM_COMMON,
    sourceKeys: ["rocheGlucose"],
  }),
  "8058687190": Object.freeze({
    assay: "Triglycerides",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    ...ROCHE_CLINCHEM_COMMON,
    sourceKeys: ["rocheTriglycerides"],
  }),
  "8057966190": Object.freeze({
    assay: "LDL-Cholesterol Gen.3",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    calibrators: ["12172623122"],
    controls: ["5947626190", "5947774190"],
    materials: ["8063494190"],
    sourceKeys: ["rocheLdlc3"],
  }),
  "8445699190": Object.freeze({
    assay: "Tina-quant Hemoglobin A1c",
    equipmentNamePatterns: ["cobas", "c 303", "c303"],
    calibrators: ["4528417190"],
    controls: ["5479207190", "5912504190"],
    materials: ["8463107190", "8463093190"],
    sourceKeys: ["rocheHba1cAssay"],
  }),
});

function equipmentMatches(entry, equipmentName) {
  const normalizedName = String(equipmentName || "").toLowerCase();
  return !entry.equipmentNamePatterns?.length
    || entry.equipmentNamePatterns.some((pattern) => normalizedName.includes(pattern));
}

function formulaComparison(entry, formula) {
  const formulaStabilityDays = Number(
    formula?.values?.stabilityDays
      ?? formula?.stabilityDays
      ?? entry.auditedFormulaFacts?.stabilityDays,
  );
  if (!Number.isFinite(formulaStabilityDays) || formulaStabilityDays <= 0) return null;
  if (Number.isFinite(entry.facts?.periodOfUseDays)) {
    return {
      field: "stabilityDays",
      status: formulaStabilityDays === entry.facts.periodOfUseDays ? "supported" : "requires_review",
      formulaValue: formulaStabilityDays,
      manufacturerValue: entry.facts.periodOfUseDays,
      manufacturerValueMeaning: "period_of_use_days",
    };
  }
  if (Number.isFinite(entry.facts?.derivedCoverageDaysUsingInternalPresentation)) {
    return {
      field: "stabilityDays",
      status: formulaStabilityDays === entry.facts.derivedCoverageDaysUsingInternalPresentation
        ? "supported"
        : "requires_review",
      formulaValue: formulaStabilityDays,
      manufacturerValue: entry.facts.derivedCoverageDaysUsingInternalPresentation,
      manufacturerValueMeaning: "manufacturer_interval_x_internal_catalog_units_per_package",
    };
  }
  return null;
}

function manufacturerKnowledgeFor({ productId, equipmentName, formula }) {
  const normalizedProductId = normalizeCatalogCode(productId);
  const entry = normalizedProductId ? PRODUCT_KNOWLEDGE[normalizedProductId] : null;
  if (!entry || !equipmentMatches(entry, equipmentName)) return null;
  return {
    evidenceStatus: "manufacturer_primary_source",
    manufacturer: entry.manufacturer,
    productFamily: entry.productFamily,
    facts: entry.facts,
    formulaComparison: formulaComparison(entry, formula),
    sources: entry.sourceKeys.map((key) => SOURCES[key]),
  };
}

function manufacturerRelationshipsForReactives(reactives, equipmentName) {
  const candidates = new Map();
  const addCandidates = (relationship, itemType, productIds, reactiveProductId) => {
    productIds.forEach((productId) => {
      const key = `${itemType}::${productId}`;
      const current = candidates.get(key) || {
        itemType,
        productId,
        suggestedPresence: true,
        supportedByAssays: [],
        sources: [],
      };
      if (!current.supportedByAssays.some((entry) => entry.reactiveProductId === reactiveProductId)) {
        current.supportedByAssays.push({ reactiveProductId, assay: relationship.assay });
      }
      relationship.sourceKeys.forEach((sourceKey) => {
        const source = SOURCES[sourceKey];
        if (!current.sources.some((entry) => entry.url === source.url)) current.sources.push(source);
      });
      candidates.set(key, current);
    });
  };

  [...(reactives?.entries?.() || [])].forEach(([rawKey, demand]) => {
    if (!(Number(demand) > 0)) return;
    const productId = normalizeCatalogCode(String(rawKey).split("::").pop());
    const relationship = productId ? ASSAY_RELATIONSHIPS[productId] : null;
    if (!relationship || !equipmentMatches(relationship, equipmentName)) return;
    addCandidates(relationship, "calibrador", relationship.calibrators, productId);
    addCandidates(relationship, "control", relationship.controls, productId);
    addCandidates(relationship, "material", relationship.materials, productId);
  });

  return [...candidates.values()];
}

module.exports = {
  normalizeCatalogCode,
  manufacturerKnowledgeFor,
  manufacturerRelationshipsForReactives,
  __testables: {
    normalizeCatalogCode,
    formulaComparison,
  },
};
