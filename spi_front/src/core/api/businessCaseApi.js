import api from "./index";
import logger from "../utils/logger";

// ===== NORMALIZATION HELPERS =====

/**
 * Normalizes UI guidance response from backend
 */
export const normalizeUIGuidanceResponse = (response) => {
 try {
 const data = response?.data || response;

 const businessCase = data.businessCase || null;
 const businessCaseId = businessCase?.id || data.businessCaseId || data.business_case_id || data.id || null;

 return {
 businessCase,
 businessCaseId,
 workspaceData: data.workspaceData || null,
 sectionOwnership: {
 rules: data.sectionOwnership?.rules || {},
 completionSummary: {
 completedSections: data.sectionOwnership?.completionSummary?.completedSections ?? 0,
 totalSections: data.sectionOwnership?.completionSummary?.totalSections ?? 0,
 inProgressSections: data.sectionOwnership?.completionSummary?.inProgressSections ?? 0,
 pendingSections: data.sectionOwnership?.completionSummary?.pendingSections ?? 0,
 sectionDetails: data.sectionOwnership?.completionSummary?.sectionDetails || {}
 }
 },
 permissions: {
 userRole: data.permissions?.userRole ?? 'comercial',
 canEdit: data.permissions?.canEdit ?? true,
 canCompleteSections: data.permissions?.canCompleteSections ?? true,
 canPromoteStage: data.permissions?.canPromoteStage ?? true,
 canAddObservations: data.permissions?.canAddObservations ?? true,
 canBlockSections: data.permissions?.canBlockSections ?? false,
 canUnblockSections: data.permissions?.canUnblockSections ?? false,
 canRequestPreflowReopen: data.permissions?.canRequestPreflowReopen ?? false,
 canResolvePreflowReopen: data.permissions?.canResolvePreflowReopen ?? false,
 canDecideFeasibility: data.permissions?.canDecideFeasibility ?? false,
 workspaceClosed: data.permissions?.workspaceClosed ?? false,
 },
 featureFlags: {
 autosave: data.featureFlags?.autosave || {},
 },
 preflow: data.preflow || null,
 observationData: data.observationData || null,
 workflowState: {
 currentStage: data.workflowState?.currentStage || 'draft',
 currentState: data.workflowState?.currentState || data.workflowState?.canonicalState || data.workflowState?.state || null,
 availableTransitions: data.workflowState?.availableTransitions || []
 }
 };
 } catch (error) {
 console.error('Error normalizing UI guidance response:', error);
 return {
 businessCase: null,
 sectionOwnership: { rules: {} },
 permissions: {
 canEdit: true,
 canCompleteSections: true,
 canPromoteStage: true,
 canAddObservations: true,
 canBlockSections: false,
 canUnblockSections: false,
 canRequestPreflowReopen: false,
 canResolvePreflowReopen: false,
 canDecideFeasibility: false,
 workspaceClosed: false,
 },
 featureFlags: { autosave: {} },
 observationData: null,
 workflowState: { currentStage: 'draft', availableTransitions: [] }
 };
 }
};

/**
 * Normalizes section data for consistent shape across components
 */
