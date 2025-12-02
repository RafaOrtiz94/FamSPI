import React, { useState, useEffect } from 'react';
import { FiUsers, FiPlus, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Card from '../components/Card';
import Button from '../components/Button';
import PersonnelRequestForm from './PersonnelRequestForm';
import { getPersonnelRequests } from '../../api/personnelRequestsApi';

const PersonnelRequestWidget = () => {
    const [showForm, setShowForm] = useState(false);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        pendientes: 0,
        en_revision: 0,
        aprobadas: 0,
        rechazadas: 0,
    });

    const loadRequests = async () => {
        setLoading(true);
        try {
            const response = await getPersonnelRequests({ my_requests: true, pageSize: 5 });
            setRequests(response.data || []);

            // Calcular estadísticas
            const newStats = {
                pendientes: 0,
                en_revision: 0,
                aprobadas: 0,
                rechazadas: 0,
            };

            response.data?.forEach(req => {
                if (newStats.hasOwnProperty(req.status)) {
                    newStats[req.status]++;
                }
            });

            setStats(newStats);
        } catch (error) {
            console.error('Error cargando solicitudes:', error);
            toast.error('Error al cargar solicitudes de personal');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const handleSuccess = () => {
        loadRequests();
    };

    const getStatusBadge = (status) => {
        const badges = {
            pendiente: { color: 'bg-yellow-100 text-yellow-800', icon: FiClock, label: 'Pendiente' },
            en_revision: { color: 'bg-blue-100 text-blue-800', icon: FiAlertCircle, label: 'En Revisión' },
            aprobada: { color: 'bg-green-100 text-green-800', icon: FiCheckCircle, label: 'Aprobada' },
            rechazada: { color: 'bg-red-100 text-red-800', icon: FiXCircle, label: 'Rechazada' },
            en_proceso: { color: 'bg-purple-100 text-purple-800', icon: FiClock, label: 'En Proceso' },
            completada: { color: 'bg-gray-100 text-gray-800', icon: FiCheckCircle, label: 'Completada' },
        };

        const badge = badges[status] || badges.pendiente;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                <Icon size={12} />
                {badge.label}
            </span>
        );
    };

    const getUrgencyBadge = (urgency) => {
        const badges = {
            baja: 'bg-gray-100 text-gray-700',
            normal: 'bg-blue-100 text-blue-700',
            alta: 'bg-orange-100 text-orange-700',
            urgente: 'bg-red-100 text-red-700',
        };

        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${badges[urgency] || badges.normal}`}>
                {urgency?.toUpperCase()}
            </span>
        );
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
                    <Button
                        variant="primary"
                        icon={FiPlus}
                        onClick={() => setShowForm(true)}
                        size="sm"
                    >
                        Nueva Solicitud
                    </Button>
                </div>

                {/* Estadísticas rápidas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-yellow-50 rounded-lg p-3">
                        <p className="text-xs text-yellow-600 font-medium">Pendientes</p>
                        <p className="text-2xl font-bold text-yellow-700">{stats.pendientes}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium">En Revisión</p>
                        <p className="text-2xl font-bold text-blue-700">{stats.en_revision}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-medium">Aprobadas</p>
                        <p className="text-2xl font-bold text-green-700">{stats.aprobadas}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs text-red-600 font-medium">Rechazadas</p>
                        <p className="text-2xl font-bold text-red-700">{stats.rechazadas}</p>
                    </div>
                </div>

                {/* Lista de solicitudes recientes */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Solicitudes Recientes</h4>

                    {requests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <FiUsers size={48} className="mx-auto mb-2 opacity-50" />
                            <p>No tienes solicitudes de personal</p>
                            <p className="text-sm mt-1">Crea una nueva solicitud para comenzar</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {requests.map((request) => (
                                <div
                                    key={request.id}
                                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h5 className="font-semibold text-gray-900 text-sm">
                                                {request.position_title}
                                            </h5>
                                            <p className="text-xs text-gray-600 mt-0.5">
                                                {request.request_number} • {new Date(request.created_at).toLocaleDateString('es-EC')}
                                            </p>
                                        </div>
                                        {getStatusBadge(request.status)}
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded">
                                            {request.position_type}
                                        </span>
                                        {getUrgencyBadge(request.urgency_level)}
                                        <span>
                                            {request.quantity} {request.quantity === 1 ? 'vacante' : 'vacantes'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
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

            {showForm && (
                <PersonnelRequestForm
                    onClose={() => setShowForm(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
};

export default PersonnelRequestWidget;
