import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCheckCircle, FiDownload, FiPlus, FiTool } from "react-icons/fi";
import { useApi } from "../../../core/hooks/useApi";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/AuthContext";
import api from "../../../core/api";
import { getServicioActionQueue } from "../../../core/api/servicioApi";
import { normalizeRoles, isChiefTechnical as isChiefTechnicalRole } from "../../shared/purchases-workspace/purchaseRoleGroups";
import ActionQueueList from "../components/dashboard/ActionQueueList";
import {
  getMantenimientos,
  createMantenimiento,
  approveMantenimiento,
  exportMantenimientoPDF,
  listPreventiveAnnualPlans,
  getPreventiveAnnualPlanDetail,
  createPreventiveAnnualPlan,
  publishPreventiveAnnualPlan,
  rebaselinePreventiveAnnualPlan,
  issueFst16,
  issueFst17,
  registerPreventiveOffer,
  decidePreventiveOffer,
  registerReprogrammingNotice,
  registerPreventiveCoordination,
  registerPreventiveWorkOrder,
  requestPreventiveKit,
  registerKitWarehouseExit,
  closePreventiveExecution,
  getPreventiveComplianceDashboard,
  getPreventiveCapacityDashboard,
  sendPreventiveMonthlyReport,
} from "../../../core/api/mantenimientosApi";
import FirmaDigital from "../components/FirmaDigital";
import PreventiveAnnualPlanBoard from "../components/PreventiveAnnualPlanBoard";
import PreventiveEquipmentSchedulePanel from "../components/PreventiveEquipmentSchedulePanel";
import CorrectiveCaseWorkspace from "../components/CorrectiveCaseWorkspace";
import PreventiveTimelineStrip from "../components/PreventiveTimelineStrip";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { formatDateOnlyEs, formatDateTimeEs, toStatusLabel } from "../../../core/utils/workflowUi";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import "../design/tokens.css";

const badgeTone = (s) => {
  const value = String(s || "").toLowerCase();
  if (["aprobado", "approved", "done", "cumplido"].includes(value)) return "success";
  if (["pendiente", "pending"].includes(value)) return "warning";
  if (["rechazado", "rejected", "no cumplido"].includes(value)) return "danger";
  return "neutral";
};

const formatDate = (value, withTime = false) => {
  if (withTime) return formatDateTimeEs(value, "—");
  return formatDateOnlyEs(value, "—");
};

const normalizeEquipoId = (eq) => eq?.id ?? eq?.id_equipo ?? eq?.equipo_id ?? null;

const inputClass = "mt-1 w-full rounded-[var(--st-radius-md)] border px-3 py-2";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const TAB_PREVENTIVE = "preventive";
const TAB_CORRECTIVE = "corrective";

