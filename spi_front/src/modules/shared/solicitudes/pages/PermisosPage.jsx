import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiCalendar, FiCheckSquare, FiFileText, FiGlobe, FiUsers } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import PermisoVacacionModal from "../modals/PermisoVacacionModal";
import { useUI } from "../../../../core/ui/UIContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { getMisSolicitudes, getVacationSummary } from "../../../../core/api/permisosApi";
import { useAuth } from "../../../../core/auth/AuthContext";
import { formatVacationDaysHours } from "../utils/vacationDisplay";
import { calculateInclusiveCalendarDays } from "../utils/solicitudesHelpers";

const PermisosStatusWidget = lazy(() => import("../components/PermisosStatusWidget"));
const PermisosConsolidadoView = lazy(() => import("../components/PermisosConsolidadoView"));
const PermisosGlobalRequestsWidget = lazy(() => import("../components/PermisosGlobalRequestsWidget"));
const PermisosColaboradoresAlbum = lazy(() => import("../components/PermisosColaboradoresAlbum"));
const AprobacionPermisosView = lazy(() => import("../components/AprobacionPermisosView"));

const SECTION_META = {
  mine: {
    title: "Mis solicitudes",
    subtitle: "Personal",
    description: "Gestiona tus propios permisos, vacaciones y subida de justificantes.",
    icon: FiCalendar,
  },
  consolidado: {
    title: "Consolidado",
    subtitle: "Talento Humano · RR.HH. & Finanzas",
    description: "Estado por colaborador con fechas, detalle expandible y exportación a CSV o PDF.",
    icon: FiFileText,
  },
  global: {
    title: "Solicitudes globales",
    subtitle: "Seguimiento",
    description: "Consulta consolidada de solicitudes sin mezclarla con la gestión personal diaria.",
    icon: FiGlobe,
  },
  gerencia_album: {
    title: "Álbum de colaboradores",
    subtitle: "Gerencia",
    description: "Navegación por tarjetas para revisar disponibilidad y detalle por colaborador.",
    icon: FiUsers,
  },
  gerencia_approvals: {
    title: "Aprobaciones",
    subtitle: "Gestión",
    description: "Revisa y gestiona las solicitudes de tu equipo y el historial de aprobados.",
    icon: FiCheckSquare,
  },
};

const SectionLoader = ({ label }) => (
  <Card className="border border-slate-200 shadow-soft">
    <div className="p-8 text-center space-y-2">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: "#2563EB transparent transparent transparent" }} />
      <p className="text-sm font-medium text-slate-700">Cargando {label}...</p>
    </div>
  </Card>
);

