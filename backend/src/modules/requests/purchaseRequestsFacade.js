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
const businessCaseService = require("../business-case/businessCase.service");
const notificationManager = require("../notifications/notificationManager");
const { createAllDayEvent } = require("../../utils/calendar");
const { sendMail } = require("../../utils/mailer");

// ===== CONFIGURATION =====
const V2_ENABLED = process.env.REQUESTS_UNIFICATION_V2 === 'true';
const BC_GATING_ENABLED = process.env.BC_GATING_FOR_CONTRACT === 'true';
const BC_AFTER_SIGNED_PROFORMA = process.env.BC_AFTER_SIGNED_PROFORMA === 'true';

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
    if (V2_ENABLED) {
        return await _getPurchaseRequestV2(id, user);
    } else {
        return await _getPurchaseRequestLegacy(id, user);
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
 * Submit BC for Approval
 */
async function submitBCForApproval(id, user) {
    if (V2_ENABLED) {
        return await _submitBCForApprovalV2(id, user);
    } else {
        return await _submitBCForApprovalLegacy(id, user);
    }
}

/**
 * Approve Business Case
 */
async function approveBC(id, user, notes) {
    if (V2_ENABLED) {
        return await _approveBCV2(id, user, notes);
    } else {
        return await _approveBCV2(id, user, notes); // BC approval is already unified
    }
}

/**
 * Reject Business Case
 */
async function rejectBC(id, user, reason) {
    if (V2_ENABLED) {
        return await _rejectBCV2(id, user, reason);
    } else {
        return await _rejectBCV2(id, user, reason); // BC approval is already unified
    }
}

/**
 * Upload Contract - With BC gating
 */
async function uploadContract(id, user, file) {
    // BC gating check (applies to both V2 and legacy)
    if (BC_GATING_ENABLED) {
        await _assertPurchaseCanProceedToContract(id, user);
    }

    if (V2_ENABLED) {
        return await _uploadContractV2(id, user, file);
    } else {
        return await _uploadContractLegacy(id, user, file);
    }
}

/**
 * Get Gating Status - Check if contract upload is allowed
 */
async function getGatingStatus(id, user) {
    return await _getGatingStatus(id, user);
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
        // BC timing fields
        bc_status: 'not_created',
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

    // Create BC after signed proforma (if enabled)
    if (BC_AFTER_SIGNED_PROFORMA) {
        try {
            await _ensureBusinessCaseDocument(id, request.payload, user);
            logger.info("BC created after signed proforma for request %s", id);
        } catch (error) {
            logger.warn("Failed to create BC after signed proforma: %s", error.message);
        }
    }

    const updated = await _getPurchaseRequestV2(id, user);
    return mapV2EntityToLegacyResponse(updated);
}

async function _submitBCForApprovalV2(id, user) {
    const request = await _getPurchaseRequestV2(id, user);

    if (!request.payload.proforma_signed_at || !request.payload.commercial_certainty) {
        const error = new Error("Se requiere proforma firmada para enviar BC a aprobación");
        error.status = 409;
        error.code = 'COMMERCIAL_CERTAINTY_REQUIRED';
        throw error;
    }

    const updateData = {
        bc_status: 'in_review',
        bc_submitted_at: new Date().toISOString(),
        bc_submitted_by: user.id
    };

    await db.query(
        `UPDATE requests
     SET payload = payload || $1, updated_at = NOW()
     WHERE id = $2`,
        [JSON.stringify(updateData), id]
    );

    return _getPurchaseRequestV2(id, user);
}

async function _approveBCV2(id, user, notes) {
    // Use existing BC service (already unified)
    return await businessCaseService.approveBusinessCase(id, user, notes);
}

async function _rejectBCV2(id, user, reason) {
    // Use existing BC service (already unified)
    return await businessCaseService.rejectBusinessCase(id, user, reason);
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

async function _assertPurchaseCanProceedToContract(id, user) {
    const request = await getPurchaseRequest(id, user);
    const payload = request.payload || {};

    // Check commercial certainty
    if (!payload.proforma_signed_at || !payload.commercial_certainty) {
        const error = new Error("Se requiere proforma firmada para proceder con el contrato");
        error.status = 409;
        error.code = 'NO_COMMERCIAL_CERTAINTY';
        throw error;
    }

    // Check BC exists and is approved
    if (!payload.bc_spreadsheet_id) {
        const error = new Error("Se requiere Business Case aprobado para proceder con el contrato");
        error.status = 409;
        error.code = 'BC_NOT_CREATED';
        throw error;
    }

    if (payload.bc_status !== 'approved') {
        const error = new Error("El Business Case debe estar aprobado para proceder con el contrato");
        error.status = 409;
        error.code = 'BC_NOT_APPROVED';
        throw error;
    }

    // Check legacy exemption
    if (payload.bc_gating_exempt) {
        return { canProceed: true, exempt: true };
    }

    // Check role authorization
    const allowedRoles = ['acp_comercial', 'gerencia', 'jefe_comercial'];
    if (!allowedRoles.includes(user?.role)) {
        const error = new Error("Usuario no autorizado para subir contratos");
        error.status = 403;
        error.code = 'ROLE_NOT_ALLOWED';
        throw error;
    }

    return { canProceed: true };
}

async function _getGatingStatus(id, user) {
    try {
        const request = await getPurchaseRequest(id, user);
        const payload = request.payload || {};

        if (!BC_GATING_ENABLED || payload.bc_gating_exempt) {
            return { can_proceed_to_contract: true, gating_reasons: [], exempt: true };
        }

        const reasons = [];

        if (!payload.proforma_signed_at || !payload.commercial_certainty) {
            reasons.push('NO_COMMERCIAL_CERTAINTY');
        }

        if (!payload.bc_spreadsheet_id) {
            reasons.push('BC_NOT_CREATED');
        } else if (payload.bc_status !== 'approved') {
            reasons.push('BC_NOT_APPROVED');
        }

        return {
            can_proceed_to_contract: reasons.length === 0,
            gating_reasons: reasons,
            exempt: false
        };
    } catch (error) {
        logger.error('Error getting gating status:', error);
        return { can_proceed_to_contract: false, gating_reasons: ['SYSTEM_ERROR'], exempt: false };
    }
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
 * Ensure BC document exists (idempotent)
 */
async function _ensureBusinessCaseDocument(purchaseId, payload, user) {
    if (payload.bc_spreadsheet_id) {
        return payload; // Already exists
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Lock and check again
        const { rows } = await client.query(
            'SELECT payload FROM requests WHERE id = $1 FOR UPDATE',
            [purchaseId]
        );

        if (!rows.length) {
            throw new Error('Purchase request not found');
        }

        const currentPayload = rows[0].payload || {};
        if (currentPayload.bc_spreadsheet_id) {
            await client.query('COMMIT');
            return currentPayload;
        }

        // Create BC document
        const bcPayload = {
            client_name: payload.client_name,
            client_id: payload.client_id
        };

        const bcResult = await businessCaseService.createBusinessCase(bcPayload, user);

        // Update with BC ID
        const updatedPayload = {
            ...currentPayload,
            bc_spreadsheet_id: bcResult.bc_spreadsheet_id,
            bc_spreadsheet_url: bcResult.bc_spreadsheet_url,
            bc_created_at: new Date().toISOString(),
            bc_status: 'draft'
        };

        await client.query(
            'UPDATE requests SET payload = $1 WHERE id = $2',
            [JSON.stringify(updatedPayload), purchaseId]
        );

        await client.query('COMMIT');
        return updatedPayload;

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
        bc_spreadsheet_id: payload.bc_spreadsheet_id,
        bc_spreadsheet_url: payload.bc_spreadsheet_url,
        bc_stage: payload.bc_stage,
        bc_progress: payload.bc_progress,
        proforma_file_id: payload.proforma_file_id,
        proforma_uploaded_at: payload.proforma_uploaded_at,
        signed_proforma_file_id: payload.signed_proforma_file_id,
        signed_proforma_uploaded_at: payload.signed_proforma_uploaded_at,
        contract_file_id: payload.contract_file_id,
        contract_uploaded_at: payload.contract_uploaded_at,
        created_at: v2Entity.created_at,
        updated_at: v2Entity.updated_at,
        // BC timing fields
        bc_created_reason: payload.bc_created_reason,
        bc_locked_until_signed: payload.bc_locked_until_signed,
        bc_status: payload.bc_status,
        bc_submitted_at: payload.bc_submitted_at,
        bc_submitted_by: payload.bc_submitted_by,
        bc_approved_at: payload.bc_approved_at,
        bc_approved_by: payload.bc_approved_by,
        bc_rejected_at: payload.bc_rejected_at,
        bc_rejected_by: payload.bc_rejected_by,
        bc_rejection_reason: payload.bc_rejection_reason,
        bc_gating_exempt: payload.bc_gating_exempt,
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
    submitBCForApproval,
    approveBC,
    rejectBC,
    uploadContract,
    getGatingStatus,

    // Utility functions for testing/migration
    _ensurePurchaseFolder,
    _uploadDocumentToPurchaseFolder,
    _ensureBusinessCaseDocument,
    mapV2EntityToLegacyResponse
};