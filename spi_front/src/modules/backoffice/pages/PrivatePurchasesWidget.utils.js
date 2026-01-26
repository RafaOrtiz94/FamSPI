// Private Purchases Widget Utilities
// Extracted helper functions from PrivatePurchases.jsx
// Based on EquipmentPurchaseWidget.utils.js structure

import { PRIVATE_PURCHASE_STATUS_CONFIG } from "./PrivatePurchasesWidget.constants";
import { formatDateEC, formatDateTimeEC } from "../../../core/utils/dateUtils";
import {
    FiClock,
    FiAlertCircle,
    FiMail,
    FiFileText,
    FiCheckCircle,
    FiPackage,
    FiUsers,
    FiX,
    FiUser,
    FiSearch,
    FiDownload,
    FiPenTool,
} from "react-icons/fi";

// Icon mapping for dynamic icon rendering
const PRIVATE_PURCHASE_ICON_COMPONENTS = {
    FiClock,
    FiAlertCircle,
    FiMail,
    FiFileText,
    FiCheckCircle,
    FiPackage,
    FiUsers,
    FiX,
    FiUser,
    FiSearch,
    FiDownload,
    FiPenTool,
};

/**
 * Get icon component by name
 * @param {string} iconName - Name of the icon (e.g., 'FiClock')
 * @returns {React.Component} Icon component
 */
export const getPrivatePurchaseIconComponent = (iconName) => {
    return PRIVATE_PURCHASE_ICON_COMPONENTS[iconName] || PRIVATE_PURCHASE_ICON_COMPONENTS.FiPackage;
};

/**
 * Get status configuration with icon component
 * @param {string} status - Status key
 * @returns {object} Status config with resolved icon
 */
export const getPrivatePurchaseStatusConfig = (status) => {
    const config = PRIVATE_PURCHASE_STATUS_CONFIG[status] || PRIVATE_PURCHASE_STATUS_CONFIG.pending_commercial;
    return {
        ...config,
        Icon: getPrivatePurchaseIconComponent(config.iconName),
    };
};

/**
 * Format date for display
 * @param {string|Date} value - Date value
 * @returns {string} Formatted date string
 */
export const formatPrivatePurchaseDate = (value) => {
    return formatDateTimeEC(value, "Sin fecha");
};

/**
 * Calculate missing documents for resubmit gating
 * @param {object} request - Request object
 * @returns {Array} Array of missing documents
 */
export const calculateMissingDocuments = (request) => {
    const missing = [];

    // Check based on BE validation logic
    if (!request.client_snapshot?.client_identifier) {
        missing.push("Identificación del cliente");
    }

    if (!request.client_registered_at) {
        missing.push("Registro de cliente completado");
    }

    if (!request.inspection_acta_document_id) {
        missing.push("Acta de inspeccion de ambiente");
    }

    if (!request.offer_document_id) {
        missing.push("Oferta enviada");
    }

    if (!request.offer_signed_document_id) {
        missing.push("Oferta firmada");
    }

    if (!request.contract_document_id) {
        missing.push("Contrato generado");
    }

    return missing;
};

/**
 * Get summary statistics for requests
 * @param {Array} requests - Requests array
 * @returns {Array} Summary statistics
 */
export const getPrivatePurchaseSummary = (requests) => {
    const statusCounts = Object.keys(PRIVATE_PURCHASE_STATUS_CONFIG).reduce((acc, status) => {
        acc[status] = { ...PRIVATE_PURCHASE_STATUS_CONFIG[status], count: 0 };
        return acc;
    }, {});

    requests.forEach((req) => {
        const status = req.status;
        if (statusCounts[status]) {
            statusCounts[status].count += 1;
        }
    });

    return Object.values(statusCounts);
};

/**
 * Filter requests based on status filter
 * @param {Array} requests - All requests
 * @param {string} statusFilter - Status filter ('all' or specific status)
 * @param {string} query - Search query
 * @returns {Array} Filtered requests
 */
