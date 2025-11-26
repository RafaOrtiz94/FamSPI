import React, { useEffect, useState } from 'react';
import { FiUser, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useAuth } from '../../../core/auth/AuthContext';
import { getMyClientRequests } from '../../../core/api/requestsApi';
import { listEquipmentPurchases } from '../../../core/api/equipmentPurchasesApi';
import Card from '../../../core/ui/components/Card';
import { toast } from 'react-hot-toast';

const MyClientRequestsWidget = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    });
    const [equipmentStats, setEquipmentStats] = useState({
        total: 0,
        active: 0
    });

    useEffect(() => {
        const loadMyRequests = async () => {
            if (!user?.email) return;

            try {
                setLoading(true);
                const [clientData, equipmentData] = await Promise.all([
                    getMyClientRequests({
                        page: 1,
                        pageSize: 100,
                        // No necesitamos createdBy porque el endpoint /my ya filtra por el usuario autenticado
                    }),
                    listEquipmentPurchases(),
                ]);

                const userRequests = (clientData.rows || []).filter(
                    req => req.created_by === user.email
                );

                setRequests(userRequests);

                // Calcular estadísticas
                setStats({
                    total: userRequests.length,
                    pending: userRequests.filter(r => r.status === 'pending_approval').length,
                    approved: userRequests.filter(r => r.status === 'approved').length,
                    rejected: userRequests.filter(r => r.status === 'rejected').length
                });

                const equipmentRequests = Array.isArray(equipmentData) ? equipmentData : [];
                setEquipmentStats({
                    total: equipmentRequests.length,
                    active: equipmentRequests.filter(r => r.status !== 'completed').length
                });
            } catch (error) {
                console.error('Error cargando solicitudes:', error);
                toast.error('Error al cargar tus solicitudes de clientes');
            } finally {
                setLoading(false);
            }
        };

        loadMyRequests();
    }, [user]);

    const getStatusBadge = (status) => {
        const badges = {
            pending_approval: {
                label: 'Pendiente',
                color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                icon: FiClock
            },
            pending_consent: {
                label: 'Pend. Consentimiento',
                color: 'bg-blue-100 text-blue-800 border-blue-200',
                icon: FiClock
            },
            approved: {
                label: 'Aprobada',
                color: 'bg-green-100 text-green-800 border-green-200',
                icon: FiCheckCircle
            },
            rejected: {
                label: 'Rechazada',
                color: 'bg-red-100 text-red-800 border-red-200',
                icon: FiXCircle
            }
        };
        const badge = badges[status] || badges.pending_approval;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                <Icon className="w-3 h-3 mr-1" />
                {badge.label}
            </span>
        );
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                    <p className="text-gray-500 text-sm">Cargando tus solicitudes...</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header con estadísticas */}
            <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <FiUser className="w-5 h-5 text-blue-600" />
                            Mis Solicitudes y Compras
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Solicitudes de registro de clientes que has creado y las compras de equipos que ves en la sección de solicitudes en curso.
                        </p>
                    </div>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 font-medium mb-1">Total</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-yellow-700 font-medium mb-1">Pendientes</p>
                        <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-700 font-medium mb-1">Aprobadas</p>
                        <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-red-700 font-medium mb-1">Rechazadas</p>
                        <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-indigo-700 font-medium mb-1">Solicitudes de compra</p>
                        <p className="text-2xl font-bold text-indigo-700">{equipmentStats.total}</p>
                        <p className="text-[11px] text-indigo-600 mt-1">{equipmentStats.active} activas en solicitudes en curso</p>
                    </div>
                </div>
            </Card>

            {/* Lista de solicitudes */}
            <Card className="p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-4">
                    Últimas Solicitudes ({requests.length})
                </h4>

                {requests.length === 0 ? (
                    <div className="text-center py-8">
                        <FiUser className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No has creado solicitudes de clientes aún</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {requests.slice(0, 10).map((request) => (
                            <div
                                key={request.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm truncate">
                                        {request.commercial_name}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-xs text-gray-500">
                                            RUC: {request.ruc_cedula || 'N/A'}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(request.created_at).toLocaleDateString('es-ES')}
                                        </p>
                                    </div>
                                </div>
                                <div className="ml-3">
                                    {getStatusBadge(request.status)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default MyClientRequestsWidget;
