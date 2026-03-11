import React, { useEffect, useMemo, useState } from "react";
import PermisosStatusWidget from "../components/PermisosStatusWidget";
import PermisosColaboradoresWidget from "../components/PermisosColaboradoresWidget";
import PermisosGlobalRequestsWidget from "../components/PermisosGlobalRequestsWidget";
import PermisosColaboradoresAlbum from "../components/PermisosColaboradoresAlbum";
import { FiCalendar } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import PermisoVacacionModal from "../modals/PermisoVacacionModal";
import { AprobacionPermisosView } from "..";
import { useUI } from "../../../../core/ui/UIContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { getMisSolicitudes, getVacationSummary } from "../../../../core/api/permisosApi";
import { useAuth } from "../../../../core/auth/AuthContext";

const PermisosPage = () => {
    const { showToast } = useUI();
    const { user } = useAuth();
    const [openModal, setOpenModal] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [vacationSummary, setVacationSummary] = useState(null);
    const [vacationRequests, setVacationRequests] = useState([]);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const isGerenciaGeneral = useMemo(() => {
        const normalizeRole = (value) =>
            String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_");
        const candidates = [user?.role, user?.scope, user?.role_name].map(normalizeRole);
        return candidates.includes("gerencia_general");
    }, [user]);

    const handleSuccess = () => {
        setSubmitted(true);
    };

    const calculateDays = (req) => {
        if (req?.duracion_dias) return Number(req.duracion_dias) || 0;
        if (!req?.fecha_inicio || !req?.fecha_fin) return 0;
        const start = new Date(req.fecha_inicio);
        const end = new Date(req.fecha_fin);
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        return diff >= 0 ? diff + 1 : 0;
    };

    const loadSummary = async ({ silent = false } = {}) => {
        if (isGerenciaGeneral) return;

        if (!silent) setLoadingSummary(true);
        try {
            const [mineResp, summaryResp] = await Promise.all([
                getMisSolicitudes(),
                getVacationSummary(),
            ]);
            if (mineResp?.ok) {
                const onlyVacations = (mineResp.data || []).filter(
                    (req) => req.tipo_solicitud === "vacaciones",
                );
                setVacationRequests(onlyVacations);
            }
            if (summaryResp?.ok) {
                setVacationSummary(summaryResp.data || null);
            }
        } catch (error) {
            console.error("Error loading vacation summary:", error);
            showToast("No se pudo cargar el resumen de vacaciones", "warning");
        } finally {
            if (!silent) setLoadingSummary(false);
        }
    };

    useEffect(() => {
        loadSummary();
    }, [isGerenciaGeneral]);

    useScopedAutoUpdate(
        [DATA_UPDATE_SCOPES.PERMISOS, DATA_UPDATE_SCOPES.VACACIONES],
        () => {
            loadSummary({ silent: true });
        },
        [isGerenciaGeneral],
    );

    const vacationStats = useMemo(() => {
        const totals = {
            requested: 0,
            approved: 0,
            rejected: 0,
        };
        vacationRequests.forEach((req) => {
            const days = calculateDays(req);
            totals.requested += days;
            if (req.status === "approved") totals.approved += days;
            if (req.status === "rejected") totals.rejected += days;
        });
        return totals;
    }, [vacationRequests]);

    const remainingDays = useMemo(() => {
        if (!vacationSummary) return 0;
        const allowance = Number(vacationSummary.allowance || 0);
        if (vacationSummary.eligible === false && !vacationSummary.missing_hire_date) {
            return allowance - vacationStats.requested;
        }
        return Math.max(0, allowance - vacationStats.approved);
    }, [vacationSummary, vacationStats.approved, vacationStats.requested]);

    const isTalentRole = useMemo(() => {
        const normalizeRole = (value) =>
            String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_");

        const candidates = [
            user?.role,
            user?.scope,
            user?.role_name,
        ].map(normalizeRole);

        return candidates.some((role) =>
            ["talento_humano", "jefe_talento_humano", "jefe_financiero", "jefe_finanzas", "jefe_ti"].includes(role)
        );
    }, [user]);

    const canViewGlobalRequestsWidget = useMemo(() => {
        const normalizeRole = (value) =>
            String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_");

        const candidates = [user?.role, user?.scope, user?.role_name].map(normalizeRole);
        return candidates.some((role) => ["jefe_ti", "jefe_financiero"].includes(role));
    }, [user]);

    const containerClass = isGerenciaGeneral ? "p-4 max-w-7xl mx-auto space-y-4" : "p-6 max-w-7xl mx-auto space-y-6";

    return (
        <div className={containerClass}>
            {/* Header */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
                <h1 className="text-2xl font-bold">
                    Permisos y Vacaciones
                </h1>
                <p className="text-sm opacity-90 mt-1">
                    Gestiona solicitudes, aprobaciones y justificantes en un solo flujo.
                </p>
            </div>

            {!isGerenciaGeneral && (
                <Card className="border border-gray-200 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                                <FiCalendar size={20} />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-gray-900">
                                    Solicita un permiso o vacaciones
                                </p>
                                <p className="text-sm text-gray-500">
                                    Abre el flujo guiado y completa tu solicitud en unos pasos.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => setOpenModal(true)}
                            className="ml-auto"
                        >
                            {submitted ? "Crear otra solicitud" : "Nueva solicitud"}
                        </Button>
                    </div>
                </Card>
            )}

            {!isGerenciaGeneral && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 border border-emerald-200 bg-emerald-50">
                        <p className="text-xs font-semibold uppercase text-emerald-700">Disponibles</p>
                        <p className="text-2xl font-bold text-emerald-800">
                            {loadingSummary ? "..." : remainingDays}
                        </p>
                        <p className="text-xs text-emerald-700/80">Dias restantes</p>
                    </Card>
                    <Card className="p-4 border border-blue-200 bg-blue-50">
                        <p className="text-xs font-semibold uppercase text-blue-700">Solicitados</p>
                        <p className="text-2xl font-bold text-blue-800">
                            {loadingSummary ? "..." : vacationStats.requested}
                        </p>
                        <p className="text-xs text-blue-700/80">Dias solicitados</p>
                    </Card>
                    <Card className="p-4 border border-green-200 bg-green-50">
                        <p className="text-xs font-semibold uppercase text-green-700">Aprobados</p>
                        <p className="text-2xl font-bold text-green-800">
                            {loadingSummary ? "..." : vacationStats.approved}
                        </p>
                        <p className="text-xs text-green-700/80">Dias aprobados</p>
                    </Card>
                    <Card className="p-4 border border-rose-200 bg-rose-50">
                        <p className="text-xs font-semibold uppercase text-rose-700">Rechazados</p>
                        <p className="text-2xl font-bold text-rose-800">
                            {loadingSummary ? "..." : vacationStats.rejected}
                        </p>
                        <p className="text-xs text-rose-700/80">Dias rechazados</p>
                    </Card>
                </div>
            )}

            {!isGerenciaGeneral &&
                vacationSummary &&
                !loadingSummary &&
                vacationSummary.eligible === false &&
                !vacationSummary.missing_hire_date && (
                <Card className="border border-blue-200 bg-blue-50">
                    <div className="p-4 text-sm text-blue-700">
                        Aun no cumples un año de trabajo. Tus dias de vacaciones se acreditaran desde{" "}
                        <strong>{vacationSummary.eligible_from || "la fecha de aniversario"}</strong>. Puedes solicitar
                        vacaciones adelantadas; saldo actual: <strong>{remainingDays}</strong> dias.
                    </div>
                </Card>
            )}

            {!isGerenciaGeneral &&
                vacationSummary &&
                !loadingSummary &&
                vacationSummary.eligible !== false &&
                remainingDays <= 3 && (
                <Card className="border border-amber-200 bg-amber-50">
                    <div className="p-4 text-sm text-amber-700">
                        Estas cerca de completar tus dias de vacaciones. Te quedan{" "}
                        <strong>{Math.max(remainingDays, 0)}</strong> dias disponibles.
                    </div>
                </Card>
            )}

            {!isGerenciaGeneral && vacationSummary?.missing_hire_date && (
                <Card className="border border-amber-200 bg-amber-50">
                    <div className="p-4 text-sm text-amber-700">
                        Falta registrar la <strong>fecha de ingreso</strong> en el perfil del colaborador.
                        Talento humano debe completarla para calcular correctamente las vacaciones.
                    </div>
                </Card>
            )}

            {isGerenciaGeneral ? (
                <>
                    <PermisosColaboradoresAlbum compact />
                    <AprobacionPermisosView compact />
                </>
            ) : (
                <PermisosStatusWidget />
            )}

            {!isGerenciaGeneral && isTalentRole && <PermisosColaboradoresWidget />}
            {!isGerenciaGeneral && canViewGlobalRequestsWidget && <PermisosGlobalRequestsWidget />}

            {!isGerenciaGeneral && (
                <PermisoVacacionModal
                    open={openModal}
                    onClose={() => setOpenModal(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

export default PermisosPage;
