/**
 * Purchase Requests Facade - Single Source of Truth
 *
 * Strangler pattern facade that provides canonical purchase request operations.
 * All purchase-related writes (legacy and V2) must go through this facade.
 *
 * When REQUESTS_UNIFICATION_V2=true, this facade writes to requests table.
 * When false, writes to legacy equipment_purchase_requests table.
 *
 * This ensures:
 * - Single source of truth
 * - No duplicate Drive operations
 * - Consistent BC gating
 * - Idempotent operations
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const notificationManager = require("../notifications/notificationManager");
const { createAllDayEvent } = require("../../utils/calendar");
const { sendMail } = require("../../utils/mailer");

// ===== CONFIGURATION =====
const V2_ENABLED = process.env.REQUESTS_UNIFICATION_V2 === 'true';

// ===== LEGACY↔V2 MAPPING HELPERS =====

/**
 * Resolve canonical purchase ID - determines which store to use
 * @param {string|number} purchaseId - Could be legacy or V2 ID (both INTEGER)
 * @returns {Object} { store: 'v2'|'legacy', id: canonicalId, legacyId?, v2Id? }
 */
async function resolveCanonicalId(purchaseId) {
    // First check if it's a V2 request
    const { rows: v2Rows } = await db.query(
        `SELECT r.id, r.payload->>'__form_variant' as form_variant, r.legacy_purchase_id
     FROM requests r
     WHERE r.id = $1 AND r.request_type_id = (SELECT id FROM request_types WHERE code = 'F.ST-19')`,
        [purchaseId]
    );

    if (v2Rows.length > 0 && v2Rows[0].form_variant === 'purchase') {
        return {
            store: 'v2',
            id: purchaseId,
            v2Id: purchaseId,
            legacyId: v2Rows[0].legacy_purchase_id
        };
    }

    // Check if it's a legacy purchase with V2 mapping
    const { rows: legacyRows } = await db.query(
        'SELECT id, v2_request_id FROM equipment_purchase_requests WHERE id = $1',
        [purchaseId]
    );

    if (legacyRows.length > 0) {
        const legacyRow = legacyRows[0];
        if (legacyRow.v2_request_id) {
            // Has V2 mapping - use V2
            return {
                store: 'v2',
                id: legacyRow.v2_request_id,
                v2Id: legacyRow.v2_request_id,
                legacyId: purchaseId
            };
        } else {
            // No V2 mapping - use legacy
            return {
                store: 'legacy',
                id: purchaseId,
                legacyId: purchaseId
            };
        }
    }

    // Not found
    throw new Error('Purchase request not found');
}

/**
 * Ensure V2 mapping exists for legacy purchase
 * @param {string|UUID} legacyId - Legacy purchase ID
 * @param {Object} user - User creating the mapping
 * @returns {string} V2 request ID
 */
