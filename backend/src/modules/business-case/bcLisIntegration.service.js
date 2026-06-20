const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * LIS Integration Service
 * Manages LIS (Laboratory Information System) integration data
 */
const LIS_PROVIDER_ALLOWED = new Set(['orion', 'cobas_infiniti', 'other']);
const INTERFACE_ONLY_SENTINEL = '__INTERFACE_ONLY__';

function normalizeLisProvider(value) {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const normalized = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');

    if (LIS_PROVIDER_ALLOWED.has(normalized)) return normalized;
    if (normalized.includes('orion')) return 'orion';
    if (normalized.includes('cobas') || normalized.includes('infiniti')) return 'cobas_infiniti';
    return 'other';
}

function hasValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
}

function deriveRequiresInterface(row = {}) {
    if (row.requires_interface === true) return true;
    return (
        row.current_system_name === INTERFACE_ONLY_SENTINEL ||
        hasValue(row.current_system_name) ||
        hasValue(row.current_system_provider) ||
        Boolean(row.current_system_hardware)
    );
}

function sanitizePersistedCurrentSystemName(value) {
    return value === INTERFACE_ONLY_SENTINEL ? null : value;
}

function enrichLisIntegrationRow(row) {
    if (!row) return null;
    return {
        ...row,
        requires_interface: deriveRequiresInterface(row),
        current_system_name: sanitizePersistedCurrentSystemName(row.current_system_name),
    };
}

async function createLisIntegration(businessCaseId, data) {
    const {
        includes_lis,
        requires_interface,
        lis_provider,
        includes_hardware,
        monthly_patients,
        lis_observations,
        interface_observations,
    } = data;
    const requiresInterface = requires_interface === true;
    const persistedCurrentSystemName = requiresInterface ? INTERFACE_ONLY_SENTINEL : null;

    const query = `
    INSERT INTO bc_lis_integration (
      business_case_id,
      includes_lis,
      lis_provider,
      includes_hardware,
      monthly_patients,
      lis_observations,
      interface_observations,
      current_system_name,
      current_system_provider,
      current_system_hardware
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (business_case_id)
    DO UPDATE SET
      includes_lis = EXCLUDED.includes_lis,
      lis_provider = EXCLUDED.lis_provider,
      includes_hardware = EXCLUDED.includes_hardware,
      monthly_patients = EXCLUDED.monthly_patients,
      lis_observations = EXCLUDED.lis_observations,
      interface_observations = EXCLUDED.interface_observations,
      current_system_name = EXCLUDED.current_system_name,
      current_system_provider = EXCLUDED.current_system_provider,
      current_system_hardware = EXCLUDED.current_system_hardware,
      updated_at = now()
    RETURNING *;
  `;

    const normalizedLisProvider = normalizeLisProvider(lis_provider);

    const { rows } = await db.query(query, [
        businessCaseId,
        includes_lis,
        normalizedLisProvider,
        includes_hardware,
        includes_lis ? monthly_patients : null,
        includes_lis ? (hasValue(lis_observations) ? String(lis_observations).trim() : null) : null,
        requiresInterface ? (hasValue(interface_observations) ? String(interface_observations).trim() : null) : null,
        persistedCurrentSystemName,
        null,
        false
    ]);

    return enrichLisIntegrationRow(rows[0]);
}

async function getLisIntegration(businessCaseId) {
    const { rows } = await db.query(
        'SELECT * FROM bc_lis_integration WHERE business_case_id = $1',
        [businessCaseId]
    );
    return enrichLisIntegrationRow(rows[0] || null);
}

async function updateLisIntegration(businessCaseId, data) {
    return createLisIntegration(businessCaseId, data); // Uses UPSERT
}

async function deleteLisIntegration(businessCaseId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_lis_integration WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rowCount > 0;
}

