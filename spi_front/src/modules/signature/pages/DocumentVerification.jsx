import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { verifyDocument } from '../../../core/api';

/**
 * DocumentVerification - Página pública de verificación de documentos
 * ================================================================
 *
 * Página accesible sin autenticación que permite verificar:
 * - Autenticidad de documentos firmados
 * - Estado de la cadena de hash
 * - Información del firmante y sello institucional
 * - Historial de accesos al QR
 */
const DocumentVerification = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [verificationData, setVerificationData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verifyDocumentToken = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await verifyDocument(token);
        setVerificationData(result.verification);

      } catch (err) {
        console.error('Verification error:', err);
        setError(err.response?.data?.message || 'Error al verificar el documento');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyDocumentToken();
    }
  }, [token]);

  // Estado de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando documento...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Verificación Fallida</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Documento verificado
  if (verificationData) {
    const { is_valid, chain_status, hash, signature, seal, qr } = verificationData;

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">

          {/* Header */}
          <div className="text-center mb-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              is_valid ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {is_valid ? (
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${
              is_valid ? 'text-green-600' : 'text-red-600'
            }`}>
              {is_valid ? 'Documento Válido' : 'Documento Inválido'}
            </h1>
            <p className="text-gray-600">
              {is_valid
                ? 'Este documento ha sido verificado y mantiene su integridad'
                : 'Este documento ha sido alterado o es inválido'
              }
            </p>
          </div>

          {/* Estado de la cadena */}
          <div className={`mb-8 p-6 rounded-lg border-2 ${
            chain_status === 'VERIFIED'
              ? 'bg-green-50 border-green-200'
              : chain_status === 'CORRUPTED'
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center mb-4">
              <div className={`w-4 h-4 rounded-full mr-3 ${
                chain_status === 'VERIFIED' ? 'bg-green-500' :
                chain_status === 'CORRUPTED' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <h2 className="text-xl font-semibold">
                Estado de la Cadena de Confianza: {
                  chain_status === 'VERIFIED' ? 'Verificada' :
                  chain_status === 'CORRUPTED' ? 'Corrupta' : 'Desconocida'
                }
              </h2>
            </div>
            <p className={`text-sm ${
              chain_status === 'VERIFIED' ? 'text-green-700' :
              chain_status === 'CORRUPTED' ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {chain_status === 'VERIFIED'
                ? 'La cadena de hash está intacta y todos los eventos de auditoría son válidos.'
                : chain_status === 'CORRUPTED'
                ? 'La cadena de hash ha sido comprometida. El documento no es confiable.'
                : 'No se pudo determinar el estado de la cadena de confianza.'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Información del Documento */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Información del Documento
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID del Documento:</span>
                  <span className="font-mono text-sm">{verificationData.document_id}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Estado de Firma:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    verificationData.signature_status === 'SIGNED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {verificationData.signature_status}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Estado del Documento:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    verificationData.is_locked
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {verificationData.is_locked ? 'Bloqueado' : 'Editable'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hash Criptográfico */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Hash Criptográfico
              </h3>

              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 text-sm">Algoritmo:</span>
                  <p className="font-medium">{hash?.algorithm || 'SHA-256'}</p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Valor del Hash:</span>
                  <p className="font-mono text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                    {hash?.value}
                  </p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Calculado el:</span>
                  <p className="text-sm">
                    {hash?.calculated_at ? new Date(hash.calculated_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Información de la Firma */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Información de la Firma
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Firmante:</span>
                  <span className="font-medium">{signature?.signer_name}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Rol:</span>
                  <span className="text-sm">{signature?.signer_role}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Firma:</span>
                  <span className="text-sm">
                    {signature?.signed_at ? new Date(signature.signed_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sello Institucional */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Sello Institucional
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Código del Sello:</span>
                  <span className="font-mono text-sm font-medium text-blue-600">
                    {seal?.code}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Emitido por:</span>
                  <span className="text-sm">{seal?.issued_by}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Rol Autorizado:</span>
                  <span className="text-sm">{seal?.authorized_role}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Emisión:</span>
                  <span className="text-sm">
                    {seal?.issued_at ? new Date(seal.issued_at).toLocaleString() : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    seal?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {seal?.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Código QR y Estadísticas */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Información del QR */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Código QR de Verificación
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Token de Verificación:</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {qr?.verification_token?.substring(0, 16)}...
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Accesos Totales:</span>
                  <span className="font-medium">{qr?.access_count || 0}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Último Acceso:</span>
                  <span className="text-sm">
                    {qr?.last_accessed_at ? new Date(qr.last_accessed_at).toLocaleString() : 'Nunca'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Estado del QR:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    qr?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {qr?.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>

            {/* Información Legal */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-xl font-semibold mb-4 text-blue-800">
                Información Legal
              </h3>

              <div className="space-y-3 text-sm text-blue-700">
                <p>
                  • Este documento está protegido por la <strong>Ley de Comercio Electrónico</strong> del Ecuador
                </p>
                <p>
                  • La firma electrónica tiene <strong>valor legal</strong> equivalente a la firma manuscrita
                </p>
                <p>
                  • El sello institucional garantiza la <strong>autenticidad y no repudio</strong>
                </p>
                <p>
                  • Cualquier alteración del documento será <strong>detectada automáticamente</strong>
                </p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="mt-12 text-center text-gray-500 text-sm">
            <p>
              Verificación realizada el {new Date().toLocaleString()} |
              Sistema de Firma Electrónica Avanzada - SPI Fam
            </p>
          </div>

        </div>
      </div>
    );
  }

  return null;
};

export default DocumentVerification;