async function ensureV2MappingForLegacy(legacyId, user) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Lock legacy row
        const { rows: legacyRows } = await client.query(
            'SELECT * FROM equipment_purchase_requests WHERE id = $1 FOR UPDATE',
            [legacyId]
        );

        if (!legacyRows.length) {
            throw new Error('Legacy purchase not found');
        }

        const legacyPurchase = legacyRows[0];

        // Check if mapping already exists
        if (legacyPurchase.v2_request_id) {
            await client.query('COMMIT');
            return legacyPurchase.v2_request_id;
        }

        // Create V2 equivalent
        const v2Payload = {
            __form_variant: 'purchase',
            client_id: legacyPurchase.client_id,
            client_name: legacyPurchase.client_name,
            client_email: legacyPurchase.client_email,
            assigned_to: legacyPurchase.assigned_to,
            assigned_to_email: legacyPurchase.assigned_to_email,
            assigned_to_name: legacyPurchase.assigned_to_name,
            provider_email: legacyPurchase.provider_email,
            equipment: legacyPurchase.equipment,
            notes: legacyPurchase.notes,
            ...legacyPurchase.extra,

            commercial_certainty: legacyPurchase.commercial_certainty,
            proforma_signed_at: legacyPurchase.proforma_signed_at,

            // File IDs
            proforma_file_id: legacyPurchase.proforma_file_id,
            signed_proforma_file_id: legacyPurchase.signed_proforma_file_id,
            contract_file_id: legacyPurchase.contract_file_id,

            // Drive
            drive_folder_id: legacyPurchase.drive_folder_id,
            // Status and progress
            status: legacyPurchase.status,

            // Migration metadata
            migrated_from: 'equipment_purchase_requests',
            migrated_at: new Date().toISOString(),
            migrated_by: user?.id
        };

        // Create V2 request
        const v2Result = await client.query(
            `INSERT INTO requests(
        request_group_id, requester_id, request_type_id, payload, status, created_at, updated_at
       ) VALUES(
        gen_random_uuid(),
        $1, -- Use legacy creator or current user
        (SELECT id FROM request_types WHERE code = 'F.ST-19'),
        $2,
        $3,
        $4,
        NOW()
       ) RETURNING id`,
            [
                legacyPurchase.created_by || user?.id,
                JSON.stringify(v2Payload),
                legacyPurchase.status || 'draft',
                legacyPurchase.created_at || new Date()
            ]
        );

        const v2Id = v2Result.rows[0].id;

        // Update legacy with mapping
        await client.query(
            'UPDATE equipment_purchase_requests SET v2_request_id = $1, v2_migration_status = $2 WHERE id = $3',
            [v2Id, 'migrated', legacyId]
        );

        // Update V2 with reverse mapping (for debugging)
        await client.query(
            'UPDATE requests SET legacy_purchase_id = $1 WHERE id = $2',
            [legacyId, v2Id]
        );

        await client.query('COMMIT');

        logger.info({
            legacyId,
            v2Id,
            userId: user?.id
        }, 'Created V2 mapping for legacy purchase');

        return v2Id;

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error, legacyId }, 'Failed to create V2 mapping');
        throw error;
    } finally {
        client.release();
    }
}

// ===== CONSTANTS =====
const PURCHASE_REQUEST_TYPE = 'F.ST-19'; // Purchase request type ID
const STATUS = {
    PENDING_PROVIDER: "pending_provider_assignment",
    WAITING_PROVIDER: "waiting_provider_response",
    WAITING_PROFORMA: "waiting_proforma",
    PROFORMA_RECEIVED: "proforma_received",
    WAITING_SIGNED_PROFORMA: "waiting_signed_proforma",
    PENDING_CONTRACT: "pending_contract",
    COMPLETED: "completed",
};

// ===== FACADE METHODS =====

/**
 * Create Purchase Request - Canonical Entry Point
 */
async function createPurchaseRequest(params) {
    const {
        user,
        clientId,
        clientName,
        clientEmail,
        providerEmail,
        assignedTo,
        equipment = [],
        notes,
        extra = {}
    } = params;

    logger.info('PurchaseRequestsFacade: Creating purchase request', {
        userId: user.id,
        clientName,
        equipmentCount: equipment.length,
        v2Enabled: V2_ENABLED
    });

    if (V2_ENABLED) {
        return await _createPurchaseRequestV2(params);
    } else {
        return await _createPurchaseRequestLegacy(params);
    }
}

/**
 * Get Purchase Request - Read from appropriate table
 */
async function getPurchaseRequest(id, user) {
    // Resolve canonical ID - works for both legacy and V2 IDs
    const canonical = await resolveCanonicalId(id);

    if (canonical.store === 'v2') {
        return await _getPurchaseRequestV2(canonical.id, user);
    } else {
        return await _getPurchaseRequestLegacy(canonical.id, user);
    }
}

/**
 * Assign Provider - Update provider assignment
 */
