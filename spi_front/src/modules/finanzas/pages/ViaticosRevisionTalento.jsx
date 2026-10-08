import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiRefreshCw, FiCheckCircle, FiAlertTriangle, FiChevronDown,
  FiChevronUp, FiDownload, FiUsers, FiCheck, FiX,
} from "react-icons/fi";
import {
  listViaticosTalentoReview,
  approveViaticoSegment,
  requestViaticoCorrection,
  exportViaticosUserReport,
  getViaticoConfigPolicy,
} from "../../../core/api/viaticosApi";
import { useUI } from "../../../core/ui/UIContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../core/api";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import ViaticosMonthBatchModal from "../components/viaticos/ViaticosMonthBatchModal";
import {
  toMoney, fmtDate, currentMonthKey, monthRange, groupByCollaborator,
  groupByMonth, exportToCsv,
  SURFACE, FOCUS, CONTROL,
  BTN_SECONDARY, BTN_SUCCESS, BTN_WARN,
  Spinner, EmptyState, StatusBadge, WorkflowBadge, AvatarInitials,
  ProcessingBadge, getSegmentByType, getSegmentAmount, segmentNeedsReview, segmentIsLiquidated,
} from "../components/viaticos/viaticosShared";

// ── Month selector ─────────────────────────────────────────────────────────────

function buildMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = d.toISOString().slice(0, 7);
    const [yr, mo] = key.split("-");
    const label = new Date(Number(yr), Number(mo) - 1, 1)
      .toLocaleString("es-EC", { month: "long", year: "numeric" });
    options.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

// ── Collaborator accordion row ─────────────────────────────────────────────────

