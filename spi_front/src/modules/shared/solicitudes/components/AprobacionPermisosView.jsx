import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
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
} from "../../../../core/api/permisosApi";
import { useAuth } from "../../../../core/auth/AuthContext";

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

  const canSeeApproved = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    return role.includes("jefe") || role.includes("gerencia") || role === "admin";
  }, [user]);

  const userId = user?.id;
  const userEmail = String(user?.email || "").toLowerCase();
  const roleCandidates = useMemo(
    () => [user?.role, user?.scope, user?.role_name].map(normalizeRoleValue).filter(Boolean),
    [user],
  );
  const gerenciaGeneralRoles = useMemo(() => new Set(["gerencia_general", "gerente_general"]), []);

  const gapClass = compact ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4";
  const actionButton = compact ? "flex-1 text-xs py-1.5" : "flex-1";

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
    const badges = {
      pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
      partially_approved: { label: "Aprobado Parcialmente", color: "bg-blue-100 text-blue-800" },
      pending_final: { label: "Esperando Aprobacion Final", color: "bg-purple-100 text-purple-800" },
      approved: { label: "Aprobado", color: "bg-green-100 text-green-800" },
      rejected: { label: "Rechazado", color: "bg-red-100 text-red-800" },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
        {badge.label}
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

  const formatDateCalendar = (value) => {
    if (!value) return "N/A";
    const text = String(value);
    const datePart = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (datePart) {
      const year = Number(datePart[1]);
      const month = Number(datePart[2]) - 1;
      const day = Number(datePart[3]);
      return new Date(year, month, day).toLocaleDateString("es-EC");
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString("es-EC");
  };

  const formatTimeRange = (solicitud = {}) => {
    const start = solicitud?.fecha_inicio_hora || solicitud?.start_time;
    const end = solicitud?.fecha_fin_hora || solicitud?.end_time;
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    return `${startDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${endDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  };

  const formatEnrollmentDate = (value) => {
    if (!value) return "No disponible";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "No disponible";
    return parsed.toLocaleDateString("es-EC");
  };

  const getEnrollmentRequesterName = (enrollment = {}) =>
    enrollment?.user_fullname || enrollment?.user_email || "No disponible";

  const renderSolicitudCard = (solicitud) => {
    const recoveryPlan = Array.isArray(solicitud?.recovery_plan) ? solicitud.recovery_plan : [];
    const recoveryTotal = Number(solicitud?.recovery_plan_total_hours || 0);
    const coordinationStatus = String(solicitud?.recovery_coordination_status || "not_required").toLowerCase();
    const isCoordinationEnabled = canCoordinateRecoveryByStatus(solicitud);
    const recoveryCoordinationDeadline = getRecoveryCoordinationDeadline(solicitud);
    const canEditRecovery =
      Boolean(solicitud?.es_recuperable) &&
      isCoordinationEnabled &&
      !["agreed", "finalized_by_approver"].includes(coordinationStatus) &&
      !solicitud?.charged_to_vacation &&
      canCurrentUserActAsAssignedApprover(solicitud);
    const canApproveRecoveryProposal =
      isCoordinationEnabled &&
      ["pending_approver_proposal", "pending_requester_acceptance"].includes(coordinationStatus) &&
      recoveryPlan.length > 0;
    const canApproverFinalize =
      isCoordinationEnabled &&
      coordinationStatus === "pending_approver_proposal" &&
      Number(solicitud?.recovery_coordination_round || 0) > 0 &&
      recoveryPlan.length > 0 &&
      canCurrentUserActAsAssignedApprover(solicitud);
    const normalizedStatus = String(solicitud?.status || "").toLowerCase();
    const cancellationStatus = String(solicitud?.cancellation_status || "none").toLowerCase();
    const hasPendingCancellation = cancellationStatus === "pending";
    const canCancelThis =
      ["approved", "aprobado"].includes(normalizedStatus) &&
      cancellationStatus !== "pending" &&
      canCancelByDateRule(solicitud) &&
      canCurrentUserActAsAssignedApprover(solicitud);

    return (
      <motion.div
      key={solicitud.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
      >
      <div
        className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${
          solicitud.status === "approved" || solicitud.status === "aprobado"
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
            {getStatusBadge(solicitud.status)}
          </div>
          <p className="text-xs text-gray-600 mb-1">
            <FiUsers className="inline mr-1" />
            {solicitud.user_fullname || solicitud.user_email || "Sin solicitante"}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>
              {formatDateCalendar(solicitud.fecha_inicio)} - {formatDateCalendar(solicitud.fecha_fin)}
            </span>
            <span className="font-medium text-gray-700">
              {solicitud.duracion_horas ? `${solicitud.duracion_horas}h` : `${solicitud.duracion_dias}d`}
            </span>
            {formatTimeRange(solicitud) && (
              <span className="font-medium text-indigo-700">{formatTimeRange(solicitud)}</span>
            )}
          </div>
        </div>
        <div className="text-right text-[10px] text-gray-400 whitespace-nowrap">ID: #{solicitud.id}</div>
      </div>

      {solicitud?.es_recuperable && isCoordinationEnabled && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-900">
              Plan de recuperacion
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
              Coordinar hasta: {formatDateCalendar(recoveryCoordinationDeadline)}
            </p>
          )}
          {solicitud?.charged_to_vacation && (
            <p className="text-[11px] text-amber-800 mt-1">
              Descuento aplicado a vacaciones: {Number(solicitud?.charged_vacation_hours || 0) || recoveryTotal || 0}h
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
            <p className="text-[11px] text-emerald-800 mt-1">Sin tramos definidos aun.</p>
          )}
          {(canApproveRecoveryProposal || canApproverFinalize) && (
            <div className="mt-2">
              {canApproveRecoveryProposal && (
                <p className="text-[11px] text-emerald-800">
                  Existe una propuesta de coordinacion pendiente. Cualquiera de las dos partes puede aprobarla y cerrarla.
                </p>
              )}
              {canApproverFinalize && (
                <p className="text-[11px] text-emerald-800">
                  Hay una contrapropuesta del solicitante pendiente de decision definitiva.
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
          <p className="font-medium text-gray-800">{formatDateCalendar(solicitud.created_at)}</p>
        </div>
        {solicitud.tipo_solicitud === "vacaciones" && solicitud.periodo_vacaciones && (
          <div className="text-[11px]">
            <p className="text-gray-500">Periodo</p>
            <p className="font-medium text-gray-800">{solicitud.periodo_vacaciones}</p>
          </div>
        )}
        {solicitud.observaciones && (
          <div className="col-span-full text-[11px] mt-1 border-t border-gray-100 pt-1">
            <p className="text-gray-500 font-semibold uppercase tracking-tighter">Observaciones:</p>
            <p className="text-gray-700 italic bg-amber-50/50 p-1.5 rounded-md mt-0.5 border border-amber-100">
              {solicitud.observaciones}
            </p>
          </div>
        )}
        {hasPendingCancellation && (
          <div className="col-span-full text-[11px] mt-1 border-t border-amber-100 pt-1">
            <p className="text-amber-700 font-semibold uppercase tracking-tighter">
              Solicitud de cancelacion pendiente:
            </p>
            <p className="text-amber-800 bg-amber-50 p-1.5 rounded-md mt-0.5 border border-amber-100">
              {solicitud.cancellation_request_reason || "Sin motivo registrado"}
            </p>
          </div>
        )}
      </div>

      {solicitud.justificantes_urls && solicitud.justificantes_urls.length > 0 && (
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
            Descargar F.RH-10
          </a>
        </div>
      )}

      {solicitud.status !== "approved" && solicitud.status !== "aprobado" && (
        <div className="flex gap-2 mt-3">
          {stage === "pending" && (
            <>
              <Button
                variant="primary"
                onClick={() =>
                  solicitud.tipo_solicitud === "vacaciones"
                    ? handleAprobarFinal(solicitud.id)
                    : handleAprobarParcial(solicitud.id)
                }
                disabled={!!actionLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
              >
                <FiCheck className="w-3.5 h-3.5 mr-1.5" />
                {solicitud.tipo_solicitud === "vacaciones" ? "Aprobar" : "Aprobar Parcial"}
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
            Revisar cancelacion
          </Button>
        </div>
      )}
      {stage === "approved" && canCancelThis && (
        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() => openCancelModal(solicitud)}
            disabled={!!actionLoading}
            className="w-full bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs py-1.5"
          >
            Cancelar solicitud
          </Button>
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
          <p className="font-medium text-gray-800">{formatEnrollmentDate(enrollment.valid_from)}</p>
        </div>
        <div className="text-[11px]">
          <p className="text-gray-500">Vence</p>
          <p className="font-medium text-gray-800">{formatEnrollmentDate(enrollment.valid_until)}</p>
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
      id: "cancellation_pending",
      label: "Cancelaciones",
      icon: FiAlertCircle,
      color: "rose",
      hidden: !canSeeApproved,
    },
    { id: "study_enrollments", label: "Matriculas", icon: FiFileText, color: "indigo" },
    { id: "approved", label: "Aprobadas Definitivas", icon: FiCheckCircle, color: "emerald", hidden: !canSeeApproved },
  ].filter((tab) => !tab.hidden);

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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="col-span-full py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    if (stage === "study_enrollments") {
      if (pendingStudyEnrollments.length === 0) {
        return (
          <div className="col-span-full py-12 text-center">
            <FiCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No hay matriculas pendientes</p>
          </div>
        );
      }
      return pendingStudyEnrollments.map(renderEnrollmentCard);
    }

    if (solicitudes.length === 0) {
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
    return solicitudes.map(renderSolicitudCard);
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
              {String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending"
                ? "Revisar solicitud de cancelacion"
                : "Cancelar solicitud aprobada"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending"
                ? "Registra la decision sobre la cancelacion solicitada por el colaborador."
                : "Registra el motivo de cancelacion para trazabilidad del flujo."}
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 mb-4"
              placeholder={
                String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending"
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
              {String(selectedSolicitud?.cancellation_status || "").toLowerCase() === "pending" ? (
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
                  Confirmar cancelacion
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
