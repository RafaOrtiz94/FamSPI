/**
 * Investments Service
 * Manages additional investments for Business Cases
 */

const db = require('../../config/db');
const logger = require('../../config/logger');

// Edicion en paralelo sin dueno por item: la proteccion contra pisar el
// trabajo de otro es que la cantidad nunca puede bajar, solo subir --
// EXCEPTO para quien agrego esa inversion originalmente (bc_investment_
// selections.owner_email, seteado en el primer INSERT y preservado en cada
// UPDATE posterior via COALESCE). Esa persona si puede disminuirla o
// dejarla en 0; cualquier otro rol habilitado solo puede aumentarla.
//
// NOTA: esta funcion y su uso en upsertInvestmentSelection/
// upsertInvestmentSelectionsBatch habian sido eliminados por completo en un
// cambio anterior (comentario que decia "retirado a pedido de negocio,
// 2026-09-22") dejando solo el aviso visual en el frontend sin ningun
// bloqueo real detras. Se restauro a pedido explicito del usuario
// (2026-09-23): el mensaje debe bloquear de verdad, no solo mostrarse.
function assertQuantityCanOnlyIncrease(existingQuantity, incomingQuantity, catalogId, { ownerEmail, actingUser } = {}) {
    const existing = Number(existingQuantity ?? 0);
    const incoming = Number(incomingQuantity ?? 0);
    if (existing <= 0 || incoming >= existing) return;

    const isOwner = Boolean(
        ownerEmail
        && actingUser?.email
        && String(ownerEmail).trim().toLowerCase() === String(actingUser.email).trim().toLowerCase(),
    );
    if (isOwner) return;

    const error = new Error("Solo quien agregó esta inversión puede disminuirla, usted solo puede aumentarla.");
    error.status = 409;
    error.code = "INVESTMENT_QUANTITY_CANNOT_DECREASE";
    error.detail = `catalog_id=${catalogId}, actual=${existing}, enviado=${incoming}`;
    throw error;
}

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
        `SELECT id, code, name, category, investment_class, display_order, is_active
         FROM bc_investment_catalog
         WHERE is_active = true
         ORDER BY display_order NULLS LAST, name`
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
    const error = new Error("El catalogo de inversiones es fijo. Usa el item Otros para inversiones no listadas.");
    error.status = 400;
    error.code = "INVESTMENT_CATALOG_FIXED";
    throw error;
}

async function getInvestmentSelections(businessCaseId) {
    const { rows } = await db.query(
        `SELECT catalog_id, selected, notes, quantity, characteristics, unit_price, unit_price_financial, depreciation_percentage, updated_by_role, updated_by_email, owner_email, owner_role
         FROM bc_investment_selections
         WHERE business_case_id = $1`,
        [businessCaseId]
    );
    return rows;
}

// Compara las selecciones antes y despues de un guardado y devuelve solo los items cuya cantidad
// cambio: "added" (no estaba), "updated" (cantidad distinta) o "removed" (cantidad a 0).
function detectInvestmentSelectionChanges(previousRows = [], savedRows = []) {
    const previous = new Map(previousRows.map((row) => [String(row.catalog_id), row]));
    return savedRows
        .map((row) => {
            const before = previous.get(String(row.catalog_id));
            const previousQuantity = before?.selected && Number(before.quantity) > 0 ? Number(before.quantity) : 0;
            const quantity = Number(row.quantity) > 0 ? Number(row.quantity) : 0;
            if (previousQuantity === quantity) return null;
            const type = !previousQuantity ? "added" : !quantity ? "removed" : "updated";
            return { catalog_id: row.catalog_id, type, previous_quantity: previousQuantity, quantity };
        })
        .filter(Boolean);
}

// Texto corto del cambio; lo usan la notificacion y la marca de precio pendiente.
function describeInvestmentSelectionChange(change = {}) {
    if (change.type === "added") return `Agregada - cantidad ${change.quantity}`;
    if (change.type === "removed") return `Retirada - tenia ${change.previous_quantity}`;
    return `Cantidad editada - de ${change.previous_quantity} a ${change.quantity}`;
}

// Deja el precio "pendiente de revisar" en los items agregados o con cantidad editada.
// La marca se limpia al guardar de nuevo el precio financiero (saveInvestmentValuesBatch).
async function markInvestmentPriceReviewPending(businessCaseId, changes = []) {
    const pending = changes.filter((change) => change.type !== "removed");
    for (const change of pending) {
        await db.query(
            `UPDATE bc_investment_selections
                SET price_review_pending_at = now(),
                    price_review_note = $3
              WHERE business_case_id = $1
                AND catalog_id = $2`,
            [businessCaseId, change.catalog_id, describeInvestmentSelectionChange(change)]
        );
    }
    return pending.length;
}