function CollaboratorRow({ collab, selectedMonth, policy, showToast, showLoader, hideLoader, onRefresh }) {
  const [expanded, setExpanded]             = useState(false);
  const [batchTarget, setBatchTarget]       = useState(null);
  const [actingId, setActingId]             = useState(null);
  const [correctionId, setCorrectionId]     = useState(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionSaving, setCorrectionSaving] = useState(false);

  const monthItems = useMemo(() =>
    collab.items.filter((a) => String(a.visit_date || "").slice(0, 7) === selectedMonth),
    [collab.items, selectedMonth]
  );

  const pendingCount = monthItems.filter((a) =>
    segmentNeedsReview(a, "without_card")
  ).length;

  const monthGroups = useMemo(() => groupByMonth(collab.items), [collab.items]);

  const handleApprove = async (viatico) => {
    setActingId(viatico.id); showLoader("Aprobando...");
    try {
      await approveViaticoSegment(viatico.id);
      showToast("Aprobado por talento", "success");
      onRefresh();
    } catch (err) { showToast(err?.response?.data?.message || "Error aprobando", "error"); }
    finally { setActingId(null); hideLoader(); }
  };

  const handleSendCorrection = async (viatico) => {
    if (!correctionNote.trim()) return;
    setCorrectionSaving(true);
    try {
      await requestViaticoCorrection(viatico.id, correctionNote.trim());
      showToast("Correccion solicitada", "success");
      setCorrectionId(null); setCorrectionNote("");
      onRefresh();
    } catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { setCorrectionSaving(false); }
  };

  return (
    <>
      {batchTarget && (
        <ViaticosMonthBatchModal
          viaticos={batchTarget.viaticos}
          monthLabel={batchTarget.monthLabel}
          collaboratorName={collab.name}
          policy={policy}
          reviewerMode="talento"
          onRequestCorrection={async (vid, obs) => {
            await requestViaticoCorrection(vid, obs);
            onRefresh();
          }}
          onClose={() => setBatchTarget(null)}
          onRefresh={onRefresh}
          showToast={showToast} showLoader={showLoader} hideLoader={hideLoader}
        />
      )}

      <div className="border-b border-slate-100 last:border-0">
        {/* Row header */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={`group flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 active:bg-slate-100 ${FOCUS}`}>
          <AvatarInitials name={collab.name} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{collab.name}</p>
            <div className="mt-0.5 flex gap-3 text-[11px] text-slate-400">
              <span>{monthItems.length} salida{monthItems.length !== 1 ? "s" : ""} en el mes</span>
              <span className="font-mono">{toMoney(monthItems.reduce((s, a) => s + Number(a.amount || 0), 0))}</span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-[#D97706]">
                {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
              </span>
            ) : monthItems.length > 0 ? (
              <span className="text-[11px] font-semibold text-[#16A34A] flex items-center gap-1">
                <FiCheckCircle size={12} /> Completado
              </span>
            ) : null}
            {expanded ? <FiChevronUp size={15} className="text-slate-400" /> : <FiChevronDown size={15} className="text-slate-400" />}
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="bg-slate-50 border-t border-slate-100">
            {/* Inline per-allowance actions */}
            {monthItems.length === 0 ? (
              <p className="px-14 py-4 text-xs text-slate-400">Sin salidas en este mes.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {monthItems.map((v) => {
                  const targetSegment = getSegmentByType(v, "without_card");
                  const segmentAmount = getSegmentAmount(v, "without_card");
                  const needsApprove = segmentNeedsReview(v, "without_card") && String(targetSegment?.workflow_status || "").toLowerCase() !== "aprobado";
                  const isCorrecting = correctionId === v.id;

                  return (
                    <div key={v.id} className="px-5 py-3 ml-9">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${segmentIsLiquidated(v, "without_card") ? "bg-[#16A34A]" : needsApprove ? "bg-[#D97706]" : "bg-[#2563EB]"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500">{fmtDate(v.visit_date)}</span>
                            {v.city && <span className="text-xs text-slate-700">{v.city}</span>}
                            <StatusBadge status={v.status} />
                            <WorkflowBadge status={v.workflow_status} />
                            <ProcessingBadge status={v.processing_state} />
                            {targetSegment && <WorkflowBadge status={targetSegment.workflow_status} />}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                            <span className="font-mono">{toMoney(v.amount)}</span>
                            {segmentAmount > 0 && (
                              <span className="text-amber-600 font-mono">Hijo sin tarjeta: {toMoney(segmentAmount)}</span>
                            )}
                            {Number(v.final_balance_amount || 0) > 0 && (
                              <span className={`font-mono ${v.final_balance_result === "por_devolver" ? "text-[#DC2626]" : "text-[#16A34A]"}`}>
                                Saldo {v.final_balance_result === "por_devolver" ? "a devolver" : "final"}: {toMoney(v.final_balance_amount)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex gap-1.5">
                          {needsApprove && (
                            <button disabled={actingId === v.id} onClick={() => handleApprove(v)}
                              className={`${BTN_SUCCESS} text-xs min-h-8 px-3 rounded-lg`}>
                              {actingId === v.id ? <Spinner size={12} /> : <FiCheckCircle size={12} />} Aprobar
                            </button>
                          )}
                          {!isCorrecting && (
                            <button onClick={() => { setCorrectionId(v.id); setCorrectionNote(""); }}
                              className={`${BTN_WARN} text-xs min-h-8 px-3 rounded-lg`}>
                              <FiAlertTriangle size={11} /> Correccion
                            </button>
                          )}
                        </div>
                      </div>

                      {isCorrecting && (
                        <div className="mt-3 ml-4 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-amber-800">Indicar que debe corregir el declarante</p>
                          <textarea
                            rows={2}
                            value={correctionNote}
                            onChange={(e) => setCorrectionNote(e.target.value)}
                            placeholder="Ej: La nota de venta no corresponde al rango de fechas."
                            className="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <div className="flex gap-2">
                            <button disabled={correctionSaving || !correctionNote.trim()}
                              onClick={() => handleSendCorrection(v)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                              {correctionSaving ? <Spinner size={12} /> : <FiCheck size={12} />} Enviar
                            </button>
                            <button onClick={() => setCorrectionId(null)} className="text-xs text-slate-500 hover:text-slate-700">
                              <FiX size={12} className="inline mr-1" />Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Open full batch modal per month */}
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Expedientes del mes</p>
              <div className="flex flex-wrap gap-2">
                {monthGroups.map((mg) => {
                  const mgPending = mg.items.filter((a) => a.requires_talento_approval && a.talento_approval_status === "pending").length;
                  const mgCerrado = mg.items.every((a) => a.workflow_status === "cerrado");
                  return (
                    <button key={mg.key} type="button"
                      onClick={() => setBatchTarget({ viaticos: mg.items, monthLabel: mg.label })}
                      className={`${BTN_SECONDARY} text-xs min-h-9 px-3 rounded-lg gap-1.5`}>
                      {mg.label}
                      {mgPending > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-[#D97706]">{mgPending}</span>}
                      {mgCerrado && <FiCheckCircle size={11} className="text-[#16A34A]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main: ViaticosRevisionTalento ──────────────────────────────────────────────

const ViaticosRevisionTalento = () => {
  const { showToast, showLoader, hideLoader } = useUI();

  const MONTH_OPTIONS = useMemo(() => buildMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState({ km_rate_per_km: 0.12 });

  const { start, end } = useMemo(() => monthRange(selectedMonth), [selectedMonth]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [data, policyData] = await Promise.all([
        listViaticosTalentoReview({ start_date: start, end_date: end }),
        getViaticoConfigPolicy().catch(() => ({})),
      ]);
      setItems(Array.isArray(data) ? data : []);
      if (policyData && typeof policyData === "object") setPolicy((p) => ({ ...p, ...policyData }));
    } catch { showToast("Error cargando cola de revision", "error"); }
    finally { if (!silent) setLoading(false); }
  }, [start, end, showToast]);

  useEffect(() => { loadData(); }, [loadData]);
  useScopedAutoUpdate(DATA_UPDATE_SCOPES.VIATICOS, () => loadData({ silent: true }));

  const collaborators = useMemo(() => {
    const monthItems = items.filter((a) => String(a.visit_date || "").slice(0, 7) === selectedMonth);
    return groupByCollaborator(monthItems).filter((c) => c.items.length > 0);
  }, [items, selectedMonth]);

  const totalPending = useMemo(() =>
    items.filter((a) =>
      String(a.visit_date || "").slice(0, 7) === selectedMonth &&
      segmentNeedsReview(a, "without_card")
    ).length,
    [items, selectedMonth]
  );

  const handleExport = async () => {
    showLoader("Exportando...");
    try {
      const data = await exportViaticosUserReport({ start_date: start, end_date: end });
      if (!data.length) { showToast("Sin datos para exportar", "warning"); return; }
      exportToCsv(data, `viaticos_talento_${selectedMonth}.csv`);
    } catch { showToast("Error exportando", "error"); }
    finally { hideLoader(); }
  };

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-4`}>

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Viaticos</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1E293B]">Cola de revision — Talento</h1>
          <p className="mt-0.5 text-xs text-slate-400">Gastos en efectivo, notas de venta y compras sin factura pendientes de aprobacion.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className={BTN_SECONDARY}>
            <FiDownload size={13} /> Exportar CSV
          </button>
          <button onClick={() => loadData()} disabled={loading} className={BTN_SECONDARY}>
            {loading ? <Spinner size={13} /> : <FiRefreshCw size={13} />} Recargar
          </button>
        </div>
      </div>

      {/* Month selector + summary strip */}
      <div className={`${SURFACE} px-4 py-3`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mes</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className={`${CONTROL} min-w-[180px] font-mono text-sm`}>
              {MONTH_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 ml-auto text-xs text-slate-500">
            <span>{collaborators.length} colaboradores</span>
            {totalPending > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-[#D97706]">
                {totalPending} pendiente{totalPending !== 1 ? "s" : ""}
              </span>
            )}
            {totalPending === 0 && !loading && items.length > 0 && (
              <span className="flex items-center gap-1 text-[#16A34A] font-semibold">
                <FiCheckCircle size={12} /> Todo al dia
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Collaborator accordion list */}
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center gap-3 text-sm text-slate-400">
          <Spinner /> Cargando cola de revision...
        </div>
      ) : collaborators.length === 0 ? (
        <div className={`${SURFACE} px-6 py-12`}>
          <EmptyState
            title="Sin pendientes en este mes"
            detail="No hay gastos en efectivo pendientes de aprobacion de talento para este periodo."
            icon={FiUsers}
          />
        </div>
      ) : (
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <FiUsers size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-900">
                {collaborators.length} colaborador{collaborators.length !== 1 ? "es" : ""}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Expande para ver salidas e intervenir</span>
          </div>
          <div>
            {collaborators.map((c) => (
              <CollaboratorRow
                key={c.email}
                collab={c}
                selectedMonth={selectedMonth}
                policy={policy}
                showToast={showToast}
                showLoader={showLoader}
                hideLoader={hideLoader}
                onRefresh={() => loadData({ silent: true })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViaticosRevisionTalento;
