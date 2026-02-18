// API Client for Private Purchases
// Handles all private purchase related API calls

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[API_ERROR] ${endpoint}:`, error);
    throw error;
  }
};

// Private Purchases API functions
export const privatePurchasesApi = {
  // Get timeline for a purchase
  getTimeline: async (purchaseId) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'getTimeline', endpoint: '/timeline' });
    const result = await apiCall(`/private-purchases/${purchaseId}/timeline`);
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'getTimeline', status: 'ok' });
    return result;
  },

  // Manager decision (approve/reject)
  managerDecision: async (purchaseId, decision, reason) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'managerDecision', endpoint: '/manager-decision', actorRole: 'gerencia' });
    const result = await apiCall(`/private-purchases/${purchaseId}/manager-decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'managerDecision', status: 'ok' });
    return result;
  },

  // Submit corrections
  submitCorrections: async (purchaseId, reason, correctionDetails) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'submitCorrections', endpoint: '/submit-corrections', actorRole: 'backoffice' });
    const result = await apiCall(`/private-purchases/${purchaseId}/submit-corrections`, {
      method: 'POST',
      body: JSON.stringify({ reason, correctionDetails }),
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'submitCorrections', status: 'ok' });
    return result;
  },

  // Upload contract
  uploadContract: async (purchaseId, contractBase64, fileName, mimeType) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'uploadContract', endpoint: '/submit-contract', actorRole: 'backoffice' });
    const result = await apiCall(`/private-purchases/${purchaseId}/submit-contract`, {
      method: 'POST',
      body: JSON.stringify({
        contract_base64: contractBase64,
        file_name: fileName,
        mime_type: mimeType,
      }),
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'uploadContract', status: 'ok' });
    return result;
  },

  // Request delivery dates
  requestDeliveryDates: async (purchaseId) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'requestDeliveryDates', endpoint: '/request-delivery-dates', actorRole: 'jefe_operaciones' });
    const result = await apiCall(`/private-purchases/${purchaseId}/request-delivery-dates`, {
      method: 'POST',
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'requestDeliveryDates', status: 'ok' });
    return result;
  },

  // Submit delivery dates
  submitDeliveryDates: async (purchaseId, deliveryDates, notes) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'submitDeliveryDates', endpoint: '/submit-delivery-dates', actorRole: 'asesor_comercial' });
    const result = await apiCall(`/private-purchases/${purchaseId}/submit-delivery-dates`, {
      method: 'POST',
      body: JSON.stringify({ deliveryDates, notes }),
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'submitDeliveryDates', status: 'ok' });
    return result;
  },

  // Mark dispatch ready
  markDispatchReady: async (purchaseId) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'markDispatchReady', endpoint: '/mark-dispatch-ready', actorRole: 'jefe_logistica' });
    const result = await apiCall(`/private-purchases/${purchaseId}/mark-dispatch-ready`, {
      method: 'POST',
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'markDispatchReady', status: 'ok' });
    return result;
  },

  // Generate delivery act
  generateDeliveryAct: async (purchaseId, actBase64, fileName, mimeType) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'generateDeliveryAct', endpoint: '/generate-delivery-act', actorRole: 'jefe_logistica' });
    const result = await apiCall(`/private-purchases/${purchaseId}/generate-delivery-act`, {
      method: 'POST',
      body: JSON.stringify({
        act_base64: actBase64,
        file_name: fileName,
        mime_type: mimeType,
      }),
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'generateDeliveryAct', status: 'ok' });
    return result;
  },

  // Upload signed offer
  uploadSignedOffer: async (purchaseId, signedOfferBase64, fileName, mimeType) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'uploadSignedOffer', endpoint: '/offer/signed', actorRole: 'asesor_comercial' });
    const result = await apiCall(`/private-purchases/${purchaseId}/offer/signed`, {
      method: 'POST',
      body: JSON.stringify({
        signed_offer_base64: signedOfferBase64,
        file_name: fileName,
        mime_type: mimeType,
      }),
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'uploadSignedOffer', status: 'ok' });
    return result;
  },

  // Request ACP availability (for comodato)
  requestAcpAvailability: async (purchaseId) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'requestAcpAvailability', endpoint: '/request-acp-availability', actorRole: 'backoffice' });
    const result = await apiCall(`/private-purchases/${purchaseId}/request-acp-availability`, {
      method: 'POST',
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'requestAcpAvailability', status: 'ok' });
    return result;
  },

  // Start business case (for comodato)
  startBusinessCase: async (purchaseId, businessCaseData) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'startBusinessCase', endpoint: '/start-business-case', actorRole: 'backoffice' });
    const result = await apiCall(`/private-purchases/${purchaseId}/start-business-case`, {
      method: 'POST',
      body: JSON.stringify({ businessCaseData }),
    });
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'startBusinessCase', status: 'ok' });
    return result;
  },

  // Validate client approval (debug endpoint)
  validateClientApproval: async (purchaseId) => {
    console.log('[PURCHASE_FLOW][FASE7][API_CALL]', { purchaseId, action: 'validateClientApproval', endpoint: '/validate-client-approval', actorRole: 'system' });
    const result = await apiCall(`/private-purchases/${purchaseId}/validate-client-approval`);
    console.log('[PURCHASE_FLOW][FASE7][API_SUCCESS]', { purchaseId, action: 'validateClientApproval', status: 'ok' });
    return result;
  },

  // List private purchases (existing)
  listPrivatePurchases: async (filters = {}) => {
    const queryParams = new URLSearchParams();
    const normalizedStatus = typeof filters.status === 'string' ? filters.status.trim() : filters.status;
    if (normalizedStatus) queryParams.append('status', normalizedStatus);

    const result = await apiCall(`/private-purchases?${queryParams}`);
    return result;
  },

  // Get single purchase (existing)
  getPrivatePurchase: async (purchaseId) => {
    const result = await apiCall(`/private-purchases/${purchaseId}`);
    return result;
  },
};

export default privatePurchasesApi;