export const normalizeSectionData = (sectionKey, rawData) => {
 if (!rawData) return null;

 // Safe number conversion
 const safeNumber = (value, defaultValue = 0) => {
 if (value === null || value === undefined || value === '') return defaultValue;
 const num = Number(value);
 return isNaN(num) ? defaultValue : num;
 };

 // Safe date parsing
 const safeDate = (value) => {
 if (!value) return null;
 try {
 const date = new Date(value);
 return isNaN(date.getTime()) ? null : date;
 } catch {
 return null;
 }
 };

 // Safe string trimming
 const safeString = (value, defaultValue = '') => {
 if (value === null || value === undefined) return defaultValue;
 return String(value).trim();
 };

 // Safe boolean conversion
 const safeBoolean = (value, defaultValue = false) => {
 if (value === null || value === undefined) return defaultValue;
 return Boolean(value);
 };

 // Safe array handling
 const safeArray = (value, defaultValue = []) => {
 if (!Array.isArray(value)) return defaultValue;
 return value.filter(item => item !== null && item !== undefined);
 };

 const baseNormalized = {
 id: rawData.id || null,
 businessCaseId: rawData.business_case_id || rawData.businessCaseId || null,
 createdAt: safeDate(rawData.created_at || rawData.createdAt),
 updatedAt: safeDate(rawData.updated_at || rawData.updatedAt),
 lastModified: safeDate(rawData.last_modified || rawData.lastModified)
 };

 // Section-specific normalization
 switch (sectionKey) {
 case 'general':
 case 'client':
 return {
 ...baseNormalized,
 clientName: safeString(rawData.client_name || rawData.clientName),
 clientId: safeNumber(rawData.client_id || rawData.clientId),
 contactPerson: safeString(rawData.contact_person || rawData.contactPerson),
 contactEmail: safeString(rawData.contact_email || rawData.contactEmail),
 contactPhone: safeString(rawData.contact_phone || rawData.contactPhone),
 projectDescription: safeString(rawData.project_description || rawData.projectDescription),
 urgencyLevel: safeString(rawData.urgency_level || rawData.urgencyLevel, 'medium'),
 expectedDelivery: safeDate(rawData.expected_delivery || rawData.expectedDelivery)
 };

 case 'lab':
 return {
 ...baseNormalized,
 labType: safeString(rawData.lab_type || rawData.labType),
 operationalHours: safeNumber(rawData.operational_hours || rawData.operationalHours, 8),
 weekendOperation: safeBoolean(rawData.weekend_operation || rawData.weekendOperation),
 emergencyCapacity: safeBoolean(rawData.emergency_capacity || rawData.emergencyCapacity),
 sampleVolume: safeNumber(rawData.sample_volume || rawData.sampleVolume),
 complexityLevel: safeString(rawData.complexity_level || rawData.complexityLevel, 'medium'),
 specialRequirements: safeString(rawData.special_requirements || rawData.specialRequirements)
 };

 case 'equipment':
 return {
 ...baseNormalized,
 equipmentId: safeNumber(rawData.equipment_id || rawData.equipmentId),
 equipmentName: safeString(rawData.equipment_name || rawData.equipmentName),
 quantity: safeNumber(rawData.quantity, 1),
 primaryEquipment: safeBoolean(rawData.primary_equipment || rawData.primaryEquipment, true),
 backupEquipment: safeBoolean(rawData.backup_equipment || rawData.backupEquipment),
 configuration: safeString(rawData.configuration),
 specialSetup: safeString(rawData.special_setup || rawData.specialSetup)
 };

 case 'determinations':
 return {
 ...baseNormalized,
 determinationId: safeNumber(rawData.determination_id || rawData.determinationId),
 determinationName: safeString(rawData.determination_name || rawData.determinationName),
 monthlyQuantity: safeNumber(rawData.monthly_quantity || rawData.monthlyQty, 0),
 annualQuantity: safeNumber(rawData.annual_quantity || rawData.annualQty, 0),
 peakHours: safeBoolean(rawData.peak_hours || rawData.peakHours),
 statTests: safeBoolean(rawData.stat_tests || rawData.statTests)
 };

 case 'investments':
 return {
 ...baseNormalized,
 itemName: safeString(rawData.item_name || rawData.itemName),
 itemType: safeString(rawData.item_type || rawData.itemType),
 cost: safeNumber(rawData.cost, 0),
 quantity: safeNumber(rawData.quantity, 1),
 supplier: safeString(rawData.supplier),
 deliveryTime: safeNumber(rawData.delivery_time || rawData.deliveryTime, 30),
 installationRequired: safeBoolean(rawData.installation_required || rawData.installationRequired)
 };

 case 'lis':
 return {
 ...baseNormalized,
 systemType: safeString(rawData.system_type || rawData.systemType),
 currentLis: safeString(rawData.current_lis || rawData.currentLis),
 migrationRequired: safeBoolean(rawData.migration_required || rawData.migrationRequired),
 interfaceCount: safeNumber(rawData.interface_count || rawData.interfaceCount, 0),
 trainingHours: safeNumber(rawData.training_hours || rawData.trainingHours, 0),
 goLiveSupport: safeBoolean(rawData.go_live_support || rawData.goLiveSupport),
 equipmentInterfaces: safeArray(rawData.equipment_interfaces || rawData.equipmentInterfaces)
 };

 default:
 // Generic normalization for unknown sections
 return {
 ...baseNormalized,
 ...Object.keys(rawData).reduce((acc, key) => {
 const value = rawData[key];
 if (typeof value === 'number' || !isNaN(Number(value))) {
 acc[key] = safeNumber(value);
 } else if (typeof value === 'boolean') {
 acc[key] = value;
 } else if (Array.isArray(value)) {
 acc[key] = safeArray(value);
 } else {
 acc[key] = safeString(value);
 }
 return acc;
 }, {})
 };
 }
};

