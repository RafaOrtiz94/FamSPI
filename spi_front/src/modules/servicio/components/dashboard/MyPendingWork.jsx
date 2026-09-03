import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ServicioCard from "../../design/ServicioCard";
import ServicioBadge from "../../design/ServicioBadge";
import ServicioEmptyState from "../../design/ServicioEmptyState";
import { FiInbox } from "react-icons/fi";
import { formatTechnicalDateLabel, scheduleCategoryTone } from "./dashboardViewShared";

const CATEGORY_LABELS = {
  inspection: "Inspección",
  maintenance: "Mantenimiento",
  training: "Capacitación",
  withdrawal: "Retiro",
  corrective: "Correctivo",
  manual: "Otro",
};

/**
 * "Mis pendientes" real (Fase F del plan servicio-tecnico-flujo-solicitudes):
 * antes esta seccion del dashboard tecnico solo mostraba mantenimientos, pese
 * a su nombre generico -- inspeccion, retiro y correctivos quedaban
 * invisibles aunque estuvieran asignados. Ahora lee directo del feed
 * unificado (ya extendido en el backend para incluir retiro/correctivo), asi
 * que cualquier tipo de trabajo asignado aparece aqui con deep-link real.
 */
const MyPendingWork = ({ rows = [] }) => {
  const navigate = useNavigate();

  const byCategory = useMemo(() => {
    const counts = {};
    rows.forEach((row) => {
      const key = row.category || "manual";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [rows]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(a.activity_date || "").localeCompare(String(b.activity_date || ""))),
    [rows],
  );

  return (
    <ServicioCard className="st-scope p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
          Mis pendientes
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byCategory).map(([category, count]) => (
            <ServicioBadge key={category} tone={scheduleCategoryTone(category)}>
              {CATEGORY_LABELS[category] || category}: {count}
            </ServicioBadge>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {sortedRows.length === 0 ? (
          <ServicioEmptyState
            icon={FiInbox}
            title="No tienes pendientes asignados"
            description="Inspecciones, retiros, correctivos, mantenimientos y capacitaciones asignados a ti aparecerán aquí."
          />
        ) : (
          sortedRows.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => item.source_path && navigate(item.source_path)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--st-radius-md)] border px-4 py-3 text-left transition-shadow duration-150 hover:border-[var(--st-fog)] hover:shadow-[var(--st-shadow-raised)] active:scale-[0.99]"
              style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)", transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--st-text)" }}>
                  {item.title}
                </p>
                <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>
                  {formatTechnicalDateLabel(item.activity_date)}
                  {item.status ? ` · ${item.status}` : ""}
                </p>
              </div>
              <ServicioBadge tone={scheduleCategoryTone(item.category)}>{item.source_label}</ServicioBadge>
            </button>
          ))
        )}
      </div>
    </ServicioCard>
  );
};

export default MyPendingWork;
