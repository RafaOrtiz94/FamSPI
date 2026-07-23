/**
 * Investments Service
 * Manages additional investments for Business Cases
 */

const db = require('../../config/db');
const logger = require('../../config/logger');

function calculateFinancialDepreciation({ unitPrice, percentage, projectedMonths }) {
    const base = Number(unitPrice);
    const rate = Number(percentage);
    const months = Number(projectedMonths);
    if (!Number.isFinite(base) || base < 0) {
        return {
            annual: null,
            monthly: null,
            projected: null,
            net: null,
        };
    }
    const annual = base * ((Number.isFinite(rate) && rate >= 0 ? rate : 0) / 100);
    const monthly = annual / 12;
    const projected = monthly * (Number.isFinite(months) && months > 0 ? months : 0);
    return {
        annual: Number(annual.toFixed(2)),
        monthly: Number(monthly.toFixed(2)),
        projected: Number(projected.toFixed(2)),
        net: Number(Math.max(0, base - projected).toFixed(2)),
    };
}

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
        `SELECT c.id, c.code, c.name, c.category, c.investment_class, c.is_active,
                COALESCE(s.selected, false) AS selected,
                s.notes,
                s.quantity,
                s.characteristics,
                s.unit_price,
                s.updated_by_role,
                s.updated_by_email,
                s.owner_email,
                s.owner_role,
                COALESCE(req.pending_requests_count, 0) AS pending_requests_count
         FROM bc_investment_catalog c
         LEFT JOIN bc_investment_selections s
           ON s.catalog_id = c.id
          AND s.business_case_id = $1
         LEFT JOIN (
           SELECT catalog_id, COUNT(*)::int AS pending_requests_count
           FROM bc_investment_selection_requests
           WHERE business_case_id = $1
             AND status = 'pending'
           GROUP BY catalog_id
         ) req ON req.catalog_id = c.id
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

    const { rows: existingRows } = await db.query(
        `SELECT id, selected, quantity, owner_email, owner_role
         FROM bc_investment_selections
         WHERE business_case_id = $1
           AND catalog_id = $2
         LIMIT 1`,
        [businessCaseId, catalog_id]
    );
    const existing = existingRows[0] || null;
    const ownerEmail = String(existing?.owner_email || "").trim().toLowerCase();
    const ownerRole = String(existing?.owner_role || "").trim().toLowerCase();
    const actorEmail = String(user?.email || "").trim().toLowerCase();
    const selectedChanged = existing ? Boolean(existing.selected) !== Boolean(selected) : false;
    const quantityChanged = existing
        ? Number(existing.quantity ?? 0) !== Number(quantity ?? 0)
        : false;
    const isServiceActor = String(user?.role || "").trim().toLowerCase() === "jefe_servicio";
    const isForeignOwner = ownerEmail ? ownerEmail !== actorEmail : ownerRole && ownerRole !== "jefe_servicio";
    if (existing?.selected && isServiceActor && isForeignOwner) {
        const error = new Error("Los items confirmados por ACP son de solo lectura. Solicita un aumento si necesitas modificar una cantidad.");
        error.status = 403;
        error.code = "INVESTMENT_ACP_ITEM_READ_ONLY";
        throw error;
    }
    if (existing && ownerEmail && actorEmail && ownerEmail !== actorEmail && (selectedChanged || quantityChanged)) {
        const error = new Error("Solo el usuario propietario del carrito puede cambiar cantidad o quitar la inversion.");
        error.status = 403;
        error.code = "INVESTMENT_SELECTION_OWNER_REQUIRED";
        throw error;
    }

    const { rows } = await db.query(
        `INSERT INTO bc_investment_selections
           (business_case_id, catalog_id, selected, notes, quantity, characteristics, unit_price, updated_by_role, updated_by_email, owner_email, owner_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (business_case_id, catalog_id)
         DO UPDATE SET
           selected = EXCLUDED.selected,
           notes = EXCLUDED.notes,
           quantity = EXCLUDED.quantity,
           characteristics = EXCLUDED.characteristics,
           unit_price = EXCLUDED.unit_price,
           updated_by_role = EXCLUDED.updated_by_role,
           updated_by_email = EXCLUDED.updated_by_email,
           owner_email = COALESCE(bc_investment_selections.owner_email, EXCLUDED.owner_email),
           owner_role = COALESCE(bc_investment_selections.owner_role, EXCLUDED.owner_role),
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
            user?.email || null,
            user?.email || null,
            user?.role || null
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
        const actorEmail = String(user?.email || "").trim().toLowerCase();
        for (const item of selections) {
            const { catalog_id, selected = true, notes = null, quantity = null, characteristics = null, unit_price = null } = item || {};
            if (!catalog_id) {
                const error = new Error("catalog_id es requerido en cada seleccion");
                error.status = 400;
                throw error;
            }

            const { rows: existingRows } = await client.query(
                `SELECT id, selected, quantity, owner_email, owner_role
                 FROM bc_investment_selections
                 WHERE business_case_id = $1
                   AND catalog_id = $2
                 LIMIT 1`,
                [businessCaseId, catalog_id]
            );
            const existing = existingRows[0] || null;
            const ownerEmail = String(existing?.owner_email || "").trim().toLowerCase();
            const ownerRole = String(existing?.owner_role || "").trim().toLowerCase();
            const selectedChanged = existing ? Boolean(existing.selected) !== Boolean(selected) : false;
            const quantityChanged = existing
                ? Number(existing.quantity ?? 0) !== Number(quantity ?? 0)
                : false;
            const isServiceActor = String(user?.role || "").trim().toLowerCase() === "jefe_servicio";
            const isForeignOwner = ownerEmail ? ownerEmail !== actorEmail : ownerRole && ownerRole !== "jefe_servicio";
            if (existing?.selected && isServiceActor && isForeignOwner) {
                const error = new Error(`El item ACP catalog_id=${catalog_id} es de solo lectura. Solicita un aumento si necesitas modificar una cantidad.`);
                error.status = 403;
                error.code = "INVESTMENT_ACP_ITEM_READ_ONLY";
                throw error;
            }
            if (existing && ownerEmail && actorEmail && ownerEmail !== actorEmail && (selectedChanged || quantityChanged)) {
                const error = new Error(`Solo el usuario propietario puede cambiar cantidad o quitar la inversion catalog_id=${catalog_id}.`);
                error.status = 403;
                error.code = "INVESTMENT_SELECTION_OWNER_REQUIRED";
                throw error;
            }

            const { rows } = await client.query(
                `INSERT INTO bc_investment_selections
                   (business_case_id, catalog_id, selected, notes, quantity, characteristics, unit_price, updated_by_role, updated_by_email, owner_email, owner_role)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (business_case_id, catalog_id)
                 DO UPDATE SET
                   selected = EXCLUDED.selected,
                   notes = EXCLUDED.notes,
                   quantity = EXCLUDED.quantity,
                   characteristics = EXCLUDED.characteristics,
                   unit_price = EXCLUDED.unit_price,
                   updated_by_role = EXCLUDED.updated_by_role,
                   updated_by_email = EXCLUDED.updated_by_email,
                   owner_email = COALESCE(bc_investment_selections.owner_email, EXCLUDED.owner_email),
                   owner_role = COALESCE(bc_investment_selections.owner_role, EXCLUDED.owner_role),
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
                    user?.email || null,
                    user?.email || null,
                    user?.role || null
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

async function createIncreaseQuantityRequest(businessCaseId, payload, user) {
    const catalogId = Number(payload?.catalog_id);
    const requestedQuantity = payload?.requested_quantity == null ? null : Number(payload.requested_quantity);
    const reason = String(payload?.reason || "").trim();
    if (!catalogId) {
        const error = new Error("catalog_id es requerido");
        error.status = 400;
        throw error;
    }
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        const error = new Error("requested_quantity debe ser mayor a 0");
        error.status = 400;
        throw error;
    }
    if (!reason) {
        const error = new Error("reason es requerido");
        error.status = 400;
        throw error;
    }

    const { rows: ownerRows } = await db.query(
        `SELECT owner_email, quantity, selected
         FROM bc_investment_selections
         WHERE business_case_id = $1
           AND catalog_id = $2
         LIMIT 1`,
        [businessCaseId, catalogId]
    );
    const owner = ownerRows[0];
    if (!owner || !owner.selected) {
        const error = new Error("La inversion no esta en carrito.");
        error.status = 409;
        throw error;
    }
    const currentQty = Number(owner.quantity ?? 0);
    if (requestedQuantity <= currentQty) {
        const error = new Error("La solicitud debe ser para una cantidad mayor a la actual.");
        error.status = 409;
        throw error;
    }
    const ownerEmail = String(owner.owner_email || "").trim().toLowerCase();
    const requesterEmail = String(user?.email || "").trim().toLowerCase();
    if (ownerEmail && requesterEmail && ownerEmail === requesterEmail) {
        const error = new Error("Eres propietario del item; modifica la cantidad directamente.");
        error.status = 409;
        throw error;
    }

    const { rows } = await db.query(
        `INSERT INTO bc_investment_selection_requests
           (business_case_id, catalog_id, request_type, requested_quantity, reason, status, requested_by_email, requested_by_role)
         VALUES ($1, $2, 'increase_quantity', $3, $4, 'pending', $5, $6)
         RETURNING *`,
        [
            businessCaseId,
            catalogId,
            requestedQuantity,
            reason,
            user?.email || null,
            user?.role || null,
        ]
    );
    return rows[0];
}

/**
 * Get selected investments with prices. Both value roles price the complete
 * selected cart; each role writes to its own price column.
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
           s.quotation_assignee_id,
           s.quotation_assignee_email,
           s.quotation_assignee_name,
           s.quotation_status,
           s.quotation_requested_at,
           s.depreciation_percentage,
           NULL AS depreciation_annual,
           NULL AS depreciation_monthly,
           NULL AS depreciation_projected,
           NULL AS depreciated_unit_price,
           s.owner_email,
           s.owner_role,
           s.updated_by_role,
           s.updated_by_email
         FROM bc_investment_catalog c
         INNER JOIN bc_investment_selections s
           ON s.catalog_id = c.id
          AND s.business_case_id = $1
          AND s.selected = true
         WHERE c.is_active = true
         ORDER BY c.name`,
        [businessCaseId]
    );
    if (investmentClass !== 'financiera') return rows;

    const pricingContext = await getInvestmentPricingContext(businessCaseId);
    const projectedMonths = Number(pricingContext?.projected_deadline_months);
    const months = Number.isFinite(projectedMonths) && projectedMonths > 0 ? projectedMonths : 0;

    return rows.map((row) => {
        const basePrice = Number(row.unit_price);
        const percentage = Number(row.depreciation_percentage);
        if (!Number.isFinite(basePrice) || basePrice < 0) {
            return {
                ...row,
                depreciation_annual: null,
                depreciation_monthly: null,
                depreciation_projected: null,
                depreciated_unit_price: null,
            };
        }

        const depreciation = calculateFinancialDepreciation({
            unitPrice: basePrice,
            percentage,
            projectedMonths: months,
        });

        return {
            ...row,
            depreciation_annual: depreciation.annual,
            depreciation_monthly: depreciation.monthly,
            depreciation_projected: depreciation.projected,
            depreciated_unit_price: depreciation.net,
        };
    });
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
            const { catalog_id, unit_price, depreciation_percentage } = item || {};
            if (catalog_id == null) {
                const error = new Error('catalog_id es requerido en cada valor');
                error.status = 400;
                throw error;
            }

            // Both value roles can price every selected item in their own column.
            const check = await client.query(
                `SELECT s.id
                 FROM bc_investment_selections s
                 INNER JOIN bc_investment_catalog c ON c.id = s.catalog_id
                   WHERE s.business_case_id = $1
                   AND s.catalog_id = $2
                   AND s.selected = true`,
                [businessCaseId, catalog_id]
            );
            if (!check.rows.length) continue; // skip items not selected for this BC

            const params = [
                unit_price ?? null,
                user?.role || null,
                user?.email || null,
                businessCaseId,
                catalog_id,
            ];
            const depreciationAssignment = investmentClass === 'financiera'
                ? ', depreciation_percentage = $2'
                : '';
            if (investmentClass === 'financiera') params.splice(5, 0, depreciation_percentage ?? null);
            const businessCaseParam = investmentClass === 'financiera' ? '$5' : '$4';
            const catalogParam = investmentClass === 'financiera' ? '$6' : '$5';
            const roleParam = investmentClass === 'financiera' ? '$3' : '$2';
            const emailParam = investmentClass === 'financiera' ? '$4' : '$3';
            const priceParam = '$1';
            const { rows } = await client.query(
                `UPDATE bc_investment_selections
                 SET ${priceColumn} = ${priceParam}${depreciationAssignment},
                     updated_by_role = ${roleParam},
                     updated_by_email = ${emailParam},
                     updated_at = now()
                 WHERE business_case_id = ${businessCaseParam}
                   AND catalog_id = ${catalogParam}
                 RETURNING *`,
                investmentClass === 'financiera'
                    ? [unit_price ?? null, depreciation_percentage ?? null, user?.role || null, user?.email || null, businessCaseId, catalog_id]
                    : params,
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

async function getInvestmentPricingContext(businessCaseId) {
    const { rows } = await db.query(
        `SELECT
           COALESCE(br.deadline_months, epr.deadline_months) AS deadline_months,
           COALESCE(br.projected_deadline_months, epr.projected_deadline_months) AS projected_deadline_months,
           COALESCE(
             array_agg(DISTINCT COALESCE(eq.nombre, eq.modelo)) FILTER (WHERE bes.is_primary IS TRUE AND eq.id_equipo IS NOT NULL),
             ARRAY[]::text[]
           ) AS primary_equipment_names,
           COALESCE(
             array_agg(DISTINCT COALESCE(eq.nombre, eq.modelo)) FILTER (
               WHERE bes.is_primary IS FALSE
                 AND eq.id_equipo IS NOT NULL
                 AND EXISTS (
                   SELECT 1
                     FROM jsonb_array_elements(
                       CASE
                         WHEN jsonb_typeof(epr.extra->'equipment_details') = 'array'
                         THEN epr.extra->'equipment_details'
                         ELSE '[]'::jsonb
                       END
                     ) AS equipment_detail
                    WHERE equipment_detail->>'backup_id' = bes.equipment_id::text
                      AND lower(COALESCE(equipment_detail->>'backup_install_simultaneous', 'false')) IN ('true', '1', 'yes', 'si', 'sí')
                 )
             ),
             ARRAY[]::text[]
           ) AS backup_equipment_names
         FROM equipment_purchase_requests epr
         LEFT JOIN bc_requirements br ON br.business_case_id = epr.id
         LEFT JOIN bc_equipment_selection bes ON bes.business_case_id = epr.id
         LEFT JOIN servicio.equipos eq ON eq.id_equipo = bes.equipment_id
         WHERE epr.id = $1
         GROUP BY epr.id, br.deadline_months, br.projected_deadline_months`,
        [businessCaseId],
    );
    return rows[0] || {
        deadline_months: null,
        projected_deadline_months: null,
        primary_equipment_names: [],
        backup_equipment_names: [],
    };
}

async function listInvestmentQuotationAssignees() {
    const { rows } = await db.query(
        `SELECT id, email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS name, role
         FROM users
         WHERE active = true
           AND email IS NOT NULL
         ORDER BY COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email), email`,
    );
    return rows;
}

async function assignInvestmentQuotation(businessCaseId, catalogId, assigneeId, user) {
    const normalizedCatalogId = Number(catalogId);
    if (!Number.isInteger(normalizedCatalogId) || normalizedCatalogId <= 0) {
        const error = new Error('catalog_id es requerido');
        error.status = 400;
        throw error;
    }

    const normalizedAssigneeId = assigneeId == null || assigneeId === '' ? null : Number(assigneeId);
    if (normalizedAssigneeId !== null && (!Number.isInteger(normalizedAssigneeId) || normalizedAssigneeId <= 0)) {
        const error = new Error('assignee_id es invalido');
        error.status = 400;
        throw error;
    }

    let assignee = null;
    if (normalizedAssigneeId !== null) {
        const result = await db.query(
            `SELECT id, email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS name, role
             FROM users
             WHERE id = $1 AND active = true
             LIMIT 1`,
            [normalizedAssigneeId],
        );
        assignee = result.rows[0] || null;
        if (!assignee) {
            const error = new Error('El usuario seleccionado no existe o esta inactivo');
            error.status = 400;
            throw error;
        }
    }

    const { rows } = await db.query(
        `UPDATE bc_investment_selections
         SET quotation_assignee_id = $1,
             quotation_assignee_email = $2,
             quotation_assignee_name = $3,
             quotation_status = CASE WHEN $1::integer IS NULL THEN 'not_requested' ELSE quotation_status END,
             updated_by_role = $4,
             updated_by_email = $5,
             updated_at = now()
         WHERE business_case_id = $6
           AND catalog_id = $7
           AND selected = true
         RETURNING *`,
        [
            assignee?.id || null,
            assignee?.email || null,
            assignee?.name || null,
            user?.role || null,
            user?.email || null,
            businessCaseId,
            normalizedCatalogId,
        ],
    );
    if (!rows.length) {
        const error = new Error('La inversion no esta seleccionada en este Business Case');
        error.status = 404;
        throw error;
    }
    return { selection: rows[0], assignee };
}

async function requestInvestmentQuotation(businessCaseId, catalogId, user) {
    const normalizedCatalogId = Number(catalogId);
    const current = await db.query(
        `SELECT s.*, c.name, c.category, c.code
         FROM bc_investment_selections s
         INNER JOIN bc_investment_catalog c ON c.id = s.catalog_id
         WHERE s.business_case_id = $1
           AND s.catalog_id = $2
           AND s.selected = true
         LIMIT 1`,
        [businessCaseId, normalizedCatalogId],
    );
    const selection = current.rows[0];
    if (!selection) {
        const error = new Error('La inversion no esta seleccionada en este Business Case');
        error.status = 404;
        throw error;
    }
    if (!selection.quotation_assignee_id || !selection.quotation_assignee_email) {
        const error = new Error('Asigna primero un responsable para solicitar la cotizacion');
        error.status = 409;
        error.code = 'INVESTMENT_QUOTATION_ASSIGNEE_REQUIRED';
        throw error;
    }
    if (selection.quotation_status === 'requested' && selection.quotation_requested_at) {
        return { selection, assignee: {
            id: selection.quotation_assignee_id,
            email: selection.quotation_assignee_email,
            name: selection.quotation_assignee_name,
        }, alreadyRequested: true };
    }

    const { rows } = await db.query(
        `UPDATE bc_investment_selections
         SET quotation_status = 'requested',
             quotation_requested_at = now(),
             quotation_requested_by = $1,
             quotation_requested_by_email = $2,
             updated_by_role = $3,
             updated_by_email = $2,
             updated_at = now()
         WHERE business_case_id = $4
           AND catalog_id = $5
         RETURNING *`,
        [user?.id || null, user?.email || null, user?.role || null, businessCaseId, normalizedCatalogId],
    );
    return {
        selection: rows[0],
        assignee: {
            id: rows[0].quotation_assignee_id,
            email: rows[0].quotation_assignee_email,
            name: rows[0].quotation_assignee_name,
        },
        alreadyRequested: false,
    };
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
async function stampInvestmentDeadlines(
    businessCaseId,
    deadlineHours = 48,
    { operational = true, financial = true } = {},
) {
    const now = new Date();
    const deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);
    const assignments = ["invest_selections_changed_at = $1"];
    const params = [now];
    if (operational) {
        params.push(deadline);
        assignments.push(`invest_values_op_deadline_at = $${params.length}`);
    }
    if (financial) {
        params.push(deadline);
        assignments.push(`invest_values_fin_deadline_at = $${params.length}`);
    }
    params.push(businessCaseId);
    await db.query(
        `UPDATE equipment_purchase_requests
         SET ${assignments.join(",\n             ")}
         WHERE id = $${params.length}`,
        params,
    );
    return { startedAt: now, deadlineAt: deadline };
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
    getInvestmentPricingContext,
    calculateFinancialDepreciation,
    listInvestmentQuotationAssignees,
    assignInvestmentQuotation,
    requestInvestmentQuotation,
    createIncreaseQuantityRequest,
    detectInvestmentSelectionChanges,
    stampInvestmentDeadlines,
};