/**
 * Autosave helper for sections
 */
class SectionAutosaveManager {
 constructor(businessCaseId) {
 this.businessCaseId = businessCaseId;
 this.saveTimeouts = new Map();
 this.savePromises = new Map();
 this.debounceMs = 1200; // 1.2 seconds debounce
 }

 /**
 * Autosave a section with debouncing
 */
 async autosaveSection(sectionKey, data) {
 return new Promise((resolve, reject) => {
 // Clear existing timeout for this section
 if (this.saveTimeouts.has(sectionKey)) {
 clearTimeout(this.saveTimeouts.get(sectionKey));
 }

 // Set new timeout
 const timeoutId = setTimeout(async () => {
 try {
 // Prevent concurrent saves
 if (this.savePromises.has(sectionKey)) {
 await this.savePromises.get(sectionKey);
 }

 const savePromise = this._performSectionSave(sectionKey, data);
 this.savePromises.set(sectionKey, savePromise);

 const result = await savePromise;
 this.savePromises.delete(sectionKey);
 resolve(result);
 } catch (error) {
 this.savePromises.delete(sectionKey);
 reject(error);
 }
 }, this.debounceMs);

 this.saveTimeouts.set(sectionKey, timeoutId);
 });
 }

 /**
 * Force immediate save (bypass debounce)
 */
 async forceSaveSection(sectionKey, data) {
 // Clear any pending debounced save
 if (this.saveTimeouts.has(sectionKey)) {
 clearTimeout(this.saveTimeouts.get(sectionKey));
 this.saveTimeouts.delete(sectionKey);
 }

 // Wait for any ongoing save
 if (this.savePromises.has(sectionKey)) {
 await this.savePromises.get(sectionKey);
 }

 const savePromise = this._performSectionSave(sectionKey, data);
 this.savePromises.set(sectionKey, savePromise);
 try {
 const result = await savePromise;
 this.savePromises.delete(sectionKey);
 return result;
 } catch (error) {
 this.savePromises.delete(sectionKey);
 throw error;
 }
 }

 /**
 * Internal save implementation
 */
 async _performSectionSave(sectionKey, data) {
 // This would call the appropriate backend endpoint based on section
 // For now, we'll simulate the API calls
 // Simulate API delay
 await new Promise(resolve => setTimeout(resolve, 300));

 // Return normalized response
 return {
 success: true,
 section: sectionKey,
 savedAt: new Date(),
 data: normalizeSectionData(sectionKey, data)
 };
 }

 /**
 * Cleanup timeouts on unmount
 */
 destroy() {
 for (const timeoutId of this.saveTimeouts.values()) {
 clearTimeout(timeoutId);
 }
 this.saveTimeouts.clear();
 this.savePromises.clear();
 }
}

/**
 * Create autosave manager for a business case
 */
export const createAutosaveManager = (businessCaseId) => {
 return new SectionAutosaveManager(businessCaseId);
};

/**
 * List business cases with optional filters
 * @param {Object} params - Filters (page, pageSize, status, client_name, q)
 * @returns {Promise<Object>} List response
 */
