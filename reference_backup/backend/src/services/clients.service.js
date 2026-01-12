/**
 * Clients Service
 * ----------------------------------------------------------
 * Manejo de clientes aprobados con encriptación de datos sensibles
 */

const pool = require('../config/database');
const { encryptObject, decryptObject, hash } = require('../utils/encryption');

// Campos sensibles que deben ser encriptados
const ENCRYPTED_FIELDS = [
    'razon_social',
    'ruc',
    'nombre_comercial',
    'contacto_nombre',
    'contacto_email',
    'contacto_telefono',
    'direccion',
    'nombre_banco',
    'numero_cuenta',
    'representante_nombre',
    'representante_cedula',
    'representante_email',
    'representante_telefono'
];

/**
 * Crear cliente desde solicitud aprobada
 */
async function createClientFromRequest(requestId, approvedBy) {
    const connection = await pool.connect();

    try {
        await connection.query('BEGIN');

        // Obtener datos de la solicitud
        const requestResult = await connection.query(
            `SELECT * FROM client_requests WHERE id = $1`,
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            throw new Error('Solicitud no encontrada');
        }

        const request = requestResult.rows[0];

        // Verificar que la solicitud esté aprobada
        if (request.approval_status !== 'aprobado') {
            throw new Error('Solo se pueden crear clientes de solicitudes aprobadas');
        }

        // Verificar si ya existe un cliente para esta solicitud
        const existingClient = await connection.query(
            `SELECT id FROM clients WHERE client_request_id = $1`,
            [requestId]
        );

        if (existingClient.rows.length > 0) {
            return existingClient.rows[0];
        }

        // Preparar datos del cliente
        const clientData = {
            razon_social: request.razon_social,
            ruc: request.ruc,
            nombre_comercial: request.nombre_comercial,
            contacto_nombre: request.contacto_nombre,
            contacto_cargo: request.contacto_cargo,
            contacto_email: request.contacto_email,
            contacto_telefono: request.contacto_telefono,
            direccion: request.direccion,
            ciudad: request.ciudad,
            provincia: request.provincia,
            pais: request.pais || 'Ecuador',
            nombre_banco: request.nombre_banco,
            tipo_cuenta: request.tipo_cuenta,
            numero_cuenta: request.numero_cuenta,
            representante_nombre: request.representante_nombre,
            representante_cedula: request.representante_cedula,
            representante_email: request.representante_email,
            representante_telefono: request.representante_telefono,
            consentimiento_lopdp: request.consentimiento_lopdp,
            consentimiento_email: request.consentimiento_email,
            consentimiento_token: request.consentimiento_token,
            consentimiento_verificado: request.consentimiento_verificado,
            consentimiento_fecha: request.consentimiento_fecha
        };

        // Encriptar datos sensibles
        const encryptedData = encryptObject(clientData, ENCRYPTED_FIELDS);

        // Crear hash del RUC para búsquedas
        const rucHash = hash(request.ruc);

        // Insertar cliente
        const insertResult = await connection.query(
            `INSERT INTO clients (
        client_request_id, razon_social, ruc, nombre_comercial,
        contacto_nombre, contacto_cargo, contacto_email, contacto_telefono,
        direccion, ciudad, provincia, pais,
        nombre_banco, tipo_cuenta, numero_cuenta,
        representante_nombre, representante_cedula, representante_email, representante_telefono,
        consentimiento_lopdp, consentimiento_email, consentimiento_token,
        consentimiento_verificado, consentimiento_fecha,
        ruc_hash, created_by, estado
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) RETURNING id`,
            [
                requestId,
                encryptedData.razon_social,
                encryptedData.ruc,
                encryptedData.nombre_comercial,
                encryptedData.contacto_nombre,
                clientData.contacto_cargo,
                encryptedData.contacto_email,
                encryptedData.contacto_telefono,
                encryptedData.direccion,
                clientData.ciudad,
                clientData.provincia,
                clientData.pais,
                encryptedData.nombre_banco,
                clientData.tipo_cuenta,
                encryptedData.numero_cuenta,
                encryptedData.representante_nombre,
                encryptedData.representante_cedula,
                encryptedData.representante_email,
                encryptedData.representante_telefono,
                clientData.consentimiento_lopdp,
                clientData.consentimiento_email,
                clientData.consentimiento_token,
                clientData.consentimiento_verificado,
                clientData.consentimiento_fecha,
                rucHash,
                approvedBy,
                'activo'
            ]
        );

        const clientId = insertResult.rows[0].id;

        // Actualizar la solicitud con el ID del cliente creado
        await connection.query(
            `UPDATE client_requests SET client_id = $1 WHERE id = $2`,
            [clientId, requestId]
        );

        await connection.query('COMMIT');

        return { id: clientId, message: 'Cliente creado exitosamente' };

    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error creando cliente:', error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Obtener cliente por ID (con datos desencriptados)
 */
async function getClientById(id, userId) {
    const result = await pool.query(
        `SELECT c.*, 
            u.fullname as created_by_name,
            cr.user_id as request_user_id
     FROM clients c
     LEFT JOIN users u ON c.created_by = u.id
     LEFT JOIN client_requests cr ON c.client_request_id = cr.id
     WHERE c.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const client = result.rows[0];

    // Desencriptar datos sensibles
    const decryptedClient = decryptObject(client, ENCRYPTED_FIELDS);

    // Eliminar el hash del RUC del resultado
    delete decryptedClient.ruc_hash;

    return decryptedClient;
}

/**
 * Obtener todos los clientes (sin datos sensibles desencriptados)
 */
async function getAllClients(filters = {}) {
    let query = `
    SELECT c.id, c.estado, c.ciudad, c.provincia, c.created_at,
           u.fullname as created_by_name,
           c.ruc_hash
    FROM clients c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE 1=1
  `;

    const params = [];

    if (filters.estado) {
        params.push(filters.estado);
        query += ` AND c.estado = $${params.length}`;
    }

    if (filters.ciudad) {
        params.push(filters.ciudad);
        query += ` AND c.ciudad = $${params.length}`;
    }

    query += ' ORDER BY c.created_at DESC';

    if (filters.limit) {
        params.push(filters.limit);
        query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    return result.rows;
}

/**
 * Buscar cliente por RUC (usando hash)
 */
async function findClientByRUC(ruc) {
    const rucHash = hash(ruc);

    const result = await pool.query(
        `SELECT c.*, u.fullname as created_by_name
     FROM clients c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.ruc_hash = $1`,
        [rucHash]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const client = result.rows[0];

    // Desencriptar datos sensibles
    const decryptedClient = decryptObject(client, ENCRYPTED_FIELDS);
    delete decryptedClient.ruc_hash;

    return decryptedClient;
}

/**
 * Actualizar estado del cliente
 */
async function updateClientStatus(id, status, userId) {
    const result = await pool.query(
        `UPDATE clients 
     SET estado = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
        [status, id]
    );

    return result.rows[0];
}

module.exports = {
    createClientFromRequest,
    getClientById,
    getAllClients,
    findClientByRUC,
    updateClientStatus
};
