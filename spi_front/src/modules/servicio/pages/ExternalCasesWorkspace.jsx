import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiActivity, FiClock, FiPlus, FiRefreshCw, FiRepeat, FiShuffle } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import ExternalIntegrationHealthPanel from "../components/ExternalIntegrationHealthPanel";
import CorrectiveActionForm from "../components/CorrectiveActionForm";
import {
  createExternalCase,
  getExternalCasesWorkspaceKpi,
  getExternalProvidersHealth,
  listExternalCaseEvents,
  listExternalCasesWorkspace,
  listExternalProviderIdentities,
  postExternalCaseCeacDecision,
  processExternalCasesSyncQueue,
  reconcileExternalCaseState,
  retryExternalCaseSync,
  upsertExternalProviderIdentity,
} from "../../../core/api/externalCasesApi";
import { formatDateTimeEs, toStatusLabel } from "../../../core/utils/workflowUi";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import ServicioEmptyState from "../design/ServicioEmptyState";
import "../design/tokens.css";

const PROVIDER_OPTIONS = [
  { value: "", label: "Todos los proveedores" },
  { value: "navify", label: "Navify" },
  { value: "online_support", label: "Online Support" },
  { value: "rexis", label: "REXIS" },
  { value: "goapp", label: "GoApp" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "pending_validation", label: "Validación pendiente" },
  { value: "ready_to_sync", label: "Listo para sync" },
  { value: "external_created", label: "Creado externo" },
  { value: "dispatched", label: "Despachado" },
  { value: "work_in_progress", label: "Trabajo en progreso" },
  { value: "finalized", label: "Finalizado" },
  { value: "closed", label: "Cerrado" },
  { value: "sync_error", label: "Error de sync" },
  { value: "blocked", label: "Bloqueado" },
];

const toneByStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["closed", "finalized"].includes(value)) return "success";
  if (["dispatched", "work_in_progress", "follow_up_pending"].includes(value)) return "warning";
  if (["sync_error", "blocked", "pending_validation"].includes(value)) return "danger";
  return "neutral";
};

const inputClass = "mt-1 w-full rounded-[var(--st-radius-md)] border px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

// Mismo criterio de urgencia que actionQueue.service.js (ACTIONABLE_EXTERNAL_
// STATUSES): sync_error/blocked necesitan intervencion ya, pending_validation
// es accionable pero no roto, el resto ya no requiere decision.
const computeExternalUrgency = (row) => {
  const status = String(row.internal_status || "").toLowerCase();
  if (row.sync_last_error || status === "sync_error" || status === "blocked") return "urgent";
  if (status === "pending_validation") return "normal";
  return "resolved";
};

const EXTERNAL_URGENCY_RANK = { urgent: 0, normal: 1, resolved: 2 };

