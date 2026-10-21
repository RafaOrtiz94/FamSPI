import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX } from "react-icons/fi";
import {
  createTiKpiDefinition,
  getTiKpiMetricCatalog,
  listTiKpiDefinitions,
  updateTiKpiDefinition,
} from "../../../core/api/supportTicketsApi";
import { getUsers } from "../../../core/api/usersApi";
import { useUI } from "../../../core/ui/UIContext";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import { toStatusLabel } from "../../../core/utils/workflowUi";
import Button from "../../../core/ui/components/Button";
import "../design/tokens.css";

const TI_TECHNICIAN_ROLES = new Set([
  "ti", "jefe_ti", "admin_ti", "jefe_de_ti", "tecnico", "ing_servicio", "esp_app",
  "jefe_tecnico", "jefe_servicio", "servicio_tecnico", "jefe_servicio_tecnico",
]);

const PERIOD_OPTIONS = [
  { value: "current_month", label: "Mes actual" },
  { value: "last_7_days", label: "Ultimos 7 dias" },
  { value: "last_30_days", label: "Ultimos 30 dias" },
  { value: "last_n_months", label: "Ultimos N meses" },
  { value: "all_time", label: "Todo el historico" },
];

const fieldStyle = {
  minHeight: "var(--ti-control-height)",
  borderRadius: "var(--ti-radius-control)",
  border: "1px solid var(--ti-border-control)",
  background: "var(--ti-surface)",
  color: "var(--ti-text)",
};

const panelStyle = {
  background: "var(--ti-surface)",
  border: "1px solid var(--ti-border)",
  borderRadius: "var(--ti-radius-panel)",
  padding: "20px",
};

function Field({ label, children, helper }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ti-text-muted)" }}>{label}</span>
      {children}
      {helper ? <span className="text-xs" style={{ color: "var(--ti-text-muted)" }}>{helper}</span> : null}
    </label>
  );
}

const emptyForm = {
  name: "",
  description: "",
  metric_type: "",
  filters: {},
  period_type: "current_month",
  period_months: 3,
  goal_value: "",
  goal_direction: "gte",
  hasGoal: false,
  show_in_workspace: true,
  show_in_reports: true,
  is_active: true,
};

const TicketKpiForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { showToast } = useUI();

  const [catalog, setCatalog] = useState({ metrics: [], filterableFields: [] });
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [catalogData, users] = await Promise.all([
          getTiKpiMetricCatalog(),
          getUsers().catch(() => []),
        ]);
        setCatalog(catalogData || { metrics: [], filterableFields: [] });
        setTechnicians((Array.isArray(users) ? users : []).filter((u) => TI_TECHNICIAN_ROLES.has(String(u.role || "").toLowerCase())));

        if (isEditing) {
          const definitions = await listTiKpiDefinitions();
          const existing = definitions.find((def) => String(def.id) === String(id));
          if (!existing) {
            showToast("KPI no encontrado", "error");
            navigate("/dashboard/ti/workspace/reportes");
            return;
          }
          setForm({
            name: existing.name,
            description: existing.description || "",
            metric_type: existing.metric_type,
            filters: existing.filters || {},
            period_type: existing.period_type,
            period_months: existing.period_months || 3,
            goal_value: existing.goal_value ?? "",
            goal_direction: existing.goal_direction || "gte",
            hasGoal: existing.goal_value !== null && existing.goal_value !== undefined,
            show_in_workspace: existing.show_in_workspace,
            show_in_reports: existing.show_in_reports,
            is_active: existing.is_active,
          });
        }
      } catch (error) {
        showToast(error?.response?.data?.message || "No se pudo cargar el formulario", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selectedMetric = catalog.metrics.find((m) => m.value === form.metric_type);

  const toggleFilterValue = (fieldKey, value) => {
    setForm((prev) => {
      const current = new Set(prev.filters[fieldKey] || []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      const nextFilters = { ...prev.filters };
      if (current.size) nextFilters[fieldKey] = Array.from(current);
      else delete nextFilters[fieldKey];
      return { ...prev, filters: nextFilters };
    });
  };

  const summary = useMemo(() => {
    if (!form.metric_type) return "Selecciona una metrica para ver el resumen.";
    const metricLabel = selectedMetric?.label || form.metric_type;
    const filterParts = Object.entries(form.filters || {}).map(([key, values]) => {
      const field = catalog.filterableFields.find((f) => f.value === key);
      const labels = (values || []).map((v) => {
        if (key === "assigned_ti_user_id") {
          const tech = technicians.find((t) => String(t.id) === String(v));
          return tech?.fullname || tech?.email || v;
        }
        return toStatusLabel(v);
      });
      return `${field?.label || key}: ${labels.join(", ")}`;
    });
    const periodLabel = PERIOD_OPTIONS.find((p) => p.value === form.period_type)?.label || form.period_type;
    return [
      metricLabel,
      filterParts.length ? `filtrado por ${filterParts.join(" · ")}` : "sin filtros adicionales",
      `periodo: ${form.period_type === "last_n_months" ? `ultimos ${form.period_months} meses` : periodLabel.toLowerCase()}`,
    ].join(" — ");
  }, [form, selectedMetric, catalog.filterableFields, technicians]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 3) {
      showToast("El nombre debe tener al menos 3 caracteres", "warning");
      return;
    }
    if (!form.metric_type) {
      showToast("Selecciona un tipo de metrica", "warning");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      metric_type: form.metric_type,
      filters: form.filters,
      period_type: form.period_type,
      period_months: form.period_type === "last_n_months" ? Number(form.period_months) : null,
      goal_value: form.hasGoal && form.goal_value !== "" ? Number(form.goal_value) : null,
      goal_direction: form.hasGoal && form.goal_value !== "" ? form.goal_direction : null,
      show_in_workspace: form.show_in_workspace,
      show_in_reports: form.show_in_reports,
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateTiKpiDefinition(id, payload);
        showToast("KPI actualizado", "success");
      } else {
        await createTiKpiDefinition(payload);
        showToast("KPI creado", "success");
      }
      navigate("/dashboard/ti/workspace/reportes");
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar el KPI", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`${WORKSPACE_PAGE_CLASS} ti-scope`}>
        <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} ti-scope gap-6`}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ti-text-muted)" }}>Workspace TI · Reportes y KPIs</p>
        <h1 className="mt-1 text-[clamp(1.4rem,2.5vw,1.75rem)] font-bold tracking-[-0.02em]" style={{ color: "var(--ti-text)" }}>
          {isEditing ? "Editar KPI" : "Nuevo KPI"}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <div style={panelStyle} className="space-y-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ti-text)" }}>1. Nombre y metrica</h2>
            <Field label="Nombre del KPI">
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={fieldStyle} placeholder="Ej. Tickets criticos abiertos" />
            </Field>
            <Field label="Descripcion (opcional)">
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full resize-none px-3 py-2 text-sm outline-none" style={fieldStyle} />
            </Field>
            <Field label="Tipo de metrica">
              <select value={form.metric_type} onChange={(e) => setForm((p) => ({ ...p, metric_type: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={fieldStyle}>
                <option value="">Selecciona una metrica</option>
                {catalog.metrics.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={panelStyle} className="space-y-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ti-text)" }}>2. Filtros (opcionales)</h2>
            {catalog.filterableFields.map((field) => (
              <div key={field.value} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ti-text-muted)" }}>{field.label}</p>
                {field.type === "enum" ? (
                  <div className="flex flex-wrap gap-2">
                    {(field.options || []).map((option) => {
                      const active = (form.filters[field.value] || []).includes(option);
                      return (
                        <button
                          type="button"
                          key={option}
                          onClick={() => toggleFilterValue(field.value, option)}
                          className="px-2.5 py-1 text-xs font-semibold capitalize transition"
                          style={{
                            borderRadius: "var(--ti-radius-badge)",
                            border: `1px solid ${active ? "var(--ti-accent)" : "var(--ti-border-control)"}`,
                            background: active ? "var(--ti-selected)" : "transparent",
                            color: active ? "var(--ti-accent)" : "var(--ti-text-muted)",
                          }}
                        >
                          {toStatusLabel(option)}
                        </button>
                      );
                    })}
                  </div>
                ) : field.value === "assigned_ti_user_id" ? (
                  <div className="flex flex-wrap gap-2">
                    {technicians.map((tech) => {
                      const active = (form.filters[field.value] || []).includes(String(tech.id));
                      return (
                        <button
                          type="button"
                          key={tech.id}
                          onClick={() => toggleFilterValue(field.value, String(tech.id))}
                          className="px-2.5 py-1 text-xs font-semibold transition"
                          style={{
                            borderRadius: "var(--ti-radius-badge)",
                            border: `1px solid ${active ? "var(--ti-accent)" : "var(--ti-border-control)"}`,
                            background: active ? "var(--ti-selected)" : "transparent",
                            color: active ? "var(--ti-accent)" : "var(--ti-text-muted)",
                          }}
                        >
                          {tech.fullname || tech.email}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    placeholder="Separar valores con coma"
                    value={(form.filters[field.value] || []).join(", ")}
                    onChange={(e) => {
                      const values = e.target.value.split(",").map((v) => v.trim()).filter(Boolean);
                      setForm((p) => ({ ...p, filters: { ...p.filters, [field.value]: values } }));
                    }}
                    className="w-full px-3 py-2 text-sm outline-none"
                    style={fieldStyle}
                  />
                )}
              </div>
            ))}
          </div>

          <div style={panelStyle} className="space-y-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ti-text)" }}>3. Periodo y meta</h2>
            <Field label="Periodo">
              <select value={form.period_type} onChange={(e) => setForm((p) => ({ ...p, period_type: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={fieldStyle}>
                {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            {form.period_type === "last_n_months" ? (
              <Field label="Cantidad de meses">
                <input type="number" min={1} max={24} value={form.period_months} onChange={(e) => setForm((p) => ({ ...p, period_months: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={fieldStyle} />
              </Field>
            ) : null}

            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ti-text)" }}>
              <input type="checkbox" checked={form.hasGoal} onChange={(e) => setForm((p) => ({ ...p, hasGoal: e.target.checked }))} />
              Definir una meta / umbral
            </label>
            {form.hasGoal ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor meta">
                  <input type="number" step="0.01" value={form.goal_value} onChange={(e) => setForm((p) => ({ ...p, goal_value: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={fieldStyle} />
                </Field>
                <Field label="Direccion" helper={form.goal_direction === "lte" ? "Cumple si el valor es menor o igual" : "Cumple si el valor es mayor o igual"}>
                  <select value={form.goal_direction} onChange={(e) => setForm((p) => ({ ...p, goal_direction: e.target.value }))} className="w-full px-3 py-2 text-sm outline-none" style={fieldStyle}>
                    <option value="gte">Mayor o igual (≥)</option>
                    <option value="lte">Menor o igual (≤)</option>
                  </select>
                </Field>
              </div>
            ) : null}
          </div>

          <div style={panelStyle} className="space-y-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ti-text)" }}>4. Visibilidad</h2>
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ti-text)" }}>
              <input type="checkbox" checked={form.show_in_workspace} onChange={(e) => setForm((p) => ({ ...p, show_in_workspace: e.target.checked }))} />
              Mostrar en la franja de KPI del workspace (visible para todo TI)
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ti-text)" }}>
              <input type="checkbox" checked={form.show_in_reports} onChange={(e) => setForm((p) => ({ ...p, show_in_reports: e.target.checked }))} />
              Incluir en el reporte mensual
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ti-text)" }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
              Activo
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" icon={FiX} onClick={() => navigate("/dashboard/ti/workspace/reportes")}>Cancelar</Button>
            <Button type="submit" variant="primary" icon={FiSave} loading={saving}>Guardar KPI</Button>
          </div>
        </div>

        <aside className="h-fit space-y-2" style={panelStyle}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--ti-text)" }}>Resumen</h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ti-text-muted)" }}>{summary}</p>
        </aside>
      </form>
    </div>
  );
};

export default TicketKpiForm;