// Incluye los items de "Otros" propios de este BC (parent_catalog_id) mientras
// esten seleccionados; los de otros BCs nunca aparecen (sin seleccion aqui).
async function getCatalogWithSelections(businessCaseId) {
    await ensureInvestmentHistorySchema();
    const { rows } = await db.query(
        `SELECT c.id, c.code, c.name, c.category, c.investment_class, c.display_order, c.is_active,
                c.parent_catalog_id,
                COALESCE(s.selected, false) AS selected,
                s.notes,
                s.quantity,
                s.characteristics,
                s.unit_price,
                s.unit_price_financial,
                s.depreciation_percentage,
                s.updated_by_role,
                s.updated_by_email,
                s.owner_email,
                s.owner_role
         FROM bc_investment_catalog c
         LEFT JOIN bc_investment_selections s
           ON s.catalog_id = c.id
          AND s.business_case_id = $1
         WHERE (c.is_active = true AND c.business_case_id IS NULL)
            OR s.selected = true
         ORDER BY c.display_order NULLS LAST,
                  (c.parent_catalog_id IS NOT NULL),
                  CASE WHEN c.parent_catalog_id IS NULL THEN c.name END,
                  c.id`,
        [businessCaseId]
    );
    return rows;
}

const OTROS_CATALOG_NAME = 'otros';
const OTROS_ITEM_NAME_MAX = 200;

// Crea filas de catalogo propias del BC para items agregados bajo "Otros".
// La seleccion (cantidad, caracteristicas) la guarda despues el flujo normal.
async function createOtrosCatalogItems(businessCaseId, items = [], user) {
    await ensureInvestmentHistorySchema();
    if (!Array.isArray(items) || !items.length) return [];
    const { rows: parentRows } = await db.query(
        `SELECT id, category, investment_class, display_order
           FROM bc_investment_catalog
          WHERE lower(trim(name)) = $1 AND business_case_id IS NULL
          ORDER BY is_active DESC, id
          LIMIT 1`,
        [OTROS_CATALOG_NAME],
    );
    const parent = parentRows[0];
    if (!parent) {
        const error = new Error('No existe el item "Otros" en el catalogo de inversiones');
        error.status = 409;
        error.code = 'INVESTMENT_OTROS_PARENT_MISSING';
        throw error;
    }

    const created = [];
    for (const item of items) {
        const name = String(item?.name || '').trim().slice(0, OTROS_ITEM_NAME_MAX);
        if (!name) {
            const error = new Error('Cada item de "Otros" necesita un nombre');
            error.status = 400;
            error.code = 'INVESTMENT_OTROS_NAME_REQUIRED';
            throw error;
        }
        const { rows } = await db.query(
            `INSERT INTO bc_investment_catalog
               (code, name, category, investment_class, display_order, is_active, parent_catalog_id, business_case_id, created_by_email)
             VALUES (NULL, $1, $2, $3, $4, false, $5, $6, $7)
             RETURNING id, name, parent_catalog_id`,
            [name, parent.category, parent.investment_class || 'operativa', parent.display_order, parent.id, businessCaseId, user?.email || null],
        );
        created.push({ ...rows[0], source: item });
    }
    return created;
}

