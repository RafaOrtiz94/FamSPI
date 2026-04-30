/**
 * Investments Service
 * Manages additional investments for Business Cases
 */

const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * Add a new investment to a Business Case
 * @param {string} businessCaseId - UUID of the Business Case
 * @param {object} data - Investment data
 * @returns {Promise<object>} Created investment
 */
async function addInvestment(businessCaseId, data) {
    const { concept, amount, investment_type, category, notes } = data;

    // Validate investment type
    const validTypes = ['one_time', 'recurring_monthly', 'recurring_annual'];
    if (!validTypes.includes(investment_type)) {
        const error = new Error(`Tipo de inversión inválido: ${investment_type}`);
        error.status = 400;
        throw error;
    }

    // Validate category if provided
    const validCategories = ['installation', 'training', 'transport', 'maintenance', 'other'];
    if (category && !validCategories.includes(category)) {
        const error = new Error(`Categoría de inversión inválida: ${category}`);
        error.status = 400;
        throw error;
    }

    const { rows } = await db.query(
        `INSERT INTO bc_investments (
      business_case_id, concept, amount, investment_type, category, notes
    ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [businessCaseId, concept, amount, investment_type, category, notes]
    );

    logger.info({ businessCaseId, investmentId: rows[0].id }, 'Investment added to BC');
    return rows[0];
}

/**
 * Get all investments for a Business Case
 * @param {string} businessCaseId - UUID of the Business Case
 * @returns {Promise<Array>} List of investments
 */
async function getInvestments(businessCaseId) {
    const { rows } = await db.query(
        `SELECT * FROM bc_investments WHERE business_case_id = $1 ORDER BY created_at`,
        [businessCaseId]
    );
    return rows;
}

/**
 * Get investment totals by type
 * @param {string} businessCaseId - UUID of the Business Case
 * @returns {Promise<object>} Investment totals
 */
async function getInvestmentTotals(businessCaseId) {
    const { rows } = await db.query(
        `SELECT 
      SUM(CASE WHEN investment_type = 'one_time' THEN amount ELSE 0 END) as one_time_total,
      SUM(CASE WHEN investment_type = 'recurring_monthly' THEN amount ELSE 0 END) as recurring_monthly_total,
      SUM(CASE WHEN investment_type = 'recurring_annual' THEN amount ELSE 0 END) as recurring_annual_total,
      SUM(amount) as total
    FROM bc_investments 
    WHERE business_case_id = $1`,
        [businessCaseId]
    );

    return {
        one_time: parseFloat(rows[0].one_time_total) || 0,
        recurring_monthly: parseFloat(rows[0].recurring_monthly_total) || 0,
        recurring_annual: parseFloat(rows[0].recurring_annual_total) || 0,
        total: parseFloat(rows[0].total) || 0,
    };
}

/**
 * Update an investment
 * @param {number} id - Investment ID
 * @param {object} data - Updated data
 * @returns {Promise<object>} Updated investment
 */
async function updateInvestment(id, data) {
    const { concept, amount, investment_type, category, notes } = data;

    const { rows } = await db.query(
        `UPDATE bc_investments 
     SET concept = COALESCE($1, concept),
         amount = COALESCE($2, amount),
         investment_type = COALESCE($3, investment_type),
         category = COALESCE($4, category),
         notes = COALESCE($5, notes)
     WHERE id = $6 
     RETURNING *`,
        [concept, amount, investment_type, category, notes, id]
    );

    if (!rows.length) {
        const error = new Error('Inversión no encontrada');
        error.status = 404;
        throw error;
    }

    logger.info({ investmentId: id }, 'Investment updated');
    return rows[0];
}

/**
 * Delete an investment
 * @param {number} id - Investment ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteInvestment(id) {
    const { rowCount } = await db.query(
        `DELETE FROM bc_investments WHERE id = $1`,
        [id]
    );

    if (rowCount === 0) {
        const error = new Error('Inversión no encontrada');
        error.status = 404;
        throw error;
    }

    logger.info({ investmentId: id }, 'Investment deleted');
    return true;
}

async function listInvestmentCatalog() {
    const { rows } = await db.query(
        `SELECT id, code, name, category, is_active
         FROM bc_investment_catalog
         WHERE is_active = true
         ORDER BY name`
    );
    return rows;
}

async function createInvestmentCatalogItem(payload) {
    const name = (payload?.name || '').trim();
    if (!name) {
        const error = new Error("name es requerido");
        error.status = 400;
        throw error;
    }
    const category = payload?.category ? String(payload.category).trim() : null;
    const code = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const existing = await db.query(
        `SELECT id, code, name, category, is_active
         FROM bc_investment_catalog
         WHERE lower(name) = lower($1)
         LIMIT 1`,
        [name]
    );
    if (existing.rows.length) {
        return existing.rows[0];
    }

    const { rows } = await db.query(
        `INSERT INTO bc_investment_catalog (code, name, category, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             category = COALESCE(EXCLUDED.category, bc_investment_catalog.category),
             updated_at = now()
         RETURNING id, code, name, category, is_active`,
        [code || null, name, category || null]
    );
    return rows[0];
}

async function getInvestmentSelections(businessCaseId) {
    const { rows } = await db.query(
        `SELECT catalog_id, selected, notes, quantity, characteristics, unit_price, updated_by_role, updated_by_email
         FROM bc_investment_selections
         WHERE business_case_id = $1`,
        [businessCaseId]
    );
    return rows;
}

async function getCatalogWithSelections(businessCaseId) {
    const { rows } = await db.query(
        `SELECT c.id, c.code, c.name, c.category, c.is_active,
                COALESCE(s.selected, false) AS selected,
                s.notes,
                s.quantity,
                s.characteristics,
                s.unit_price,
                s.updated_by_role,
                s.updated_by_email
         FROM bc_investment_catalog c
         LEFT JOIN bc_investment_selections s
           ON s.catalog_id = c.id
          AND s.business_case_id = $1
         WHERE c.is_active = true
         ORDER BY c.name`,
        [businessCaseId]
    );
    return rows;
}

async function upsertInvestmentSelection(businessCaseId, data, user) {
    const { catalog_id, selected = true, notes = null, quantity = null, characteristics = null, unit_price = null } = data;
    if (!catalog_id) {
        const error = new Error("catalog_id es requerido");
        error.status = 400;
        throw error;
    }

    const { rows } = await db.query(
        `INSERT INTO bc_investment_selections
           (business_case_id, catalog_id, selected, notes, quantity, characteristics, unit_price, updated_by_role, updated_by_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (business_case_id, catalog_id)
         DO UPDATE SET
           selected = EXCLUDED.selected,
           notes = EXCLUDED.notes,
           quantity = EXCLUDED.quantity,
           characteristics = EXCLUDED.characteristics,
           unit_price = EXCLUDED.unit_price,
           updated_by_role = EXCLUDED.updated_by_role,
           updated_by_email = EXCLUDED.updated_by_email,
           updated_at = now()
         RETURNING *`,
        [
            businessCaseId,
            catalog_id,
            selected,
            notes,
            quantity,
            characteristics,
            unit_price,
            user?.role || null,
            user?.email || null
        ]
    );

    return rows[0];
}

async function upsertInvestmentSelectionsBatch(businessCaseId, selections = [], user) {
    if (!Array.isArray(selections) || !selections.length) {
        const error = new Error("selections es requerido y debe contener elementos");
        error.status = 400;
        throw error;
    }

    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        const out = [];
        for (const item of selections) {
            const { catalog_id, selected = true, notes = null, quantity = null, characteristics = null, unit_price = null } = item || {};
            if (!catalog_id) {
                const error = new Error("catalog_id es requerido en cada seleccion");
                error.status = 400;
                throw error;
            }

            const { rows } = await client.query(
                `INSERT INTO bc_investment_selections
                   (business_case_id, catalog_id, selected, notes, quantity, characteristics, unit_price, updated_by_role, updated_by_email)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (business_case_id, catalog_id)
                 DO UPDATE SET
                   selected = EXCLUDED.selected,
                   notes = EXCLUDED.notes,
                   quantity = EXCLUDED.quantity,
                   characteristics = EXCLUDED.characteristics,
                   unit_price = EXCLUDED.unit_price,
                   updated_by_role = EXCLUDED.updated_by_role,
                   updated_by_email = EXCLUDED.updated_by_email,
                   updated_at = now()
                 RETURNING *`,
                [
                    businessCaseId,
                    catalog_id,
                    selected,
                    notes,
                    quantity,
                    characteristics,
                    unit_price,
                    user?.role || null,
                    user?.email || null
                ]
            );
            out.push(rows[0]);
        }
        await client.query("COMMIT");
        return out;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get selected investments with prices, filtered by investment_class.
 * Used by the "Valores" sections for jefe_operaciones / jefe_financiero.
 */
async function getInvestmentValuesByClass(businessCaseId, investmentClass) {
    const validClasses = ['operativa', 'financiera'];
    if (!validClasses.includes(investmentClass)) {
        const error = new Error(`Clase de inversión inválida: ${investmentClass}`);
        error.status = 400;
        throw error;
    }

    const priceColumn = investmentClass === 'operativa' ? 's.unit_price' : 's.unit_price_financial';

    const { rows } = await db.query(
        `SELECT
           c.id AS catalog_id,
           c.code,
           c.name,
           c.category,
           c.investment_class,
           s.id AS selection_id,
           s.quantity,
           s.characteristics,
           s.notes,
           ${priceColumn} AS unit_price,
           s.updated_by_role,
           s.updated_by_email
         FROM bc_investment_catalog c
         INNER JOIN bc_investment_selections s
           ON s.catalog_id = c.id
          AND s.business_case_id = $1
          AND s.selected = true
         WHERE c.investment_class = $2
           AND c.is_active = true
         ORDER BY c.name`,
        [businessCaseId, investmentClass]
    );
    return rows;
}

/**
 * Save price values for a batch of selected investments.
 * investmentClass determines which price column is updated and which role is allowed.
 */
async function saveInvestmentValuesBatch(businessCaseId, investmentClass, values = [], user) {
    const validClasses = ['operativa', 'financiera'];
    if (!validClasses.includes(investmentClass)) {
        const error = new Error(`Clase de inversión inválida: ${investmentClass}`);
        error.status = 400;
        throw error;
    }
    if (!Array.isArray(values) || !values.length) {
        const error = new Error('values es requerido y debe contener elementos');
        error.status = 400;
        throw error;
    }

    const priceColumn = investmentClass === 'operativa' ? 'unit_price' : 'unit_price_financial';
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const out = [];

        for (const item of values) {
            const { catalog_id, unit_price } = item || {};
            if (catalog_id == null) {
                const error = new Error('catalog_id es requerido en cada valor');
                error.status = 400;
                throw error;
            }

            // Verify the catalog item belongs to the expected class and is selected for this BC
            const check = await client.query(
                `SELECT s.id
                 FROM bc_investment_selections s
                 INNER JOIN bc_investment_catalog c ON c.id = s.catalog_id
                 WHERE s.business_case_id = $1
                   AND s.catalog_id = $2
                   AND s.selected = true
                   AND c.investment_class = $3`,
                [businessCaseId, catalog_id, investmentClass]
            );
            if (!check.rows.length) continue; // skip items not selected or wrong class

            const { rows } = await client.query(
                `UPDATE bc_investment_selections
                 SET ${priceColumn} = $1,
                     updated_by_role = $2,
                     updated_by_email = $3,
                     updated_at = now()
                 WHERE business_case_id = $4
                   AND catalog_id = $5
                 RETURNING *`,
                [
                    unit_price ?? null,
                    user?.role || null,
                    user?.email || null,
                    businessCaseId,
                    catalog_id,
                ]
            );
            if (rows.length) out.push(rows[0]);
        }

        await client.query('COMMIT');
        logger.info({ businessCaseId, investmentClass, count: out.length }, 'Investment values saved');
        return out;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Detect selection changes (new selected items or quantity changes) compared to pre-save state.
 * Returns true if the value managers should be notified.
 */
function detectInvestmentSelectionChanges(prevSelectionsMap, incomingSelections) {
    for (const item of incomingSelections) {
        const prev = prevSelectionsMap.get(Number(item.catalog_id));
        const isNewlySelected = item.selected && (!prev || !prev.selected);
        const quantityChanged = item.selected && prev && item.quantity != null && prev.quantity !== item.quantity;
        if (isNewlySelected || quantityChanged) return true;
    }
    return false;
}

/**
 * Update the invest_selections_changed_at and deadline columns on the BC record.
 */
async function stampInvestmentDeadlines(businessCaseId, deadlineHours = 48) {
    const now = new Date();
    const deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);
    await db.query(
        `UPDATE equipment_purchase_requests
         SET invest_selections_changed_at = $1,
             invest_values_op_deadline_at = $2,
             invest_values_fin_deadline_at = $2
         WHERE id = $3`,
        [now, deadline, businessCaseId]
    );
}

module.exports = {
    addInvestment,
    getInvestments,
    getInvestmentTotals,
    updateInvestment,
    deleteInvestment,
    listInvestmentCatalog,
    createInvestmentCatalogItem,
    getInvestmentSelections,
    getCatalogWithSelections,
    upsertInvestmentSelection,
    upsertInvestmentSelectionsBatch,
    getInvestmentValuesByClass,
    saveInvestmentValuesBatch,
    detectInvestmentSelectionChanges,
    stampInvestmentDeadlines,
};
