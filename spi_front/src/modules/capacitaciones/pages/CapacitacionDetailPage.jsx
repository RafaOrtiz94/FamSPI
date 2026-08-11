import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiBarChart2,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiLoader,
  FiLock,
  FiMapPin,
  FiRefreshCw,
  FiSave,
  FiSend,
  FiTrash2,
  FiUpload,
  FiUser,
  FiUsers,
  FiVideo,
} from "react-icons/fi";
import { useTraining, useTrainingActions } from "../hooks/useTrainings";
import { TrainingStatusBadge, TrainingTypeBadge, TrainingSignatureProgress } from "../components/TrainingStatusBadge";
import TrainingFamSignFab from "../components/TrainingFamSignFab";
import { useAuth } from "../../../core/auth/AuthContext";

// ─── Pipeline ────────────────────────────────────────────────────────────────

const PIPELINE = [
  { id: 1, label: "Agendado",     icon: FiCalendar   },
  { id: 2, label: "Asistencia",   icon: FiUsers      },
  { id: 3, label: "Contenido",    icon: FiEdit2      },
  { id: 4, label: "Estadísticas", icon: FiBarChart2  },
  { id: 5, label: "Actas",        icon: FiFileText   },
  { id: 6, label: "Firmas",       icon: FiCheckCircle },
];

const ATT_STATUS = {
  attended: { label: "Asistió",       cls: "bg-green-100 text-green-700 border-green-200"  },
  absent:   { label: "No asistió",    cls: "bg-red-100 text-red-700 border-red-200"        },
  assigned: { label: "Sin confirmar", cls: "bg-slate-100 text-slate-500 border-slate-200"  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-EC", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function useCountdown(targetDate, targetTime) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const dateOnly = String(targetDate).split("T")[0]; // "2026-06-26"
      const dateStr = targetTime ? `${dateOnly}T${targetTime}` : dateOnly;
      const target = new Date(dateStr);
      const now = new Date();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ expired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate, targetTime]);

  return timeLeft;
}

function CountdownTimer({ timeLeft }) {
  if (!timeLeft) return null;
  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <FiCheckCircle size={18} className="text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-800">¡La capacitación ha comenzado!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <FiClock size={18} className="text-blue-600" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Tiempo restante</p>
        <p className="text-lg font-bold text-blue-800">
          {timeLeft.days > 0 && <span>{timeLeft.days}d </span>}
          {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
        </p>
      </div>
    </div>
  );
}

