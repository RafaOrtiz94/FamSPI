/**
 * Estadisticas del laboratorio que el motor de consumibles necesita y que ni el Sheet ni las fichas
 * traen. jefe_servicio las llena en Determinaciones de cada Business Case.
 *
 * Son OPCIONALES (decision del usuario 2026-10-16: no pedir datos que no acerquen la prediccion):
 * repeticiones y controles fuera de rango solo alimentan la simulacion, que es el ultimo recurso del
 * motor; las muestras ISE afinan electrodos e ISE Diluent. Con 3 procesos del mismo equipo con el
 * dato, el motor usa su promedio ponderado por parecido; lo que llene jefe_servicio manda.
 */

const db = require("../../config/db");
const { profileDistance } = require("./consumableSimulation");

const REFERENCE_MIN_PROCESSES = 3;
const VALIDATOR_ROLES = Object.freeze(["jefe_servicio", "jefe_ti", "jefe_de_ti"]);

const STATISTICS = Object.freeze([
  {
    key: "ise_tests_per_year",
    label: "Muestras ISE por año (Na, K y Cl)",
    unit: "muestras/año",
    max: 5000000,
    integer: true,
    help: "Cada muestra mide Na, K y Cl. Define el cambio de electrodos (cada 9000 pruebas) y el ISE Diluent (450 µL por muestra).",
    appliesTo: (equipment) => equipment.some((entry) => /ISE/i.test(String(entry.equipment_name || ""))),
    // Muestras ISE de otro laboratorio se llevan al tamaño de este con su demanda mensual.
    scaleByDemand: true,
  },
  {
    key: "rerun_rate_pct",
    label: "Muestras que se repiten",
    unit: "%",
    max: 50,
    help: "Porcentaje de pruebas que se vuelven a correr. Sin el dato la simulacion sortea entre 1 y 6 %.",
    appliesTo: () => true,
  },
  {
    key: "qc_failure_rate_pct",
    label: "Controles fuera de rango",
    unit: "%",
    max: 50,
    help: "Porcentaje de corridas de control fuera de rango; cada una puede pedir recalibrar. Sin el dato se sortea entre 1 y 4 %.",
    appliesTo: () => true,
  },
]);

const isMissingTable = (error) => String(error?.code || "") === "42P01";
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

async function loadEquipment(businessCaseId) {
  const { rows } = await db.query(
    `SELECT s.equipment_id, e.equipment_name, e.equipment_code
       FROM bc_equipment_selection s
       JOIN v_equipment_full_catalog e ON e.equipment_id = s.equipment_id
      WHERE s.business_case_id = $1`,
    [businessCaseId],
  );
  return rows;
}

async function loadOwnValues(businessCaseId) {
  try {
    const { rows } = await db.query(
      `SELECT stat_key, value, filled_by, filled_at, source, details FROM bc_lab_statistics WHERE business_case_id = $1`,
      [businessCaseId],
    );
    return new Map(rows.map((row) => [row.stat_key, row]));
  } catch (error) {
    if (isMissingTable(error)) return new Map();
    throw error;
  }
}

