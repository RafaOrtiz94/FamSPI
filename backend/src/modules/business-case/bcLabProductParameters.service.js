const db = require("../../config/db");

/**
 * Parametros por producto de Entorno Laboratorio.
 *
 * Cruza los productos del Business Case (bc_consumption_items con cantidad)
 * con la ficha vigente del fabricante (catalog_consumable_specs) y con los
 * ajustes del laboratorio (bc_lab_product_parameters). El valor efectivo es
 * ajuste ?? fabricante; el motor de calculo por reglas debe leer "effective".
 */

const OVERRIDE_FIELDS = ["calibration_interval_days", "qc_interval_hours", "onboard_days", "open_days"];
const UNDEFINED_TABLE = "42P01";

function normalizeCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.replace(/^0+(?=\d)/, "") : null;
}

function positiveOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Bloque de system_specs que aplica al equipo del BC. Los documentos nuevos
// (cobas c 303/503/703, Elecsys) traen un solo bloque ("todos"); los antiguos
// separan por analizador. INTEGRA no se usa: no hay equipos INTEGRA en el catalogo.
function systemKeysForEquipment(equipmentName) {
  const name = String(equipmentName || "").toLowerCase();
  const keys = [];
  if (/\b303\b/.test(name)) keys.push("cobas c 303");
  if (/\b503\b/.test(name)) keys.push("cobas c 503");
  if (/c\s?111/.test(name)) keys.push("cobas c 111");
  if (/c\s?311|c\s?501|c\s?502/.test(name)) keys.push("cobas c 501/502");
  keys.push("todos");
  if (/cobas/.test(name) && !/c\s?111|\be\s?\d{3}|e411|e402|e801/.test(name)) keys.push("cobas c systems");
  return keys;
}

function resolveSystemSpec(systemSpecs, equipmentName) {
  const specs = systemSpecs && typeof systemSpecs === "object" ? systemSpecs : {};
  const key = systemKeysForEquipment(equipmentName).find((candidate) => specs[candidate]);
  return key ? { key, ...specs[key] } : { key: null };
}

function manufacturerValues(spec, equipmentName) {
  if (!spec) return null;
  const system = resolveSystemSpec(spec.system_specs, equipmentName);
  const calibration = system.calibration || {};
  const linked = spec.parameters?.linked_products || {};
  return {
    systemKey: system.key,
    onboardDays: positiveOrNull(system.onboard_days) ?? positiveOrNull(spec.stability_onboard_days),
    onboardUntilExpiration: Boolean(system.onboard_until_expiration || spec.parameters?.onboard_until_expiration),
    openDays: positiveOrNull(spec.stability_open_days),
    singleUse: Boolean(spec.single_use),
    onboardAliquotSingleUse: Boolean(spec.parameters?.onboard_aliquot_single_use),
    calibration: {
      events: calibration.events || [],
      intervalDays: positiveOrNull(calibration.interval_days),
      onboardPackIntervalDays: positiveOrNull(calibration.onboard_pack_interval_days),
      sameLotIntervalDays: positiveOrNull(calibration.same_lot_interval_days),
      onboardKitIntervalDays: positiveOrNull(calibration.onboard_kit_interval_days),
      replicate: calibration.replicate || null,
    },
    // Intervalo unico de recalibracion que el laboratorio puede ajustar: el
    // mas corto que exige el documento.
    calibrationIntervalDays: [calibration.interval_days, calibration.onboard_pack_interval_days,
      calibration.same_lot_interval_days, calibration.onboard_kit_interval_days]
      .map(positiveOrNull).filter(Boolean).sort((a, b) => a - b)[0] ?? null,
    qcIntervalHours: positiveOrNull(system.qc?.interval_hours),
    qcPerKit: Boolean(system.qc?.per_kit),
    qcAfterCalibration: Boolean(system.qc?.after_calibration),
    linkedCalibrators: linked.calibradores || [],
    linkedControls: linked.controles || [],
  };
}

function effectiveValues(manufacturer, overrides) {
  const o = overrides || {};
  return {
    calibrationIntervalDays: positiveOrNull(o.calibration_interval_days) ?? manufacturer?.calibrationIntervalDays ?? null,
    qcIntervalHours: positiveOrNull(o.qc_interval_hours) ?? manufacturer?.qcIntervalHours ?? null,
    onboardDays: positiveOrNull(o.onboard_days) ?? manufacturer?.onboardDays ?? null,
    openDays: positiveOrNull(o.open_days) ?? manufacturer?.openDays ?? null,
  };
}

