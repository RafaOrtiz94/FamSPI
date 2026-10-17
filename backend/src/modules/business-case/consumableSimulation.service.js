/**
 * Simulacion de escenarios por Business Case, automatica e historica.
 *
 * - Automatica: cuando un Business Case tiene estadisticas del cliente (reactivos con demanda,
 *   plazo y equipo) y sus datos de entrada cambiaron, se simula solo. La huella de entrada cubre
 *   consumo, plazo, entorno del laboratorio, equipos, ajustes por producto, version del catalogo de
 *   fichas y version del motor. Lo dispara el job (runPending) y tambien la lectura del laboratorio.
 * - Historica: cada corrida se guarda y no se borra (bc_consumable_simulations).
 * - Reutilizable: la ultima corrida automatica de cada cliente sirve para encontrar clientes de
 *   estadistica parecida, y lo validado o despachado en ellos calibra la prediccion de este.
 * Modo sombra: no escribe en la oferta ni en el consumo del Business Case.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const pricingLab = require("./businessCasePricingLab.service");
const simulation = require("./consumableSimulation");
const validations = require("./consumableRuleValidations.service");
const calibrationService = require("./consumableCalibration.service");

// Cambiarla vuelve a simular todo: subirla cuando cambien reglas, variables o el modelo.
const ENGINE_VERSION = "2026-10-16.1";
// Con escenarios calibrados contra procesos reales se predice con mas escenarios (el numero no
// limita: corre en otro hilo).
const AUTO_SCENARIOS = 20000;
const SIMILAR_LIMIT = 5;
const HISTORY_LIMIT = 10;
const isMissingTable = (error) => String(error?.code || "") === "42P01";

// Huella de los datos del Business Case (Sheet, entorno, estadisticas del laboratorio), solo para los que tienen demanda.
const STATISTICS_SQL = `
  SELECT r.business_case_id,
         md5(concat_ws('|',
           r.projected_deadline_months,
           (SELECT string_agg(concat_ws(':', c.equipment_id, LOWER(c.item_type), COALESCE(c.item_id, c.catalog_id::text), c.annual_qty, c.planned_qty), ','
                              ORDER BY c.equipment_id, LOWER(c.item_type), c.item_id, c.catalog_id)
              FROM bc_consumption_items c WHERE c.business_case_id = r.business_case_id),
           (SELECT concat_ws(':', e.work_days_per_week, e.shifts_per_day, e.hours_per_shift, e.quality_controls_per_shift, e.control_levels)
              FROM bc_lab_environment e WHERE e.business_case_id = r.business_case_id LIMIT 1),
           (SELECT string_agg(s.equipment_id::text, ',' ORDER BY s.equipment_id)
              FROM bc_equipment_selection s WHERE s.business_case_id = r.business_case_id),
           (SELECT string_agg(p.supplier_code || '=' || p.overrides::text, ',' ORDER BY p.supplier_code)
              FROM bc_lab_product_parameters p WHERE p.business_case_id = r.business_case_id),
           (SELECT concat_ws(':', MAX(created_at), COUNT(*)) FROM catalog_consumable_specs WHERE valid_to IS NULL),
           (SELECT string_agg(concat_ws(':', st.stat_key, st.value), ',' ORDER BY st.stat_key)
              FROM bc_lab_statistics st WHERE st.business_case_id = r.business_case_id),
           (SELECT string_agg(concat_ws(':', h.item_key, h.delivered_boxes, h.period_months), ',' ORDER BY h.item_key)
              FROM bc_delivery_history h WHERE h.business_case_id = r.business_case_id),
           -- Referencias de otros procesos: si cambian, cambia la prediccion de los clientes nuevos.
           (SELECT concat_ws(':', MAX(loaded_at), COUNT(*)) FROM bc_reference_consumption),
           (SELECT concat_ws(':', MAX(created_at), COUNT(*)) FROM bc_knowledge_matrix k WHERE k.business_case_id <> r.business_case_id AND k.transferable),
           (SELECT concat_ws(':', MAX(uploaded_at), COUNT(*)) FROM bc_delivery_history o WHERE o.business_case_id <> r.business_case_id),
           (SELECT concat_ws(':', MAX(cal.created_at), COUNT(*)) FROM bc_scenario_calibrations cal
             WHERE cal.business_case_id <> r.business_case_id AND cal.equipment_id > 0),
           $1::text
         )) AS fingerprint
    FROM bc_requirements r
   WHERE r.projected_deadline_months > 0
     AND EXISTS (SELECT 1 FROM bc_consumption_items c
                  WHERE c.business_case_id = r.business_case_id AND LOWER(c.item_type) = 'reactivo' AND c.annual_qty > 0)
     AND EXISTS (SELECT 1 FROM bc_equipment_selection s WHERE s.business_case_id = r.business_case_id)`;

const seedFromFingerprint = (fingerprint) => (parseInt(String(fingerprint || "").slice(0, 8), 16) % 2147483647) || 20261014;

async function statisticsFingerprint(businessCaseId) {
  const { rows } = await db.query(`${STATISTICS_SQL} AND r.business_case_id = $2`, [ENGINE_VERSION, businessCaseId]);
  return rows[0]?.fingerprint || null;
}

async function latestAutoFingerprint(businessCaseId) {
  const { rows } = await db.query(
    `SELECT input_fingerprint FROM bc_consumable_simulations
      WHERE business_case_id = $1 AND trigger = 'auto' ORDER BY created_at DESC LIMIT 1`,
    [businessCaseId],
  );
  return rows[0]?.input_fingerprint || null;
}

async function insertRun(row) {
  await db.query(
    `INSERT INTO bc_consumable_simulations
       (business_case_id, equipment_id, equipment_code, input_fingerprint, trigger, engine_version, scenarios, seed,
        conventions, profile, result, duration_ms, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13)`,
    [row.businessCaseId, row.equipmentId, row.equipmentCode, row.fingerprint, row.trigger, ENGINE_VERSION,
      row.scenarios, row.seed, JSON.stringify(row.conventions || {}), JSON.stringify(row.profile || {}),
      JSON.stringify(row.result || {}), row.durationMs, row.createdBy],
  );
}

// Ultima corrida por equipo de este Business Case.
async function loadLatest(businessCaseId) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (equipment_id) id, equipment_id, equipment_code, input_fingerprint, trigger, scenarios, seed,
            conventions, profile, result, duration_ms, created_by, created_at
       FROM bc_consumable_simulations
      WHERE business_case_id = $1 AND equipment_id > 0
      ORDER BY equipment_id, created_at DESC`,
    [businessCaseId],
  );
  return rows;
}

async function loadHistory(businessCaseId, equipmentId) {
  const { rows } = await db.query(
    `SELECT id, trigger, scenarios, created_by, created_at, input_fingerprint, result->'products' AS products
       FROM bc_consumable_simulations
      WHERE business_case_id = $1 AND equipment_id = $2
      ORDER BY created_at DESC LIMIT $3`,
    [businessCaseId, equipmentId, HISTORY_LIMIT],
  );
  return rows.map((row) => {
    const products = Array.isArray(row.products) ? row.products : [];
    const total = (type) => products.filter((product) => product.itemType === type).reduce((sum, product) => sum + (Number(product.p90) || 0), 0);
    return {
      id: Number(row.id),
      trigger: row.trigger,
      scenarios: row.scenarios,
      createdBy: row.created_by,
      createdAt: row.created_at,
      fingerprint: String(row.input_fingerprint || "").slice(0, 8),
      productCount: products.length,
      p90Totals: { reactivo: total("reactivo"), calibrador: total("calibrador"), control: total("control"), material: total("material") },
    };
  });
}

// Ultima corrida automatica de cada otro cliente del mismo equipo: base del historico reutilizable.
async function loadCandidates(businessCaseId, equipmentCode) {
  if (!equipmentCode) return [];
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (s.business_case_id) s.business_case_id, s.profile, s.result, s.created_at
         FROM bc_consumable_simulations s
        WHERE s.equipment_code = $1 AND s.business_case_id <> $2 AND s.trigger = 'auto' AND s.equipment_id > 0
        ORDER BY s.business_case_id, s.created_at DESC
     ) latest
     LEFT JOIN LATERAL (SELECT client_name FROM v_business_cases_complete v WHERE v.business_case_id = latest.business_case_id LIMIT 1) v ON true
     LIMIT 500`,
    [equipmentCode, businessCaseId],
  );
  return rows;
}

async function loadValidatedByClient(businessCaseIds) {
  if (!businessCaseIds.length) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT business_case_id, item_type, supplier_code, validated_qty, origin
         FROM bc_consumable_rule_validations WHERE business_case_id = ANY($1::uuid[])`,
      [businessCaseIds],
    );
    const byClient = new Map();
    rows.forEach((row) => {
      const key = `${row.business_case_id}::${row.item_type}::${row.supplier_code}`;
      if (!byClient.has(key) || row.origin === "expert") byClient.set(key, Number(row.validated_qty));
    });
    return byClient;
  } catch (error) {
    if (isMissingTable(error)) return new Map();
    throw error;
  }
}

/**
 * Puro. Prediccion automatica por producto: el P90 de la simulacion, calibrado con el historico
 * cuando clientes parecidos tienen la cantidad real (validada o despachada): factor real / P50 de
 * su simulacion, ponderado por cercania del perfil, aplicado al P50 y al P90 de este cliente.
 */