const PermisosPage = () => {
 const { showToast } = useUI();
 const { user } = useAuth();
 const location = useLocation();
 const [openModal, setOpenModal] = useState(false);
 const [submitted, setSubmitted] = useState(false);
 const [vacationSummary, setVacationSummary] = useState(null);
 const [vacationRequests, setVacationRequests] = useState([]);
 const [loadingSummary, setLoadingSummary] = useState(false);
 const [activeSection, setActiveSection] = useState("mine");

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
 return calculateInclusiveCalendarDays(req.fecha_inicio, req.fecha_fin);
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
 // eslint-disable-next-line react-hooks/exhaustive-deps
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
 cancelled: 0,
 };
 vacationRequests.forEach((req) => {
 const days = calculateDays(req);
 const status = String(req?.status || "").trim().toLowerCase();
 totals.requested += days;
 if (["approved", "aprobado"].includes(status)) totals.approved += days;
 if (["rejected", "rechazado"].includes(status)) totals.rejected += days;
 if (["cancelled", "cancelado"].includes(status)) totals.cancelled += days;
 });
 return totals;
 }, [vacationRequests]);

 const remainingDays = useMemo(() => {
    if (!vacationSummary) return 0;
    // Use server-computed remaining — includes carry-over, charged permisos, and pending
    return Number(vacationSummary.remaining ?? 0);
  }, [vacationSummary]);
 const remainingVacationDisplay = useMemo(() => formatVacationDaysHours(remainingDays), [remainingDays]);
 const requestedVacationDisplay = useMemo(() => formatVacationDaysHours(vacationStats.requested), [vacationStats.requested]);
 const approvedVacationDisplay = useMemo(() => formatVacationDaysHours(vacationStats.approved), [vacationStats.approved]);
 const rejectedVacationDisplay = useMemo(() => formatVacationDaysHours(vacationStats.rejected), [vacationStats.rejected]);
 const cancelledVacationDisplay = useMemo(() => formatVacationDaysHours(vacationStats.cancelled), [vacationStats.cancelled]);

 const isTalentRole = useMemo(() => {
 const normalizeRole = (value) =>
 String(value || "")
 .trim()
 .toLowerCase()
 .replace(/[\s-]+/g, "_");

 const candidates = [user?.role, user?.scope, user?.role_name].map(normalizeRole);

 return candidates.some((role) =>
      ["talento_humano", "jefe_talento_humano", "jefe_financiero", "jefe_finanzas", "jefe_ti", "admin", "administrador"].includes(role)
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

 const isJefeRole = useMemo(() => {
    const normalize = (val) => String(val || "").trim().toLowerCase();
    const candidates = [user?.role, user?.scope, user?.role_name].map(normalize);
    return candidates.some(
      (c) => c.includes("jefe") || c.includes("gerencia") || c.includes("gerente") || c === "admin"
    );
  }, [user]);

  const availableSections = useMemo(() => {
    const sections = ["mine"]; // Siempre incluir 'mis solicitudes'

    if (isGerenciaGeneral) return ["gerencia_album", "gerencia_approvals"];

    if (isTalentRole) {
      sections.push("consolidado");
      if (!sections.includes("gerencia_approvals")) {
        sections.push("gerencia_approvals");
      }
    }
    if (canViewGlobalRequestsWidget) sections.push("global");

    // Si es jefe o gerencia, permitir ver el widget de aprobaciones
    if (isJefeRole) {
      if (!sections.includes("gerencia_approvals")) {
        sections.push("gerencia_approvals");
      }
    }

    return sections;
  }, [isGerenciaGeneral, isTalentRole, canViewGlobalRequestsWidget, isJefeRole]);
 const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
 const urlTab = searchParams.get("tab");

 useEffect(() => {
 if (activeSection !== "mine" && !availableSections.includes(activeSection)) {
 setActiveSection(availableSections[0] || "mine");
 }
 }, [activeSection, availableSections]);

 useEffect(() => {
 if (!urlTab) return;
 const approvalTabs = new Set(["approve", "cancellation_requests", "study_enrollments", "waiting"]);
 if (approvalTabs.has(urlTab) && availableSections.includes("gerencia_approvals")) {
 setActiveSection("gerencia_approvals");
 } else if (urlTab === "mine" && availableSections.includes("mine")) {
 setActiveSection("mine");
 }
 }, [urlTab, availableSections]);
 const containerClass = isGerenciaGeneral ? "p-4 max-w-7xl mx-auto space-y-4" : "p-6 max-w-7xl mx-auto space-y-6";

  const renderActiveSection = () => {
    switch (activeSection) {
      case "mine":
        return (
          <Suspense fallback={<SectionLoader label="mis solicitudes" />}>
            <PermisosStatusWidget />
          </Suspense>
        );
      case "consolidado":
        return (
          <Suspense fallback={<SectionLoader label="consolidado" />}>
            <PermisosConsolidadoView />
          </Suspense>
        );
      case "global":
        return (
          <Suspense fallback={<SectionLoader label="solicitudes globales" />}>
            <PermisosGlobalRequestsWidget />
          </Suspense>
        );
      case "gerencia_album":
        return (
          <Suspense fallback={<SectionLoader label="álbum de colaboradores" />}>
            <PermisosColaboradoresAlbum compact />
          </Suspense>
        );
      case "gerencia_approvals":
        return (
          <Suspense fallback={<SectionLoader label="aprobaciones" />}>
            <AprobacionPermisosView compact={isGerenciaGeneral} />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<SectionLoader label="mis solicitudes" />}>
            <PermisosStatusWidget />
          </Suspense>
        );
    }
  };

 return (
 <div className={containerClass}>
 <div>
 <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
 Talento Humano
 </p>
 <h1 className="text-xl font-semibold text-slate-900">Permisos y Vacaciones</h1>
 <p className="mt-1 text-sm text-slate-500">
 Gestiona solicitudes, aprobaciones y justificantes en un solo lugar.
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
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
 <Card className={`p-4 border ${remainingDays < 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className={`text-xs font-semibold uppercase ${remainingDays < 0 ? "text-red-700" : "text-emerald-700"}`}>
              {remainingDays < 0 ? "Déficit" : "Disponibles"}
            </p>
            <p className={`text-2xl font-bold ${remainingDays < 0 ? "text-red-800" : "text-emerald-800"}`}>
              {loadingSummary ? "..." : formatVacationDaysHours(Math.abs(remainingDays)).shortText}
            </p>
            <p className={`text-xs ${remainingDays < 0 ? "text-red-700/80" : "text-emerald-700/80"}`}>
              {remainingDays < 0
                ? `−${formatVacationDaysHours(Math.abs(remainingDays)).decimalText}`
                : remainingVacationDisplay.decimalText}
            </p>
          </Card>
 <Card className="p-4 border border-blue-200 bg-blue-50">
 <p className="text-xs font-semibold uppercase text-blue-700">Solicitados</p>
 <p className="text-2xl font-bold text-blue-800">
 {loadingSummary ? "..." : requestedVacationDisplay.shortText}
 </p>
 <p className="text-xs text-blue-700/80">{requestedVacationDisplay.decimalText}</p>
 </Card>
 <Card className="p-4 border border-green-200 bg-green-50">
 <p className="text-xs font-semibold uppercase text-green-700">Aprobados</p>
 <p className="text-2xl font-bold text-green-800">
 {loadingSummary ? "..." : approvedVacationDisplay.shortText}
 </p>
 <p className="text-xs text-green-700/80">{approvedVacationDisplay.decimalText}</p>
 </Card>
 <Card className="p-4 border border-rose-200 bg-rose-50">
 <p className="text-xs font-semibold uppercase text-rose-700">Rechazados</p>
 <p className="text-2xl font-bold text-rose-800">
 {loadingSummary ? "..." : rejectedVacationDisplay.shortText}
 </p>
 <p className="text-xs text-rose-700/80">{rejectedVacationDisplay.decimalText}</p>
 </Card>
 <Card className="p-4 border border-slate-200 bg-slate-50">
 <p className="text-xs font-semibold uppercase text-slate-700">Cancelados</p>
 <p className="text-2xl font-bold text-slate-800">
 {loadingSummary ? "..." : cancelledVacationDisplay.shortText}
 </p>
 <p className="text-xs text-slate-700/80">{cancelledVacationDisplay.decimalText}</p>
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
 vacaciones adelantadas; saldo actual: <strong>{remainingVacationDisplay.text}</strong>.
 </div>
 </Card>
 )}

 {!isGerenciaGeneral &&
 vacationSummary &&
 !loadingSummary &&
 vacationSummary.eligible !== false &&
 remainingDays >= 0 &&
 remainingDays <= 3 && (
 <Card className="border border-amber-200 bg-amber-50">
 <div className="p-4 text-sm text-amber-700">
 Estas cerca de completar tus dias de vacaciones. Te quedan{" "}
 <strong>{formatVacationDaysHours(Math.max(remainingDays, 0)).text}</strong> disponibles.
 </div>
 </Card>
 )}

 {!isGerenciaGeneral && vacationSummary && !loadingSummary && remainingDays < 0 && (
        <Card className="border border-red-300 bg-red-50">
          <div className="p-4 text-sm text-red-800">
            Tu saldo de vacaciones es negativo. Déficit actual:{" "}
            <strong>{formatVacationDaysHours(Math.abs(remainingDays)).text}</strong>. Consulta con Talento Humano
            para regularizar.
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

 <section className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
 {availableSections.map((sectionId) => {
 const meta = SECTION_META[sectionId];
 const Icon = meta.icon;
 const isActive = activeSection === sectionId;

 return (
 <button
 key={sectionId}
 type="button"
 onClick={() => setActiveSection(sectionId)}
 className="text-left rounded-2xl border p-4 transition-colors cursor-pointer"
 style={isActive
 ? { borderColor: "#2563EB", background: "#EFF6FF", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }
 : { borderColor: "#E5E7EB", background: "#FFFFFF" }
 }
 >
 <div className="flex items-start gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
 style={isActive ? { background: "#2563EB", color: "#FFFFFF" } : { background: "#F3F4F6", color: "#6B7280" }}>
 <Icon size={18} />
 </div>
 <div className="min-w-0">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
 {meta.subtitle}
 </p>
 <h3 className="text-sm font-semibold text-slate-900 mt-0.5">
 {meta.title}
 </h3>
 <p className="text-xs text-slate-500 mt-1 leading-relaxed">
 {meta.description}
 </p>
 </div>
 </div>
 </button>
 );
 })}
 </div>

 {renderActiveSection()}
 </section>

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

