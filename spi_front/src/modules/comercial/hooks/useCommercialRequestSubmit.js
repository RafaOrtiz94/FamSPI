import { useState } from 'react';
import { useUI } from '../../../core/ui/useUI';
import { createRequest } from '../../../core/api/requestsApi';

/**
 * Hook reutilizable para manejar el envío de solicitudes comerciales
 * con loading states, manejo de errores y feedback consistente.
 *
 * @param {Object} options - Opciones de configuración
 * @param {Function} options.onSuccess - Callback cuando la solicitud se crea exitosamente
 * @param {Function} options.onError - Callback opcional cuando ocurre un error
 * @param {string} options.successMessage - Mensaje de éxito personalizado
 * @param {string} options.errorPrefix - Prefijo para mensajes de error
 * @returns {Object} - { submitRequest, isSubmitting }
 */
export const useCommercialRequestSubmit = ({
  onSuccess,
  onError,
  successMessage,
  errorPrefix = 'Error'
} = {}) => {
  const { showToast } = useUI();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRequest = async (requestType, payload, files = []) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const result = await createRequest({
        request_type_id: requestType,
        payload,
        files
      });

      const defaultSuccessMessage = `Solicitud de ${requestType === 'inspection' ? 'inspección' : requestType === 'retiro' ? 'retiro' : requestType} creada correctamente`;
      showToast(successMessage || defaultSuccessMessage, 'success');

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      console.error(`Error creando solicitud de ${requestType}:`, error);

      // Extraer información detallada del error
      const errorData = error?.response?.data || {};
      const errorMessage = errorData.message || error.message || 'Error desconocido al crear la solicitud';
      const correlationId = errorData.correlationId || errorData.correlation_id;

      // Crear mensaje completo con correlationId si existe
      let fullErrorMessage = `${errorPrefix}: ${errorMessage}`;
      if (correlationId) {
        fullErrorMessage += ` (ID: ${correlationId})`;
      }

      showToast(fullErrorMessage, 'error');

      if (onError) {
        onError(error);
      }

      // Re-throw para que el componente padre pueda manejar si es necesario
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitRequest,
    isSubmitting
  };
};