async function assignProvider(id, user, providerEmail, notes) {
    if (V2_ENABLED) {
        return await _assignProviderV2(id, user, providerEmail, notes);
    } else {
        return await _assignProviderLegacy(id, user, providerEmail, notes);
    }
}

/**
 * Upload Proforma - Handle proforma document upload
 */
async function uploadProforma(id, user, file) {
    if (V2_ENABLED) {
        return await _uploadProformaV2(id, user, file);
    } else {
        return await _uploadProformaLegacy(id, user, file);
    }
}

/**
 * Upload Signed Proforma - Critical transition point
 */
async function uploadSignedProforma(id, user, file, inspectionMinDate, inspectionMaxDate, includesStarterKit) {
    if (V2_ENABLED) {
        return await _uploadSignedProformaV2(id, user, file, inspectionMinDate, inspectionMaxDate, includesStarterKit);
    } else {
        return await _uploadSignedProformaLegacy(id, user, file, inspectionMinDate, inspectionMaxDate, includesStarterKit);
    }
}

/**
 * Upload Contract - With BC gating
 */
async function uploadContract(id, user, file) {
    if (V2_ENABLED) {
        return await _uploadContractV2(id, user, file);
    } else {
        return await _uploadContractLegacy(id, user, file);
    }
}

// ===== PRIVATE IMPLEMENTATIONS =====

async function _createPurchaseRequestV2(params) {
    const { user, clientId, clientName, clientEmail, assignedTo, equipment, notes, extra } = params;

    // Get assignee details
    let assigneeInfo = null;
    if (assignedTo) {
        const { rows } = await db.query(
            'SELECT id, email, fullname FROM users WHERE id = $1',
            [assignedTo]
        );
        assigneeInfo = rows[0];
    }

    // Create canonical payload
    const canonicalPayload = {
        __form_variant: 'purchase',
        client_id: clientId,
        client_name: clientName,
        client_email: clientEmail,
        assigned_to: assigneeInfo?.id,
        assigned_to_email: assigneeInfo?.email,
        assigned_to_name: assigneeInfo?.fullname,
        equipment: equipment,
        notes: notes,
        ...extra,
        commercial_certainty: false
    };

    // Create request in V2 system
    const requestService = require('./requests.service');
    const result = await requestService.createRequest({
        requester_id: user.id,
        requester_email: user.email,
        requester_name: user.fullname || user.name,
        request_type_id: PURCHASE_REQUEST_TYPE,
        payload: canonicalPayload
    });

    const purchaseId = result.request.id;

    // Create Drive folder (idempotent)
    const folderName = `Purchase-${clientName}-${purchaseId}`;
    const folderId = await _ensurePurchaseFolder(folderName, purchaseId);

    // Update with folder ID
    await db.query(
        'UPDATE requests SET payload = payload || $1 WHERE id = $2',
        [JSON.stringify({ drive_folder_id: folderId }), purchaseId]
    );

    return {
        id: purchaseId,
        status: STATUS.PENDING_PROVIDER,
        drive_folder_id: folderId,
        ...canonicalPayload
    };
}

async function _getPurchaseRequestV2(id, user) {
    const requestService = require('./requests.service');
    const result = await requestService.getRequestFull(id);

    if (!result || !result.request) {
        const error = new Error("Purchase request not found");
        error.status = 404;
        throw error;
    }

    const payload = result.request.payload || {};

    // Validate this is a purchase request
    if (payload.__form_variant !== 'purchase') {
        const error = new Error("Not a purchase request");
        error.status = 400;
        throw error;
    }

    return {
        ...result.request,
        payload,
        attachments: result.attachments || [],
        documents: result.documents || []
    };
}

async function _assignProviderV2(id, user, providerEmail, notes) {
    // Update provider and status
    const { rows } = await db.query(
        `UPDATE requests
     SET payload = payload || $1, updated_at = NOW()
     WHERE id = $2 AND payload->>'__form_variant' = 'purchase'
     RETURNING *`,
        [JSON.stringify({ provider_email: providerEmail, notes }), id]
    );

    if (!rows.length) {
        const error = new Error("Purchase request not found");
        error.status = 404;
        throw error;
    }

    return mapV2EntityToLegacyResponse(rows[0]);
}