function formatDuration(hours) {
  if (!hours) return "—";
  const totalMin = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

// ─── Primitivos ───────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 " +
  "outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition placeholder:text-slate-400 resize-none";

function SectionLabel({ children }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{children}</p>;
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm text-slate-600">
      <Icon size={14} className="mt-0.5 flex-none text-slate-400" />
      <span className="font-medium text-slate-500 mr-1">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function ActionBtn({ onClick, disabled, loading, icon: Icon, label, variant = "primary", className = "" }) {
  const base = "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 cursor-pointer active:scale-[0.97]";
  const variants = {
    primary:   "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border border-slate-200 text-slate-700 hover:bg-slate-50",
    success:   "bg-green-600 text-white hover:bg-green-700",
    outline:   "border border-blue-300 text-blue-700 hover:bg-blue-50",
    danger:    "border border-red-200 text-red-600 hover:bg-red-50",
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
      {loading ? <FiLoader size={14} className="animate-spin" /> : Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

function LockedStage({ prev }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5">
      <FiLock size={18} className="flex-none text-slate-300" />
      <div>
        <p className="text-sm font-medium text-slate-700">Etapa bloqueada</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Completa la etapa de <strong>{prev}</strong> para desbloquear este paso.
        </p>
      </div>
    </div>
  );
}

// ─── Pipeline stepper ────────────────────────────────────────────────────────

function PipelineStep({ stage, status, onClick }) {
  const Icon = stage.icon;
  const colors = {
    done:   { bg: "bg-green-500",  border: "border-green-500",  text: "text-green-700",  ring: "" },
    active: { bg: "bg-blue-600",   border: "border-blue-600",   text: "text-blue-700",   ring: "ring-2 ring-blue-200" },
    locked: { bg: "bg-slate-200",  border: "border-slate-200",  text: "text-slate-400",  ring: "" },
  };
  const c = colors[status];
  const clickable = status !== "locked";
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className={`flex flex-col items-center gap-1.5 ${clickable ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${c.bg} ${c.border} ${c.ring}`}>
        {status === "done"   ? <FiCheck size={16} className="text-white" />
        : status === "locked" ? <FiLock size={13} className="text-slate-400" />
        : <Icon size={16} className="text-white" />}
      </div>
      <span className={`hidden sm:block text-[10px] font-semibold uppercase tracking-wide ${c.text}`}>
        {stage.label}
      </span>
    </button>
  );
}

function PipelineConnector({ done }) {
  return (
    <div className={`mb-5 flex-1 h-0.5 mx-1 rounded-full transition-colors ${done ? "bg-green-400" : "bg-slate-200"}`} />
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

const EXT_ROLES = new Set(["ing_servicio_ext", "esp_app_ext"]);

export default function CapacitacionDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isExtUser = EXT_ROLES.has(String(user?.role || user?.scope || "").toLowerCase());

  const trainingId = id ? parseInt(id, 10) : null;
  const { training, loading, error, reload } = useTraining(trainingId);
  const actions = useTrainingActions(null);

  const [activeStage, setActiveStage] = useState(null);
  const initDone = useRef(false);

  // Stage 2 — asistencia
  const [attendance, setAttendance] = useState({});
  const [savingAtt, setSavingAtt]   = useState(false);
  const [attSaved, setAttSaved]     = useState(false);

  // Stage 3 — contenido
  const [closure, setClosure]        = useState({ 
    material: "", objectives: "", observations: "", conclusions: "",
    observaciones_inasistentes: "", conclusiones_inasistentes: ""
  });
  const [, setEditing] = useState(false);
  const [savingClosure, setSavingC]  = useState(false);

  // Stage 5 — actas
  const fileRef   = useRef(null);
  const manualSignedFileRef = useRef(null);
  const absentManualSignedFileRef = useRef(null);
  const [busyMap, setBusyMap] = useState({});

  // Overlay bloqueante para operaciones pesadas (generación de PDF, FamSign)
  // { title, subtitle } | null
  const [heavyOp, setHeavyOp] = useState(null);

  useEffect(() => {
    if (!training) return;
    setClosure({
      material:               training.material               || "",
      objectives:             training.objectives             || "",
      observations:           training.observations           || "",
      conclusions:            training.conclusions            || "",
      observaciones_inasistentes: training.observaciones_inasistentes || "",
      conclusiones_inasistentes:  training.conclusiones_inasistentes  || ""
    });
  }, [training]);

  // ── Derived state ────────────────────────────────────────────────────────────

  // is_owner: backend sets it (admin bypass included). canManage gates all pipeline writes.
  const isOwner   = !!training?.is_owner;
  const canManage = isOwner && !isExtUser;
  const isCreator = Number(training?.created_by) === Number(user?.id);
  const canOpenActaDocuments = isCreator && !isExtUser;

  const attendees       = training?.attendees || [];
  const getAttendeeName = (a) =>
    String(a?.user_fullname_current || a?.name_snapshot || "").toUpperCase() || "—";
  const isCancelled     = training?.status === "cancelled" || training?.status === "cancelada";
  const absentees       = attendees.filter((a) => a.attendance_status === "absent");
  const totalConvocados = attendees.length;
  const totalAsistentes = attendees.filter((a) => a.attendance_status === "attended").length;
  const totalAusentes   = absentees.length;
  const pctAsistencia   = totalConvocados > 0 ? Math.round((totalAsistentes / totalConvocados) * 100) : 0;
  const pctInasistencia = totalConvocados > 0 ? Math.round((totalAusentes / totalConvocados) * 100) : 0;

  const hasAttendanceMarked = attendees.some((a) => a.attendance_status !== "assigned");
  const hasClosure          = !!(
    String(training?.observations || "").trim() ||
    String(training?.conclusions || "").trim() ||
    String(training?.observaciones_inasistentes || "").trim() ||
    String(training?.conclusiones_inasistentes || "").trim()
  );
  const canSaveClosure      = !!(
    String(closure.observations || "").trim() ||
    String(closure.conclusions || "").trim() ||
    String(closure.observaciones_inasistentes || "").trim() ||
    String(closure.conclusiones_inasistentes || "").trim()
  );
  const mainActaExists      = !!training?.acta_drive_url;
  const absentActaExists    = !!training?.absent_acta_drive_url;
  const mainSigned          = training?.signature_workflow_status === "completed";
  const absentSigned        = training?.absent_workflow_status === "completed";
  const mainManualSignedUrl = training?.manual_signed_drive_url || "";
  const absentManualSignedUrl = training?.absent_manual_signed_drive_url || "";
  const mainSignatureComplete = mainSigned || !!mainManualSignedUrl;
  const absentSignatureComplete = absentSigned || !!absentManualSignedUrl;
  const currentUserAttendee = attendees.find((a) => Number(a.user_id) === Number(user?.id));
  // "pending" nunca es un estado real de signature-workflows (son
  // prepared/sent/in_progress/partially_signed/completed/rejected/cancelled)
  // -- con la lista vieja, un workflow recien enviado (status "sent", el mas
  // comun) no se reconocia como activo en ningun lado de esta pantalla.
  const ACTIVE_WORKFLOW_STATUSES = ["prepared", "sent", "in_progress", "partially_signed"];
  const mainWorkflowActive = ACTIVE_WORKFLOW_STATUSES.includes(training?.signature_workflow_status);
  const absentWorkflowActive = ACTIVE_WORKFLOW_STATUSES.includes(training?.absent_workflow_status);
  const attendeeMainPending = mainWorkflowActive && currentUserAttendee?.signature_status !== "signed";
  const attendeeAbsentPending = absentWorkflowActive && currentUserAttendee?.attendance_status === "absent" && currentUserAttendee?.absent_signature_status !== "signed";
  const attendeeHasSignatureInboxAction = attendeeMainPending || attendeeAbsentPending;
  const isExternaInstructor = training?.type === "externa_instructor";
  const externalSignedActaUrl = training?.external_signed_drive_url || training?.external_signed_acta_url || "";

  // Stage done conditions
  const stageDone = {
    1: true,
    2: hasAttendanceMarked,
    3: hasClosure,
    4: hasClosure,
    5: mainActaExists && (totalAusentes === 0 || absentActaExists),
    6: mainSignatureComplete && (totalAusentes === 0 || absentSignatureComplete),
  };

  // Stage accessible conditions
  const stageAccessible = {
    1: true,
    2: true,
    3: stageDone[2],
    4: stageDone[3],
    5: stageDone[4],
    6: stageDone[5],
  };

  // First incomplete accessible stage (used only to initialize state)
  const computedStage = [1,2,3,4,5,6].find((s) => stageAccessible[s] && !stageDone[s]) ?? 6;
  const countdown = useCountdown(training?.scheduled_date, training?.scheduled_time_start);

  useEffect(() => {
    if (!training || initDone.current) return;
    initDone.current = true;
    setActiveStage(computedStage);
  }, [training]); // eslint-disable-line

  const goStage = (s) => {
    if (stageAccessible[s] || stageDone[s]) setActiveStage(s);
  };

  const goNext = () => {
    const next = activeStage + 1;
    if (next <= 6 && (stageAccessible[next] || stageDone[next])) setActiveStage(next);
  };

  const goPrev = () => {
    if (activeStage > 1) setActiveStage((s) => s - 1);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const act = async (key, fn) => {
    setBusyMap((b) => ({ ...b, [key]: true }));
    try { await fn(); await reload(); }
    catch (err) { console.error(err); }
    finally { setBusyMap((b) => ({ ...b, [key]: false })); }
  };

  // Para operaciones pesadas (PDF, FamSign) que tardan 2-15s → overlay bloqueante
  const actHeavy = async (key, overlayInfo, fn) => {
    setBusyMap((b) => ({ ...b, [key]: true }));
    setHeavyOp(overlayInfo);
    try { await fn(); await reload(); }
    catch (err) { console.error(err); }
    finally {
      setBusyMap((b) => ({ ...b, [key]: false }));
      setHeavyOp(null);
    }
  };

  const saveAttendance = async () => {
    setSavingAtt(true);
    try {
      // El key en `attendance` es siempre a.id (PK de training_attendees).
      // El backend espera attendeeId → WHERE id = $3.
      const records = Object.entries(attendance).map(([id, status]) => ({
        attendeeId: Number(id),
        status,
      }));
      if (records.length > 0) {
        await actions.markAttendance(trainingId, records);
      }
      setAttendance({});
      setAttSaved(true);
      await reload();
      // Avanzar automáticamente a la siguiente etapa
      goNext();
    } catch (err) { console.error(err); }
    finally { setSavingAtt(false); }
  };

  const saveClosure = async () => {
    setSavingC(true);
    try {
      await actions.update(trainingId, {
        material:               closure.material               || null,
        objectives:             closure.objectives             || null,
        observations:           closure.observations           || null,
        conclusions:            closure.conclusions            || null,
        observaciones_inasistentes: closure.observaciones_inasistentes || null,
        conclusiones_inasistentes:  closure.conclusiones_inasistentes  || null,
      });
      setEditing(false);
      await reload();
      goNext();
    } catch (err) { console.error(err); }
    finally { setSavingC(false); }
  };

  const handleCancel = useCallback(async () => {
    if (!window.confirm("¿Quieres cancelar esta capacitación? No podrás revertir esta acción.")) return;
    try {
      await actions.cancel(trainingId);
      navigate("/dashboard/capacitaciones");
    } catch (err) { console.error(err); }
  }, [actions, trainingId, navigate]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await act("uploadExternal", () => actions.uploadExternalActa(trainingId, file));
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Loading / error ──────────────────────────────────────────────────────────

  const handleManualSignedFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await act("uploadManualMain", () => actions.uploadManualSignedActa(trainingId, file));
    if (manualSignedFileRef.current) manualSignedFileRef.current.value = "";
  };

  const handleAbsentManualSignedFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await act("uploadManualAbsent", () => actions.uploadManualSignedAbsentActa(trainingId, file));
    if (absentManualSignedFileRef.current) absentManualSignedFileRef.current.value = "";
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F1F5F9]">
        <FiLoader size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F1F5F9]">
        <div className="text-center">
          <p className="mb-4 text-slate-500">{error || "No encontramos esta capacitación"}</p>
          <button onClick={() => navigate(-1)} className="text-sm font-medium text-blue-600 hover:underline">Volver</button>
        </div>
      </div>
    );
  }

  const hasAttEdits = Object.keys(attendance).length > 0;

  // Todos los asistentes tienen estado definido (attended o absent, ninguno "assigned")
  const allAttMarked = attendees.length > 0 && attendees.every((a) => {
    const id = a.id ?? a.user_id;
    const status = attendance[id] ?? a.attendance_status ?? "assigned";
    return status === "attended" || status === "absent";
  });

  // ── Stage content ────────────────────────────────────────────────────────────

  const renderStage = () => {
    if (activeStage === null) return null;

    // ─── Etapa 1: Agendado ─────────────────────────────────────────────────────
    if (activeStage === 1) return (
      <div className="space-y-5">
        <div className="space-y-2">
          <SectionLabel>Datos del evento</SectionLabel>
          <InfoRow icon={FiCalendar} label="Fecha"      value={formatDate(training.scheduled_date)} />
          <InfoRow icon={FiClock}    label="Duración"   value={formatDuration(training.duration_hours)} />
          <InfoRow icon={FiMapPin}   label="Lugar"      value={training.location} />
          <InfoRow icon={FiUser}     label="Instructor" value={training.trainer_name || training.trainer_user_name} />
          <InfoRow icon={FiUsers}    label="Área"       value={training.area} />
        </div>

        <div>
          <SectionLabel>Participantes convocados ({totalConvocados})</SectionLabel>
          {attendees.length === 0 ? (
            <p className="text-sm text-slate-400">Sin participantes registrados</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {attendees.map((a) => (
                <span key={a.user_id} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                  {getAttendeeName(a)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    // ─── Etapa 2: Asistencia ───────────────────────────────────────────────────
    if (activeStage === 2) return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {canManage ? "Marca quién asistió y quién no. Al confirmar todos los participantes podrás continuar." : "Registro de asistencia de la capacitación."}
        </p>

        {attSaved && !hasAttEdits && (
          <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
            <FiCheckCircle size={13} /> Asistencia guardada correctamente
          </div>
        )}

        {attendees.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No hay participantes registrados</p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {attendees.map((a) => {
              // Use attendee id if available, otherwise user_id
              const id = a.id ?? a.user_id;
              const currentStatus = attendance[id] ?? a.attendance_status ?? "assigned";
              const cfg = ATT_STATUS[currentStatus] || ATT_STATUS.assigned;
              return (
                <div key={id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                      {(getAttendeeName(a) || "?")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{getAttendeeName(a)}</p>
                      <p className="text-xs text-slate-400">{a.cargo_snapshot}</p>
                    </div>
                  </div>
                  {(!isCancelled && canManage) ? (
                    <select
                      value={currentStatus}
                      onChange={(e) => { setAttSaved(false); setAttendance((p) => ({ ...p, [id]: e.target.value })); }}
                      className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 ${cfg.cls}`}
                    >
                      {Object.entries(ATT_STATUS).map(([v, o]) => (
                        <option key={v} value={v}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`rounded-lg border px-2 py-1 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!allAttMarked && attendees.length > 0 && canManage && (
          <p className="text-xs text-slate-400">
            Confirma el estado de todos los participantes para habilitar el botón Continuar.
          </p>
        )}
      </div>
    );

    // ─── Etapa 3: Contenido ────────────────────────────────────────────────────
    if (activeStage === 3) return (
      <div className="space-y-4">
        {!stageAccessible[3] ? (
          <LockedStage prev="Asistencia" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">Registra el contenido de la capacitación. Esta información aparecerá en las actas oficiales.</p>
              {false && !isCancelled && canManage && (
                <ActionBtn
                  icon={FiSave}
                  label={savingClosure ? "Guardando…" : "Guardar y continuar"}
                  loading={savingClosure}
                  variant="primary"
                  onClick={saveClosure}
                  disabled={!canSaveClosure}
                />
              )}
            </div>
            <div>
              <SectionLabel>Objetivo <span className="normal-case font-normal text-red-500">*</span></SectionLabel>
              <textarea rows={3} className={inputCls} placeholder="¿Qué aprenderán o lograrán los participantes?"
                readOnly={!canManage}
                value={closure.objectives} onChange={(e) => canManage && setClosure((c) => ({ ...c, objectives: e.target.value }))} />
            </div>
            <div>
              <SectionLabel>Material utilizado</SectionLabel>
              <input type="text" className={inputCls} placeholder="Ej. Diapositivas, manuales, videos, equipos…"
                readOnly={!canManage}
                value={closure.material} onChange={(e) => canManage && setClosure((c) => ({ ...c, material: e.target.value }))} />
            </div>
            <div>
              <SectionLabel>Observaciones</SectionLabel>
              <textarea rows={2} className={inputCls} placeholder="Notas sobre cómo se desarrolló la actividad…"
                readOnly={!canManage}
                value={closure.observations} onChange={(e) => canManage && setClosure((c) => ({ ...c, observations: e.target.value }))} />
            </div>
            <div>
              <SectionLabel>Conclusiones</SectionLabel>
              <textarea rows={2} className={inputCls} placeholder="¿Qué conclusiones se obtuvieron?"
                readOnly={!canManage}
                value={closure.conclusions} onChange={(e) => canManage && setClosure((c) => ({ ...c, conclusions: e.target.value }))} />
            </div>

            {/* Fields for inasistentes acta */}
            {totalAusentes > 0 && (
              <>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <p className="mb-3 text-sm font-semibold text-amber-800">
                    Contenido específico para el acta de inasistentes ({totalAusentes} {totalAusentes === 1 ? "persona" : "personas"})
                  </p>
                  <div className="space-y-3">
                    <div>
                      <SectionLabel>Observaciones para inasistentes</SectionLabel>
                      <textarea rows={2} className={inputCls} placeholder="Notas sobre cómo justificar la inasistencia o qué acciones tomar…"
                        readOnly={!canManage}
                        value={closure.observaciones_inasistentes} onChange={(e) => canManage && setClosure((c) => ({ ...c, observaciones_inasistentes: e.target.value }))} />
                    </div>
                    <div>
                      <SectionLabel>Conclusiones para inasistentes</SectionLabel>
                      <textarea rows={2} className={inputCls} placeholder="Conclusiones específicas para quienes no asistieron…"
                        readOnly={!canManage}
                        value={closure.conclusiones_inasistentes} onChange={(e) => canManage && setClosure((c) => ({ ...c, conclusiones_inasistentes: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {hasClosure && (
              <div className="mt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2">
                  <FiCheckCircle size={15} /> Contenido registrado
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  {training.objectives   && <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Objetivo</p><p className="text-slate-700">{training.objectives}</p></div>}
                  {training.material     && <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Material</p><p className="text-slate-700">{training.material}</p></div>}
                  {training.observations && <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Observaciones</p><p className="text-slate-700">{training.observations}</p></div>}
                  {training.conclusions  && <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Conclusiones</p><p className="text-slate-700">{training.conclusions}</p></div>}
                  {training.observaciones_inasistentes && <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-0.5">Observaciones para inasistentes</p><p className="text-slate-700">{training.observaciones_inasistentes}</p></div>}
                  {training.conclusiones_inasistentes && <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-0.5">Conclusiones para inasistentes</p><p className="text-slate-700">{training.conclusiones_inasistentes}</p></div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );

    // ─── Etapa 4: Estadísticas ─────────────────────────────────────────────────
    if (activeStage === 4) return (
      <div className="space-y-5">
        {!stageAccessible[4] ? (
          <LockedStage prev="Contenido" />
        ) : (
          <>
            <p className="text-sm text-slate-500">Resumen calculado a partir de la asistencia registrada.</p>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 divide-y divide-slate-100 sm:grid-cols-5 sm:divide-y-0 sm:divide-x divide-slate-200">
                {[
                  { label: "Convocados",    val: totalConvocados,      color: "text-slate-800" },
                  { label: "Asistieron",    val: totalAsistentes,      color: "text-green-600" },
                  { label: "No asistieron", val: totalAusentes,        color: "text-red-600" },
                  { label: "% Asistencia",  val: `${pctAsistencia}%`,  color: "text-blue-600" },
                  { label: "% Inasistencia", val: `${pctInasistencia}%`, color: "text-amber-600" },
                ].map(({ label, val, color }, idx) => (
                  <div key={label} className={`p-4 text-center ${idx % 2 === 0 ? 'bg-slate-50/20' : ''} sm:bg-transparent`}>
                    <p className={`text-3xl font-bold font-mono ${color}`}>{val}</p>
                    <p className="mt-1.5 text-xs font-medium text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Tasa de asistencia</span>
                <span className="font-semibold">{pctAsistencia}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-green-500 transition-all duration-700" style={{ width: `${pctAsistencia}%` }} />
              </div>
            </div>

            <div>
              <SectionLabel>Detalle de participantes</SectionLabel>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {attendees.map((a) => {
                  const cfg = ATT_STATUS[a.attendance_status || "assigned"];
                  return (
                    <div key={a.user_id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                          {(getAttendeeName(a) || "?")[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{getAttendeeName(a)}</p>
                          <p className="text-xs text-slate-400">{a.cargo_snapshot}</p>
                        </div>
                      </div>
                      <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );

    // ─── Etapa 5: Actas ────────────────────────────────────────────────────────
    if (activeStage === 5) return (
      <div className="space-y-6">
        {!stageAccessible[5] ? (
          <LockedStage prev="Contenido" />
        ) : (
          <>
            {/* Acta principal */}
            <div>
              <SectionLabel>Acta de asistentes</SectionLabel>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">
                  Documento con los datos del evento y la lista de asistentes.
                  {isExternaInstructor && " Descárgala, haz que el instructor la firme en papel y luego súbela."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <ActionBtn
                      icon={mainActaExists ? FiRefreshCw : FiDownload}
                      label={mainActaExists ? "Regenerar acta" : "Generar acta de asistentes"}
                      loading={busyMap.genMain}
                      variant={mainActaExists ? "secondary" : "primary"}
                      onClick={() => actHeavy(
                        "genMain",
                        { title: "Generando acta", subtitle: "Preparando el documento en Google Docs. Esto puede tomar unos segundos." },
                        () => actions.generateActa(trainingId)
                      )}
                    />
                  )}
                  {mainActaExists && canOpenActaDocuments && (
                    <ActionBtn icon={FiExternalLink} label="Ver acta" variant="outline"
                      onClick={() => window.open(training.acta_drive_url, "_blank")} />
                  )}
                </div>
                {mainActaExists && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700">
                    <FiCheckCircle size={12} /> Acta generada y disponible en Google Drive
                  </div>
                )}
                {mainActaExists && !canOpenActaDocuments && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    El acta solo puede ser visualizada o descargada por la persona que la generó.
                  </div>
                )}

                {/* Instructor externo: subir firmada */}
                {isExternaInstructor && mainActaExists && canManage && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">Firma del instructor externo (en papel)</p>
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                    {externalSignedActaUrl && (
                      <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-green-600 shadow-sm">
                              <FiCheckCircle size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-green-800">Acta firmada cargada</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-green-700">
                                El documento firmado por el instructor externo ya está disponible para continuar con FamSign.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            {canOpenActaDocuments && (
                              <ActionBtn
                                icon={FiExternalLink}
                                label="Ver firmada"
                                variant="outline"
                                onClick={() => window.open(externalSignedActaUrl, "_blank")}
                              />
                            )}
                            <ActionBtn
                              icon={FiUpload}
                              label={busyMap.uploadExternal ? "Subiendo..." : "Reemplazar"}
                              loading={busyMap.uploadExternal}
                              variant="secondary"
                              onClick={() => fileRef.current?.click()}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={externalSignedActaUrl ? "hidden" : "flex flex-wrap gap-2"}>
                      <ActionBtn
                        icon={FiUpload}
                        label={busyMap.uploadExternal ? "Subiendo…" : (training.external_signed_acta_url ? "Reemplazar firmada" : "Subir acta firmada")}
                        loading={busyMap.uploadExternal}
                        variant={training.external_signed_acta_url ? "secondary" : "primary"}
                        onClick={() => fileRef.current?.click()}
                      />
                      {training.external_signed_acta_url && canOpenActaDocuments && (
                        <ActionBtn icon={FiExternalLink} label="Ver firmada" variant="outline"
                          onClick={() => window.open(training.external_signed_acta_url, "_blank")} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Acta de inasistentes */}
            {totalAusentes > 0 && (
              <div>
                <SectionLabel>Acta de inasistentes ({totalAusentes} {totalAusentes === 1 ? "persona" : "personas"})</SectionLabel>
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <p className="text-xs text-amber-800">
                    Documento separado para quienes no asistieron. Deben firmarlo para certificar que recibieron el material.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <ActionBtn
                        icon={absentActaExists ? FiRefreshCw : FiDownload}
                        label={absentActaExists ? "Regenerar acta" : "Generar acta de inasistentes"}
                        loading={busyMap.genAbsent}
                        variant={absentActaExists ? "secondary" : "primary"}
                        onClick={() => actHeavy(
                          "genAbsent",
                          { title: "Generando acta de inasistentes", subtitle: "Preparando el documento en Google Docs. Esto puede tomar unos segundos." },
                          () => actions.generateAbsentActa(trainingId)
                        )}
                      />
                    )}
                    {absentActaExists && canOpenActaDocuments && (
                      <ActionBtn icon={FiExternalLink} label="Ver acta" variant="outline"
                        onClick={() => window.open(training.absent_acta_drive_url, "_blank")} />
                    )}
                  </div>
                  {absentActaExists && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700">
                      <FiCheckCircle size={12} /> Acta de inasistentes generada
                    </div>
                  )}
                  {absentActaExists && !canOpenActaDocuments && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      El acta de inasistentes solo puede ser visualizada o descargada por la persona que la generó.
                    </div>
                  )}
                </div>
              </div>
            )}

            {stageDone[5] && (
              <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                <FiCheckCircle size={15} />
                {totalAusentes > 0 ? "Ambas actas generadas — avanza a Firmas" : "Acta generada — avanza a Firmas"}
              </div>
            )}
          </>
        )}
      </div>
    );

    // ─── Etapa 6: Firmas ───────────────────────────────────────────────────────
    if (activeStage === 6) return (
      <div className="space-y-6">
        {!stageAccessible[6] ? (
          <LockedStage prev="Actas" />
        ) : !canManage ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-900">
                  {stageDone[6] ? "Proceso de firmas completado" : "Proceso de firma en curso"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-blue-700">
                  {attendeeHasSignatureInboxAction
                    ? "Ya existe una solicitud de firma activa. Ingresa a tu bandeja para revisar si es tu turno y firmar el documento."
                    : stageDone[6]
                      ? "Los registros oficiales de esta capacitación ya fueron completados."
                      : "La capacitación se encuentra en proceso de firma. Cuando sea tu turno, la solicitud aparecerá en tu bandeja de firmas."}
                </p>
              </div>
              {attendeeHasSignatureInboxAction && (
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/signatures/inbox")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
                >
                  <FiExternalLink size={15} /> Ir a firmar
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <input
              ref={manualSignedFileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleManualSignedFileChange}
            />
            <input
              ref={absentManualSignedFileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleAbsentManualSignedFileChange}
            />
            {/* Firmas: acta de asistentes */}
            <div>
              <SectionLabel>Workflow de firmas — asistentes</SectionLabel>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                {(() => {
                  const inFirma = ACTIVE_WORKFLOW_STATUSES.includes(training.signature_workflow_status);
                  const firmada = mainSigned;
                  const sigTotal  = training.signature_total_signers || 0;
                  const sigSigned = training.signature_signed_count  || 0;
                  return (
                    <>
                      <p className="text-xs text-slate-500">
                        {firmada  ? "Todos los asistentes firmaron el registro."
                        : inFirma ? "El acta fue enviada y está esperando las firmas."
                        : isExternaInstructor
                          ? "Requiere que el acta firmada por el instructor esté subida (etapa anterior)."
                          : "El creador firma y se envía un enlace a cada participante para firma digital."}
                      </p>
                      {!mainSignatureComplete && canManage && (
                        <ActionBtn
                          icon={FiSend}
                          label={inFirma ? "Reenviar solicitud de firma" : "Iniciar workflow de firmas"}
                          loading={busyMap.famsignMain}
                          variant={inFirma ? "secondary" : "success"}
                          disabled={!mainActaExists || (isExternaInstructor && !externalSignedActaUrl)}
                          onClick={() => actHeavy(
                            "famsignMain",
                            inFirma
                              ? { title: "Enviando recordatorio", subtitle: "Reenviando el enlace de firma a quienes aún no han firmado." }
                              : { title: "Enviando solicitudes de firma", subtitle: "Creando el workflow en FamSign y enviando los enlaces de firma a cada participante." },
                            () => (inFirma ? actions.remindMain(trainingId) : actions.sendActaToFamSign(trainingId))
                          )}
                        />
                      )}
                      {mainSignatureComplete && (
                        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                          <FiCheckCircle size={15} /> Registro de asistentes completado
                        </div>
                      )}
                      {sigTotal > 0 && (
                        <div className="border-t border-slate-100 pt-3">
                          <TrainingSignatureProgress total={sigTotal} signed={sigSigned} label="asistentes han firmado" />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <SectionLabel>Alternativa manual — acta de asistentes</SectionLabel>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Si las firmas se recopilaron fuera de FamSign, sube aquí el PDF final firmado.
                  </p>
                  {mainManualSignedUrl && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-700">
                      <FiCheckCircle size={13} /> Documento firmado cargado
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {mainManualSignedUrl && canOpenActaDocuments && (
                      <ActionBtn
                        icon={FiExternalLink}
                        label="Ver firmado"
                        variant="outline"
                        onClick={() => window.open(mainManualSignedUrl, "_blank")}
                      />
                    )}
                    <ActionBtn
                      icon={FiUpload}
                      label={busyMap.uploadManualMain ? "Subiendo..." : (mainManualSignedUrl ? "Reemplazar firmado" : "Subir firmado")}
                      loading={busyMap.uploadManualMain}
                      variant={mainManualSignedUrl ? "secondary" : "primary"}
                      disabled={!mainActaExists}
                      onClick={() => manualSignedFileRef.current?.click()}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Firmas: acta de inasistentes */}
            {totalAusentes > 0 && (
              <div>
                <SectionLabel>Workflow de firmas — inasistentes</SectionLabel>
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  {(() => {
                    const inFirma = ACTIVE_WORKFLOW_STATUSES.includes(training.absent_workflow_status);
                    const firmada = absentSigned;
                    const sigTotal  = training.absent_total_signers || 0;
                    const sigSigned = training.absent_signed_count  || 0;
                    return (
                      <>
                        <p className="text-xs text-amber-700">
                          {firmada  ? "Todos los inasistentes firmaron."
                          : inFirma ? "Las solicitudes de firma fueron enviadas a los inasistentes."
                          : "Envía el acta de inasistentes para firma digital."}
                        </p>
                        {!absentSignatureComplete && canManage && (
                          <ActionBtn
                            icon={FiSend}
                            label={inFirma ? "Reenviar solicitud" : "Iniciar workflow para inasistentes"}
                            loading={busyMap.famsignAbsent}
                            variant={inFirma ? "secondary" : "primary"}
                            disabled={!absentActaExists}
                            onClick={() => actHeavy(
                              "famsignAbsent",
                              inFirma
                                ? { title: "Enviando recordatorio", subtitle: "Reenviando el enlace de firma a quienes no han firmado." }
                                : { title: "Enviando solicitudes a inasistentes", subtitle: "Creando el workflow en FamSign y enviando los enlaces de firma a quienes no asistieron." },
                              () => (inFirma ? actions.remindAbsent(trainingId) : actions.sendAbsentToFamSign(trainingId))
                            )}
                          />
                        )}
                        {absentSignatureComplete && (
                          <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                            <FiCheckCircle size={15} /> Inasistentes completados
                          </div>
                        )}
                        {sigTotal > 0 && (
                          <div className="border-t border-amber-100 pt-3">
                            <TrainingSignatureProgress total={sigTotal} signed={sigSigned} label="inasistentes han firmado" />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {totalAusentes > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <SectionLabel>Alternativa manual — inasistentes</SectionLabel>
                    <p className="text-xs leading-relaxed text-amber-700">
                      Si los inasistentes firmaron fuera de FamSign, sube aquí el PDF final firmado.
                    </p>
                    {absentManualSignedUrl && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-700">
                        <FiCheckCircle size={13} /> Documento de inasistentes firmado cargado
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {absentManualSignedUrl && canOpenActaDocuments && (
                        <ActionBtn
                          icon={FiExternalLink}
                          label="Ver firmado"
                          variant="outline"
                          onClick={() => window.open(absentManualSignedUrl, "_blank")}
                        />
                      )}
                      <ActionBtn
                        icon={FiUpload}
                        label={busyMap.uploadManualAbsent ? "Subiendo..." : (absentManualSignedUrl ? "Reemplazar firmado" : "Subir firmado")}
                        loading={busyMap.uploadManualAbsent}
                        variant={absentManualSignedUrl ? "secondary" : "primary"}
                        disabled={!absentActaExists}
                        onClick={() => absentManualSignedFileRef.current?.click()}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Completada */}
            {stageDone[6] && (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
                <FiCheckCircle size={36} className="mx-auto mb-2 text-green-600" />
                <p className="font-semibold text-green-800">Capacitación completada</p>
                <p className="mt-1 text-xs text-green-700">Los registros oficiales fueron completados por FamSign o por carga manual del documento firmado.</p>
              </div>
            )}
          </>
        )}
      </div>
    );

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-w-0 flex-col bg-[#F1F5F9] p-4 pb-28 sm:p-6">

      {/* Overlay bloqueante para operaciones pesadas (DESIGN.md §11) */}
      {heavyOp !== null && (
        <div className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60">
          <div className="z-[40] flex flex-col items-center gap-5 rounded-2xl border border-[#E5E7EB] bg-white px-10 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
            <FiRefreshCw size={28} className="animate-spin text-[#2563EB]" />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[17px] font-semibold leading-snug tracking-tight text-[#1F2937]">
                {heavyOp.title}
              </span>
              <span className="max-w-[260px] text-[13px] leading-relaxed text-[#6B7280]">
                {heavyOp.subtitle}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <button
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <FiArrowLeft size={15} /> Capacitaciones
      </button>

      {/* Header + Pipeline */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{training.code}</span>
              <TrainingStatusBadge status={training.status} />
              <TrainingTypeBadge type={training.type} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">{training.title}</h1>
            {training.area && <p className="mt-0.5 text-sm text-slate-500">{training.area}</p>}
          </div>
          {!isCancelled && canManage && (
            <ActionBtn icon={FiTrash2} label="Cancelar" variant="danger"
              onClick={handleCancel} disabled={actions.busy} />
          )}
        </div>

        {/* Countdown timer */}
        {!isCancelled && training.scheduled_date && (
          <div className="mt-5">
            <CountdownTimer timeLeft={countdown} />
          </div>
        )}

        {/* Google Calendar link */}
        {!isCancelled && training.calendar_event_link && (
          <div className="mt-3">
            <a
              href={training.calendar_event_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 cursor-pointer transition-all active:scale-[0.97]"
            >
              <FiCalendar size={16} />
              Ver evento en Google Calendar
            </a>
          </div>
        )}

        {/* Google Meet link */}
        {!isCancelled && training.meet_link && (
          <div className="mt-3">
            <a
              href={training.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 cursor-pointer transition-all active:scale-[0.97]"
            >
              <FiVideo size={16} />
              Unirse a la reunión en Google Meet
            </a>
          </div>
        )}

        {/* Pipeline stepper */}
        {!isCancelled && activeStage !== null && (
          <div className="mt-5 overflow-x-auto border-t border-slate-100 pt-5">
            <div className="flex min-w-max items-center pr-2">
              {PIPELINE.map((stage, i) => {
                const status = stageDone[stage.id] ? "done"
                  : activeStage === stage.id ? "active"
                  : stageAccessible[stage.id] ? "locked"
                  : "locked";
                return (
                  <React.Fragment key={stage.id}>
                    <PipelineStep stage={stage} status={status} onClick={() => goStage(stage.id)} />
                    {i < PIPELINE.length - 1 && <PipelineConnector done={stageDone[stage.id]} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stage content */}
      {!isCancelled && activeStage !== null && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Stage header bar */}
          <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-5 py-4">
            {(() => {
              const stage = PIPELINE.find((s) => s.id === activeStage);
              const Icon = stage?.icon;
              return (
                <>
                  <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${stageDone[activeStage] ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
                    {Icon && <Icon size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Etapa {activeStage} de {PIPELINE.length}
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{stage?.label}</p>
                  </div>
                  {stageDone[activeStage] && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                      <FiCheck size={10} /> Completada
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          {/* Stage body */}
          <div className="p-5">{renderStage()}</div>

          {/* Stage navigation */}
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goPrev}
              disabled={activeStage === 1}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 sm:w-auto"
            >
              <FiChevronLeft size={15} /> Anterior
            </button>

            <div className="flex items-center justify-center gap-1">
              {PIPELINE.map((s) => (
                <div
                  key={s.id}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width:  activeStage === s.id ? 18 : 7,
                    height: 7,
                    background: stageDone[s.id] ? "#22C55E" : activeStage === s.id ? "#2563EB" : "#E2E8F0",
                  }}
                />
              ))}
            </div>

            {activeStage === 2 && canManage && !isCancelled ? (
              <button
                type="button"
                onClick={saveAttendance}
                disabled={savingAtt || !allAttMarked}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-30 sm:w-auto"
              >
                {savingAtt ? <FiLoader size={14} className="animate-spin" /> : <FiCheck size={14} />}
                {savingAtt ? "Guardando…" : "Continuar"}
              </button>
            ) : activeStage === 3 && canManage && !isCancelled ? (
              <button
                type="button"
                onClick={saveClosure}
                disabled={savingClosure || !canSaveClosure}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-30 sm:w-auto"
              >
                {savingClosure ? <FiLoader size={14} className="animate-spin" /> : <FiSave size={14} />}
                {savingClosure ? "Guardando..." : "Guardar y continuar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={activeStage === 6}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-30 sm:w-auto"
              >
                Siguiente <FiChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-500">Esta capacitación fue cancelada.</p>
        </div>
      )}

      {!isCancelled && (
        <TrainingFamSignFab training={training} actions={actions} onRefresh={reload} />
      )}
    </div>
  );
}
