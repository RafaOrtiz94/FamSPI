import React, { useEffect, useState } from "react";
import { FiClock, FiCheck, FiX, FiFileText, FiAlertCircle, FiUpload, FiEye, FiUser, FiUsers, FiCheckCircle } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/AuthContext";
import { getMisSolicitudes, getPendientes, aprobarParcial, aprobarFinal, rechazar } from "../../../../core/api/permisosApi";
import UploadJustificantesModal from "../modals/UploadJustificantesModal";

/**
 * Widget multifuncional para gestión de permisos y vacaciones
 * Muestra TODO en un solo lugar con pestañas:
 * 1. Mis Solicitudes
 * 2. Aprobar (Jefes) - Parcial y Final
 * 3. Esperando Gerencia (Jefes)
 */
const PermisosStatusWidget = () => {
    const { user } = useAuth();
    const { showToast } = useUI();
    const role = (user?.role || "").toLowerCase();
    const userEmail = user?.email;

    const [activeTab, setActiveTab] = useState("mine");
    const [misSolicitudes, setMisSolicitudes] = useState([]);
    const [pendientesParcial, setPendientesParcial] = useState([]);
    const [pendientesFinal, setPendientesFinal] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedSolicitud, setSelectedSolicitud] = useState(null);
    const [rejectReason, setRejectReason] = useState("");

    const isJefe = [
        "jefe_comercial",
        "jefe_tecnico",
        "jefe_aplicaciones",
        "jefe_calidad",
    ].includes(role);

    const isGerencia = ["gerencia", "gerente", "administrador", "admin"].includes(role);
    const isApprover = isJefe || isGerencia;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Cargar mis solicitudes
            const misResp = await getMisSolicitudes();
            if (misResp.ok) {
                setMisSolicitudes(misResp.data || []);
            }

            // Si es jefe, cargar pendientes parciales (de su equipo) Y finales
            if (isJefe) {
                // Cargar pendientes de aprobación parcial
                const parcialResp = await getPendientes("pending");
                if (parcialResp.ok) {
                    const filtered = (parcialResp.data || []).filter((sol) => sol.user_email !== userEmail);
                    setPendientesParcial(filtered);
                }

                // Cargar pendientes de aprobación final (para completar el ciclo)
                const finalResp = await getPendientes("pending_final");
                if (finalResp.ok) {
                    const filtered = (finalResp.data || []).filter((sol) => sol.user_email !== userEmail);
                    setPendientesFinal(filtered);
                }
            }

            // Si es gerencia, cargar pendientes finales
            if (isGerencia) {
                const finalResp = await getPendientes("pending_final");
                if (finalResp.ok) {
                    setPendientesFinal(finalResp.data || []);
                }
            }
        } catch (error) {
            console.error("Error loading data:", error);
            showToast("Error al cargar solicitudes", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAprobarParcial = async (id) => {
        setActionLoading(id);
        try {
            const response = await aprobarParcial(id);
            if (response.ok) {
                showToast("✓ Aprobado parcialmente. El colaborador debe subir documentos.", "success");
                loadData();
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Error al aprobar", "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleAprobarFinal = async (id) => {
        setActionLoading(id);
        try {
            const response = await aprobarFinal(id);
            if (response.ok) {
                showToast("✓ Aprobado definitivamente. PDF generado en Drive.", "success");
                loadData();
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Error al aprobar", "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRechazar = async () => {
        if (!selectedSolicitud || !rejectReason.trim()) {
            showToast("Debes proporcionar una razón de rechazo", "warning");
            return;
        }

        setActionLoading(selectedSolicitud.id);
        try {
            const response = await rechazar(selectedSolicitud.id, rejectReason);
            if (response.ok) {
                showToast("Solicitud rechazada", "success");
                setShowRejectModal(false);
                setSelectedSolicitud(null);
                setRejectReason("");
                loadData();
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Error al rechazar", "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleUploadSuccess = () => {
        showToast("✓ Documentos subidos correctamente", "success");
        setShowUploadModal(false);
        setSelectedSolicitud(null);
        loadData();
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { label: "Pendiente", color: "bg-amber-100 text-amber-800", icon: FiClock },
            partially_approved: { label: "Subir Docs", color: "bg-blue-100 text-blue-800", icon: FiUpload },
            pending_final: { label: "Esperando Final", color: "bg-purple-100 text-purple-800", icon: FiClock },
            approved: { label: "Aprobado", color: "bg-green-100 text-green-800", icon: FiCheck },
            rejected: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: FiX },
        };
        const badge = badges[status] || badges.pending;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md ${badge.color}`}>
                <Icon className="w-3 h-3" />
                {badge.label}
            </span>
        );
    };

    const getTipoLabel = (solicitud) => {
        if (solicitud.tipo_solicitud === "vacaciones") return "Vacaciones";
        const tipos = {
            estudios: "Estudios",
            personal: "Personal",
            salud: "Salud",
            calamidad: "Calamidad",
        };
        return tipos[solicitud.tipo_permiso] || "Permiso";
    };

    const formatDate = (date) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
    };

    const renderSolicitudCard = (solicitud, showActions = false, showUser = false) => (
        <motion.div
            key={solicitud.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all"
        >
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-900">{getTipoLabel(solicitud)}</span>
                        {getStatusBadge(solicitud.status)}
                    </div>
                    {showUser && (
                        <p className="text-xs text-gray-600 mb-1">
                            👤 {solicitud.user_fullname}
                        </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{formatDate(solicitud.fecha_inicio)} → {formatDate(solicitud.fecha_fin)}</span>
                        <span className="font-medium text-gray-700">
                            {solicitud.duracion_horas ? `${solicitud.duracion_horas}h` : `${solicitud.duracion_dias}d`}
                        </span>
                    </div>
                </div>

                {/* Botón de upload para partially_approved */}
                {!showActions && solicitud.status === "partially_approved" && (
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                            setSelectedSolicitud(solicitud);
                            setShowUploadModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-xs px-3 py-1.5"
                    >
                        <FiUpload className="w-3.5 h-3.5 mr-1" />
                        Subir
                    </Button>
                )}
            </div>

            {/* Acciones para jefes */}
            {showActions && (
                <div className="space-y-2 mt-2">
                    {/* Mostrar documentos subidos si están disponibles */}
                    {solicitud.status === "pending_final" && solicitud.justificantes_urls && solicitud.justificantes_urls.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <p className="text-xs font-semibold text-blue-900 mb-1.5">📎 Documentos Justificantes:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {solicitud.justificantes_urls.map((url, idx) => (
                                    <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-300 rounded text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                        <FiEye className="w-3 h-3" />
                                        Documento {idx + 1}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-2">
                        {solicitud.status === "pending" && (
                            <>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleAprobarParcial(solicitud.id)}
                                    disabled={actionLoading === solicitud.id}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                                >
                                    {actionLoading === solicitud.id ? "..." : "✓ Aprobar"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                        setSelectedSolicitud(solicitud);
                                        setShowRejectModal(true);
                                    }}
                                    className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 text-xs py-1.5"
                                >
                                    ✗ Rechazar
                                </Button>
                            </>
                        )}

                        {solicitud.status === "pending_final" && (
                            <>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleAprobarFinal(solicitud.id)}
                                    disabled={actionLoading === solicitud.id}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                                >
                                    {actionLoading === solicitud.id ? "..." : "✓ Aprobar Final"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                        setSelectedSolicitud(solicitud);
                                        setShowRejectModal(true);
                                    }}
                                    className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 text-xs py-1.5"
                                >
                                    ✗ Rechazar
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );

    // Filtrar mis solicitudes que están esperando gerencia
    const misEsperandoGerencia = misSolicitudes.filter(
        (s) => s.status === "pending_final" || (s.status === "pending" && isJefe)
    );

    const tabs = [
        { id: "mine", label: "Mis Solicitudes", icon: FiUser, count: misSolicitudes.length },
        ...(isApprover
            ? [
                {
                    id: "approve",
                    label: isGerencia ? "Aprobar Final" : "Aprobar",
                    icon: FiCheckCircle,
                    count: isGerencia ? pendientesFinal.length : (pendientesParcial.length + pendientesFinal.length),
                },
            ]
            : []),
        ...(isJefe
            ? [
                {
                    id: "waiting",
                    label: "Esperando Gerencia",
                    icon: FiClock,
                    count: misEsperandoGerencia.length,
                },
            ]
            : []),
    ];

    if (loading) {
        return (
            <Card className="p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card className="overflow-hidden">
                {/* Header con Tabs */}
                <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between px-4 py-3">
                        <h3 className="text-base font-bold text-gray-900">Permisos y Vacaciones</h3>
                    </div>
                    <div className="flex gap-1 px-4">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive
                                        ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span
                                            className={`px-2 py-0.5 text-xs font-bold rounded-full ${isActive ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
                                                }`}
                                        >
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    <AnimatePresence mode="wait">
                        {/* Tab: Mis Solicitudes */}
                        {activeTab === "mine" && (
                            <motion.div
                                key="mine"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-2"
                            >
                                {misSolicitudes.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FiFileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-gray-900">No tienes solicitudes</p>
                                        <p className="text-xs text-gray-500 mt-1">Crea una nueva solicitud para comenzar</p>
                                    </div>
                                ) : (
                                    misSolicitudes.map((sol) => renderSolicitudCard(sol, false, false))
                                )}
                            </motion.div>
                        )}

                        {/* Tab: Aprobar */}
                        {activeTab === "approve" && (
                            <motion.div
                                key="approve"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-2"
                            >
                                {isGerencia && pendientesFinal.length === 0 && (
                                    <div className="text-center py-12">
                                        <FiCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-gray-900">No hay solicitudes pendientes</p>
                                        <p className="text-xs text-gray-500 mt-1">Todas las solicitudes han sido procesadas</p>
                                    </div>
                                )}
                                {!isGerencia && pendientesParcial.length === 0 && pendientesFinal.length === 0 && (
                                    <div className="text-center py-12">
                                        <FiCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-gray-900">No hay solicitudes pendientes</p>
                                        <p className="text-xs text-gray-500 mt-1">Tu equipo no tiene solicitudes por aprobar</p>
                                    </div>
                                )}

                                {/* Gerencia: solo finales */}
                                {isGerencia && pendientesFinal.map((sol) => renderSolicitudCard(sol, true, true))}

                                {/* Jefes: parciales Y finales */}
                                {!isGerencia && (
                                    <>
                                        {/* Aprobaciones parciales */}
                                        {pendientesParcial.length > 0 && (
                                            <>
                                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 pt-2">
                                                    Aprobación Parcial ({pendientesParcial.length})
                                                </div>
                                                {pendientesParcial.map((sol) => renderSolicitudCard(sol, true, true))}
                                            </>
                                        )}

                                        {/* Aprobaciones finales */}
                                        {pendientesFinal.length > 0 && (
                                            <>
                                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 pt-2">
                                                    Aprobación Final ({pendientesFinal.length})
                                                </div>
                                                {pendientesFinal.map((sol) => renderSolicitudCard(sol, true, true))}
                                            </>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Tab: Esperando Gerencia (solo jefes) */}
                        {activeTab === "waiting" && isJefe && (
                            <motion.div
                                key="waiting"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-2"
                            >
                                {misEsperandoGerencia.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FiClock className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-gray-900">Sin solicitudes esperando</p>
                                        <p className="text-xs text-gray-500 mt-1">No tienes solicitudes pendientes de gerencia</p>
                                    </div>
                                ) : (
                                    misEsperandoGerencia.map((sol) => renderSolicitudCard(sol, false, false))
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Card>

            {/* Modal de Rechazo */}
            <AnimatePresence>
                {showRejectModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Card className="w-full max-w-md p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-red-100 rounded-xl">
                                        <FiAlertCircle className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Rechazar Solicitud</h3>
                                        <p className="text-sm text-gray-600">Proporciona una razón</p>
                                    </div>
                                </div>

                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
                                    placeholder="Escribe la razón del rechazo..."
                                />

                                <div className="flex gap-3">
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setShowRejectModal(false);
                                            setSelectedSolicitud(null);
                                            setRejectReason("");
                                        }}
                                        className="flex-1"
                                        disabled={actionLoading}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={handleRechazar}
                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                        disabled={!rejectReason.trim() || actionLoading}
                                    >
                                        {actionLoading ? "..." : "Confirmar"}
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Upload */}
            {showUploadModal && selectedSolicitud && (
                <UploadJustificantesModal
                    open={showUploadModal}
                    onClose={() => {
                        setShowUploadModal(false);
                        setSelectedSolicitud(null);
                    }}
                    solicitud={selectedSolicitud}
                    onSuccess={handleUploadSuccess}
                />
            )}
        </>
    );
};

export default PermisosStatusWidget;