async function _uploadProformaV2(id, user, file) {
    const fileId = await _uploadDocumentToPurchaseFolder(id, file, 'proforma');

    await db.query(
        `UPDATE requests
     SET payload = payload || $1, updated_at = NOW()
     WHERE id = $2 AND payload->>'__form_variant' = 'purchase'`,
        [JSON.stringify({ proforma_file_id: fileId, proforma_uploaded_at: new Date().toISOString() }), id]
    );

    const updated = await _getPurchaseRequestV2(id, user);
    return mapV2EntityToLegacyResponse(updated);
}

async function _uploadSignedProformaV2(id, user, file, inspectionMinDate, inspectionMaxDate, includesStarterKit) {
    const request = await _getPurchaseRequestV2(id, user);

    if (request.payload.status !== STATUS.WAITING_SIGNED_PROFORMA) {
        const error = new Error("Request must be waiting for signed proforma");
        error.status = 409;
        throw error;
    }

    const fileId = await _uploadDocumentToPurchaseFolder(id, file, 'proforma-firmada');

    // Update signed proforma data
    const updateData = {
        signed_proforma_file_id: fileId,
        signed_proforma_uploaded_at: new Date().toISOString(),
        proforma_signed_at: new Date().toISOString(),
        commercial_certainty: true,
        inspection_min_date: inspectionMinDate,
        inspection_max_date: inspectionMaxDate,
        includes_starter_kit: includesStarterKit,
        status: STATUS.PENDING_CONTRACT
    };

    await db.query(
        `UPDATE requests
     SET payload = payload || $1, updated_at = NOW()
     WHERE id = $2`,
        [JSON.stringify(updateData), id]
    );

    const updated = await _getPurchaseRequestV2(id, user);
    return mapV2EntityToLegacyResponse(updated);
}

async function _uploadContractV2(id, user, file) {
    const fileId = await _uploadDocumentToPurchaseFolder(id, file, 'contrato');

    await db.query(
        `UPDATE requests
     SET payload = payload || $1, updated_at = NOW()
     WHERE id = $2`,
        [JSON.stringify({
            contract_file_id: fileId,
            contract_uploaded_at: new Date().toISOString(),
            status: STATUS.COMPLETED
        }), id]
    );

    const updated = await _getPurchaseRequestV2(id, user);
    return mapV2EntityToLegacyResponse(updated);
}

// ===== LEGACY IMPLEMENTATIONS (for backward compatibility) =====

async function _createPurchaseRequestLegacy(params) {
    // Delegate to existing legacy service
    const equipmentService = require('../equipment-purchases/equipmentPurchases.service');
    return await equipmentService.createPurchaseRequest(params);
}

async function _getPurchaseRequestLegacy(id, user) {
    const equipmentService = require('../equipment-purchases/equipmentPurchases.service');
    return await equipmentService.getById(id, user);
}

async function _assignProviderLegacy(id, user, providerEmail, notes) {
    const equipmentService = require('../equipment-purchases/equipmentPurchases.service');
    return await equipmentService.startAvailabilityRequest({ id, user, providerEmail, notes });
}

async function _uploadProformaLegacy(id, user, file) {
    const equipmentService = require('../equipment-purchases/equipmentPurchases.service');
    return await equipmentService.uploadProforma({ id, user, file });
}

async function _uploadSignedProformaLegacy(id, user, file, inspectionMinDate, inspectionMaxDate, includesStarterKit) {
    const equipmentService = require('../equipment-purchases/equipmentPurchases.service');
    return await equipmentService.uploadSignedProforma({
        id, user, file, inspection_min_date: inspectionMinDate,
        inspection_max_date: inspectionMaxDate, includes_starter_kit: includesStarterKit
    });
}

