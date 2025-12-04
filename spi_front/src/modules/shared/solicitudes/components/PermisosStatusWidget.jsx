import React, { useEffect, useMemo, useState } from "react";
import { FiClock, FiFileText } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/AuthContext";
import { listarMisPermisos, listarPendientes } from "../../../../core/api/permisosApi";

const STATUS_LABELS = {
    pending: "Pendiente (aprobación parcial)",
    partially_approved: "Aprobado parcialmente",
    pending_final: "Pendiente aprobación final",
    approved: "Aprobado",
    rejected: "Rechazado",
};

const PermisosStatusWidget = () => {
    const { user } = useAuth();
    const { showToast } = useUI();
    const role = (user?.role || "").toLowerCase();
    const [mine, setMine] = useState({ data: [], summary: { status: {}, total: 0 } });
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const isApprover = useMemo(
        () => ["jefe_comercial", "jefe_tecnico", "gerencia", "gerente", "administrador", "admin"].includes(role),
        [role]
    );

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const own = await listarMisPermisos();
                setMine({ data: own?.data || [], summary: own?.summary || { status: {}, total: 0 } });
                if (isApprover) {
                    const stage = role === "gerencia" ? "pending_final" : "pending";
                    const pendingResp = await listarPendientes(stage);
                    setPending(pendingResp?.data || pendingResp || []);
                } else {
                    setPending([]);
                }
            } catch (error) {
                console.error("Error loading permiso widgets", error);
                showToast("No pudimos cargar el estado de tus solicitudes", "error");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isApprover, role, showToast]);

    const latest = (mine.data || []).slice(0, 3);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 col-span-1 lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Mis permisos y vacaciones</h3>
                        <p className="text-xs text-gray-500">Revisa el estado de tus solicitudes recientes.</p>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                        {mine.summary?.total || 0} en total
                    </span>
                </div>

                {loading && <p className="text-sm text-gray-500">Cargando...</p>}
                {!loading && latest.length === 0 && (
                    <p className="text-sm text-gray-500">Aún no registras solicitudes.</p>
                )}

                <div className="space-y-3">
                    {latest.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">
                                    {item.tipo_solicitud === "vacaciones" ? "Vacaciones" : "Permiso"}
                                </p>
                                <p className="text-xs text-gray-600">
                                    {item.fecha_inicio} → {item.fecha_fin} · {item.duracion_horas ? `${item.duracion_horas}h` : `${item.duracion_dias} días`}
                                </p>
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-1">
                                    <FiFileText />
                                    {STATUS_LABELS[item.status] || item.status}
                                </span>
                            </div>
                            <StatusPill status={item.status} />
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">
                            {isApprover ? "Bandeja de aprobación" : "Resumen"}
                        </h3>
                        <p className="text-xs text-gray-500">
                            {isApprover
                                ? "Solicitudes que requieren tu aprobación"
                                : "Conteo rápido de tus solicitudes"}
                        </p>
                    </div>
                </div>

                {isApprover ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FiClock className="text-amber-500" />
                            <span>{pending.length} pendientes</span>
                        </div>
                        <Button
                            size="sm"
                            variant="primary"
                            href="/dashboard/solicitudes#permisos-aprobacion"
                        >
                            Abrir aprobación
                        </Button>
                        <p className="text-xs text-gray-500">
                            {role === "gerencia"
                                ? "Gerencia general puede aprobar todas las solicitudes"
                                : "Solo las solicitudes asignadas a tu rol"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {Object.entries({
                            pending: "Pendiente",
                            partially_approved: "Parcial",
                            pending_final: "Final",
                            approved: "Aprobado",
                            rejected: "Rechazado",
                        }).map(([status, label]) => (
                            <div key={status} className="rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {mine.summary?.status?.[status] || 0}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

const StatusPill = ({ status }) => {
    const palette = {
        pending: "bg-amber-100 text-amber-800",
        partially_approved: "bg-indigo-100 text-indigo-800",
        pending_final: "bg-blue-100 text-blue-800",
        approved: "bg-green-100 text-green-800",
        rejected: "bg-red-100 text-red-800",
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${palette[status] || "bg-gray-100 text-gray-700"}`}>
            {STATUS_LABELS[status] || status || "—"}
        </span>
    );
};

export default PermisosStatusWidget;
