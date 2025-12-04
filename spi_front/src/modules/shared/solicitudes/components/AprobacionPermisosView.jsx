import React, { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiFilter, FiFileText, FiXCircle } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import {
    aprobarPermisoFinal,
    aprobarPermisoParcial,
    listarPendientes,
    rechazarPermiso,
} from "../../../../core/api/permisosApi";

const stageFilters = [
    { value: "pending", label: "Pendientes (aprobación parcial)" },
    { value: "pending_final", label: "Pendientes (aprobación final)" },
];

const statusLabels = {
    pending: "Pendiente",
    partially_approved: "Aprobado parcialmente",
    pending_final: "Esperando aprobación final",
    approved: "Aprobado",
    rejected: "Rechazado",
};

const AprobacionPermisosView = () => {
    const { showToast, confirm } = useUI();
    const [stage, setStage] = useState("pending");
    const [loading, setLoading] = useState(true);
    const [solicitudes, setSolicitudes] = useState([]);

    const loadSolicitudes = async () => {
        try {
            setLoading(true);
            const response = await listarPendientes(stage);
            setSolicitudes(response?.data || response || []);
        } catch (error) {
            console.error("Error loading permisos pendientes", error);
            showToast("No pudimos cargar las solicitudes", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSolicitudes();
    }, [stage]);

    const stats = useMemo(() => {
        const total = solicitudes.length;
        const uniqueColabs = new Set(solicitudes.map((s) => s.user_email)).size;
        return { total, uniqueColabs };
    }, [solicitudes]);

    const handleApprove = async (id, finalStage = false) => {
        try {
            if (finalStage) {
                await aprobarPermisoFinal(id);
            } else {
                await aprobarPermisoParcial(id);
            }
            showToast("Solicitud aprobada", "success");
            loadSolicitudes();
        } catch (error) {
            console.error("Error approving permiso", error);
            showToast("No pudimos aprobar la solicitud", "error");
        }
    };

    const handleReject = async (id) => {
        const confirmed = await confirm(
            "¿Rechazar solicitud?",
            "Se notificará al colaborador para que registre nuevamente"
        );
        if (!confirmed) return;
        try {
            await rechazarPermiso(id, "Rechazado desde aprobación");
            showToast("Solicitud rechazada", "success");
            loadSolicitudes();
        } catch (error) {
            console.error("Error rejecting permiso", error);
            showToast("No pudimos rechazar la solicitud", "error");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Aprobación de permisos y vacaciones</h2>
                    <p className="text-sm text-gray-500">
                        Gestiona solicitudes en espera de aprobación parcial o final.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <FiFilter className="text-gray-400" />
                    <select
                        value={stage}
                        onChange={(e) => setStage(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                        {stageFilters.map((f) => (
                            <option key={f.value} value={f.value}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <Card className="p-4 bg-gray-50 border-dashed border-2 border-gray-200">
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                        <FiClock className="text-amber-500" />
                        <span>{stats.total} solicitudes en esta bandeja</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <FiFileText className="text-indigo-500" />
                        <span>{stats.uniqueColabs} colaboradores con solicitudes</span>
                    </div>
                </div>
            </Card>

            <div className="space-y-3">
                {loading && <Card className="p-4 text-sm text-gray-500">Cargando solicitudes...</Card>}
                {!loading && solicitudes.length === 0 && (
                    <Card className="p-4 text-sm text-gray-500">No hay solicitudes en esta etapa.</Card>
                )}
                {solicitudes.map((solicitud) => (
                    <Card key={solicitud.id} className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-gray-900">
                                    {solicitud.user_name || solicitud.user_email}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {solicitud.tipo_solicitud === "vacaciones" ? "Vacaciones" : "Permiso"} · {" "}
                                    {solicitud.tipo_permiso ? permisoLabels[solicitud.tipo_permiso] || solicitud.tipo_permiso : ""}
                                </p>
                                <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                                    <span>
                                        {solicitud.fecha_inicio} → {solicitud.fecha_fin}
                                    </span>
                                    {solicitud.duracion_horas ? (
                                        <span>{solicitud.duracion_horas} h</span>
                                    ) : (
                                        <span>{solicitud.duracion_dias} días</span>
                                    )}
                                    <StatusBadge status={solicitud.status} />
                                </div>
                                {solicitud.justificacion_requerida?.length > 0 && (
                                    <div className="text-xs text-blue-700 bg-blue-50 inline-flex items-center gap-1 px-2 py-1 rounded-md">
                                        <FiFileText />
                                        {solicitud.justificacion_requerida.join(", ")}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {stage === "pending" && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="success"
                                            onClick={() => handleApprove(solicitud.id, false)}
                                            icon={FiCheckCircle}
                                        >
                                            Aprobación parcial
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleReject(solicitud.id)}
                                            icon={FiXCircle}
                                        >
                                            Rechazar
                                        </Button>
                                    </>
                                )}
                                {stage === "pending_final" && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => handleApprove(solicitud.id, true)}
                                            icon={FiCheckCircle}
                                        >
                                            Aprobación final
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleReject(solicitud.id)}
                                            icon={FiXCircle}
                                        >
                                            Rechazar
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const permisoLabels = {
    estudios: "Por estudios",
    personal: "Asuntos personales",
    salud: "Salud",
    calamidad: "Calamidad doméstica",
};

const StatusBadge = ({ status }) => {
    const palette = {
        pending: "bg-amber-100 text-amber-800",
        partially_approved: "bg-indigo-100 text-indigo-800",
        pending_final: "bg-blue-100 text-blue-800",
        approved: "bg-emerald-100 text-emerald-800",
        rejected: "bg-red-100 text-red-800",
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${palette[status] || "bg-gray-100 text-gray-700"}`}>
            {statusLabels[status] || status}
        </span>
    );
};

export default AprobacionPermisosView;
