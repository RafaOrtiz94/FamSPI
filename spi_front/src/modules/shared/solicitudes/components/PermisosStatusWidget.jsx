import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FiClock,
  FiFileText,
  FiDownload,
  FiAlertCircle,
  FiUpload,
  FiEye,
  FiShield,
} from "react-icons/fi";
import { motion } from "framer-motion";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/AuthContext";
import {
  STATUS_META,
  getTipoLabel,
  formatDateShort,
  hasJustificantes,
  hasExternalCoordinationEvidence,
  JUSTIFICANTE_STATUS_META,
  ESCALATION_STATUS_META,
  PROVISIONAL_STATUS_META,
} from "../utils/solicitudesHelpers";
import { formatVacationDaysHours } from "../utils/vacationDisplay";
import {
  getMisSolicitudes,
  cancelarSolicitud,
  updateRecoveryPlan,
  resolverRegularizacion,
} from "../../../../core/api/permisosApi";
import UploadJustificantesModal from "../modals/UploadJustificantesModal";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";

const normalizeRole = (value = "") => value.toLowerCase();

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
};

const formatTimeRange = (solicitud = {}) => {
  const start = solicitud?.fecha_inicio_hora || solicitud?.start_time || null;
  const end = solicitud?.fecha_fin_hora || solicitud?.end_time || null;
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const startLabel = startDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
  const endLabel = endDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${startLabel} - ${endLabel}`;
};

const getVacationShiftLabel = (solicitud = {}) => {
  const start = solicitud?.start_time || solicitud?.fecha_inicio_hora || null;
  const end = solicitud?.end_time || solicitud?.fecha_fin_hora || null;
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const startHour = startDate.getHours();
  const endAsDecimal = endDate.getHours() + endDate.getMinutes() / 60;
  if (startHour < 13 && endAsDecimal <= 13) return "Mañana";
  if (startHour >= 13) return "Tarde";
  return "Horario mixto";
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const text = String(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};




const isSameEmail = (a, b) =>
  String(a || "").trim().toLowerCase() !== "" &&
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

const NON_CANCELABLE_STATUSES = new Set(["rejected", "rechazado", "cancelled", "cancelado"]);

const RECOVERY_COORDINATION_LABELS = {
  not_required: "No requiere coordinación",
  pending_approver_proposal: "Pendiente propuesta del jefe inmediato",
  pending_requester_acceptance: "Pendiente aceptación del solicitante",
  agreed: "Coordinación aprobada y cerrada",
  finalized_by_approver: "Tramos definidos por jefe inmediato",
};

const INITIAL_VISIBLE_COUNTS = {
  mine: 8,
  upload_docs: 6,
};

const getRecoveryCoordinationLabel = (solicitud = {}) => {
  const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
  if (coordinationStatus === "finalized_by_approver" && solicitud?.charged_to_vacation) {
    return "Sin acuerdo; cierre administrativo";
  }
  return RECOVERY_COORDINATION_LABELS[coordinationStatus] || RECOVERY_COORDINATION_LABELS.not_required;
};

const addDaysToDateOnly = (value, days = 0) => {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  if (!year || !month || !day) return null;
  const base = new Date(year, month - 1, day);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + Number(days || 0));
  const outYear = base.getFullYear();
  const outMonth = String(base.getMonth() + 1).padStart(2, "0");
  const outDay = String(base.getDate()).padStart(2, "0");
  return `${outYear}-${outMonth}-${outDay}`;
};

const getRecoveryCoordinationDeadline = (solicitud = {}) => {
  const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
  if (!["pending_approver_proposal", "pending_requester_acceptance"].includes(coordinationStatus)) {
    return null;
  }
  return addDaysToDateOnly(solicitud?.fecha_inicio || solicitud?.fecha_inicio_hora, 3);
};

const estimateRequestedHoursFromSolicitud = (solicitud = {}) => {
  const hours = Number(solicitud?.duracion_horas || 0);
  if (Number.isFinite(hours) && hours > 0) return hours;
  const days = Number(solicitud?.duracion_dias || 0);
  if (Number.isFinite(days) && days > 0) return Math.round(((days * 8) + Number.EPSILON) * 100) / 100;
  return 0;
};

const PermisosStatusWidget = () => {
  const { user } = useAuth();
  const { showToast, showLoader, hideLoader } = useUI();
  const role = normalizeRole(user?.role || user?.rol);
  const scope = normalizeRole(user?.scope || role);
  const userEmail = user?.email || "";
  const userId = user?.id;
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlTab = searchParams.get("tab");
  const urlSolicitudId = searchParams.get("solicitudId");
  const urlOpenRecovery = searchParams.get("openRecovery");

  const [activeTab, setActiveTab] = useState("mine");
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [visibleItemsBySection, setVisibleItemsBySection] = useState(INITIAL_VISIBLE_COUNTS);
  const [recoveryRows, setRecoveryRows] = useState([]);
  const [recoveryModalAction, setRecoveryModalAction] = useState("propose");
  const [regularizacionModal, setRegularizacionModal] = useState({ open: false, solicitudId: null, action: null });
  const [regularizacionReason, setRegularizacionReason] = useState("");
  const refreshPromiseRef = useRef(null);

  const isTalentRole = ["talento_humano", "jefe_talento_humano", "talento-humano", "gerencia_general", "gerente_general", "gerencia", "gerente", "director", "admin", "administrador"].includes(scope);

  const normalizeDateValue = (value) => {
    if (!value) return null;
    if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
      return value;
    }
    if (typeof value === "object") {
      return value.value || value.date || value.timestamp || value.time || value.iso || null;
    }
    return value;
  };

  const normalizeTimeText = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (!match) return "";
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  const computeRecoveryHours = (startTime, endTime) => {
    const start = normalizeTimeText(startTime);
    const end = normalizeTimeText(endTime);
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) return "";
    return String(Math.round(((diff / 60) + Number.EPSILON) * 100) / 100);
  };

  const normalizeSolicitudDates = (solicitud) => ({
    ...solicitud,
    fecha_inicio: normalizeDateValue(solicitud?.fecha_inicio),
    fecha_fin: normalizeDateValue(solicitud?.fecha_fin),
    cancellation_requested_at: normalizeDateValue(solicitud?.cancellation_requested_at),
    recovery_plan_updated_at: normalizeDateValue(solicitud?.recovery_plan_updated_at),
    aprobacion_parcial_at: normalizeDateValue(solicitud?.aprobacion_parcial_at),
    aprobacion_final_at: normalizeDateValue(solicitud?.aprobacion_final_at),
    created_at: normalizeDateValue(solicitud?.created_at),
    updated_at: normalizeDateValue(solicitud?.updated_at),
  });

  const canCoordinateRecoveryByStatus = (solicitud) =>
    ["partially_approved", "pending_final", "approved", "aprobado"].includes(
      String(solicitud?.status || "").toLowerCase()
    );

  const loadData = async ({ silent = false } = {}) => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      if (!silent) setLoading(true);
      try {
        const mineResp = await getMisSolicitudes();
        if (mineResp?.ok) {
          setMisSolicitudes((mineResp.data || []).map(normalizeSolicitudDates));
        }
      } catch (error) {
        console.error("Error loading permisos:", error);
        if (!silent) showToast("Error al cargar solicitudes", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    })();

    refreshPromiseRef.current = promise;
    try {
      await promise;
    } finally {
      refreshPromiseRef.current = null;
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, scope]);

  useScopedAutoUpdate(
    [DATA_UPDATE_SCOPES.PERMISOS, DATA_UPDATE_SCOPES.VACACIONES],
    () => {
      loadData({ silent: true });
    },
  );

  const runActionWithLoader = async (loadingKey, message, action) => {
    setActionLoading(loadingKey);
    showLoader(message);
    try {
      return await action();
    } finally {
      hideLoader();
      setActionLoading(null);
    }
  };

  const handleUploadSuccess = async () => {
    showToast("Documentos subidos correctamente", "success");
    setShowUploadModal(false);
    setSelectedSolicitud(null);
    await loadData();
  };

  const handleCancelar = async () => {
    if (!selectedSolicitud || !cancelReason.trim()) {
      showToast("Debes indicar el motivo de cancelación", "warning");
      return;
    }
    await runActionWithLoader(selectedSolicitud.id, "Cancelando solicitud...", async () => {
      try {
        const response = await cancelarSolicitud(selectedSolicitud.id, cancelReason.trim());
        if (response?.ok) {
          showToast("Solicitud cancelada", "success");
          setShowCancelModal(false);
          setSelectedSolicitud(null);
          setCancelReason("");
          await loadData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al cancelar la solicitud", "error");
      }
    });
  };

  const openRecoveryEditor = (solicitud, action = "propose") => {
    const currentPlan = Array.isArray(solicitud?.recovery_plan) ? solicitud.recovery_plan : [];
    setSelectedSolicitud(solicitud);
    setRecoveryModalAction(action);
    // log_progress always starts with a blank row to enter new execution entries
    setRecoveryRows(
      action === "log_progress"
        ? [{ date: "", start_time: "", end_time: "", notes: "" }]
        : currentPlan.length > 0
          ? currentPlan.map((row) => ({
            date: String(row?.date || ""),
            start_time: normalizeTimeText(row?.start_time),
            end_time: normalizeTimeText(row?.end_time),
            notes: String(row?.notes || ""),
          }))
          : [{ date: "", start_time: "", end_time: "", notes: "" }]
    );
    setShowRecoveryModal(true);
  };

  const handleCloseRecovery = async (solicitudId) => {
    await runActionWithLoader(`close-recovery-${solicitudId}`, "Confirmando recuperación completada...", async () => {
      try {
        const response = await updateRecoveryPlan(solicitudId, [], "close");
        if (response?.ok) {
          showToast("Recuperación marcada como completada", "success");
          await loadData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al cerrar la recuperación", "error");
      }
    });
  };

  const openRegularizacionModal = (solicitudId, action) => {
    setRegularizacionReason("");
    setRegularizacionModal({ open: true, solicitudId, action });
  };

  const handleConfirmRegularizacion = async () => {
    const { solicitudId, action } = regularizacionModal;
    if (!solicitudId || !action) return;
    if (!regularizacionReason.trim()) {
      showToast("Debes ingresar un motivo para continuar.", "error");
      return;
    }
    await runActionWithLoader(`regularizacion-${solicitudId}`, "Procesando regularización...", async () => {
      try {
        const response = await resolverRegularizacion(solicitudId, action, regularizacionReason.trim());
        if (response?.ok) {
          showToast("Regularización procesada correctamente.", "success");
          setRegularizacionModal({ open: false, solicitudId: null, action: null });
          await loadData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al procesar la regularización", "error");
      }
    });
  };

  const handleSaveRecoveryPlan = async (action = "propose") => {
    if (!selectedSolicitud) return;
    const normalizedPlan = recoveryRows
      .map((row) => {
        const date = String(row?.date || "");
        const start_time = normalizeTimeText(row?.start_time);
        const end_time = normalizeTimeText(row?.end_time);
        const notes = String(row?.notes || "").trim();
        const hours = Number(computeRecoveryHours(start_time, end_time) || 0);
        return { date, start_time, end_time, notes, hours };
      })
      .filter((row) => row.date && row.start_time && row.end_time && row.hours > 0)
      .map((row) => ({
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        notes: row.notes || null,
      }));

    if (normalizedPlan.length === 0) {
      showToast("Debes registrar al menos un tramo válido de recuperación", "warning");
      return;
    }

    const recoveryMessage =
      action === "accept"
        ? "Aprobando plan de recuperación..."
        : action === "finalize"
          ? "Definiendo plan de recuperación..."
          : "Actualizando plan de recuperación...";

    await runActionWithLoader(`recovery-${selectedSolicitud.id}`, recoveryMessage, async () => {
      try {
        const response = await updateRecoveryPlan(selectedSolicitud.id, normalizedPlan, action);
        if (response?.ok) {
          showToast(
            action === "accept"
              ? "Plan de recuperación aprobado"
              : action === "finalize"
                ? "Plan de recuperación definido de forma definitiva"
                : "Plan de recuperación actualizado",
            "success"
          );
          setShowRecoveryModal(false);
          setSelectedSolicitud(null);
          setRecoveryRows([]);
          await loadData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error actualizando plan de recuperación", "error");
      }
    });
  };

  const requestedRecoveryHours = estimateRequestedHoursFromSolicitud(selectedSolicitud || {});
  const plannedRecoveryHours =
    Math.round(
      (recoveryRows.reduce((acc, row) => acc + Number(computeRecoveryHours(row.start_time, row.end_time) || 0), 0) +
        Number.EPSILON) *
      100
    ) / 100;
  const isRecoveryPlanComplete = requestedRecoveryHours > 0 && plannedRecoveryHours >= requestedRecoveryHours;
  const selectedRecoveryStatus = String(selectedSolicitud?.recovery_coordination_status || "").toLowerCase();
  const isSelectedRequester =
    Boolean(selectedSolicitud) &&
    ((userId && selectedSolicitud?.user_id && Number(userId) === Number(selectedSolicitud.user_id)) ||
      isSameEmail(userEmail, selectedSolicitud?.user_email));

  const canSelectedRequesterCounterPropose =
    selectedRecoveryStatus === "pending_requester_acceptance" &&
    isSelectedRequester;
  const selectedRequiresCancellationRequestFlow = false;

  const pendientesDeJustificante = useMemo(
    () =>
      misSolicitudes.filter(
        (sol) => {
          const status = String(sol?.status || "").toLowerCase();
          const tipoPermiso = String(sol?.tipo_permiso || "").toLowerCase();
          const hasRequiredDocs =
            Array.isArray(sol?.justificacion_requerida) && sol.justificacion_requerida.length > 0;
          if (!hasRequiredDocs) return false;

          if (status === "partially_approved" || status === "pending_final") return true;
          if (["pending", "pendiente"].includes(status) && tipoPermiso === "salud") return true;
          return false;
        }
      ),
    [misSolicitudes]
  );

  const tabs = useMemo(() => {
    return [
      { id: "mine", label: "Mis solicitudes", count: misSolicitudes.length, visible: true },
    ];
  }, [misSolicitudes.length]);

  useEffect(() => {
    if (urlTab && tabs.some((t) => t.id === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab, tabs]);

  useEffect(() => {
    if (!urlSolicitudId) return;
    const target = misSolicitudes.find((s) => String(s?.id) === String(urlSolicitudId));
    if (target) {
      if (String(selectedSolicitud?.id || "") !== String(target?.id || "")) {
        setSelectedSolicitud(target);
      }
      if (urlOpenRecovery === "true" && !showRecoveryModal) {
        const initialRows = Array.isArray(target.recovery_plan)
          ? target.recovery_plan.map((r) => ({ ...r }))
          : [];
        setRecoveryRows(initialRows);
        setShowRecoveryModal(true);
      }
    }
  }, [
    urlSolicitudId,
    urlOpenRecovery,
    misSolicitudes,
    selectedSolicitud?.id,
    showRecoveryModal,
  ]);

  useEffect(() => {
    if (location.search && (urlTab || urlSolicitudId || urlOpenRecovery)) {
      const timer = setTimeout(() => {
        window.history.replaceState(null, "", location.pathname);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id || "mine");
    }
  }, [activeTab, tabs]);

  const getVisibleCountForSection = (section) =>
    visibleItemsBySection[section] || INITIAL_VISIBLE_COUNTS[section] || 0;

  const showMoreItems = (section, total) => {
    setVisibleItemsBySection((current) => {
      const currentVisible = current[section] || INITIAL_VISIBLE_COUNTS[section] || 0;
      const step = INITIAL_VISIBLE_COUNTS[section] || 6;
      return {
        ...current,
        [section]: Math.min(total, currentVisible + step),
      };
    });
  };

  const showLessItems = (section) => {
    setVisibleItemsBySection((current) => ({
      ...current,
      [section]: INITIAL_VISIBLE_COUNTS[section] || current[section] || 0,
    }));
  };

  const renderListControls = (section, total) => {
    const initial = INITIAL_VISIBLE_COUNTS[section] || total;
    const visible = Math.min(getVisibleCountForSection(section), total);
    if (total <= initial) return null;
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-gray-600">
          Mostrando <span className="font-semibold text-gray-900">{visible}</span> de{" "}
          <span className="font-semibold text-gray-900">{total}</span> registros
        </p>
        <div className="flex gap-2">
          {visible < total && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => showMoreItems(section, total)}
              className="text-xs"
            >
              Ver más
            </Button>
          )}
          {visible > initial && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => showLessItems(section)}
              className="text-xs"
            >
              Mostrar menos
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSolicitudCard = (solicitud) => {
    const recoveryPlan = Array.isArray(solicitud?.recovery_plan) ? solicitud.recovery_plan : [];
    const recoveryTotal = Number(solicitud?.recovery_plan_total_hours || 0);
    const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
    const isCoordinationEnabled = canCoordinateRecoveryByStatus(solicitud);
    const recoveryCoordinationDeadline = getRecoveryCoordinationDeadline(solicitud);
    const isRequesterOfSolicitud =
      Boolean(userId && solicitud?.user_id && Number(userId) === Number(solicitud.user_id)) ||
      isSameEmail(userEmail, solicitud?.user_email);
    const normalizedStatus = String(solicitud?.status || "").toLowerCase();

    const canEditRecovery =
      Boolean(solicitud?.es_recuperable) &&
      isCoordinationEnabled &&
      !["agreed", "finalized_by_approver"].includes(coordinationStatus) &&
      !solicitud?.charged_to_vacation &&
      isRequesterOfSolicitud;
    const canApproveRecoveryProposal =
      isCoordinationEnabled &&
      isRequesterOfSolicitud &&
      ["pending_approver_proposal", "pending_requester_acceptance"].includes(coordinationStatus) &&
      recoveryPlan.length > 0;

    const cancellationStatus = String(solicitud?.cancellation_status || "none").toLowerCase();
    const hasPendingCancellation = cancellationStatus === "pending";
    const canCancelThis =
      cancellationStatus !== "pending" &&
      isRequesterOfSolicitud &&
      !NON_CANCELABLE_STATUSES.has(normalizedStatus);
    const requiresCancellationRequestFlow = false;

    const signatureSummary = solicitud.firma_avanzada_resumen || null;
    const isVacation = solicitud.tipo_solicitud === "vacaciones";
    const vacationShift = isVacation ? getVacationShiftLabel(solicitud) : null;

    const signatureStatusColor =
      signatureSummary?.estado === "completa"
        ? "text-emerald-700 border-emerald-200 bg-emerald-50"
        : signatureSummary?.estado === "parcial"
          ? "text-amber-700 border-amber-200 bg-amber-50"
          : "text-slate-600 border-slate-200 bg-slate-50";

    const isRejectedStatus = ["rejected", "rechazado"].includes(normalizedStatus);
    const isCancelledStatus = ["cancelled", "cancelado"].includes(normalizedStatus);

    return (
      <motion.div
        key={solicitud.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
      >
        <div
          className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${
            solicitud.provisional_status === "pendiente_regularizacion"
              ? "bg-rose-500"
              : solicitud.provisional_status === "salida_provisional_autorizada"
                ? "bg-orange-400"
                : solicitud.status === "approved" || solicitud.status === "aprobado"
                  ? "bg-green-500"
                  : solicitud.status === "partially_approved"
                    ? "bg-blue-500"
                    : solicitud.status === "pending_final"
                      ? "bg-purple-500"
                      : solicitud.status === "rejected"
                        ? "bg-red-500"
                        : "bg-amber-400"
          }`}
        />

        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-gray-900">{getTipoLabel(solicitud)}</span>
              {(() => {
                const meta = STATUS_META[solicitud.status] || STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md ${meta.color}`}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                );
              })()}
            </div>
            {solicitud.is_urgent && (
              <span className="mt-1 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border bg-red-100 text-red-800 border-red-200">
                URGENTE
              </span>
            )}
            {(() => {
              const prov = String(solicitud.provisional_status || "").toLowerCase();
              const provMeta = PROVISIONAL_STATUS_META[prov];
              if (!provMeta) return null;
              return (
                <span className={`mt-1 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${provMeta.badge}`}>
                  {provMeta.label}
                </span>
              );
            })()}
            {(() => {
              const esc = String(solicitud.escalation_status || "").toLowerCase();
              const escMeta = ESCALATION_STATUS_META[esc];
              if (!escMeta) return null;
              return (
                <span className={`mt-1 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${escMeta.badge}`}>
                  {escMeta.label}
                </span>
              );
            })()}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {formatDateShort(solicitud.fecha_inicio)} - {formatDateShort(solicitud.fecha_fin)}
              </span>
              <span className="font-medium text-gray-700">
                {solicitud.duracion_horas ? `${solicitud.duracion_horas}h` : `${solicitud.duracion_dias}d`}
              </span>
              {formatTimeRange(solicitud) && (
                <span className="font-medium text-indigo-700">{formatTimeRange(solicitud)}</span>
              )}
            </div>
          </div>
          <div className="text-right text-[10px] text-gray-400 whitespace-nowrap">
            ID: #{solicitud.requester_sequence || solicitud.id}
          </div>
        </div>

        {solicitud?.es_recuperable && isCoordinationEnabled && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-emerald-900">
                Plan de recuperación
                {recoveryTotal > 0 ? ` (${recoveryTotal}h)` : ""}
              </p>
              {canEditRecovery && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs py-1 px-2"
                  onClick={() => openRecoveryEditor(solicitud)}
                >
                  Coordinar tramos
                </Button>
              )}
            </div>
            <p className="text-[11px] text-emerald-800 mt-1">Estado: {getRecoveryCoordinationLabel(solicitud)}</p>
            {recoveryCoordinationDeadline && (
              <p className="text-[11px] text-emerald-800 mt-1">
                Coordinar hasta: {formatDateShort(recoveryCoordinationDeadline)}
              </p>
            )}
            {solicitud?.charged_to_vacation && (
              <p className="text-[11px] text-amber-800 mt-1">
                Registro histórico de descuento: {Number(solicitud?.charged_vacation_hours || 0) || recoveryTotal || 0}h
                {Number(solicitud?.charged_vacation_days || 0)
                  ? ` (${formatVacationDaysHours(Number(solicitud?.charged_vacation_days || 0)).text})`
                  : ""}
              </p>
            )}
            {recoveryPlan.length > 0 ? (
              <div className="mt-1 space-y-1">
                {recoveryPlan.slice(0, 3).map((row, idx) => (
                  <p key={`${solicitud.id}-recovery-${idx}`} className="text-[11px] text-emerald-800">
                    {row?.date || "N/A"} · {row?.start_time || "--:--"} - {row?.end_time || "--:--"}
                  </p>
                ))}
                {recoveryPlan.length > 3 && (
                  <p className="text-[11px] text-emerald-700">+{recoveryPlan.length - 3} tramo(s) adicionales</p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-emerald-800 mt-1">Sin tramos definidos aún.</p>
            )}
            {canApproveRecoveryProposal && (
              <div className="mt-2">
                <p className="text-[11px] text-emerald-800 mb-2">
                  Existe una propuesta de coordinación pendiente de tu aceptación.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  className="w-full text-xs"
                  onClick={() => handleSaveRecoveryPlan("accept")}
                >
                  Aceptar plan propuesto
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
          <div className="text-[11px]">
            <p className="text-gray-500">Creado</p>
            <p className="font-medium text-gray-800">{formatDateTime(solicitud.created_at)}</p>
          </div>
          <div className="text-[11px]">
            <p className="text-gray-500">Aprobador</p>
            <p className="font-medium text-gray-800 truncate">
              {solicitud.approver_email || solicitud.approver_role || "No asignado"}
            </p>
          </div>
          {isVacation && solicitud.periodo_vacaciones && (
            <div className="text-[11px]">
              <p className="text-gray-500">Periodo</p>
              <p className="font-medium text-gray-800">{solicitud.periodo_vacaciones}</p>
            </div>
          )}
          {vacationShift && (
            <div className="text-[11px]">
              <p className="text-gray-500">Jornada</p>
              <p className="font-medium text-gray-800">{vacationShift}</p>
            </div>
          )}
        </div>

        {Array.isArray(solicitud.observaciones) && solicitud.observaciones.length > 0 && (
          <div className="mt-2 bg-rose-50 border border-rose-200 rounded-lg p-2">
            <p className="text-[11px] font-semibold text-rose-900 mb-1">Notas de revisión:</p>
            {solicitud.observaciones.map((obs, idx) => (
              <p key={`${solicitud.id}-obs-${idx}`} className="text-[11px] text-rose-800 italic">
                - {obs}
              </p>
            ))}
          </div>
        )}

        {hasPendingCancellation && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <p className="text-[11px] font-semibold text-amber-900">Cancelación pendiente de revisión:</p>
            <p className="text-[11px] text-amber-800 italic">
              {solicitud.cancellation_request_reason || "Sin motivo registrado"}
            </p>
          </div>
        )}

        {(() => {
          const jStatus = String(solicitud.justificante_status || "").toLowerCase();
          const jMeta = JUSTIFICANTE_STATUS_META[jStatus];
          if (!jMeta || jStatus === "aceptado") return null;
          return (
            <div className={`mt-2 rounded-lg border p-2 ${jMeta.bg} ${jMeta.border}`}>
              <p className={`text-[11px] font-semibold ${jMeta.text}`}>{jMeta.label}</p>
              {solicitud.justificante_observations && (
                <p className={`text-[11px] italic mt-1 ${jMeta.text}`}>
                  {solicitud.justificante_observations}
                </p>
              )}
              {solicitud.justificante_deadline && (
                <p className={`text-[11px] mt-1 ${jMeta.text}`}>
                  Plazo: {formatDateShort(solicitud.justificante_deadline)}
                </p>
              )}
            </div>
          );
        })()}

        {hasJustificantes(solicitud) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {solicitud.justificantes_urls.map((url, idx) => (
              <a
                key={`${solicitud.id}-just-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-[10px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <FiEye className="w-3 h-3" />
                Justificante {idx + 1}
              </a>
            ))}
          </div>
        )}

        {hasExternalCoordinationEvidence(solicitud) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {solicitud.external_coordination_urls.map((url, idx) => (
              <a
                key={`${solicitud.id}-coord-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FiEye className="w-3 h-3" />
                Coordinación externa {idx + 1}
              </a>
            ))}
          </div>
        )}

        {solicitud.pdf_generado_url && (
          <div className="mt-2">
            <a
              href={solicitud.pdf_generado_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <FiDownload className="w-3 h-3" />
              {isCancelledStatus ? "Descargar F.RH-10 cancelado" : "Descargar F.RH-10"}
            </a>
          </div>
        )}

        {signatureSummary && !isRejectedStatus && (
          <div className={`mt-2 rounded-lg border p-2 ${signatureStatusColor}`}>
            <p className="text-[10px] font-semibold mb-1 flex items-center gap-1">
              <FiShield className="w-3 h-3" />
              FamSign workflow ({signatureSummary.estado || "pendiente"})
            </p>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div>
                <p className="text-gray-500">Mi firma</p>
                <p className="font-medium">
                  {signatureSummary.solicitud_firmada
                    ? `Firmado · ${formatDateTime(signatureSummary.solicitud?.signed_at)}`
                    : "Pendiente"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Aprobación</p>
                <p className="font-medium">
                  {signatureSummary.aprobacion_firmada
                    ? `Firmado · ${formatDateTime(signatureSummary.aprobacion?.signed_at)}`
                    : "Pendiente"}
                </p>
              </div>
            </div>
          </div>
        )}

        {(() => {
          const provStatus = String(solicitud.provisional_status || "").toLowerCase();
          const showRegularizacionActions =
            isTalentRole && provStatus === "pendiente_regularizacion";
          if (!showRegularizacionActions) return null;
          const provMeta = PROVISIONAL_STATUS_META.pendiente_regularizacion;
          return (
            <div className={`mt-2 rounded-lg border p-2.5 ${provMeta.bg} ${provMeta.border}`}>
              <p className={`text-[11px] font-semibold mb-2 ${provMeta.text}`}>
                Ausencia urgente no procedente — requiere acción de regularización
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 text-[10px] py-1.5 border-rose-300 text-rose-800 hover:bg-rose-100"
                  onClick={() => openRegularizacionModal(solicitud.id, "rechazar_formalmente")}
                  disabled={!!actionLoading}
                >
                  Rechazar formalmente
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 text-[10px] py-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  onClick={() => openRegularizacionModal(solicitud.id, "aceptar_excepcion")}
                  disabled={!!actionLoading}
                >
                  Aceptar por excepción
                </Button>
              </div>
            </div>
          );
        })()}

        {(() => {
          const jStatus = String(solicitud.justificante_status || "").toLowerCase();
          const showResubmit = jStatus === "observado" && isRequesterOfSolicitud;
          const showLogProgress =
            Boolean(solicitud.es_recuperable) &&
            coordinationStatus === "execution_in_progress" &&
            isRequesterOfSolicitud;
          const showCloseRecovery =
            Boolean(solicitud.es_recuperable) &&
            coordinationStatus === "pending_verification" &&
            isRequesterOfSolicitud;
          const hasAnyAction = canCancelThis || showResubmit || showLogProgress || showCloseRecovery;
          if (!hasAnyAction) return null;
          return (
            <div className="mt-3 flex flex-wrap gap-2">
              {showResubmit && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedSolicitud(solicitud);
                    setShowUploadModal(true);
                  }}
                  className="flex-1 text-[10px] py-1.5 bg-amber-600 hover:bg-amber-700"
                >
                  Resubmitir justificante
                </Button>
              )}
              {showLogProgress && (
                <Button
                  variant="secondary"
                  onClick={() => openRecoveryEditor(solicitud, "log_progress")}
                  className="flex-1 text-[10px] py-1.5"
                >
                  Registrar progreso
                </Button>
              )}
              {showCloseRecovery && (
                <Button
                  variant="primary"
                  onClick={() => handleCloseRecovery(solicitud.id)}
                  disabled={!!actionLoading}
                  className="flex-1 text-[10px] py-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  Confirmar recuperación
                </Button>
              )}
              {canCancelThis && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedSolicitud(solicitud);
                    setCancelReason("");
                    setShowCancelModal(true);
                  }}
                  className="flex-1 text-[10px] py-1.5 text-rose-600 border-rose-100 hover:bg-rose-50"
                >
                  {requiresCancellationRequestFlow ? "Solicitar cancelacion" : "Cancelar solicitud"}
                </Button>
              )}
            </div>
          );
        })()}
      </motion.div>
    );
  };

  return (
    <>
    <div className="space-y-4">
      {/* Widget de Carga de Justificantes */}
      {pendientesDeJustificante.length > 0 && (
        <Card className="p-4 border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <FiUpload className="w-4 h-4" />
              Justificantes pendientes ({pendientesDeJustificante.length})
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendientesDeJustificante.slice(0, getVisibleCountForSection("upload_docs")).map((sol) => (
              <div key={`upload-card-${sol.id}`} className="bg-white rounded-lg border border-blue-100 p-3 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-gray-500">ID #{sol.requester_sequence || sol.id}</span>
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {getTipoLabel(sol)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mb-2">
                  {formatDateShort(sol.fecha_inicio)} - {formatDateShort(sol.fecha_fin)}
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  className="w-full text-xs py-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setSelectedSolicitud(sol);
                    setShowUploadModal(true);
                  }}
                >
                  Subir documentos
                </Button>
              </div>
            ))}
          </div>
          {renderListControls("upload_docs", pendientesDeJustificante.length)}
        </Card>
      )}

      {/* Listado Principal de Mis Solicitudes */}
      <Card className="overflow-hidden border-gray-200">
        <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FiFileText className="w-4 h-4 text-gray-400" />
            Mis solicitudes de permisos y vacaciones
          </h3>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-200/50 px-2 py-0.5 rounded-full">
            {misSolicitudes.length} total
          </span>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : misSolicitudes.length === 0 ? (
            <div className="py-12 text-center bg-gray-50/30 rounded-xl border border-dashed border-gray-100">
              <FiClock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Aún no has registrado ninguna solicitud</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {misSolicitudes.slice(0, getVisibleCountForSection("mine")).map(renderSolicitudCard)}
              </div>
              {renderListControls("mine", misSolicitudes.length)}
            </>
          )}
        </div>
      </Card>

      {/* Modales */}
      <UploadJustificantesModal
        open={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedSolicitud(null);
        }}
        solicitud={selectedSolicitud}
        onSuccess={handleUploadSuccess}
      />

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2 bg-rose-50 rounded-lg">
                <FiAlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">
                {selectedRequiresCancellationRequestFlow ? "Solicitar cancelacion" : "Cancelar solicitud"}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              {selectedRequiresCancellationRequestFlow
                ? "Explica brevemente el motivo de la cancelacion. Tu jefe inmediato revisara esta solicitud."
                : "Registra el motivo de cancelacion para trazabilidad del flujo."}
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent mb-4 transition-all"
              placeholder="Escribe el motivo aquí..."
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedSolicitud(null);
                  setCancelReason("");
                }}
                className="flex-1 rounded-xl"
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={handleCancelar}
                className="flex-1 bg-rose-600 hover:bg-rose-700 rounded-xl"
                disabled={!cancelReason.trim() || !!actionLoading}
              >
                {selectedRequiresCancellationRequestFlow ? "Confirmar envio" : "Confirmar cancelacion"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <FiClock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">
                {recoveryModalAction === "log_progress" ? "Registrar progreso de recuperación" : "Plan de recuperación"}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {recoveryModalAction === "log_progress"
                ? <>Ingresa las horas ya ejecutadas. Total a recuperar: <span className="font-bold text-emerald-700">{requestedRecoveryHours}h</span>.</>
                : <>Coordinación de tramos para cubrir <span className="font-bold text-emerald-700">{requestedRecoveryHours}h</span> pendientes.</>
              }
            </p>

            <div className="mt-4 space-y-3 max-h-[40vh] overflow-auto pr-1">
              {recoveryRows.map((row, idx) => {
                const computedHours = computeRecoveryHours(row.start_time, row.end_time);
                return (
                  <div key={`rec-row-${idx}`} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="col-span-4">
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Fecha</label>
                      <input
                        type="date"
                        value={row.date || ""}
                        onChange={(e) => setRecoveryRows(prev => prev.map((it, i) => i === idx ? { ...it, date: e.target.value } : it))}
                        className="w-full border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Inicio</label>
                      <input
                        type="time"
                        value={row.start_time || ""}
                        onChange={(e) => setRecoveryRows(prev => prev.map((it, i) => i === idx ? { ...it, start_time: e.target.value } : it))}
                        className="w-full border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Fin</label>
                      <input
                        type="time"
                        value={row.end_time || ""}
                        onChange={(e) => setRecoveryRows(prev => prev.map((it, i) => i === idx ? { ...it, end_time: e.target.value } : it))}
                        className="w-full border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="col-span-2 flex flex-col items-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Horas</span>
                      <span className="text-sm font-bold text-emerald-600 py-1.5">{computedHours || "-"}</span>
                    </div>
                    <div className="col-span-12 mt-2">
                      <input
                        type="text"
                        placeholder="Notas adicionales..."
                        value={row.notes || ""}
                        onChange={(e) => setRecoveryRows(prev => prev.map((it, i) => i === idx ? { ...it, notes: e.target.value } : it))}
                        className="w-full border-gray-100 rounded-lg text-[11px] bg-white"
                      />
                    </div>
                    <div className="col-span-12 mt-2 flex justify-end">
                      <button
                        onClick={() => setRecoveryRows(prev => prev.filter((_, i) => i !== idx))}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider"
                      >
                        Eliminar tramo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRecoveryRows(prev => [...prev, { date: "", start_time: "", end_time: "", notes: "" }])}
                disabled={isRecoveryPlanComplete}
                className="rounded-lg"
              >
                + Agregar tramo
              </Button>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">Total planificado</p>
                <p className={`text-lg font-black ${plannedRecoveryHours >= requestedRecoveryHours ? "text-emerald-600" : "text-amber-600"}`}>
                  {plannedRecoveryHours}h / {requestedRecoveryHours}h
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRecoveryModal(false);
                  setSelectedSolicitud(null);
                  setRecoveryRows([]);
                }}
                className="flex-1 rounded-xl"
              >
                Cancelar
              </Button>
              {recoveryModalAction === "log_progress" && (
                <Button
                  variant="primary"
                  onClick={() => handleSaveRecoveryPlan("log_progress")}
                  disabled={actionLoading === `recovery-${selectedSolicitud?.id}`}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Guardar progreso
                </Button>
              )}
              {isSelectedRequester && recoveryModalAction !== "log_progress" && (
                <Button
                  variant="primary"
                  onClick={() => handleSaveRecoveryPlan("propose")}
                  disabled={actionLoading === `recovery-${selectedSolicitud?.id}`}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  {canSelectedRequesterCounterPropose ? "Enviar contrapropuesta" : "Enviar propuesta"}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>

    {/* Modal de razón para regularización urgente */}
    {regularizacionModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {regularizacionModal.action === "rechazar_formalmente"
              ? "Rechazar formalmente la ausencia urgente"
              : "Aceptar ausencia urgente por excepción"}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {regularizacionModal.action === "rechazar_formalmente"
              ? "Esta acción cierra la solicitud como rechazada. Indica el motivo formal del rechazo."
              : "Esta acción acepta la ausencia por excepción y la envía a aprobación final. Indica el motivo de la excepción."}
          </p>
          <textarea
            className="w-full rounded-lg border border-gray-200 text-xs p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            rows={3}
            placeholder="Motivo obligatorio..."
            value={regularizacionReason}
            onChange={(e) => setRegularizacionReason(e.target.value)}
          />
          <div className="mt-3 flex gap-2 justify-end">
            <Button
              size="sm"
              variant="secondary"
              className="text-xs"
              onClick={() => setRegularizacionModal({ open: false, solicitudId: null, action: null })}
              disabled={!!actionLoading}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="primary"
              className={`text-xs ${regularizacionModal.action === "rechazar_formalmente" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              onClick={handleConfirmRegularizacion}
              disabled={!!actionLoading || !regularizacionReason.trim()}
            >
              {actionLoading ? "Procesando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default PermisosStatusWidget;
