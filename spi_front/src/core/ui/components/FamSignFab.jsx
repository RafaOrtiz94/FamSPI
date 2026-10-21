import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiClock, FiEdit3, FiExternalLink, FiLoader, FiRefreshCw, FiX } from "react-icons/fi";
import { listMyPendingSignatureWorkflows } from "../../api/signatureWorkflowsApi";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

const FamSignFab = forwardRef(function FamSignFab({ onCountChange } = {}, ref) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRows, setPendingRows] = useState([]);

  const pendingCount = pendingRows.length;
  const previewRows = useMemo(() => pendingRows.slice(0, 5), [pendingRows]);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }));

  useEffect(() => {
    onCountChange?.(pendingCount);
  }, [pendingCount, onCountChange]);

  const loadPending = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const rows = await listMyPendingSignatureWorkflows();
      setPendingRows(normalizeRows(rows));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || "No se pudieron cargar las firmas pendientes.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    const handleFocus = () => {
      loadPending({ silent: true });
    };

    // 10 min: > timeout de autosuspend de Neon (~5min) para que el compute
    // pueda dormir de verdad entre polls si nadie interactua. Hay refresh
    // inmediato al recuperar foco (handleFocus), asi que la frescura real no
    // depende de este intervalo.
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      loadPending({ silent: true });
    }, 10 * 60000);

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadPending]);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsideClick = (event) => {
      const node = containerRef.current;
      if (!node || node.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [open]);

  const openInbox = () => {
    setOpen(false);
    navigate("/dashboard/signatures/inbox");
  };

  const openWorkflow = (workflowId) => {
    if (!workflowId) return;
    setOpen(false);
    navigate(`/dashboard/signatures/workflows/${workflowId}`);
  };

  return (
    <div ref={containerRef} className="fixed bottom-36 left-3 z-[9997] sm:bottom-20 sm:left-4">
      {/* Trigger button: only visible on desktop; mobile uses MobileFabDock */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_15px_35px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        title="Firmas pendientes"
        aria-label="Firmas pendientes"
      >
        <FiEdit3 size={20} />
        {pendingCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[1.35rem] rounded-full border-2 border-white bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed left-3 right-3 bottom-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.1)] sm:absolute sm:left-0 sm:right-auto sm:bottom-[3.75rem] sm:w-[min(24rem,calc(100vw-1.5rem))]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">FamSign</p>
              <p className="mt-1 text-xs text-slate-500">Documentos pendientes de tu firma en todo el sistema.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar panel de firmas"
            >
              <FiX size={16} />
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                <FiLoader className="animate-spin" size={16} />
                Cargando pendientes...
              </div>
            ) : error ? (
              <div className="space-y-3 px-4 py-5">
                <p className="text-sm font-medium text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => loadPending()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <FiRefreshCw size={14} />
                  Reintentar
                </button>
              </div>
            ) : pendingCount === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <FiClock size={20} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">No tienes firmas pendientes</p>
                <p className="mt-1 text-sm text-slate-500">Cuando un workflow llegue a tu paso aparecerá aquí.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {previewRows.map((row) => {
                  const workflowId = row.id || row.workflow_id;
                  return (
                    <button
                      key={`famsign-fab-${workflowId}`}
                      type="button"
                      onClick={() => openWorkflow(workflowId)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            Pendiente
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-700">
                            {row.workflow_code || `WF-${workflowId}`}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-slate-900">{row.title || "Documento sin título"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.source_module || "Módulo"} / {row.source_entity || "Documento"} / {row.source_entity_id || "-"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-slate-400">{formatDate(row.created_at || row.available_at)}</p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                          Abrir
                          <FiExternalLink size={12} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">
              {pendingCount > 0 ? `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"} de firma` : "Sin pendientes"}
            </p>
            <button
              type="button"
              onClick={openInbox}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Ver bandeja
              <FiExternalLink size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default FamSignFab;