// Un item de "Otros" de otro BC no se puede seleccionar aqui.
async function assertCatalogItemsBelongToBusinessCase(businessCaseId, catalogIds = []) {
    const ids = [...new Set(catalogIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return;
    await ensureInvestmentHistorySchema();
    const { rows } = await db.query(
        `SELECT id FROM bc_investment_catalog
          WHERE id = ANY($1::integer[])
            AND business_case_id IS NOT NULL
            AND business_case_id <> $2`,
        [ids, businessCaseId],
    );
    if (rows.length) {
        const error = new Error('El item de inversion pertenece a otro Business Case');
        error.status = 400;
        error.code = 'INVESTMENT_ITEM_OTHER_BUSINESS_CASE';
        throw error;
    }
}

async function upsertInvestmentSelection(businessCaseId, data, user) {
    const { catalog_id, notes = null, quantity = null, characteristics = null, unit_price = null } = data;
    if (!catalog_id) {
        const error = new Error("catalog_id es requerido");
        error.status = 400;
        throw error;
    }

    const { rows: existingRows } = await db.query(
        `SELECT id, quantity, owner_email
         FROM bc_investment_selections
         WHERE business_case_id = $1
           AND catalog_id = $2
         LIMIT 1`,
        [businessCaseId, catalog_id]
    );
    const existing = existingRows[0] || null;
    assertQuantityCanOnlyIncrease(existing?.quantity, quantity, catalog_id, { ownerEmail: existing?.owner_email, actingUser: user });

    // Edicion en paralelo: sin carrito ni dueno por item -- cualquier rol
    // habilitado puede tocar cualquier inversion. "Seleccionada" se deriva
    // de la cantidad, no de un checkbox manual.
    const selected = Number(quantity) > 0;
    // Sin unit_price en el payload se conserva el precio operativo guardado:
    // editar cantidad/caracteristicas no debe borrarlo (antes quedaba en NULL).
    const hasUnitPrice = Object.prototype.hasOwnProperty.call(data, 'unit_price');

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
           unit_price = CASE WHEN $12::boolean THEN EXCLUDED.unit_price ELSE bc_investment_selections.unit_price END,
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
            user?.role || null,
            hasUnitPrice,
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
            const { catalog_id, notes = null, quantity = null, characteristics = null, unit_price = null } = item || {};
            if (!catalog_id) {
                const error = new Error("catalog_id es requerido en cada seleccion");
                error.status = 400;
                throw error;
            }

            const { rows: existingRows } = await client.query(
                `SELECT id, quantity, owner_email
                 FROM bc_investment_selections
                 WHERE business_case_id = $1
                   AND catalog_id = $2
                 LIMIT 1`,
                [businessCaseId, catalog_id]
            );
            const existing = existingRows[0] || null;
            assertQuantityCanOnlyIncrease(existing?.quantity, quantity, catalog_id, { ownerEmail: existing?.owner_email, actingUser: user });
            const selected = Number(quantity) > 0;

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
                   unit_price = CASE WHEN $12::boolean THEN EXCLUDED.unit_price ELSE bc_investment_selections.unit_price END,
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
                    user?.role || null,
                    Object.prototype.hasOwnProperty.call(item || {}, 'unit_price'),
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
 * Get selected investments with prices. Both value roles price the complete
 * selected cart; each role writes to its own price column.
 */
async function getInvestmentValuesByClass(businessCaseId, investmentClass, { assigneeId = null } = {}) {
    const validClasses = ['operativa', 'financiera'];
    if (!validClasses.includes(investmentClass)) {
        const error = new Error(`Clase de inversión inválida: ${investmentClass}`);
        error.status = 400;
        throw error;
    }

    const priceColumn = investmentClass === 'operativa' ? 's.unit_price' : 's.unit_price_financial';
    await ensureInvestmentHistorySchema();
    const normalizedAssigneeId = assigneeId == null ? null : Number(assigneeId);
    if (normalizedAssigneeId !== null && (!Number.isInteger(normalizedAssigneeId) || normalizedAssigneeId <= 0)) {
        const error = new Error("Usuario asignado inválido");
        error.status = 400;
        throw error;
    }

    const { rows } = await db.query(
        `SELECT
           c.id AS catalog_id,
           c.code,
           c.name,
           c.category,
           c.investment_class,
           c.display_order,
           c.parent_catalog_id,
           parent.name AS parent_name,
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
           s.updated_by_email,
           s.price_review_pending_at,
           s.price_review_note
         FROM bc_investment_catalog c
         INNER JOIN bc_investment_selections s
           ON s.catalog_id = c.id
          AND s.business_case_id = $1
          AND s.selected = true
         LEFT JOIN bc_investment_catalog parent ON parent.id = c.parent_catalog_id
          WHERE (c.is_active = true OR s.selected = true)
            AND ($2::integer IS NULL OR s.quotation_assignee_id = $2)
         ORDER BY c.display_order NULLS LAST,
                  (c.parent_catalog_id IS NOT NULL),
                  CASE WHEN c.parent_catalog_id IS NULL THEN c.name END,
                  c.id`,
        [businessCaseId, normalizedAssigneeId]
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

async function hasInvestmentQuotationAssignment(businessCaseId, userId) {
    const normalizedUserId = Number(userId);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return false;

    const { rows } = await db.query(
        `SELECT 1
           FROM bc_investment_selections
          WHERE business_case_id = $1
            AND selected = true
            AND quotation_assignee_id = $2
          LIMIT 1`,
        [businessCaseId, normalizedUserId],
    );
    return rows.length > 0;
}

async function assertInvestmentQuotationAssignments(businessCaseId, userId, catalogIds = []) {
    const normalizedUserId = Number(userId);
    const normalizedCatalogIds = [...new Set((catalogIds || []).map(Number))];
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || !normalizedCatalogIds.length || normalizedCatalogIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        const error = new Error("La cotización asignada no es válida");
        error.status = 403;
        throw error;
    }

    const { rows } = await db.query(
        `SELECT catalog_id
           FROM bc_investment_selections
          WHERE business_case_id = $1
            AND selected = true
            AND quotation_assignee_id = $2
            AND catalog_id = ANY($3::integer[])`,
        [businessCaseId, normalizedUserId, normalizedCatalogIds],
    );
    if (rows.length !== normalizedCatalogIds.length) {
        const error = new Error("Solo puedes registrar valores de las cotizaciones que te fueron asignadas");
        error.status = 403;
        error.code = "INVESTMENT_QUOTATION_ASSIGNMENT_REQUIRED";
        throw error;
    }
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
    await ensureInvestmentHistorySchema();
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
                `SELECT s.id, s.${priceColumn} AS previous_unit_price, s.depreciation_percentage AS previous_depreciation
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
            // Guardar el precio financiero cierra la revision pendiente por cambio de cantidad.
            const depreciationAssignment = investmentClass === 'financiera'
                ? ', depreciation_percentage = $2, price_review_pending_at = NULL, price_review_note = NULL'
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
            if (rows.length) {
                out.push(rows[0]);
                await recordPriceEventIfChanged(client, {
                    businessCaseId,
                    catalogId: catalog_id,
                    investmentClass,
                    previous: check.rows[0],
                    saved: rows[0],
                    reusedFromBusinessCaseId: item.reused_from_business_case_id,
                    user,
                });
            }
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
    // 'received' (ya subio archivo) tampoco se re-solicita: no regresa a 'requested'.
    if (['requested', 'received'].includes(selection.quotation_status) && selection.quotation_requested_at) {
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

// ─── Archivos de cotizacion por item ────────────────────────────────────────
// El cotizador asignado (o un rol de valores) sube 1..n cotizaciones por item;
// jefe_financiero las revisa y registra el valor. Borrado logico (active=false):
// el archivo sigue en Drive.

const QUOTATION_MAX_BYTES = 15 * 1024 * 1024;
const QUOTATION_ALLOWED_MIME = /^(application\/pdf|image\/(jpeg|png|webp)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel|application\/msword)$/;

// Archivos de cotizacion + historico de precios (migraciones 309 y 322). Se
// asegura en runtime porque las migraciones se aplican a mano.
let quotationFilesSchemaPromise = null;
function ensureInvestmentHistorySchema() {
    if (!quotationFilesSchemaPromise) {
        quotationFilesSchemaPromise = db.query(`
            CREATE TABLE IF NOT EXISTS public.bc_investment_quotation_files (
              id                BIGSERIAL PRIMARY KEY,
              business_case_id  UUID        NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
              catalog_id        INTEGER     NOT NULL REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
              file_name         TEXT        NOT NULL,
              mime_type         TEXT,
              size_bytes        INTEGER,
              drive_file_id     TEXT        NOT NULL,
              drive_url         TEXT,
              uploaded_by       INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
              uploaded_by_email TEXT,
              uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
              active            BOOLEAN     NOT NULL DEFAULT true,
              removed_at        TIMESTAMPTZ,
              removed_by_email  TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_bc_investment_quotation_files_item
              ON public.bc_investment_quotation_files (business_case_id, catalog_id) WHERE active = true;
            ALTER TABLE public.bc_investment_quotation_files
              ADD COLUMN IF NOT EXISTS supplier_name TEXT,
              ADD COLUMN IF NOT EXISTS quotation_date DATE,
              ADD COLUMN IF NOT EXISTS reused_from_file_id BIGINT REFERENCES public.bc_investment_quotation_files(id) ON DELETE SET NULL;
            CREATE TABLE IF NOT EXISTS public.bc_investment_price_events (
              id                          BIGSERIAL PRIMARY KEY,
              business_case_id            UUID        NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
              catalog_id                  INTEGER     NOT NULL REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
              price_class                 TEXT        NOT NULL CHECK (price_class IN ('operativa', 'financiera')),
              previous_unit_price         NUMERIC(12,2),
              unit_price                  NUMERIC(12,2),
              previous_depreciation       NUMERIC(5,2),
              depreciation_percentage     NUMERIC(5,2),
              quantity                    INTEGER,
              reused_from_business_case_id UUID REFERENCES public.equipment_purchase_requests(id) ON DELETE SET NULL,
              changed_by                  INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
              changed_by_email            TEXT,
              changed_by_role             TEXT,
              changed_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_bc_investment_price_events_item
              ON public.bc_investment_price_events (business_case_id, catalog_id, changed_at DESC);
            CREATE INDEX IF NOT EXISTS idx_bc_investment_price_events_catalog
              ON public.bc_investment_price_events (catalog_id, changed_at DESC);
            ALTER TABLE public.bc_investment_catalog
              ADD COLUMN IF NOT EXISTS parent_catalog_id INTEGER REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
              ADD COLUMN IF NOT EXISTS business_case_id UUID REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
              ADD COLUMN IF NOT EXISTS created_by_email TEXT;
            CREATE INDEX IF NOT EXISTS idx_bc_investment_catalog_business_case
              ON public.bc_investment_catalog (business_case_id)
              WHERE business_case_id IS NOT NULL;
        `).catch((error) => {
            quotationFilesSchemaPromise = null;
            throw error;
        });
    }
    return quotationFilesSchemaPromise;
}

// Map catalog_id -> [archivos activos], para adjuntar a cada item de la UI.
async function listQuotationFilesByCatalog(businessCaseId) {
    await ensureInvestmentHistorySchema();
    const { rows } = await db.query(
        `SELECT id, catalog_id, file_name, mime_type, size_bytes, drive_url, uploaded_by_email, uploaded_at,
                supplier_name, quotation_date, reused_from_file_id
           FROM public.bc_investment_quotation_files
          WHERE business_case_id = $1 AND active = true
          ORDER BY uploaded_at ASC`,
        [businessCaseId],
    );
    const map = new Map();
    rows.forEach((row) => {
        const key = Number(row.catalog_id);
        map.set(key, [...(map.get(key) || []), row]);
    });
    return map;
}

// Proveedor y fecha de emision son obligatorios: sin ellos la cotizacion no
// sirve como referencia en el historico.
function normalizeQuotationMetadata({ supplierName, quotationDate }) {
    const supplier = String(supplierName || '').trim().slice(0, 200);
    if (!supplier) {
        const error = new Error('Indica el proveedor de la cotización');
        error.status = 400;
        throw error;
    }
    const date = String(quotationDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        const error = new Error('Indica la fecha de la cotización (AAAA-MM-DD)');
        error.status = 400;
        throw error;
    }
    return { supplier, date };
}

async function addQuotationFile({ businessCaseId, catalogId, file, supplierName, quotationDate, user }) {
    await ensureInvestmentHistorySchema();
    const normalizedCatalogId = Number(catalogId);
    if (!file?.buffer?.length) {
        const error = new Error('Adjunta el archivo de la cotización');
        error.status = 400;
        throw error;
    }
    const metadata = normalizeQuotationMetadata({ supplierName, quotationDate });
    if (file.size > QUOTATION_MAX_BYTES) {
        const error = new Error('El archivo supera el máximo de 15 MB');
        error.status = 400;
        throw error;
    }
    if (!QUOTATION_ALLOWED_MIME.test(String(file.mimetype || ''))) {
        const error = new Error('Formato no permitido. Usa PDF, imagen (JPG/PNG/WebP), Excel o Word');
        error.status = 400;
        throw error;
    }

    const { rows: selectionRows } = await db.query(
        `SELECT s.id, c.name
           FROM public.bc_investment_selections s
           JOIN public.bc_investment_catalog c ON c.id = s.catalog_id
          WHERE s.business_case_id = $1 AND s.catalog_id = $2 AND s.selected = true
          LIMIT 1`,
        [businessCaseId, normalizedCatalogId],
    );
    if (!selectionRows.length) {
        const error = new Error('El item no está seleccionado en este Business Case');
        error.status = 404;
        throw error;
    }
    const itemName = selectionRows[0].name;

    const { ensureBusinessCaseDriveFolderById } = require('./businessCaseDriveFolder.service');
    const { ensureFolder, uploadBase64File } = require('../../utils/drive');
    const bcFolder = await ensureBusinessCaseDriveFolderById(businessCaseId);
    const quotationsFolder = await ensureFolder('Cotizaciones inversiones', bcFolder.folderId);
    const itemFolder = await ensureFolder(String(itemName || normalizedCatalogId), quotationsFolder.id);
    const fileName = String(file.originalname || 'cotizacion').trim();
    const uploaded = await uploadBase64File(fileName, file.buffer.toString('base64'), file.mimetype, itemFolder.id);
    const driveUrl = uploaded?.webViewLink || (uploaded?.id ? `https://drive.google.com/file/d/${uploaded.id}/view` : null);

    const { rows } = await db.query(
        `INSERT INTO public.bc_investment_quotation_files
           (business_case_id, catalog_id, file_name, mime_type, size_bytes, drive_file_id, drive_url, uploaded_by, uploaded_by_email, supplier_name, quotation_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, catalog_id, file_name, mime_type, size_bytes, drive_url, uploaded_by_email, uploaded_at, supplier_name, quotation_date, reused_from_file_id`,
        [
            businessCaseId,
            normalizedCatalogId,
            fileName,
            file.mimetype || null,
            file.size || file.buffer.length,
            uploaded.id,
            driveUrl,
            Number.isInteger(Number(user?.id)) ? Number(user.id) : null,
            user?.email || null,
            metadata.supplier,
            metadata.date,
        ],
    );
    await db.query(
        `UPDATE public.bc_investment_selections
            SET quotation_status = 'received', updated_at = now()
          WHERE business_case_id = $1 AND catalog_id = $2 AND selected = true`,
        [businessCaseId, normalizedCatalogId],
    );
    logger.info({ businessCaseId, catalogId: normalizedCatalogId, fileId: rows[0].id }, 'Quotation file uploaded');
    return { file: rows[0], itemName };
}

async function removeQuotationFile({ businessCaseId, fileId, user }) {
    await ensureInvestmentHistorySchema();
    const { rows } = await db.query(
        `UPDATE public.bc_investment_quotation_files
            SET active = false, removed_at = now(), removed_by_email = $3
          WHERE id = $1 AND business_case_id = $2 AND active = true
          RETURNING id, catalog_id`,
        [Number(fileId), businessCaseId, user?.email || null],
    );
    if (!rows.length) {
        const error = new Error('Cotización no encontrada');
        error.status = 404;
        throw error;
    }
    const catalogId = rows[0].catalog_id;
    // Sin archivos restantes, la cotizacion vuelve a "solicitada".
    await db.query(
        `UPDATE public.bc_investment_selections s
            SET quotation_status = 'requested', updated_at = now()
          WHERE s.business_case_id = $1 AND s.catalog_id = $2 AND s.quotation_status = 'received'
            AND NOT EXISTS (
              SELECT 1 FROM public.bc_investment_quotation_files f
               WHERE f.business_case_id = $1 AND f.catalog_id = $2 AND f.active = true
            )`,
        [businessCaseId, catalogId],
    );
    return { id: rows[0].id, catalog_id: catalogId };
}

async function getQuotationFileCatalogId(businessCaseId, fileId) {
    await ensureInvestmentHistorySchema();
    const { rows } = await db.query(
        `SELECT catalog_id FROM public.bc_investment_quotation_files WHERE id = $1 AND business_case_id = $2 AND active = true`,
        [Number(fileId), businessCaseId],
    );
    return rows[0]?.catalog_id ?? null;
}

// ─── Historico reutilizable de precios y cotizaciones ───────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameNullableNumber(left, right) {
    if (left == null || right == null) return left == null && right == null;
    return Number(left) === Number(right);
}

// Deja un evento solo si el guardado cambio el precio (o la depreciacion, en
// financiera). Corre dentro de la transaccion de saveInvestmentValuesBatch.
async function recordPriceEventIfChanged(client, { businessCaseId, catalogId, investmentClass, previous, saved, reusedFromBusinessCaseId, user }) {
    const isFinancial = investmentClass === 'financiera';
    const savedPrice = isFinancial ? saved.unit_price_financial : saved.unit_price;
    const priceChanged = !sameNullableNumber(previous?.previous_unit_price, savedPrice);
    const depreciationChanged = isFinancial && !sameNullableNumber(previous?.previous_depreciation, saved.depreciation_percentage);
    if (!priceChanged && !depreciationChanged) return;

    const reusedFrom = UUID_PATTERN.test(String(reusedFromBusinessCaseId || '')) ? reusedFromBusinessCaseId : null;
    await client.query(
        `INSERT INTO public.bc_investment_price_events
           (business_case_id, catalog_id, price_class, previous_unit_price, unit_price,
            previous_depreciation, depreciation_percentage, quantity, reused_from_business_case_id,
            changed_by, changed_by_email, changed_by_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
            businessCaseId,
            catalogId,
            investmentClass,
            previous?.previous_unit_price ?? null,
            savedPrice ?? null,
            isFinancial ? previous?.previous_depreciation ?? null : null,
            isFinancial ? saved.depreciation_percentage ?? null : null,
            saved.quantity ?? null,
            reusedFrom,
            Number.isInteger(Number(user?.id)) ? Number(user.id) : null,
            user?.email || null,
            user?.role || null,
        ],
    );
}

// Vincula al item de este BC un archivo de cotizacion de otro BC (mismo item del
// catalogo). No duplica el archivo en Drive: copia la fila apuntando al mismo
// drive_file_id y guarda el origen en reused_from_file_id.
async function reuseQuotationFile({ businessCaseId, catalogId, sourceFileId, user }) {
    await ensureInvestmentHistorySchema();
    const normalizedCatalogId = Number(catalogId);
    const { rows: sourceRows } = await db.query(
        `SELECT * FROM public.bc_investment_quotation_files WHERE id = $1 AND active = true`,
        [Number(sourceFileId)],
    );
    const source = sourceRows[0];
    if (!source) {
        const error = new Error('Cotización de origen no encontrada');
        error.status = 404;
        throw error;
    }
    if (String(source.business_case_id) === String(businessCaseId)) {
        const error = new Error('La cotización ya pertenece a este Business Case');
        error.status = 409;
        throw error;
    }
    if (Number(source.catalog_id) !== normalizedCatalogId) {
        const error = new Error('La cotización corresponde a otro ítem de inversión');
        error.status = 400;
        throw error;
    }

    const { rows: selectionRows } = await db.query(
        `SELECT c.name
           FROM public.bc_investment_selections s
           JOIN public.bc_investment_catalog c ON c.id = s.catalog_id
          WHERE s.business_case_id = $1 AND s.catalog_id = $2 AND s.selected = true
          LIMIT 1`,
        [businessCaseId, normalizedCatalogId],
    );
    if (!selectionRows.length) {
        const error = new Error('El item no está seleccionado en este Business Case');
        error.status = 404;
        throw error;
    }
    const { rows: duplicateRows } = await db.query(
        `SELECT 1 FROM public.bc_investment_quotation_files
          WHERE business_case_id = $1 AND catalog_id = $2 AND drive_file_id = $3 AND active = true
          LIMIT 1`,
        [businessCaseId, normalizedCatalogId, source.drive_file_id],
    );
    if (duplicateRows.length) {
        const error = new Error('Esta cotización ya está vinculada al ítem');
        error.status = 409;
        throw error;
    }

    const { rows } = await db.query(
        `INSERT INTO public.bc_investment_quotation_files
           (business_case_id, catalog_id, file_name, mime_type, size_bytes, drive_file_id, drive_url,
            uploaded_by, uploaded_by_email, supplier_name, quotation_date, reused_from_file_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, catalog_id, file_name, mime_type, size_bytes, drive_url, uploaded_by_email, uploaded_at, supplier_name, quotation_date, reused_from_file_id`,
        [
            businessCaseId,
            normalizedCatalogId,
            source.file_name,
            source.mime_type,
            source.size_bytes,
            source.drive_file_id,
            source.drive_url,
            Number.isInteger(Number(user?.id)) ? Number(user.id) : null,
            user?.email || null,
            source.supplier_name,
            source.quotation_date,
            source.reused_from_file_id || source.id,
        ],
    );
    await db.query(
        `UPDATE public.bc_investment_selections
            SET quotation_status = 'received', updated_at = now()
          WHERE business_case_id = $1 AND catalog_id = $2 AND selected = true`,
        [businessCaseId, normalizedCatalogId],
    );
    logger.info({ businessCaseId, catalogId: normalizedCatalogId, sourceFileId: source.id }, 'Quotation file reused');
    return { file: rows[0], itemName: selectionRows[0].name };
}

const toNullableNumber = (value) => (value == null || value === '' ? null : Number(value));

// Matriz historica: una fila por BC x item con precio o cotizacion, mas un
// resumen por item (ultimo, promedio, rango del precio financiero). Con
// excludeBusinessCaseId sirve al panel del BC actual sin mostrarse a si mismo.
async function getInvestmentPriceHistory({ catalogId = null, search = null, excludeBusinessCaseId = null, fromDate = null, limit = 500 } = {}) {
    await ensureInvestmentHistorySchema();
    const normalizedCatalogId = catalogId == null || catalogId === '' ? null : Number(catalogId);
    if (normalizedCatalogId !== null && (!Number.isInteger(normalizedCatalogId) || normalizedCatalogId <= 0)) {
        const error = new Error('catalog_id es invalido');
        error.status = 400;
        throw error;
    }
    const excluded = excludeBusinessCaseId && UUID_PATTERN.test(String(excludeBusinessCaseId)) ? excludeBusinessCaseId : null;
    const searchTerm = String(search || '').trim();
    const searchPattern = searchTerm ? `%${searchTerm.replace(/[%_\\]/g, '\\$&')}%` : null;
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(fromDate || '')) ? fromDate : null;
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));

    const baseCte = `
      WITH base AS (
        SELECT s.business_case_id,
               s.catalog_id,
               c.name AS item_name,
               c.category,
               c.code AS item_code,
               epr.client_name,
               epr.bc_purchase_type,
               epr.bc_stage,
               epr.created_at AS business_case_created_at,
               s.quantity,
               s.characteristics,
               s.notes,
               s.unit_price AS operational_unit_price,
               s.unit_price_financial AS financial_unit_price,
               s.depreciation_percentage,
               COALESCE(pe.changed_at, s.updated_at) AS priced_at,
               pe.reused_from_business_case_id,
               COALESCE(qf.files, '[]'::json) AS quotation_files
          FROM public.bc_investment_selections s
          JOIN public.bc_investment_catalog c ON c.id = s.catalog_id
          JOIN public.equipment_purchase_requests epr ON epr.id = s.business_case_id
          LEFT JOIN LATERAL (
            SELECT e.changed_at, e.reused_from_business_case_id
              FROM public.bc_investment_price_events e
             WHERE e.business_case_id = s.business_case_id
               AND e.catalog_id = s.catalog_id
               AND e.price_class = 'financiera'
             ORDER BY e.changed_at DESC
             LIMIT 1
          ) pe ON true
          LEFT JOIN LATERAL (
            SELECT json_agg(json_build_object(
                     'id', f.id,
                     'file_name', f.file_name,
                     'drive_url', f.drive_url,
                     'supplier_name', f.supplier_name,
                     'quotation_date', f.quotation_date,
                     'uploaded_at', f.uploaded_at,
                     'reused_from_file_id', f.reused_from_file_id
                   ) ORDER BY f.uploaded_at) AS files
              FROM public.bc_investment_quotation_files f
             WHERE f.business_case_id = s.business_case_id
               AND f.catalog_id = s.catalog_id
               AND f.active = true
          ) qf ON true
         WHERE s.selected = true
           AND epr.uses_modern_system IS NOT FALSE
           AND (s.unit_price_financial > 0 OR s.unit_price > 0 OR qf.files IS NOT NULL)
           AND ($1::integer IS NULL OR s.catalog_id = $1)
           AND ($2::uuid IS NULL OR s.business_case_id <> $2)
           AND ($3::text IS NULL
                OR c.name ILIKE $3
                OR epr.client_name ILIKE $3
                OR s.characteristics ILIKE $3
                OR EXISTS (
                  SELECT 1 FROM public.bc_investment_quotation_files f2
                   WHERE f2.business_case_id = s.business_case_id
                     AND f2.catalog_id = s.catalog_id
                     AND f2.active = true
                     AND f2.supplier_name ILIKE $3
                ))
           AND ($4::date IS NULL OR COALESCE(pe.changed_at, s.updated_at) >= $4::date)
      )`;
    const params = [normalizedCatalogId, excluded, searchPattern, from];

    const [rowsResult, summaryResult] = await Promise.all([
        db.query(`${baseCte} SELECT * FROM base ORDER BY priced_at DESC LIMIT $5`, [...params, safeLimit]),
        db.query(
            `${baseCte}
             SELECT catalog_id,
                    MAX(item_name) AS item_name,
                    MAX(category) AS category,
                    COUNT(*) AS cases_count,
                    COUNT(*) FILTER (WHERE financial_unit_price > 0) AS priced_count,
                    (ARRAY_AGG(financial_unit_price ORDER BY priced_at DESC) FILTER (WHERE financial_unit_price > 0))[1] AS last_financial_unit_price,
                    (ARRAY_AGG(depreciation_percentage ORDER BY priced_at DESC) FILTER (WHERE financial_unit_price > 0))[1] AS last_depreciation_percentage,
                    MAX(priced_at) FILTER (WHERE financial_unit_price > 0) AS last_priced_at,
                    AVG(financial_unit_price) FILTER (WHERE financial_unit_price > 0) AS avg_financial_unit_price,
                    MIN(financial_unit_price) FILTER (WHERE financial_unit_price > 0) AS min_financial_unit_price,
                    MAX(financial_unit_price) FILTER (WHERE financial_unit_price > 0) AS max_financial_unit_price,
                    AVG(operational_unit_price) FILTER (WHERE operational_unit_price > 0) AS avg_operational_unit_price,
                    SUM(json_array_length(quotation_files)) AS quotation_files_count
               FROM base
              GROUP BY catalog_id
              ORDER BY MAX(item_name)`,
            params,
        ),
    ]);

    const items = rowsResult.rows.map((row) => ({
        ...row,
        quantity: toNullableNumber(row.quantity),
        operational_unit_price: toNullableNumber(row.operational_unit_price),
        financial_unit_price: toNullableNumber(row.financial_unit_price),
        depreciation_percentage: toNullableNumber(row.depreciation_percentage),
    }));
    const summary = summaryResult.rows.map((row) => ({
        catalog_id: row.catalog_id,
        item_name: row.item_name,
        category: row.category,
        cases_count: Number(row.cases_count || 0),
        priced_count: Number(row.priced_count || 0),
        quotation_files_count: Number(row.quotation_files_count || 0),
        last_financial_unit_price: toNullableNumber(row.last_financial_unit_price),
        last_depreciation_percentage: toNullableNumber(row.last_depreciation_percentage),
        last_priced_at: row.last_priced_at,
        avg_financial_unit_price: row.avg_financial_unit_price == null ? null : Number(Number(row.avg_financial_unit_price).toFixed(2)),
        min_financial_unit_price: toNullableNumber(row.min_financial_unit_price),
        max_financial_unit_price: toNullableNumber(row.max_financial_unit_price),
        avg_operational_unit_price: row.avg_operational_unit_price == null ? null : Number(Number(row.avg_operational_unit_price).toFixed(2)),
    }));
    return { items, summary, truncated: items.length >= safeLimit };
}

module.exports = {
    createOtrosCatalogItems,
    assertCatalogItemsBelongToBusinessCase,
    getInvestmentPriceHistory,
    reuseQuotationFile,
    listQuotationFilesByCatalog,
    addQuotationFile,
    removeQuotationFile,
    getQuotationFileCatalogId,
    addInvestment,
    getInvestments,
    getInvestmentTotals,
    updateInvestment,
    deleteInvestment,
    listInvestmentCatalog,
    createInvestmentCatalogItem,
    getInvestmentSelections,
    detectInvestmentSelectionChanges,
    describeInvestmentSelectionChange,
    markInvestmentPriceReviewPending,
    getCatalogWithSelections,
    upsertInvestmentSelection,
    upsertInvestmentSelectionsBatch,
    getInvestmentValuesByClass,
    hasInvestmentQuotationAssignment,
    assertInvestmentQuotationAssignments,
    saveInvestmentValuesBatch,
    getInvestmentPricingContext,
    calculateFinancialDepreciation,
    listInvestmentQuotationAssignees,
    assignInvestmentQuotation,
    requestInvestmentQuotation,
};