export const listBusinessCases = async (params = {}) => {
 const startTime = Date.now();
 const { page = 1, pageSize = 20, status, client_name, q } = params;

 logger.apiCall("GET", "/business-case", { params });
 logger.businessCaseFlow("CONSULTA", "Consultando lista de Business Cases", {
 page,
 pageSize,
 filters: { status, client_name, q }
 });

 try {
 const { data } = await api.get("/business-case", { params });
 logger.performance("Consulta de Business Cases", startTime);
 logger.success("✅ Lista de Business Cases obtenida exitosamente", {
 count: data?.items?.length || data?.length || 0,
 page,
 pageSize
 });
 return data;
 } catch (error) {
 logger.error("❌ Error consultando lista de Business Cases", error, {
 params,
 responseStatus: error?.response?.status
 });
 throw error;
 }
};

/**
 * Create a new business case
 * @param {Object} payload - Business case payload
 * @returns {Promise<Object>} Created business case
 */
export const createBusinessCase = async (payload) => {
 const startTime = Date.now();

 logger.apiCall("POST", "/business-case", {
 payload_keys: Object.keys(payload || {})
 });

 logger.businessCaseFlow("CREACIÓN", "Creando nuevo Business Case", {
 client_name: payload?.client_name,
 bc_purchase_type: payload?.bc_purchase_type,
 payload_size: JSON.stringify(payload || {}).length
 });

 try {
 const { data } = await api.post("/business-case", payload);
 logger.performance("Creación de Business Case", startTime);
 logger.success("✅ Business Case creado exitosamente", {
 business_case_id: data?.data?.id || data?.id,
 client_name: payload?.client_name
 });
 return data.data || data;
 } catch (error) {
 logger.error("❌ Error creando Business Case", error, {
 payload_keys: Object.keys(payload || {}),
 responseStatus: error?.response?.status
 });
 throw error;
 }
};

/**
 * Get a business case by ID
 * @param {string} id - The business case ID
 * @returns {Promise<Object>} Business case data
 */
export const getBusinessCase = async (id) => {
 const startTime = Date.now();

 logger.apiCall("GET", `/business-case/${id}`);
 logger.businessCaseFlow("CONSULTA_DETALLE", "Consultando detalle de Business Case", {
 business_case_id: id
 });

 try {
 const { data } = await api.get(`/business-case/${id}`);
 logger.performance("Consulta de Business Case por ID", startTime);
 logger.success("✅ Detalle de Business Case obtenido exitosamente", {
 business_case_id: id,
 client_name: data?.data?.client_name || data?.client_name
 });
 return data.data || data;
 } catch (error) {
 logger.error("❌ Error consultando detalle de Business Case", error, {
 business_case_id: id,
 responseStatus: error?.response?.status
 });
 throw error;
 }
};

/**
 * Get UI guidance data for a business case
 * @param {string} businessCaseId - The business case ID
 * @returns {Promise<Object>} UI guidance data
 */
export const getUIGuidance = async (businessCaseId) => {
 const { data } = await api.get(`/business-case/${businessCaseId}/ui-guidance`);
 return data.data || data;
};

/**
 * Refresh UI guidance data (useful for polling updates)
 * @param {string} businessCaseId - The business case ID
 * @returns {Promise<Object>} Fresh UI guidance data
 */
export const refreshUIGuidance = async (businessCaseId) => {
 return await getUIGuidance(businessCaseId);
};

/**
 * Record section completion for a business case
 * @param {string} businessCaseId - The business case ID
 * @param {string} section - The section to mark as complete
 * @param {string} reason - Optional reason for completion
 * @returns {Promise<Object>} Completion result
 */
export const recordSectionCompletion = async (businessCaseId, section, reason = null) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/ownership/complete`, {
 section,
 reason
 });
 return data.data || data;
};

/**
 * Get data ownership information for a business case
 * @param {string} businessCaseId - The business case ID
 * @returns {Promise<Object>} Ownership information
 */
export const getDataOwnership = async (businessCaseId) => {
 const { data } = await api.get(`/business-case/${businessCaseId}/ownership`);
 return data.data || data;
};

export const lockSection = async (businessCaseId, section) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/sections/${section}/lock`);
 return data.data || data;
};

