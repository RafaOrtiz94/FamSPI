import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiExternalLink, FiRefreshCw, FiSearch } from "react-icons/fi";

import Button from "../../../core/ui/components/Button";
import { useAuth } from "../../../core/auth/AuthContext";
import {
  coordinateInspectionDate,
  getPublicPurchaseTechnicalSchedule,
  listEquipmentPurchases,
} from "../../../core/api/equipmentPurchasesApi";
import { getPrivatePurchasesByRole } from "../../../core/api/privatePurchasesApi";
import { listWorkflowDocumentsSummary } from "../../../core/api/servicioApi";

const TECH_STEP_DEFINITIONS = [
  { code: "F.ST-02", label: "Desinfección", route: "/dashboard/servicio-tecnico/desinfeccion" },
  { code: "F.ST-04", label: "Entrenamiento", route: "/dashboard/servicio-tecnico/aplicaciones" },
  { code: "F.ST-05", label: "Asistencia", route: "/dashboard/servicio-tecnico/asistencia" },
  { code: "F.ST-09", label: "Verificación", route: "/dashboard/servicio-tecnico/verificacion" },
];

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "needs_coordination", label: "Pendiente coordinación" },
  { value: "missing_request", label: "Sin solicitud técnica" },
  { value: "in_progress", label: "En ejecución ST" },
  { value: "completed", label: "Completado ST" },
];

const RELEVANT_PUBLIC_STATUSES = new Set([
  "pending_contract",
  "contract_available",
  "delivery_dates_requested",
  "delivery_dates_submitted",
  "waiting_dispatch",
  "dispatch_ready",
]);

const RELEVANT_PRIVATE_STATUSES = new Set([
  "inspection_requested",
  "contract_available",
  "delivery_dates_requested",
  "delivery_dates_submitted",
  "waiting_dispatch",
  "dispatch_ready",
  "delivery_act_draft_ready",
  "delivery_act_tech_assigned",
  "delivery_act_logistics_signed",
  "delivery_act_generated",
]);

const normalizeRoleList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || "").toLowerCase()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const getPrivateRoleParam = (user) => {
  const roles = Array.from(new Set([...normalizeRoleList(user?.role), ...normalizeRoleList(user?.scope)]));
  const isTechnical = roles.some(
    (role) => role.includes("tecnico") || role.includes("jefe_tecnico") || role.includes("jefe_servicio_tecnico"),
  );
  if (!isTechnical) return null;
  const isChief = roles.some((role) => role.includes("jefe_tecnico") || role.includes("jefe_servicio_tecnico"));
  return isChief ? "jefe_tecnico" : "tecnico";
};

const isChiefTechnicalUser = (user) => {
  const roles = Array.from(new Set([...normalizeRoleList(user?.role), ...normalizeRoleList(user?.scope)]));
  return roles.some((role) => role.includes("jefe_tecnico") || role.includes("jefe_servicio_tecnico"));
};

const statusLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toWorkflowKey = (item) => `${item.sourceType}:${item.sourceId}`;

const getSummaryByKey = (summariesByKey, item) =>
  summariesByKey[toWorkflowKey(item)] || { document_codes: [], total_documents: 0, last_document_at: null };

const getDoneCount = (summary) => {
  const codes = new Set((summary?.document_codes || []).map((code) => String(code || "").toUpperCase()));
  return TECH_STEP_DEFINITIONS.filter((step) => codes.has(step.code)).length;
};

const getNextPendingStep = (summary) => {
  const codes = new Set((summary?.document_codes || []).map((code) => String(code || "").toUpperCase()));
  return TECH_STEP_DEFINITIONS.find((step) => !codes.has(step.code)) || null;
};

const getUrgencyRank = (item, summary) => {
  if (!item.requestId) return 5;
  if (item.inspectionCoordinationStatus === "pending_review") return 1;
  if (!item.inspectionScheduledDate) return 2;
  const doneCount = getDoneCount(summary);
  if (doneCount === 0) return 3;
  if (doneCount < TECH_STEP_DEFINITIONS.length) return 4;
  return 6;
};

