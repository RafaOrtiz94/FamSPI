import React, { useState, useRef, useCallback, useEffect } from 'react';
import { signDocument, fileToBase64, SIGNATURE_STATUS } from '../../../core/api';
import FirmaDigital from '../../servicio/components/FirmaDigital';

// Constantes para mejorar mantenibilidad
const SIGNATURE_STEPS = {
  LOAD_DOCUMENT: 1,
  CONSENT: 2,
  SIGN: 3,
  COMPLETE: 4
};

const USER_ROLES = {
  DELEGADO_PROTECCION_DATOS: 'Delegado de Protección de Datos',
  JEFE_TI: 'Jefe de TI',
  GERENTE: 'Gerente',
  JEFE_COMERCIAL: 'Jefe Comercial',
  TECNICO: 'Técnico'
};

const AUTHORIZED_ROLES = {
  DPD: 'DPD',
  TI: 'TI',
  GER: 'GER',
  COM: 'COM',
  TEC: 'TEC'
};

const VALIDATION_RULES = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

/**
 * Funciones helper para validación y procesamiento
 */
const validateFile = (file) => {
  if (!file) return { isValid: false, error: 'No se seleccionó ningún archivo' };

  if (!VALIDATION_RULES.ALLOWED_TYPES.includes(file.type)) {
    return { isValid: false, error: 'Solo se permiten archivos PDF o DOCX' };
  }

  if (file.size > VALIDATION_RULES.MAX_FILE_SIZE) {
    return { isValid: false, error: 'El archivo no puede superar los 10MB' };
  }

  return { isValid: true, error: null };
};

const generateConsentText = (documentName) => {
  return `He leído y comprendido completamente el contenido del documento "${documentName || 'documento'}". ` +
         `Manifiesto expresamente mi voluntad de firmarlo digitalmente según la Ley de Comercio Electrónico del Ecuador. ` +
         `Acepto que esta firma tiene valor legal y me comprometo a su cumplimiento.`;
};

const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const validateConsentForm = (consent, roleAtSign, authorizedRole) => {
  if (!consent) {
    return { isValid: false, error: 'Debe aceptar el consentimiento expreso' };
  }
  if (!roleAtSign.trim()) {
    return { isValid: false, error: 'Debe especificar el rol con el que firma' };
  }
  if (!authorizedRole.trim()) {
    return { isValid: false, error: 'Debe especificar el rol autorizado para el sello' };
  }
  return { isValid: true, error: null };
};

/**
 * DocumentSigner - Componente principal para firma avanzada de documentos
 * ========================================================
 *
 * Proporciona interfaz completa para:
 * - Cargar documento PDF/DOCX
 * - Verificación de consentimiento expreso
 * - Firma digital avanzada con sello institucional
 * - Generación automática de QR verificable
 * - Bloqueo automático del documento
 */