async function loadBusinessCaseProducts(businessCaseId) {
  const { rows } = await db.query(
    `SELECT LOWER(c.item_type) AS item_type,
            c.equipment_name,
            COALESCE(NULLIF(LTRIM(c.item_id, '0'), ''), NULLIF(LTRIM(cc.supplier_code, '0'), '')) AS code,
            MAX(c.name) AS name,
            SUM(COALESCE(c.annual_qty, 0)) AS annual_qty,
            SUM(COALESCE(c.planned_qty, 0)) AS planned_qty
       FROM bc_consumption_items c
       LEFT JOIN catalog_consumables cc ON cc.id = c.catalog_id
      WHERE c.business_case_id = $1
        AND (COALESCE(c.annual_qty, 0) > 0 OR COALESCE(c.planned_qty, 0) > 0)
      GROUP BY 1, 2, 3
      ORDER BY 1, MAX(c.name)`,
    [businessCaseId],
  );
  return rows.map((row) => ({ ...row, code: normalizeCode(row.code) }));
}

async function getProductParameters(businessCaseId) {
  const products = await loadBusinessCaseProducts(businessCaseId);
  const codes = [...new Set(products.map((p) => p.code).filter(Boolean))];

  let specs = [];
  let overrides = [];
  try {
    const specResult = await db.query(
      `SELECT * FROM catalog_consumable_specs WHERE valid_to IS NULL AND supplier_code = ANY($1::text[])`,
      [codes],
    );
    specs = specResult.rows;
    const overrideResult = await db.query(
      `SELECT supplier_code, overrides, updated_by, updated_at
         FROM bc_lab_product_parameters WHERE business_case_id = $1`,
      [businessCaseId],
    );
    overrides = overrideResult.rows;
  } catch (error) {
    if (error.code === UNDEFINED_TABLE) {
      return { available: false, reason: "SPECS_NOT_MIGRATED", items: [] };
    }
    throw error;
  }

  const specByCode = new Map(specs.map((s) => [s.supplier_code, s]));
  const overrideByCode = new Map(overrides.map((o) => [o.supplier_code, o]));
  const nameByCode = new Map(products.map((p) => [p.code, p.name]));
  const linkedName = (code) => ({ code, name: nameByCode.get(code) || null, inBusinessCase: nameByCode.has(code) });

  const items = products.map((product) => {
    const spec = specByCode.get(product.code) || null;
    const manufacturer = manufacturerValues(spec, product.equipment_name);
    const override = overrideByCode.get(product.code) || null;
    return {
      code: product.code,
      name: product.name,
      itemType: product.item_type,
      equipmentName: product.equipment_name,
      annualQty: Number(product.annual_qty),
      plannedQty: Number(product.planned_qty),
      spec: spec ? {
        status: spec.verification_status,
        presentation: {
          containers: spec.containers_per_pack === null ? null : Number(spec.containers_per_pack),
          volumeMl: spec.container_volume_ml === null ? null : Number(spec.container_volume_ml),
          levels: spec.levels_per_pack,
          tests: spec.tests_per_pack,
        },
        sourceTitle: spec.source_title,
        sourceUrl: spec.source_url,
        documentVersion: spec.source_document_version,
        documentDate: spec.source_document_date,
        notes: spec.notes,
      } : null,
      manufacturer: manufacturer ? {
        ...manufacturer,
        linkedCalibrators: manufacturer.linkedCalibrators.map(linkedName),
        linkedControls: manufacturer.linkedControls.map(linkedName),
      } : null,
      overrides: override?.overrides || {},
      overrideUpdatedBy: override?.updated_by || null,
      overrideUpdatedAt: override?.updated_at || null,
      effective: effectiveValues(manufacturer, override?.overrides),
    };
  });

  return { available: true, items };
}

function sanitizeOverrides(input) {
  const clean = {};
  OVERRIDE_FIELDS.forEach((field) => {
    const value = positiveOrNull(input?.[field]);
    if (value !== null) clean[field] = value;
  });
  const note = String(input?.note || "").trim();
  if (note) clean.note = note.slice(0, 500);
  return clean;
}

/**
 * items: [{ code, overrides: { calibration_interval_days, qc_interval_hours, onboard_days, open_days, note } }]
 * Un item sin campos validos elimina el ajuste (vuelve al valor del fabricante).
 */
async function saveProductParameters(businessCaseId, items, actorEmail) {
  if (!Array.isArray(items)) {
    const error = new Error("items debe ser una lista.");
    error.status = 400;
    throw error;
  }
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      const code = normalizeCode(item?.code);
      if (!code) continue;
      const clean = sanitizeOverrides(item.overrides);
      if (!Object.keys(clean).length) {
        await client.query(
          "DELETE FROM bc_lab_product_parameters WHERE business_case_id = $1 AND supplier_code = $2",
          [businessCaseId, code],
        );
        continue;
      }
      await client.query(
        `INSERT INTO bc_lab_product_parameters (business_case_id, supplier_code, overrides, updated_by, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, NOW())
         ON CONFLICT (business_case_id, supplier_code)
         DO UPDATE SET overrides = EXCLUDED.overrides, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [businessCaseId, code, JSON.stringify(clean), actorEmail || null],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getProductParameters(businessCaseId);
}

module.exports = {
  getProductParameters,
  saveProductParameters,
  __testables: {
    systemKeysForEquipment,
    resolveSystemSpec,
    manufacturerValues,
    effectiveValues,
    sanitizeOverrides,
  },
};
