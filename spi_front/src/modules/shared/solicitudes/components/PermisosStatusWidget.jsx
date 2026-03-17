import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiClock,
  FiCheck,
  FiFileText,
  FiDownload,
  FiAlertCircle,
  FiUpload,
  FiEye,
  FiUsers,
  FiShield,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/AuthContext";
import { STATUS_META, getTipoLabel, formatDateShort, hasJustificantes } from "../utils/solicitudesHelpers";
import { formatVacationDaysHours } from "../utils/vacationDisplay";
import {
  getMisSolicitudes,
  getPendientes,
  aprobarParcial,
  aprobarFinal,
  rechazar,
  cancelarSolicitud,
  revisarCancelacionSolicitud,
  updateRecoveryPlan,
  getPendingStudyEnrollments,
  reviewStudyEnrollment,
} from "../../../../core/api/permisosApi";
import UploadJustificantesModal from "../modals/UploadJustificantesModal";
import { getActiveException } from "../../../../core/api/attendanceApi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { formatTimeSafe } from "../../../../shared/utils/dateUtils";

const normalizeRole = (value = "") => value.toLowerCase();
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

const formatEnrollmentDate = (value) => {
  const normalized = normalizeDateOnly(value);
  return normalized ? formatDateShort(normalized) : "No disponible";
};

const getEnrollmentRequesterName = (enrollment = {}) =>
  enrollment?.user_fullname || enrollment?.user_email || "No disponible";

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

const getTodayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const canCancelByDateRule = (solicitud = {}) => {
  const startDate = normalizeDateOnly(solicitud?.fecha_inicio || solicitud?.fecha_inicio_hora);
  if (!startDate) return false;
  return getTodayLocalDate() <= startDate;
};

const RECOVERY_COORDINATION_LABELS = {
  not_required: "No requiere coordinación",
  pending_approver_proposal: "Pendiente propuesta del jefe inmediato",
  pending_requester_acceptance: "Pendiente aceptación del solicitante",
  agreed: "Coordinación aprobada y cerrada",
  finalized_by_approver: "Tramos definidos por jefe inmediato",
};

const INITIAL_VISIBLE_COUNTS = {
  mine: 8,
  approve: 8,
  study_enrollments: 6,
  waiting: 8,
  upload_docs: 6,
};

