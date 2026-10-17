const db = require("../../config/db");

const AUTOSAVE_FEATURE = "autosave";
const DEFAULT_SECTION_KEYS = [
  "general",
  "lab",
  "equipment",
  "lis",
  "determinations",
  "requirement",
  "investments",
  "prices",
  "calculations",
  "rentability",
  "consumption_export",
];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function normalizeSection(section) {
  return String(section || "").trim().toLowerCase();
}

function validateSection(section) {
  const normalized = normalizeSection(section);
  if (!DEFAULT_SECTION_KEYS.includes(normalized)) {
    const error = new Error(`Sección inválida para feature flag: ${section}`);
    error.status = 400;
    error.code = "INVALID_AUTOSAVE_SECTION";
    throw error;
  }
  return normalized;
}

function validateRoleKey(role) {
  const normalized = normalizeRole(role);
  if (!normalized) {
    const error = new Error("role es requerido para feature flag");
    error.status = 400;
    error.code = "AUTOSAVE_ROLE_REQUIRED";
    throw error;
  }
  return normalized;
}

async function getAutosaveFlagsForRole(role) {
  const roleKey = validateRoleKey(role);
  const defaults = DEFAULT_SECTION_KEYS.reduce((acc, section) => {
    acc[section] = true;
    return acc;
  }, {});

  const { rows } = await db.query(
    `
    SELECT section_key, role_key, is_enabled
    FROM business_case_feature_flags
    WHERE feature_name = $1
      AND role_key = ANY($2)
    ORDER BY CASE WHEN role_key = $3 THEN 0 ELSE 1 END
    `,
    [AUTOSAVE_FEATURE, [roleKey, "*"], roleKey],
  );

  const resolved = { ...defaults };

  rows
    .filter((row) => row.role_key === "*")
    .forEach((row) => {
      if (DEFAULT_SECTION_KEYS.includes(row.section_key)) {
        resolved[row.section_key] = Boolean(row.is_enabled);
      }
    });

  rows
    .filter((row) => row.role_key === roleKey)
    .forEach((row) => {
      if (DEFAULT_SECTION_KEYS.includes(row.section_key)) {
        resolved[row.section_key] = Boolean(row.is_enabled);
      }
    });

  return {
    role: roleKey,
    feature: AUTOSAVE_FEATURE,
    sections: resolved,
  };
}

async function listAutosaveFlags() {
  const { rows } = await db.query(
    `
    SELECT id, section_key, role_key, is_enabled, metadata, updated_by, created_at, updated_at
    FROM business_case_feature_flags
    WHERE feature_name = $1
    ORDER BY section_key ASC, role_key ASC
    `,
    [AUTOSAVE_FEATURE],
  );

  return rows;
}

async function upsertAutosaveFlag({ section, role, enabled, metadata = {}, userId = null }) {
  const sectionKey = validateSection(section);
  const roleKey = validateRoleKey(role);
  const isEnabled = Boolean(enabled);

  const { rows } = await db.query(
    `
    INSERT INTO business_case_feature_flags (
      feature_name,
      section_key,
      role_key,
      is_enabled,
      metadata,
      updated_by,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW())
    ON CONFLICT (feature_name, section_key, role_key)
    DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      metadata = EXCLUDED.metadata,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING id, section_key, role_key, is_enabled, metadata, updated_by, created_at, updated_at
    `,
    [AUTOSAVE_FEATURE, sectionKey, roleKey, isEnabled, JSON.stringify(metadata || {}), userId],
  );

  return rows[0] || null;
}

module.exports = {
  AUTOSAVE_FEATURE,
  DEFAULT_SECTION_KEYS,
  getAutosaveFlagsForRole,
  listAutosaveFlags,
  upsertAutosaveFlag,
};