async function _uploadContractLegacy(id, user, file) {
    const equipmentService = require('../equipment-purchases/equipmentPurchases.service');
    return await equipmentService.uploadContract({ id, user, file });
}

// ===== UTILITY FUNCTIONS =====

/**
 * Ensure purchase folder exists (idempotent)
 */
async function _ensurePurchaseFolder(folderName, purchaseId) {
    // Check if folder already exists in payload
    const { rows } = await db.query(
        'SELECT payload FROM requests WHERE id = $1',
        [purchaseId]
    );

    if (rows.length && rows[0].payload?.drive_folder_id) {
        return rows[0].payload.drive_folder_id;
    }

    // Create new folder with locking to prevent duplicates
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Lock the request row
        await client.query('SELECT id FROM requests WHERE id = $1 FOR UPDATE', [purchaseId]);

        // Double-check after lock
        const { rows: checkRows } = await client.query(
            'SELECT payload FROM requests WHERE id = $1',
            [purchaseId]
        );

        if (checkRows.length && checkRows[0].payload?.drive_folder_id) {
            await client.query('COMMIT');
            return checkRows[0].payload.drive_folder_id;
        }

        // Create folder
        const folderId = await ensureFolder(folderName);

        // Update with folder ID
        await client.query(
            'UPDATE requests SET payload = payload || $1 WHERE id = $2',
            [JSON.stringify({ drive_folder_id: folderId }), purchaseId]
        );

        await client.query('COMMIT');
        return folderId;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Upload document to purchase folder (idempotent)
 */
async function _uploadDocumentToPurchaseFolder(purchaseId, file, prefix) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Get folder ID with lock
        const { rows } = await client.query(
            'SELECT payload FROM requests WHERE id = $1 FOR UPDATE',
            [purchaseId]
        );

        if (!rows.length) {
            throw new Error('Purchase request not found');
        }

        const payload = rows[0].payload || {};
        const folderId = payload.drive_folder_id;

        if (!folderId) {
            throw new Error('Purchase folder not found');
        }

        // Upload file
        const base64 = file.buffer.toString('base64');
        const fileName = `${prefix}-${new Date().toISOString().split('T')[0]}.pdf`;
        const uploadedFile = await uploadBase64File(fileName, base64, file.mimetype, folderId);

        await client.query('COMMIT');
        return uploadedFile.id;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Map V2 entity to legacy response format
 */
function mapV2EntityToLegacyResponse(v2Entity) {
    const payload = v2Entity.payload || {};

    return {
        id: v2Entity.id,
        status: payload.status || v2Entity.status,
        client_name: payload.client_name,
        client_email: payload.client_email,
        assigned_to: payload.assigned_to,
        assigned_to_email: payload.assigned_to_email,
        assigned_to_name: payload.assigned_to_name,
        provider_email: payload.provider_email,
        equipment: payload.equipment || [],
        notes: payload.notes,
        drive_folder_id: payload.drive_folder_id,
        proforma_file_id: payload.proforma_file_id,
        proforma_uploaded_at: payload.proforma_uploaded_at,
        signed_proforma_file_id: payload.signed_proforma_file_id,
        signed_proforma_uploaded_at: payload.signed_proforma_uploaded_at,
        contract_file_id: payload.contract_file_id,
        contract_uploaded_at: payload.contract_uploaded_at,
        created_at: v2Entity.created_at,
        updated_at: v2Entity.updated_at,
        proforma_signed_at: payload.proforma_signed_at,
        commercial_certainty: payload.commercial_certainty
    };
}

module.exports = {
    createPurchaseRequest,
    getPurchaseRequest,
    assignProvider,
    uploadProforma,
    uploadSignedProforma,
    uploadContract,

    // Utility functions for testing/migration
    _ensurePurchaseFolder,
    _uploadDocumentToPurchaseFolder,
    mapV2EntityToLegacyResponse
};
