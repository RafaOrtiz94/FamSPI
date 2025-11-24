import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiUserPlus, FiFileText, FiCheckCircle, FiAlertCircle, FiClock, FiXCircle, FiEdit2 } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import NewClientRequestForm from "../../comercial/components/NewClientRequestForm";
import { useAuth } from "../../../core/auth/AuthContext";
import { getMyClientRequests } from "../../../core/api/requestsApi";

/**
 * ClientRequestWidget Component
 * ----------------------------------------------------------
 * Widget para solicitud de creación de cliente
 * Muestra estado de solicitudes recientes y permite corregir rechazadas
 */
const ClientRequestWidget = ({ compact = false, className = "" }) => {
    const { user } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const [myRequests, setMyRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingRequest, setEditingRequest] = useState(null);

    // Cualquier usuario autenticado puede crear solicitudes de cliente
    const canCreateClient = !!user;
    // Solo Jefe Comercial y Admin pueden subir archivos
    const canUploadFiles = user?.role === "jefe_comercial" || user?.role === "admin";

    useEffect(() => {
        if (user) {
            loadMyRequests();
        }
    }, [user]);

    const loadMyRequests = async () => {
        try {
            setLoading(true);
            const data = await getMyClientRequests({ page: 1, pageSize: 5 });
            setMyRequests(data.rows || []);
        } catch (error) {
            console.error("Error loading requests", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = () => {
        if (!canCreateClient) return;
        setEditingRequest(null);
        setModalOpen(true);
    };

    const handleEditRequest = (request) => {
        setEditingRequest(request);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setEditingRequest(null);
    };

    const handleSuccess = () => {
        setModalOpen(false);
        setEditingRequest(null);
        loadMyRequests();
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending_approval: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: FiClock },
            pending_consent: { label: 'Pend. Consentimiento', color: 'bg-blue-100 text-blue-800', icon: FiAlertCircle },
            approved: { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: FiCheckCircle },
            rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: FiXCircle }
        };
        const badge = badges[status] || badges.pending_approval;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                <Icon className="w-3 h-3 mr-1" />
                {badge.label}
            </span>
        );
    };

    if (compact) {
        return (
            <>
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={className}
                >
                    <Button
                        variant="primary"
                        icon={FiUserPlus}
                        onClick={handleOpenModal}
                        disabled={!canCreateClient}
                        className="w-full py-3"
                    >
                        Nuevo Cliente
                    </Button>
                </motion.div>

                <Modal
                    open={modalOpen}
                    onClose={handleCloseModal}
                    title="Solicitud de Creación de Cliente"
                    maxWidth="max-w-4xl"
                >
                    <NewClientRequestForm
                        canUploadFiles={canUploadFiles}
                        onCancel={handleCloseModal}
                        onSuccess={handleSuccess}
                        showIntro={true}
                    />
                </Modal>
            </>
        );
    }

    return (
        <>
            <Card className={`p-4 bg-gradient-to-br from-white to-blue-50 shadow-sm ${className}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FiUserPlus className="text-blue-600 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Solicitudes de Cliente</h3>
                            <p className="text-xs text-gray-600">Gestiona tus solicitudes</p>
                        </div>
                    </div>
                    {myRequests.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={handleOpenModal} icon={FiUserPlus} />
                    )}
                </div>

                <div className="space-y-3 mb-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-4 text-xs text-gray-500">Cargando...</div>
                    ) : myRequests.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-xs text-gray-600 mb-3">No tienes solicitudes recientes.</p>
                            <Button variant="primary" size="sm" onClick={handleOpenModal} className="w-full">
                                Crear Primera Solicitud
                            </Button>
                        </div>
                    ) : (
                        myRequests.map(req => (
                            <div key={req.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-medium text-sm text-gray-800 truncate pr-2" title={req.commercial_name}>
                                        {req.commercial_name}
                                    </span>
                                    {getStatusBadge(req.status)}
                                </div>
                                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                    <FiClock className="w-3 h-3" />
                                    {new Date(req.created_at).toLocaleDateString()}
                                </div>

                                {req.status === 'rejected' && (
                                    <div className="bg-red-50 p-2 rounded text-xs text-red-700 mb-2 border border-red-100">
                                        <strong>Motivo:</strong> {req.rejection_reason || "Sin motivo especificado"}
                                    </div>
                                )}

                                {req.status === 'rejected' && (
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                        onClick={() => handleEditRequest(req)}
                                        icon={FiEdit2}
                                    >
                                        Corregir Solicitud
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {myRequests.length > 0 && (
                    <Button
                        variant="primary"
                        icon={FiUserPlus}
                        onClick={handleOpenModal}
                        disabled={!canCreateClient}
                        className="w-full py-2 text-sm"
                    >
                        Nueva Solicitud
                    </Button>
                )}
            </Card>

            <Modal
                open={modalOpen}
                onClose={handleCloseModal}
                title={editingRequest ? "Corregir Solicitud" : "Solicitud de Creación de Cliente"}
                maxWidth="max-w-4xl"
            >
                <NewClientRequestForm
                    canUploadFiles={canUploadFiles}
                    onCancel={handleCloseModal}
                    onSuccess={handleSuccess}
                    showIntro={!editingRequest}
                    initialData={editingRequest}
                    isEditing={!!editingRequest}
                />
            </Modal>
        </>
    );
};

export default ClientRequestWidget;
