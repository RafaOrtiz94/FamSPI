import React, { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiX, FiClock, FiAlertCircle } from 'react-icons/fi';
import { getMyClientRequests } from '../../core/api/requestsApi';
import Modal from '../../core/ui/components/Modal';

const ClientRequestNotifications = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Cargar mis solicitudes
    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const data = await getMyClientRequests({ pageSize: 100 });
            setRequests(data.rows || []);
        } catch (error) {
            console.error('Error cargando solicitudes:', error);
        } finally {
            setLoading(false);
        }
    };

    // Contar solicitudes por estado
    const pendingCount = requests.filter(r =>
        r.status === 'pending_approval' || r.status === 'pending_consent'
    ).length;

    const rejectedCount = requests.filter(r => r.status === 'rejected').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;

    // Función para obtener icono y color según estado
    const getStatusInfo = (status) => {
        switch (status) {
            case 'approved':
                return { icon: FiCheck, color: 'text-green-600', bg: 'bg-green-50', label: 'Aprobada' };
            case 'rejected':
                return { icon: FiX, color: 'text-red-600', bg: 'bg-red-50', label: 'Rechazada' };
            case 'pending_approval':
                return { icon: FiClock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'En Revisión' };
            case 'pending_consent':
                return { icon: FiAlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pend. Consentimiento' };
            default:
                return { icon: FiClock, color: 'text-gray-600', bg: 'bg-gray-50', label: status };
        }
    };

    const handleViewDetails = (request) => {
        setSelectedRequest(request);
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center space-x-2">
                    <FiBell className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500">Cargando...</span>
                </div>
            </div>
        );
    }

    // Si no hay solicitudes pendientes ni rechazadas, no mostrar nada
    if (pendingCount === 0 && rejectedCount === 0) {
        return null;
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <FiBell className="w-6 h-6 text-blue-600" />
                            {(pendingCount + rejectedCount) > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                                    {pendingCount + rejectedCount}
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Mis Solicitudes de Cliente</h3>
                            <p className="text-sm text-gray-500">
                                {pendingCount > 0 && `${pendingCount} en revisión`}
                                {pendingCount > 0 && rejectedCount > 0 && ', '}
                                {rejectedCount > 0 && `${rejectedCount} rechazada${rejectedCount > 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>

                    {requests.length > 0 && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                            Ver Todas ({requests.length})
                        </button>
                    )}
                </div>

                {/* Mostrar solicitudes rechazadas */}
                {rejectedCount > 0 && (
                    <div className="mt-4 space-y-2">
                        {requests.filter(r => r.status === 'rejected').slice(0, 2).map((request) => {
                            const statusInfo = getStatusInfo(request.status);
                            const Icon = statusInfo.icon;

                            return (
                                <div
                                    key={request.id}
                                    className={`${statusInfo.bg} border border-red-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow`}
                                    onClick={() => handleViewDetails(request)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3 flex-1">
                                            <Icon className={`w-5 h-5 ${statusInfo.color} mt-0.5`} />
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{request.commercial_name}</p>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    <span className="font-medium">Motivo:</span> {request.rejection_reason || 'No especificado'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(request.updated_at || request.created_at).toLocaleDateString('es-ES', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2">
                                            Corregir
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal con todas las solicitudes */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title="Mis Solicitudes de Cliente"
                maxWidth="max-w-3xl"
            >
                <div className="space-y-3">
                    {requests.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No tienes solicitudes de cliente</p>
                    ) : (
                        requests.map((request) => {
                            const statusInfo = getStatusInfo(request.status);
                            const Icon = statusInfo.icon;

                            return (
                                <div
                                    key={request.id}
                                    className={`${statusInfo.bg} border ${request.status === 'rejected' ? 'border-red-200' :
                                            request.status === 'approved' ? 'border-green-200' :
                                                'border-gray-200'
                                        } rounded-lg p-4`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3 flex-1">
                                            <Icon className={`w-5 h-5 ${statusInfo.color} mt-0.5`} />
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2">
                                                    <p className="font-semibold text-gray-900">{request.commercial_name}</p>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bg}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </div>

                                                <div className="mt-2 text-sm text-gray-600 space-y-1">
                                                    <p><span className="font-medium">RUC:</span> {request.ruc_cedula}</p>
                                                    <p><span className="font-medium">Tipo:</span> {request.client_type === 'persona_juridica' ? 'Persona Jurídica' : 'Persona Natural'}</p>

                                                    {request.status === 'rejected' && request.rejection_reason && (
                                                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                                            <p className="text-sm text-red-800">
                                                                <span className="font-semibold">Motivo del rechazo:</span><br />
                                                                {request.rejection_reason}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {request.status === 'approved' && (
                                                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                                                            <p className="text-sm text-green-800">
                                                                ✅ Cliente registrado exitosamente con datos encriptados
                                                            </p>
                                                        </div>
                                                    )}

                                                    <p className="text-xs text-gray-500 mt-2">
                                                        Creada: {new Date(request.created_at).toLocaleDateString('es-ES', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {request.status === 'rejected' && (
                                            <button
                                                onClick={() => {
                                                    setShowModal(false);
                                                    // Aquí se implementaría la lógica para reenviar/corregir
                                                    console.log('Corregir solicitud:', request.id);
                                                }}
                                                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                            >
                                                Corregir y Reenviar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Resumen en el footer */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-center space-x-6 text-sm">
                        <div className="flex items-center space-x-2">
                            <FiCheck className="w-4 h-4 text-green-600" />
                            <span className="text-gray-600">{approvedCount} Aprobadas</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <FiClock className="w-4 h-4 text-blue-600" />
                            <span className="text-gray-600">{pendingCount} En Revisión</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <FiX className="w-4 h-4 text-red-600" />
                            <span className="text-gray-600">{rejectedCount} Rechazadas</span>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default ClientRequestNotifications;
