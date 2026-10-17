// Configuración del CRM: tres catálogos (fases del embudo, criterios del scorecard y motivos de
// pérdida) con la misma mecánica. Lo desactivado sigue visible para poder reactivarlo.
import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import {
  createLostReason, createPipelineStage, createScorecardCriterion, fetchLostReasons, fetchPipelineStages,
  fetchScorecardCriteria, updateLostReason, updatePipelineStage, updateScorecardCriterion,
} from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { Badge, Btn, DataTable, EmptyState, ErrorNote, Field, PageHeader, Panel, SkeletonRows, Tabs, TextArea, TextInput } from "../ui/kit";
import { errorMessage } from "../ui/format";
import { isAdmin } from "../ui/roles";
import { useLoad } from "../ui/useLoad";
import { useUrlState } from "../ui/useUrlState";

// Fases de las que depende la sincronización con Business Case y compras, y el cálculo de "vendido".
// Su nombre no debe cambiarse (crmPurchaseSync.service.js las busca por nombre exacto).
const LOCKED_STAGE_NAMES = ["Análisis de la oportunidad", "Desarrollo de la oferta", "Presentación de la oferta", "Negociación", "Aceptación o rechazo", "Contratos", "Entrega e instalación", "Control de consumibles"];

const num = (value, fallback = 0) => (value === "" || value === null || value === undefined ? fallback : Number(value));

