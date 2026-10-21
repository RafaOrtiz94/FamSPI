const db = require("../../config/db");
const {
  normalizeCode,
  manufacturerValues,
  effectiveValues,
} = require("./bcLabProductParameters.service");
const { evaluateConsumableSources } = require("./consumableRules.rules");
const { reagentEvents, resolveConventions, processDemandOf, defaultConventionsFor } = require("./consumableDocumentRule");
const validations = require("./consumableRuleValidations.service");
const labStatistics = require("./labStatistics.service");
const deliveryHistory = require("./deliveryHistory.service");
const referenceService = require("./referenceConsumption.service");
const referenceConsumption = require("./referenceConsumption");
const { RULE_BY_CODE: MANUAL_RULE_BY_CODE } = require("./consumableEquipmentManual");
const cobasQuantities = require("./calculationPackages/immunoChemistryCobasQuantities.package");
const { predictByQcCalendar } = require("./qcCalendarRule");

// Categoria de equipo (v_equipment_full_catalog.category) de los procesos de referencia cargados
// (cobas pro = "configuracion"): solo entre estas se comparte la mediana de familia.
const REFERENCE_EQUIPMENT_FAMILIES = new Set(["chemistry", "immunology", "configuracion"]);

// Bloque del libro auditado -> tipo de producto del Business Case.
const AUDITED_BLOCK_TYPES = Object.freeze({
  reactivo: "reactivo",
  calibrador: "calibrador",
  calibrador_control: "calibrador",
  control: "control",
  consumible: "material",
});

// Lo que el libro auditado sabe de cada producto del equipo: sus filas (parametros de la formula),
// si esta en uso segun el calculo anual ya auditado, y por que no se pudo modelar si es el caso.
function buildAuditedContext(equipment, deterministicResult) {
  const quantityPackage = cobasQuantities.getQuantityPackage(equipment?.equipment_name);
  if (!quantityPackage) return null;
  const rowsByCode = new Map();
  quantityPackage.modeledRows.forEach((row) => {
    const code = normalizeCode(row.productId);
    if (!code) return;
    if (!rowsByCode.has(code)) rowsByCode.set(code, []);
    rowsByCode.get(code).push(row);
  });
  const unmodeledByCode = new Map();
  quantityPackage.unmodeledRows.forEach((row) => {
    const code = normalizeCode(row.productId);
    if (code && !unmodeledByCode.has(code)) unmodeledByCode.set(code, row);
  });
  const annualByCode = new Map();
  (deterministicResult?.calculation?.items || []).forEach((item) => {
    const code = normalizeCode(item.productId);
    const quantity = finiteNumberOrNull(item.calculatedQuantity);
    if (code && quantity !== null) annualByCode.set(code, quantity);
  });
  return {
    packageId: quantityPackage.packageDefinition.packageId,
    version: quantityPackage.packageDefinition.version,
    rowsByCode,
    unmodeledByCode,
    annualByCode,
  };
}

function auditedForProduct(auditedContext, supplierCode) {
  if (!auditedContext || !supplierCode) return null;
  const rows = auditedContext.rowsByCode.get(supplierCode) || [];
  const annualQuantity = auditedContext.annualByCode.has(supplierCode) ? auditedContext.annualByCode.get(supplierCode) : null;
  return {
    packageId: auditedContext.packageId,
    version: auditedContext.version,
    rows,
    annualQuantity,
    // "En uso" lo decide el calculo anual auditado (vinculos del reactivo o modulo activo).
    inUse: annualQuantity !== null && annualQuantity > 0,
    unmodeledReason: rows.length ? null : auditedContext.unmodeledByCode.get(supplierCode)?.reason || null,
  };
}

const LINK_GROUP_TYPES = Object.freeze({
  calibradores: "calibrador",
  controles: "control",
  materiales: "material",
});

