import { createEquipmentPurchase, getEquipmentPurchaseMeta } from "../../core/api/equipmentPurchasesApi";

/**
 * Purchase Requests API - Centralized API client
 */

/**
 * Get equipment purchase metadata (clients, equipment, ACP users)
 * @returns {Promise<Object>} Meta data
 */
export const getPurchaseMeta = async () => {
    return await getEquipmentPurchaseMeta();
};

/**
 * Create a new purchase request
 * @param {Object} payload - Purchase request payload
 * @returns {Promise<Object>} Created purchase request
 */
export const createPurchaseRequest = async (payload) => {
    return await createEquipmentPurchase(payload);
};

// Re-export for convenience
export { getEquipmentPurchaseMeta } from "../../core/api/equipmentPurchasesApi";