// Procesos con el mismo equipo que ya llenaron el dato, con el perfil de su ultima simulacion.
async function loadReferenceRows(businessCaseId, equipmentCodes) {
  if (!equipmentCodes.length) return [];
  try {
    const { rows } = await db.query(
      `SELECT st.business_case_id, st.stat_key, st.value,
              (SELECT sim.profile FROM bc_consumable_simulations sim
                WHERE sim.business_case_id = st.business_case_id AND sim.trigger = 'auto' AND sim.equipment_id > 0
                ORDER BY sim.created_at DESC LIMIT 1) AS profile
         FROM bc_lab_statistics st
        WHERE st.business_case_id <> $1
          AND EXISTS (SELECT 1 FROM bc_equipment_selection s
                        JOIN v_equipment_full_catalog e ON e.equipment_id = s.equipment_id
                       WHERE s.business_case_id = st.business_case_id AND e.equipment_code = ANY($2::text[]))`,
      [businessCaseId, equipmentCodes],
    );
    return rows;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

async function loadOwnProfile(businessCaseId) {
  try {
    const { rows } = await db.query(
      `SELECT profile FROM bc_consumable_simulations
        WHERE business_case_id = $1 AND trigger = 'auto' AND equipment_id > 0
        ORDER BY created_at DESC LIMIT 1`,
      [businessCaseId],
    );
    return rows[0]?.profile || null;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

/**
 * Puro. Referencia de un dato a partir de otros procesos: promedio ponderado por parecido
 * (1 / (distancia + 0.1)). Con `scaleByDemand`, cada valor se divide por la demanda mensual de su
 * proceso y se multiplica por la de este.
 */
function buildReference(definition, rows, ownProfile) {
  const entries = rows
    .filter((row) => row.stat_key === definition.key && Number.isFinite(Number(row.value)))
    .map((row) => {
      const profile = row.profile || null;
      const weight = ownProfile && profile ? 1 / (profileDistance(ownProfile, profile) + 0.1) : 1;
      let value = Number(row.value);
      if (definition.scaleByDemand) {
        const theirs = Number(profile?.monthlyDemand);
        const ours = Number(ownProfile?.monthlyDemand);
        if (!(theirs > 0) || !(ours > 0)) return null;
        value = (value / theirs) * ours;
      }
      return { value, weight };
    })
    .filter(Boolean);
  if (!entries.length) return { processes: 0, value: null };
  const weight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const value = entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weight;
  return { processes: entries.length, value: definition.integer ? Math.round(value) : round(value) };
}

/** Puro. Estado de cada dato: lo llenado, la referencia, si es obligatorio y el valor que usa el motor. */
function describeStatistics({ equipment, ownValues, referenceRows, ownProfile }) {
  return STATISTICS.filter((definition) => definition.appliesTo(equipment)).map((definition) => {
    const own = ownValues.get(definition.key) || null;
    const reference = buildReference(definition, referenceRows, ownProfile);
    const hasReference = reference.processes >= REFERENCE_MIN_PROCESSES && reference.value !== null;
    let effectiveValue = null;
    let effectiveSource = null;
    if (own) {
      effectiveValue = Number(own.value);
      effectiveSource = own.source === "simulation_fit" ? "simulation_fit" : "laboratory";
    } else if (hasReference) {
      effectiveValue = reference.value;
      effectiveSource = "reference";
    }
    return {
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      help: definition.help,
      max: definition.max,
      integer: definition.integer === true,
      value: own ? Number(own.value) : null,
      filledBy: own?.filled_by || null,
      filledAt: own?.filled_at || null,
      // 'simulation_fit': la simulacion encontro el valor que mas coincide con lo real de este proceso.
      source: own ? own.source || "laboratory" : null,
      fit: own?.source === "simulation_fit" ? own.details || null : null,
      reference: { ...reference, minProcesses: REFERENCE_MIN_PROCESSES, sufficient: hasReference },
      required: false,
      effectiveValue,
      effectiveSource,
    };
  });
}

async function getForBusinessCase(businessCaseId) {
  const equipment = await loadEquipment(businessCaseId);
  const codes = [...new Set(equipment.map((entry) => entry.equipment_code).filter(Boolean))];
  const [ownValues, referenceRows, ownProfile] = await Promise.all([
    loadOwnValues(businessCaseId),
    loadReferenceRows(businessCaseId, codes),
    loadOwnProfile(businessCaseId),
  ]);
  const statistics = describeStatistics({ equipment, ownValues, referenceRows, ownProfile });
  return {
    statistics,
    missingRequired: statistics.filter((entry) => entry.required).map((entry) => entry.key),
  };
}

/** Valores que usa el motor: { clave: numero } solo para los datos con valor. */
async function effectiveValues(businessCaseId) {
  const { statistics } = await getForBusinessCase(businessCaseId);
  return Object.fromEntries(statistics
    .filter((entry) => entry.effectiveValue !== null)
    .map((entry) => [entry.key, entry.effectiveValue]));
}

const httpError = (status, code, message) => Object.assign(new Error(message), { status, statusCode: status, code });

/** Puro. Valida lo que llega de pantalla: null borra el dato. */
function normalizeInput(values) {
  if (!values || typeof values !== "object") throw httpError(400, "LAB_STATISTICS_INVALID", "Se esperaba un objeto con los datos del laboratorio.");
  const byKey = new Map(STATISTICS.map((definition) => [definition.key, definition]));
  return Object.entries(values).map(([key, raw]) => {
    const definition = byKey.get(key);
    if (!definition) throw httpError(400, "LAB_STATISTICS_UNKNOWN", `Dato desconocido: ${key}.`);
    if (raw === null || raw === "") return { key, value: null };
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > definition.max) {
      throw httpError(400, "LAB_STATISTICS_INVALID", `${definition.label}: debe ser un numero entre 0 y ${definition.max}.`);
    }
    return { key, value: definition.integer ? Math.round(value) : value };
  });
}

async function saveForBusinessCase(businessCaseId, values, user) {
  const entries = normalizeInput(values);
  const filledBy = user?.email || user?.name || null;
  for (const entry of entries) {
    if (entry.value === null) {
      await db.query(`DELETE FROM bc_lab_statistics WHERE business_case_id = $1 AND stat_key = $2`, [businessCaseId, entry.key]);
    } else {
      await db.query(
        `INSERT INTO bc_lab_statistics (business_case_id, stat_key, value, filled_by, filled_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (business_case_id, stat_key)
         DO UPDATE SET value = EXCLUDED.value, filled_by = EXCLUDED.filled_by, filled_at = NOW(), source = 'laboratory', details = NULL`,
        [businessCaseId, entry.key, entry.value, filledBy],
      );
    }
  }
  return getForBusinessCase(businessCaseId);
}

module.exports = {
  STATISTICS,
  REFERENCE_MIN_PROCESSES,
  VALIDATOR_ROLES,
  getForBusinessCase,
  effectiveValues,
  saveForBusinessCase,
  __testables: { buildReference, describeStatistics, normalizeInput },
};
