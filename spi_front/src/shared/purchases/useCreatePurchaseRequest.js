import { useState } from "react";
import { useUI } from "../../core/ui/useUI";
import { createPurchaseRequest } from "./purchaseRequestsApi";
import { mapDtoToApi, validateDto } from "./purchaseRequest.mapper";
import { validateFormForMode } from "./purchaseRequest.modes";

/**
 * Hook for creating purchase requests with unified logic
 * @param {Object} options - Hook options
 * @param {string} options.mode - Modal mode ('acp_required' | 'acp_optional_autoassign' | 'private_direct')
 * @param {string} options.source - Source identifier ('dashboard' | 'solicitudes_publicas')
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 */
export const useCreatePurchaseRequest = ({
    mode = 'acp_required',
    source = 'dashboard',
    onSuccess,
    onError
} = {}) => {
    const { showToast } = useUI();
    const [loading, setLoading] = useState(false);
    const [progressStep, setProgressStep] = useState(null);

    // Dynamic submission steps based on mode
    const getSubmissionSteps = (currentMode) => [
        { id: "validating", label: "Validando información" },
        { id: "preparing", label: "Preparando solicitud" },
        { id: "submitting", label: currentMode === 'private_direct' ? "Creando solicitud privada" : "Enviando a ACP" },
    ];

    /**
     * Submit purchase request
     * @param {Object} formData - Form data from modal
     * @returns {Promise<Object>} Result
     */
    const submitRequest = async (formData) => {
        // Step 1: Form validation
        setProgressStep("validating");
        const modeValidation = validateFormForMode(formData, mode);

        if (!modeValidation.isValid) {
            const errorMessage = modeValidation.errors.join(', ');
            showToast(errorMessage, "warning");
            throw new Error(errorMessage);
        }

        // Step 2: DTO validation
        setProgressStep("preparing");
        const dto = {
            ...formData,
            _metadata: {
                source,
                intent: 'provider_handoff',
                mode,
                version: '2.0'
            }
        };

        try {
            validateDto(dto);
        } catch (error) {
            showToast(error.message, "warning");
            throw error;
        }

        // Step 3: Map to API payload
        const apiPayload = mapDtoToApi(dto);

        // Step 4: Submit
        setProgressStep("submitting");
        setLoading(true);

        try {
            const result = await createPurchaseRequest(apiPayload);

            // Success handling
            const successMessage = mode === 'private_direct'
                ? "Solicitud de compra privada creada correctamente"
                : mode === 'acp_required'
                    ? "Solicitud enviada al ACP Comercial"
                    : "Solicitud de compra pública creada correctamente";

            showToast(successMessage, "success");
            onSuccess?.(result);

            return result;

        } catch (error) {
            console.error('Error creating purchase request:', error);

            // Handle specific error codes
            const errorMessage = error.response?.data?.message ||
                error.response?.data?.error ||
                "No se pudo crear la solicitud";

            showToast(errorMessage, "error");
            onError?.(error);

            throw error;

        } finally {
            setLoading(false);
            setProgressStep(null);
        }
    };

    /**
     * Reset hook state
     */
    const reset = () => {
        setLoading(false);
        setProgressStep(null);
    };

    return {
        submitRequest,
        loading,
        progressStep,
        submissionSteps: getSubmissionSteps(mode),
        reset
    };
};