const Mantenimientos = ({ initialRows = null, onRefresh, initialTab = TAB_PREVENTIVE }) => {
  const { showToast, confirm } = useUI();
  const { user } = useAuth();
  // La cola de acciones de Inicio (actionQueue.service.js) enlaza aca con
  // ?tab=corrective -- antes esta pagina solo miraba el prop `initialTab`
  // (fijo por ruta) e ignoraba el query string, asi que ese deep-link
  // aterrizaba siempre en preventivo. Ahora el query string manda si viene.
  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get("tab");
  const resolvedInitialTab =
    queryTab === TAB_CORRECTIVE || queryTab === TAB_PREVENTIVE
      ? queryTab
      : initialTab === TAB_CORRECTIVE
      ? TAB_CORRECTIVE
      : TAB_PREVENTIVE;
  const [tab, setTab] = useState(resolvedInitialTab);

  useEffect(() => {
    setTab(resolvedInitialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, queryTab]);

  const userRoles = useMemo(() => normalizeRoles(user), [user]);
  const isChiefTechnical = useMemo(() => isChiefTechnicalRole(userRoles), [userRoles]);
  const [decisionQueue, setDecisionQueue] = useState([]);
  const [decisionQueueLoading, setDecisionQueueLoading] = useState(true);

  const loadDecisionQueue = useCallback(async () => {
    setDecisionQueueLoading(true);
    try {
      const queue = await getServicioActionQueue({ scope: isChiefTechnical ? "team" : "mine" });
      const items = Array.isArray(queue?.items) ? queue.items : [];
      setDecisionQueue(items.filter((item) => item.type === "preventive_offer" || item.type === "corrective"));
    } catch (error) {
      console.warn("No se pudo cargar la cola de decisiones de mantenimientos", error?.message || error);
      setDecisionQueue([]);
    } finally {
      setDecisionQueueLoading(false);
    }
  }, [isChiefTechnical]);

  useEffect(() => {
    loadDecisionQueue();
  }, [loadDecisionQueue]);

  // ---------------------------------------------------------------------------
  // Legacy / correctivo rápido (compatibilidad)
  // ---------------------------------------------------------------------------
  const [open, setOpen] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [legacyFilter, setLegacyFilter] = useState("correctivo");
  const [form, setForm] = useState({
    id_equipo: "",
    tipo: "correctivo",
    responsable: "",
    fecha_programada: "",
    frecuencia: "6m",
    observaciones: "",
    evidencias: [],
  });

  const { data, loading, execute: fetchList, setData } = useApi(getMantenimientos, { errorMsg: "Error al cargar mantenimientos" });

  const loadLegacy = useCallback(async () => {
    await fetchList({ page: 1, pageSize: 200 });
  }, [fetchList]);

  const loadEquipos = useCallback(async () => {
    try {
      const { data: response } = await api.get("/servicio/equipos");
      const rows = Array.isArray(response?.rows)
        ? response.rows
        : Array.isArray(response?.result?.rows)
        ? response.result.rows
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
        ? response
        : [];
      setEquipos(rows);
    } catch (error) {
      console.warn("No se pudo cargar equipos", error?.message || error);
    }
  }, []);

  useEffect(() => {
    loadLegacy();
  }, [loadLegacy]);

  useEffect(() => {
    if (!Array.isArray(initialRows)) return;
    setData({ rows: initialRows });
  }, [initialRows, setData]);

  useEffect(() => {
    if (!open) return;
    loadEquipos();
  }, [open, loadEquipos]);

  const rows = useMemo(() => data?.rows || data?.result?.rows || data || [], [data]);
  const equipoIds = useMemo(
    () => new Set(equipos.map((eq) => Number(normalizeEquipoId(eq))).filter((n) => !Number.isNaN(n))),
    [equipos],
  );

  const filteredLegacyRows = useMemo(() => {
    const source = Array.isArray(rows) ? rows : [];
    if (legacyFilter === "all") return source;
    return source.filter((row) => {
      const tipo = String(row.tipo || "").toLowerCase();
      if (legacyFilter === "correctivo") return tipo.includes("corr");
      if (legacyFilter === "preventivo") return tipo.includes("prev");
      return true;
    });
  }, [rows, legacyFilter]);

  const sigRespRef = useRef(null);
  const sigRecRef = useRef(null);
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    setField("evidencias", files);
  };

  const submitLegacy = async (event) => {
    event?.preventDefault();
    setSaving(true);
    try {
      const idEquipoNumber = Number.parseInt(form.id_equipo, 10);
      if (Number.isNaN(idEquipoNumber) || !equipoIds.has(idEquipoNumber)) {
        showToast("Selecciona un equipo válido para el mantenimiento", "warning");
        setSaving(false);
        return;
      }
      const firma_responsable = sigRespRef.current?.getBase64() || "";
      const firma_receptor = sigRecRef.current?.getBase64() || "";

      const payload = new FormData();
      payload.append("id_equipo", idEquipoNumber);
      payload.append("tipo", "correctivo");
      payload.append("responsable", form.responsable || "");
      payload.append("observaciones", form.observaciones || "");
      payload.append("frecuencia", form.frecuencia || "6m");
      if (form.fecha_programada) payload.append("fecha_programada", form.fecha_programada);
      if (firma_responsable) payload.append("firma_responsable", firma_responsable);
      if (firma_receptor) payload.append("firma_receptor", firma_receptor);
      (form.evidencias || []).forEach((file) => payload.append("evidencias", file));

      const response = await createMantenimiento(payload);
      showToast(response?.message || "Mantenimiento correctivo registrado", "success");
      setOpen(false);
      setForm({ id_equipo: "", tipo: "correctivo", responsable: "", fecha_programada: "", frecuencia: "6m", observaciones: "", evidencias: [] });
      sigRespRef.current?.clear?.();
      sigRecRef.current?.clear?.();
      await loadLegacy();
      await onRefresh?.();
    } catch (error) {
      console.error(error);
      showToast(error?.response?.data?.error || "No se pudo crear el mantenimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (row) => {
    const ok = await confirm(`¿Aprobar mantenimiento #${row.id}?`);
    if (!ok) return;
    try {
      await approveMantenimiento(row.id);
      showToast(`Mantenimiento #${row.id} aprobado`, "success");
      await loadLegacy();
      await onRefresh?.();
    } catch (error) {
      console.error(error);
      showToast("No se pudo aprobar", "error");
    }
  };

  const toPDF = async (row) => {
    try {
      const response = await exportMantenimientoPDF(row.id);
      const link = response?.pdf_link || response?.drive_link || response?.link;
      if (link) window.open(link, "_blank");
      else showToast("PDF generado sin enlace disponible", "info");
    } catch (error) {
      console.error(error);
      showToast("No se pudo exportar PDF", "error");
    }
  };

  // ---------------------------------------------------------------------------
  // Preventivo ST-01-02
  // ---------------------------------------------------------------------------
  const [preventiveBusy, setPreventiveBusy] = useState(false);
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [capacity, setCapacity] = useState(null);

  const reloadPreventive = useCallback(
    async (requestedPlanId = null) => {
      setPreventiveBusy(true);
      try {
        const plansRows = await listPreventiveAnnualPlans({ limit: 200 });
        setPlans(plansRows);

        const fallbackPlanId =
          requestedPlanId ||
          activePlanId ||
          plansRows.find((plan) => String(plan.status || "").toLowerCase() === "active")?.id ||
          plansRows[0]?.id ||
          null;

        if (!fallbackPlanId) {
          setActivePlanId(null);
          setActivePlan(null);
          setCompliance(null);
          setCapacity(null);
          return;
        }

        setActivePlanId(fallbackPlanId);
        const [planDetail, complianceData, capacityData] = await Promise.all([
          getPreventiveAnnualPlanDetail(fallbackPlanId),
          getPreventiveComplianceDashboard({ annual_plan_id: fallbackPlanId }),
          getPreventiveCapacityDashboard({ annual_plan_id: fallbackPlanId }),
        ]);
        setActivePlan(planDetail);
        setCompliance(complianceData);
        setCapacity(capacityData);
      } catch (error) {
        console.error(error);
        showToast(error?.response?.data?.error || "No se pudo cargar el workspace preventivo", "error");
      } finally {
        setPreventiveBusy(false);
      }
    },
    [activePlanId, showToast],
  );

  useEffect(() => {
    reloadPreventive();
  }, [reloadPreventive]);

  const runPreventiveAction = async (fn, successMessage, fallbackError, refreshPlanId = null) => {
    setPreventiveBusy(true);
    try {
      await fn();
      if (successMessage) showToast(successMessage, "success");
      await reloadPreventive(refreshPlanId || activePlanId);
      await loadLegacy();
      await loadDecisionQueue();
      await onRefresh?.();
    } catch (error) {
      console.error(error);
      showToast(error?.response?.data?.error || fallbackError, "error");
    } finally {
      setPreventiveBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UI render
  // ---------------------------------------------------------------------------
  return (
    <div className={`${WORKSPACE_PAGE_CLASS} st-scope gap-4`} style={{ background: "var(--st-bg)" }}>
      <ActionQueueList
        title="Qué necesita decisión en mantenimientos"
        items={decisionQueue}
        loading={decisionQueueLoading}
        emptyDescription="Ofertas Anexo 4 pendientes y correctivos accionables aparecerán aquí antes de entrar al panel correspondiente."
      />

      {/* Plan (planificacion anual, orientada a linea de tiempo) y Caso
          (ejecucion puntual de un correctivo, orientada a tablero) son dos
          tipos de trabajo distintos -- antes compartian el mismo header de
          card + 2 botones primary/secondary, lo que los hacia lucir como la
          misma pantalla con un filtro. El tag mono tipo callsign (mismo
          lenguaje que JEFE-SVC/ING-SVC/ESP-APP del Dashboard) marca en que
          modo se esta antes de leer nada mas. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="font-mono-data inline-block rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ background: "var(--st-accent-soft)", color: "var(--st-accent-strong)" }}
          >
            {tab === TAB_CORRECTIVE ? "CASO" : "PLAN"}
          </span>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
            <FiTool /> {tab === TAB_CORRECTIVE ? "Correctivos" : "Mantenimiento preventivo"}
          </h1>
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>
            {tab === TAB_CORRECTIVE
              ? "Ejecución puntual por caso: triage, clasificación por especialidad, repuestos y cierre."
              : "Planificación anual ST-01-02: línea de tiempo de cumplimiento y capacidad por mes."}
          </p>
        </div>
        <div className="flex items-center border-y" style={{ borderColor: "var(--st-border)" }}>
          <button
            type="button"
            onClick={() => setTab(TAB_PREVENTIVE)}
            className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150"
            style={{ color: tab === TAB_PREVENTIVE ? "var(--st-accent-strong)" : "var(--st-text-muted)" }}
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => setTab(TAB_CORRECTIVE)}
            className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150"
            style={{ color: tab === TAB_CORRECTIVE ? "var(--st-accent-strong)" : "var(--st-text-muted)", borderLeft: "1px solid var(--st-border)" }}
          >
            Casos
          </button>
        </div>
      </div>

      {tab === TAB_PREVENTIVE ? (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--st-text-faint)" }}>Línea de tiempo del plan — cumplimiento y carga por mes</p>
            <PreventiveTimelineStrip complianceMonths={compliance?.by_month} capacityMonths={capacity?.months} />
          </div>

          <PreventiveAnnualPlanBoard
            plans={plans}
            activePlanId={activePlanId}
            busy={preventiveBusy}
            onSelectPlan={(plan) => reloadPreventive(plan?.id)}
            onCreatePlan={(payload) => runPreventiveAction(() => createPreventiveAnnualPlan(payload), "Plan anual preventivo generado", "No se pudo generar el plan preventivo", null)}
            onPublishPlan={(plan) => runPreventiveAction(() => publishPreventiveAnnualPlan(plan.id), `Plan ${plan.plan_year} v${plan.version} publicado`, "No se pudo publicar el plan", plan.id)}
            onRebaselinePlan={(plan) => runPreventiveAction(() => rebaselinePreventiveAnnualPlan(plan.id, { reason: "Cambio de base de equipos/frecuencia/condición contractual" }), "Rebaseline creado correctamente", "No se pudo crear rebaseline", null)}
            onIssueFst16={(plan) => runPreventiveAction(() => issueFst16(plan.id, {}), "F.ST-16 emitido", "No se pudo emitir F.ST-16", plan.id)}
            onSendMonthlyReport={(payload) => runPreventiveAction(() => sendPreventiveMonthlyReport(activePlanId, payload), "Reporte mensual enviado", "No se pudo enviar reporte mensual", activePlanId)}
          />

          <PreventiveEquipmentSchedulePanel
            plan={activePlan}
            compliance={compliance}
            capacity={capacity}
            busy={preventiveBusy}
            onIssueFst17={(item) => runPreventiveAction(() => issueFst17(item.id, {}), "F.ST-17 emitido", "No se pudo emitir F.ST-17", activePlanId)}
            onIssueOffer={(item, payload) => runPreventiveAction(() => registerPreventiveOffer(item.id, payload), "Oferta Anexo 4 registrada", "No se pudo registrar la oferta", activePlanId)}
            onOfferDecision={(item, payload) => runPreventiveAction(() => decidePreventiveOffer(item.id, payload), "Decisión de oferta registrada", "No se pudo registrar la decisión de oferta", activePlanId)}
            onReprogram={(item, payload) => runPreventiveAction(() => registerReprogrammingNotice(item.id, payload), "Reprogramación Anexo 5 registrada", "No se pudo registrar la reprogramación", activePlanId)}
            onCoordinate={(item, payload) => runPreventiveAction(() => registerPreventiveCoordination(item.id, payload), "Coordinación registrada", "No se pudo registrar coordinación", activePlanId)}
            onWorkOrder={(item, payload) => runPreventiveAction(() => registerPreventiveWorkOrder(item.id, payload), "WO preventiva registrada", "No se pudo registrar WO preventiva", activePlanId)}
            onRequestKit={(item, payload) => runPreventiveAction(() => requestPreventiveKit(item.id, payload), "Solicitud de kit registrada", "No se pudo registrar solicitud de kit", activePlanId)}
            onWarehouseExit={(item, payload) =>
              runPreventiveAction(
                () => registerKitWarehouseExit(payload.kit_id, { warehouse_exit_reference: payload.warehouse_exit_reference }),
                "Salida de bodega registrada",
                "No se pudo registrar salida de bodega",
                activePlanId,
              )
            }
            onCloseExecution={(item, payload) => runPreventiveAction(() => closePreventiveExecution(item.id, payload), "Cierre preventivo completado", "No se pudo cerrar el preventivo", activePlanId)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <ServicioCard className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--st-text)" }}>Registro correctivo / compatibilidad</h3>
                <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>Flujo rápido legado separado del procedimiento preventivo ST-01-02.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={legacyFilter} onChange={(event) => setLegacyFilter(event.target.value)} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-xs" style={inputStyle}>
                  <option value="correctivo">Solo correctivo</option>
                  <option value="preventivo">Solo preventivo</option>
                  <option value="all">Todos</option>
                </select>
                <Button size="sm" icon={FiPlus} onClick={() => setOpen(true)}>Nuevo correctivo</Button>
              </div>
            </div>
          </ServicioCard>

          <ServicioCard className="overflow-x-auto p-0">
            <div className="border-b p-4" style={{ borderColor: "var(--st-border)" }}>
              <CorrectiveCaseWorkspace />
            </div>
            <div className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--st-text-faint)" }}>Flujo legado de compatibilidad</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ background: "var(--st-surface-sunken)", color: "var(--st-text-muted)" }}>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Equipo</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Responsable</th>
                    <th className="px-4 py-2">Fecha programada</th>
                    <th className="px-4 py-2">Próximo recordatorio</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLegacyRows.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid var(--st-border)" }}>
                      <td className="px-4 py-2" style={{ color: "var(--st-text-muted)" }}>{row.id}</td>
                      <td className="px-4 py-2" style={{ color: "var(--st-text)" }}>{row.equipo_nombre || row.equipo || `Equipo ${row.id_equipo}`}</td>
                      <td className="px-4 py-2" style={{ color: "var(--st-text-muted)" }}>{row.tipo}</td>
                      <td className="px-4 py-2" style={{ color: "var(--st-text-muted)" }}>{row.responsable}</td>
                      <td className="px-4 py-2" style={{ color: "var(--st-text-muted)" }}>{formatDate(row.fecha_programada || row.fecha)}</td>
                      <td className="px-4 py-2">
                        {row.next_maintenance_date ? (
                          <div className="space-y-1">
                            <p style={{ color: "var(--st-text-muted)" }}>{formatDate(row.next_maintenance_date)}</p>
                            <ServicioBadge tone={badgeTone(row.next_maintenance_status) === "danger" ? "danger" : row.next_maintenance_status === "notificado" ? "success" : "warning"}>
                              {toStatusLabel(row.next_maintenance_status || "pendiente")}
                            </ServicioBadge>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--st-text-faint)" }}>Sin programar</span>
                        )}
                      </td>
                      <td className="px-4 py-2"><ServicioBadge tone={badgeTone(row.estado || row.status)}>{toStatusLabel(row.estado || row.status)}</ServicioBadge></td>
                      <td className="space-x-2 px-4 py-2 text-right">
                        <Button size="sm" variant="success" onClick={() => approve(row)} aria-label={`Aprobar mantenimiento ${row.id}`}><FiCheckCircle /></Button>
                        <Button size="sm" variant="secondary" onClick={() => toPDF(row)} aria-label={`Exportar PDF mantenimiento ${row.id}`}><FiDownload /></Button>
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredLegacyRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center" style={{ color: "var(--st-text-faint)" }}>No hay mantenimientos para este filtro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ServicioCard>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo mantenimiento correctivo" maxWidth="max-w-3xl">
        <form onSubmit={submitLegacy} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Equipo</label>
              <select value={form.id_equipo} onChange={(event) => setField("id_equipo", event.target.value)} className={inputClass} style={inputStyle} required>
                <option value="">Selecciona un equipo…</option>
                {equipos.map((eq) => {
                  const optionId = normalizeEquipoId(eq);
                  if (!optionId) return null;
                  return (
                    <option key={optionId} value={optionId}>{eq.nombre || eq.equipo || `Equipo ${optionId}`}</option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Responsable</label>
              <input value={form.responsable} onChange={(event) => setField("responsable", event.target.value)} className={inputClass} style={inputStyle} required />
            </div>
            <div>
              <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Fecha programada</label>
              <input type="date" value={form.fecha_programada} onChange={(event) => setField("fecha_programada", event.target.value)} className={inputClass} style={inputStyle} required />
            </div>
            <div>
              <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Frecuencia recordatorio</label>
              <select value={form.frecuencia} onChange={(event) => setField("frecuencia", event.target.value)} className={inputClass} style={inputStyle}>
                <option value="6m">Recordar en 6 meses</option>
                <option value="12m">Recordar en 1 año</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Observaciones</label>
              <textarea rows={3} value={form.observaciones} onChange={(event) => setField("observaciones", event.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:col-span-2 sm:grid-cols-2">
              <div>
                <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Firma responsable</label>
                <div className="mt-1"><FirmaDigital ref={sigRespRef} /></div>
              </div>
              <div>
                <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Firma receptor</label>
                <div className="mt-1"><FirmaDigital ref={sigRecRef} /></div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>Evidencias</label>
              <input type="file" accept="image/*,application/pdf" onChange={handleFiles} className="mt-1 file:border-0 file:bg-[var(--st-accent-soft)] file:text-[var(--st-accent-strong)]" multiple />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={saving}>{saving ? "Guardando..." : "Guardar correctivo"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Mantenimientos;
