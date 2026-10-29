/**
 * Prediccion del motor en la seccion Determinaciones, para que Jefe de Servicio la valide.
 *
 * Los reactivos NO se predicen: salen de DET/AÑO/PROCESO del Sheet del BC. El motor predice
 * calibradores, controles y materiales con la simulacion automatica (formulas, fichas del
 * fabricante, variables del laboratorio y el historico). Jefe de Servicio acepta la prediccion o
 * la cambia explicando el motivo; cada decision queda como caso validado
 * (bc_consumable_rule_validations) y alimenta las predicciones futuras.
 */

const db = require("../../config/db");
const simulationService = require("./consumableSimulation.service");
const validations = require("./consumableRuleValidations.service");
const knowledge = require("./knowledgeMatrix");

const PREDICTED_TYPES = new Set(["calibrador", "control", "material"]);
const MIN_REASON_LENGTH = 5;
// Diferencia entre PRODUCTO A ENTREGAR del Sheet y la prediccion: se justifica con el calculo o el
// criterio usado, no con una palabra.
const MIN_JUSTIFICATION_LENGTH = 20;
const normalizeCode = (value) => String(value ?? "").replace(/D/g, "").replace(/^0+/, "");

// PRODUCTO A ENTREGAR del Sheet (planned_qty) por equipo, tipo y codigo. Vacio cuenta como 0.
async function loadSheetPlanned(businessCaseId) {
  const { rows } = await db.query(
    `SELECT equipment_id, LOWER(item_type) AS item_type, item_id, SUM(COALESCE(planned_qty, 0))::float AS planned
       FROM bc_consumption_items WHERE business_case_id = $1 GROUP BY 1, 2, 3`,
    [businessCaseId],
  );
  return new Map(rows.map((row) => [productKey(row.equipment_id, row.item_type, normalizeCode(row.item_id)), Number(row.planned)]));
}

const productKey = (equipmentId, itemType, supplierCode) => `${Number(equipmentId)}::${itemType}::${supplierCode}`;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "BC_PREDICTION_VALIDATION_INVALID";
  return error;
}

// Entregas parciales del proceso (bc_deliveries). Sin el dato, 1: el producto a entregar es el consumo.
// Con "determinacion efectiva" el excedente de una entrega se usa en la siguiente (archivo "2da ENTREGA"
// de HGP Puyo): no hay redondeo por entrega, solo por el total del proceso.
async function loadPartialDeliveries(businessCaseId) {
  try {
    const { rows } = await db.query(`SELECT delivery_type, partial_deliveries, effective_determination FROM bc_deliveries WHERE business_case_id = $1`, [businessCaseId]);
    const row = rows[0];
    if (row?.effective_determination === true) return 1;
    return row?.delivery_type === "partial_time" && Number(row.partial_deliveries) > 1 ? Number(row.partial_deliveries) : 1;
  } catch (error) {
    if (["42P01", "42703"].includes(String(error?.code || ""))) return 1;
    throw error;
  }
}

/** Puro. Cada entrega parcial va en presentaciones completas: entregas × ROUNDUP(consumo / entregas). */
function toDeliver(expected, deliveries) {
  const quantity = Number(expected);
  if (!Number.isFinite(quantity) || quantity <= 0) return Number.isFinite(quantity) ? quantity : null;
  return deliveries > 1 ? deliveries * Math.ceil(quantity / deliveries - 1e-9) : Math.ceil(quantity - 1e-9);
}

async function loadProcessMonths(businessCaseId) {
  const { rows } = await db.query("SELECT projected_deadline_months FROM bc_requirements WHERE business_case_id = $1", [businessCaseId]);
  return Number(rows[0]?.projected_deadline_months) || null;
}