const TechnicalProcedureWorkspace = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const initialTab = searchParams.get("tab") === "private" ? "private" : "public";
  const initialSearch = String(searchParams.get("q") || "").trim();
  const initialStatusFilter = STATUS_FILTERS.some((item) => item.value === searchParams.get("status"))
    ? searchParams.get("status")
    : "all";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publicItems, setPublicItems] = useState([]);
  const [privateItems, setPrivateItems] = useState([]);
  const [workflowSummariesByKey, setWorkflowSummariesByKey] = useState({});
  const [coordDrafts, setCoordDrafts] = useState({});
  const [coordinatingId, setCoordinatingId] = useState("");
  const [publicScheduleDays, setPublicScheduleDays] = useState([]);
  const isChiefTechnical = useMemo(() => isChiefTechnicalUser(user), [user]);

  const syncQueryParams = useCallback(
    ({ tab = activeTab, q = search, status = statusFilter } = {}) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        if (String(q || "").trim()) next.set("q", String(q || "").trim());
        else next.delete("q");
        if (status && status !== "all") next.set("status", status);
        else next.delete("status");
        return next;
      });
    },
    [activeTab, search, setSearchParams, statusFilter],
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const qParam = String(searchParams.get("q") || "").trim();
    const statusParam = searchParams.get("status");
    if (tabParam === "public" || tabParam === "private") setActiveTab(tabParam);
    setSearch(qParam);
    setStatusFilter(STATUS_FILTERS.some((item) => item.value === statusParam) ? statusParam : "all");
  }, [searchParams]);

  const fetchWorkflowSummaries = useCallback(async (sourceType, items) => {
    const ids = (items || []).map((item) => item.sourceId).filter(Boolean);
    if (!ids.length) return [];
    return listWorkflowDocumentsSummary({
      source_type: sourceType,
      source_ids: ids,
    });
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const privateRole = getPrivateRoleParam(user);
      const [publicRows, privateRows] = await Promise.all([
        listEquipmentPurchases(),
        privateRole ? getPrivatePurchasesByRole(privateRole) : Promise.resolve([]),
      ]);

      const normalizedPublic = (Array.isArray(publicRows) ? publicRows : [])
        .filter((row) => row?.inspection_request_id || RELEVANT_PUBLIC_STATUSES.has(row?.status))
        .map((row) => ({
          sourceType: "public_purchase",
          sourceId: String(row.id),
          requestId: row.inspection_request_id || null,
          purchaseId: row.id,
          flowType: "public",
          clientName: row.client_name || "Cliente",
          status: row.status || "",
          inspectionMinDate: row.inspection_min_date || null,
          inspectionMaxDate: row.inspection_max_date || null,
          inspectionScheduledDate: row.inspection_scheduled_date || null,
          inspectionCoordinationStatus: row.inspection_coordination_status || null,
          inspectionCoordinationNotes: row.inspection_coordination_notes || null,
        }));

      const normalizedPrivate = (Array.isArray(privateRows) ? privateRows : [])
        .filter((row) => row?.inspection_request_id || RELEVANT_PRIVATE_STATUSES.has(row?.status))
        .map((row) => {
          const snapshot = row.client_snapshot || {};
          return {
            sourceType: "private_purchase",
            sourceId: String(row.id),
            requestId: row.inspection_request_id || null,
            purchaseId: row.id,
            flowType: "private",
            clientName: snapshot.commercial_name || snapshot.client_name || snapshot.name || "Cliente",
            status: row.status || "",
            inspectionScheduledDate: row.inspection_scheduled_date || null,
            inspectionCoordinationStatus: row.inspection_coordination_status || null,
          };
        });

      const [publicSummaries, privateSummaries] = await Promise.all([
        fetchWorkflowSummaries("public_purchase", normalizedPublic),
        fetchWorkflowSummaries("private_purchase", normalizedPrivate),
      ]);

      const nextSummaryMap = {};
      (publicSummaries || []).forEach((row) => {
        nextSummaryMap[`public_purchase:${String(row.source_id)}`] = row;
      });
      (privateSummaries || []).forEach((row) => {
        nextSummaryMap[`private_purchase:${String(row.source_id)}`] = row;
      });

      setPublicItems(normalizedPublic);
      setPrivateItems(normalizedPrivate);
      setWorkflowSummariesByKey(nextSummaryMap);
    } catch (loadError) {
      setError(loadError?.message || "No se pudo cargar el workspace técnico");
    } finally {
      setLoading(false);
    }
  }, [fetchWorkflowSummaries, user]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    let cancelled = false;
    const loadSchedule = async () => {
      try {
        const candidates = publicItems.filter((item) => item.inspectionMinDate && item.inspectionMaxDate);
        if (!candidates.length) {
          if (!cancelled) setPublicScheduleDays([]);
          return;
        }
        const from = candidates.map((item) => item.inspectionMinDate).sort()[0];
        const to = candidates.map((item) => item.inspectionMaxDate).sort().slice(-1)[0];
        const calendar = await getPublicPurchaseTechnicalSchedule({ from, to });
        if (!cancelled) setPublicScheduleDays(Array.isArray(calendar?.days) ? calendar.days : []);
      } catch (_error) {
        if (!cancelled) setPublicScheduleDays([]);
      }
    };
    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [publicItems]);

  const handleCoordinateInspection = useCallback(
    async (item) => {
      const draft = coordDrafts[item.sourceId] || {};
      const inspectionDate = String(draft.inspection_date || "").trim();
      if (!inspectionDate) {
        return;
      }
      setCoordinatingId(item.sourceId);
      setError("");
      try {
        await coordinateInspectionDate(item.sourceId, {
          inspection_date: inspectionDate,
          notes: draft.notes || null,
        });
        await loadWorkspaceData();
      } catch (coordError) {
        setError(coordError?.response?.data?.message || coordError?.message || "No se pudo coordinar la inspección");
      } finally {
        setCoordinatingId("");
      }
    },
    [coordDrafts, loadWorkspaceData],
  );

  const activeItems = useMemo(
    () => (activeTab === "private" ? privateItems : publicItems),
    [activeTab, privateItems, publicItems],
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byText = !term
      ? activeItems
      : activeItems.filter((item) => {
          const haystack =
            `${item.clientName} ${item.status} ${item.purchaseId} ${item.requestId || ""}`.toLowerCase();
          return haystack.includes(term);
        });

    const byStatus = byText.filter((item) => {
      if (statusFilter === "all") return true;
      const summary = getSummaryByKey(workflowSummariesByKey, item);
      const doneCount = getDoneCount(summary);
      if (statusFilter === "needs_coordination") return Boolean(item.requestId) && !item.inspectionScheduledDate;
      if (statusFilter === "missing_request") return !item.requestId;
      if (statusFilter === "in_progress") return doneCount > 0 && doneCount < TECH_STEP_DEFINITIONS.length;
      if (statusFilter === "completed") return doneCount >= TECH_STEP_DEFINITIONS.length;
      return true;
    });

    return byStatus
      .slice()
      .sort((a, b) => {
        const rankA = getUrgencyRank(a, getSummaryByKey(workflowSummariesByKey, a));
        const rankB = getUrgencyRank(b, getSummaryByKey(workflowSummariesByKey, b));
        if (rankA !== rankB) return rankA - rankB;
        return String(a.clientName || "").localeCompare(String(b.clientName || ""), "es");
      });
  }, [activeItems, search, statusFilter, workflowSummariesByKey]);

  const openStep = useCallback(
    (item, step) => {
      const params = new URLSearchParams({
        source_type: item.sourceType,
        source_id: item.sourceId,
      });
      if (item.requestId) params.set("request_id", String(item.requestId));
      navigate(`${step.route}?${params.toString()}`);
    },
    [navigate],
  );

  const openPurchaseWorkspace = useCallback(
    (flowType) => {
      navigate(`/dashboard/purchases/workspace?tab=${flowType === "private" ? "private" : "public"}`);
    },
    [navigate],
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    syncQueryParams({ tab });
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    syncQueryParams({ q: value });
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    syncQueryParams({ status: value });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Workspace Técnico de Procedimiento</h1>
            <p className="text-sm text-slate-600">
              Ejecución unificada ST-01-01 para compras públicas y privadas.
            </p>
          </div>
          <Button variant="secondary" icon={FiRefreshCw} onClick={loadWorkspaceData} loading={loading}>
            Actualizar
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[auto_auto_auto_1fr_auto] md:items-center">
          <div className="inline-flex rounded-lg border border-slate-200 p-1">
            <button
              type="button"
              onClick={() => handleTabChange("public")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === "public" ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              Compras públicas
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("private")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === "private" ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              Compras privadas
            </button>
          </div>

          <div className="text-sm text-slate-600">
            Procesos: <span className="font-semibold text-slate-900">{activeItems.length}</span>
          </div>

          <select
            value={statusFilter}
            onChange={(event) => handleStatusFilterChange(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Buscar por cliente, estado o ID"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <Button
            variant="outline"
            icon={FiExternalLink}
            onClick={() => openPurchaseWorkspace(activeTab)}
          >
            Ver workspace de compras
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          No hay procesos técnicos para mostrar con los filtros actuales.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredItems.map((item) => {
            const key = toWorkflowKey(item);
            const summary = getSummaryByKey(workflowSummariesByKey, item);
            const docCodes = new Set((summary.document_codes || []).map((code) => String(code || "").toUpperCase()));
            const doneCount = getDoneCount(summary);
            const progressPercent = Math.round((doneCount / TECH_STEP_DEFINITIONS.length) * 100);
            const nextStep = getNextPendingStep(summary);

            const draft = coordDrafts[item.sourceId] || {};
            const selectedInspectionDate = draft.inspection_date || "";
            const selectedDaySchedule = publicScheduleDays.find((day) => day.date === selectedInspectionDate);
            const selectedDateIsFull = Boolean(
              selectedDaySchedule && Array.isArray(selectedDaySchedule.items) && selectedDaySchedule.items.length >= 3,
            );
            const canCoordinateHere = Boolean(
              isChiefTechnical &&
                item.flowType === "public" &&
                item.requestId &&
                !item.inspectionScheduledDate &&
                item.inspectionMinDate &&
                item.inspectionMaxDate,
            );

            return (
              <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {item.flowType === "public" ? "Compra pública" : "Compra privada"} #{item.purchaseId}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">{item.clientName}</h3>
                    <p className="text-xs text-slate-600">
                      Estado: {statusLabel(item.status)}
                      {item.inspectionScheduledDate ? ` · Inspección: ${item.inspectionScheduledDate}` : ""}
                    </p>
                    {!item.inspectionScheduledDate && item.inspectionMinDate && item.inspectionMaxDate && (
                      <p className="text-xs text-slate-600">
                        Ventana comercial: {item.inspectionMinDate} - {item.inspectionMaxDate}
                      </p>
                    )}
                    {item.requestId ? (
                      <p className="text-xs text-slate-500">Solicitud técnica #{item.requestId}</p>
                    ) : (
                      <p className="text-xs text-amber-700">Sin solicitud técnica asociada aún</p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {doneCount}/{TECH_STEP_DEFINITIONS.length} pasos ST
                  </span>
                </div>

                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-slate-800 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {canCoordinateHere && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="text-xs font-medium text-slate-700">Coordinación de fecha (Jefe Técnico)</p>
                    <input
                      type="date"
                      value={selectedInspectionDate}
                      min={item.inspectionMinDate || undefined}
                      max={item.inspectionMaxDate || undefined}
                      onChange={(event) =>
                        setCoordDrafts((prev) => ({
                          ...prev,
                          [item.sourceId]: {
                            ...prev[item.sourceId],
                            inspection_date: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <textarea
                      rows={2}
                      value={draft.notes || ""}
                      onChange={(event) =>
                        setCoordDrafts((prev) => ({
                          ...prev,
                          [item.sourceId]: {
                            ...prev[item.sourceId],
                            notes: event.target.value,
                          },
                        }))
                      }
                      placeholder="Notas de coordinación (opcional)"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleCoordinateInspection(item)}
                      loading={coordinatingId === item.sourceId}
                      disabled={!selectedInspectionDate || selectedDateIsFull}
                    >
                      Coordinar fecha exacta
                    </Button>
                    {selectedDateIsFull && (
                      <p className="text-xs text-amber-700">
                        El cronograma técnico está lleno para esa fecha.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {TECH_STEP_DEFINITIONS.map((step) => {
                    const done = docCodes.has(step.code);
                    return (
                      <div
                        key={`${key}-${step.code}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="text-sm">
                          <span className={done ? "font-medium text-emerald-700" : "text-slate-700"}>
                            {step.code} · {step.label}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={done ? "secondary" : "primary"}
                          disabled={!item.requestId}
                          onClick={() => openStep(item, step)}
                        >
                          {done ? "Ver" : "Ejecutar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!item.requestId || !nextStep}
                    onClick={() => nextStep && openStep(item, nextStep)}
                  >
                    {nextStep ? `Continuar: ${nextStep.code}` : "Flujo ST completo"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openPurchaseWorkspace(item.flowType)}>
                    Ver flujo completo
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TechnicalProcedureWorkspace;