const ExternalCasesWorkspace = () => {
  const { showToast } = useUI();
  const [rows, setRows] = useState([]);
  const [kpi, setKpi] = useState({
    total: 0,
    pending_validation: 0,
    in_progress: 0,
    completed: 0,
    sync_errors: 0,
    drift_cases: 0,
  });
  const [providerHealth, setProviderHealth] = useState([]);
  const [providerIdentities, setProviderIdentities] = useState([]);
  const [filters, setFilters] = useState({ provider: "", status: "", q: "" });
  const [actionableOnly, setActionableOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [queueProcessing, setQueueProcessing] = useState(false);
  const [busyCaseId, setBusyCaseId] = useState(null);
  const [eventsByCase, setEventsByCase] = useState({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    provider: "goapp",
    client_name: "",
    area_name: "",
    laboratory_name: "",
    equipment_serial: "",
    alarm_code: "",
    incident_type: "",
    issue_description: "",
    photo_urls: "",
  });
  const [identityDraft, setIdentityDraft] = useState({
    provider: "navify",
    client_user_identifier: "",
    provider_user_identifier: "",
    credential_alias: "",
    area_name: "",
    laboratory_name: "",
    equipment_serial: "",
  });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [cases, kpiData, health, identities] = await Promise.all([
        listExternalCasesWorkspace({
          provider: filters.provider || undefined,
          status: filters.status || undefined,
          q: filters.q || undefined,
          limit: 150,
        }),
        getExternalCasesWorkspaceKpi({ provider: filters.provider || undefined }),
        getExternalProvidersHealth(),
        listExternalProviderIdentities({ provider: filters.provider || undefined, limit: 100 }),
      ]);
      setRows(Array.isArray(cases) ? cases : []);
      setKpi(kpiData || {});
      setProviderHealth(Array.isArray(health) ? health : []);
      setProviderIdentities(Array.isArray(identities) ? identities : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el workspace de casos externos", "error");
    } finally {
      setLoading(false);
    }
  }, [filters.provider, filters.q, filters.status, showToast]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const sortedRows = useMemo(
    () =>
      rows
        .map((row) => ({ ...row, urgency: computeExternalUrgency(row) }))
        .filter((row) => !actionableOnly || row.urgency !== "resolved")
        .sort((a, b) => {
          const rankDiff = EXTERNAL_URGENCY_RANK[a.urgency] - EXTERNAL_URGENCY_RANK[b.urgency];
          if (rankDiff !== 0) return rankDiff;
          return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
        }),
    [rows, actionableOnly],
  );

  const toggleEvents = async (caseId) => {
    if (eventsByCase[caseId]) {
      setEventsByCase((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
      return;
    }
    setBusyCaseId(caseId);
    try {
      const events = await listExternalCaseEvents(caseId);
      setEventsByCase((prev) => ({ ...prev, [caseId]: events }));
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron cargar eventos", "error");
    } finally {
      setBusyCaseId(null);
    }
  };

  const handleRetry = async (caseId) => {
    setBusyCaseId(caseId);
    try {
      await retryExternalCaseSync(caseId, { reason: "Reintento manual desde workspace" });
      showToast("Reintento lanzado", "success");
      await loadWorkspace();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo reintentar sincronización", "error");
    } finally {
      setBusyCaseId(null);
    }
  };

  const handleReconcile = async (caseId) => {
    setBusyCaseId(caseId);
    try {
      await reconcileExternalCaseState(caseId, { comment: "Reconciliación manual desde workspace" });
      showToast("Reconciliación actualizada", "success");
      await loadWorkspace();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo reconciliar", "error");
    } finally {
      setBusyCaseId(null);
    }
  };

  // Reemplaza el window.prompt() que existia antes -- mismo problema de UX
  // que se encontro y corrigio en CorrectiveCaseWorkspace (Fase 3): un
  // dialogo nativo del navegador para una decision con consecuencia real
  // (resolver vs escalar a visita) no deja ver que se va a enviar antes de
  // confirmar. Se reusa CorrectiveActionForm (Fase 3): es un formulario
  // inline generico, no especifico de casos correctivos pese al nombre del
  // archivo.
  const [ceacDecisionTarget, setCeacDecisionTarget] = useState(null);

  const submitCeacDecision = async (payload) => {
    if (!ceacDecisionTarget) return;
    const { caseId, decision } = ceacDecisionTarget;
    setBusyCaseId(caseId);
    try {
      await postExternalCaseCeacDecision(caseId, { decision, notes: payload.notes });
      showToast("Decisión CEAC registrada", "success");
      setCeacDecisionTarget(null);
      await loadWorkspace();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo registrar decisión CEAC", "error");
    } finally {
      setBusyCaseId(null);
    }
  };

  const handleProcessQueue = async () => {
    setQueueProcessing(true);
    try {
      const summary = await processExternalCasesSyncQueue({ limit: 25 });
      showToast(`Cola procesada · reclamados: ${summary?.claimed || 0}, completados: ${summary?.completed || 0}`, "success");
      await loadWorkspace();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo procesar la cola", "error");
    } finally {
      setQueueProcessing(false);
    }
  };

  const handleCreateCase = async () => {
    const requiredFields = ["provider", "area_name", "equipment_serial", "alarm_code", "incident_type", "issue_description"];
    const missing = requiredFields.filter((field) => !String(createDraft[field] || "").trim());
    if (missing.length > 0) {
      showToast(`Completa campos obligatorios: ${missing.join(", ")}`, "warning");
      return;
    }
    setCreating(true);
    try {
      const photos = String(createDraft.photo_urls || "")
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((url) => ({ url }));
      await createExternalCase({
        provider: createDraft.provider,
        client_name: createDraft.client_name || null,
        area_name: createDraft.area_name,
        laboratory_name: createDraft.laboratory_name || null,
        equipment_serial: createDraft.equipment_serial,
        alarm_code: createDraft.alarm_code,
        incident_type: createDraft.incident_type,
        issue_description: createDraft.issue_description,
        photos,
      });
      showToast("Caso externo creado", "success");
      setCreateModalOpen(false);
      setCreateDraft({
        provider: "goapp",
        client_name: "",
        area_name: "",
        laboratory_name: "",
        equipment_serial: "",
        alarm_code: "",
        incident_type: "",
        issue_description: "",
        photo_urls: "",
      });
      await loadWorkspace();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo crear el caso externo", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!identityDraft.provider || !identityDraft.client_user_identifier.trim()) {
      showToast("Proveedor y usuario cliente son obligatorios", "warning");
      return;
    }
    setSavingIdentity(true);
    try {
      await upsertExternalProviderIdentity(identityDraft);
      showToast("Asociación externa guardada", "success");
      setIdentityDraft({
        provider: identityDraft.provider,
        client_user_identifier: "",
        provider_user_identifier: "",
        credential_alias: "",
        area_name: "",
        laboratory_name: "",
        equipment_serial: "",
      });
      const identities = await listExternalProviderIdentities({ provider: filters.provider || undefined, limit: 100 });
      setProviderIdentities(Array.isArray(identities) ? identities : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar asociación", "error");
    } finally {
      setSavingIdentity(false);
    }
  };

  return (
    <div className="st-scope space-y-4 p-2 sm:p-4" style={{ background: "var(--st-bg)" }}>
      <ServicioCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
              Workspace ST-01-04: Casos Externos
            </h1>
            <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Integración controlada con Navify, Online Support, REXIS y GoApp.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" icon={FiPlus} onClick={() => setCreateModalOpen(true)}>Nuevo caso</Button>
            <Button variant="secondary" icon={FiShuffle} loading={queueProcessing} onClick={handleProcessQueue}>Procesar cola</Button>
            <Button variant="secondary" icon={FiRefreshCw} loading={loading} onClick={loadWorkspace}>Recargar</Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
            Proveedor
            <select value={filters.provider} onChange={(event) => setFilters((prev) => ({ ...prev, provider: event.target.value }))} className={inputClass} style={inputStyle}>
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
            Estado interno
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} className={inputClass} style={inputStyle}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
            Buscar
            <input
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Código, cliente, serial o referencia externa"
              className={inputClass}
              style={inputStyle}
            />
          </label>
        </div>
      </ServicioCard>

      <ExternalIntegrationHealthPanel providers={providerHealth} loading={loading} onRefresh={loadWorkspace} />

      <ServicioCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Asociaciones Cliente-Proveedor</h2>
            <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Vincula usuarios autorizados por proveedor con área, laboratorio y equipo.</p>
          </div>
          <Button size="sm" variant="secondary" loading={savingIdentity} onClick={handleSaveIdentity}>Guardar asociación</Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <select value={identityDraft.provider} onChange={(event) => setIdentityDraft((prev) => ({ ...prev, provider: event.target.value }))} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-sm" style={inputStyle}>
            {PROVIDER_OPTIONS.filter((item) => item.value).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input value={identityDraft.client_user_identifier} onChange={(event) => setIdentityDraft((prev) => ({ ...prev, client_user_identifier: event.target.value }))} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-sm" style={inputStyle} placeholder="Usuario cliente *" />
          <input value={identityDraft.provider_user_identifier} onChange={(event) => setIdentityDraft((prev) => ({ ...prev, provider_user_identifier: event.target.value }))} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-sm" style={inputStyle} placeholder="Usuario en proveedor" />
          <input value={identityDraft.credential_alias} onChange={(event) => setIdentityDraft((prev) => ({ ...prev, credential_alias: event.target.value }))} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-sm" style={inputStyle} placeholder="Alias credencial" />
          <input value={identityDraft.area_name} onChange={(event) => setIdentityDraft((prev) => ({ ...prev, area_name: event.target.value }))} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-sm" style={inputStyle} placeholder="Área" />
          <input value={identityDraft.laboratory_name} onChange={(event) => setIdentityDraft((prev) => ({ ...prev, laboratory_name: event.target.value }))} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-sm" style={inputStyle} placeholder="Laboratorio" />
          <input value={identityDraft.equipment_serial} onChange={(event) => setIdentityDraft((prev) => ({ ...prev, equipment_serial: event.target.value }))} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-sm" style={inputStyle} placeholder="Serie equipo" />
        </div>

        <div className="mt-3 space-y-2">
          {providerIdentities.length === 0 ? (
            <ServicioEmptyState title="No hay asociaciones registradas para los filtros actuales." />
          ) : (
            providerIdentities.slice(0, 10).map((identity) => (
              <div key={identity.id} className="rounded-[var(--st-radius-md)] border px-3 py-2 text-xs" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)", color: "var(--st-text-muted)" }}>
                <span className="font-semibold" style={{ color: "var(--st-text)" }}>{toStatusLabel(identity.provider)}</span>
                {" · "}
                {identity.client_user_identifier}
                {identity.provider_user_identifier ? ` → ${identity.provider_user_identifier}` : ""}
                {identity.area_name ? ` · Área: ${identity.area_name}` : ""}
                {identity.laboratory_name ? ` · Lab: ${identity.laboratory_name}` : ""}
                {identity.equipment_serial ? ` · Serie: ${identity.equipment_serial}` : ""}
              </div>
            ))
          )}
        </div>
      </ServicioCard>

      {/* HUD sin cajas -- mismo lenguaje que DispatchStrip del Dashboard, en
          vez de 6 ServicioMetric identicas repitiendo el patron "numero
          grande + label" que DESIGN.md §13 evita para tiras largas de KPIs. */}
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3 border-y py-3" style={{ borderColor: "var(--st-border)" }}>
        {[
          { label: "Total", value: kpi.total || 0 },
          { label: "Validación pendiente", value: kpi.pending_validation || 0 },
          { label: "En progreso", value: kpi.in_progress || 0 },
          { label: "Errores sync", value: kpi.sync_errors || 0, emphasis: (kpi.sync_errors || 0) > 0 },
          { label: "Desalineados", value: kpi.drift_cases || 0, emphasis: (kpi.drift_cases || 0) > 0 },
          { label: "Completados", value: kpi.completed || 0 },
        ].map((item, index) => (
          <div key={item.label} className="flex items-baseline gap-2 pl-8 first:pl-0" style={index > 0 ? { borderLeft: "1px solid var(--st-border)" } : undefined}>
            <span className="font-mono-data text-2xl font-semibold tabular-nums leading-none" style={{ color: item.emphasis ? "var(--st-danger)" : "var(--st-text)" }}>{item.value}</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--st-text-faint)" }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
          Cola de decisión
        </h2>
        <label className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          <input type="checkbox" checked={actionableOnly} onChange={(event) => setActionableOnly(event.target.checked)} />
          Solo accionables (validación pendiente, error de sync, bloqueados)
        </label>
      </div>

      <div className="space-y-3">
        {loading ? (
          <ServicioCard className="p-4 text-sm" style={{ color: "var(--st-text-muted)" }}>Cargando casos externos...</ServicioCard>
        ) : sortedRows.length === 0 ? (
          <ServicioEmptyState
            title="No hay casos externos con los filtros seleccionados."
            description={actionableOnly ? "Desmarca \"Solo accionables\" para ver también los casos resueltos." : undefined}
          />
        ) : (
          sortedRows.map((row) => (
            <ServicioCard key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        row.urgency === "urgent"
                          ? "var(--st-danger)"
                          : row.urgency === "normal"
                          ? "var(--st-warning)"
                          : "var(--st-text-faint)",
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--st-text-faint)" }}>
                      <span className="font-mono-data">{row.code || `EXT-${row.id}`}</span> · {toStatusLabel(row.provider)}
                    </p>
                    <h3 className="text-base font-semibold" style={{ color: "var(--st-text)" }}>{row.client_name || "Cliente no informado"}</h3>
                    <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>Área: {row.area_name || "N/D"} · Equipo/serie: {row.equipment_serial || "N/D"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ServicioBadge tone={toneByStatus(row.internal_status)}>Interno: {toStatusLabel(row.internal_status)}</ServicioBadge>
                  <ServicioBadge tone="neutral">Externo: {toStatusLabel(row.external_status || "sin_estado")}</ServicioBadge>
                </div>
              </div>

              <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>{row.issue_description || "Sin descripción"}</p>

              <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-4" style={{ color: "var(--st-text-faint)" }}>
                <p><span className="font-semibold" style={{ color: "var(--st-text-muted)" }}>Último sync:</span> {formatDateTimeEs(row.last_sync_at)}</p>
                <p><span className="font-semibold" style={{ color: "var(--st-text-muted)" }}>Ref. externa:</span> {row.provider_case_reference || "N/D"}</p>
                <p><span className="font-semibold" style={{ color: "var(--st-text-muted)" }}>Intentos:</span> {row.sync_attempts || 0}</p>
                <p><span className="font-semibold" style={{ color: "var(--st-text-muted)" }}>Próximo reintento:</span> {formatDateTimeEs(row.next_sync_retry_at)}</p>
              </div>

              {row.sync_last_error ? (
                <p className="mt-2 rounded-[var(--st-radius-md)] border px-3 py-2 text-xs" style={{ borderColor: "var(--st-danger)", background: "var(--st-danger-soft)", color: "var(--st-danger)" }}>
                  Error sync: {row.sync_last_error}
                </p>
              ) : null}

              {row.state_drift ? (
                <p className="mt-2 rounded-[var(--st-radius-md)] border px-3 py-2 text-xs" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)", color: "var(--st-warning)" }}>
                  Caso desalineado: {row?.state_drift_detail?.reason || "revisar reconciliación"}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" icon={FiRepeat} loading={busyCaseId === row.id} onClick={() => handleRetry(row.id)}>Reintentar sync</Button>
                <Button size="sm" variant="outline" icon={FiActivity} loading={busyCaseId === row.id} onClick={() => handleReconcile(row.id)}>Reconciliar</Button>
                <Button size="sm" variant="outline" icon={FiClock} loading={busyCaseId === row.id} onClick={() => toggleEvents(row.id)}>
                  {eventsByCase[row.id] ? "Ocultar eventos" : "Ver eventos"}
                </Button>
                <Button size="sm" variant="success" loading={busyCaseId === row.id} onClick={() => setCeacDecisionTarget({ caseId: row.id, decision: "resolve_first_level" })}>CEAC resuelve 1er nivel</Button>
                <Button size="sm" variant="warning" loading={busyCaseId === row.id} onClick={() => setCeacDecisionTarget({ caseId: row.id, decision: "escalate_field_visit" })}>Escalar a visita</Button>
              </div>

              {ceacDecisionTarget?.caseId === row.id ? (
                <div className="mt-3">
                  <CorrectiveActionForm
                    title={ceacDecisionTarget.decision === "resolve_first_level" ? "Detalle de resolución CEAC" : "Motivo de escalamiento a visita"}
                    fields={[{ key: "notes", label: "Detalle (mínimo 6 caracteres)", type: "textarea", required: true, wide: true }]}
                    busy={busyCaseId === row.id}
                    onCancel={() => setCeacDecisionTarget(null)}
                    onSubmit={submitCeacDecision}
                  />
                </div>
              ) : null}

              {eventsByCase[row.id] ? (
                <div className="mt-3 rounded-[var(--st-radius-md)] border p-3" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
                  {(eventsByCase[row.id] || []).length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Sin eventos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {eventsByCase[row.id].map((event) => (
                        <div key={event.id} className="rounded-[var(--st-radius-md)] border px-3 py-2" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
                          <p className="text-xs font-semibold" style={{ color: "var(--st-text)" }}>{toStatusLabel(event.event_type)} · {formatDateTimeEs(event.created_at)}</p>
                          <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>
                            {event.actor_name || event.actor_email || "Sistema"}
                            {event.old_internal_status || event.new_internal_status
                              ? ` · ${toStatusLabel(event.old_internal_status)} -> ${toStatusLabel(event.new_internal_status)}`
                              : ""}
                          </p>
                          {event.comment ? <p className="mt-1 text-xs" style={{ color: "var(--st-text-muted)" }}>{event.comment}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </ServicioCard>
          ))
        )}
      </div>

      <Modal open={createModalOpen} onClose={() => !creating && setCreateModalOpen(false)} title="Nuevo Caso Externo" maxWidth="max-w-3xl">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
              Proveedor *
              <select value={createDraft.provider} onChange={(event) => setCreateDraft((prev) => ({ ...prev, provider: event.target.value }))} className={inputClass} style={inputStyle}>
                {PROVIDER_OPTIONS.filter((item) => item.value).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
              Cliente
              <input value={createDraft.client_name} onChange={(event) => setCreateDraft((prev) => ({ ...prev, client_name: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
            <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
              Área *
              <input value={createDraft.area_name} onChange={(event) => setCreateDraft((prev) => ({ ...prev, area_name: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
            <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
              Laboratorio
              <input value={createDraft.laboratory_name} onChange={(event) => setCreateDraft((prev) => ({ ...prev, laboratory_name: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
            <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
              Serie de equipo *
              <input value={createDraft.equipment_serial} onChange={(event) => setCreateDraft((prev) => ({ ...prev, equipment_serial: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
            <label className="text-sm" style={{ color: "var(--st-text-muted)" }}>
              Código de alarma *
              <input value={createDraft.alarm_code} onChange={(event) => setCreateDraft((prev) => ({ ...prev, alarm_code: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
            <label className="text-sm md:col-span-2" style={{ color: "var(--st-text-muted)" }}>
              Tipo de incidencia *
              <input value={createDraft.incident_type} onChange={(event) => setCreateDraft((prev) => ({ ...prev, incident_type: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
            <label className="text-sm md:col-span-2" style={{ color: "var(--st-text-muted)" }}>
              Descripción del problema *
              <textarea rows={3} value={createDraft.issue_description} onChange={(event) => setCreateDraft((prev) => ({ ...prev, issue_description: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
            <label className="text-sm md:col-span-2" style={{ color: "var(--st-text-muted)" }}>
              URLs de fotos (separadas por coma o salto de línea)
              <textarea rows={3} value={createDraft.photo_urls} onChange={(event) => setCreateDraft((prev) => ({ ...prev, photo_urls: event.target.value }))} className={inputClass} style={inputStyle} />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)} disabled={creating}>Cancelar</Button>
            <Button variant="primary" icon={FiPlus} loading={creating} onClick={handleCreateCase}>Crear caso</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExternalCasesWorkspace;
