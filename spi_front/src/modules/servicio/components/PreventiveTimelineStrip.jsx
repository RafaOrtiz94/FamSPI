import React, { useMemo } from "react";

const rateColor = (rate) => {
  const value = Number(rate) || 0;
  if (value >= 90) return "var(--st-success)";
  if (value >= 70) return "var(--st-warning)";
  return "var(--st-danger)";
};

const loadColor = (overCapacity) => (overCapacity ? "var(--st-danger)" : "var(--st-accent)");

/**
 * Franja horizontal tipo instrumento (mismo lenguaje que DispatchStrip del
 * Dashboard: numero mono grande, sin cajas ni iconos de colorcito) --
 * reemplaza las 2 tablas de cumplimiento/capacidad que antes vivian como
 * datos tabulares sueltos. El plan anual es, por naturaleza, una linea de
 * tiempo de 12 meses; esta franja lo comunica de un vistazo en vez de
 * obligar a leer 2 tablas fila por fila.
 */
const PreventiveTimelineStrip = ({ complianceMonths = [], capacityMonths = [] }) => {
  const months = useMemo(() => {
    const capacityByMonth = new Map(capacityMonths.map((row) => [row.month, row]));
    return complianceMonths.map((row) => ({
      month: row.month,
      rate: row.rate || 0,
      total: row.effective_total || 0,
      onTime: row.on_time || 0,
      utilization: capacityByMonth.get(row.month)?.utilization_pct || 0,
      overCapacity: Boolean(capacityByMonth.get(row.month)?.over_capacity),
    }));
  }, [complianceMonths, capacityMonths]);

  if (!months.length) {
    return (
      <p className="border-y py-4 text-center text-xs" style={{ borderColor: "var(--st-border)", color: "var(--st-text-faint)" }}>
        Sin datos de cumplimiento/capacidad para este plan.
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex border-y" style={{ borderColor: "var(--st-border)" }}>
        {months.map((m, index) => (
          <div key={m.month} className="flex w-[104px] shrink-0 flex-col gap-1.5 px-3 py-2.5" style={index > 0 ? { borderLeft: "1px solid var(--st-border)" } : undefined}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-faint)" }}>{m.month}</span>

            <span className="font-mono-data text-lg font-semibold leading-none tabular-nums" style={{ color: rateColor(m.rate) }}>{m.rate}%</span>
            <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--st-surface-sunken)" }}>
              <div className="h-1 rounded-full" style={{ width: `${Math.min(100, m.rate)}%`, background: rateColor(m.rate) }} />
            </div>
            <span className="text-[10px]" style={{ color: "var(--st-text-faint)" }}>{m.onTime}/{m.total} cumplido</span>

            <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "var(--st-surface-sunken)" }}>
              <div className="h-1 rounded-full" style={{ width: `${Math.min(100, m.utilization)}%`, background: loadColor(m.overCapacity) }} />
            </div>
            <span className="text-[10px]" style={{ color: m.overCapacity ? "var(--st-danger)" : "var(--st-text-faint)" }}>{m.utilization}% carga</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PreventiveTimelineStrip;
