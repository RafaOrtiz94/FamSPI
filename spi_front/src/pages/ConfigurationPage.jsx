import React from 'react';
import { FiSettings, FiMail } from 'react-icons/fi';
import GmailAuthWidget from '../core/ui/widgets/GmailAuthWidget';

/**
 * Página de Configuración del Usuario
 * Permite configurar preferencias personales como autorización de Gmail
 */
const ConfigurationPage = () => {
    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FiSettings className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
                            <p className="text-gray-600 mt-1">Administra tus preferencias y configuración personal</p>
                        </div>
                    </div>
                </div>

                {/* Secciones */}
                <div className="space-y-6">
                    {/* Sección: Gmail */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center space-x-3">
                                <FiMail className="w-5 h-5 text-gray-600" />
                                <h2 className="text-lg font-semibold text-gray-900">Autorización de Gmail</h2>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                Autoriza tu cuenta de Gmail para enviar correos electrónicos desde el sistema
                            </p>
                        </div>
                        <div className="p-6">
                            <GmailAuthWidget />
                        </div>
                    </div>

                    {/* Puedes agregar más secciones aquí */}
                    {/* 
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Otra Configuración</h2>
            </div>
            <div className="p-6">
              ...
            </div>
          </div>
          */}
                </div>

                {/* Info adicional */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ ¿Por qué autorizar Gmail?</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Los correos se enviarán desde tu cuenta personal</li>
                        <li>Compatible con autenticación de dos factores (2FA)</li>
                        <li>No requiere compartir contraseñas</li>
                        <li>Puedes revocar el acceso en cualquier momento</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationPage;