function normalizeItemType(value) {
  return String(value || "").trim().toLowerCase();
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function consumptionCode(item, catalogById) {
  const direct = normalizeCode(item?.item_id);
  if (direct) return direct;
  const catalog = catalogById.get(Number(item?.catalog_id));
  return normalizeCode(catalog?.item_id);
}

function targetKey(target) {
  const productIdentity = target.supplierCode || target.itemKey || target.name || "unknown";
  return [target.equipmentId, target.itemType, productIdentity].join("::");
}

function addDiscovery(targets, target) {
  const key = targetKey(target);
  const current = targets.get(key);
  if (!current) {
    targets.set(key, { ...target, discoveredFrom: [...target.discoveredFrom] });
    return;
  }
  const seen = new Set(current.discoveredFrom.map((entry) => JSON.stringify(entry)));
  target.discoveredFrom.forEach((entry) => {
    const serialized = JSON.stringify(entry);
    if (!seen.has(serialized)) current.discoveredFrom.push(entry);
  });
  if (!current.name && target.name) current.name = target.name;
  if (!current.itemKey && target.itemKey) current.itemKey = target.itemKey;
  if (current.annualQty === null && target.annualQty !== null) current.annualQty = target.annualQty;
  if (current.plannedQty === null && target.plannedQty !== null) current.plannedQty = target.plannedQty;
  if (!current.unitsPerPack && target.unitsPerPack) current.unitsPerPack = target.unitsPerPack;
}

async function loadRuleData(businessCaseId, initialCodes) {
  const [environmentResult, overrideResult, initialSpecResult] = await Promise.all([
    db.query(
      `SELECT work_days_per_week, shifts_per_day, hours_per_shift,
              quality_controls_per_shift, control_levels, routine_qc_frequency,
              special_tests, special_qc_frequency
         FROM bc_lab_environment
        WHERE business_case_id = $1
        LIMIT 1`,
      [businessCaseId],
    ),
    db.query(
      `SELECT supplier_code, overrides, updated_by, updated_at
         FROM bc_lab_product_parameters
        WHERE business_case_id = $1`,
      [businessCaseId],
    ),
    initialCodes.length
      ? db.query(
        `SELECT *
           FROM catalog_consumable_specs
          WHERE valid_to IS NULL AND supplier_code = ANY($1::text[])`,
        [initialCodes],
      )
      : Promise.resolve({ rows: [] }),
  ]);

  const specs = [...initialSpecResult.rows];
  const linkedCodes = new Set();
  specs.forEach((spec) => {
    const links = spec.parameters?.linked_products || {};
    Object.keys(LINK_GROUP_TYPES).forEach((group) => {
      (links[group] || []).forEach((code) => {
        const normalized = normalizeCode(code);
        if (normalized) linkedCodes.add(normalized);
      });
    });
  });
  const loadedCodes = new Set(specs.map((spec) => normalizeCode(spec.supplier_code)).filter(Boolean));
  const missingLinkedCodes = [...linkedCodes].filter((code) => !loadedCodes.has(code));
  if (missingLinkedCodes.length) {
    const linkedSpecResult = await db.query(
      `SELECT *
         FROM catalog_consumable_specs
        WHERE valid_to IS NULL AND supplier_code = ANY($1::text[])`,
      [missingLinkedCodes],
    );
    specs.push(...linkedSpecResult.rows);
  }

  return {
    environment: environmentResult.rows[0] || null,
    specs,
    overrides: overrideResult.rows,
  };
}

function buildTargets(data, specsByCode) {
  const equipmentById = new Map((data.equipment || []).map((equipment) => [Number(equipment.equipment_id), equipment]));
  const catalogById = new Map((data.catalogItems || []).map((item) => [Number(item.catalog_id), item]));
  const catalogByTypeCode = new Map();
  (data.catalogItems || []).forEach((item) => {
    const code = normalizeCode(item.item_id);
    if (code) catalogByTypeCode.set(`${normalizeItemType(item.item_type)}::${code}`, item);
  });
  const targets = new Map();

  (data.consumptions || []).forEach((item) => {
    const equipment = equipmentById.get(Number(item.equipment_id));
    if (!equipment) return;
    const supplierCode = consumptionCode(item, catalogById);
    addDiscovery(targets, {
      equipmentId: Number(equipment.equipment_id),
      equipmentCode: equipment.equipment_code || null,
      equipmentName: equipment.equipment_name || null,
      family: equipment.category || null,
      itemType: normalizeItemType(item.item_type),
      supplierCode,
      itemKey: item.item_key || null,
      name: item.name || null,
      annualQty: finiteNumberOrNull(item.annual_qty),
      plannedQty: finiteNumberOrNull(item.planned_qty),
      unitsPerPack: finiteNumberOrNull(item.units_per_pack),
      // Reactivos: DET/AÑO/PROCESO del Sheet del BC = demanda real del laboratorio, no se predice.
      demandSource: normalizeItemType(item.item_type) === "reactivo" && Number(item.annual_qty) > 0 ? "sheet" : "business_case",
      discoveredFrom: [{ source: "bc_consumption_items", itemKey: item.item_key || null }],
    });

    if (normalizeItemType(item.item_type) !== "reactivo" || !(Number(item.annual_qty) > 0) || !supplierCode) return;
    const reagentSpec = specsByCode.get(supplierCode);
    const links = reagentSpec?.parameters?.linked_products || {};
    Object.entries(LINK_GROUP_TYPES).forEach(([group, itemType]) => {
      (links[group] || []).forEach((rawCode) => {
        const code = normalizeCode(rawCode);
        if (!code) return;
        const linkedSpec = specsByCode.get(code);
        const catalog = catalogByTypeCode.get(`${itemType}::${code}`);
        addDiscovery(targets, {
          equipmentId: Number(equipment.equipment_id),
          equipmentCode: equipment.equipment_code || null,
          equipmentName: equipment.equipment_name || null,
          family: equipment.category || null,
          itemType,
          supplierCode: code,
          itemKey: null,
          name: linkedSpec?.product_name || catalog?.name || null,
          annualQty: null,
          plannedQty: null,
          discoveredFrom: [{
            source: "catalog_consumable_specs.parameters.linked_products",
            reagentCode: supplierCode,
            group,
          }],
        });
      });
    });
  });

  // Productos que el libro auditado pide entregar y que no estan en el consumo del Business Case
  // ni vinculados por ficha (consumibles del modulo, por ejemplo): tambien deben evaluarse.
  (data.equipment || []).forEach((equipment) => {
    const audited = data.auditedByEquipment?.get(Number(equipment.equipment_id));
    if (!audited) return;
    const known = new Set([...targets.values()]
      .filter((target) => target.equipmentId === Number(equipment.equipment_id))
      .map((target) => target.supplierCode));
    audited.annualByCode.forEach((quantity, code) => {
      if (!(quantity > 0) || known.has(code)) return;
      const row = (audited.rowsByCode.get(code) || [])[0];
      if (!row) return;
      addDiscovery(targets, {
        equipmentId: Number(equipment.equipment_id),
        equipmentCode: equipment.equipment_code || null,
        equipmentName: equipment.equipment_name || null,
        family: equipment.category || null,
        itemType: AUDITED_BLOCK_TYPES[row.block] || "material",
        supplierCode: code,
        itemKey: null,
        name: row.name || null,
        annualQty: null,
        plannedQty: null,
        discoveredFrom: [{ source: "audited_calculation_package", packageId: audited.packageId, sheet: row.sheet }],
      });
    });
  });

  return [...targets.values()];
}

// Por equipo: que productos vincula la ficha de algun reactivo del Business Case, y cuales la de
// un reactivo con demanda. Es la evidencia de "en uso" para la fuente del documento oficial.
function buildLinkedUsage(data, specsByCode) {
  const catalogById = new Map((data.catalogItems || []).map((item) => [Number(item.catalog_id), item]));
  const byEquipment = new Map();
  (data.consumptions || []).forEach((item) => {
    if (normalizeItemType(item.item_type) !== "reactivo") return;
    const links = specsByCode.get(consumptionCode(item, catalogById))?.parameters?.linked_products;
    if (!links) return;
    const equipmentId = Number(item.equipment_id);
    if (!byEquipment.has(equipmentId)) byEquipment.set(equipmentId, { any: new Set(), active: new Set() });
    const usage = byEquipment.get(equipmentId);
    Object.keys(LINK_GROUP_TYPES).forEach((group) => {
      (links[group] || []).forEach((rawCode) => {
        const code = normalizeCode(rawCode);
        if (!code) return;
        usage.any.add(code);
        if (Number(item.annual_qty) > 0) usage.active.add(code);
      });
    });
  });
  return byEquipment;
}

// Usos por evento que la ficha de cada reactivo con demanda genera en el proceso, y su reparto a
// los productos que esa ficha vincula. Calibrador: suma las calibraciones y junta sus dias en un
// solo calendario (las que caen dentro de la estabilidad del envase lo comparten). Control: toma
// la mayor cantidad de corridas (una corrida sirve a todas las pruebas que lo comparten). Los dos
// acumulan el volumen que gastan las mediciones de cada reactivo.
function buildDocumentEvents(targets, data, environment, specsByCode, overridesByCode) {
  const byReagent = new Map();
  const byComponent = new Map();
  const processDurationMonths = finiteNumberOrNull(data.requirements?.projected_deadline_months);
  targets.forEach((target) => {
    if (target.itemType !== "reactivo" || !target.supplierCode) return;
    const spec = specsByCode.get(target.supplierCode);
    if (!spec) return;
    const manufacturer = manufacturerValues(spec, target.equipmentName);
    const linkedCalibratorLevels = (spec.parameters?.linked_products?.calibradores || [])
      .map((rawCode) => finiteNumberOrNull(specsByCode.get(normalizeCode(rawCode))?.levels_per_pack) || 0);
    const events = reagentEvents({
      calibratorLevels: Math.max(0, ...linkedCalibratorLevels) || null,
      identity: { supplierCode: target.supplierCode, itemType: "reactivo" },
      spec,
      manufacturer,
      effective: effectiveValues(manufacturer, overridesByCode.get(target.supplierCode)?.overrides || {}),
      environment,
      processDurationMonths,
      annualDemand: target.annualQty,
      conventions: data.conventions,
    });
    if (!events) return;
    byReagent.set(`${target.equipmentId}::${target.supplierCode}`, events);
    const links = spec.parameters?.linked_products || {};
    [
      ["calibradores", "calibrador", events.calibrationEvents, events.calibrationMeasurements],
      ["controles", "control", events.qcRuns, events.qcRuns],
    ].forEach(([group, itemType, uses, measurements]) => {
      (links[group] || []).forEach((rawCode) => {
        const code = normalizeCode(rawCode);
        if (!code) return;
        const key = `${target.equipmentId}::${itemType}::${code}`;
        const current = byComponent.get(key)
          || { uses: 0, reagents: 0, unknownReagents: 0, volumeUl: 0, volumeUnknownReagents: 0, daySet: new Set() };
        current.reagents += 1;
        if (uses === null) {
          current.unknownReagents += 1;
        } else {
          current.uses = itemType === "control" ? Math.max(current.uses, uses) : current.uses + uses;
          if (events.sampleVolumeUl) current.volumeUl += measurements * events.sampleVolumeUl;
          else current.volumeUnknownReagents += 1;
          if (itemType === "calibrador") events.calibrationDays.forEach((day) => current.daySet.add(day));
        }
        byComponent.set(key, current);
      });
    });
  });
  byComponent.forEach((current) => {
    const { daySet, ...rest } = current;
    Object.keys(current).forEach((field) => delete current[field]);
    Object.assign(current, rest, { days: daySet.size ? [...daySet].sort((a, b) => a - b) : null });
  });
  return { byReagent, byComponent };
}

// true / false solo con evidencia; null cuando no se puede saber.
function resolveUsage(target, linkedUsage, audited, documentEvents) {
  const events = documentEvents?.byComponent.get(`${target.equipmentId}::${target.itemType}::${target.supplierCode}`) || null;
  const usage = resolveInUse(target, linkedUsage, audited);
  return usage.inUse ? { ...usage, events } : usage;
}

function resolveInUse(target, linkedUsage, audited) {
  const usage = linkedUsage?.get(target.equipmentId);
  if (usage?.active.has(target.supplierCode)) return { inUse: true, evidence: "linked_by_reagent_with_demand" };
  if (audited?.inUse) return { inUse: true, evidence: "audited_annual_calculation" };
  if (usage?.any.has(target.supplierCode)) return { inUse: false, evidence: "linked_only_by_reagents_without_demand" };
  // Ninguna ficha lo vincula a un reactivo, pero la hoja del Business Case lo pide para este equipo:
  // es evidencia de que se usa (no de cuanto). Cubre sobre todo los materiales del analizador.
  if (target.plannedQty > 0) return { inUse: true, evidence: "listed_with_quantity_in_business_case" };
  return { inUse: null, evidence: null };
}

// Receta de cada reactivo: lo que su ficha vigente dice que necesita para funcionar (calibradores,
// controles y materiales), con la cantidad que el motor calcula para cada uno. No se guarda: se arma
// en cada lectura desde la version vigente de la ficha, asi que cambia sola cuando la ficha cambia.
function buildRecipes(items, specsByCode, documentEvents) {
  const byTypeCode = new Map(items.map((item) => [`${item.itemType}::${item.supplierCode}`, item]));
  return items
    .filter((item) => item.itemType === "reactivo" && item.supplierCode)
    .map((reagent) => {
      const spec = specsByCode.get(reagent.supplierCode) || null;
      const links = spec?.parameters?.linked_products || null;
      const components = [];
      const events = documentEvents?.byReagent.get(`${reagent.equipmentId}::${reagent.supplierCode}`) || null;
      Object.entries(LINK_GROUP_TYPES).forEach(([group, itemType]) => {
        (links?.[group] || []).forEach((rawCode) => {
          const code = normalizeCode(rawCode);
          if (!code) return;
          const item = byTypeCode.get(`${itemType}::${code}`) || null;
          const document = item?.sources?.officialDocument || null;
          const documentCalculated = document?.status === "calculated";
          components.push({
            // Usos que genera este reactivo, y total del producto entre todos los reactivos que lo comparten.
            usesFromReagent: { calibrador: events?.calibrationEvents, control: events?.qcRuns }[itemType] ?? null,
            sessions: documentCalculated ? document.sessions ?? null : null,
            conservation: documentCalculated ? document.conservation || null : null,
            uses: documentCalculated ? document.uses ?? null : null,
            containers: documentCalculated ? document.containers ?? null : null,
            basis: documentCalculated ? document.basis || null : null,
            reason: documentCalculated ? null : document?.reason?.message || null,
            itemType,
            supplierCode: code,
            name: item?.name || specsByCode.get(code)?.product_name || null,
            status: item?.status || "no_rule",
            quantity: item?.status === "calculated" ? item.quantity : null,
            primarySource: item?.primarySource || null,
            hasSpec: specsByCode.has(code),
          });
        });
      });
      const missingGroups = Object.keys(LINK_GROUP_TYPES).filter((group) => !(links?.[group] || []).length);
      return {
        reagentCode: reagent.supplierCode,
        reagentName: reagent.name,
        annualDemand: reagent.inputs?.recordedAnnualQty?.value ?? null,
        active: Number(reagent.inputs?.recordedAnnualQty?.value) > 0,
        reagentQuantity: reagent.status === "calculated" ? reagent.quantity : null,
        events,
        linkSource: spec ? "catalog_consumable_specs.parameters.linked_products" : null,
        specVersionId: spec?.id || null,
        specStatus: spec?.verification_status || "missing",
        components,
        // Grupos que la ficha no declara: no significa que no se necesiten.
        missingGroups,
        complete: Boolean(spec) && missingGroups.length === 0 && components.every((component) => component.status === "calculated"),
      };
    });
}

const GAP_MESSAGES = Object.freeze({
  SPEC_NOT_FOUND: "No tiene ficha del fabricante cargada.",
  TESTS_PER_PACK_MISSING: "La ficha no declara las pruebas por kit.",
  CALIBRATION_NOT_DECLARED: "La ficha no declara cada cuanto se calibra.",
  QC_NOT_DECLARED: "La ficha no declara cada cuanto se corre control.",
  SAMPLE_VOLUME_MISSING: "La ficha no trae el volumen de muestra por prueba.",
  LINKS_MISSING: "La ficha no vincula calibradores, controles ni materiales.",
  STABILITY_MISSING: "La ficha no declara estabilidad del producto abierto.",
  USAGE_PER_EVENT_REQUIRED: "No se sabe cada cuanto se usa y el producto no dura un dia abierto.",
  USAGE_NOT_DETERMINED: "Ninguna ficha lo vincula a un reactivo y la hoja no lo pide.",
  PRODUCT_CODE_MISSING: "El producto no tiene codigo de proveedor.",
  containers_per_pack: "La ficha no declara cuantos envases trae la presentacion.",
  volume_per_use: "Falta el volumen del envase o el de muestra de algun reactivo: no se revisa agotamiento por volumen.",
  event_frequency: "Ningun reactivo declara cada cuanto se usa: se calcula solo por vencimiento.",
  event_frequency_partial: "Algun reactivo que lo usa no declara cada cuanto.",
  stability_days: "La ficha no declara estabilidad: se asume un envase por uso.",
  ise_tests: "Faltan las muestras ISE por año (Estadisticas del laboratorio): se calcula solo por tiempo.",
  ISE_TESTS_REQUIRED: "Depende del volumen de muestras ISE y el fabricante no publica el consumo por muestra.",
  MANUAL_INTERVAL_NOT_PUBLISHED: "El fabricante no publica el intervalo de cambio.",
});

// Datos que faltan en las fichas, ordenados por impacto: primero lo que impide calcular, y dentro
// de eso lo que mueve mas (demanda del reactivo, o cuantos reactivos usan el producto).
function buildDataGaps(items, recipes) {
  const recipeByCode = new Map((recipes || []).map((recipe) => [recipe.reagentCode, recipe]));
  const gaps = [];
  const push = (item, code, blocks, impact) => gaps.push({
    itemType: item.itemType,
    supplierCode: item.supplierCode,
    name: item.name,
    code,
    message: GAP_MESSAGES[code] || code,
    blocks,
    impact: Number(impact) || 0,
  });
  items.forEach((item) => {
    const document = item.sources?.officialDocument;
    if (!document) return;
    if (item.itemType === "reactivo") {
      const demand = Number(item.inputs?.recordedAnnualQty?.value) || 0;
      if (!(demand > 0)) return;
      if (document.status === "no_rule") { push(item, document.reason?.code, true, demand); return; }
      const recipe = recipeByCode.get(item.supplierCode);
      if (recipe?.events?.calibrationEvents === null) push(item, "CALIBRATION_NOT_DECLARED", false, demand);
      if (recipe?.events?.qcRuns === null) push(item, "QC_NOT_DECLARED", false, demand);
      if (recipe?.events && !recipe.events.sampleVolumeUl) push(item, "SAMPLE_VOLUME_MISSING", false, demand);
      if (recipe && !recipe.components.length) push(item, "LINKS_MISSING", false, demand);
      return;
    }
    const usage = item.lineage?.usage;
    if (usage?.inUse === false) return;
    const impact = document.components?.reagentsUsingIt || usage?.events?.reagents || 0;
    if (document.status === "no_rule") {
      // Sin evidencia de uso solo importa si algo lo esperaba: la hoja ya se uso como evidencia.
      if (document.reason?.code !== "USAGE_NOT_DETERMINED") push(item, document.reason?.code, true, impact);
      return;
    }
    (document.incomplete || []).forEach((code) => push(item, code, false, impact));
  });
  return gaps.sort((a, b) => Number(b.blocks) - Number(a.blocks) || b.impact - a.impact || String(a.name).localeCompare(String(b.name), "es"));
}

const positiveOrNull = (value) => {
  const number = finiteNumberOrNull(value);
  return number !== null && number > 0 ? number : null;
};

// Modelo del equipo para la simulacion de escenarios (consumableSimulation.js): lo que dicen las
// fichas y la estadistica del cliente, sin sorteos. Solo entran reactivos con demanda y ficha con
// pruebas por kit, y los calibradores, controles y materiales que el documento pudo calcular.
function buildSimulationModel({ equipment, items, data, environment, specsByCode, overridesByCode }) {
  const months = finiteNumberOrNull(data.requirements?.projected_deadline_months);
  if (!(months > 0)) return null;
  const reagents = [];
  items.forEach((item) => {
    if (item.itemType !== "reactivo") return;
    const annualQty = positiveOrNull(item.inputs?.recordedAnnualQty?.value);
    const spec = specsByCode.get(item.supplierCode);
    const testsPerPack = positiveOrNull(spec?.tests_per_pack);
    if (!annualQty || !testsPerPack) return;
    const manufacturer = manufacturerValues(spec, item.equipmentName);
    const effective = effectiveValues(manufacturer, overridesByCode.get(item.supplierCode)?.overrides || {});
    const events = data.documentEvents?.byReagent.get(`${item.equipmentId}::${item.supplierCode}`) || null;
    const links = spec.parameters?.linked_products || {};
    const codes = (group) => (links[group] || []).map(normalizeCode).filter(Boolean);
    const declaredEvents = manufacturer.calibration?.events || [];
    reagents.push({
      key: `reactivo::${item.supplierCode}`,
      itemType: "reactivo",
      code: item.supplierCode,
      name: item.name,
      unit: "kit",
      deterministicQuantity: item.status === "calculated" ? item.quantity : null,
      processDemand: processDemandOf(annualQty, months, data.conventions),
      // Dato real del cliente: la simulacion no le suma error de estadistica.
      fromSheet: item.demandSource === "sheet",
      testsPerPack,
      onboardDays: positiveOrNull(effective.onboardDays),
      calibrationIntervalDays: positiveOrNull(effective.calibrationIntervalDays),
      calibrationDeclared: Boolean(effective.calibrationIntervalDays) || declaredEvents.length > 0,
      lotChangeDeclared: declaredEvents.includes("reagent_lot_change"),
      replicates: events?.replicates || 1,
      calibratorLevels: events?.components?.calibratorLevels || 1,
      qcIntervalHours: positiveOrNull(effective.qcIntervalHours),
      qcAfterCalibration: manufacturer.qcAfterCalibration === true,
      qcPerKit: manufacturer.qcPerKit === true,
      sampleVolumeUl: positiveOrNull(spec.parameters?.sample_volume_ul),
      calibrators: codes("calibradores"),
      controls: codes("controles"),
    });
  });
  const components = [];
  // Prediccion por consumo real de otros procesos, para todos los productos de una vez. El manual del
  // equipo se resuelve aparte (con el entorno del laboratorio), por eso aqui solo cuentan las referencias.
  const referenceByKey = new Map();
  if (data.references?.length) {
    // Solo productos en uso: si ningun reactivo con demanda lo necesita, el cliente no lo consume.
    const candidates = items.filter((item) => item.itemType !== "reactivo" && item.lineage?.usage?.inUse !== false).map((item) => ({
      key: `${item.itemType}::${item.supplierCode}`, code: String(item.supplierCode).replace(/^0+/, ""), name: item.name,
      // Las referencias son de analizadores de quimica/inmuno: otro tipo de equipo (orina, hematologia...)
      // queda en su propia familia y no hereda su mediana.
      itemType: item.itemType, module: !item.family || REFERENCE_EQUIPMENT_FAMILIES.has(item.family)
        ? referenceConsumption.__testables.moduleOf(item.name || "") : item.family,
      inUse: item.lineage?.usage?.inUse === true,
    }));
    referenceConsumption.predictFromReferences(candidates, data.references, { months })
      // La mediana de la familia (sin el mismo producto en ningun cliente) solo con uso confirmado.
      .filter((line) => line.basis.startsWith("reference_") && line.prediction !== null && (line.basis !== "reference_family_median" || line.inUse))
      .forEach((line) => referenceByKey.set(line.key, { quantity: line.prediction, basis: line.basis, detail: line.detail }));
  }
  items.forEach((item) => {
    if (item.itemType === "reactivo") return;
    const document = item.sources?.officialDocument;
    const formulaQuantity = item.sources?.auditedFormula?.status === "calculated" ? item.sources.auditedFormula.quantity : null;
    const documentCalculated = document?.status === "calculated" && document.quantity > 0;
    const historyQuantity = data.deliveryHistory?.get(`${item.itemType}::${String(item.supplierCode).replace(/^0+/, "")}`) ?? null;
    // Sin ficha, sin historial y sin referencia (equipo con pocas variables): calendario de QC del laboratorio.
    const withoutEvidence = !(historyQuantity > 0) && !documentCalculated && !(formulaQuantity > 0)
      && document?.basis !== "equipment_manual" && !specsByCode.get(item.supplierCode);
    const reference = referenceByKey.get(`${item.itemType}::${item.supplierCode}`)
      || (withoutEvidence ? predictByQcCalendar({ itemType: item.itemType, unitsPerPack: item.unitsPerPack, months, environment }) : null);
    // Lo entregado de verdad (por el cliente, o por otros clientes): entra aunque la ficha no permita calcularlo.
    if ((historyQuantity > 0 || reference) && !documentCalculated && !(formulaQuantity > 0) && document?.basis !== "equipment_manual") {
      components.push({
        key: `${item.itemType}::${item.supplierCode}`, itemType: item.itemType, code: item.supplierCode, name: item.name,
        unit: "presentacion", deterministicQuantity: null, formulaQuantity: null, historyQuantity, reference,
      });
      return;
    }
    // Entra si el documento lo calcula, o si la formula validada lo pide aunque a la ficha le falten
    // datos para simularlo (en ese caso la prediccion es la formula, sin rango).
    if (!documentCalculated && !(formulaQuantity > 0)) return;
    // Regla del manual del equipo (lampara, electrodos, estandares ISE): cantidad fija, sin simular.
    if (document?.basis === "equipment_manual") {
      // Electrodos y ISE Diluent dependen de las muestras ISE: sin el dato del laboratorio se
      // simulan (la calibracion aprende la fraccion); con el dato, o en partes por tiempo, es fijo.
      const kind = MANUAL_RULE_BY_CODE[String(item.supplierCode).replace(/^0+/, "")];
      const iseDependent = ["iseElectrode", "iseDiluent"].includes(kind);
      const known = !(document.incomplete || []).includes("ise_tests");
      components.push({
        key: `${item.itemType}::${item.supplierCode}`,
        itemType: item.itemType,
        code: item.supplierCode,
        name: item.name,
        unit: document.unit || "envase",
        deterministicQuantity: document.quantity,
        formulaQuantity,
        manualQuantity: iseDependent && !known ? null : document.quantity,
        manualKind: iseDependent ? kind : null,
        historyQuantity,
        reference,
      });
      return;
    }
    const spec = specsByCode.get(item.supplierCode) || null;
    if (!spec && !(formulaQuantity > 0)) return;
    const manufacturer = spec ? manufacturerValues(spec, item.equipmentName) : {};
    const effective = spec ? effectiveValues(manufacturer, overridesByCode.get(item.supplierCode)?.overrides || {}) : {};
    const containersPerPack = positiveOrNull(spec?.containers_per_pack);
    components.push({
      key: `${item.itemType}::${item.supplierCode}`,
      itemType: item.itemType,
      code: item.supplierCode,
      name: item.name,
      unit: containersPerPack ? "presentacion" : "envase",
      deterministicQuantity: documentCalculated ? document.quantity : null,
      // Formula validada (tabla base auditada): cuando existe, es la base de la prediccion.
      formulaQuantity,
      stabilityDays: positiveOrNull(effective.openDays) || positiveOrNull(effective.onboardDays),
      frozenDays: positiveOrNull(spec?.parameters?.stability_frozen_once_days),
      containerVolumeMl: positiveOrNull(spec?.container_volume_ml),
      containersPerPack,
      singleUse: manufacturer.singleUse === true,
      historyQuantity,
      reference,
    });
  });
  if (!reagents.length && !components.length) return null;
  return {
    equipmentId: Number(equipment.equipment_id),
    equipmentCode: equipment.equipment_code || null,
    equipmentName: equipment.equipment_name || null,
    months,
    conventions: data.conventions,
    environment: {
      workDaysPerWeek: positiveOrNull(environment?.work_days_per_week),
      shifts: positiveOrNull(environment?.shifts_per_day),
      hoursPerShift: positiveOrNull(environment?.hours_per_shift),
      laboratoryRunsPerDay: ((positiveOrNull(environment?.quality_controls_per_shift) || 0) * (positiveOrNull(environment?.shifts_per_day) || 0)) || null,
      controlLevels: positiveOrNull(environment?.control_levels),
      // Estadisticas del laboratorio (jefe_servicio o referencia de procesos parecidos), en fraccion.
      rerunRate: data.labStatistics?.rerun_rate_pct >= 0 ? data.labStatistics.rerun_rate_pct / 100 : null,
      qcFailureRate: data.labStatistics?.qc_failure_rate_pct >= 0 ? data.labStatistics.qc_failure_rate_pct / 100 : null,
      iseTests: data.labStatistics?.ise_tests_per_year > 0 ? (data.labStatistics.ise_tests_per_year * months) / 12 : null,
    },
    reagents,
    components,
  };
}

function effectiveInput(value, overrideValue, manufacturerValue, overrideField) {
  return {
    value,
    origin: overrideValue !== null && overrideValue !== undefined && overrideValue !== ""
      ? `bc_lab_product_parameters.overrides.${overrideField}`
      : manufacturerValue !== null && manufacturerValue !== undefined
        ? "catalog_consumable_specs"
        : null,
  };
}

function specInput(spec, field) {
  const value = spec?.[field];
  return {
    value: value === undefined ? null : value,
    origin: spec ? `catalog_consumable_specs.${field}` : null,
  };
}

function serializeItem(target, data, environment, spec, override) {
  const audited = auditedForProduct(data.auditedByEquipment?.get(target.equipmentId), target.supplierCode);
  const manufacturer = manufacturerValues(spec, target.equipmentName);
  const overrideValues = override?.overrides || {};
  const effective = effectiveValues(manufacturer, overrideValues);
  const processDurationMonths = finiteNumberOrNull(data.requirements?.projected_deadline_months);
  const identity = {
    equipmentId: target.equipmentId,
    equipmentCode: target.equipmentCode,
    equipmentName: target.equipmentName,
    family: target.family,
    itemType: target.itemType,
    supplierCode: target.supplierCode,
    itemKey: target.itemKey,
    name: target.name,
    unitsPerPack: target.unitsPerPack ?? null,
  };
  const inputs = {
    processDurationMonths: {
      value: processDurationMonths,
      origin: "bc_requirements.projected_deadline_months",
    },
    recordedAnnualQty: {
      value: target.annualQty,
      origin: target.itemKey ? "bc_consumption_items.annual_qty" : null,
    },
    laboratoryEnvironment: {
      value: environment,
      origin: environment ? "bc_lab_environment" : null,
    },
    manufacturerSpecification: {
      containersPerPack: specInput(spec, "containers_per_pack"),
      containerVolumeMl: specInput(spec, "container_volume_ml"),
      levelsPerPack: specInput(spec, "levels_per_pack"),
      testsPerPack: specInput(spec, "tests_per_pack"),
      singleUse: specInput(spec, "single_use"),
      replacementIntervalDays: specInput(spec, "replacement_interval_days"),
      consumptionBasis: specInput(spec, "consumption_basis"),
    },
    effectiveParameters: {
      calibrationIntervalDays: effectiveInput(
        effective.calibrationIntervalDays,
        overrideValues.calibration_interval_days,
        manufacturer?.calibrationIntervalDays,
        "calibration_interval_days",
      ),
      qcIntervalHours: effectiveInput(
        effective.qcIntervalHours,
        overrideValues.qc_interval_hours,
        manufacturer?.qcIntervalHours,
        "qc_interval_hours",
      ),
      onboardDays: effectiveInput(
        effective.onboardDays,
        overrideValues.onboard_days,
        manufacturer?.onboardDays,
        "onboard_days",
      ),
      openDays: effectiveInput(
        effective.openDays,
        overrideValues.open_days,
        manufacturer?.openDays,
        "open_days",
      ),
    },
  };
  const usage = resolveUsage(target, data.linkedUsage, audited, data.documentEvents);
  const ownEvents = target.itemType === "reactivo"
    ? data.documentEvents?.byReagent.get(`${target.equipmentId}::${target.supplierCode}`) || null
    : null;
  const evaluation = evaluateConsumableSources({
    identity,
    spec,
    manufacturer,
    effective,
    environment,
    processDurationMonths,
    annualDemand: target.annualQty,
    audited,
    usage,
    conventions: data.conventions,
    extraTests: ownEvents?.extraTests || 0,
    // Muestras ISE del proceso (estadistica del laboratorio, por año, llevada a la duracion).
    iseTests: data.labStatistics?.ise_tests_per_year > 0 && processDurationMonths > 0
      ? (data.labStatistics.ise_tests_per_year * processDurationMonths) / 12
      : null,
  });

  return {
    ...identity,
    ...evaluation,
    // Reactivos: "sheet" = demanda real del laboratorio (DET/AÑO/PROCESO del Sheet), no prediccion.
    demandSource: target.itemType === "reactivo" ? target.demandSource || "business_case" : null,
    inputs,
    specVersion: spec ? {
      id: spec.id,
      validFrom: spec.valid_from,
      validTo: spec.valid_to || null,
    } : null,
    source: spec ? {
      type: spec.source_type || null,
      title: spec.source_title || null,
      url: spec.source_url || null,
      documentId: spec.source_document_id || null,
      documentVersion: spec.source_document_version || null,
      documentDate: spec.source_document_date || null,
    } : null,
    verification: {
      specStatus: spec?.verification_status || "missing",
      specVerified: spec?.verification_status === "verified",
      calculationVerified: evaluation.verified === true,
    },
    lineage: {
      usage,
      audited: audited ? {
        packageId: audited.packageId,
        version: audited.version,
        rowCount: audited.rows.length,
        annualQuantity: audited.annualQuantity,
        inUse: audited.inUse,
        unmodeledReason: audited.unmodeledReason,
      } : null,
      discoveredFrom: target.discoveredFrom,
      manufacturer,
      overrides: overrideValues,
      overrideUpdatedBy: override?.updated_by || null,
      overrideUpdatedAt: override?.updated_at || null,
    },
  };
}

async function buildRulesPreview({ businessCaseId, data: baseData, deterministicEquipmentResults = [], conventions = null }) {
  const deterministicByEquipment = new Map((deterministicEquipmentResults || [])
    .map((entry) => [Number(entry.equipmentId), entry]));
  const auditedByEquipment = new Map();
  (baseData.equipment || []).forEach((equipment) => {
    const equipmentId = Number(equipment.equipment_id);
    const audited = buildAuditedContext(equipment, deterministicByEquipment.get(equipmentId));
    if (audited) auditedByEquipment.set(equipmentId, audited);
  });
  // Base por tipo de compra; lo que se elija en pantalla la reemplaza.
  const data = {
    ...baseData,
    auditedByEquipment,
    conventions: resolveConventions({ ...defaultConventionsFor(baseData.context?.bc_purchase_type), ...(conventions || {}) }),
  };
  const catalogById = new Map((data.catalogItems || []).map((item) => [Number(item.catalog_id), item]));
  const initialCodes = [...new Set((data.consumptions || [])
    .map((item) => consumptionCode(item, catalogById))
    .filter(Boolean))];
  const ruleData = await loadRuleData(businessCaseId, initialCodes);
  data.labStatistics = await labStatistics.effectiveValues(businessCaseId);
  // Entregas reales del proceso anterior del cliente, llevadas a la duracion de este proceso.
  data.deliveryHistory = await deliveryHistory.realForProcess(businessCaseId, finiteNumberOrNull(data.requirements?.projected_deadline_months));
  // Consumo real de otros procesos (cliente nuevo): referenceConsumption.js.
  data.references = await referenceService.referencesFor(businessCaseId);
  const specsByCode = new Map(ruleData.specs.map((spec) => [normalizeCode(spec.supplier_code), spec]));
  const overridesByCode = new Map(ruleData.overrides.map((override) => [normalizeCode(override.supplier_code), override]));
  data.linkedUsage = buildLinkedUsage(data, specsByCode);
  const targets = buildTargets(data, specsByCode);
  data.documentEvents = buildDocumentEvents(targets, data, ruleData.environment, specsByCode, overridesByCode);
  const [validationRows, learningCases] = await Promise.all([
    validations.listForBusinessCase(businessCaseId),
    validations.listLearningCases(businessCaseId, [...new Set((data.equipment || []).map((equipment) => equipment.equipment_code).filter(Boolean))]),
  ]);
  const learningFactors = validations.buildLearningFactors(learningCases);
  const validationByKey = new Map();
  validationRows.forEach((row) => {
    const key = `${row.equipment_id}::${row.item_type}::${row.supplier_code}`;
    // La validacion de experto manda sobre el despacho cuando existen las dos.
    if (!validationByKey.has(key) || row.origin === "expert") validationByKey.set(key, row);
  });
  const byEquipment = new Map();
  const calculatedBy = (items, source) => items.filter((item) => item.sources?.[source]?.status === "calculated").length;

  (data.equipment || []).forEach((equipment) => {
    const equipmentId = Number(equipment.equipment_id);
    const items = targets
      .filter((target) => target.equipmentId === equipmentId)
      .map((target) => serializeItem(
        target,
        data,
        ruleData.environment,
        specsByCode.get(target.supplierCode) || null,
        overridesByCode.get(target.supplierCode) || null,
      ));
    items.forEach((item) => {
      const row = validationByKey.get(`${equipmentId}::${item.itemType}::${item.supplierCode}`) || null;
      item.expertValidation = row ? {
        origin: row.origin,
        validatedQuantity: Number(row.validated_qty),
        predictedAtValidation: row.predicted_qty === null ? null : Number(row.predicted_qty),
        matches: item.status === "calculated" && Number(row.validated_qty) === Number(item.quantity),
        notes: row.notes || null,
        validatedBy: row.validated_by || null,
        validatedAt: row.validated_at || null,
      } : null;
      item.learned = item.status === "calculated"
        ? validations.learnedFor(learningFactors, { equipmentCode: item.equipmentCode, itemType: item.itemType, supplierCode: item.supplierCode, quantity: item.quantity })
        : null;
    });
    const validated = items.filter((item) => item.expertValidation);
    const accuracyOf = (pick) => validations.measureAccuracy(validated
      .map((item) => ({ predicted: pick(item), validated: item.expertValidation.validatedQuantity })));
    const sourceQuantity = (item, source) => (item.sources?.[source]?.status === "calculated" ? item.sources[source].quantity : null);
    const recipes = buildRecipes(items, specsByCode, data.documentEvents);
    byEquipment.set(equipmentId, {
      mode: "shadow_read_only",
      publishable: false,
      offerWriteEnabled: false,
      selectorPolicy: "exact_no_fallback",
      conventions: data.conventions,
      summary: {
        reagentsFromSheetCount: items.filter((item) => item.demandSource === "sheet").length,
        productCount: items.length,
        calculatedCount: items.filter((item) => item.status === "calculated").length,
        noRuleCount: items.filter((item) => item.status === "no_rule").length,
        verifiedCalculationCount: items.filter((item) => item.verification.calculationVerified).length,
        auditedFormulaCount: calculatedBy(items, "auditedFormula"),
        officialDocumentCount: calculatedBy(items, "officialDocument"),
        bothSourcesCount: items.filter((item) => ["match", "differs"].includes(item.agreement?.status)).length,
        sourcesMatchCount: items.filter((item) => item.agreement?.status === "match").length,
        sourcesDifferCount: items.filter((item) => item.agreement?.status === "differs").length,
      },
      // Exactitud contra los casos validados de este Business Case (meta 99,9 %).
      accuracy: {
        targetPercent: 99.9,
        validatedCount: validated.length,
        // "primary" no: apiNormalization lo renombra a primaryEquipment.
        primaryQuantity: accuracyOf((item) => (item.status === "calculated" ? item.quantity : null)),
        auditedFormula: accuracyOf((item) => sourceQuantity(item, "auditedFormula")),
        officialDocument: accuracyOf((item) => sourceQuantity(item, "officialDocument")),
        learned: accuracyOf((item) => item.learned?.adjustedQuantity ?? null),
      },
      dataGaps: buildDataGaps(items, recipes),
      simulationModel: buildSimulationModel({
        equipment, items, data, environment: ruleData.environment, specsByCode, overridesByCode,
      }),
      recipes,
      items,
    });
  });

  return byEquipment;
}

module.exports = {
  buildRulesPreview,
  __testables: {
    normalizeItemType,
    consumptionCode,
    targetKey,
    buildTargets,
    buildRecipes,
    buildDocumentEvents,
    buildDataGaps,
    buildSimulationModel,
    buildAuditedContext,
    auditedForProduct,
    specInput,
    serializeItem,
  },
};
