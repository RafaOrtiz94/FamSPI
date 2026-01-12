import React, { useState, useEffect } from 'react';
import { FiMail, FiCheck, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import api from '../../api';
import { toast } from 'react-hot-toast';

/**
 * Componente para gestionar la autorización de Gmail
 * Permite a los usuarios autorizar el envío de emails desde su cuenta
 */
const GmailAuthWidget = () => {
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState('');
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            setChecking(true);
            const response = await api.get('/gmail/auth/status');
            const { authorized: isAuthorized, email } = response.data.data;

            setAuthorized(isAuthorized);
            setUserEmail(email);
        } catch (error) {
            console.error('Error verificando estado de Gmail:', error);
            toast.error('Error al verificar estado de autorización');
        } finally {
            setLoading(false);
            setChecking(false);
        }
    };

    const handleAuthorize = async () => {
        try {
            const response = await api.get('/gmail/auth/url');
            const { authUrl } = response.data.data;

            // Abrir ventana de autorización
            const authWindow = window.open(
                authUrl,
                'Gmail Authorization',
                'width=600,height=700,menubar=no,toolbar=no,location=no'
            );

            // Polling para detectar cuando se cierra la ventana
            const checkWindowClosed = setInterval(() => {
                if (authWindow && authWindow.closed) {
                    clearInterval(checkWindowClosed);
                    // Verificar estado después de cerrar la ventana
                    setTimeout(() => {
                        checkAuthStatus();
                        toast.success('Verificando autorización...');
                    }, 1000);
                }
            }, 500);

            toast.success('Ventana de autorización abierta. Por favor, autoriza el acceso a Gmail.');

        } catch (error) {
            console.error('Error obteniendo URL de autorización:', error);
            toast.error('Error al iniciar autorización');
        }
    };

    const handleRevoke = async () => {
        if (!window.confirm('¿Estás seguro de que deseas revocar el acceso a Gmail? Ya no podrás enviar emails desde el sistema.')) {
            return;
        }

        try {
            await api.delete('/gmail/auth/revoke');
            setAuthorized(false);
            toast.success('Acceso a Gmail revocado');
        } catch (error) {
            console.error('Error revocando acceso:', error);
            toast.error('Error al revocar acceso');
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">Verificando estado de Gmail...</span>
                </div>
            </div>
        );
    }

    if (authorized) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                <FiCheck className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">Gmail Autorizado</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Tu cuenta <strong>{userEmail}</strong> está autorizada para enviar correos desde el sistema.
                            </p>
                            <div className="mt-3 flex items-center space-x-4">
                                <button
                                    onClick={checkAuthStatus}
                                    disabled={checking}
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1 disabled:opacity-50"
                                >
                                    <FiRefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                                    <span>Verificar Estado</span>
                                </button>
                                <button
                                    onClick={handleRevoke}
                                    className="text-sm text-red-600 hover:text-red-700"
                                >
                                    Revocar Acceso
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="ml-4">
                        <FiMail className="w-6 h-6 text-green-600" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                        <FiAlertCircle className="w-6 h-6 text-yellow-600" />
                    </div>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Autorización Requerida</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Para enviar correos electrónicos desde el sistema, necesitas autorizar el acceso a tu cuenta de Gmail.
                    </p>

                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">¿Por qué es necesario?</h4>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                            <li>Los correos se envían desde tu cuenta personal</li>
                            <li>Compatible con autenticación de dos factores (2FA)</li>
                            <li>No requiere compartir contraseñas</li>
                            <li>Puedes revocar el acceso en cualquier momento</li>
                        </ul>
                    </div>

                    <button
                        onClick={handleAuthorize}
                        className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 font-medium"
                    >
                        <FiMail className="w-5 h-5" />
                        <span>Autorizar Gmail</span>
                    </button>

                    <p className="mt-3 text-xs text-gray-500">
                        Al autorizar, se abrirá una ventana de Google para que inicies sesión y otorgues permisos de envío de correos.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GmailAuthWidget;