export const unlockSection = async (businessCaseId, section) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/sections/${section}/unlock`);
 return data.data || data;
};

export const requestBusinessCasePreflowReopen = async (businessCaseId, payload = {}) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/preflow/reopen-request`, payload);
 return data.data || data;
};

export const resolveBusinessCasePreflowReopen = async (businessCaseId, payload = {}) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/preflow/reopen-decision`, payload);
 return data.data || data;
};

export const submitBusinessCaseFeasibilityDecision = async (businessCaseId, payload) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/feasibility-decision`, payload);
 return data.data || data;
};

// BC-16: Apelación de factibilidad rechazada
export const requestBusinessCaseFeasibilityAppeal = async (businessCaseId, payload = {}) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/feasibility/appeal`, payload);
 return data.data || data;
};

export const resolveBusinessCaseFeasibilityAppeal = async (businessCaseId, payload = {}) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/feasibility/appeal/resolve`, payload);
 return data.data || data;
};

export const getBusinessCaseDispatchWorkspace = async (businessCaseId) => {
 const { data } = await api.get(`/business-case/${businessCaseId}/dispatch-workspace`);
 return data.data || data;
};

export const saveBusinessCaseCommercialDispatchPlan = async (businessCaseId, items = []) => {
 const { data } = await api.put(`/business-case/${businessCaseId}/dispatch-workspace/commercial-plan`, {
 items,
 });
 return data.data || data;
};

export const saveBusinessCaseOperationsDispatchControl = async (businessCaseId, items = []) => {
 const { data } = await api.put(`/business-case/${businessCaseId}/dispatch-workspace/operations-control`, {
 items,
 });
 return data.data || data;
};

export const getDeterminationsStatDocumentInfo = async (businessCaseId) => {
 const { data } = await api.get(`/business-case/${businessCaseId}/determinations/stat-document`);
 return data.data || data;
};

export const uploadDeterminationsStatDocument = async (businessCaseId, file) => {
 const formData = new FormData();
 formData.append("file", file);
 const { data } = await api.post(`/business-case/${businessCaseId}/determinations/stat-document`, formData, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 return data.data || data;
};

export const requestBusinessCaseEnvironmentInspection = async (
 businessCaseId,
 payload = {},
) => {
 const { data } = await api.post(
  `/business-case/${businessCaseId}/determinations/inspection-request`,
  payload,
 );
 return data.data || data;
};

export const getBusinessCaseObservabilityDashboard = async () => {
 const { data } = await api.get("/business-case/observability/dashboard");
 return data.data || data;
};

export const getAutosaveFeatureFlags = async (role = null) => {
 const config = role ? { params: { role } } : undefined;
 const { data } = await api.get("/business-case/feature-flags/autosave", config);
 return data.data || data;
};

export const updateAutosaveFeatureFlags = async (payload) => {
 const { data } = await api.put("/business-case/feature-flags/autosave", payload);
 return data.data || data;
};

export const getBusinessCaseStateHistory = async (businessCaseId) => {
 const { data } = await api.get(`/business-case/${businessCaseId}/state-history`);
 return data;
};

export const getBusinessCaseSlaStatus = async (businessCaseId) => {
 const { data } = await api.get(`/business-case/${businessCaseId}/sla`);
 return data;
};

export const getBusinessCaseSectionCompleteness = async (businessCaseId) => {
 const { data } = await api.get(`/business-case/${businessCaseId}/section-completeness`);
 return data;
};

export const emergencyTransition = async (businessCaseId, toState, reason) => {
 const { data } = await api.post(`/business-case/${businessCaseId}/orchestrator/emergency-transition`, { toState, reason });
 return data;
};

export const getBusinessCaseDocumentVersions = async (businessCaseId, limit = 20) => {
 const { data } = await api.get(`/business-cases/${businessCaseId}/sheets/document-versions`, { params: { limit } });
 return data;
};
