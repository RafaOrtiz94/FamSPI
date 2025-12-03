const db = require('../../config/db');
const logger = require('../../config/logger');

// ===== EQUIPOS (solo lectura desde servicio.equipos) =====
// NOTA: No creamos/editamos/eliminamos equipos aquí
// Para eso, usar el módulo servicio existente

exports.getEquipment = async ({ status, name } = {}) => {
    let query = 'SELECT id_equipo as id, nombre as name, modelo as model, fabricante as manufacturer, categoria as category FROM servicio.equipos WHERE 1=1';
    const params = [];

    if (status) {
        params.push(status);
        query += ` AND estado = $${params.length}`;
    }

    if (name) {
        params.push(`%${name}%`);
        query += ` AND nombre ILIKE $${params.length}`;
    }

    query += ' ORDER BY nombre ASC';

    const { rows } = await db.query(query, params);
    return rows;
};

exports.getEquipmentById = async (id) => {
    const { rows } = await db.query(
        'SELECT id_equipo as id, nombre as name, modelo as model, fabricante as manufacturer FROM servicio.equipos WHERE id_equipo = $1',
        [id]
    );
    return rows[0] || null;
};

// ===== DETERMINACIONES =====
exports.getDeterminations = async ({ status, equipmentId, name } = {}) => {
    let query = `
    SELECT d.*, e.nombre as equipment_name 
    FROM catalog_determinations d
    LEFT JOIN servicio.equipos e ON d.equipment_id = e.id_equipo
    WHERE 1=1
  `;
    const params = [];

    if (status) {
        params.push(status);
        query += ` AND d.status = $${params.length}`;
    }

    if (equipmentId) {
        params.push(equipmentId);
        query += ` AND d.equipment_id = $${params.length}`;
    }

    if (name) {
        params.push(`%${name}%`);
        query += ` AND d.name ILIKE $${params.length}`;
    }

    query += ' ORDER BY d.name ASC';

    const { rows } = await db.query(query, params);
    return rows;
};

exports.getDeterminationById = async (id) => {
    const { rows } = await db.query(
        `SELECT d.*, e.nombre as equipment_name 
     FROM catalog_determinations d
     LEFT JOIN servicio.equipos e ON d.equipment_id = e.id_equipo
     WHERE d.id = $1`,
        [id]
    );
    return rows[0] || null;
};

exports.getDeterminationsByEquipment = async (equipmentId) => {
    const { rows } = await db.query(
        'SELECT * FROM catalog_determinations WHERE equipment_id = $1 AND status = $2 ORDER BY name ASC',
        [equipmentId, 'active']
    );
    return rows;
};

exports.createDetermination = async (data) => {
    const {
        name,
        roche_code,
        category,
        equipment_id,
        version,
        status = 'active',
        valid_from = new Date(),
        metadata = {}
    } = data;

    const { rows } = await db.query(
        `INSERT INTO catalog_determinations 
     (name, roche_code, category, equipment_id, version, status, valid_from, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
        [name, roche_code, category, equipment_id, version, status, valid_from, JSON.stringify(metadata)]
    );

    logger.info('Determination created: %s', name);
    return rows[0];
};

exports.updateDetermination = async (id, data) => {
    const fields = [];
    const params = [];
    let paramCount = 1;

    const allowedFields = ['name', 'roche_code', 'category', 'equipment_id', 'version', 'status', 'metadata'];

    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            fields.push(`${field} = $${paramCount}`);
            params.push(field === 'metadata' ? JSON.stringify(data[field]) : data[field]);
            paramCount++;
        }
    });

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const { rows } = await db.query(
        `UPDATE catalog_determinations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
    );

    if (rows.length === 0) {
        throw new Error('Determination not found');
    }

    logger.info('Determination updated: ID %s', id);
    return rows[0];
};

exports.deleteDetermination = async (id) => {
    const { rowCount } = await db.query('DELETE FROM catalog_determinations WHERE id = $1', [id]);

    if (rowCount === 0) {
        throw new Error('Determination not found');
    }

    logger.info('Determination deleted: ID %s', id);
    return true;
};

