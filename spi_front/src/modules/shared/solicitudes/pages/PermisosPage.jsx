import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheckSquare, FiGlobe, FiUsers } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import PermisoVacacionModal from "../modals/PermisoVacacionModal";
import { useUI } from "../../../../core/ui/UIContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { getMisSolicitudes, getVacationSummary } from "../../../../core/api/permisosApi";
import { useAuth } from "../../../../core/auth/AuthContext";
import { formatVacationDaysHours } from "../utils/vacationDisplay";

const PermisosStatusWidget = lazy(() => import("../components/PermisosStatusWidget"));
const PermisosColaboradoresWidget = lazy(() => import("../components/PermisosColaboradoresWidget"));
const PermisosGlobalRequestsWidget = lazy(() => import("../components/PermisosGlobalRequestsWidget"));
const PermisosColaboradoresAlbum = lazy(() => import("../components/PermisosColaboradoresAlbum"));
const AprobacionPermisosView = lazy(() => import("../components/AprobacionPermisosView"));

const SECTION_META = {
 collaborators: {
 title: "Colaboradores",
 subtitle: "Talento Humano",
 description: "Resumen por colaborador con carga independiente para no saturar la página principal.",
 icon: FiUsers,
 tone: "emerald",
 },
 global: {
 title: "Solicitudes globales",
 subtitle: "Seguimiento",
 description: "Consulta consolidada de solicitudes sin mezclarla con la gestión personal diaria.",
 icon: FiGlobe,
 tone: "amber",
 },
 gerencia_album: {
 title: "Álbum de colaboradores",
 subtitle: "Gerencia",
 description: "Navegación por tarjetas para revisar disponibilidad y detalle por colaborador.",
 icon: FiUsers,
 tone: "indigo",
 },
 gerencia_approvals: {
 title: "Aprobaciones",
 subtitle: "Gerencia",
 description: "Pendientes finales en una vista separada para evitar sobrecarga visual.",
 icon: FiCheckSquare,
 tone: "rose",
 },
};

const SECTION_TONES = {
 blue: {
 selected: "border-blue-500 bg-blue-50 shadow-blue-100",
 idle: "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
 icon: "bg-blue-600 text-white",
 subtitle: "text-blue-700",
 },
 emerald: {
 selected: "border-emerald-500 bg-emerald-50 shadow-emerald-100",
 idle: "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50",
 icon: "bg-emerald-600 text-white",
 subtitle: "text-emerald-700",
 },
 amber: {
 selected: "border-amber-500 bg-amber-50 shadow-amber-100",
 idle: "border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50",
 icon: "bg-amber-500 text-white",
 subtitle: "text-amber-700",
 },
 indigo: {
 selected: "border-indigo-500 bg-indigo-50 shadow-indigo-100",
 idle: "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50",
 icon: "bg-indigo-600 text-white",
 subtitle: "text-indigo-700",
 },
 rose: {
 selected: "border-rose-500 bg-rose-50 shadow-rose-100",
 idle: "border-gray-200 bg-white hover:border-rose-300 hover:bg-rose-50/50",
 icon: "bg-rose-600 text-white",
 subtitle: "text-rose-700",
 },
};

const SectionLoader = ({ label }) => (
 <Card className="border border-gray-200 shadow-sm">
 <div className="p-8 text-center space-y-2">
 <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
 <p className="text-sm font-medium text-gray-700">Cargando {label}...</p>
 <p className="text-xs text-gray-500">
 Se monta solo la vista activa para reducir carga visual y tiempo de refresco.
 </p>
 </div>
 </Card>
);

const PermisosPage = () => {
 const { showToast } = useUI();
 const { user } = useAuth();
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
 const allowance = Number(vacationSummary.allowance || 0);
 if (vacationSummary.eligible === false && !vacationSummary.missing_hire_date) {
 return allowance - vacationStats.requested;
 }
 return Math.max(0, allowance - vacationStats.approved);
 }, [vacationSummary, vacationStats.approved, vacationStats.requested]);
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

 const availableSections = useMemo(() => {
 if (isGerenciaGeneral) return ["gerencia_album", "gerencia_approvals"];

 const sections = [];
 if (isTalentRole) sections.push("collaborators");
 if (canViewGlobalRequestsWidget) sections.push("global");
 return sections;
 }, [isGerenciaGeneral, isTalentRole, canViewGlobalRequestsWidget]);

 useEffect(() => {
 if (activeSection !== "mine" && !availableSections.includes(activeSection)) {
 setActiveSection(availableSections[0] || "mine");
 }
 }, [activeSection, availableSections]);
 const containerClass = isGerenciaGeneral ? "p-4 max-w-7xl mx-auto space-y-4" : "p-6 max-w-7xl mx-auto space-y-6";

 const renderActiveSection = () => {
 switch (activeSection) {
 case "mine":
 return (
 <Suspense fallback={<SectionLoader label="mis solicitudes" />}>
 <PermisosStatusWidget />
 </Suspense>
 );
 case "collaborators":
 return (
 <Suspense fallback={<SectionLoader label="colaboradores" />}>
 <PermisosColaboradoresWidget />
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
 <AprobacionPermisosView compact />
 </Suspense>
 );
 default:
 return null;
 }
 };

 return (
 <div className={containerClass}>
 <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
 <h1 className="text-2xl font-bold">Permisos y Vacaciones</h1>
 <p className="text-sm opacity-90 mt-1">
 Gestiona solicitudes, aprobaciones y justificantes sin cargar todas las vistas al mismo tiempo.
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
 <Card className="p-4 border border-emerald-200 bg-emerald-50">
 <p className="text-xs font-semibold uppercase text-emerald-700">Disponibles</p>
 <p className="text-2xl font-bold text-emerald-800">
 {loadingSummary ? "..." : remainingVacationDisplay.shortText}
 </p>
 <p className="text-xs text-emerald-700/80">{remainingVacationDisplay.decimalText}</p>
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
 remainingDays <= 3 && (
 <Card className="border border-amber-200 bg-amber-50">
 <div className="p-4 text-sm text-amber-700">
 Estas cerca de completar tus dias de vacaciones. Te quedan{" "}
 <strong>{formatVacationDaysHours(Math.max(remainingDays, 0)).text}</strong> disponibles.
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
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
 {availableSections.map((sectionId) => {
 const meta = SECTION_META[sectionId];
 const tone = SECTION_TONES[meta.tone] || SECTION_TONES.blue;
 const Icon = meta.icon;
 const isActive = activeSection === sectionId;

 return (
 <button
 key={sectionId}
 type="button"
 onClick={() => setActiveSection(sectionId)}
 className={`text-left rounded-2xl border p-4 shadow-sm transition-all ${isActive ? tone.selected : tone.idle}`}
 >
 <div className="flex items-start gap-3">
 <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${tone.icon}`}>
 <Icon size={20} />
 </div>
 <div className="min-w-0">
 <p className={`text-[11px] font-bold uppercase tracking-wider ${tone.subtitle}`}>
 {meta.subtitle}
 </p>
 <h3 className="text-base font-semibold text-gray-900 mt-1">
 {meta.title}
 </h3>
 <p className="text-sm text-gray-500 mt-2 leading-relaxed">
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