const CATALOGS = {
  stages: {
    tab: "Fases del embudo",
    intro: "Las columnas del tablero, en orden. La probabilidad se usa para el pronóstico ponderado.",
    singular: "fase",
    load: () => fetchPipelineStages({ include_inactive: 1 }),
    create: createPipelineStage,
    update: updatePipelineStage,
    nameKey: "name",
    blank: { name: "", description: "", order_index: "", probability_default: "", requires_blue_sheet: false },
    toForm: (r) => ({ name: r.name || "", description: r.description || "", order_index: r.order_index ?? "", probability_default: r.probability_default ?? "", requires_blue_sheet: Boolean(r.requires_blue_sheet) }),
    toPayload: (f) => ({ name: f.name.trim(), description: f.description.trim() || null, order_index: num(f.order_index), probability_default: num(f.probability_default), requires_blue_sheet: Boolean(f.requires_blue_sheet) }),
    validate: (f) => (!f.name.trim() ? "Escribe el nombre de la fase." : num(f.probability_default) < 0 || num(f.probability_default) > 100 ? "La probabilidad va de 0 a 100." : ""),
    columns: [
      { key: "order_index", header: "Orden", align: "right", render: (r) => r.order_index ?? "—" },
      { key: "name", header: "Fase", render: (r) => <span className="font-medium">{r.name}</span> },
      { key: "probability_default", header: "Probabilidad", align: "right", render: (r) => `${Number(r.probability_default || 0)}%` },
      { key: "requires_blue_sheet", header: "Blue Sheet", hideBelow: "sm", render: (r) => (r.requires_blue_sheet ? <Badge tone="info">Requerido</Badge> : <span className="text-fam-muted">Opcional</span>) },
    ],
    fields: (f, set, editing) => (
      <>
        <Field label="Nombre" hint={editing && LOCKED_STAGE_NAMES.includes(editing.name) ? "Esta fase la usan Business Case, compras y el cálculo de vendido: su nombre no se puede cambiar." : undefined}>
          {(p) => <TextInput {...p} value={f.name} onChange={set("name")} maxLength={100} autoFocus disabled={Boolean(editing && LOCKED_STAGE_NAMES.includes(editing.name))} />}
        </Field>
        <Field label="Descripción" optional>{(p) => <TextArea {...p} rows={2} value={f.description} onChange={set("description")} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Orden en el tablero">{(p) => <TextInput {...p} type="number" min="0" value={f.order_index} onChange={set("order_index")} className="fam-numeric" />}</Field>
          <Field label="Probabilidad (%)">{(p) => <TextInput {...p} type="number" min="0" max="100" value={f.probability_default} onChange={set("probability_default")} className="fam-numeric" />}</Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-fam-text"><input type="checkbox" checked={f.requires_blue_sheet} onChange={set("requires_blue_sheet")} /> Requiere Blue Sheet aprobado para entrar a esta fase</label>
      </>
    ),
  },
  criteria: {
    tab: "Scorecard",
    intro: "Los criterios que se califican de 0 a 5 en cada Blue Sheet. El peso define cuánto cuenta cada uno en el puntaje.",
    singular: "criterio",
    load: () => fetchScorecardCriteria({ include_inactive: 1 }),
    create: createScorecardCriterion,
    update: updateScorecardCriterion,
    nameKey: "criterion_name",
    blank: { criterion_name: "", criterion_description: "", weight: "1", display_order: "" },
    toForm: (r) => ({ criterion_name: r.criterion_name || "", criterion_description: r.criterion_description || "", weight: r.weight ?? "1", display_order: r.display_order ?? "" }),
    toPayload: (f) => ({ criterion_name: f.criterion_name.trim(), criterion_description: f.criterion_description.trim() || null, weight: num(f.weight, 1), display_order: num(f.display_order) }),
    validate: (f) => (!f.criterion_name.trim() ? "Escribe el nombre del criterio." : num(f.weight, 1) <= 0 ? "El peso debe ser mayor que 0." : ""),
    columns: [
      { key: "display_order", header: "Orden", align: "right", render: (r) => r.display_order ?? "—" },
      { key: "criterion_name", header: "Criterio", render: (r) => <div><span className="font-medium">{r.criterion_name}</span>{r.criterion_description && <div className="text-[13px] text-fam-muted">{r.criterion_description}</div>}</div> },
      { key: "weight", header: "Peso", align: "right", render: (r) => Number(r.weight || 0) },
    ],
    fields: (f, set) => (
      <>
        <Field label="Nombre">{(p) => <TextInput {...p} value={f.criterion_name} onChange={set("criterion_name")} maxLength={200} autoFocus />}</Field>
        <Field label="Descripción" optional hint="Qué significa calificar alto en este criterio.">{(p) => <TextArea {...p} rows={2} value={f.criterion_description} onChange={set("criterion_description")} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Peso">{(p) => <TextInput {...p} type="number" min="0.1" step="0.1" value={f.weight} onChange={set("weight")} className="fam-numeric" />}</Field>
          <Field label="Orden">{(p) => <TextInput {...p} type="number" min="0" value={f.display_order} onChange={set("display_order")} className="fam-numeric" />}</Field>
        </div>
      </>
    ),
  },
  reasons: {
    tab: "Motivos de pérdida",
    intro: "Las opciones al cerrar una oportunidad como perdida. Alimentan el reporte de motivos de pérdida.",
    singular: "motivo",
    load: () => fetchLostReasons({ include_inactive: 1 }),
    create: createLostReason,
    update: updateLostReason,
    nameKey: "reason_name",
    blank: { reason_name: "", reason_description: "", display_order: "" },
    toForm: (r) => ({ reason_name: r.reason_name || "", reason_description: r.reason_description || "", display_order: r.display_order ?? "" }),
    toPayload: (f) => ({ reason_name: f.reason_name.trim(), reason_description: f.reason_description.trim() || null, display_order: num(f.display_order) }),
    validate: (f) => (!f.reason_name.trim() ? "Escribe el motivo." : ""),
    columns: [
      { key: "display_order", header: "Orden", align: "right", render: (r) => r.display_order ?? "—" },
      { key: "reason_name", header: "Motivo", render: (r) => <div><span className="font-medium">{r.reason_name}</span>{r.reason_description && <div className="text-[13px] text-fam-muted">{r.reason_description}</div>}</div> },
    ],
    fields: (f, set) => (
      <>
        <Field label="Motivo">{(p) => <TextInput {...p} value={f.reason_name} onChange={set("reason_name")} maxLength={200} autoFocus />}</Field>
        <Field label="Descripción" optional>{(p) => <TextArea {...p} rows={2} value={f.reason_description} onChange={set("reason_description")} />}</Field>
        <Field label="Orden">{(p) => <TextInput {...p} type="number" min="0" value={f.display_order} onChange={set("display_order")} className="fam-numeric" />}</Field>
      </>
    ),
  },
};

function CatalogForm({ catalog, item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? catalog.toForm(item) : catalog.blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const problem = catalog.validate(form);
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try {
      if (item) await catalog.update(item.id, catalog.toPayload(form)); else await catalog.create(catalog.toPayload(form));
      onSaved();
    } catch (err) { setError(errorMessage(err, "No se pudo guardar.")); setBusy(false); }
  };

  return (
    <Modal open title={item ? `Editar ${catalog.singular}` : `Agregar ${catalog.singular}`} onClose={onClose} maxWidth="max-w-lg" disableClose={busy}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        <div className="space-y-4">{catalog.fields(form, set, item)}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={busy}>{busy ? "Guardando…" : "Guardar"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function Catalog({ catalog }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(catalog.load, [catalog], { fallback: "No se pudo cargar el catálogo." });
  const [editing, setEditing] = useState(null); // null | {} | item
  const [toggling, setToggling] = useState(null);
  const rows = Array.isArray(data) ? data : [];
  const active = rows.filter((r) => r.is_active !== false);
  const inactive = rows.filter((r) => r.is_active === false);

  const toggle = async (item) => {
    setToggling(item.id);
    try {
      await catalog.update(item.id, { is_active: !item.is_active });
      await reload();
      showToast(item.is_active ? "Desactivado: ya no se ofrece al equipo" : "Reactivado", "success");
    } catch (err) { showToast(errorMessage(err, "No se pudo cambiar el estado."), "error"); }
    finally { setToggling(null); }
  };

  const actions = {
    key: "actions", header: "", align: "right",
    render: (r) => (
      <span className="flex justify-end gap-1">
        <Btn variant="ghost" size="sm" onClick={() => setEditing(r)}>Editar</Btn>
        <Btn variant="ghost" size="sm" loading={toggling === r.id} disabled={r.is_active !== false && LOCKED_STAGE_NAMES.includes(r.name)} title={r.is_active !== false && LOCKED_STAGE_NAMES.includes(r.name) ? "Fase usada por Business Case y compras" : undefined} onClick={() => toggle(r)}>
          {r.is_active === false ? "Reactivar" : "Desactivar"}
        </Btn>
      </span>
    ),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-fam-muted">{catalog.intro}</p>
        <Btn variant="primary" icon={FiPlus} onClick={() => setEditing({})}>Agregar {catalog.singular}</Btn>
      </div>
      <ErrorNote message={error} onRetry={reload} />
      {loading && !data ? <Panel flush><SkeletonRows rows={5} /></Panel> : error ? null : (
        <>
          <Panel flush>
            {active.length === 0
              ? <EmptyState title={`No hay ${catalog.singular}s activos`} hint="Agrega el primero para que el equipo pueda usarlo." />
              : <DataTable caption={catalog.tab} columns={[...catalog.columns, actions]} rows={active} />}
          </Panel>
          {inactive.length > 0 && (
            <details className="rounded-xl border border-fam-border bg-fam-surface">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-fam-text sm:px-5">Inactivos <span className="fam-numeric font-normal text-fam-muted">{inactive.length}</span></summary>
              <div className="border-t border-fam-border"><DataTable caption={`${catalog.tab} inactivos`} columns={[...catalog.columns, actions]} rows={inactive} /></div>
            </details>
          )}
        </>
      )}
      {editing && (
        <CatalogForm
          catalog={catalog}
          item={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); showToast("Guardado", "success"); }}
        />
      )}
    </div>
  );
}

export default function CrmSettingsPage() {
  const { user } = useAuth();
  const [url, setUrl] = useUrlState({ tab: "stages" });
  const tab = CATALOGS[url.tab] ? url.tab : "stages";

  if (!isAdmin(user)) {
    return (
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Configuración" />
        <Panel><EmptyState title="Solo para administradores" hint="La configuración del CRM la gestiona el área de TI." /></Panel>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader title="Configuración">
        <Tabs label="Catálogos" tabs={Object.entries(CATALOGS).map(([value, c]) => ({ value, label: c.tab }))} value={tab} onChange={(v) => setUrl({ tab: v })} />
      </PageHeader>
      <Catalog key={tab} catalog={CATALOGS[tab]} />
    </div>
  );
}
