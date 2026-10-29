/**
 * Casos validados del motor de reglas de consumibles (bc_consumable_rule_validations).
 *
 * Con ellos se mide la exactitud del motor y se calcula el ajuste aprendido por producto y equipo.
 * La regla sigue siendo la base: el ajuste es un factor (real / predicho) que solo se muestra
 * cuando hay suficientes casos, y nunca cuenta el caso del propio Business Case que se esta viendo.
 */

const db = require("../../config/db");

const MIN_LEARNING_CASES = 3;
const ITEM_TYPES = new Set(["reactivo", "calibrador", "control", "material"]);

// La tabla llega con la migracion 326: sin ella el laboratorio sigue funcionando, sin validaciones.
const isMissingTable = (error) => String(error?.code || "") === "42P01";
const productKey = (equipmentCode, itemType, supplierCode) => [equipmentCode || "", itemType, supplierCode].join("::");
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "BC_RULE_VALIDATION_INVALID";
  return error;
}

async function listForBusinessCase(businessCaseId) {
  try {
    const { rows } = await db.query(
      `SELECT equipment_id, item_type, supplier_code, origin, validated_qty, predicted_qty,
              predicted_source, notes, validated_by, validated_at
         FROM bc_consumable_rule_validations
        WHERE business_case_id = $1`,
      [businessCaseId],
    );
    return rows;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

// Casos de OTROS Business Case para los mismos equipos: base del ajuste aprendido.
async function listLearningCases(businessCaseId, equipmentCodes) {
  if (!equipmentCodes.length) return [];
  try {
    const { rows } = await db.query(
      `SELECT equipment_code, item_type, supplier_code, validated_qty, predicted_qty
         FROM bc_consumable_rule_validations
        WHERE business_case_id <> $1 AND equipment_code = ANY($2::text[]) AND predicted_qty > 0`,
      [businessCaseId, equipmentCodes],
    );
    return rows;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

// Puro. Factor = Σ real / Σ predicho por producto y equipo.
function buildLearningFactors(cases, { minCases = MIN_LEARNING_CASES } = {}) {
  const totals = new Map();
  (cases || []).forEach((row) => {
    const predicted = numberOrNull(row.predicted_qty);
    const validated = numberOrNull(row.validated_qty);
    if (!(predicted > 0) || validated === null) return;
    const key = productKey(row.equipment_code, row.item_type, row.supplier_code);
    const current = totals.get(key) || { cases: 0, predicted: 0, validated: 0 };
    current.cases += 1;
    current.predicted += predicted;
    current.validated += validated;
    totals.set(key, current);
  });
  const factors = new Map();
  totals.forEach((total, key) => {
    factors.set(key, {
      cases: total.cases,
      factor: Number((total.validated / total.predicted).toFixed(4)),
      applicable: total.cases >= minCases,
      minCases,
    });
  });
  return factors;
}

function learnedFor(factors, { equipmentCode, itemType, supplierCode, quantity }) {
  const entry = factors?.get(productKey(equipmentCode, itemType, supplierCode));
  if (!entry) return null;
  return {
    ...entry,
    adjustedQuantity: entry.applicable && Number.isFinite(Number(quantity))
      ? Math.ceil(Number(quantity) * entry.factor - 1e-9)
      : null,
  };
}

// Puro. Exactitud = max(0, 100 × (1 - Σ|predicho - real| / Σ real)) sobre los casos con prediccion.
function measureAccuracy(pairs) {
  const usable = (pairs || []).filter((pair) => numberOrNull(pair.predicted) !== null && numberOrNull(pair.validated) !== null);
  if (!usable.length) return { cases: 0, exact: 0, exactPercent: null, accuracyPercent: null };
  const exact = usable.filter((pair) => Number(pair.predicted) === Number(pair.validated)).length;
  const error = usable.reduce((sum, pair) => sum + Math.abs(Number(pair.predicted) - Number(pair.validated)), 0);
  const total = usable.reduce((sum, pair) => sum + Number(pair.validated), 0);
  let accuracyPercent = null;
  if (total > 0) accuracyPercent = Number(Math.max(0, 100 * (1 - error / total)).toFixed(1));
  else if (error === 0) accuracyPercent = 100;
  else accuracyPercent = 0;
  return {
    cases: usable.length,
    exact,
    exactPercent: Number(((100 * exact) / usable.length).toFixed(1)),
    accuracyPercent,
  };
}

function normalizeInput(input = {}) {
  const itemType = String(input.itemType || "").trim().toLowerCase();
  const supplierCode = String(input.supplierCode || "").trim();
  const equipmentId = Number(input.equipmentId);
  if (!ITEM_TYPES.has(itemType)) throw badRequest("Tipo de producto no valido.");
  if (!supplierCode) throw badRequest("Falta el codigo del producto.");
  if (!Number.isInteger(equipmentId) || equipmentId <= 0) throw badRequest("Falta el equipo.");
  return { itemType, supplierCode, equipmentId };
}

async function saveValidation(businessCaseId, input = {}, user = {}) {
  const { itemType, supplierCode, equipmentId } = normalizeInput(input);
  const validatedQty = numberOrNull(input.validatedQty);
  if (validatedQty === null || validatedQty < 0) throw badRequest("La cantidad validada debe ser un numero mayor o igual a cero.");
  const { rows } = await db.query(
    `INSERT INTO bc_consumable_rule_validations
       (business_case_id, equipment_id, equipment_code, item_type, supplier_code, origin,
        validated_qty, predicted_qty, predicted_source, conventions, notes, validated_by)
     VALUES ($1, $2, $3, $4, $5, 'expert', $6, $7, $8, $9::jsonb, $10, $11)
     ON CONFLICT (business_case_id, equipment_id, item_type, supplier_code, origin)
     DO UPDATE SET validated_qty = EXCLUDED.validated_qty,
                   predicted_qty = EXCLUDED.predicted_qty,
                   predicted_source = EXCLUDED.predicted_source,
                   conventions = EXCLUDED.conventions,
                   equipment_code = EXCLUDED.equipment_code,
                   notes = EXCLUDED.notes,
                   validated_by = EXCLUDED.validated_by,
                   validated_at = NOW()
     RETURNING equipment_id, item_type, supplier_code, origin, validated_qty, predicted_qty,
               predicted_source, notes, validated_by, validated_at`,
    [
      businessCaseId,
      equipmentId,
      input.equipmentCode ? String(input.equipmentCode).slice(0, 120) : null,
      itemType,
      supplierCode,
      validatedQty,
      numberOrNull(input.predictedQty),
      input.predictedSource ? String(input.predictedSource).slice(0, 32) : null,
      JSON.stringify(input.conventions && typeof input.conventions === "object" ? input.conventions : {}),
      input.notes ? String(input.notes).slice(0, 500) : null,
      user?.email || null,
    ],
  );
  return rows[0];
}

async function deleteValidation(businessCaseId, input = {}) {
  const { itemType, supplierCode, equipmentId } = normalizeInput(input);
  const { rowCount } = await db.query(
    `DELETE FROM bc_consumable_rule_validations
      WHERE business_case_id = $1 AND equipment_id = $2 AND item_type = $3 AND supplier_code = $4 AND origin = 'expert'`,
    [businessCaseId, equipmentId, itemType, supplierCode],
  );
  return { deleted: rowCount };
}

module.exports = {
  MIN_LEARNING_CASES,
  listForBusinessCase,
  listLearningCases,
  buildLearningFactors,
  learnedFor,
  measureAccuracy,
  saveValidation,
  deleteValidation,
};