exports.discontinueDetermination = async (id, replacedById = null) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `UPDATE catalog_determinations 
       SET status = 'discontinuado', replaced_by_id = $1, valid_to = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
            [replacedById, id]
        );

        if (rows.length === 0) {
            throw new Error('Determination not found');
        }

        const affectedBC = await client.query(
            `SELECT DISTINCT business_case_id
       FROM contract_determinations
       WHERE determination_id = $1 AND status = 'active'`,
            [id]
        );

        for (const bc of affectedBC.rows) {
            const message = replacedById
                ? `Determinación ${rows[0].name} discontinuada. Reemplazo disponible.`
                : `Determinación ${rows[0].name} discontinuada sin reemplazo.`;

            await client.query(
                `INSERT INTO bc_alerts (business_case_id, alert_type, severity, message)
         VALUES ($1, 'product_discontinued', 'yellow', $2)`,
                [bc.business_case_id, message]
            );
        }

        await client.query('COMMIT');
        logger.info('Determination discontinued: ID %s', id);

        return rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

//  ===== CONSUMIBLES =====
exports.getConsumables = async ({ status, type, name } = {}) => {
    let query = 'SELECT * FROM catalog_consumables WHERE 1=1';
    const params = [];

    if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
    }

    if (type) {
        params.push(type);
        query += ` AND type = $${params.length}`;
    }

    if (name) {
        params.push(`%${name}%`);
        query += ` AND name ILIKE $${params.length}`;
    }

    query += ' ORDER BY type ASC, name ASC';

    const { rows } = await db.query(query, params);
    return rows;
};

exports.getConsumableById = async (id) => {
    const { rows } = await db.query('SELECT * FROM catalog_consumables WHERE id = $1', [id]);
    return rows[0] || null;
};

exports.getConsumablesByDetermination = async (determinationId) => {
    const { rows } = await db.query(
        `SELECT c.*, ec.consumption_rate
     FROM catalog_consumables c
     JOIN catalog_equipment_consumables ec ON c.id = ec.consumable_id
     WHERE ec.determination_id = $1 AND c.status = 'active'
     ORDER BY c.type, c.name`,
        [determinationId]
    );
    return rows;
};

exports.createConsumable = async (data) => {
    const {
        name,
        type,
        units_per_kit,
        unit_price,
        version,
        status = 'active',
        valid_from = new Date(),
        performance = {},
        metadata = {}
    } = data;

    const { rows } = await db.query(
        `INSERT INTO catalog_consumables 
     (name, type, units_per_kit, unit_price, version, status, valid_from, performance, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
        [name, type, units_per_kit, unit_price, version, status, valid_from, JSON.stringify(performance), JSON.stringify(metadata)]
    );

    logger.info('Consumable created: %s', name);
    return rows[0];
};

exports.updateConsumable = async (id, data) => {
    const fields = [];
    const params = [];
    let paramCount = 1;

    const allowedFields = ['name', 'type', 'units_per_kit', 'unit_price', 'version', 'status', 'performance', 'metadata'];

    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            const value = (field === 'performance' || field === 'metadata') ? JSON.stringify(data[field]) : data[field];
            fields.push(`${field} = $${paramCount}`);
            params.push(value);
            paramCount++;
        }
    });

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const { rows } = await db.query(
        `UPDATE catalog_consumables SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
    );

    if (rows.length === 0) {
        throw new Error('Consumable not found');
    }

    logger.info('Consumable updated: ID %s', id);
    return rows[0];
};

exports.deleteConsumable = async (id) => {
    const { rowCount } = await db.query('DELETE FROM catalog_consumables WHERE id = $1', [id]);

    if (rowCount === 0) {
        throw new Error('Consumable not found');
    }

    logger.info('Consumable deleted: ID %s', id);
    return true;
};

exports.discontinueConsumable = async (id, replacedById = null) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `UPDATE catalog_consumables 
       SET status = 'discontinuado', replaced_by_id = $1, valid_to = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
            [replacedById, id]
        );

        if (rows.length === 0) {
            throw new Error('Consumable not found');
        }

        const affectedBC = await client.query(
            `SELECT DISTINCT cd.business_case_id
       FROM contract_determinations cd
       JOIN catalog_equipment_consumables ec ON cd.determination_id = ec.determination_id
       WHERE ec.consumable_id = $1 AND cd.status = 'active'`,
            [id]
        );

        for (const bc of affectedBC.rows) {
            const message = replacedById
                ? `Consumible ${rows[0].name} discontinuado. Reemplazo disponible.`
                : `Consumible ${rows[0].name} discontinuado sin reemplazo.`;

            await client.query(
                `INSERT INTO bc_alerts (business_case_id, alert_type, severity, message)
         VALUES ($1, 'product_discontinued', 'yellow', $2)`,
                [bc.business_case_id, message]
            );
        }

        await client.query('COMMIT');
        logger.info('Consumable discontinued: ID %s', id);

        return rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// ===== RELACIONES =====
