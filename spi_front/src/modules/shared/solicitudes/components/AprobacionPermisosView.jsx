import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiDownload,
  FiEye,
  FiFileText,
  FiUsers,
  FiX,
  FiShield,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import {
  STATUS_META,
  formatDateShort,
  hasJustificantes,
  PROVISIONAL_STATUS_META,
} from "../utils/solicitudesHelpers";
import { formatVacationDaysHours } from "../utils/vacationDisplay";
import {
  aprobarFinal,
  aprobarParcial,
  cancelarSolicitud,
  getPendientes,
  getPendingStudyEnrollments,
  rechazar,
  revisarCancelacionSolicitud,
  updateRecoveryPlan,
  reviewStudyEnrollment,
  revisarJustificante,
  resolverRegularizacion,
  convertirAVacaciones,
} from "../../../../core/api/permisosApi";
import { useAuth } from "../../../../core/auth/AuthContext";

const INITIAL_VISIBLE_COUNTS = {
  pending: 8,
  pending_final: 8,
  cancellation_pending: 8,
  study_enrollments: 6,
  approved: 8,
  regularizacion_pendiente: 8,
};

const expandRoleAliases = (roles = []) => {
  const set = new Set((roles || []).filter(Boolean));
  if (set.has("jefe_finanzas")) set.add("jefe_financiero");
  if (set.has("jefe_financiero")) set.add("jefe_finanzas");
  if (set.has("finanzas")) set.add("financiero");
  if (set.has("financiero")) set.add("finanzas");
  return Array.from(set);
};

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

const getEnrollmentRequesterName = (enrollment = {}) =>
  enrollment.requester_name ||
  enrollment.user_fullname ||
  enrollment.user_name ||
  enrollment.user_email ||
  "Solicitante no registrado";

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

const RECOVERY_COORDINATION_LABELS = {
  not_required: "No requiere coordinacion",
  pending_approver_proposal: "Pendiente propuesta del jefe inmediato",
  pending_requester_acceptance: "Pendiente aceptacion del solicitante",
  agreed: "Coordinacion aprobada y cerrada",
  finalized_by_approver: "Tramos definidos por jefe inmediato",
};

const normalizeRoleValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const text = String(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
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




const isSameEmail = (a, b) =>
  String(a || "").trim().toLowerCase() !== "" &&
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

const NON_CANCELABLE_STATUSES = new Set(["rejected", "rechazado", "cancelled", "cancelado"]);

const getRecoveryCoordinationLabel = (solicitud = {}) => {
  const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
  if (coordinationStatus === "finalized_by_approver" && solicitud?.charged_to_vacation) {
    return "Sin acuerdo; cargado a vacaciones";
  }
  return RECOVERY_COORDINATION_LABELS[coordinationStatus] || RECOVERY_COORDINATION_LABELS.not_required;
};

const canCoordinateRecoveryByStatus = (solicitud = {}) =>
  ["partially_approved", "pending_final", "approved", "aprobado"].includes(
    String(solicitud?.status || "").toLowerCase()
  );

const getRecoveryCoordinationDeadline = (solicitud = {}) => {
  const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
  if (!["pending_approver_proposal", "pending_requester_acceptance"].includes(coordinationStatus)) {
    return null;
  }
  return addDaysToDateOnly(solicitud?.fecha_inicio || solicitud?.fecha_inicio_hora, 3);
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

const estimateRequestedHoursFromSolicitud = (solicitud = {}) => {
  const hours = Number(solicitud?.duracion_horas || 0);
  if (Number.isFinite(hours) && hours > 0) return hours;
  const days = Number(solicitud?.duracion_dias || 0);
  if (Number.isFinite(days) && days > 0) return Math.round(((days * 8) + Number.EPSILON) * 100) / 100;
  return 0;
};

const AprobacionPermisosView = ({ compact = false }) => {
  const { showToast, showLoader, hideLoader } = useUI();
  const { user } = useAuth();
  const [stage, setStage] = useState("pending");
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlTab = searchParams.get("tab");
  const urlSolicitudId = searchParams.get("solicitudId");
  const urlEnrollmentId = searchParams.get("enrollmentId");
  const urlOpenRecovery = searchParams.get("openRecovery");
  const [loading, setLoading] = useState(true);
  const [solicitudes, setSolicitudes] = useState([]);
  const [pendingStudyEnrollments, setPendingStudyEnrollments] = useState([]);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [showEnrollmentReviewModal, setShowEnrollmentReviewModal] = useState(false);
  const [enrollmentReviewDecision, setEnrollmentReviewDecision] = useState("approve");
  const [enrollmentReviewReason, setEnrollmentReviewReason] = useState("");
  const [selectedRecoverySolicitud, setSelectedRecoverySolicitud] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryRows, setRecoveryRows] = useState([]);
  const [visibleItemsBySection, setVisibleItemsBySection] = useState(INITIAL_VISIBLE_COUNTS);
  const [showJustificanteModal, setShowJustificanteModal] = useState(false);
  const [justificanteSolicitud, setJustificanteSolicitud] = useState(null);
  const [justificanteDecision, setJustificanteDecision] = useState("aceptado");
  const [justificanteObservations, setJustificanteObservations] = useState("");
  const [showRegularizacionModal, setShowRegularizacionModal] = useState(false);
  const [regularizacionSolicitud, setRegularizacionSolicitud] = useState(null);
  const [regularizacionAction, setRegularizacionAction] = useState(null);
  const [regularizacionReason, setRegularizacionReason] = useState("");

  const canSeeApproved = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    return role.includes("jefe") || role.includes("gerencia") || role === "admin" || role === "gerente_general";
  }, [user]);

  const isTalentRole = useMemo(() => {
    const scope = String(user?.scope || user?.role || "").toLowerCase();
    return [
      "talento_humano", "jefe_talento_humano", "talento-humano",
      "gerencia_general", "gerente_general",
      "admin", "administrador",
    ].some((r) => scope === r);
  }, [user]);

  const userId = user?.id;
  const userEmail = String(user?.email || "").toLowerCase();
  const roleCandidates = useMemo(
    () => expandRoleAliases([user?.role, user?.scope, user?.role_name].map(normalizeRoleValue).filter(Boolean)),
    [user],
  );
  const gerenciaGeneralRoles = useMemo(() => new Set(["gerencia_general", "gerente_general"]), []);

  const showAdvancedSignatureWidget = roleCandidates.some((candidate) =>
    ["jefe_financiero", "jefe_finanzas", "jefe_ti"].includes(candidate)
  );
  const canViewLegalValidationDoc = roleCandidates.some((candidate) =>
    ["jefe_financiero", "jefe_finanzas", "jefe_ti", "gerencia_general", "gerente_general"].includes(candidate)
  );

  const gapClass = compact ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4";
  const actionButton = compact ? "flex-1 text-xs py-1.5" : "flex-1";

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

  const canCurrentUserActAsAssignedApprover = useCallback((solicitud) => {
    if (!solicitud) return false;
    const approverRole = normalizeRoleValue(solicitud?.approver_role);
    const approverEmail = String(solicitud?.approver_email || "").toLowerCase();
    const approverUserId = solicitud?.approver_user_id;
    if (approverUserId && userId && Number(approverUserId) === Number(userId)) return true;
    if (approverEmail && userEmail && approverEmail === userEmail) return true;
    if (approverRole) {
      if (gerenciaGeneralRoles.has(approverRole)) {
        return roleCandidates.some((candidate) => gerenciaGeneralRoles.has(candidate));
      }
      return roleCandidates.includes(approverRole);
    }
    return false;
  }, [gerenciaGeneralRoles, roleCandidates, userEmail, userId]);

  const loadStageData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      if (stage === "study_enrollments") {
        const response = await getPendingStudyEnrollments();
        if (response?.ok) {
          setPendingStudyEnrollments(response.data || []);
        } else {
          setPendingStudyEnrollments([]);
        }
        setSolicitudes([]);
        return;
      }

      const response = await getPendientes(stage);
      if (response?.ok) {
        setSolicitudes(response.data || []);
      } else {
        setSolicitudes([]);
      }
      setPendingStudyEnrollments([]);
    } catch (error) {
      if (stage === "study_enrollments") {
        showToast("Error al cargar matriculas pendientes", "error");
        setPendingStudyEnrollments([]);
      } else {
        showToast("Error al cargar solicitudes", "error");
        setSolicitudes([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast, stage]);

  useEffect(() => {
    loadStageData();
  }, [loadStageData]);

  useScopedAutoUpdate(
    [DATA_UPDATE_SCOPES.PERMISOS, DATA_UPDATE_SCOPES.VACACIONES],
    () => {
      loadStageData({ silent: true });
    },
    [stage],
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

  const handleAprobarParcial = async (id) => {
    await runActionWithLoader(id, "Aprobando solicitud...", async () => {
      try {
        const response = await aprobarParcial(id);
        if (response?.ok) {
          const nextStatus = String(response?.data?.status || "").toLowerCase();
          if (nextStatus === "approved") {
            showToast("Solicitud aprobada definitivamente.", "success");
          } else {
            showToast("Solicitud aprobada parcialmente. El colaborador debe subir justificantes.", "success");
          }
          await loadStageData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al aprobar", "error");
      }
    });
  };

  const handleAprobarFinal = async (id) => {
    await runActionWithLoader(id, "Aprobando solicitud...", async () => {
      try {
        const response = await aprobarFinal(id);
        if (response?.ok) {
          showToast("Solicitud aprobada definitivamente. PDF generado.", "success");
          await loadStageData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al aprobar", "error");
      }
    });
  };

  const openJustificanteModal = (solicitud) => {
    setJustificanteSolicitud(solicitud);
    setJustificanteDecision("aceptado");
    setJustificanteObservations("");
    setShowJustificanteModal(true);
  };

  const handleRevisarJustificante = async () => {
    if (!justificanteSolicitud) return;
    const needsObs = justificanteDecision === "rechazado" || justificanteDecision === "observado";
    if (needsObs && !justificanteObservations.trim()) {
      showToast("Las observaciones son obligatorias al rechazar u observar", "warning");
      return;
    }
    await runActionWithLoader(
      `just-${justificanteSolicitud.id}`,
      "Revisando justificante...",
      async () => {
        try {
          const response = await revisarJustificante(
            justificanteSolicitud.id,
            justificanteDecision,
            justificanteObservations.trim() || null,
          );
          if (response?.ok) {
            const msgs = {
              aceptado: "Justificante aceptado. La solicitud queda como procedente.",
              observado: "Observaciones registradas. El colaborador debe resubmitir los documentos.",
              rechazado: "Justificante rechazado. La solicitud queda pendiente de regularización.",
            };
            showToast(msgs[justificanteDecision] || "Justificante revisado", "success");
            setShowJustificanteModal(false);
            setJustificanteSolicitud(null);
            setJustificanteObservations("");
            await loadStageData();
          }
        } catch (error) {
          showToast(error.response?.data?.message || "Error al revisar justificante", "error");
        }
      },
    );
  };

  const openRegularizacionModal = (solicitud, action) => {
    setRegularizacionSolicitud(solicitud);
    setRegularizacionAction(action);
    setRegularizacionReason("");
    setShowRegularizacionModal(true);
  };

  const handleConfirmRegularizacion = async () => {
    if (!regularizacionSolicitud || !regularizacionAction) return;
    if (!regularizacionReason.trim()) {
      showToast("El motivo es obligatorio", "warning");
      return;
    }
    await runActionWithLoader(
      `reg-${regularizacionSolicitud.id}`,
      "Procesando regularización...",
      async () => {
        try {
          const response = await resolverRegularizacion(
            regularizacionSolicitud.id,
            regularizacionAction,
            regularizacionReason.trim(),
          );
          if (response?.ok) {
            const msgs = {
              rechazar_formalmente: "Solicitud rechazada formalmente.",
              aceptar_excepcion: "Excepción aceptada. La solicitud queda lista para aprobación final.",
            };
            showToast(msgs[regularizacionAction] || "Regularización procesada", "success");
            setShowRegularizacionModal(false);
            setRegularizacionSolicitud(null);
            setRegularizacionReason("");
            await loadStageData();
          }
        } catch (error) {
          showToast(error.response?.data?.message || "Error al procesar regularización", "error");
        }
      },
    );
  };

  const handleConvertirAVacaciones = async (solicitud) => {
    await runActionWithLoader(
      `conv-${solicitud.id}`,
      "Convirtiendo a vacaciones...",
      async () => {
        try {
          const response = await convertirAVacaciones(solicitud.id);
          if (response?.ok) {
            showToast("Tiempo convertido a vacaciones exitosamente.", "success");
            await loadStageData();
          }
        } catch (error) {
          showToast(error.response?.data?.message || "Error al convertir a vacaciones", "error");
        }
      },
    );
  };

  const handleRechazar = async () => {
    if (!selectedSolicitud || !rejectReason.trim()) {
      showToast("Debes proporcionar una razon de rechazo", "warning");
      return;
    }

    await runActionWithLoader(selectedSolicitud.id, "Rechazando solicitud...", async () => {
      try {
        const response = await rechazar(selectedSolicitud.id, rejectReason.trim());
        if (response?.ok) {
          showToast("Solicitud rechazada", "success");
          setShowRejectModal(false);
          setSelectedSolicitud(null);
          setRejectReason("");
          await loadStageData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al rechazar", "error");
      }
    });
  };

  const openCancelModal = (solicitud) => {
    setSelectedSolicitud(solicitud);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const handleCancelar = async () => {
    if (!selectedSolicitud || !cancelReason.trim()) {
      showToast("Debes indicar el motivo de cancelacion", "warning");
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
          await loadStageData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al cancelar la solicitud", "error");
      }
    });
  };

  const handleReviewCancellation = async (decision) => {
    if (!selectedSolicitud) return;
    const reason = String(cancelReason || "").trim();
    if (decision === "reject" && !reason) {
      showToast("Debes indicar el motivo del rechazo de cancelacion", "warning");
      return;
    }

    await runActionWithLoader(
      selectedSolicitud.id,
      decision === "approve" ? "Aprobando cancelacion..." : "Rechazando cancelacion...",
      async () => {
        try {
          const response = await revisarCancelacionSolicitud(selectedSolicitud.id, decision, reason || null);
          if (response?.ok) {
            showToast(
              decision === "approve" ? "Cancelacion aprobada" : "Cancelacion rechazada",
              "success",
            );
            setShowCancelModal(false);
            setSelectedSolicitud(null);
            setCancelReason("");
            await loadStageData();
          }
        } catch (error) {
          showToast(error.response?.data?.message || "Error revisando cancelacion", "error");
        }
      },
    );
  };

  const openEnrollmentReviewModal = (enrollment, decision) => {
    setSelectedEnrollment(enrollment);
    setEnrollmentReviewDecision(decision);
    setEnrollmentReviewReason("");
    setShowEnrollmentReviewModal(true);
  };

  const openRecoveryEditor = (solicitud) => {
    const currentPlan = Array.isArray(solicitud?.recovery_plan) ? solicitud.recovery_plan : [];
    setSelectedRecoverySolicitud(solicitud);
    setRecoveryRows(
      currentPlan.length > 0
        ? currentPlan.map((row) => ({
          date: String(row?.date || ""),
          start_time: normalizeTimeText(row?.start_time),
          end_time: normalizeTimeText(row?.end_time),
          notes: String(row?.notes || ""),
        }))
        : [{ date: "", start_time: "", end_time: "", notes: "" }],
    );
    setShowRecoveryModal(true);
  };

  const handleSaveRecoveryPlan = async (action = "propose") => {
    if (!selectedRecoverySolicitud) return;
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
      showToast("Debes registrar al menos un tramo valido de recuperacion", "warning");
      return;
    }

    const recoveryMessage =
      action === "accept"
        ? "Aprobando plan de recuperacion..."
        : action === "finalize"
          ? "Definiendo plan de recuperacion..."
          : "Actualizando plan de recuperacion...";

    await runActionWithLoader(`recovery-${selectedRecoverySolicitud.id}`, recoveryMessage, async () => {
      try {
        const response = await updateRecoveryPlan(selectedRecoverySolicitud.id, normalizedPlan, action);
        if (response?.ok) {
          showToast(
            action === "accept"
              ? "Plan de recuperacion aprobado"
              : action === "finalize"
                ? "Plan de recuperacion definido de forma definitiva"
                : "Plan de recuperacion actualizado",
            "success",
          );
          setShowRecoveryModal(false);
          setSelectedRecoverySolicitud(null);
          setRecoveryRows([]);
          await loadStageData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error actualizando plan de recuperacion", "error");
      }
    });
  };

  const handleReviewEnrollment = async () => {
    if (!selectedEnrollment) return;

    const reason = String(enrollmentReviewReason || "").trim();
    if (enrollmentReviewDecision === "reject" && !reason) {
      showToast("Debes registrar el motivo del rechazo", "warning");
      return;
    }

    await runActionWithLoader(
      `enroll-${selectedEnrollment.id}`,
      enrollmentReviewDecision === "approve" ? "Aprobando matricula..." : "Rechazando matricula...",
      async () => {
        try {
          const response = await reviewStudyEnrollment(
            selectedEnrollment.id,
            enrollmentReviewDecision,
            reason || null,
          );
          if (response?.ok) {
            showToast(
              enrollmentReviewDecision === "approve" ? "Matricula validada" : "Matricula rechazada",
              "success",
            );
            setShowEnrollmentReviewModal(false);
            setSelectedEnrollment(null);
            setEnrollmentReviewReason("");
            await loadStageData();
          }
        } catch (error) {
          showToast(error.response?.data?.message || "Error revisando matricula", "error");
        }
      },
    );
  };

  const getStatusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.pending;
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md ${meta.color}`}>
        <Icon className="w-3 h-3" />
        {meta.label}
      </span>
    );
  };

  const getTipoLabel = (solicitud) => {
    if (solicitud.tipo_solicitud === "vacaciones") return "Vacaciones";
    const tipos = {
      estudios: "Permiso por Estudios",
      personal: "Permiso Personal",
      salud: "Permiso por Salud",
      calamidad: "Calamidad Domestica",
    };
    return tipos[solicitud.tipo_permiso] || "Permiso";
  };

  const renderSolicitudCard = (solicitud) => {
    const recoveryPlan = Array.isArray(solicitud?.recovery_plan) ? solicitud.recovery_plan : [];
    const recoveryTotal = Number(solicitud?.recovery_plan_total_hours || 0);
    const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
    const isCoordinationEnabled = canCoordinateRecoveryByStatus(solicitud);
    const recoveryCoordinationDeadline = getRecoveryCoordinationDeadline(solicitud);
    const normalizedStatus = String(solicitud?.status || "").toLowerCase();
    const isVacation = solicitud.tipo_solicitud === "vacaciones";
    const approverDisplay =
      solicitud.approver_email ||
      solicitud.approver_role ||
      (solicitud.approver_user_id ? `Usuario #${solicitud.approver_user_id}` : "No asignado");

    const traceabilityItems = [];
    const rejectionNotes = Array.isArray(solicitud.observaciones)
      ? solicitud.observaciones.filter(Boolean)
      : solicitud.observaciones
        ? [solicitud.observaciones]
        : [];
    if (rejectionNotes.length > 0) {
      rejectionNotes.forEach((note) => {
        traceabilityItems.push({ label: "Observación", text: note });
      });
    }
    if (solicitud?.cancellation_request_reason) {
      traceabilityItems.push({
        label: "Motivo solicitud de cancelación",
        text: solicitud.cancellation_request_reason,
      });
    }

    const signatureSummary = solicitud.firma_avanzada_resumen || null;
    const vacationShift = isVacation ? getVacationShiftLabel(solicitud) : null;
    const isRequesterOfSolicitud =
      Boolean(userId && solicitud?.user_id && Number(userId) === Number(solicitud.user_id)) ||
      isSameEmail(userEmail, solicitud?.user_email);
    const isApproverOfSolicitud = canCurrentUserActAsAssignedApprover(solicitud);

    const canEditRecovery =
      Boolean(solicitud?.es_recuperable) &&
      isCoordinationEnabled &&
      !["agreed", "finalized_by_approver"].includes(coordinationStatus) &&
      !solicitud?.charged_to_vacation &&
      (isRequesterOfSolicitud || isApproverOfSolicitud);
    const canApproveRecoveryProposal =
      isCoordinationEnabled &&
      (isRequesterOfSolicitud || isApproverOfSolicitud) &&
      ["pending_approver_proposal", "pending_requester_acceptance"].includes(coordinationStatus) &&
      recoveryPlan.length > 0;
    const canApproverFinalize =
      isCoordinationEnabled &&
      isApproverOfSolicitud &&
      coordinationStatus === "pending_approver_proposal" &&
      Number(solicitud?.recovery_coordination_round || 0) > 0 &&
      recoveryPlan.length > 0;

    const cancellationStatus = String(solicitud?.cancellation_status || "none").toLowerCase();
    const hasPendingCancellation = cancellationStatus === "pending";
    const canCancelThis =
      cancellationStatus !== "pending" &&
      (isRequesterOfSolicitud || isApproverOfSolicitud) &&
      !NON_CANCELABLE_STATUSES.has(normalizedStatus);
    const requiresCancellationRequestFlow = false;

    const isRejectedStatus = ["rejected", "rechazado"].includes(normalizedStatus);
    const isCancelledStatus = ["cancelled", "cancelado"].includes(normalizedStatus);

    const canViewLegalForThis =
      canViewLegalValidationDoc ||
      (userId && solicitud?.user_id && Number(userId) === Number(solicitud.user_id)) ||
      (userId && solicitud?.approver_user_id && Number(userId) === Number(solicitud.approver_user_id)) ||
      (userEmail && solicitud?.user_email && String(userEmail).toLowerCase() === String(solicitud.user_email).toLowerCase()) ||
      (userEmail && solicitud?.approver_email && String(userEmail).toLowerCase() === String(solicitud.approver_email).toLowerCase());

    const signatureStatusColor =
      signatureSummary?.estado === "completa"
        ? "text-emerald-700 border-emerald-200 bg-emerald-50"
        : signatureSummary?.estado === "parcial"
          ? "text-amber-700 border-amber-200 bg-amber-50"
          : "text-slate-600 border-slate-200 bg-slate-50";

    const chargedVacationDisplay = formatVacationDaysHours(Number(solicitud?.charged_vacation_days || 0));

    return (
      <motion.div
        key={solicitud.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
      >
        <div
          className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${
            solicitud.provisional_status === "pendiente_regularizacion"
              ? "bg-rose-500"
              : solicitud.is_urgent && solicitud.provisional_status === "salida_provisional_autorizada"
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
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-gray-900">{getTipoLabel(solicitud)}</span>
              {getStatusBadge(solicitud.status)}
              {solicitud.is_urgent && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 border border-red-200">
                  URGENTE
                </span>
              )}
              {solicitud.provisional_status && (() => {
                const pm = PROVISIONAL_STATUS_META[String(solicitud.provisional_status).toLowerCase()];
                return pm ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border ${pm.badge}`}>
                    {pm.label}
                  </span>
                ) : null;
              })()}
            </div>
            <p className="text-xs text-gray-600 mb-1">
              <FiUsers className="inline mr-1" />
              {solicitud.user_fullname || solicitud.user_email || "Sin solicitante"}
              {solicitud.user_email && solicitud.user_fullname ? (
                <span className="text-[11px] text-gray-500 ml-1">({solicitud.user_email})</span>
              ) : null}
            </p>
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
                Descuento aplicado a vacaciones:
                {" "}
                {Number(solicitud?.charged_vacation_hours || 0) || recoveryTotal || 0}h
                {Number(solicitud?.charged_vacation_days || 0)
                  ? ` (${chargedVacationDisplay.text})`
                  : ""}
              </p>
            )}
            {recoveryPlan.length > 0 ? (
              <div className="mt-1 space-y-1">
                {recoveryPlan.slice(0, 4).map((row, idx) => (
                  <p key={`${solicitud.id}-recovery-${idx}`} className="text-[11px] text-emerald-800">
                    {row?.date || "N/A"} · {row?.start_time || "--:--"} - {row?.end_time || "--:--"}
                    {row?.notes ? ` · ${row.notes}` : ""}
                  </p>
                ))}
                {recoveryPlan.length > 4 && (
                  <p className="text-[11px] text-emerald-700">+{recoveryPlan.length - 4} tramo(s) adicionales</p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-emerald-800 mt-1">Sin tramos definidos aún.</p>
            )}
            {(canApproveRecoveryProposal || canApproverFinalize) && (
              <div className="mt-2">
                {canApproveRecoveryProposal && (
                  <p className="text-[11px] text-emerald-800">
                    Existe una propuesta de coordinación pendiente. Cualquiera de las dos partes puede aprobarla y cerrarla.
                  </p>
                )}
                {canApproverFinalize && (
                  <p className="text-[11px] text-emerald-800">
                    Hay una contrapropuesta del solicitante pendiente de decisión definitiva.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
          <div className="text-[11px]">
            <p className="text-gray-500">Solicitante</p>
            <p className="font-medium text-gray-800 truncate">{solicitud.user_email || "N/A"}</p>
          </div>
          <div className="text-[11px]">
            <p className="text-gray-500">Creado</p>
            <p className="font-medium text-gray-800">{formatDateTime(solicitud.created_at)}</p>
          </div>
          <div className="text-[11px]">
            <p className="text-gray-500">Aprobador asignado</p>
            <p className="font-medium text-gray-800 truncate">{approverDisplay}</p>
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
          {solicitud.aprobacion_parcial_at && (
            <div className="text-[11px]">
              <p className="text-gray-500">Aprobación parcial</p>
              <p className="font-medium text-gray-800 truncate">
                {formatDateTime(solicitud.aprobacion_parcial_at)}
                {solicitud.aprobacion_parcial_por ? ` - ${solicitud.aprobacion_parcial_por}` : ""}
              </p>
            </div>
          )}
          {solicitud.aprobacion_final_at && (
            <div className="text-[11px]">
              <p className="text-gray-500">Aprobación final</p>
              <p className="font-medium text-gray-800 truncate">
                {formatDateTime(solicitud.aprobacion_final_at)}
                {solicitud.aprobacion_final_por ? ` - ${solicitud.aprobacion_final_por}` : ""}
              </p>
            </div>
          )}
        </div>

        {traceabilityItems.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mt-2">
            <p className="text-xs font-semibold text-rose-900 mb-1">Trazabilidad / mensajes relevantes:</p>
            <ul className="space-y-1">
              {traceabilityItems.map((item, idx) => (
                <li key={`${solicitud.id}-trace-${idx}`} className="text-xs text-rose-800">
                  <span className="font-semibold">{item.label}:</span> {item.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasPendingCancellation && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
            <p className="text-amber-700 font-semibold text-[11px] uppercase tracking-tighter">
              Solicitud de cancelación pendiente:
            </p>
            <p className="text-amber-800 text-[11px] mt-0.5">
              {solicitud.cancellation_request_reason || "Sin motivo registrado"}
            </p>
          </div>
        )}

        {hasJustificantes(solicitud) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
            <p className="text-[11px] font-semibold text-blue-900 mb-1.5">Documentos justificantes:</p>
            <div className="flex flex-wrap gap-1.5">
              {solicitud.justificantes_urls.map((url, idx) => (
                <a
                  key={`${solicitud.id}-just-${idx}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-300 rounded text-[10px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <FiEye className="w-3 h-3" />
                  Doc {idx + 1}
                </a>
              ))}
            </div>
            {["entregado", "en_revision", "observado"].includes(String(solicitud.justificante_status || "").toLowerCase()) &&
              (isTalentRole || isApproverOfSolicitud) && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openJustificanteModal(solicitud)}
                  disabled={!!actionLoading}
                  className="text-xs py-1 px-2 bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                >
                  <FiShield className="w-3 h-3 mr-1.5 inline" />
                  Revisar justificante
                </Button>
              </div>
            )}
          </div>
        )}

        {solicitud.pdf_generado_url && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-2">
            <p className="text-[11px] font-semibold text-emerald-900 mb-1.5">Formulario PDF generado:</p>
            <a
              href={solicitud.pdf_generado_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-emerald-300 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <FiDownload className="w-3 h-3" />
              {isCancelledStatus ? "Descargar F.RH-10 cancelado" : "Descargar F.RH-10"}
            </a>
          </div>
        )}

        {canViewLegalForThis && !isRejectedStatus && solicitud.pdf_validacion_legal_url && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mt-2">
            <p className="text-[11px] font-semibold text-slate-900 mb-1.5">Constancia legal de firma:</p>
            <a
              href={solicitud.pdf_validacion_legal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <FiDownload className="w-3 h-3" />
              {isCancelledStatus ? "Descargar validación legal cancelada" : "Descargar validación legal"}
            </a>
          </div>
        )}

        {showAdvancedSignatureWidget && !isRejectedStatus && signatureSummary && (
          <div className={`rounded-lg border p-2 mt-2 ${signatureStatusColor}`}>
            <p className="text-[11px] font-semibold mb-1.5 flex items-center gap-1">
              <FiShield className="w-3 h-3" />
              FamSign workflow ({signatureSummary.estado || "pendiente"})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="font-semibold">Solicitante</p>
                <p>
                  {signatureSummary.solicitud_firmada
                    ? `${signatureSummary.solicitud?.signer_name || "Firmado"} · ${formatDateTime(
                      signatureSummary.solicitud?.signed_at
                    )}`
                    : "Pendiente"}
                </p>
              </div>
              <div>
                <p className="font-semibold">Aprobación</p>
                <p>
                  {signatureSummary.aprobacion_firmada
                    ? `${signatureSummary.aprobacion?.signer_name || "Firmado"} · ${formatDateTime(
                      signatureSummary.aprobacion?.signed_at
                    )}`
                    : "Pendiente"}
                </p>
              </div>
            </div>
          </div>
        )}

        {solicitud.status !== "approved" && solicitud.status !== "aprobado" && (
          <div className="flex gap-2 mt-3">
            {stage === "pending" && (
              <>
                {(() => {
                  const isDirectFinalApproval =
                    !isVacation &&
                    ["estudios", "personal"].includes(String(solicitud?.tipo_permiso || "").toLowerCase());
                  return (
                    <Button
                      variant="primary"
                      onClick={() =>
                        isVacation || isDirectFinalApproval
                          ? handleAprobarFinal(solicitud.id)
                          : handleAprobarParcial(solicitud.id)
                      }
                      disabled={!!actionLoading}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                    >
                      <FiCheck className="w-3.5 h-3.5 mr-1.5" />
                      {isVacation || isDirectFinalApproval ? "Aprobar definitiva" : "Aprobar parcial"}
                    </Button>
                  );
                })()}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedSolicitud(solicitud);
                    setShowRejectModal(true);
                  }}
                  disabled={!!actionLoading}
                  className="flex-1 text-xs py-1.5"
                >
                  <FiX className="w-3.5 h-3.5 mr-1.5" />
                  Rechazar
                </Button>
              </>
            )}

            {stage === "pending_final" && (
              <>
                <Button
                  variant="primary"
                  onClick={() => handleAprobarFinal(solicitud.id)}
                  disabled={!!actionLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                >
                  <FiCheck className="w-3.5 h-3.5 mr-1.5" />
                  Aprobar Final
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedSolicitud(solicitud);
                    setShowRejectModal(true);
                  }}
                  disabled={!!actionLoading}
                  className="flex-1 text-xs py-1.5"
                >
                  <FiX className="w-3.5 h-3.5 mr-1.5" />
                  Rechazar
                </Button>
              </>
            )}
          </div>
        )}
        {stage === "cancellation_pending" && hasPendingCancellation && (
          <div className="mt-3">
            <Button
              variant="primary"
              onClick={() => openCancelModal(solicitud)}
              disabled={!!actionLoading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-xs py-1.5"
            >
              Revisar cancelación
            </Button>
          </div>
        )}
        {canCancelThis && (
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => openCancelModal(solicitud)}
              disabled={!!actionLoading}
              className="w-full bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs py-1.5"
            >
              {requiresCancellationRequestFlow ? "Solicitar cancelacion" : "Cancelar solicitud"}
            </Button>
          </div>
        )}

        {isTalentRole && String(solicitud.provisional_status || "").toLowerCase() === "pendiente_regularizacion" && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-rose-900">Regularización pendiente — acción requerida</p>
            <p className="text-[11px] text-rose-800">
              El justificante fue rechazado. Debes decidir cómo regularizar esta ausencia urgente.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openRegularizacionModal(solicitud, "rechazar_formalmente")}
                disabled={!!actionLoading}
                className="text-xs py-1 px-2 bg-rose-600 text-white hover:bg-rose-700 border-rose-600"
              >
                Rechazar formalmente
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openRegularizacionModal(solicitud, "aceptar_excepcion")}
                disabled={!!actionLoading}
                className="text-xs py-1 px-2 bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600"
              >
                Aceptar por excepción
              </Button>
              {solicitud.vacation_conversion_consent && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleConvertirAVacaciones(solicitud)}
                  disabled={!!actionLoading}
                  className="text-xs py-1 px-2 bg-purple-600 text-white hover:bg-purple-700 border-purple-600"
                >
                  Convertir a vacaciones
                </Button>
              )}
            </div>
            {!solicitud.vacation_conversion_consent && (
              <p className="text-[10px] text-rose-600 italic">
                El colaborador no dio consentimiento para cargo a vacaciones.
              </p>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  const renderEnrollmentCard = (enrollment) => (
    <motion.div
      key={`enrollment-${enrollment.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Matricula</p>
          <h4 className="mt-1 text-sm font-bold text-gray-900 truncate">
            {enrollment.program_name || "Programa no registrado"}
          </h4>
          <p className="text-xs text-gray-600 mt-1 truncate">{getEnrollmentRequesterName(enrollment)}</p>
        </div>
        <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
          ID #{enrollment.id}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 sm:grid-cols-2">
        <div className="text-[11px]">
          <p className="text-gray-500">Institucion</p>
          <p className="font-medium text-gray-800">{enrollment.institution_name || "No registrada"}</p>
        </div>
        <div className="text-[11px]">
          <p className="text-gray-500">Correo</p>
          <p className="font-medium text-gray-800 break-all">{enrollment.user_email || "No disponible"}</p>
        </div>
        <div className="text-[11px]">
          <p className="text-gray-500">Inicio</p>
          <p className="font-medium text-gray-800">{formatDateShort(enrollment.valid_from)}</p>
        </div>
        <div className="text-[11px]">
          <p className="text-gray-500">Vence</p>
          <p className="font-medium text-gray-800">{formatDateShort(enrollment.valid_until)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {enrollment.drive_file_url && (
          <a
            href={enrollment.drive_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <FiEye className="w-3 h-3" />
            Ver soporte
          </a>
        )}
        <Button
          variant="secondary"
          onClick={() => openEnrollmentReviewModal(enrollment, "reject")}
          disabled={!!actionLoading}
          className="text-xs py-1.5"
        >
          <FiX className="w-3.5 h-3.5 mr-1.5" />
          Rechazar
        </Button>
        <Button
          variant="primary"
          onClick={() => openEnrollmentReviewModal(enrollment, "approve")}
          disabled={!!actionLoading}
          className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1.5"
        >
          <FiCheck className="w-3.5 h-3.5 mr-1.5" />
          Aprobar
        </Button>
      </div>
    </motion.div>
  );

  const tabs = [
    { id: "pending", label: "Aprobacion Parcial", icon: FiClock, color: "blue" },
    { id: "pending_final", label: "Aprobacion Final", icon: FiFileText, color: "purple" },
    {
      id: "regularizacion_pendiente",
      label: "Regularización Urgente",
      icon: FiAlertCircle,
      color: "rose",
      hidden: !isTalentRole,
    },
    {
      id: "cancellation_pending",
      label: "Cancelaciones",
      icon: FiAlertCircle,
      color: "rose",
      hidden: !canSeeApproved,
    },
    { id: "study_enrollments", label: "Matriculas", icon: FiFileText, color: "indigo" },
    { id: "approved", label: "Aprobadas Definitivas", icon: FiCheckCircle, color: "emerald", hidden: !canSeeApproved },
  ].filter((tab) => !tab.hidden);

  useEffect(() => {
    if (!urlTab) return;
    const tabToStage = {
      approve: "pending",
      cancellation_requests: "cancellation_pending",
      study_enrollments: "study_enrollments",
      waiting: "pending",
    };
    const targetStage = tabToStage[urlTab];
    if (targetStage) {
      setStage(targetStage);
    }
  }, [urlTab]);

  useEffect(() => {
    if (!urlSolicitudId) return;
    const target = (solicitudes || []).find((s) => String(s?.id) === String(urlSolicitudId));
    if (!target) return;
    setSelectedSolicitud(target);
    if (urlOpenRecovery === "true") {
      openRecoveryEditor(target);
    }
  }, [urlSolicitudId, urlOpenRecovery, solicitudes]);

  useEffect(() => {
    if (!urlEnrollmentId || pendingStudyEnrollments.length === 0) return;
    const target = pendingStudyEnrollments.find((e) => String(e?.id) === String(urlEnrollmentId));
    if (!target) return;
    setSelectedEnrollment(target);
    setEnrollmentReviewDecision("approve");
    setEnrollmentReviewReason("");
    setShowEnrollmentReviewModal(true);
  }, [urlEnrollmentId, pendingStudyEnrollments]);

  useEffect(() => {
    if (location.search && (urlTab || urlSolicitudId || urlEnrollmentId || urlOpenRecovery)) {
      const timer = setTimeout(() => {
        window.history.replaceState(null, "", location.pathname);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeColors = {
    blue: "text-blue-700",
    purple: "text-purple-700",
    indigo: "text-indigo-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
  };
  const barColors = {
    blue: "bg-blue-600",
    purple: "bg-purple-600",
    indigo: "bg-indigo-600",
    emerald: "bg-emerald-600",
    rose: "bg-rose-600",
  };
  const selectedCancellationStatus = String(selectedSolicitud?.cancellation_status || "").toLowerCase();
  const selectedStatus = String(selectedSolicitud?.status || "").toLowerCase();
  const selectedIsRequester =
    Boolean(selectedSolicitud) &&
    ((userId && selectedSolicitud?.user_id && Number(userId) === Number(selectedSolicitud.user_id)) ||
      isSameEmail(userEmail, selectedSolicitud?.user_email));
  const selectedIsApprover =
    Boolean(selectedSolicitud) &&
    canCurrentUserActAsAssignedApprover(selectedSolicitud);
  const selectedRequiresCancellationRequestFlow = false;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="col-span-full py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    if (stage === "study_enrollments") {
      const total = pendingStudyEnrollments.length;
      if (total === 0) {
        return (
          <div className="col-span-full py-12 text-center">
            <FiCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No hay matriculas pendientes</p>
          </div>
        );
      }
      const visible = getVisibleCountForSection(stage);
      return (
        <>
          {pendingStudyEnrollments.slice(0, visible).map(renderEnrollmentCard)}
          <div className="col-span-full">
            {renderListControls(stage, total)}
          </div>
        </>
      );
    }

    const total = solicitudes.length;
    if (total === 0) {
      return (
        <div className="col-span-full py-12 text-center">
          <FiCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {stage === "cancellation_pending"
              ? "No hay solicitudes de cancelacion pendientes"
              : "No hay solicitudes en esta etapa"}
          </p>
        </div>
      );
    }
    const visible = getVisibleCountForSection(stage);
    return (
      <>
        {solicitudes.slice(0, visible).map(renderSolicitudCard)}
        <div className="col-span-full">
          {renderListControls(stage, total)}
        </div>
      </>
    );
  };

  const requestedRecoveryHours = estimateRequestedHoursFromSolicitud(selectedRecoverySolicitud || {});
  const plannedRecoveryHours =
    Math.round(
      (recoveryRows.reduce((acc, row) => acc + Number(computeRecoveryHours(row.start_time, row.end_time) || 0), 0) +
        Number.EPSILON) *
      100,
    ) / 100;
  const isRecoveryPlanComplete = requestedRecoveryHours > 0 && plannedRecoveryHours >= requestedRecoveryHours;
  const selectedRecoveryStatus = String(selectedRecoverySolicitud?.recovery_coordination_status || "").toLowerCase();
  const isSelectedRequester =
    Boolean(selectedRecoverySolicitud) &&
    ((selectedRecoverySolicitud?.user_id && userId && Number(selectedRecoverySolicitud.user_id) === Number(userId)) ||
      (selectedRecoverySolicitud?.user_email &&
        userEmail &&
        String(selectedRecoverySolicitud.user_email).toLowerCase() === userEmail));
  const canSelectedUserApproveRecovery =
    Boolean(selectedRecoverySolicitud) &&
    ["pending_requester_acceptance", "pending_approver_proposal"].includes(selectedRecoveryStatus) &&
    (isSelectedRequester || canCurrentUserActAsAssignedApprover(selectedRecoverySolicitud));
  const canSelectedRequesterCounterPropose =
    selectedRecoveryStatus === "pending_requester_acceptance" && isSelectedRequester;
  const canSelectedApproverFinalize =
    selectedRecoveryStatus === "pending_approver_proposal" &&
    canCurrentUserActAsAssignedApprover(selectedRecoverySolicitud) &&
    Number(selectedRecoverySolicitud?.recovery_coordination_round || 0) > 0;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-base font-bold text-gray-900">Aprobacion de Solicitudes</h3>
          </div>
          <div className="flex gap-1 px-4 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = stage === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStage(tab.id)}
                  className={`relative px-5 py-3 text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive ? activeColors[tab.color] : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4 inline mr-2" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeApprovalTab"
                      className={`absolute bottom-0 left-0 h-0.5 w-full ${barColors[tab.color]}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={gapClass}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rechazar Solicitud</h3>
            <p className="text-sm text-gray-600 mb-4">Por favor, proporciona una razon para el rechazo:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 mb-4"
              placeholder="Escribe la razon del rechazo..."
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (actionLoading) return;
                  setShowRejectModal(false);
                  setSelectedSolicitud(null);
                  setRejectReason("");
                }}
                className={actionButton}
                disabled={!!actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleRechazar}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={!rejectReason.trim() || !!actionLoading}
              >
                Confirmar Rechazo
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedCancellationStatus === "pending"
                ? "Revisar solicitud de cancelacion"
                : selectedRequiresCancellationRequestFlow
                  ? "Solicitar cancelacion"
                  : "Cancelar solicitud"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedCancellationStatus === "pending"
                ? "Registra la decision sobre la cancelacion solicitada por el colaborador."
                : selectedRequiresCancellationRequestFlow
                  ? "Registra el motivo de cancelacion. El jefe inmediato revisara la solicitud."
                  : "Registra el motivo de cancelacion para trazabilidad del flujo."}
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 mb-4"
              placeholder={
                selectedCancellationStatus === "pending"
                  ? "Motivo de revision (obligatorio para rechazo)..."
                  : "Motivo de cancelacion..."
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (actionLoading) return;
                  setShowCancelModal(false);
                  setSelectedSolicitud(null);
                  setCancelReason("");
                }}
                className={actionButton}
                disabled={!!actionLoading}
              >
                Cerrar
              </Button>
              {selectedCancellationStatus === "pending" ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleReviewCancellation("reject")}
                    className="flex-1"
                    disabled={!!actionLoading}
                  >
                    Rechazar cancelacion
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleReviewCancellation("approve")}
                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                    disabled={!!actionLoading}
                  >
                    Aprobar cancelacion
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleCancelar}
                  className="flex-1 bg-rose-600 hover:bg-rose-700"
                  disabled={!cancelReason.trim() || !!actionLoading}
                >
                  {selectedRequiresCancellationRequestFlow
                    ? "Confirmar solicitud"
                    : "Confirmar cancelacion"}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-3xl p-6">
            <h3 className="text-lg font-semibold text-gray-900">Coordinacion de tramos de recuperacion</h3>
            <p className="text-xs text-gray-600 mt-1">
              Define tramos horarios para cubrir las horas pendientes de recuperacion.
            </p>

            <div className="mt-4 space-y-2 max-h-[55vh] overflow-auto pr-1">
              {recoveryRows.map((row, idx) => {
                const computedHours = computeRecoveryHours(row.start_time, row.end_time);
                return (
                  <div
                    key={`modal-recovery-${idx}`}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-lg border border-gray-200 bg-gray-50 p-2"
                  >
                    <div className="sm:col-span-3">
                      <label className="text-[11px] text-gray-600">Fecha</label>
                      <input
                        type="date"
                        value={row.date || ""}
                        onChange={(e) =>
                          setRecoveryRows((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, date: e.target.value } : it)),
                          )
                        }
                        className="w-full border rounded px-2 py-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] text-gray-600">Inicio</label>
                      <input
                        type="time"
                        value={row.start_time || ""}
                        onChange={(e) =>
                          setRecoveryRows((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, start_time: e.target.value } : it)),
                          )
                        }
                        className="w-full border rounded px-2 py-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] text-gray-600">Fin</label>
                      <input
                        type="time"
                        value={row.end_time || ""}
                        onChange={(e) =>
                          setRecoveryRows((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, end_time: e.target.value } : it)),
                          )
                        }
                        className="w-full border rounded px-2 py-1.5"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="text-[11px] text-gray-600">Notas</label>
                      <input
                        type="text"
                        value={row.notes || ""}
                        onChange={(e) =>
                          setRecoveryRows((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, notes: e.target.value } : it)),
                          )
                        }
                        className="w-full border rounded px-2 py-1.5"
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="sm:col-span-1 text-center">
                      <p className="text-[11px] text-gray-600">h</p>
                      <p className="text-xs font-semibold text-indigo-700">{computedHours || "-"}</p>
                    </div>
                    <div className="sm:col-span-12">
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1"
                        onClick={() => setRecoveryRows((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Eliminar tramo
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="secondary"
                disabled={isRecoveryPlanComplete}
                onClick={() =>
                  setRecoveryRows((prev) => [...prev, { date: "", start_time: "", end_time: "", notes: "" }])
                }
              >
                {isRecoveryPlanComplete ? "Limite alcanzado" : "+ Agregar tramo"}
              </Button>
              <p className="text-xs text-gray-600">
                {plannedRecoveryHours}h{requestedRecoveryHours > 0 ? ` / ${requestedRecoveryHours}h` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {canSelectedUserApproveRecovery && (
                  <Button
                    variant="primary"
                    onClick={() => handleSaveRecoveryPlan("accept")}
                    disabled={actionLoading === `recovery-${selectedRecoverySolicitud?.id}`}
                  >
                    Aprobar y cerrar
                  </Button>
                )}
                {canSelectedRequesterCounterPropose && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSaveRecoveryPlan("propose")}
                    disabled={actionLoading === `recovery-${selectedRecoverySolicitud?.id}`}
                  >
                    Proponer nueva
                  </Button>
                )}
                {canSelectedApproverFinalize && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSaveRecoveryPlan("finalize")}
                    disabled={actionLoading === `recovery-${selectedRecoverySolicitud?.id}`}
                  >
                    Definir definitivo
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => handleSaveRecoveryPlan("propose")}
                  disabled={actionLoading === `recovery-${selectedRecoverySolicitud?.id}`}
                >
                  Guardar plan
                </Button>
              </div>
            </div>

            {isRecoveryPlanComplete && (
              <p className="mt-2 text-xs text-emerald-700">
                Se alcanzaron las horas solicitadas. No puedes agregar mas tramos.
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  if (actionLoading) return;
                  setShowRecoveryModal(false);
                  setSelectedRecoverySolicitud(null);
                  setRecoveryRows([]);
                }}
              >
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showRegularizacionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {regularizacionAction === "rechazar_formalmente" ? "Rechazar formalmente" : "Aceptar por excepción"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Solicitante: {regularizacionSolicitud?.user_fullname || regularizacionSolicitud?.user_email}
            </p>
            {regularizacionAction === "aceptar_excepcion" && (
              <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs text-emerald-800">
                  La solicitud quedará en estado <strong>aceptado por excepción</strong> y pasará a aprobación final.
                </p>
              </div>
            )}
            {regularizacionAction === "rechazar_formalmente" && (
              <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-800">
                  La solicitud será <strong>rechazada de forma definitiva</strong>. El colaborador recibirá notificación con el motivo.
                </p>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (requerido)</label>
              <textarea
                value={regularizacionReason}
                onChange={(e) => setRegularizacionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Explica el fundamento de la decisión..."
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (actionLoading) return;
                  setShowRegularizacionModal(false);
                  setRegularizacionSolicitud(null);
                  setRegularizacionReason("");
                }}
                className="flex-1"
                disabled={!!actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmRegularizacion}
                disabled={!!actionLoading || !regularizacionReason.trim()}
                className={
                  regularizacionAction === "rechazar_formalmente"
                    ? "flex-1 bg-rose-600 hover:bg-rose-700"
                    : "flex-1 bg-emerald-600 hover:bg-emerald-700"
                }
              >
                Confirmar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showJustificanteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Revisar justificante</h3>
            <p className="text-xs text-gray-500 mb-4">
              Solicitante: {justificanteSolicitud?.user_fullname || justificanteSolicitud?.user_email}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Decisión</label>
              <select
                value={justificanteDecision}
                onChange={(e) => setJustificanteDecision(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="aceptado">Aceptado — procede, pasa a aprobación final</option>
                <option value="observado">Observado — solicitar resubmisión al colaborador</option>
                <option value="rechazado">Rechazado — queda pendiente de regularización</option>
              </select>
            </div>
            {(justificanteDecision === "rechazado" || justificanteDecision === "observado") && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (requeridas)</label>
                <textarea
                  value={justificanteObservations}
                  onChange={(e) => setJustificanteObservations(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Indica qué falta o por qué se rechaza..."
                />
              </div>
            )}
            {justificanteDecision === "rechazado" && (
              <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-800">
                  El rechazo dejará la solicitud en estado <strong>pendiente de regularización</strong>.
                  Talento Humano deberá decidir si rechazarla formalmente, aceptarla por excepción o convertirla a vacaciones.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (actionLoading) return;
                  setShowJustificanteModal(false);
                  setJustificanteSolicitud(null);
                  setJustificanteObservations("");
                }}
                className={actionButton}
                disabled={!!actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleRevisarJustificante}
                disabled={
                  !!actionLoading ||
                  ((justificanteDecision === "rechazado" || justificanteDecision === "observado") && !justificanteObservations.trim())
                }
                className={
                  justificanteDecision === "aceptado"
                    ? "flex-1 bg-emerald-600 hover:bg-emerald-700"
                    : justificanteDecision === "observado"
                      ? "flex-1 bg-amber-600 hover:bg-amber-700"
                      : "flex-1 bg-rose-600 hover:bg-rose-700"
                }
              >
                Confirmar revisión
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showEnrollmentReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {enrollmentReviewDecision === "approve" ? "Aprobar matricula" : "Rechazar matricula"}
            </h3>

            {enrollmentReviewDecision === "reject" ? (
              <>
                <p className="text-sm text-gray-600 mb-4">Debes registrar el motivo del rechazo:</p>
                <textarea
                  value={enrollmentReviewReason}
                  onChange={(e) => setEnrollmentReviewReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
                  placeholder="Motivo del rechazo"
                />
              </>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                Se validara la matricula y quedara habilitada para permisos por estudios.
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (actionLoading) return;
                  setShowEnrollmentReviewModal(false);
                  setSelectedEnrollment(null);
                  setEnrollmentReviewReason("");
                }}
                className={actionButton}
                disabled={!!actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleReviewEnrollment}
                className={
                  enrollmentReviewDecision === "approve"
                    ? "flex-1 bg-emerald-600 hover:bg-emerald-700"
                    : "flex-1 bg-red-600 hover:bg-red-700"
                }
                disabled={enrollmentReviewDecision === "reject" && !enrollmentReviewReason.trim()}
              >
                {enrollmentReviewDecision === "approve" ? "Aprobar matricula" : "Confirmar rechazo"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export default AprobacionPermisosView;