function predictFromHistory(product) {
  // Reactivo con DET/AÑO/PROCESO del Sheet: no se predice, es la cantidad que da su demanda real.
  if (product.fromSheet && Number.isFinite(Number(product.deterministicQuantity))) {
    return { quantity: Number(product.deterministicQuantity), basis: "sheet_demand", calibratedWith: 0, factor: null };
  }
  // El mismo cliente ya consumio esto en su proceso anterior (entregas reales, llevadas a la duracion
  // de este proceso): es la mejor evidencia que existe, por encima de cualquier formula o simulacion.
  if (Number(product.historyQuantity) > 0) {
    return { quantity: Math.ceil(Number(product.historyQuantity) - 1e-9), upper: null, basis: "client_history", calibratedWith: 0, factor: null };
  }
  // Parte o consumible del equipo con intervalo de cambio del manual: no se predice, se cuenta.
  if (Number(product.manualQuantity) > 0) {
    return { quantity: Number(product.manualQuantity), basis: "equipment_manual", calibratedWith: 0, factor: null };
  }
  // Cliente nuevo: consumo real de otros procesos (mismo codigo, mismo nombre o mediana de la familia).
  // Verificado dejando uno fuera (scripts/consumable-prediction/verifyCases.js): Tena error 51 % / total
  // +19 %, Latacunga 61 % / -3 %, contra 79 % de la simulacion; el especialista 56-59 %.
  if (product.reference && Number.isFinite(Number(product.reference.quantity))) {
    return { quantity: Number(product.reference.quantity), upper: null, basis: product.reference.basis, detail: product.reference.detail, calibratedWith: 0, factor: null };
  }
  const median = Number.isFinite(Number(product.p50)) && product.p50 !== null ? Number(product.p50) : null;
  // Escenarios calibrados contra procesos reales parecidos: la mediana de los que se acercaron.
  // Evidencia (dejar uno fuera, 5 Business Case con PRODUCTO A ENTREGAR real, 200 000 escenarios
  // por proceso): error 89 % frente a 125 % de la regla anterior (controles 111 % / 199 %,
  // calibradores 82 % / 179 %, materiales 86 % / 101 %). Lo validado por jefe_servicio entra a la
  // calibracion como real, por eso ya no se corrige aparte con clientes parecidos.
  if (product.calibrated && median !== null) {
    return { quantity: median, upper: product.p90 ?? null, basis: "calibrated_scenarios", calibratedWith: 0, factor: null };
  }
  // Sin calibracion: la mediana de la simulacion acierta mas que el P90 y que la formula (110 % frente
  // a 125 % en la misma prueba).
  if (median !== null) return { quantity: median, upper: product.p90 ?? null, basis: "simulation_p50", calibratedWith: 0, factor: null };
  if (Number.isFinite(Number(product.formulaQuantity)) && product.formulaQuantity !== null) {
    return { quantity: Number(product.formulaQuantity), basis: "validated_formula", calibratedWith: 0, factor: null };
  }
  return { quantity: product.p90 ?? null, basis: "simulation_p90", calibratedWith: 0, factor: null };
}