export const filterPrivatePurchaseRequests = (requests, statusFilter, query = "") => {
    let filtered = requests;

    // Filter by status
    if (statusFilter !== "all") {
        filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Filter by search query
    if (query.trim()) {
        const q = query.trim().toLowerCase();
        filtered = filtered.filter((req) =>
            [req.client_snapshot?.commercial_name, req.client_snapshot?.client_email, req.created_by_email, req.created_by]
                .filter(Boolean)
                .some((val) => String(val).toLowerCase().includes(q))
        );
    }

    return filtered;
};

/**
 * Get equipment display info for a request
 * @param {object} request - Request object
 * @returns {object} Equipment display info
 */
export const getPrivatePurchaseEquipmentInfo = (request) => {
    const equipment = Array.isArray(request.equipment) ? request.equipment : [];
    const equipmentCount = equipment.length;

    const equipmentDetails = equipment.map((item) => ({
        name: item.name || item.label || item.sku || "Equipo sin nombre",
        sku: item.sku || "SKU sin datos",
        type: item.type || "N/D"
    }));

    return {
        count: equipmentCount,
        details: equipmentDetails,
        summary: equipmentCount > 0 ? `${equipmentCount} elemento${equipmentCount > 1 ? 's' : ''}` : "Sin detalles"
    };
};

/**
 * Get client display info
 * @param {object} clientSnapshot - Client snapshot object
 * @returns {object} Client display info
 */
export const getPrivatePurchaseClientInfo = (clientSnapshot) => {
    if (!clientSnapshot) {
        return {
            name: "Cliente temporal",
            email: "Sin correo",
            identifier: "Sin identificador"
        };
    }

    return {
        name: clientSnapshot.commercial_name || "Cliente temporal",
        email: clientSnapshot.client_email || "Sin correo",
        identifier: clientSnapshot.client_identifier || "Sin identificador",
        firstName: clientSnapshot.first_name || "",
        lastName: clientSnapshot.last_name || ""
    };
};

/**
 * Build unsigned folder path for offer upload
 * @param {object} request - Request object
 * @param {object} user - Current user
 * @returns {string} Folder path
 */
export const buildUnsignedFolderPath = (request, user) => {
    const commercial =
        request?.created_by_email ||
        request?.created_by ||
        user?.email ||
        "comercial";
    const client = request?.client_snapshot?.commercial_name || "cliente";
    return `/Ofertas Sin Firmar/${commercial}/${client}`;
};

/**
 * Convert file to base64
 * @param {File} file - File to convert
 * @returns {Promise<string>} Base64 string
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @returns {object} Validation result
 */
export const validatePrivatePurchaseFile = (file) => {
    if (!file) {
        return { isValid: false, error: "Selecciona un archivo" };
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        return { isValid: false, error: "Tipo de archivo no permitido. Solo PDF, PNG o JPG" };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        return { isValid: false, error: "Archivo demasiado grande. Máximo 10MB" };
    }

    return { isValid: true };
};

/**
 * Get pagination info for private purchase requests
 * @param {Array} filteredRequests - Filtered requests
 * @param {number} currentPage - Current page number
 * @returns {object} Pagination info
 */
export const getPrivatePurchasePaginationInfo = (filteredRequests, currentPage) => {
    const perPage = 9; // Fixed per page for card layout
    const totalPages = Math.max(1, Math.ceil((filteredRequests.length || 0) / perPage));
    const page = Math.min(currentPage, totalPages);

    const visibleRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);

    return {
        perPage,
        totalPages,
        currentPage: page,
        visibleRequests,
    };
};

/**
 * Format offer validity date
 * @param {string|Date} date - Validity date
 * @returns {string} Formatted date
 */
export const formatOfferValidity = (date) => {
    if (!date) return "Sin vigencia definida";
    return `Vigente hasta ${formatDateEC(date, "Fecha no disponible")}`;
};

/**
 * Get request creation info
 * @param {object} request - Request object
 * @returns {object} Creation info
 */
export const getRequestCreationInfo = (request) => {
    return {
        date: formatPrivatePurchaseDate(request.created_at),
        by: request.created_by_email || request.created_by || "Anónimo"
    };
};

/**
 * Check if user can perform action based on role and status
 * @param {object} user - User object
 * @param {string} action - Action to check
 * @param {object} request - Request object
 * @returns {boolean} Whether action is allowed
 */
export const canPerformPrivatePurchaseAction = (user, action, request) => {
    const role = (user?.role || "").toLowerCase();
    const isBackofficeUser = role.includes("backoffice");
    const isManagerUser = role.includes("gerencia") || role.includes("jefe_comercial");
    const isCommercialUser = role.includes("asesor") || (role.includes("comercial") && !isBackofficeUser);
    const isAcpUser = role.includes("acp_comercial");
    const status = request?.status;

    switch (action) {
        case "send_offer":
            return isBackofficeUser && status === "acp_availability_confirmed";
        case "upload_signed_offer":
            return isCommercialUser && ["offer_sent", "pending_client_signature"].includes(status);
        case "register_client":
            return isBackofficeUser && status === "offer_signed";
        case "request_acp_availability":
            return isBackofficeUser && status === "pending_backoffice";
        case "acp_send_email":
        case "acp_register_response":
            return isAcpUser && status === "acp_availability_requested";
        case "accept_availability":
        case "reject_availability":
            return isBackofficeUser && status === "acp_availability_requested" && Boolean(request?.provider_response_at);
        case "manager_reject":
            return isManagerUser && status === "pending_contract_approval";
        case "resubmit":
            return isBackofficeUser && status === "contract_rejected";
        default:
            return false;
    }
};
