import React, { useState, useEffect } from "react";
import { FiCheck, FiX, FiClock, FiFileText, FiEye } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { getPendientes, aprobarParcial, aprobarFinal, rechazar } from "../../../../core/api/permisosApi";

/**
 * Vista de aprobación de permisos y vacaciones para jefes
 * Muestra solicitudes en dos etapas:
 * 1. Pendientes de aprobación parcial
 * 2. Pendientes de aprobación final (con justificantes subidos)
 */
const AprobacionPermisosView = () => {
    const { showToast } = useUI();
    const [stage, setStage] = useState("pending"); // 'pending' o 'pending_final'
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSolicitud, setSelectedSolicitud] = useState(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        loadSolicitudes();
    }, [stage]);

    const loadSolicitudes = async () => {
        setLoading(true);
        try {
            const response = await getPendientes(stage);
            if (response.ok) {
                setSolicitudes(response.data || []);
            }
        } catch (error) {
            console.error("Error loading solicitudes:", error);
            showToast("Error al cargar solicitudes", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAprobarParcial = async (id) => {
        try {
            const response = await aprobarParcial(id);
            if (response.ok) {
                showToast("Solicitud aprobada parcialmente. El colaborador debe subir justificantes.", "success");
                loadSolicitudes();
            }
        } catch (error) {
            console.error("Error approving:", error);
            showToast(error.response?.data?.message || "Error al aprobar", "error");
        }
    };

    const handleAprobarFinal = async (id) => {
        try {
            const response = await aprobarFinal(id);
            if (response.ok) {
                showToast("Solicitud aprobada definitivamente. PDF generado.", "success");
                loadSolicitudes();
            }
        } catch (error) {
            console.error("Error approving:", error);
            showToast(error.response?.data?.message || "Error al aprobar", "error");
        }
    };

    const handleRechazar = async () => {
        if (!selectedSolicitud || !rejectReason.trim()) {
            showToast("Debes proporcionar una razón de rechazo", "warning");
            return;
        }

        try {
            const response = await rechazar(selectedSolicitud.id, rejectReason);
            if (response.ok) {
                showToast("Solicitud rechazada", "success");
                setShowRejectModal(false);
                setSelectedSolicitud(null);
                setRejectReason("");
                loadSolicitudes();
            }
        } catch (error) {
            console.error("Error rejecting:", error);
            showToast(error.response?.data?.message || "Error al rechazar", "error");
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
            partially_approved: { label: "Aprobado Parcialmente", color: "bg-blue-100 text-blue-800" },
            pending_final: { label: "Esperando Aprobación Final", color: "bg-purple-100 text-purple-800" },
            approved: { label: "Aprobado", color: "bg-green-100 text-green-800" },
            rejected: { label: "Rechazado", color: "bg-red-100 text-red-800" },
        };
        const badge = badges[status] || badges.pending;
        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>{badge.label}</span>
        );
    };

    const getTipoLabel = (solicitud) => {
        if (solicitud.tipo_solicitud === "vacaciones") {
            return "Vacaciones";
        }
        const tipos = {
            estudios: "Permiso por Estudios",
            personal: "Permiso Personal",
            salud: "Permiso por Salud",
            calamidad: "Calamidad Doméstica",
        };
        return tipos[solicitud.tipo_permiso] || "Permiso";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Aprobación de Permisos y Vacaciones</h2>
            </div>

            {/* Filtros */}
            <div className="flex gap-2">
                <button
                    onClick={() => setStage("pending")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${stage === "pending"
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    Aprobación Parcial ({solicitudes.filter((s) => s.status === "pending").length})
                </button>
                <button
                    onClick={() => setStage("pending_final")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${stage === "pending_final"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    Aprobación Final ({solicitudes.filter((s) => s.status === "pending_final").length})
                </button>
            </div>

            {/* Lista de solicitudes */}
            {loading ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">Cargando solicitudes...</p>
                </div>
            ) : solicitudes.length === 0 ? (
                <Card className="p-12 text-center">
                    <FiCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay solicitudes pendientes en esta etapa</p>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {solicitudes.map((solicitud) => (
                        <Card key={solicitud.id} className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900">{getTipoLabel(solicitud)}</h3>
                                        {getStatusBadge(solicitud.status)}
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Solicitante: <span className="font-medium">{solicitud.user_fullname}</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Email: <span className="font-medium">{solicitud.user_email}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">
                                        Creado: {new Date(solicitud.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-xs text-gray-500">Fecha Inicio</p>
                                    <p className="text-sm font-medium text-gray-900">
                                        {solicitud.fecha_inicio
                                            ? new Date(solicitud.fecha_inicio).toLocaleDateString()
                                            : "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Fecha Fin</p>
                                    <p className="text-sm font-medium text-gray-900">
                                        {solicitud.fecha_fin ? new Date(solicitud.fecha_fin).toLocaleDateString() : "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Duración</p>
                                    <p className="text-sm font-medium text-gray-900">
                                        {solicitud.duracion_horas
                                            ? `${solicitud.duracion_horas} horas`
                                            : solicitud.duracion_dias
                                                ? `${solicitud.duracion_dias} días`
                                                : "N/A"}
                                    </p>
                                </div>
                                {solicitud.tipo_solicitud === "vacaciones" && solicitud.periodo_vacaciones && (
                                    <div>
                                        <p className="text-xs text-gray-500">Período</p>
                                        <p className="text-sm font-medium text-gray-900">{solicitud.periodo_vacaciones}</p>
                                    </div>
                                )}
                            </div>

                            {/* Justificantes subidos */}
                            {solicitud.justificantes_urls && solicitud.justificantes_urls.length > 0 && (
                                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm font-medium text-green-800 mb-2">
                                        Justificantes subidos ({solicitud.justificantes_urls.length})
                                    </p>
                                    <div className="space-y-1">
                                        {solicitud.justificantes_urls.map((url, index) => (
                                            <a
                                                key={index}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900"
                                            >
                                                <FiFileText className="w-4 h-4" />
                                                <span>Ver documento {index + 1}</span>
                                                <FiEye className="w-4 h-4" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Acciones */}
                            <div className="flex gap-2">
                                {stage === "pending" && solicitud.status === "pending" && (
                                    <>
                                        <Button
                                            variant="primary"
                                            onClick={() => handleAprobarParcial(solicitud.id)}
                                            className="flex-1"
                                        >
                                            <FiCheck className="w-4 h-4 mr-2" />
                                            Aprobar Parcialmente
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                setSelectedSolicitud(solicitud);
                                                setShowRejectModal(true);
                                            }}
                                            className="flex-1 bg-red-50 text-red-700 hover:bg-red-100"
                                        >
                                            <FiX className="w-4 h-4 mr-2" />
                                            Rechazar
                                        </Button>
                                    </>
                                )}

                                {stage === "pending_final" && solicitud.status === "pending_final" && (
                                    <>
                                        <Button
                                            variant="primary"
                                            onClick={() => handleAprobarFinal(solicitud.id)}
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                        >
                                            <FiCheck className="w-4 h-4 mr-2" />
                                            Aprobar Definitivamente
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                setSelectedSolicitud(solicitud);
                                                setShowRejectModal(true);
                                            }}
                                            className="flex-1 bg-red-50 text-red-700 hover:bg-red-100"
                                        >
                                            <FiX className="w-4 h-4 mr-2" />
                                            Rechazar
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Modal de rechazo */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rechazar Solicitud</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Por favor, proporciona una razón para el rechazo:
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 mb-4"
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
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleRechazar}
                                className="flex-1 bg-red-600 hover:bg-red-700"
                                disabled={!rejectReason.trim()}
                            >
                                Confirmar Rechazo
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AprobacionPermisosView;
