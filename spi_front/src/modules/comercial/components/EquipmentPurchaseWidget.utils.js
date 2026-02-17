// Equipment Purchase Widget Utilities
// Extracted helper functions from EquipmentPurchaseWidget.jsx

import { STATUS_CONFIG } from "./EquipmentPurchaseWidget.constants";
import { formatDateTimeEC } from "../../../core/utils/dateUtils";
import {
    FiClock,
    FiAlertCircle,
    FiMail,
    FiFileText,
    FiCheckCircle,
    FiCalendar,
    FiTruck,
    FiPackage,
    FiUser,
    FiSearch,
    FiDownload,
} from "react-icons/fi";

// Icon mapping for dynamic icon rendering
const ICON_COMPONENTS = {
    FiClock,
    FiAlertCircle,
    FiMail,
    FiFileText,
    FiCheckCircle,
    FiCalendar,
    FiTruck,
    FiPackage,
    FiUser,
    FiSearch,
    FiDownload,
};

/**
 * Get icon component by name
 * @param {string} iconName - Name of the icon (e.g., 'FiClock')
 * @returns {React.Component} Icon component
 */
export const getIconComponent = (iconName) => {
    return ICON_COMPONENTS[iconName] || ICON_COMPONENTS.FiPackage;
};

/**
 * Get status configuration with icon component
 * @param {string} status - Status key
 * @returns {object} Status config with resolved icon
 */
export const getStatusConfig = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.waiting_provider_response;
    return {
        ...config,
        Icon: getIconComponent(config.iconName),
    };
};

/**
 * Format provider outcome for display
 * @param {string} outcome - Provider outcome ('new', 'cu', 'none')
 * @returns {string} Formatted outcome text
 */
export const formatProviderOutcome = (outcome) => {
    switch (outcome) {
        case "new":
            return "El proveedor confirmó disponibilidad de equipos";
        case "cu":
            return "El proveedor confirmó disponibilidad de equipos CU";
        case "none":
            return "El proveedor indicó que no hay stock disponible";
        default:
            return "Respuesta registrada del proveedor";
    }
};

/**
 * Normalize provider response items
 * @param {object} request - Request object
 * @returns {Array} Normalized items array
 */
export const normalizeResponseItems = (request) => {
    const equipment = Array.isArray(request?.equipment) ? request.equipment : [];

    return equipment.map((item) => ({
        id: item.id,
        name: item.name || item.label || item.sku || item.id || "Equipo",
        sku: item.sku,
        serial: item.serial,
        requested_type: item.type,
        available_type: item.type,
        decision: item.type === "none" ? "reject" : "accept",
    }));
};

/**
 * Deduplicate equipment list by name/sku
 * @param {Array} list - Equipment list
 * @returns {Array} Deduplicated list
 */
export const dedupeEquipmentList = (list = []) => {
    const seen = new Set();
    return (list || []).filter((item) => {
        const key = `${item.sku || item.name || item.label || item.id || ""}`.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/**
 * Get equipment list for display (available or requested)
 * @param {object} req - Request object
 * @param {object} providerResponse - Provider response
 * @returns {object} Equipment list info
 */
export const getEquipmentDisplayList = (req, providerResponse) => {
    const requestedMap = new Map((req.equipment || []).map((item) => [item.id, item]));
    const availableItems = Array.isArray(providerResponse?.items)
        ? providerResponse.items.map((item) => {
            const requestedItem = requestedMap.get(item.id) || {};
            return {
                ...item,
                name: item.name || requestedItem.name || requestedItem.label || requestedItem.sku || item.id || "Equipo",
                requested_type: item.requested_type || requestedItem.type,
                available_type: item.available_type || item.type,
                decision: item.decision || (item.available_type === "none" ? "reject" : "accept"),
            };
        })
        : [];

    const showAvailableItems = !!providerResponse && availableItems.length > 0;
    const equipmentList = showAvailableItems
        ? availableItems
        : (req.equipment || []).map((item) => ({
            ...item,
            requested_type: item.type,
            available_type: item.type,
        }));

    const equipmentTitle = showAvailableItems
        ? "Equipos disponibles (respuesta del proveedor):"
        : "Equipos solicitados:";

    return { equipmentList, equipmentTitle, showAvailableItems };
};

/**
 * Format provider response date
 * @param {object} providerResponse - Provider response object
 * @param {object} req - Request object
 * @returns {object} Formatted date info
 */
export const getFormattedProviderResponse = (providerResponse, req) => {
    const providerText = providerResponse
        ? formatProviderOutcome(providerResponse.outcome)
        : "Sin respuesta del proveedor";

    const providerTimestamp =
        providerResponse?.updated_at ||
        req.provider_response_at ||
        req.updated_at ||
        req.created_at;

    const formattedResponseDate = providerTimestamp
        ? formatDateTimeEC(providerTimestamp)
        : null;

    return { providerText, formattedResponseDate };
};

/**
 * Get pagination info for requests
 * @param {Array} filteredRequests - Filtered requests
 * @param {boolean} compactList - Whether using compact list mode
 * @param {number} currentPage - Current page number
 * @returns {object} Pagination info
 */
export const getPaginationInfo = (filteredRequests, compactList, currentPage) => {
    const perPage = compactList ? 9 : Math.max(filteredRequests.length, 1);
    const totalPages = Math.max(1, Math.ceil((filteredRequests.length || 0) / perPage));
    const page = Math.min(currentPage, totalPages);

    const visibleRequests = compactList
        ? filteredRequests.slice((page - 1) * perPage, page * perPage)
        : filteredRequests;

    return {
        perPage,
        totalPages,
        currentPage: page,
        visibleRequests,
    };
};

/**
 * Validate form data before submission
 * @param {object} form - Form data
 * @param {boolean} isManager - Whether user is manager
 * @param {object} meta - Meta data
 * @returns {object} Validation result
 */
export const validateForm = (form, isManager, meta) => {
    const errors = [];

    if (!form.clientId) {
        errors.push("Cliente es obligatorio");
    }

    if (!form.equipment.length) {
        errors.push("Debe seleccionar al menos un equipo");
    }

    if (!isManager && !form.assignedTo) {
        errors.push("Debe asignar la solicitud a un ACP Comercial");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Validate file upload
 * @param {File} file - File to validate
 * @param {Array} allowedTypes - Allowed MIME types
 * @param {number} maxSize - Max file size in MB
 * @returns {object} Validation result
 */
export const validateFile = (file, allowedTypes = ['application/pdf'], maxSize = 10) => {
    if (!file) {
        return { isValid: false, error: "Selecciona un archivo" };
    }

    if (!allowedTypes.includes(file.type)) {
        return { isValid: false, error: `Tipo de archivo no permitido. Solo: ${allowedTypes.join(', ')}` };
    }

    if (file.size > maxSize * 1024 * 1024) {
        return { isValid: false, error: `Archivo demasiado grande. Máximo: ${maxSize}MB` };
    }

    return { isValid: true };
};

/**
 * Get equipment payload for API
 * @param {Array} equipment - Selected equipment
 * @param {Array} metaEquipment - Meta equipment data
 * @returns {Array} Formatted equipment payload
 */
export const getEquipmentPayload = (equipment, metaEquipment) => {
    return equipment.map((formEq) => {
        const eq = metaEquipment.find((e) => e.id === formEq.id);
        return {
            id: eq.id,
            name: eq.name,
            sku: eq.sku,
            serial: eq.serial,
            status: eq.status,
            type: formEq.type
        };
    });
};