async function attachSimilar(businessCaseId, profile, result) {
  const candidates = (await loadCandidates(businessCaseId, profile.equipmentCode))
    .map((row) => ({ ...row, distance: simulation.profileDistance(profile, row.profile || {}) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, SIMILAR_LIMIT);
  const validatedByClient = await loadValidatedByClient(candidates.map((row) => row.business_case_id));
  const similarClients = candidates.map((row) => ({
    businessCaseId: row.business_case_id,
    clientName: row.client_name || null,
    distance: row.distance,
    profile: row.profile,
    simulatedAt: row.created_at,
  }));
  const products = (result.products || []).map((product) => {
    const matches = candidates.map((row) => {
      const other = (row.result?.products || []).find((entry) => entry.key === product.key);
      const validated = validatedByClient.get(`${row.business_case_id}::${product.itemType}::${product.supplierCode}`);
      if (!other && validated === undefined) return null;
      return { p50: other?.p50 ?? null, p90: other?.p90 ?? null, validated: validated ?? null, distance: row.distance };
    }).filter(Boolean);
    const average = (field) => {
      const values = matches.map((match) => match[field]).filter((value) => value !== null && value !== undefined);
      return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
    };
    return {
      ...product,
      similar: matches.length
        ? { clients: matches.length, p50: average("p50"), p90: average("p90"), validated: average("validated"), validatedClients: matches.filter((match) => match.validated !== null).length }
        : null,
      prediction: predictFromHistory(product),
    };
  });
  return { similarClients, products };
}

function measureCoverage(products, validationRows, equipmentId) {
  const byKey = new Map(validationRows
    .filter((row) => Number(row.equipment_id) === Number(equipmentId))
    .map((row) => [`${row.item_type}::${row.supplier_code}`, Number(row.validated_qty)]));
  const pairs = products
    .filter((product) => byKey.has(product.key))
    .map((product) => ({ product, validated: byKey.get(product.key) }));
  return {
    validatedCount: pairs.length,
    withinP10P90: pairs.filter(({ product, validated }) => validated >= product.p10 && validated <= product.p90).length,
    p50: validations.measureAccuracy(pairs.map(({ product, validated }) => ({ predicted: product.p50, validated }))),
    p90: validations.measureAccuracy(pairs.map(({ product, validated }) => ({ predicted: product.p90, validated }))),
    prediction: validations.measureAccuracy(pairs.map(({ product, validated }) => ({ predicted: product.prediction?.quantity ?? null, validated }))),
  };
}

async function present(businessCaseId, row, validationRows) {
  const { similarClients, products } = await attachSimilar(businessCaseId, row.profile || {}, row.result || {});
  return {
    equipmentId: Number(row.equipment_id),
    equipmentCode: row.equipment_code,
    equipmentName: row.result?.equipmentName || null,
    trigger: row.trigger,
    scenarios: row.scenarios,
    seed: Number(row.seed),
    durationMs: row.duration_ms,
    conventions: row.conventions,
    profile: row.profile,
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    variables: row.result?.variables || simulation.SCENARIO_VARIABLES,
    sampledVariables: row.result?.sampledVariables || null,
    recommendedPercentile: row.result?.recommendedPercentile || 90,
    products,
    similarClients,
    coverage: measureCoverage(products, validationRows, row.equipment_id),
    history: await loadHistory(businessCaseId, row.equipment_id),
  };
}

/**
 * Simula y guarda una corrida nueva en el historico.
 * trigger 'auto' usa las convenciones por defecto, 5000 escenarios y una semilla derivada de la
 * huella (misma entrada = mismo resultado). 'manual' acepta convenciones y escenarios.
 */
async function simulateBusinessCase(businessCaseId, { trigger = "auto", scenarios, seed, conventions, fingerprint, user } = {}) {
  const inputFingerprint = fingerprint || await statisticsFingerprint(businessCaseId);
  const isAuto = trigger === "auto";
  const preview = await pricingLab.buildPreview(businessCaseId, { conventions: isAuto ? null : conventions });
  const runSeed = isAuto || !(Number(seed) > 0) ? seedFromFingerprint(inputFingerprint) : Number(seed);
  const createdBy = isAuto ? "automatico" : user?.email || null;
  let simulated = 0;
  for (const entry of preview.equipment || []) {
    const model = entry.ruleEngine?.simulationModel;
    if (!model) continue;
    // Escenarios aceptados de procesos reales parecidos (nunca de este mismo): si existen, se sortea
    // solo entre ellos.
    const posterior = await calibrationService.poolFor(businessCaseId, model);
    // En un hilo aparte: miles de escenarios no deben frenar las demas peticiones del backend.
    const run = await simulation.runSimulationAsync(model, { scenarios: isAuto ? AUTO_SCENARIOS : scenarios, seed: runSeed, posterior });
    await insertRun({
      businessCaseId,
      equipmentId: model.equipmentId,
      equipmentCode: model.equipmentCode,
      fingerprint: inputFingerprint,
      trigger,
      scenarios: run.scenarios,
      seed: runSeed,
      conventions: model.conventions,
      profile: simulation.buildProfile(model),
      result: { ...run, equipmentName: model.equipmentName, months: model.months },
      durationMs: run.durationMs,
      createdBy,
    });
    simulated += 1;
  }
  // Sin modelo simulable: se deja constancia para no reintentar hasta que cambien los datos.
  if (!simulated && isAuto) {
    await insertRun({
      businessCaseId, equipmentId: 0, equipmentCode: null, fingerprint: inputFingerprint, trigger, scenarios: 0, seed: runSeed,
      conventions: {}, profile: {}, result: { skipped: "NO_SIMULATION_MODEL" }, durationMs: 0, createdBy,
    });
  }
  return { simulated, fingerprint: inputFingerprint };
}

// Simula si el Business Case tiene estadisticas y cambiaron desde la ultima corrida automatica.
async function ensureCurrent(businessCaseId) {
  const fingerprint = await statisticsFingerprint(businessCaseId);
  if (!fingerprint) return { status: "no_statistics" };
  if ((await latestAutoFingerprint(businessCaseId)) === fingerprint) return { status: "current" };
  await simulateBusinessCase(businessCaseId, { trigger: "auto", fingerprint });
  return { status: "simulated" };
}

async function getForBusinessCase(businessCaseId) {
  let automatic = { status: "unavailable" };
  try {
    automatic = await ensureCurrent(businessCaseId);
  } catch (error) {
    if (isMissingTable(error)) return { stored: false, automatic, minScenarios: simulation.MIN_SCENARIOS, equipment: [] };
    throw error;
  }
  const [rows, validationRows] = await Promise.all([loadLatest(businessCaseId), validations.listForBusinessCase(businessCaseId)]);
  const equipment = [];
  for (const row of rows) equipment.push(await present(businessCaseId, row, validationRows));
  return { stored: true, automatic, minScenarios: simulation.MIN_SCENARIOS, equipment };
}

async function runForBusinessCase(businessCaseId, { scenarios, seed, conventions } = {}, user = {}) {
  await simulateBusinessCase(businessCaseId, { trigger: "manual", scenarios, seed, conventions, user });
  const [rows, validationRows] = await Promise.all([loadLatest(businessCaseId), validations.listForBusinessCase(businessCaseId)]);
  const equipment = [];
  for (const row of rows) equipment.push(await present(businessCaseId, row, validationRows));
  return { stored: true, automatic: { status: "manual" }, minScenarios: simulation.MIN_SCENARIOS, equipment };
}

/**
 * Job: simula los Business Case con estadisticas nuevas o cambiadas. Los mas antiguos primero.
 */
async function runPending({ limit = 10 } = {}) {
  const summary = { pending: 0, simulated: 0, failed: 0 };
  // Primero se calibra contra lo real nuevo: las predicciones de los demas lo usan.
  try {
    summary.calibration = await calibrationService.calibratePending();
  } catch (error) {
    logger.error({ error: error?.message || String(error) }, "[BC][CALIBRATION] Fallo la calibracion pendiente");
  }
  let rows;
  try {
    ({ rows } = await db.query(
      `WITH stats AS (${STATISTICS_SQL}),
            latest AS (
              SELECT DISTINCT ON (business_case_id) business_case_id, input_fingerprint, created_at
                FROM bc_consumable_simulations WHERE trigger = 'auto'
               ORDER BY business_case_id, created_at DESC)
       SELECT stats.business_case_id, stats.fingerprint
         FROM stats LEFT JOIN latest ON latest.business_case_id = stats.business_case_id
        WHERE latest.input_fingerprint IS DISTINCT FROM stats.fingerprint
        ORDER BY latest.created_at NULLS FIRST
        LIMIT $2`,
      [ENGINE_VERSION, limit],
    ));
  } catch (error) {
    if (isMissingTable(error)) return { ...summary, skipped: "MIGRATION_327_MISSING" };
    throw error;
  }
  summary.pending = rows.length;
  for (const row of rows) {
    try {
      await simulateBusinessCase(row.business_case_id, { trigger: "auto", fingerprint: row.fingerprint });
      summary.simulated += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error({ businessCaseId: row.business_case_id, error: error?.message || String(error) }, "[BC][SIMULATION] Fallo la simulacion automatica");
    }
  }
  return summary;
}

module.exports = {
  ENGINE_VERSION,
  runPending,
  ensureCurrent,
  getForBusinessCase,
  runForBusinessCase,
  __testables: { measureCoverage, predictFromHistory, seedFromFingerprint },
};
