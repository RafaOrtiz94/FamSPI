import React, { useCallback, useEffect, useState } from "react";
import {
  FiAlertTriangle, FiCalendar, FiCheck,
  FiPackage, FiRefreshCw, FiShield,
} from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import { getCollabSummary, listCollabRenewals } from "../../../core/api/collabDeliveriesApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = { ropa: "Ropa de trabajo", epp: "EPP", herramienta: "Herramientas", logistica: "Logística" };
const CATEGORY_COLORS = {
  ropa:        { bg: "bg-white", border: "border-slate-200", text: "text-slate-600", bar: "bg-slate-400" },
  epp:         { bg: "bg-white", border: "border-slate-200", text: "text-orange-700", bar: "bg-orange-400" },
  herramienta: { bg: "bg-white", border: "border-slate-200", text: "text-amber-700", bar: "bg-amber-400" },
  logistica:   { bg: "bg-white", border: "border-slate-200", text: "text-blue-700",  bar: "bg-blue-500"  },
};


// ── Página ────────────────────────────────────────────────────────────────────

const CollabDeliveriesGerenciaPage = () => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [renewals, setRenewals] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, ren] = await Promise.all([
        getCollabSummary(),
        listCollabRenewals({ dueDays: 30 }),
      ]);
      setSummary(sum);
      setRenewals(Array.isArray(ren) ? ren : []);
    } catch {
      showToast("No se pudo cargar el resumen", "error");
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalActivos   = (summary?.by_category || []).reduce((a, r) => a + Number(r.activos || 0), 0);
  const totalRetirados = (summary?.by_category || []).reduce((a, r) => a + Number(r.retirados || 0), 0);
  const actasSinFirma  = Number(summary?.actas?.actas_sin_firma || 0);
  const actasFirmadas  = Number(summary?.actas?.actas_firmadas  || 0);
  const renovVencidas  = Number(summary?.renewals?.vencidas  || 0);
  const renovProximas  = Number(summary?.renewals?.proximas   || 0);
  const pctFirmadas    = actasSinFirma + actasFirmadas > 0
    ? Math.round((actasFirmadas / (actasSinFirma + actasFirmadas)) * 100) : 100;

  return (
    <div className="flex min-w-0 flex-col space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Entregas a Colaboradores</h1>
          <p className="text-xs text-slate-500 mt-0.5">Resumen ejecutivo — vista gerencia</p>
        </div>
        <button type="button" onClick={loadAll} disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {/* KPIs globales */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
          {[
            { label: "Ítems activos",         value: loading ? "—" : totalActivos,   color: "text-slate-800", sub: "entregas vigentes" },
            { label: "Ítems retirados",        value: loading ? "—" : totalRetirados, color: "text-slate-500", sub: "historial total" },
            { label: "Actas sin firma",        value: loading ? "—" : actasSinFirma,  color: actasSinFirma > 0 ? "text-amber-600" : "text-green-600", alert: actasSinFirma > 0 },
            { label: "Renovaciones vencidas",  value: loading ? "—" : renovVencidas,  color: renovVencidas > 0 ? "text-red-600" : "text-green-600",  alert: renovVencidas > 0, sub: `${renovProximas} próximas (30d)` },
          ].map((k, i) => (
            <div key={k.label} className={`flex-1 min-w-[50%] sm:min-w-0 px-5 py-4 ${i > 0 && i % 2 === 0 ? "border-t border-slate-100 sm:border-t-0" : i === 1 ? "border-l border-slate-100 sm:border-l-0" : ""}`}>
              {k.alert && <FiAlertTriangle size={13} className={k.color + " mb-1"} />}
              <p className="text-xs text-slate-400">{k.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              {k.sub && <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Por categoría */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-3">Desglose por categoría</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            [0,1,2].map((i) => <div key={i} className="h-32 rounded-xl border border-slate-100 bg-slate-50 animate-pulse" />)
          ) : (
            ["ropa","epp","herramienta","logistica"].map((cat) => {
              const row = (summary?.by_category || []).find((r) => r.category === cat);
              const colors = CATEGORY_COLORS[cat];
              const activos = Number(row?.activos || 0);
              const total   = activos + Number(row?.retirados || 0) + Number(row?.incidencias || 0);
              const pct     = total > 0 ? Math.round((activos / total) * 100) : 0;
              return (
                <div key={cat} className={`rounded-xl border ${colors.border} ${colors.bg} p-5`}>
                  <p className={`text-sm font-semibold ${colors.text}`}>{CATEGORY_LABELS[cat]}</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{activos}</p>
                  <p className="text-xs text-slate-500 mb-3">activos · {row?.colaboradores_con_items || 0} colaboradores</p>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                    <span>{row?.incidencias || 0} incidencias</span>
                    <span>{row?.retirados || 0} retirados</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Integridad documental */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 mb-4">
          <FiCheck size={15} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">Integridad documental — Actas</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Actas firmadas</span>
              <span className={`font-semibold ${pctFirmadas < 80 ? "text-amber-600" : "text-green-600"}`}>{pctFirmadas}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pctFirmadas < 80 ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${pctFirmadas}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
              <span>{actasFirmadas} firmadas</span>
              <span>{actasSinFirma} pendientes</span>
            </div>
          </div>
          {actasSinFirma > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 shrink-0">
              <FiAlertTriangle size={14} className="text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-amber-700">{actasSinFirma} acta{actasSinFirma > 1 ? "s" : ""} sin firma</p>
                <p className="text-[10px] text-amber-600">Requieren atención de financiero</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Renovaciones próximas */}
      {renewals.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <FiCalendar size={15} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">Renovaciones próximas (30 días)</p>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {renewals.map((r) => {
              const days = Math.ceil((new Date(r.scheduled_date) - new Date()) / 86400000);
              const color = days < 0 ? "bg-red-50 border-red-100" : days <= 7 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100";
              const textColor = days < 0 ? "text-red-700" : days <= 7 ? "text-amber-700" : "text-slate-600";
              return (
                <div key={r.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${color}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.item_name}</p>
                    <p className="text-xs text-slate-500 truncate">{r.collaborator_name}</p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${textColor}`}>
                    {days < 0 ? `Vencida ${Math.abs(days)}d` : days === 0 ? "Hoy" : `${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default CollabDeliveriesGerenciaPage;
