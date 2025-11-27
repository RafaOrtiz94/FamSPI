import React, { useState, useEffect } from 'react';
import { FiUsers, FiEye, FiCheck, FiX, FiMessageSquare, FiFilter } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Card from '../../../core/ui/components/Card';
import Button from '../../../core/ui/components/Button';
import {
    getPersonnelRequests,
    getPersonnelRequestById,
    updatePersonnelRequestStatus,
    addPersonnelRequestComment
} from '../../../core/api/personnelRequestsApi';

const HRPersonnelRequestsWidget = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');
    const [comment, setComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const filters = {
                pageSize: 10,
            };

            if (filterStatus !== 'all') {
                filters.status = filterStatus;
            }

            const response = await getPersonnelRequests(filters);
            setRequests(response.data || []);
        } catch (error) {
            console.error('Error cargando solicitudes:', error);
            toast.error('Error al cargar solicitudes de personal');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, [filterStatus]);

    const handleViewDetails = async (requestId) => {
        try {
            const response = await getPersonnelRequestById(requestId);
            setSelectedRequest(response.data);
            setShowDetailModal(true);
        } catch (error) {
            console.error('Error cargando detalles:', error);
            toast.error('Error al cargar detalles de la solicitud');
        }
    };

    const handleUpdateStatus = async (status, notes = null) => {
        if (!selectedRequest) return;

        setActionLoading(true);
        try {
            await updatePersonnelRequestStatus(selectedRequest.id, status, notes);
            toast.success(`Solicitud ${status === 'aprobada' ? 'aprobada' : 'actualizada'} exitosamente`);
            setShowDetailModal(false);
            setSelectedRequest(null);
            loadRequests();
        } catch (error) {
            console.error('Error actualizando estado:', error);
            toast.error('Error al actualizar el estado');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!selectedRequest || !comment.trim()) {
            toast.error('Por favor escribe un comentario');
            return;
        }

        setActionLoading(true);
        try {
            await addPersonnelRequestComment(selectedRequest.id, comment, false);
            toast.success('Comentario agregado exitosamente');
            setComment('');
            // Recargar detalles
            const response = await getPersonnelRequestById(selectedRequest.id);
            setSelectedRequest(response.data);
        } catch (error) {
            console.error('Error agregando comentario:', error);
            toast.error('Error al agregar comentario');
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pendiente: 'bg-yellow-100 text-yellow-800',
            en_revision: 'bg-blue-100 text-blue-800',
            aprobada: 'bg-green-100 text-green-800',
            rechazada: 'bg-red-100 text-red-800',
            en_proceso: 'bg-purple-100 text-purple-800',
            completada: 'bg-gray-100 text-gray-800',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || badges.pendiente}`}>
                {status?.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    const getUrgencyColor = (urgency) => {
        const colors = {
            baja: 'text-gray-600',
            normal: 'text-blue-600',
            alta: 'text-orange-600',
            urgente: 'text-red-600',
        };
        return colors[urgency] || colors.normal;
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="flex items-center justify-center h-40">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FiUsers className="text-blue-600" size={24} />
                        <h3 className="text-lg font-semibold text-gray-900">Solicitudes de Personal</h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <FiFilter size={16} className="text-gray-500" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Todas</option>
                            <option value="pendiente">Pendientes</option>
                            <option value="en_revision">En Revisión</option>
                            <option value="aprobada">Aprobadas</option>
                            <option value="rechazada">Rechazadas</option>
                            <option value="en_proceso">En Proceso</option>
                            <option value="completada">Completadas</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-3">
                    {requests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <FiUsers size={48} className="mx-auto mb-2 opacity-50" />
                            <p>No hay solicitudes de personal</p>
                        </div>
                    ) : (
                        requests.map((request) => (
                            <div
                                key={request.id}
                                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h5 className="font-semibold text-gray-900">{request.position_title}</h5>
                                            {getStatusBadge(request.status)}
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            {request.request_number} • Solicitado por: {request.requester_name || request.requester_email}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Departamento: {request.department_name || 'N/A'} •
                                            Fecha: {new Date(request.created_at).toLocaleDateString('es-EC')}
                                        </p>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        icon={FiEye}
                                        size="sm"
                                        onClick={() => handleViewDetails(request.id)}
                                    >
                                        Ver Detalles
                                    </Button>
                                </div>

                                <div className="flex items-center gap-3 text-sm">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                                        {request.position_type}
                                    </span>
                                    <span className={`font-semibold ${getUrgencyColor(request.urgency_level)}`}>
                                        Urgencia: {request.urgency_level?.toUpperCase()}
                                    </span>
                                    <span className="text-gray-600">
                                        {request.quantity} {request.quantity === 1 ? 'vacante' : 'vacantes'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {requests.length > 0 && (
                    <div className="mt-4 text-center">
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                            Ver todas las solicitudes →
                        </button>
                    </div>
                )}
            </Card>

            {/* Modal de Detalles */}
            {showDetailModal && selectedRequest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedRequest.position_title}</h2>
                                <p className="text-sm text-gray-600 mt-1">{selectedRequest.request_number}</p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <FiX size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-6 space-y-6">
                            {/* Información General */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Información General</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600">Solicitante</p>
                                        <p className="font-medium">{selectedRequest.requester_name || selectedRequest.requester_email}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Departamento</p>
                                        <p className="font-medium">{selectedRequest.department_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Tipo de Contratación</p>
                                        <p className="font-medium">{selectedRequest.position_type}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Vacantes</p>
                                        <p className="font-medium">{selectedRequest.quantity}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Urgencia</p>
                                        <p className={`font-medium ${getUrgencyColor(selectedRequest.urgency_level)}`}>
                                            {selectedRequest.urgency_level?.toUpperCase()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Estado</p>
                                        {getStatusBadge(selectedRequest.status)}
                                    </div>
                                </div>
                            </div>

                            {/* Perfil Profesional */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Perfil Profesional</h3>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <p className="text-gray-600 font-medium">Nivel de Educación</p>
                                        <p>{selectedRequest.education_level}</p>
                                    </div>
                                    {selectedRequest.career_field && (
                                        <div>
                                            <p className="text-gray-600 font-medium">Campo de Estudio</p>
                                            <p>{selectedRequest.career_field}</p>
                                        </div>
                                    )}
                                    {selectedRequest.years_experience && (
                                        <div>
                                            <p className="text-gray-600 font-medium">Años de Experiencia</p>
                                            <p>{selectedRequest.years_experience} años</p>
                                        </div>
                                    )}
                                    {selectedRequest.specific_skills && (
                                        <div>
                                            <p className="text-gray-600 font-medium">Habilidades Específicas</p>
                                            <p className="whitespace-pre-wrap">{selectedRequest.specific_skills}</p>
                                        </div>
                                    )}
                                    {selectedRequest.technical_knowledge && (
                                        <div>
                                            <p className="text-gray-600 font-medium">Conocimientos Técnicos</p>
                                            <p className="whitespace-pre-wrap">{selectedRequest.technical_knowledge}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Responsabilidades */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Responsabilidades</h3>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <p className="text-gray-600 font-medium">Responsabilidades Principales</p>
                                        <p className="whitespace-pre-wrap">{selectedRequest.main_responsibilities}</p>
                                    </div>
                                    {selectedRequest.specific_functions && (
                                        <div>
                                            <p className="text-gray-600 font-medium">Funciones Específicas</p>
                                            <p className="whitespace-pre-wrap">{selectedRequest.specific_functions}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Justificación */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Justificación</h3>
                                <p className="text-sm whitespace-pre-wrap">{selectedRequest.justification}</p>
                            </div>

                            {/* Comentarios */}
                            {selectedRequest.comments && selectedRequest.comments.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Comentarios</h3>
                                    <div className="space-y-2">
                                        {selectedRequest.comments.map((c) => (
                                            <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                                                <p className="text-sm font-medium text-gray-900">{c.user_name}</p>
                                                <p className="text-sm text-gray-600 mt-1">{c.comment}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(c.created_at).toLocaleString('es-EC')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Agregar Comentario */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Agregar Comentario</h3>
                                <div className="flex gap-2">
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows="3"
                                        placeholder="Escribe un comentario..."
                                    />
                                    <Button
                                        variant="secondary"
                                        icon={FiMessageSquare}
                                        onClick={handleAddComment}
                                        disabled={actionLoading || !comment.trim()}
                                    >
                                        Enviar
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Footer con acciones */}
                        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
                            <Button
                                variant="secondary"
                                onClick={() => setShowDetailModal(false)}
                            >
                                Cerrar
                            </Button>

                            <div className="flex gap-2">
                                {selectedRequest.status === 'pendiente' && (
                                    <>
                                        <Button
                                            variant="danger"
                                            icon={FiX}
                                            onClick={() => handleUpdateStatus('rechazada')}
                                            disabled={actionLoading}
                                        >
                                            Rechazar
                                        </Button>
                                        <Button
                                            variant="primary"
                                            icon={FiCheck}
                                            onClick={() => handleUpdateStatus('aprobada')}
                                            disabled={actionLoading}
                                        >
                                            Aprobar
                                        </Button>
                                    </>
                                )}

                                {selectedRequest.status === 'aprobada' && (
                                    <Button
                                        variant="primary"
                                        onClick={() => handleUpdateStatus('en_proceso')}
                                        disabled={actionLoading}
                                    >
                                        Marcar en Proceso
                                    </Button>
                                )}

                                {selectedRequest.status === 'en_proceso' && (
                                    <Button
                                        variant="primary"
                                        icon={FiCheck}
                                        onClick={() => handleUpdateStatus('completada')}
                                        disabled={actionLoading}
                                    >
                                        Marcar como Completada
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default HRPersonnelRequestsWidget;
