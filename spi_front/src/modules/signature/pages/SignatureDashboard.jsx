import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiCheck,
  FiClock,
  FiFileText,
  FiInbox,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import {
  listMyCompletedSignatureWorkflows,
  listMyPendingSignatureWorkflows,
  listSignatureWorkflows,
} from "../../../core/api/signatureWorkflowsApi";

const TAB_CONFIG = {
  inbox: {
    label: "Pendientes",
    emptyTitle: "No tienes firmas pendientes",
    emptyMessage: "Cuando un documento quede listo para tu paso de firma aparecerá aquí.",
  },
  created: {
    label: "Creados por mí",
    emptyTitle: "Aún no has iniciado workflows",
    emptyMessage: "Los workflows que inicies desde actas o documentos aparecerán en esta bandeja.",
  },
  completed: {
    label: "Completados",
    emptyTitle: "No hay workflows completados",
    emptyMessage: "Aquí verás los documentos que ya cerraron su cadena de firma.",
  },
  all: {
    label: "Todos",
    emptyTitle: "No hay workflows visibles",
    emptyMessage: "No se encontraron workflows con los filtros actuales.",
  },
};

const TAB_ROUTES = [
  { id: "inbox", path: "/dashboard/signatures/inbox", icon: FiInbox },
  { id: "created", path: "/dashboard/signatures/created", icon: FiFileText },
  { id: "completed", path: "/dashboard/signatures/completed", icon: FiCheck },
  { id: "all", path: "/dashboard/signatures/all", icon: FiClock },
];

const STATUS_STYLES = {
  prepared: "bg-slate-100 text-slate-700",
  sent: "bg-blue-50 text-blue-700",
  in_progress: "bg-blue-50 text-blue-700",
  partially_signed: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-200 text-slate-700",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRouteTab(pathname) {
  if (pathname.endsWith("/created")) return "created";
  if (pathname.endsWith("/completed")) return "completed";
  if (pathname.endsWith("/all")) return "all";
  return "inbox";
}

function WorkflowStatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[normalized] || "bg-slate-100 text-slate-700"
      }`}
    >
      {normalized ? normalized.replace(/_/g, " ") : "sin estado"}
    </span>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-full bg-slate-100 p-4 text-slate-400">
        <FiInbox size={24} />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

const SignatureDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useUI();

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingRows, setPendingRows] = useState([]);
  const [completedRows, setCompletedRows] = useState([]);
  const [allRows, setAllRows] = useState([]);

  const activeTab = useMemo(() => getRouteTab(location.pathname), [location.pathname]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, completed, all] = await Promise.all([
        listMyPendingSignatureWorkflows(),
        listMyCompletedSignatureWorkflows(),
        listSignatureWorkflows(),
      ]);
      setPendingRows(Array.isArray(pending) ? pending : []);
      setCompletedRows(Array.isArray(completed) ? completed : []);
      setAllRows(Array.isArray(all) ? all : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar la bandeja de firmas", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createdRows = useMemo(() => {
    const currentUserId = Number(user?.id || 0);
    return allRows.filter((row) => Number(row.created_by || 0) === currentUserId);
  }, [allRows, user?.id]);

  const rowsByTab = useMemo(
    () => ({
      inbox: pendingRows,
      created: createdRows,
      completed: completedRows,
      all: allRows,
    }),
    [allRows, completedRows, createdRows, pendingRows]
  );

  const rawRows = useMemo(() => rowsByTab[activeTab] || [], [activeTab, rowsByTab]);
  const filteredRows = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return rawRows;
    return rawRows.filter((row) =>
      [
        row.workflow_code,
        row.title,
        row.source_module,
        row.source_entity,
        row.status,
        row.document_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [query, rawRows]);

  const stats = useMemo(() => {
    const inProgress = allRows.filter((row) =>
      ["sent", "in_progress", "partially_signed"].includes(String(row.status || "").toLowerCase())
    ).length;
    return {
      pending: pendingRows.length,
      created: createdRows.length,
      completed: completedRows.length,
      inProgress,
    };
  }, [allRows, completedRows, createdRows, pendingRows]);

  const tabMeta = TAB_CONFIG[activeTab] || TAB_CONFIG.inbox;

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">FamSign</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Centro de firmas</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Revisa tus pasos pendientes, sigue workflows creados desde otros módulos y descarga el documento final cuando la cadena se complete.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Actualizar
            </span>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
          {[
            { label: "Pendientes", value: stats.pending, tone: stats.pending > 0 ? "text-blue-700" : "text-slate-900" },
            { label: "En proceso", value: stats.inProgress, tone: "text-slate-900" },
            { label: "Creados por mí", value: stats.created, tone: "text-slate-900" },
            { label: "Completados", value: stats.completed, tone: stats.completed > 0 ? "text-green-700" : "text-slate-900" },
          ].map((item, index) => (
            <div key={item.label} className={`flex-1 min-w-[50%] px-4 py-3 sm:min-w-0 ${index > 1 ? "border-t border-slate-100 sm:border-t-0" : ""}`}>
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TAB_ROUTES.map(({ id, path, icon: Icon }) => {
              const isActive = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(path)}
                  className={`cursor-pointer rounded-2xl px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97] ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon size={14} />
                    {TAB_CONFIG[id].label}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            <FiSearch size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por código, título o módulo"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 lg:w-80"
            />
          </label>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <FiRefreshCw size={20} className="animate-spin text-slate-300" />
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState title={tabMeta.emptyTitle} message={tabMeta.emptyMessage} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <button
                  key={`${activeTab}-${row.id || row.workflow_id}`}
                  type="button"
                  onClick={() => navigate(`/dashboard/signatures/workflows/${row.id || row.workflow_id}`)}
                  className="cursor-pointer flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 active:scale-[0.997] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                        {row.workflow_code || `WF-${row.id}`}
                      </span>
                      <WorkflowStatusBadge status={row.status || row.signer_status} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{row.title || "Sin título"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.source_module || "-"} / {row.source_entity || "-"} / {row.source_entity_id || "-"}
                    </p>
                    {row.document_type ? (
                      <p className="mt-1 text-xs text-slate-400">{row.document_type}</p>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">{formatDate(row.created_at || row.signed_at)}</p>
                    <p className="mt-2 text-sm font-medium text-blue-700">Abrir workflow</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SignatureDashboard;