// Conocimiento de jefe_servicio en OTROS procesos del mismo equipo (bc_knowledge_matrix): cuantos
// analizadores usan el producto y cuanto extra se deja por entrega. El consumo por mes declarado
// entra como referencia en referenceConsumption.service.
async function loadKnowledge(businessCaseId) {
  try {
    const { rows } = await db.query(
      `SELECT equipment_code, item_type, supplier_code, reason, value::float AS value
         FROM bc_knowledge_matrix
        WHERE business_case_id <> $1 AND transferable AND reason IN ('analyzers', 'extra_per_delivery') AND value IS NOT NULL`,
      [businessCaseId],
    );
    const byKey = new Map();
    rows.forEach((row) => {
      const key = `${row.equipment_code || ""}::${row.item_type}::${normalizeCode(row.supplier_code)}::${row.reason}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(row.value);
    });
    const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return new Map([...byKey].map(([key, values]) => [key, { value: median(values), processes: values.length }]));
  } catch (error) {
    if (String(error?.code || "") === "42P01") return new Map();
    throw error;
  }
}

async function getPredictions(businessCaseId) {
  const [simulation, validationRows, sheetPlanned, deliveries, processMonths, knowledgeByKey] = await Promise.all([
    simulationService.getForBusinessCase(businessCaseId),
    validations.listForBusinessCase(businessCaseId),
    loadSheetPlanned(businessCaseId),
    loadPartialDeliveries(businessCaseId),
    loadProcessMonths(businessCaseId),
    loadKnowledge(businessCaseId),
  ]);
  const validationByKey = new Map(validationRows
    .filter((row) => row.origin === "expert")
    .map((row) => [productKey(row.equipment_id, row.item_type, row.supplier_code), row]));
  const items = [];
  (simulation.equipment || []).forEach((equipment) => {
    (equipment.products || []).forEach((product) => {
      if (!PREDICTED_TYPES.has(product.itemType)) return;
      const validation = validationByKey.get(productKey(equipment.equipmentId, product.itemType, product.supplierCode)) || null;
      // El motor predice el consumo; lo que se entrega (y se compara con el Sheet) lleva el redondeo por
      // entrega y lo que jefe_servicio dejo en otros procesos del mismo equipo.
      const knowledgeKey = (reason) => `${equipment.equipmentCode || ""}::${product.itemType}::${normalizeCode(product.supplierCode)}::${reason}`;
      const analyzers = knowledgeByKey.get(knowledgeKey("analyzers")) || null;
      const extra = knowledgeByKey.get(knowledgeKey("extra_per_delivery")) || null;
      const baseConsumption = product.prediction?.quantity ?? product.p90 ?? null;
      const expectedConsumption = baseConsumption === null ? null : (analyzers ? Math.ceil(baseConsumption * analyzers.value - 1e-9) : baseConsumption);
      let predicted = expectedConsumption === null ? null : toDeliver(expectedConsumption, deliveries);
      if (predicted !== null && extra) predicted += Math.max(deliveries, 1) * extra.value;
      const knowledgeApplied = [
        analyzers ? `lo usan ${analyzers.value} analizadores (${analyzers.processes} proceso(s))` : null,
        extra ? `${extra.value} extra por entrega (${extra.processes} proceso(s))` : null,
      ].filter(Boolean);
      const planned = sheetPlanned.has(productKey(equipment.equipmentId, product.itemType, normalizeCode(product.supplierCode)))
        ? sheetPlanned.get(productKey(equipment.equipmentId, product.itemType, normalizeCode(product.supplierCode)))
        : null;
      // Justificada: jefe_servicio valido exactamente lo del Sheet y explico el calculo o el criterio.
      const justified = Boolean(validation) && planned !== null
        && Number(validation.validated_qty) === planned && String(validation.notes || "").trim().length >= MIN_JUSTIFICATION_LENGTH;
      const differs = planned !== null && predicted !== null && Number(planned) !== Number(predicted);
      items.push({
        equipmentId: equipment.equipmentId,
        equipmentName: equipment.equipmentName,
        itemType: product.itemType,
        supplierCode: product.supplierCode,
        name: product.name,
        unit: product.unit,
        predicted,
        p50: product.p50,
        p90: product.p90,
        basis: product.prediction?.basis || "simulation_p90",
        basisDetail: product.prediction?.detail || null,
        expectedConsumption,
        partialDeliveries: deliveries,
        knowledgeApplied: knowledgeApplied.length ? knowledgeApplied.join(" · ") : null,
        equipmentCode: equipment.equipmentCode || null,
        sheetPlanned: planned,
        sheetDifference: differs ? Number(planned) - Number(predicted) : 0,
        needsJustification: differs && !justified,
        validation: validation ? {
          quantity: Number(validation.validated_qty),
          changed: Number(validation.validated_qty) !== Number(validation.predicted_qty),
          predictedAtValidation: validation.predicted_qty === null ? null : Number(validation.predicted_qty),
          reason: validation.notes || null,
          validatedBy: validation.validated_by || null,
          validatedAt: validation.validated_at || null,
        } : null,
      });
    });
  });
  return {
    automatic: simulation.automatic || null,
    reagentsFrom: "sheet",
    partialDeliveries: deliveries,
    processMonths,
    justificationReasons: knowledge.reasonCatalog(),
    simulatedAt: simulation.equipment?.[0]?.createdAt || null,
    items,
  };
}

/**
 * Valida una o varias predicciones. La cantidad predicha se toma del servidor, no del cliente.
 * Si la cantidad cambia, el motivo es obligatorio.
 */
async function validatePredictions(businessCaseId, decisions = [], user = {}) {
  const list = Array.isArray(decisions) ? decisions : [decisions];
  if (!list.length) throw badRequest("No hay predicciones para validar.");
  const current = await getPredictions(businessCaseId);
  const byKey = new Map(current.items.map((item) => [productKey(item.equipmentId, item.itemType, item.supplierCode), item]));
  const prepared = list.map((decision) => {
    const item = byKey.get(productKey(decision.equipmentId, String(decision.itemType || "").toLowerCase(), String(decision.supplierCode || "")));
    if (!item) throw badRequest("El producto no tiene prediccion del motor en este Business Case.");
    const quantity = decision.quantity === undefined || decision.quantity === null || decision.quantity === ""
      ? Number(item.predicted)
      : Number(decision.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) throw badRequest(`Cantidad no valida para ${item.name}.`);
    const changed = quantity !== Number(item.predicted);
    // Igualar lo del Sheet cuando difiere: un motivo y un dato que reproduzcan esa cantidad.
    const matchesSheet = item.sheetPlanned !== null && quantity === Number(item.sheetPlanned) && changed;
    if (matchesSheet) {
      const evaluated = knowledge.evaluateJustification(decision.justification, {
        sheetQuantity: item.sheetPlanned, expected: item.expectedConsumption, months: current.processMonths,
        deliveries: current.partialDeliveries, name: item.name,
      });
      return { item, quantity, reason: evaluated.summary, knowledge: evaluated };
    }
    const reason = String(decision.reason || "").trim();
    if (changed && reason.length < MIN_REASON_LENGTH) {
      throw badRequest(`Explique el motivo del cambio en ${item.name} (minimo ${MIN_REASON_LENGTH} caracteres).`);
    }
    return { item, quantity, reason: changed ? reason : null };
  });
  const saved = [];
  for (const { item, quantity, reason, knowledge: entry } of prepared) {
    if (entry) await saveKnowledge(businessCaseId, item, entry, current, user);
    saved.push(await validations.saveValidation(businessCaseId, {
      equipmentId: item.equipmentId,
      itemType: item.itemType,
      supplierCode: item.supplierCode,
      validatedQty: quantity,
      predictedQty: item.predicted,
      predictedSource: item.basis,
      notes: reason,
    }, user));
  }
  return { saved: saved.length };
}

async function saveKnowledge(businessCaseId, item, entry, current, user) {
  await db.query(
    `INSERT INTO bc_knowledge_matrix
       (business_case_id, equipment_id, equipment_code, item_type, supplier_code, product_name, reason, value, quantity,
        process_months, partial_deliveries, transferable, note, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
     ON CONFLICT (business_case_id, equipment_id, item_type, supplier_code) DO UPDATE SET
       reason = EXCLUDED.reason, value = EXCLUDED.value, quantity = EXCLUDED.quantity, process_months = EXCLUDED.process_months,
       partial_deliveries = EXCLUDED.partial_deliveries, transferable = EXCLUDED.transferable, note = EXCLUDED.note,
       created_by = EXCLUDED.created_by, created_at = NOW()`,
    [businessCaseId, item.equipmentId, item.equipmentCode, item.itemType, normalizeCode(item.supplierCode), item.name, entry.reason,
      entry.value, entry.computed, current.processMonths, current.partialDeliveries, entry.transferable, entry.note, user?.email || null],
  );
}

/** Productos de esos tipos cuyo PRODUCTO A ENTREGAR difiere de la prediccion sin justificar. */
async function pendingJustifications(businessCaseId, itemTypes = [...PREDICTED_TYPES]) {
  const types = new Set(itemTypes);
  const { items } = await getPredictions(businessCaseId);
  return items.filter((item) => types.has(item.itemType) && item.needsJustification);
}

module.exports = {
  getPredictions,
  validatePredictions,
  pendingJustifications,
  toDeliver,
  MIN_REASON_LENGTH,
  MIN_JUSTIFICATION_LENGTH,
  PREDICTED_TYPES,
};
