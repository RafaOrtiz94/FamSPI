import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiActivity, FiClock, FiPlus, FiRefreshCw, FiRepeat, FiShuffle } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import ExternalIntegrationHealthPanel from "../components/ExternalIntegrationHealthPanel";
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
import { formatDateTimeEs, getStatusBadgeClass, toStatusLabel } from "../../../core/utils/workflowUi";

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

const badgeClassByStatus = (status) => {
  return getStatusBadgeClass(status, {
    success: ["closed", "finalized"],
    warning: ["dispatched", "work_in_progress", "follow_up_pending"],
    error: ["sync_error", "blocked", "pending_validation"],
  });
};

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
  const [filters, setFilters] = useState({
    provider: "",
    status: "",
    q: "",
  });
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
        getExternalCasesWorkspaceKpi({
          provider: filters.provider || undefined,
        }),
        getExternalProvidersHealth(),
        listExternalProviderIdentities({
          provider: filters.provider || undefined,
          limit: 100,
        }),
      ]);
      setRows(Array.isArray(cases) ? cases : []);
      setKpi(kpiData || {});
      setProviderHealth(Array.isArray(health) ? health : []);
      setProviderIdentities(Array.isArray(identities) ? identities : []);
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo cargar el workspace de casos externos",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [filters.provider, filters.q, filters.status, showToast]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.sync_last_error && !b.sync_last_error) return -1;
        if (!a.sync_last_error && b.sync_last_error) return 1;
        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      }),
    [rows],
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
      await retryExternalCaseSync(caseId, {
        reason: "Reintento manual desde workspace",
      });
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
      await reconcileExternalCaseState(caseId, {
        comment: "Reconciliación manual desde workspace",
      });
      showToast("Reconciliación actualizada", "success");
      await loadWorkspace();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo reconciliar", "error");
    } finally {
      setBusyCaseId(null);
    }
  };

  const handleCeacDecision = async (caseId, decision) => {
    const notes = window.prompt(
      decision === "resolve_first_level"
        ? "Detalle de resolución CEAC (obligatorio)"
        : "Motivo de escalamiento a visita (obligatorio)",
    ) || "";
    if (notes.trim().length < 6) {
      showToast("Debes registrar un motivo detallado", "warning");
      return;
    }
    setBusyCaseId(caseId);
    try {
      await postExternalCaseCeacDecision(caseId, { decision, notes });
      showToast("Decisión CEAC registrada", "success");
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
      showToast(
        `Cola procesada · reclamados: ${summary?.claimed || 0}, completados: ${summary?.completed || 0}`,
        "success",
      );
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
      const identities = await listExternalProviderIdentities({
        provider: filters.provider || undefined,
        limit: 100,
      });
      setProviderIdentities(Array.isArray(identities) ? identities : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar asociación", "error");
    } finally {
      setSavingIdentity(false);
    }
  };

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Workspace ST-01-04: Casos Externos
            </h1>
            <p className="text-sm text-slate-600">
              Integración controlada con Navify, Online Support, REXIS y GoApp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" icon={FiPlus} onClick={() => setCreateModalOpen(true)}>
              Nuevo caso
            </Button>
            <Button
              variant="secondary"
              icon={FiShuffle}
              loading={queueProcessing}
              onClick={handleProcessQueue}
            >
              Procesar cola
            </Button>
            <Button variant="secondary" icon={FiRefreshCw} loading={loading} onClick={loadWorkspace}>
              Recargar
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-700">
            Proveedor
            <select
              value={filters.provider}
              onChange={(event) => setFilters((prev) => ({ ...prev, provider: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Estado interno
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Buscar
            <input
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Código, cliente, serial o referencia externa"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <ExternalIntegrationHealthPanel
        providers={providerHealth}
        loading={loading}
        onRefresh={loadWorkspace}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Asociaciones Cliente-Proveedor</h2>
            <p className="text-xs text-slate-500">
              Vincula usuarios autorizados por proveedor con área, laboratorio y equipo.
            </p>
          </div>
          <Button size="sm" variant="secondary" loading={savingIdentity} onClick={handleSaveIdentity}>
            Guardar asociación
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <select
            value={identityDraft.provider}
            onChange={(event) => setIdentityDraft((prev) => ({ ...prev, provider: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {PROVIDER_OPTIONS.filter((item) => item.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={identityDraft.client_user_identifier}
            onChange={(event) => setIdentityDraft((prev) => ({ ...prev, client_user_identifier: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Usuario cliente *"
          />
          <input
            value={identityDraft.provider_user_identifier}
            onChange={(event) => setIdentityDraft((prev) => ({ ...prev, provider_user_identifier: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Usuario en proveedor"
          />
          <input
            value={identityDraft.credential_alias}
            onChange={(event) => setIdentityDraft((prev) => ({ ...prev, credential_alias: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Alias credencial"
          />
          <input
            value={identityDraft.area_name}
            onChange={(event) => setIdentityDraft((prev) => ({ ...prev, area_name: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Área"
          />
          <input
            value={identityDraft.laboratory_name}
            onChange={(event) => setIdentityDraft((prev) => ({ ...prev, laboratory_name: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Laboratorio"
          />
          <input
            value={identityDraft.equipment_serial}
            onChange={(event) => setIdentityDraft((prev) => ({ ...prev, equipment_serial: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Serie equipo"
          />
        </div>

        <div className="mt-3 space-y-2">
          {providerIdentities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              No hay asociaciones registradas para los filtros actuales.
            </p>
          ) : (
            providerIdentities.slice(0, 10).map((identity) => (
              <div key={identity.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{toStatusLabel(identity.provider)}</span>
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
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase text-slate-500">Total</p>
          <p className="text-xl font-bold text-slate-900">{kpi.total || 0}</p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs uppercase text-amber-700">Validación pendiente</p>
          <p className="text-xl font-bold text-amber-900">{kpi.pending_validation || 0}</p>
        </article>
        <article className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs uppercase text-blue-700">En progreso</p>
          <p className="text-xl font-bold text-blue-900">{kpi.in_progress || 0}</p>
        </article>
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs uppercase text-rose-700">Errores sync</p>
          <p className="text-xl font-bold text-rose-900">{kpi.sync_errors || 0}</p>
        </article>
        <article className="rounded-xl border border-purple-200 bg-purple-50 p-3">
          <p className="text-xs uppercase text-purple-700">Desalineados</p>
          <p className="text-xl font-bold text-purple-900">{kpi.drift_cases || 0}</p>
        </article>
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs uppercase text-emerald-700">Completados</p>
          <p className="text-xl font-bold text-emerald-900">{kpi.completed || 0}</p>
        </article>
      </section>

      <section className="space-y-3">
        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Cargando casos externos...
          </p>
        ) : sortedRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No hay casos externos con los filtros seleccionados.
          </p>
        ) : (
          sortedRows.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {row.code || `EXT-${row.id}`} · {toStatusLabel(row.provider)}
                  </p>
                  <h3 className="text-base font-semibold text-slate-900">
                    {row.client_name || "Cliente no informado"}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Área: {row.area_name || "N/D"} · Equipo/serie: {row.equipment_serial || "N/D"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClassByStatus(row.internal_status)}`}>
                    Interno: {toStatusLabel(row.internal_status)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    Externo: {toStatusLabel(row.external_status || "sin_estado")}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-700">
                {row.issue_description || "Sin descripción"}
              </p>

              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                <p><span className="font-semibold">Último sync:</span> {formatDateTimeEs(row.last_sync_at)}</p>
                <p><span className="font-semibold">Ref. externa:</span> {row.provider_case_reference || "N/D"}</p>
                <p><span className="font-semibold">Intentos:</span> {row.sync_attempts || 0}</p>
                <p><span className="font-semibold">Próximo reintento:</span> {formatDateTimeEs(row.next_sync_retry_at)}</p>
              </div>

              {row.sync_last_error ? (
                <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  Error sync: {row.sync_last_error}
                </p>
              ) : null}

              {row.state_drift ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Caso desalineado: {row?.state_drift_detail?.reason || "revisar reconciliación"}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={FiRepeat}
                  loading={busyCaseId === row.id}
                  onClick={() => handleRetry(row.id)}
                >
                  Reintentar sync
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={FiActivity}
                  loading={busyCaseId === row.id}
                  onClick={() => handleReconcile(row.id)}
                >
                  Reconciliar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={FiClock}
                  loading={busyCaseId === row.id}
                  onClick={() => toggleEvents(row.id)}
                >
                  {eventsByCase[row.id] ? "Ocultar eventos" : "Ver eventos"}
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  loading={busyCaseId === row.id}
                  onClick={() => handleCeacDecision(row.id, "resolve_first_level")}
                >
                  CEAC resuelve 1er nivel
                </Button>
                <Button
                  size="sm"
                  variant="warning"
                  loading={busyCaseId === row.id}
                  onClick={() => handleCeacDecision(row.id, "escalate_field_visit")}
                >
                  Escalar a visita
                </Button>
              </div>

              {eventsByCase[row.id] ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {(eventsByCase[row.id] || []).length === 0 ? (
                    <p className="text-xs text-slate-500">Sin eventos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {eventsByCase[row.id].map((event) => (
                        <div key={event.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-xs font-semibold text-slate-700">
                            {toStatusLabel(event.event_type)} · {formatDateTimeEs(event.created_at)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {event.actor_name || event.actor_email || "Sistema"}
                            {event.old_internal_status || event.new_internal_status
                              ? ` · ${toStatusLabel(event.old_internal_status)} -> ${toStatusLabel(event.new_internal_status)}`
                              : ""}
                          </p>
                          {event.comment ? <p className="mt-1 text-xs text-slate-700">{event.comment}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      <Modal
        open={createModalOpen}
        onClose={() => !creating && setCreateModalOpen(false)}
        title="Nuevo Caso Externo"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Proveedor *
              <select
                value={createDraft.provider}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, provider: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {PROVIDER_OPTIONS.filter((item) => item.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Cliente
              <input
                value={createDraft.client_name}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, client_name: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Área *
              <input
                value={createDraft.area_name}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, area_name: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Laboratorio
              <input
                value={createDraft.laboratory_name}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, laboratory_name: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Serie de equipo *
              <input
                value={createDraft.equipment_serial}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, equipment_serial: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Código de alarma *
              <input
                value={createDraft.alarm_code}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, alarm_code: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              Tipo de incidencia *
              <input
                value={createDraft.incident_type}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, incident_type: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              Descripción del problema *
              <textarea
                rows={3}
                value={createDraft.issue_description}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, issue_description: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              URLs de fotos (separadas por coma o salto de línea)
              <textarea
                rows={3}
                value={createDraft.photo_urls}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, photo_urls: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button variant="primary" icon={FiPlus} loading={creating} onClick={handleCreateCase}>
              Crear caso
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExternalCasesWorkspace;