const getRecoveryCoordinationLabel = (solicitud = {}) => {
  const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
  if (coordinationStatus === "finalized_by_approver" && solicitud?.charged_to_vacation) {
    return "Sin acuerdo; cargado a vacaciones";
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
  const gerenciaGeneralRoles = new Set(["gerencia_general", "gerente_general"]);

  const roleCandidates = expandRoleAliases([role, scope].filter(Boolean));
  const isJefe = [
    "jefe_comercial",
    "jefe_financiero",
    "jefe_finanzas",
    "jefe_operaciones",
    "jefe_calidad",
    "jefe_tecnico",
    "jefe_ti",
    "jefe_logistica",
  ].some((r) =>
    roleCandidates.some((candidate) => candidate.includes(r))
  );
  const isGerencia = gerenciaGeneralRoles.has(role) || gerenciaGeneralRoles.has(scope);
  const isApprover = isJefe || isGerencia;
  const isTalentRole = ["talento_humano", "jefe_talento_humano", "talento-humano", "jefe_financiero", "jefe_finanzas"].includes(scope);
  const showAdvancedSignatureWidget = roleCandidates.some((candidate) =>
    ["jefe_financiero", "jefe_finanzas", "jefe_ti"].includes(candidate)
  );
  const canViewLegalValidationDoc = roleCandidates.some((candidate) =>
    ["jefe_financiero", "jefe_finanzas", "jefe_ti", "gerencia_general", "gerente_general"].includes(candidate)
  );

  const [activeTab, setActiveTab] = useState("mine");
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [pendientesParcial, setPendientesParcial] = useState([]);
  const [pendientesFinal, setPendientesFinal] = useState([]);
  const [pendientesAprobadas, setPendientesAprobadas] = useState([]);
  const [pendientesCancelacion, setPendientesCancelacion] = useState([]);
  const [pendingStudyEnrollments, setPendingStudyEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showEnrollmentReviewModal, setShowEnrollmentReviewModal] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [enrollmentReviewDecision, setEnrollmentReviewDecision] = useState("approve");
  const [enrollmentReviewReason, setEnrollmentReviewReason] = useState("");
  const [visibleItemsBySection, setVisibleItemsBySection] = useState(INITIAL_VISIBLE_COUNTS);
  const [recoveryRows, setRecoveryRows] = useState([]);
  const [activeException, setActiveException] = useState(null);
  const refreshPromiseRef = useRef(null);

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

  const getTimestampValue = (value) => {
    const normalized = normalizeDateValue(value);
    if (!normalized) return 0;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
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


  const canSeeSolicitudForApproval = (solicitud) => {
    if (!solicitud) return false;
    const approverRole = (solicitud.approver_role || "").toLowerCase();
    const approverEmail = (solicitud.approver_email || "").toLowerCase();
    const approverUserId = solicitud.approver_user_id;
    if (approverUserId && userId && approverUserId === userId) return true;
    if (approverEmail && userEmail && approverEmail === userEmail.toLowerCase()) return true;
    if (approverRole) {
      if (gerenciaGeneralRoles.has(approverRole)) {
        return roleCandidates.some((candidate) => gerenciaGeneralRoles.has(candidate));
      }
      return roleCandidates.includes(approverRole);
    }
    if (isGerencia) return true;
    return false;
  };

  const canCurrentUserActAsAssignedApprover = (solicitud) => {
    if (!solicitud) return false;
    const approverRole = (solicitud.approver_role || "").toLowerCase();
    const approverEmail = (solicitud.approver_email || "").toLowerCase();
    const approverUserId = solicitud.approver_user_id;
    if (approverUserId && userId && Number(approverUserId) === Number(userId)) return true;
    if (approverEmail && userEmail && approverEmail === userEmail.toLowerCase()) return true;
    if (approverRole) {
      if (gerenciaGeneralRoles.has(approverRole)) {
        return roleCandidates.some((candidate) => gerenciaGeneralRoles.has(candidate));
      }
      return roleCandidates.includes(approverRole);
    }
    return false;
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

  const isApprovedSolicitud = (solicitud) =>
    ["approved", "aprobado"].includes(String(solicitud?.status || "").toLowerCase());

  const isCoordinationPendingSolicitud = (solicitud) => {
    if (!isApprovedSolicitud(solicitud) || !solicitud?.es_recuperable) return false;
    const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
    return ["pending_approver_proposal", "pending_requester_acceptance"].includes(coordinationStatus);
  };

  const canCurrentUserCancelSolicitud = (solicitud) => {
    const cancellationStatus = String(solicitud?.cancellation_status || "none").toLowerCase();
    return (
      isApprovedSolicitud(solicitud) &&
      cancellationStatus !== "pending" &&
      canCancelByDateRule(solicitud) &&
      canCurrentUserActAsAssignedApprover(solicitud)
    );
  };

  const getApprovalSortTimestamp = (solicitud) =>
    Math.max(
      getTimestampValue(solicitud?.cancellation_requested_at),
      getTimestampValue(solicitud?.recovery_plan_updated_at),
      getTimestampValue(solicitud?.aprobacion_final_at),
      getTimestampValue(solicitud?.aprobacion_parcial_at),
      getTimestampValue(solicitud?.updated_at),
      getTimestampValue(solicitud?.created_at)
    );

  const fetchActiveException = async () => {
    try {
      const response = await getActiveException();
      if (response?.ok) {
        setActiveException(response.data || null);
      } else {
        setActiveException(null);
      }
    } catch (error) {
      console.error("Error fetching active exception:", error);
      setActiveException(null);
    }
  };

  const loadData = async ({ silent = false } = {}) => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      if (!silent) setLoading(true);
      try {
        const requests = [getMisSolicitudes()];
        if (isApprover) {
          requests.push(getPendientes("pending"));
          requests.push(getPendientes("pending_final"));
          requests.push(getPendientes("approved"));
          requests.push(getPendientes("cancellation_pending"));
          requests.push(getPendingStudyEnrollments());
        }
        const [mineResp, pendingResp, finalResp, approvedResp, cancellationResp, enrollmentResp] = await Promise.all(requests);

        if (mineResp?.ok) {
          setMisSolicitudes((mineResp.data || []).map(normalizeSolicitudDates));
        }
        if (pendingResp?.ok) {
          const filtered = (pendingResp.data || [])
            .map(normalizeSolicitudDates)
            .filter((s) => s.user_email !== userEmail)
            .filter((s) => canSeeSolicitudForApproval(s));
          setPendientesParcial(filtered);
        } else {
          setPendientesParcial([]);
        }
        if (finalResp?.ok) {
          const filtered = (finalResp.data || [])
            .map(normalizeSolicitudDates)
            .filter((s) => s.user_email !== userEmail)
            .filter((s) => canSeeSolicitudForApproval(s));
          setPendientesFinal(filtered);
        } else {
          setPendientesFinal([]);
        }
        if (approvedResp?.ok) {
          const filtered = (approvedResp.data || [])
            .map(normalizeSolicitudDates)
            .filter((s) => s.user_email !== userEmail)
            .filter((s) => canSeeSolicitudForApproval(s));
          setPendientesAprobadas(filtered);
        } else {
          setPendientesAprobadas([]);
        }
        if (cancellationResp?.ok) {
          const filtered = (cancellationResp.data || [])
            .map(normalizeSolicitudDates)
            .filter((s) => s.user_email !== userEmail)
            .filter((s) => canSeeSolicitudForApproval(s));
          setPendientesCancelacion(filtered);
        } else {
          setPendientesCancelacion([]);
        }
        if (enrollmentResp?.ok) {
          setPendingStudyEnrollments(Array.isArray(enrollmentResp.data) ? enrollmentResp.data : []);
        } else {
          setPendingStudyEnrollments([]);
        }
      } catch (error) {
        console.error("Error loading permisos:", error);
        if (!silent) showToast("Error al cargar solicitudes", "error");
      } finally {
        if (!isTalentRole) {
          await fetchActiveException();
        }
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

  const handleAprobarParcial = async (id) => {
    await runActionWithLoader(id, "Aprobando solicitud...", async () => {
      try {
        const response = await aprobarParcial(id);
        if (response.ok) {
          const nextStatus = String(response?.data?.status || "").toLowerCase();
          if (nextStatus === "approved") {
            showToast("Aprobado definitivamente.", "success");
          } else {
            showToast("Aprobado parcialmente. El colaborador debe subir documentos.", "success");
          }
          await loadData();
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
        if (response.ok) {
          showToast("Aprobado definitivamente. PDF generado en Drive.", "success");
          await loadData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al aprobar", "error");
      }
    });
  };

  const handleRechazar = async () => {
    if (!selectedSolicitud || !rejectReason.trim()) {
      showToast("Debes proporcionar una razon de rechazo", "warning");
      return;
    }

    await runActionWithLoader(selectedSolicitud.id, "Rechazando solicitud...", async () => {
      try {
        const response = await rechazar(selectedSolicitud.id, rejectReason);
        if (response.ok) {
          showToast("Solicitud rechazada", "success");
          setShowRejectModal(false);
          setSelectedSolicitud(null);
          setRejectReason("");
          await loadData();
        }
      } catch (error) {
        showToast(error.response?.data?.message || "Error al rechazar", "error");
      }
    });
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

  const handleReviewCancellation = async (solicitud, decision) => {
    const reviewReason = String(cancelReason || "").trim();
    if (decision === "reject" && !reviewReason) {
      showToast("Debes indicar el motivo del rechazo", "warning");
      return;
    }
    await runActionWithLoader(
      solicitud.id,
      decision === "approve" ? "Aprobando cancelación..." : "Rechazando cancelación...",
      async () => {
        try {
          const response = await revisarCancelacionSolicitud(
            solicitud.id,
            decision,
            reviewReason || null
          );
          if (response?.ok) {
            showToast(
              decision === "approve"
                ? "Cancelación aprobada"
                : "Cancelación rechazada",
              "success"
            );
            setShowCancelModal(false);
            setSelectedSolicitud(null);
            setCancelReason("");
            await loadData();
          }
        } catch (error) {
          showToast(error.response?.data?.message || "Error revisando cancelación", "error");
        }
      }
    );
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
      enrollmentReviewDecision === "approve" ? "Aprobando matrícula..." : "Rechazando matrícula...",
      async () => {
        try {
          const response = await reviewStudyEnrollment(
            selectedEnrollment.id,
            enrollmentReviewDecision,
            reason || null
          );
          if (response?.ok) {
            showToast(
              enrollmentReviewDecision === "approve" ? "Matrícula validada" : "Matrícula rechazada",
              "success"
            );
            setShowEnrollmentReviewModal(false);
            setSelectedEnrollment(null);
            setEnrollmentReviewReason("");
            await loadData();
          }
        } catch (error) {
          showToast(error.response?.data?.message || "Error revisando matrícula", "error");
        }
      }
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
    setSelectedSolicitud(solicitud);
    setRecoveryRows(
      currentPlan.length > 0
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
  const canSelectedUserApproveRecovery =
    Boolean(selectedSolicitud) &&
    ["pending_requester_acceptance", "pending_approver_proposal"].includes(selectedRecoveryStatus) &&
    ((userId && selectedSolicitud?.user_id && Number(userId) === Number(selectedSolicitud.user_id)) ||
      canCurrentUserActAsAssignedApprover(selectedSolicitud));
  const canSelectedRequesterCounterPropose =
    selectedRecoveryStatus === "pending_requester_acceptance" &&
    userId &&
    selectedSolicitud?.user_id &&
    Number(userId) === Number(selectedSolicitud.user_id);
  const canSelectedApproverFinalize =
    selectedRecoveryStatus === "pending_approver_proposal" &&
    canCurrentUserActAsAssignedApprover(selectedSolicitud) &&
    Number(selectedSolicitud?.recovery_coordination_round || 0) > 0;

  const pendientesDeJustificante = useMemo(
    () =>
      misSolicitudes.filter(
        (sol) =>
          sol.status === "partially_approved" &&
          Array.isArray(sol.justificacion_requerida) &&
          sol.justificacion_requerida.length > 0
      ),
    [misSolicitudes]
  );

  const misEsperandoGerencia = useMemo(
    () => misSolicitudes.filter((sol) => sol.status === "pending_final"),
    [misSolicitudes]
  );

  const approvalQueue = (() => {
    const itemsById = new Map();

    const upsert = (solicitud, kinds = []) => {
      if (!solicitud || kinds.length === 0) return;
      const existing = itemsById.get(solicitud.id);
      if (existing) {
        existing.approvalQueueKinds = Array.from(
          new Set([...(existing.approvalQueueKinds || []), ...kinds])
        );
        return;
      }
      itemsById.set(solicitud.id, {
        ...solicitud,
        approvalQueueKinds: kinds,
      });
    };

    pendientesParcial.forEach((solicitud) => upsert(solicitud, ["approval_pending"]));
    pendientesFinal.forEach((solicitud) => upsert(solicitud, ["approval_pending"]));
    pendientesCancelacion.forEach((solicitud) => upsert(solicitud, ["cancellation_pending"]));
    pendientesAprobadas.forEach((solicitud) => {
      const kinds = [];
      if (isCoordinationPendingSolicitud(solicitud)) kinds.push("coordination_pending");
      if (canCurrentUserCancelSolicitud(solicitud)) kinds.push("cancellable");
      upsert(solicitud, kinds);
    });

    return Array.from(itemsById.values()).sort(
      (left, right) => getApprovalSortTimestamp(right) - getApprovalSortTimestamp(left)
    );
  })();

  const exceptionStatus = activeException?.status || "NONE";
  const exceptionStepLabel =
    {
      ACTIVE: "En ruta",
      ON_SITE: "En sitio",
      RETURNING: "Regresando",
      COMPLETED: "Completada",
      NONE: "Sin salidas inesperadas",
    }[exceptionStatus] || "Sin salidas inesperadas";

  const exceptionTimeEntries = activeException
    ? [
        {
          label: "Salida inesperada",
          value: activeException.start_time,
          colors: "bg-amber-50 border-amber-200 text-amber-800",
          note: activeException.type ? activeException.type.replace(/_/g, " ").toUpperCase() : "Sin motivo",
        },
        {
          label: "Llegada a destino",
          value: activeException.arrival_time,
          colors: "bg-orange-50 border-orange-200 text-orange-800",
          note: exceptionStatus === "ON_SITE" ? "Llegaste" : "Pendiente",
        },
        {
          label: "Salida del destino",
          value: activeException.departure_time,
          colors: "bg-yellow-50 border-yellow-200 text-yellow-800",
          note: exceptionStatus === "RETURNING" ? "Regresando" : "Pendiente",
        },
        {
          label: "Regreso a oficina",
          value: activeException.return_time,
          colors: "bg-emerald-50 border-emerald-200 text-emerald-800",
          note: exceptionStatus === "COMPLETED" ? "Completado" : "Pendiente",
        },
      ]
    : [];

  const tabs = useMemo(() => {
    const base = [
      { id: "mine", label: "Mis solicitudes", count: misSolicitudes.length, visible: true },
    ];
    if (isApprover) {
      base.push({
        id: "approve",
        label: isGerencia ? "Aprobar final" : "Aprobar",
        count: approvalQueue.length,
        visible: true,
        icon: FiCheck,
      });
      if (pendingStudyEnrollments.length > 0) {
        base.push({
          id: "study_enrollments",
          label: "Matrículas",
          count: pendingStudyEnrollments.length,
          visible: true,
          icon: FiFileText,
        });
      }
    }
    if (isJefe) {
      base.push({
        id: "waiting",
        label: "Esperando gerencia",
        count: misEsperandoGerencia.length,
        visible: true,
      });
    }
    return base.filter((t) => t.visible);
  }, [
    misSolicitudes.length,
    approvalQueue.length,
    pendingStudyEnrollments.length,
    misEsperandoGerencia.length,
    isApprover,
    isGerencia,
    isJefe,
  ]);

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

  const renderStatusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.pending;
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md ${meta.color}`}>
        <Icon className="w-3 h-3" />
        {meta.label}
      </span>
    );
  };

  const renderSolicitudCard = (solicitud, options = {}) => {
    const { showActions = false, showUser = false, showDocs = false } = options;
    const shouldShowDocs = (showActions || showDocs) && hasJustificantes(solicitud);
    const hasRequiredJustification =
      Array.isArray(solicitud?.justificacion_requerida) && solicitud.justificacion_requerida.length > 0;
    const requiresUpload = solicitud.status === "partially_approved" && hasRequiredJustification && !showActions;
    const isVacation = solicitud.tipo_solicitud === "vacaciones";
    const approverDisplay =
      solicitud.approver_email ||
      solicitud.approver_role ||
      (solicitud.approver_user_id ? `Usuario #${solicitud.approver_user_id}` : "No asignado");
    const rejectionNotes = Array.isArray(solicitud.observaciones)
      ? solicitud.observaciones.filter(Boolean)
      : solicitud.observaciones
      ? [solicitud.observaciones]
      : [];
    const traceabilityItems = [];
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
    if (solicitud?.cancellation_review_reason) {
      traceabilityItems.push({
        label: "Motivo revisión de cancelación",
        text: solicitud.cancellation_review_reason,
      });
    }
    if (solicitud?.cancellation_reason) {
      traceabilityItems.push({
        label: "Motivo final de cancelación",
        text: solicitud.cancellation_reason,
      });
    }
    const signatureSummary = solicitud.firma_avanzada_resumen || null;
    const normalizedStatus = String(solicitud?.status || "").toLowerCase();
    const isRejectedStatus = ["rejected", "rechazado"].includes(normalizedStatus);
    const isCancelledStatus = ["cancelled", "cancelado"].includes(normalizedStatus);
    const timeRange = formatTimeRange(solicitud);
    const vacationShift = isVacation ? getVacationShiftLabel(solicitud) : null;
    const recoveryPlan = Array.isArray(solicitud?.recovery_plan) ? solicitud.recovery_plan : [];
    const recoveryTotal = Number(solicitud?.recovery_plan_total_hours || 0);
    const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
    const isRequesterOfSolicitud = Boolean(userId && solicitud?.user_id && Number(userId) === Number(solicitud.user_id));
    const isApproverOfSolicitud = canCurrentUserActAsAssignedApprover(solicitud);
    const canEditRecovery =
      Boolean(solicitud?.es_recuperable) &&
      !["agreed", "finalized_by_approver"].includes(coordinationStatus) &&
      !["rejected", "rechazado", "cancelled", "cancelado"].includes(normalizedStatus) &&
      (isRequesterOfSolicitud || isApproverOfSolicitud);
    const canApproveRecoveryProposal =
      (isRequesterOfSolicitud || isApproverOfSolicitud) &&
      ["pending_approver_proposal", "pending_requester_acceptance"].includes(coordinationStatus) &&
      recoveryPlan.length > 0;
    const canApproverFinalize =
      isApproverOfSolicitud &&
      coordinationStatus === "pending_approver_proposal" &&
      Number(solicitud?.recovery_coordination_round || 0) > 0 &&
      recoveryPlan.length > 0;
    const cancellationStatus = String(solicitud?.cancellation_status || "none").toLowerCase();
    const canCancelThis =
      ["approved", "aprobado"].includes(normalizedStatus) &&
      cancellationStatus !== "pending" &&
      canCancelByDateRule(solicitud) &&
      (isRequesterOfSolicitud || isApproverOfSolicitud);
    const hasPendingCancellation = cancellationStatus === "pending";
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
    const recoveryCoordinationDeadline = getRecoveryCoordinationDeadline(solicitud);
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
            solicitud.status === "approved"
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
              {renderStatusBadge(solicitud.status)}
            </div>
            {showUser && (
              <p className="text-xs text-gray-600 mb-1">
                <FiUsers className="inline mr-1" />
                {solicitud.user_fullname || solicitud.user_email || "Sin solicitante"}
                {solicitud.user_email && solicitud.user_fullname ? (
                  <span className="text-[11px] text-gray-500 ml-1">({solicitud.user_email})</span>
                ) : null}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {formatDateShort(solicitud.fecha_inicio)} - {formatDateShort(solicitud.fecha_fin)}
              </span>
              <span className="font-medium text-gray-700">
                {solicitud.duracion_horas ? `${solicitud.duracion_horas}h` : `${solicitud.duracion_dias}d`}
              </span>
              {timeRange && <span className="font-medium text-indigo-700">{timeRange}</span>}
            </div>
          </div>

          {/* Acciones de subida cuando esta parcialmente aprobada (colaborador) */}
          {requiresUpload && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setSelectedSolicitud(solicitud);
                setShowUploadModal(true);
              }}
              className="text-xs px-3 py-1.5"
            >
              <FiUpload className="w-3 h-3 mr-1" />
              Subir docs
            </Button>
          )}
        </div>

        {solicitud.es_recuperable && (
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
            <p className="text-[11px] text-emerald-800 mt-1">
              Estado: {getRecoveryCoordinationLabel(solicitud)}
            </p>
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

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
          <div className="text-xs">
            <p className="text-gray-500">Solicitud</p>
            <p className="font-medium text-gray-800">#{showUser ? solicitud.id : solicitud.requester_sequence || solicitud.id}</p>
          </div>
          <div className="text-xs">
            <p className="text-gray-500">Enviada</p>
            <p className="font-medium text-gray-800">{formatDateTime(solicitud.created_at)}</p>
          </div>
          <div className="text-xs">
            <p className="text-gray-500">Tipo detalle</p>
            <p className="font-medium text-gray-800">
              {isVacation
                ? `Vacaciones${solicitud.periodo_vacaciones ? ` (${solicitud.periodo_vacaciones})` : ""}`
                : solicitud.tipo_permiso || "Permiso"}
            </p>
          </div>
          {hasPendingCancellation && (
            <div className="text-xs sm:col-span-2">
              <p className="text-amber-700 font-semibold">Cancelación pendiente de revisión</p>
              <p className="text-gray-700">
                Motivo solicitado: {solicitud.cancellation_request_reason || solicitud.cancellation_reason || "No registrado"}
              </p>
            </div>
          )}
          <div className="text-xs">
            <p className="text-gray-500">Aprobador asignado</p>
            <p className="font-medium text-gray-800">{approverDisplay}</p>
          </div>
          {timeRange && (
            <div className="text-xs">
              <p className="text-gray-500">Rango horario</p>
              <p className="font-medium text-gray-800">{timeRange}</p>
            </div>
          )}
          {vacationShift && (
            <div className="text-xs">
              <p className="text-gray-500">Jornada</p>
              <p className="font-medium text-gray-800">{vacationShift}</p>
            </div>
          )}
          {solicitud.aprobacion_parcial_at && (
            <div className="text-xs">
              <p className="text-gray-500">Aprobacion parcial</p>
              <p className="font-medium text-gray-800">
                {formatDateTime(solicitud.aprobacion_parcial_at)}
                {solicitud.aprobacion_parcial_por ? ` - ${solicitud.aprobacion_parcial_por}` : ""}
              </p>
            </div>
          )}
          {solicitud.aprobacion_final_at && (
            <div className="text-xs">
              <p className="text-gray-500">Aprobacion final</p>
              <p className="font-medium text-gray-800">
                {formatDateTime(solicitud.aprobacion_final_at)}
                {solicitud.aprobacion_final_por ? ` - ${solicitud.aprobacion_final_por}` : ""}
              </p>
            </div>
          )}
        </div>

        {requiresUpload && (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800">
              Sube la evidencia solicitada para que pase a revision final.
            </p>
            {Array.isArray(solicitud.justificacion_requerida) && solicitud.justificacion_requerida.length > 0 && (
              <p className="mt-1 text-[11px] text-blue-700">
                Documentos requeridos: {solicitud.justificacion_requerida.join(", ")}.
              </p>
            )}
          </div>
        )}

        {shouldShowDocs && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
            <p className="text-xs font-semibold text-blue-900 mb-1.5">Documentos justificantes:</p>
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

        {solicitud.pdf_generado_url && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-2">
            <p className="text-xs font-semibold text-emerald-900 mb-1.5">Formulario PDF generado:</p>
            <a
              href={solicitud.pdf_generado_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <FiDownload className="w-3 h-3" />
              {isCancelledStatus ? "Descargar F.RH-10 cancelado" : "Descargar F.RH-10"}
            </a>
          </div>
        )}

        {canViewLegalForThis && !isRejectedStatus && solicitud.pdf_validacion_legal_url && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mt-2">
            <p className="text-xs font-semibold text-slate-900 mb-1.5">Constancia legal de firma:</p>
            <a
              href={solicitud.pdf_validacion_legal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <FiDownload className="w-3 h-3" />
              {isCancelledStatus ? "Descargar validacion legal cancelada" : "Descargar validacion legal"}
            </a>
            {solicitud.legal_verification_token && (
              <p className="mt-2 text-[11px] text-slate-600 break-all">
                Token: {solicitud.legal_verification_token}
              </p>
            )}
          </div>
        )}

        {showAdvancedSignatureWidget && !isRejectedStatus && signatureSummary && (
          <div className={`rounded-lg border p-2 mt-2 ${signatureStatusColor}`}>
            <p className="text-xs font-semibold mb-1.5 flex items-center gap-1">
              <FiShield className="w-3 h-3" />
              FamSign workflow ({signatureSummary.estado || "pendiente"})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="font-semibold">Solicitante</p>
                <p>
                  {signatureSummary.solicitud_firmada
                    ? `${signatureSummary.solicitud?.signer_name || "Firmado"} Â· ${formatDateTime(
                        signatureSummary.solicitud?.signed_at
                      )}`
                    : "Pendiente"}
                </p>
              </div>
              <div>
                <p className="font-semibold">Aprobacion</p>
                <p>
                  {signatureSummary.aprobacion_firmada
                    ? `${signatureSummary.aprobacion?.signer_name || "Firmado"} Â· ${formatDateTime(
                        signatureSummary.aprobacion?.signed_at
                      )}`
                    : "Pendiente"}
                </p>
              </div>
              {signatureSummary.aprobacion?.payload_hash_sha256 && (
                <div className="sm:col-span-2">
                  <p className="font-semibold">SHA-256</p>
                  <p className="font-mono break-all">
                    {String(signatureSummary.aprobacion.payload_hash_sha256).slice(0, 20)}...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

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

        {showActions && (hasPendingCancellation || solicitud.status === "pending" || solicitud.status === "pending_final") && (
          <div className="space-y-2 mt-3">
            <div className="flex gap-2">
              {hasPendingCancellation && (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setSelectedSolicitud(solicitud);
                      setCancelReason("");
                      setShowCancelModal(true);
                    }}
                    disabled={actionLoading === solicitud.id}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-xs py-1.5"
                  >
                    Revisar cancelación
                  </Button>
                </>
              )}
              {solicitud.status === "pending" && (
                <>
                  {(() => {
                    const isDirectFinalApproval =
                      !isVacation &&
                      ["estudios", "personal"].includes(String(solicitud?.tipo_permiso || "").toLowerCase());
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          isVacation
                            ? handleAprobarFinal(solicitud.id)
                            : handleAprobarParcial(solicitud.id)
                        }
                        disabled={actionLoading === solicitud.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                      >
                        {actionLoading === solicitud.id
                          ? "..."
                          : isVacation || isDirectFinalApproval
                          ? "Aprobar definitiva"
                          : "Aprobar parcial"}
                      </Button>
                    );
                  })()}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedSolicitud(solicitud);
                      setRejectReason("");
                      setShowRejectModal(true);
                    }}
                    className="flex-1 text-xs py-1.5"
                  >
                    Rechazar
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
                    {actionLoading === solicitud.id ? "..." : "Aprobar final"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedSolicitud(solicitud);
                      setRejectReason("");
                      setShowRejectModal(true);
                    }}
                    className="flex-1 text-xs py-1.5"
                  >
                    Rechazar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {canCancelThis && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedSolicitud(solicitud);
                setCancelReason("");
                setShowCancelModal(true);
              }}
              className="w-full text-xs py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100"
            >
              Cancelar solicitud
            </Button>
          </div>
        )}
        {hasPendingCancellation && !showActions && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-xs text-amber-800">
              La cancelación está pendiente de aprobación del jefe inmediato.
            </p>
          </div>
        )}
      </motion.div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === "mine") {
      if (misSolicitudes.length === 0) {
        return (
          <div className="text-center py-10">
            <FiFileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No tienes solicitudes</p>
            <p className="text-xs text-gray-500 mt-1">Crea una nueva solicitud para comenzar</p>
          </div>
        );
      }
      const visibleItems = misSolicitudes.slice(0, getVisibleCountForSection("mine"));
      return (
        <>
          {visibleItems.map((sol) =>
            renderSolicitudCard(sol, {
              showDocs: sol.status === "pending_final" || sol.status === "approved",
            })
          )}
          {renderListControls("mine", misSolicitudes.length)}
        </>
      );
    }

    if (activeTab === "approve") {
      if (!isApprover) return null;
      if (approvalQueue.length === 0) {
        return (
          <div className="text-center py-10">
            <FiCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No hay solicitudes pendientes</p>
            <p className="text-xs text-gray-500 mt-1">Nada por aprobar en este momento</p>
          </div>
        );
      }
      const visibleItems = approvalQueue.slice(0, getVisibleCountForSection("approve"));
      return (
        <>
          {visibleItems.map((sol) =>
            renderSolicitudCard(sol, { showActions: true, showUser: true })
          )}
          {renderListControls("approve", approvalQueue.length)}
        </>
      );
    }

    if (activeTab === "study_enrollments") {
      if (!isApprover) return null;
      if (pendingStudyEnrollments.length === 0) {
        return (
          <div className="text-center py-10">
            <FiFileText className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No hay matrículas pendientes</p>
            <p className="text-xs text-gray-500 mt-1">Nada por revisar en este momento</p>
          </div>
        );
      }
      const visibleItems = pendingStudyEnrollments.slice(0, getVisibleCountForSection("study_enrollments"));
      return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-sm font-semibold text-indigo-900">Matrículas de estudios pendientes de validación</p>
          <div className="mt-2 space-y-2">
            {visibleItems.map((enrollment) => (
              <div key={enrollment.id} className="rounded-lg border border-indigo-200 bg-white p-3">
                <div className="grid grid-cols-1 gap-2 text-xs text-gray-700 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Solicitante</p>
                    <p className="font-semibold text-gray-900">{getEnrollmentRequesterName(enrollment)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Correo</p>
                    <p className="text-gray-900 break-all">{enrollment.user_email || "No disponible"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Institución</p>
                    <p className="text-gray-900">{enrollment.institution_name || "No registrada"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Programa</p>
                    <p className="text-gray-900">{enrollment.program_name || "No registrado"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Inicio</p>
                    <p className="text-gray-900">{formatEnrollmentDate(enrollment.valid_from)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Vence</p>
                    <p className="text-gray-900">{formatEnrollmentDate(enrollment.valid_until)}</p>
                  </div>
                </div>
                <a
                  href={enrollment.drive_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <FiEye className="h-3 w-3" />
                  Ver matrícula subida
                </a>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEnrollmentReviewModal(enrollment, "reject")}
                    disabled={actionLoading === `enroll-${enrollment.id}`}
                    className="text-xs py-1.5"
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => openEnrollmentReviewModal(enrollment, "approve")}
                    disabled={actionLoading === `enroll-${enrollment.id}`}
                    className="text-xs py-1.5 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Aprobar
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {renderListControls("study_enrollments", pendingStudyEnrollments.length)}
        </div>
      );
    }

    if (activeTab === "waiting") {
      if (!isJefe) return null;
      if (misEsperandoGerencia.length === 0) {
        return (
          <div className="text-center py-10">
            <FiClock className="w-12 h-12 text-amber-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">Sin solicitudes esperando gerencia</p>
          </div>
        );
      }
      const visibleItems = misEsperandoGerencia.slice(0, getVisibleCountForSection("waiting"));
      return (
        <>
          {visibleItems.map((sol) =>
            renderSolicitudCard(sol, { showDocs: hasJustificantes(sol) })
          )}
          {renderListControls("waiting", misEsperandoGerencia.length)}
        </>
      );
    }

    return null;
  };

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
      {activeException && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-6"
        >
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 to-white shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-xl text-amber-700 shadow-inner">
                  <FiAlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
                    Salida inesperada activa
                  </p>
                  <p className="text-xs font-semibold text-amber-800">{exceptionStepLabel}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-amber-600 uppercase tracking-wide">Tipo</p>
                <p className="text-sm font-bold text-amber-900">
                  {activeException.type ? activeException.type.replace(/_/g, " ") : "Sin definir"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {exceptionTimeEntries.map((entry) => (
                <div
                  key={`${entry.label}-${entry.value ?? "pending"}`}
                  className={`rounded-xl border ${entry.colors} p-3 shadow-sm`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/80">
                    {entry.label}
                  </div>
                  <div className="text-lg font-mono font-bold">{formatTimeSafe(entry.value)}</div>
                  {entry.note && (
                    <div className="text-[10px] uppercase tracking-wider text-amber-900/60 mt-1">
                      {entry.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {pendientesDeJustificante.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-blue-600 text-white shadow">
                <FiUpload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900">
                  Accion requerida
                </h3>
                <p className="text-sm text-blue-700">
                  Tienes permisos aprobados parcialmente con documentos pendientes por subir.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {pendientesDeJustificante.slice(0, getVisibleCountForSection("upload_docs")).map((sol) => (
              <div
                key={sol.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white border border-blue-100 px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    #{sol.requester_sequence || sol.id}  {getTipoLabel(sol)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateShort(sol.fecha_inicio)} - {formatDateShort(sol.fecha_fin)}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setSelectedSolicitud(sol);
                    setShowUploadModal(true);
                  }}
                >
                  <FiUpload className="mr-1" />
                  Subir docs
                </Button>
              </div>
            ))}
          </div>
          {renderListControls("upload_docs", pendientesDeJustificante.length)}
        </motion.div>
      )}

      <Card className="overflow-hidden">
        {/* Header con Tabs */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-base font-bold text-gray-900">Permisos y Vacaciones</h3>
          </div>
          <div className="flex gap-1 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon || FiClock;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-5 py-3 text-sm font-semibold transition-all ${
                    isActive ? "text-blue-700" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4 inline mr-2" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-2 rounded-full bg-blue-600 px-2 text-xs text-white">
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-600"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-2"
            >
              {renderTabContent()}
            </motion.div>
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
                    <p className="text-sm text-gray-600">Proporciona una razon</p>
                  </div>
                </div>

                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
                  placeholder="Motivo del rechazo"
                />

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                    Cancelar
                  </Button>
                  <Button variant="danger" onClick={handleRechazar} disabled={!!actionLoading}>
                    Rechazar
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-rose-100 rounded-xl">
                    <FiAlertCircle className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending"
                        ? "Revisar Cancelación"
                        : "Cancelar Solicitud"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending"
                        ? "Para aprobar puedes dejar una observación opcional. Para rechazar debes registrar un motivo."
                        : "Registrar motivo de cancelación"}
                    </p>
                  </div>
                </div>

                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
                  placeholder={
                    String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending"
                      ? "Observación opcional para aprobar o motivo obligatorio para rechazar"
                      : "Motivo de cancelación"
                  }
                />

                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowCancelModal(false);
                      setSelectedSolicitud(null);
                      setCancelReason("");
                    }}
                  >
                    Cerrar
                  </Button>
                  {String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending" ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => handleReviewCancellation(selectedSolicitud, "reject")}
                        disabled={!!actionLoading}
                      >
                        Rechazar cancelación
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleReviewCancellation(selectedSolicitud, "approve")}
                        disabled={!!actionLoading}
                      >
                        Aprobar cancelación
                      </Button>
                    </>
                  ) : (
                    <Button variant="danger" onClick={handleCancelar} disabled={!!actionLoading}>
                      Confirmar
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecoveryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl"
            >
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Plan de recuperación</h3>
                    <p className="text-xs text-gray-600">Define tramos horarios (ej. 30 min diarios o 1h diaria).</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowRecoveryModal(false);
                      setRecoveryRows([]);
                      setSelectedSolicitud(null);
                    }}
                  >
                    Cerrar
                  </Button>
                </div>

                <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
                  {recoveryRows.map((row, idx) => {
                    const computedHours = computeRecoveryHours(row.start_time, row.end_time);
                    return (
                      <div key={`modal-recovery-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-lg border border-gray-200 bg-gray-50 p-2">
                        <div className="sm:col-span-3">
                          <label className="text-[11px] text-gray-600">Fecha</label>
                          <input
                            type="date"
                            value={row.date || ""}
                            onChange={(e) =>
                              setRecoveryRows((prev) => prev.map((it, i) => (i === idx ? { ...it, date: e.target.value } : it)))
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
                              setRecoveryRows((prev) => prev.map((it, i) => (i === idx ? { ...it, start_time: e.target.value } : it)))
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
                              setRecoveryRows((prev) => prev.map((it, i) => (i === idx ? { ...it, end_time: e.target.value } : it)))
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
                              setRecoveryRows((prev) => prev.map((it, i) => (i === idx ? { ...it, notes: e.target.value } : it)))
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

                <div className="mt-3 flex items-center justify-between">
                  <Button
                    variant="secondary"
                    disabled={isRecoveryPlanComplete}
                    onClick={() =>
                      setRecoveryRows((prev) => [...prev, { date: "", start_time: "", end_time: "", notes: "" }])
                    }
                  >
                    {isRecoveryPlanComplete ? "Límite alcanzado" : "+ Agregar tramo"}
                  </Button>
                  <p className="text-xs text-gray-600">
                    {plannedRecoveryHours}h{requestedRecoveryHours > 0 ? ` / ${requestedRecoveryHours}h` : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    {canSelectedUserApproveRecovery && (
                        <Button
                          variant="primary"
                          onClick={() => handleSaveRecoveryPlan("accept")}
                          disabled={actionLoading === `recovery-${selectedSolicitud?.id}`}
                        >
                          Aprobar y cerrar
                        </Button>
                      )}
                    {canSelectedRequesterCounterPropose && (
                        <Button
                          variant="secondary"
                          onClick={() => handleSaveRecoveryPlan("propose")}
                          disabled={actionLoading === `recovery-${selectedSolicitud?.id}`}
                        >
                          Proponer nueva
                        </Button>
                      )}
                    {canSelectedApproverFinalize && (
                        <Button
                          variant="secondary"
                          onClick={() => handleSaveRecoveryPlan("finalize")}
                          disabled={actionLoading === `recovery-${selectedSolicitud?.id}`}
                        >
                          Definir definitivo
                        </Button>
                      )}
                    <Button
                      variant="primary"
                      onClick={() => handleSaveRecoveryPlan("propose")}
                      disabled={actionLoading === `recovery-${selectedSolicitud?.id}`}
                    >
                      Guardar plan
                    </Button>
                  </div>
                </div>
                {isRecoveryPlanComplete && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Se alcanzaron las horas solicitadas. No puedes agregar más tramos.
                  </p>
                )}
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEnrollmentReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md"
            >
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <FiFileText className="w-6 h-6 text-indigo-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {enrollmentReviewDecision === "approve" ? "Aprobar matrícula" : "Rechazar matrícula"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {enrollmentReviewDecision === "approve"
                        ? "Revisa la información y confirma la validación."
                        : "Registra el motivo del rechazo."}
                    </p>
                  </div>
                </div>

                {selectedEnrollment && (
                  <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="grid grid-cols-1 gap-2 text-xs text-gray-700 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Solicitante</p>
                        <p className="font-semibold text-gray-900">
                          {getEnrollmentRequesterName(selectedEnrollment)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Correo</p>
                        <p className="text-gray-900 break-all">{selectedEnrollment.user_email || "No disponible"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Institución</p>
                        <p className="text-gray-900">{selectedEnrollment.institution_name || "No registrada"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Programa</p>
                        <p className="text-gray-900">{selectedEnrollment.program_name || "No registrado"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Inicio</p>
                        <p className="text-gray-900">{formatEnrollmentDate(selectedEnrollment.valid_from)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Vence</p>
                        <p className="text-gray-900">{formatEnrollmentDate(selectedEnrollment.valid_until)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {enrollmentReviewDecision === "reject" ? (
                  <textarea
                    value={enrollmentReviewReason}
                    onChange={(e) => setEnrollmentReviewReason(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
                    placeholder="Motivo de rechazo"
                  />
                ) : (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    No se requiere motivo para aprobar la matrícula.
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowEnrollmentReviewModal(false);
                      setSelectedEnrollment(null);
                      setEnrollmentReviewReason("");
                    }}
                  >
                    Cerrar
                  </Button>
                  <Button
                    variant={enrollmentReviewDecision === "approve" ? "primary" : "danger"}
                    onClick={handleReviewEnrollment}
                    disabled={!!actionLoading}
                  >
                    Confirmar
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de subida de justificantes */}
      <UploadJustificantesModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        solicitud={selectedSolicitud}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
};

export default PermisosStatusWidget;
