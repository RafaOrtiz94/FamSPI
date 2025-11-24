import React, { useState, useEffect } from 'react';
import {
    FiCheckCircle,
    FiXCircle,
    FiClock,
    FiSearch,
    FiFilter,
    FiEye,
    FiFileText,
    FiUser,
    FiMail,
    FiPhone,
    FiMapPin,
    FiAlertCircle
} from 'react-icons/fi';
import { getClientRequests, processClientRequest, getClientRequestById } from '../../../core/api/requestsApi';
import Modal from '../../../core/ui/components/Modal';
import { toast } from 'react-hot-toast';

const ClientRequestManagement = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);

    // Filtros
    const [statusFilter, setStatusFilter] = useState('pending_approval');
    const [searchQuery, setSearchQuery] = useState('');

    // Paginación
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 10;

    useEffect(() => {
        loadRequests();
    }, [statusFilter, searchQuery, page]);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const data = await getClientRequests({
                page,
                pageSize,
                status: statusFilter,
                q: searchQuery
            });
            setRequests(data.rows || []);
            setTotalCount(data.count || 0);
        } catch (error) {
            console.error('Error cargando solicitudes:', error);
            toast.error('Error al cargar solicitudes');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (request) => {
        try {
            const fullRequest = await getClientRequestById(request.id);
            setSelectedRequest(fullRequest);
            setShowDetailModal(true);
        } catch (error) {
            console.error('Error cargando detalles:', error);
            toast.error('Error al cargar detalles');
        }
    };

    const handleApproveClick = (request) => {
        setSelectedRequest(request);
        setShowApproveModal(true);
    };

    const handleRejectClick = (request) => {
        setSelectedRequest(request);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;

        try {
            setProcessing(true);
            await processClientRequest(selectedRequest.id, 'approve', null);

            toast.success(`✅ Solicitud de ${selectedRequest.commercial_name} aprobada exitosamente`);
            setShowApproveModal(false);
            setSelectedRequest(null);
            loadRequests(); // Recargar lista
        } catch (error) {
            console.error('Error aprobando solicitud:', error);
            toast.error('Error al aprobar solicitud');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest || !rejectionReason.trim()) {
            toast.error('Debes especificar un motivo de rechazo');
            return;
        }

        try {
            setProcessing(true);
            await processClientRequest(selectedRequest.id, 'reject', rejectionReason);

            toast.success(`❌ Solicitud de ${selectedRequest.commercial_name} rechazada`);
            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectionReason('');
            loadRequests(); // Recargar lista
        } catch (error) {
            console.error('Error rechazando solicitud:', error);
            toast.error('Error al rechazar solicitud');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending_approval: { label: 'Pendiente Aprobación', color: 'bg-yellow-100 text-yellow-800', icon: FiClock },
            pending_consent: { label: 'Pend. Consentimiento', color: 'bg-blue-100 text-blue-800', icon: FiAlertCircle },
            approved: { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: FiCheckCircle },
            rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: FiXCircle }
        };
        const badge = badges[status] || badges.pending_approval;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
                <Icon className="w-4 h-4 mr-1" />
                {badge.label}
            </span>
        );
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="bg-white rounded-lg shadow-sm">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Gestión de Solicitudes de Cliente</h2>
                        <p className="text-sm text-gray-500 mt-1">Aprueba o rechaza solicitudes de nuevos clientes</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{totalCount}</p>
                        <p className="text-sm text-gray-500">Total solicitudes</p>
                    </div>
                </div>
            </div>

            {/* Filtros y Búsqueda */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Búsqueda */}
                    <div className="flex-1">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre comercial, RUC..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Filtro por Estado */}
                    <div className="md:w-64">
                        <div className="relative">
                            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                            >
                                <option value="">Todos los estados</option>
                                <option value="pending_approval">Pendiente Aprobación</option>
                                <option value="pending_consent">Pend. Consentimiento</option>
                                <option value="approved">Aprobadas</option>
                                <option value="rejected">Rechazadas</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Solicitudes */}
            <div className="divide-y divide-gray-200">
                {loading ? (
                    <div className="px-6 py-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-500">Cargando solicitudes...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-gray-500">No hay solicitudes {statusFilter ? `en estado "${statusFilter}"` : ''}</p>
                    </div>
                ) : (
                    requests.map((request) => (
                        <div key={request.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                        <h3 className="text-lg font-semibold text-gray-900">{request.commercial_name}</h3>
                                        {getStatusBadge(request.status)}
                                    </div>

                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                                        <div className="flex items-center space-x-2">
                                            <FiFileText className="w-4 h-4 text-gray-400" />
                                            <span><strong>RUC:</strong> {request.ruc_cedula}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <FiUser className="w-4 h-4 text-gray-400" />
                                            <span><strong>Tipo:</strong> {request.client_type === 'persona_juridica' ? 'Persona Jurídica' : 'Persona Natural'}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <FiMail className="w-4 h-4 text-gray-400" />
                                            <span><strong>Creado por:</strong> {request.created_by}</span>
                                        </div>
                                    </div>

                                    <div className="mt-2 text-xs text-gray-500">
                                        Creada: {new Date(request.created_at).toLocaleDateString('es-ES', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>

                                {/* Acciones */}
                                <div className="ml-4 flex items-center space-x-2">
                                    <button
                                        onClick={() => handleViewDetails(request)}
                                        className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center space-x-1"
                                    >
                                        <FiEye className="w-4 h-4" />
                                        <span>Ver Detalles</span>
                                    </button>

                                    {request.status === 'pending_approval' && (
                                        <>
                                            <button
                                                onClick={() => handleApproveClick(request)}
                                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center space-x-1"
                                            >
                                                <FiCheckCircle className="w-4 h-4" />
                                                <span>Aprobar</span>
                                            </button>

                                            <button
                                                onClick={() => handleRejectClick(request)}
                                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center space-x-1"
                                            >
                                                <FiXCircle className="w-4 h-4" />
                                                <span>Rechazar</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} de {totalCount} solicitudes
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Anterior
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Detalles */}
            <Modal
                open={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title={`Detalles de Solicitud - ${selectedRequest?.commercial_name}`}
                maxWidth="max-w-4xl"
            >
                {selectedRequest && (
                    <div className="space-y-6">
                        {/* Estado */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Estado</h3>
                            {getStatusBadge(selectedRequest.status)}
                        </div>

                        {/* Información del Cliente */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Información del Cliente</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Nombre Comercial</p>
                                    <p className="font-medium text-gray-900">{selectedRequest.commercial_name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">RUC/Cédula</p>
                                    <p className="font-medium text-gray-900">{selectedRequest.ruc_cedula}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Tipo de Cliente</p>
                                    <p className="font-medium text-gray-900">
                                        {selectedRequest.client_type === 'persona_juridica' ? 'Persona Jurídica' : 'Persona Natural'}
                                    </p>
                                </div>
                                {selectedRequest.legal_person_business_name && (
                                    <div>
                                        <p className="text-gray-500">Razón Social</p>
                                        <p className="font-medium text-gray-900">{selectedRequest.legal_person_business_name}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dirección de Establecimiento */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dirección de Establecimiento</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Ciudad</p>
                                    <p className="font-medium text-gray-900">{selectedRequest.establishment_city}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Provincia</p>
                                    <p className="font-medium text-gray-900">{selectedRequest.establishment_province}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-gray-500">Dirección</p>
                                    <p className="font-medium text-gray-900">{selectedRequest.establishment_address}</p>
                                </div>
                                {selectedRequest.establishment_phone && (
                                    <div>
                                        <p className="text-gray-500">Teléfono</p>
                                        <p className="font-medium text-gray-900">{selectedRequest.establishment_phone}</p>
                                    </div>
                                )}
                                {selectedRequest.establishment_cellphone && (
                                    <div>
                                        <p className="text-gray-500">Celular</p>
                                        <p className="font-medium text-gray-900">{selectedRequest.establishment_cellphone}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Representante Legal */}
                        {selectedRequest.legal_rep_name && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Representante Legal</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-500">Nombre</p>
                                        <p className="font-medium text-gray-900">{selectedRequest.legal_rep_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Cargo</p>
                                        <p className="font-medium text-gray-900">{selectedRequest.legal_rep_position}</p>
                                    </div>
                                    {selectedRequest.legal_rep_id_document && (
                                        <div>
                                            <p className="text-gray-500">Cédula</p>
                                            <p className="font-medium text-gray-900">{selectedRequest.legal_rep_id_document}</p>
                                        </div>
                                    )}
                                    {selectedRequest.legal_rep_email && (
                                        <div>
                                            <p className="text-gray-500">Email</p>
                                            <p className="font-medium text-gray-900">{selectedRequest.legal_rep_email}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Consentimiento LOPDP */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Consentimiento LOPDP</h3>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center space-x-2">
                                    {selectedRequest.lopdp_consent_status === 'granted' ? (
                                        <>
                                            <FiCheckCircle className="w-5 h-5 text-green-600" />
                                            <span className="font-medium text-green-900">Consentimiento Otorgado</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiClock className="w-5 h-5 text-yellow-600" />
                                            <span className="font-medium text-yellow-900">Pendiente de Consentimiento</span>
                                        </>
                                    )}
                                </div>
                                {selectedRequest.lopdp_consent_at && (
                                    <p className="text-sm text-gray-600 mt-2">
                                        Otorgado el: {new Date(selectedRequest.lopdp_consent_at).toLocaleString('es-ES')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Acciones en el modal */}
                        {selectedRequest.status === 'pending_approval' && (
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        handleRejectClick(selectedRequest);
                                    }}
                                    className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                    <FiXCircle className="w-4 h-4" />
                                    <span>Rechazar Solicitud</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        handleApproveClick(selectedRequest);
                                    }}
                                    className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                    <FiCheckCircle className="w-4 h-4" />
                                    <span>Aprobar Solicitud</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Modal de Confirmación de Aprobación */}
            <Modal
                open={showApproveModal}
                onClose={() => !processing && setShowApproveModal(false)}
                title="Confirmar Aprobación"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                            <FiCheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-gray-900">
                                ¿Estás seguro de que deseas aprobar la solicitud de <strong>{selectedRequest?.commercial_name}</strong>?
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                Al aprobar, se creará el cliente en el sistema con todos sus datos encriptados de forma segura.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            onClick={() => setShowApproveModal(false)}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={processing}
                            className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                <>
                                    <FiCheckCircle className="w-4 h-4" />
                                    <span>Sí, Aprobar</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Rechazo */}
            <Modal
                open={showRejectModal}
                onClose={() => !processing && setShowRejectModal(false)}
                title="Rechazar Solicitud"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div>
                        <p className="text-gray-900 mb-4">
                            Estás rechazando la solicitud de <strong>{selectedRequest?.commercial_name}</strong>
                        </p>

                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Motivo del rechazo <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder="Explica el motivo del rechazo para que el solicitante pueda corregir la información..."
                            disabled={processing}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            El solicitante recibirá un email con este motivo y podrá corregir la solicitud.
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            onClick={() => setShowRejectModal(false)}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={processing || !rejectionReason.trim()}
                            className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                <>
                                    <FiXCircle className="w-4 h-4" />
                                    <span>Rechazar Solicitud</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ClientRequestManagement;
