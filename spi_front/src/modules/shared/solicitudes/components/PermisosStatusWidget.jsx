import React, { useEffect, useMemo, useState } from "react";
import {
  FiClock,
  FiCheck,
  FiX,
  FiFileText,
  FiDownload,
  FiAlertCircle,
  FiUpload,
  FiEye,
  FiUsers,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/AuthContext";
import { STATUS_META, getTipoLabel, formatDateShort, hasJustificantes } from "../utils/solicitudesHelpers";
import {
  getMisSolicitudes,
  getPendientes,
  aprobarParcial,
  aprobarFinal,
  rechazar,
} from "../../../../core/api/permisosApi";
import UploadJustificantesModal from "../modals/UploadJustificantesModal";
import { getActiveException, getTodayAttendance } from "../../../../core/api/attendanceApi";
import { formatTimeSafe } from "../../../../shared/utils/dateUtils";

const normalizeRole = (value = "") => value.toLowerCase();
const formatDateTime = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
};

const PermisosStatusWidget = () => {
  const { user } = useAuth();
  const { showToast } = useUI();
  const role = normalizeRole(user?.role || user?.rol);
  const scope = normalizeRole(user?.scope || role);
  const userEmail = user?.email || "";
  const userId = user?.id;
  const gerenciaGeneralRoles = new Set(["gerencia_general", "gerente_general"]);

  const roleCandidates = [role, scope].filter(Boolean);
  const isJefe = [
    "jefe_comercial",
    "jefe_financiero",
    "jefe_finanzas",
    "jefe_operaciones",
    "jefe_calidad",
    "jefe_tecnico",
    "jefe_logistica",
  ].some((r) =>
    roleCandidates.some((candidate) => candidate.includes(r))
  );
  const isGerencia = gerenciaGeneralRoles.has(role) || gerenciaGeneralRoles.has(scope);
  const isApprover = isJefe || isGerencia;
  const isTalentRole = ["talento_humano", "jefe_talento_humano", "talento-humano", "jefe_financiero", "jefe_finanzas"].includes(scope);

  const [activeTab, setActiveTab] = useState("mine");
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [pendientesParcial, setPendientesParcial] = useState([]);
  const [pendientesFinal, setPendientesFinal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [activeException, setActiveException] = useState(null);
  const [attendance, setAttendance] = useState(null);

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


  const canSeeSolicitudForApproval = (solicitud) => {
    if (!solicitud) return false;
    if (isGerencia) return true;
    const approverRole = (solicitud.approver_role || "").toLowerCase();
    const approverEmail = (solicitud.approver_email || "").toLowerCase();
    const approverUserId = solicitud.approver_user_id;
    if (approverUserId && userId) return approverUserId === userId;
    if (approverEmail && userEmail) return approverEmail === userEmail.toLowerCase();
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
    created_at: normalizeDateValue(solicitud?.created_at),
    updated_at: normalizeDateValue(solicitud?.updated_at),
  });

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

  const fetchAttendance = async () => {
    try {
      const response = await getTodayAttendance();
      if (response?.data) {
        setAttendance(response.data);
      } else if (response?.ok && response?.data === undefined && response?.id) {
        setAttendance(response);
      } else {
        setAttendance(null);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      setAttendance(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const requests = [getMisSolicitudes()];
      if (isApprover) {
        requests.push(getPendientes("pending"));
        requests.push(getPendientes("pending_final"));
      }
      const [mineResp, pendingResp, finalResp] = await Promise.all(requests);

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
    } catch (error) {
      console.error("Error loading permisos:", error);
      showToast("Error al cargar solicitudes", "error");
    } finally {
      if (!isTalentRole) {
        await Promise.all([fetchActiveException(), fetchAttendance()]);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, scope]);

  const handleAprobarParcial = async (id) => {
    setActionLoading(id);
    try {
      const response = await aprobarParcial(id);
      if (response.ok) {
        showToast("Aprobado parcialmente. El colaborador debe subir documentos.", "success");
        await loadData();
      }
    } catch (error) {
      showToast(error.response?.data?.message || "Error al aprobar", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAprobarFinal = async (id) => {
    setActionLoading(id);
    try {
      const response = await aprobarFinal(id);
      if (response.ok) {
        showToast("Aprobado definitivamente. PDF generado en Drive.", "success");
        await loadData();
      }
    } catch (error) {
      showToast(error.response?.data?.message || "Error al aprobar", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRechazar = async () => {
    if (!selectedSolicitud || !rejectReason.trim()) {
      showToast("Debes proporcionar una razon de rechazo", "warning");
      return;
    }

    setActionLoading(selectedSolicitud.id);
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
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadSuccess = async () => {
    showToast("Documentos subidos correctamente", "success");
    setShowUploadModal(false);
    setSelectedSolicitud(null);
    await loadData();
  };

  const pendientesDeJustificante = useMemo(
    () => misSolicitudes.filter((sol) => sol.status === "partially_approved"),
    [misSolicitudes]
  );

  const misEsperandoGerencia = useMemo(
    () => misSolicitudes.filter((sol) => sol.status === "pending_final"),
    [misSolicitudes]
  );

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

  const baseTimeEntries = [
    ["Entrada", attendance?.entry_time, "bg-emerald-50 border-emerald-200 text-emerald-800"],
    ["Salida Almuerzo", attendance?.lunch_start_time, "bg-orange-50 border-orange-200 text-orange-800"],
    ["Entrada Almuerzo", attendance?.lunch_end_time, "bg-blue-50 border-blue-200 text-blue-800"],
    ["Salida", attendance?.exit_time, "bg-indigo-50 border-indigo-200 text-indigo-800"],
  ].map(([label, time, colors]) => ({ label, value: time, colors }));

  const timeEntries = [...baseTimeEntries, ...exceptionTimeEntries];

  const tabs = useMemo(() => {
    const base = [
      { id: "mine", label: "Mis solicitudes", count: misSolicitudes.length, visible: true },
    ];
    if (isApprover) {
      base.push({
        id: "approve",
        label: isGerencia ? "Aprobar final" : "Aprobar",
        count: pendientesParcial.length + pendientesFinal.length,
        visible: true,
      });
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
  }, [misSolicitudes.length, pendientesParcial.length, pendientesFinal.length, misEsperandoGerencia.length, isApprover, isGerencia, isJefe]);

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
    const requiresUpload = solicitud.status === "partially_approved" && !showActions;
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

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
          <div className="text-xs">
            <p className="text-gray-500">Solicitud</p>
            <p className="font-medium text-gray-800">#{solicitud.id}</p>
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
          <div className="text-xs">
            <p className="text-gray-500">Aprobador asignado</p>
            <p className="font-medium text-gray-800">{approverDisplay}</p>
          </div>
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
              Descargar F.RH-10
            </a>
          </div>
        )}

        {rejectionNotes.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mt-2">
            <p className="text-xs font-semibold text-rose-900 mb-1">Observaciones:</p>
            <ul className="space-y-1">
              {rejectionNotes.map((note, idx) => (
                <li key={`${solicitud.id}-obs-${idx}`} className="text-xs text-rose-800">
                  - {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showActions && (
          <div className="space-y-2 mt-3">
            <div className="flex gap-2">
              {solicitud.status === "pending" && (
                <>
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
                      : isVacation
                      ? "Aprobar definitiva"
                      : "Aprobar parcial"}
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
      </motion.div>
    );
  };

  const renderAttendanceGrid = () => (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Registro de tiempos</h3>
          <p className="text-xs text-gray-500">Horario registrado hoy</p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">
          {attendance?.updated_at ? `Actualizado ${formatDateShort(attendance.updated_at)}` : "Sin registro"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {timeEntries.map((entry) => (
          <div
            key={`${entry.label}-${entry.value ?? "pending"}`}
            className={`rounded-xl border ${entry.colors} p-3 shadow-sm`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-700/80">
              {entry.label}
            </div>
            <div className="text-lg font-mono font-bold">{formatTimeSafe(entry.value)}</div>
            {entry.note && (
              <div className="text-[10px] uppercase tracking-wider text-slate-600/70 mt-1">
                {entry.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );

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
      return misSolicitudes.map((sol) =>
        renderSolicitudCard(sol, {
          showDocs: sol.status === "pending_final" || sol.status === "approved",
        })
      );
    }

    if (activeTab === "approve") {
      if (!isApprover) return null;
      const noItems = pendientesParcial.length === 0 && pendientesFinal.length === 0;
      if (noItems) {
        return (
          <div className="text-center py-10">
            <FiCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No hay solicitudes pendientes</p>
            <p className="text-xs text-gray-500 mt-1">Nada por aprobar en este momento</p>
          </div>
        );
      }
      return (
        <>
          {pendientesParcial.map((sol) => renderSolicitudCard(sol, { showActions: true, showUser: true }))}
          {pendientesFinal.map((sol) => renderSolicitudCard(sol, { showActions: true, showUser: true }))}
        </>
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
      return misEsperandoGerencia.map((sol) =>
        renderSolicitudCard(sol, { showDocs: hasJustificantes(sol) })
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
      {!isTalentRole && attendance && renderAttendanceGrid()}
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
                  Tienes permisos aprobados parcialmente. Debes subir los documentos justificantes.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {pendientesDeJustificante.map((sol) => (
              <div
                key={sol.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white border border-blue-100 px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    #{sol.id}  {getTipoLabel(sol)}
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