// Equipment Interfaces
async function addEquipmentInterface(lisIntegrationId, data) {
    const { model, provider } = data;
    const fkColumn = await resolveInterfaceFkColumn();
    let rows;
    try {
        const result = await db.query(
            `INSERT INTO bc_lis_equipment_interfaces (${fkColumn}, model, provider)
             VALUES ($1, $2, $3) RETURNING *`,
            [lisIntegrationId, model, provider]
        );
        rows = result.rows;
    } catch (error) {
        if (error?.code === '42703') {
            const fallbackColumn = fkColumn === 'lis_integration_id' ? 'business_case_id' : 'lis_integration_id';
            cachedInterfaceFkColumn = fallbackColumn;
            const result = await db.query(
                `INSERT INTO bc_lis_equipment_interfaces (${fallbackColumn}, model, provider)
                 VALUES ($1, $2, $3) RETURNING *`,
                [lisIntegrationId, model, provider]
            );
            rows = result.rows;
        } else {
            throw error;
        }
    }

    return rows[0];
}

async function getEquipmentInterfaces(lisIntegrationId) {
    const fkColumn = await resolveInterfaceFkColumn();
    let rows;
    try {
        const result = await db.query(
            `SELECT * FROM bc_lis_equipment_interfaces WHERE ${fkColumn} = $1 ORDER BY created_at`,
            [lisIntegrationId]
        );
        rows = result.rows;
    } catch (error) {
        if (error?.code === '42703') {
            const fallbackColumn = fkColumn === 'lis_integration_id' ? 'business_case_id' : 'lis_integration_id';
            cachedInterfaceFkColumn = fallbackColumn;
            const result = await db.query(
                `SELECT * FROM bc_lis_equipment_interfaces WHERE ${fallbackColumn} = $1 ORDER BY created_at`,
                [lisIntegrationId]
            );
            rows = result.rows;
        } else {
            throw error;
        }
    }
    return rows;
}

async function deleteEquipmentInterface(interfaceId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_lis_equipment_interfaces WHERE id = $1',
        [interfaceId]
    );
    return rowCount > 0;
}

async function replaceEquipmentInterfaces(lisIntegrationId, items = []) {
    const fkColumn = await resolveInterfaceFkColumn();
    await db.query(
        `DELETE FROM bc_lis_equipment_interfaces WHERE ${fkColumn} = $1`,
        [lisIntegrationId]
    );

    const normalizedItems = Array.isArray(items)
        ? items.filter((item) => hasValue(item?.model) || hasValue(item?.provider))
        : [];

    const inserted = [];
    for (const item of normalizedItems) {
        const created = await addEquipmentInterface(lisIntegrationId, {
            model: hasValue(item?.model) ? String(item.model).trim() : null,
            provider: hasValue(item?.provider) ? String(item.provider).trim() : null,
        });
        if (created) inserted.push(created);
    }

    return inserted;
}

module.exports = {
    createLisIntegration,
    getLisIntegration,
    updateLisIntegration,
    deleteLisIntegration,
    addEquipmentInterface,
    getEquipmentInterfaces,
    deleteEquipmentInterface,
    replaceEquipmentInterfaces,
    INTERFACE_ONLY_SENTINEL,
};
let cachedInterfaceFkColumn = null;

async function resolveInterfaceFkColumn() {
    if (cachedInterfaceFkColumn) return cachedInterfaceFkColumn;
    try {
        const { rows } = await db.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'bc_lis_equipment_interfaces'
              AND column_name IN ('lis_integration_id', 'business_case_id')
            ORDER BY CASE column_name
              WHEN 'lis_integration_id' THEN 1
              WHEN 'business_case_id' THEN 2
              ELSE 99
            END
            LIMIT 1
            `
        );
        cachedInterfaceFkColumn = rows[0]?.column_name || 'lis_integration_id';
    } catch (error) {
        cachedInterfaceFkColumn = 'lis_integration_id';
    }
    return cachedInterfaceFkColumn;
}