exports.getEquipmentConsumables = async ({ equipmentId, determinationId } = {}) => {
    let query = `
    SELECT ec.*, 
           e.nombre as equipment_name, 
           c.name as consumable_name, 
           d.name as determination_name
    FROM catalog_equipment_consumables ec
    LEFT JOIN servicio.equipos e ON ec.equipment_id = e.id_equipo
    LEFT JOIN catalog_consumables c ON ec.consumable_id = c.id
    LEFT JOIN catalog_determinations d ON ec.determination_id = d.id
    WHERE 1=1
  `;
    const params = [];

    if (equipmentId) {
        params.push(equipmentId);
        query += ` AND ec.equipment_id = $${params.length}`;
    }

    if (determinationId) {
        params.push(determinationId);
        query += ` AND ec.determination_id = $${params.length}`;
    }

    const { rows } = await db.query(query, params);
    return rows;
};

exports.createEquipmentConsumable = async (data) => {
    const { equipment_id, consumable_id, determination_id, consumption_rate = 1.0 } = data;

    const { rows } = await db.query(
        `INSERT INTO catalog_equipment_consumables (equipment_id, consumable_id, determination_id, consumption_rate)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
        [equipment_id, consumable_id, determination_id, consumption_rate]
    );

    logger.info('Equipment-Consumable relation created');
    return rows[0];
};

exports.deleteEquipmentConsumable = async (id) => {
    const { rowCount } = await db.query('DELETE FROM catalog_equipment_consumables WHERE id = $1', [id]);

    if (rowCount === 0) {
        throw new Error('Relation not found');
    }

    logger.info('Equipment-Consumable relation deleted: ID %s', id);
    return true;
};

// ===== INVERSIONES =====
exports.getInvestments = async ({ status, category, requiresLis, requiresEquipment } = {}) => {
    let query = 'SELECT * FROM catalog_investments WHERE 1=1';
    const params = [];

    if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
    }

    if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
    }

    if (requiresLis !== undefined) {
        params.push(requiresLis);
        query += ` AND requires_lis = $${params.length}`;
    }

    if (requiresEquipment !== undefined) {
        params.push(requiresEquipment);
        query += ` AND requires_equipment = $${params.length}`;
    }

    query += ' ORDER BY category ASC, name ASC';

    const { rows } = await db.query(query, params);
    return rows;
};

exports.createInvestment = async (data) => {
    const {
        name,
        category,
        subcategory,
        suggested_price,
        suggested_quantity = 1,
        requires_lis = false,
        requires_equipment = false,
        status = 'active',
        metadata = {}
    } = data;

    const { rows } = await db.query(
        `INSERT INTO catalog_investments 
     (name, category, subcategory, suggested_price, suggested_quantity, requires_lis, requires_equipment, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
        [name, category, subcategory, suggested_price, suggested_quantity, requires_lis, requires_equipment, status, JSON.stringify(metadata)]
    );

    logger.info('Investment created: %s', name);
    return rows[0];
};

exports.updateInvestment = async (id, data) => {
    const fields = [];
    const params = [];
    let paramCount = 1;

    const allowedFields = ['name', 'category', 'subcategory', 'suggested_price', 'suggested_quantity', 'requires_lis', 'requires_equipment', 'status', 'metadata'];

    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            fields.push(`${field} = $${paramCount}`);
            params.push(field === 'metadata' ? JSON.stringify(data[field]) : data[field]);
            paramCount++;
        }
    });

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const { rows } = await db.query(
        `UPDATE catalog_investments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
    );

    if (rows.length === 0) {
        throw new Error('Investment not found');
    }

    logger.info('Investment updated: ID %s', id);
    return rows[0];
};

// ===== VISTAS =====
exports.getEquipmentWithDeterminations = async () => {
    const { rows } = await db.query('SELECT * FROM v_equipment_determinations ORDER BY equipment_name, determination_name');
    return rows;
};
