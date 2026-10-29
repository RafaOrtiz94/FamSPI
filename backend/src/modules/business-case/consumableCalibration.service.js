/**
 * Calibracion de la simulacion contra cantidades reales, por Business Case y equipo.
 *
 * Real = lo entregado en el proceso anterior del cliente (bc_delivery_history, llevado a la duracion
 * del proceso). Ni PRODUCTO A ENTREGAR del Sheet ni lo validado por jefe_servicio son verdad: son el
 * calculo del especialista (contra lo entregado en Latacunga tuvo 52 % de error).
 * Los escenarios aceptados se guardan en bc_scenario_calibrations y alimentan las predicciones de
 * los demas Business Case (nunca la del mismo).
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const simulation = require("./consumableSimulation");
const calibration = require("./consumableCalibration");
const deliveryHistory = require("./deliveryHistory.service");

const CALIBRATION_SCENARIOS = 200000;
const MIN_REAL_PRODUCTS = 10;
// Cambiarla recalibra todo (cambio de variables o del modelo de simulacion).
const CALIBRATION_VERSION = "2026-10-15.4";

const isMissingTable = (error) => String(error?.code || "") === "42P01";
const normalizeCode = (value) => String(value ?? "").replace(/\D/g, "").replace(/^0+/, "");

// Business Case con verdad utilizable: historial de entregas reales (bc_delivery_history) o
// validaciones de jefe_servicio. PRODUCTO A ENTREGAR del Sheet es el calculo del especialista para el
// proceso, no lo que se consumio: no entra como verdad.
const REAL_SQL = `
  WITH truth AS (
    SELECT business_case_id, COUNT(*) AS products FROM bc_delivery_history WHERE supplier_code IS NOT NULL AND delivered_boxes > 0 GROUP BY 1
  ), quality AS (SELECT business_case_id, SUM(products) AS products FROM truth GROUP BY 1)
  SELECT q.business_case_id,
         md5(concat_ws('|', $1::text,
           (SELECT string_agg(concat_ws(':', h.item_key, h.delivered_boxes, h.period_months), ',' ORDER BY h.item_key)
              FROM bc_delivery_history h WHERE h.business_case_id = q.business_case_id),
           (SELECT string_agg(concat_ws(':', v.equipment_id, v.item_type, v.supplier_code, v.validated_qty), ',' ORDER BY v.equipment_id, v.item_type, v.supplier_code)
              FROM bc_consumable_rule_validations v WHERE v.business_case_id = q.business_case_id AND v.origin = 'expert'),
           -- Solo datos propios del Business Case (no las calibraciones de otros): si no, recalibrar uno
           -- re-simularia a los demas y se recalibrarian en ciclo.
           (SELECT string_agg(concat_ws(':', c.equipment_id, c.item_id, c.annual_qty), ',' ORDER BY c.equipment_id, c.item_id)
              FROM bc_consumption_items c WHERE c.business_case_id = q.business_case_id AND LOWER(c.item_type) = 'reactivo'),
           (SELECT concat_ws(':', e.work_days_per_week, e.shifts_per_day, e.hours_per_shift, e.quality_controls_per_shift, e.control_levels)
              FROM bc_lab_environment e WHERE e.business_case_id = q.business_case_id LIMIT 1),
           (SELECT projected_deadline_months FROM bc_requirements rq WHERE rq.business_case_id = q.business_case_id LIMIT 1),
           (SELECT string_agg(concat_ws(':', st.stat_key, st.value), ',' ORDER BY st.stat_key)
              FROM bc_lab_statistics st WHERE st.business_case_id = q.business_case_id),
           (SELECT concat_ws(':', MAX(created_at), COUNT(*)) FROM catalog_consumable_specs WHERE valid_to IS NULL)
         )) AS fingerprint
    FROM quality q
   WHERE q.products >= ${MIN_REAL_PRODUCTS}`;

// Verdad = solo lo realmente entregado. Lo que valida jefe_servicio es lo que se va a entregar (un plan,
// como PRODUCTO A ENTREGAR), no lo consumido: no entra como verdad.
async function loadReal(businessCaseId, equipmentId, processMonths) {
  return new Map(await deliveryHistory.realForProcess(businessCaseId, processMonths));
}

function calibrateAsync(model, real, options) {
  const { Worker } = require("worker_threads");
  return new Promise((resolve, reject) => {
    const worker = new Worker(require("path").join(__dirname, "consumableSimulation.worker.js"), {
      workerData: { task: "calibrate", model, real: [...real], options },
    });
    worker.once("message", (message) => {
      if (message?.ok) resolve(message.result);
      else reject(new Error(message?.message || "La calibracion fallo"));
      worker.terminate().catch(() => {});
    });
    worker.once("error", reject);
  });
}

async function calibrateBusinessCase(businessCaseId, fingerprint) {
  // Carga perezosa: el servicio de simulacion tambien usa este modulo.
  const pricingLab = require("./businessCasePricingLab.service");
  const preview = await pricingLab.buildPreview(businessCaseId);
  let calibrated = 0;
  for (const entry of preview.equipment || []) {
    const model = entry.ruleEngine?.simulationModel;
    if (!model) continue;
    const real = await loadReal(businessCaseId, model.equipmentId, model.months);
    if (real.size < MIN_REAL_PRODUCTS) continue;
    const result = await calibrateAsync(model, real, { scenarios: CALIBRATION_SCENARIOS });
    if (result.status !== "calibrated") continue;
    await db.query(
      `INSERT INTO bc_scenario_calibrations
         (business_case_id, equipment_id, equipment_code, real_fingerprint, profile, accepted, scenarios,
          comparable_products, best_distance, accepted_median_distance, prior_median_distance, duration_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (business_case_id, equipment_id) DO UPDATE SET
         equipment_code = EXCLUDED.equipment_code, real_fingerprint = EXCLUDED.real_fingerprint,
         profile = EXCLUDED.profile, accepted = EXCLUDED.accepted, scenarios = EXCLUDED.scenarios,
         comparable_products = EXCLUDED.comparable_products, best_distance = EXCLUDED.best_distance,
         accepted_median_distance = EXCLUDED.accepted_median_distance, prior_median_distance = EXCLUDED.prior_median_distance,
         duration_ms = EXCLUDED.duration_ms, created_at = NOW()`,
      [
        businessCaseId, model.equipmentId, model.equipmentCode || null, fingerprint,
        JSON.stringify(simulation.buildProfile(model)), JSON.stringify(result.accepted), result.scenarios,
        result.comparableProducts, result.bestDistance, result.acceptedMedianDistance, result.priorMedianDistance, result.durationMs,
      ],
    );
    logger.info({
      businessCaseId, equipmentId: model.equipmentId, scenarios: result.scenarios, accepted: result.accepted.length,
      priorMedianDistance: result.priorMedianDistance, acceptedMedianDistance: result.acceptedMedianDistance,
    }, "[BC][CALIBRATION] Escenarios calibrados contra cantidades reales");
    calibrated += 1;
  }
  // Sin equipo calibrable se deja constancia con la huella, para no reintentar hasta que cambie.
  if (!calibrated) {
    await db.query(
      `INSERT INTO bc_scenario_calibrations (business_case_id, equipment_id, real_fingerprint, created_at)
       VALUES ($1, 0, $2, NOW())
       ON CONFLICT (business_case_id, equipment_id) DO UPDATE SET real_fingerprint = EXCLUDED.real_fingerprint, created_at = NOW()`,
      [businessCaseId, fingerprint],
    );
  }
  return calibrated;
}

/** Job: calibra los Business Case con cantidades reales nuevas o cambiadas. */
async function calibratePending({ limit = 5 } = {}) {
  const summary = { pending: 0, calibrated: 0, failed: 0 };
  let rows;
  try {
    ({ rows } = await db.query(
      `WITH real AS (${REAL_SQL}),
            latest AS (SELECT business_case_id, MAX(real_fingerprint) AS fingerprint, MAX(created_at) AS created_at
                         FROM bc_scenario_calibrations GROUP BY 1)
       SELECT real.business_case_id, real.fingerprint
         FROM real LEFT JOIN latest ON latest.business_case_id = real.business_case_id
        WHERE latest.fingerprint IS DISTINCT FROM real.fingerprint
        ORDER BY latest.created_at NULLS FIRST
        LIMIT $2`,
      [CALIBRATION_VERSION, limit],
    ));
  } catch (error) {
    if (isMissingTable(error)) return { ...summary, skipped: "MIGRATION_330_MISSING" };
    throw error;
  }
  // Calibraciones de Business Case que ya no tienen verdad (ej. hechas contra PRODUCTO A ENTREGAR
  // antes de que existiera el historial de entregas) no deben alimentar predicciones.
  const { rowCount: removed } = await db.query(
    `DELETE FROM bc_scenario_calibrations WHERE business_case_id NOT IN (SELECT business_case_id FROM (${REAL_SQL}) real)`,
    [CALIBRATION_VERSION],
  );
  summary.removed = removed;
  summary.pending = rows.length;
  for (const row of rows) {
    try {
      await calibrateBusinessCase(row.business_case_id, row.fingerprint);
      summary.calibrated += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error({ businessCaseId: row.business_case_id, error: error?.message || String(error) }, "[BC][CALIBRATION] Fallo la calibracion");
    }
  }
  return summary;
}

/** Escenarios aceptados de los demas Business Case, pesados por parecido con este modelo. */
async function poolFor(businessCaseId, model) {
  try {
    const { rows } = await db.query(
      `SELECT profile, accepted FROM bc_scenario_calibrations
        WHERE business_case_id <> $1 AND equipment_id > 0 AND jsonb_array_length(accepted) > 0`,
      [businessCaseId],
    );
    return calibration.buildPool(rows, simulation.buildProfile(model), simulation.profileDistance);
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

module.exports = { calibratePending, calibrateBusinessCase, poolFor, CALIBRATION_SCENARIOS, __testables: { loadReal } };
