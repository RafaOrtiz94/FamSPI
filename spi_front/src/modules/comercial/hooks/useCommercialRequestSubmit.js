import { useState } from 'react';
import { useUI } from '../../../core/ui/useUI';
import { createRequest } from '../../../core/api/requestsApi';

/**
 * Sistema de logging del frontend para rastrear flujos de solicitudes
 */
const frontendLogger = {
 info: (message, data = {}) => {
 console.log(`[FRONTEND] ${message}`, {
 timestamp: new Date().toISOString(),
 ...data
 });
 },
 error: (message, error = {}, data = {}) => {
 console.error(`[FRONTEND] ❌ ${message}`, {
 timestamp: new Date().toISOString(),
 error: error.message || error,
 stack: error.stack,
 ...data
 });
 },
 warn: (message, data = {}) => {
 console.warn(`[FRONTEND] ⚠️ ${message}`, {
 timestamp: new Date().toISOString(),
 ...data
 });
 }
};

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
 if (isSubmitting) {
 frontendLogger.warn("🚫 Intento de envío duplicado - operación ya en curso", {
 requestType,
 isSubmitting: true
 });
 return;
 }

 const startTime = Date.now();
 setIsSubmitting(true);

 frontendLogger.info("🚀 [FLUJO_SOLICITUDES_FRONTEND] INICIANDO envío de solicitud comercial", {
 requestType,
 payloadKeys: Object.keys(payload || {}),
 filesCount: files?.length || 0,
 payloadSize: JSON.stringify(payload || {}).length
 });

 try {
 frontendLogger.info("📤 Preparando llamada a API de creación de solicitud", {
 requestType,
 payload
 });

 const result = await createRequest({
 request_type_id: requestType,
 payload,
 files
 });

 const processingTime = Date.now() - startTime;
 frontendLogger.info("✅ [FLUJO_SOLICITUDES_FRONTEND] Solicitud creada exitosamente", {
 requestType,
 requestId: result?.request?.id,
 processingTime: `${processingTime}ms`,
 resultKeys: Object.keys(result || {})
 });

 const defaultSuccessMessage = `Solicitud de ${requestType === 'inspection' ? 'inspección' : requestType === 'retiro' ? 'retiro' : requestType} creada correctamente`;
 showToast(successMessage || defaultSuccessMessage, 'success');

 if (onSuccess) {
 frontendLogger.info("🔄 Ejecutando callback de éxito", {
 requestType,
 hasCallback: !!onSuccess
 });
 onSuccess(result);
 }

 return result;
 } catch (error) {
 const processingTime = Date.now() - startTime;
 frontendLogger.error("❌ [FLUJO_SOLICITUDES_FRONTEND] Error en creación de solicitud", error, {
 requestType,
 processingTime: `${processingTime}ms`,
 payloadKeys: Object.keys(payload || {}),
 filesCount: files?.length || 0
 });

 // Extraer información detallada del error
 const errorData = error?.response?.data || {};
 const errorMessage = errorData.message || error.message || 'Error desconocido al crear la solicitud';
 const correlationId = errorData.correlationId || errorData.correlation_id;

 frontendLogger.info("📋 Procesando información de error para usuario", {
 errorMessage,
 correlationId,
 errorDataKeys: Object.keys(errorData)
 });

 // Crear mensaje completo con correlationId si existe
 let fullErrorMessage = `${errorPrefix}: ${errorMessage}`;
 if (correlationId) {
 fullErrorMessage += ` (ID: ${correlationId})`;
 frontendLogger.info("🆔 Error incluye correlation ID", { correlationId });
 }

 showToast(fullErrorMessage, 'error');

 if (onError) {
 frontendLogger.info("🔄 Ejecutando callback de error", {
 requestType,
 hasCallback: !!onError
 });
 onError(error);
 }

 // Re-throw para que el componente padre pueda manejar si es necesario
 throw error;
 } finally {
 const totalTime = Date.now() - startTime;
 frontendLogger.info("🏁 Finalizando operación de envío de solicitud", {
 requestType,
 totalTime: `${totalTime}ms`,
 isSubmitting: false
 });
 setIsSubmitting(false);
 }
 };

 return {
 submitRequest,
 isSubmitting
 };
};