const DocumentSigner = ({ documentId, onSignatureComplete, onCancel, initialDocument = null }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(initialDocument ? SIGNATURE_STEPS.CONSENT : SIGNATURE_STEPS.LOAD_DOCUMENT);
  const [document, setDocument] = useState(null);
  const [documentData, setDocumentData] = useState(null);
  const [consent, setConsent] = useState(false);
  const [consentText, setConsentText] = useState('');
  const [roleAtSign, setRoleAtSign] = useState('');
  const [authorizedRole, setAuthorizedRole] = useState('');
  const [signatureResult, setSignatureResult] = useState(null);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const signatureRef = useRef(null);

  // Permitir precargar un documento (base64) sin pasar por input de archivo
  useEffect(() => {
    if (initialDocument?.base64) {
      const base64 = initialDocument.base64.includes(',')
        ? initialDocument.base64.split(',')[1]
        : initialDocument.base64;
      setDocument({
        name: initialDocument.name || 'documento.pdf',
        size: Math.round((base64.length * 3) / 4),
      });
      setDocumentData(base64);
      setStep(SIGNATURE_STEPS.CONSENT); // Saltar a consentimiento
    }
  }, [initialDocument]);

  // Manejar selección de archivo
  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setDocument(file);
    setError(null);

    try {
      const base64 = await fileToBase64(file);
      setDocumentData(base64);
      setStep(SIGNATURE_STEPS.CONSENT);
    } catch (err) {
      setError('Error al procesar el archivo');
      console.error('File processing error:', err);
    }
  }, []);

  // Manejar consentimiento
  const handleConsentChange = useCallback((checked) => {
    setConsent(checked);
    if (checked) {
      setConsentText(generateConsentText(document?.name));
    } else {
      setConsentText('');
    }
  }, [document]);

  // Proceder a firma
  const handleProceedToSign = useCallback(() => {
    const validation = validateConsentForm(consent, roleAtSign, authorizedRole);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setError(null);
    setStep(SIGNATURE_STEPS.SIGN);
  }, [consent, roleAtSign, authorizedRole]);

  // Ejecutar firma
  const handleSignDocument = useCallback(async () => {
    if (!signatureRef.current) {
      setError('Componente de firma no disponible');
      return;
    }

    const signatureData = signatureRef.current.getBase64();
    if (!signatureData || signatureData.length < 100) {
      setError('Debe proporcionar una firma válida');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signDocument(documentId, {
        document_base64: documentData,
        consent: true,
        consent_text: consentText,
        role_at_sign: roleAtSign,
        authorized_role: authorizedRole,
        session_id: generateSessionId()
      });

      setSignatureResult(result.data);
      setStep(SIGNATURE_STEPS.COMPLETE);

      if (onSignatureComplete) {
        onSignatureComplete(result.data);
      }

    } catch (err) {
      console.error('Signature error:', err);
      setError(err.response?.data?.message || 'Error al firmar el documento');
    } finally {
      setLoading(false);
    }
  }, [documentId, documentData, consentText, roleAtSign, authorizedRole, onSignatureComplete]);

  // Renderizar paso 1: Cargar documento
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Firma Electrónica Avanzada
        </h2>
        <p className="text-gray-600">
          Cargue el documento que desea firmar digitalmente
        </p>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        {initialDocument ? (
          <div className="space-y-2">
            <p className="text-gray-700 font-medium">Documento precargado para firma.</p>
            <p className="text-sm text-gray-500 break-all">{initialDocument.name || 'documento.pdf'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileSelect}
                className="hidden"
                id="document-upload"
              />
              <label
                htmlFor="document-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Seleccionar Documento
              </label>
              <p className="mt-2 text-sm text-gray-500">
                PDF o DOCX (máx. 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {document && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Documento seleccionado: {document.name}
              </p>
              <p className="text-sm text-green-700">
                Tamaño: {(document.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar paso 2: Consentimiento
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Consentimiento Expreso
        </h2>
        <p className="text-gray-600">
          Debe aceptar expresamente el contenido y las implicaciones legales
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Importante - Consentimiento Legal
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p className="mb-2">
                Según la Ley de Comercio Electrónico del Ecuador, debe manifestar expresamente su voluntad de firmar digitalmente este documento.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rol con el que firma
          </label>
          <select
            value={roleAtSign}
            onChange={(e) => setRoleAtSign(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar rol...</option>
            <option value="Delegado de Protección de Datos">Delegado de Protección de Datos</option>
            <option value="Jefe de TI">Jefe de TI</option>
            <option value="Gerente">Gerente</option>
            <option value="Jefe Comercial">Jefe Comercial</option>
            <option value="Técnico">Técnico</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rol autorizado para sello institucional
          </label>
          <select
            value={authorizedRole}
            onChange={(e) => setAuthorizedRole(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar rol autorizado...</option>
            <option value="DPD">Delegado de Protección de Datos</option>
            <option value="TI">Jefe de TI</option>
            <option value="GER">Gerente</option>
            <option value="COM">Jefe Comercial</option>
            <option value="TEC">Técnico</option>
          </select>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => handleConsentChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="consent" className="font-medium text-gray-700">
              Acepto el consentimiento expreso
            </label>
            {consent && (
              <p className="mt-2 text-gray-600 bg-gray-50 p-3 rounded text-xs">
                {consentText}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setStep(SIGNATURE_STEPS.LOAD_DOCUMENT)}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Atrás
        </button>
        <button
          onClick={handleProceedToSign}
          disabled={!consent || !roleAtSign || !authorizedRole}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar a Firma
        </button>
      </div>
    </div>
  );

  // Renderizar paso 3: Firma digital
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Firma Digital
        </h2>
        <p className="text-gray-600">
          Dibuje su firma en el área designada
        </p>
      </div>

      <div className="flex justify-center">
        <FirmaDigital
          ref={signatureRef}
          height={200}
          strokeWidth={2}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Información de la Firma
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>• <strong>Documento:</strong> {document?.name}</p>
              <p>• <strong>Rol:</strong> {roleAtSign}</p>
              <p>• <strong>Sello autorizado por:</strong> {authorizedRole}</p>
              <p>• <strong>Fecha:</strong> {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setStep(SIGNATURE_STEPS.CONSENT)}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Atrás
        </button>
        <button
          onClick={handleSignDocument}
          disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Firmando...' : 'Firmar Documento'}
        </button>
      </div>
    </div>
  );

  // Renderizar paso 4: Resultado
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-green-600 mb-2">
          ✅ Firma Completada
        </h2>
        <p className="text-gray-600">
          El documento ha sido firmado digitalmente y bloqueado
        </p>
      </div>

      {signatureResult && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="font-medium text-green-800 mb-2">Detalles de la Firma</h3>
            <div className="space-y-1 text-sm text-green-700">
              <p>• <strong>ID Documento:</strong> {signatureResult.document_id}</p>
              <p>• <strong>Hash SHA-256:</strong> {signatureResult.hash?.value?.substring(0, 16)}...</p>
              <p>• <strong>Firmante:</strong> {signatureResult.signature?.signer}</p>
              <p>• <strong>Rol:</strong> {signatureResult.signature?.role}</p>
              <p>• <strong>Sello:</strong> {signatureResult.seal?.code}</p>
              <p>• <strong>QR Token:</strong> {signatureResult.seal?.verification_token?.substring(0, 16)}...</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-blue-800 mb-2">Código QR de Verificación</h3>
            <div className="flex justify-center">
              <img
                src={signatureResult.qr?.image}
                alt="Código QR de verificación"
                className="border border-gray-300 rounded"
              />
            </div>
            <p className="text-xs text-blue-600 mt-2 text-center">
              Escanee para verificar la autenticidad del documento
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Documento Bloqueado
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    El documento ha sido bloqueado y ya no puede ser modificado.
                    Cualquier cambio requerirá una nueva versión firmada.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onCancel || (() => window.location.reload())}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Cerrar
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Indicador de progreso */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNum
                  ? 'bg-blue-600 text-white'
                  : stepNum === step + 1
                  ? 'bg-blue-200 text-blue-600'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {stepNum}
              </div>
              {stepNum < 4 && (
                <div className={`w-12 h-1 mx-2 ${
                  step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Cargar</span>
          <span>Consentir</span>
          <span>Firmar</span>
          <span>Completar</span>
        </div>
      </div>

      {/* Contenido del paso actual */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
};

export default DocumentSigner;
