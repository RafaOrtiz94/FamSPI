// Pasos de texto del Blue Sheet (objetivo, proceso de compra y estrategia), con guardado automático.
// Los mínimos de caracteres son los mismos que usa el servidor para la completitud y la aprobación.
import { useState } from "react";
import { updateBlueSheetBuyingProcess, updateBlueSheetGeneral, updateBlueSheetStrategy } from "../../../../core/api/crmFamApi";
import { cx, Field, SelectInput, TextArea, TextInput } from "../../ui/kit";
import { LEVELS, SaveStatus, useAutosave } from "./shared";

// Área de texto con contador frente al mínimo que exige el servidor.
function CountedArea({ label, value, onChange, min, disabled, rows = 3, placeholder, optional }) {
  const len = value.trim().length;
  const ok = len > min;
  return (
    <Field label={label} optional={optional}>
      {(p) => (
        <>
          <TextArea {...p} rows={rows} value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} />
          {min > 0 && (
            <p className={cx("mt-1 text-xs", ok ? "text-fam-success" : "text-fam-muted")}>
              {ok ? "Cumple el mínimo" : `${len} de ${min + 1} caracteres mínimos`}
            </p>
          )}
        </>
      )}
    </Field>
  );
}

function StepFrame({ title, intro, autosave, editable, children }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-fam-text">{title}</h2>
          {intro && <p className="mt-1 max-w-2xl text-sm text-fam-muted">{intro}</p>}
        </div>
        <SaveStatus autosave={autosave} editable={editable} />
      </div>
      <div className="max-w-3xl space-y-5">{children}</div>
    </div>
  );
}

export function StepObjective({ bs, editable, onSaved }) {
  const [form, setForm] = useState({
    sales_objective_text: bs.sales_objective_text || "",
    customer_situation_current: bs.customer_situation_current || "",
    customer_situation_desired: bs.customer_situation_desired || "",
    urgency_level: bs.urgency_level || "medium",
    urgency_source: bs.urgency_source || "",
    budget_status: bs.budget_status || "unknown",
    budget_amount: bs.budget_amount ?? "",
    budget_confirmed_by: bs.budget_confirmed_by || "",
  });
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const autosave = useAutosave(form, async (v) => {
    await updateBlueSheetGeneral(bs.id, { ...v, budget_amount: v.budget_amount === "" ? null : Number(v.budget_amount) });
    onSaved();
  }, { enabled: editable });

  return (
    <StepFrame title="Objetivo y situación" intro="Qué quiere lograr el cliente y qué cambia para él si compra. Es la base de todo lo demás." autosave={autosave} editable={editable}>
      <CountedArea label="Objetivo de venta" min={30} value={form.sales_objective_text} onChange={set("sales_objective_text")} disabled={!editable} placeholder="Qué se venderá, a quién y para cuándo. Específico y medible." />
      <CountedArea label="Situación actual del cliente" min={20} value={form.customer_situation_current} onChange={set("customer_situation_current")} disabled={!editable} placeholder="Cómo trabaja hoy y qué le duele." />
      <CountedArea label="Situación deseada del cliente" min={20} value={form.customer_situation_desired} onChange={set("customer_situation_desired")} disabled={!editable} placeholder="Cómo se verá su operación cuando esto esté resuelto." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Urgencia del cliente">
          {(p) => (
            <SelectInput {...p} value={form.urgency_level} onChange={set("urgency_level")} disabled={!editable}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label="Qué genera la urgencia" optional>{(p) => <TextInput {...p} value={form.urgency_source} onChange={set("urgency_source")} disabled={!editable} placeholder="Vencimiento de contrato, auditoría, equipo dañado…" />}</Field>
        <Field label="Presupuesto">
          {(p) => (
            <SelectInput {...p} value={form.budget_status} onChange={set("budget_status")} disabled={!editable}>
              <option value="unknown">Desconocido</option>
              <option value="identified">Identificado</option>
              <option value="approved">Aprobado</option>
              <option value="constrained">Limitado</option>
            </SelectInput>
          )}
        </Field>
        <Field label="Monto del presupuesto (USD)" optional>{(p) => <TextInput {...p} type="number" min="0" step="0.01" value={form.budget_amount} onChange={set("budget_amount")} disabled={!editable} className="fam-numeric" />}</Field>
        <Field label="Quién confirmó el presupuesto" optional>{(p) => <TextInput {...p} value={form.budget_confirmed_by} onChange={set("budget_confirmed_by")} disabled={!editable} maxLength={100} />}</Field>
      </div>
    </StepFrame>
  );
}

export function StepBuyingProcess({ bs, editable, onSaved }) {
  const [form, setForm] = useState({
    buying_process_description: bs.buying_process_description || "",
    buying_process_maturity: bs.buying_process_maturity || "",
    decision_timeline: bs.decision_timeline || "",
    procurement_involved: Boolean(bs.procurement_involved),
    legal_involved: Boolean(bs.legal_involved),
    buying_process_notes: bs.buying_process_notes || "",
  });
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const autosave = useAutosave(form, async (v) => {
    await updateBlueSheetBuyingProcess(bs.id, { ...v, buying_process_maturity: v.buying_process_maturity || null });
    onSaved();
  }, { enabled: editable });

  return (
    <StepFrame title="Proceso de compra" intro="Cómo decide y compra este cliente: pasos, áreas que intervienen y plazos." autosave={autosave} editable={editable}>
      <CountedArea label="Cómo compra el cliente" min={20} rows={4} value={form.buying_process_description} onChange={set("buying_process_description")} disabled={!editable} placeholder="El comité técnico evalúa, gerencia aprueba y compras ejecuta la orden…" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qué tan definido está el proceso" optional>
          {(p) => (
            <SelectInput {...p} value={form.buying_process_maturity} onChange={set("buying_process_maturity")} disabled={!editable}>
              <option value="">Sin evaluar</option>
              <option value="unknown">No lo conocemos</option>
              <option value="informal">Informal</option>
              <option value="defined">Definido</option>
              <option value="formal">Formal, con comité o licitación</option>
            </SelectInput>
          )}
        </Field>
        <Field label="Plazo de decisión" optional>{(p) => <TextInput {...p} value={form.decision_timeline} onChange={set("decision_timeline")} disabled={!editable} placeholder="Antes del cierre fiscal, en 60 días…" />}</Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-fam-text">Áreas que intervienen</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-fam-text"><input type="checkbox" checked={form.procurement_involved} onChange={set("procurement_involved")} disabled={!editable} /> Compras</label>
          <label className="flex items-center gap-2 text-sm text-fam-text"><input type="checkbox" checked={form.legal_involved} onChange={set("legal_involved")} disabled={!editable} /> Legal</label>
        </div>
      </fieldset>
      <Field label="Notas" optional>{(p) => <TextArea {...p} rows={2} value={form.buying_process_notes} onChange={set("buying_process_notes")} disabled={!editable} />}</Field>
    </StepFrame>
  );
}

export function StepStrategy({ bs, editable, onSaved }) {
  const [form, setForm] = useState({
    strategy_summary: bs.strategy_summary || "",
    strategy_approach: bs.strategy_approach || "",
    strategy_key_themes: bs.strategy_key_themes || "",
    differentiation_factors: bs.differentiation_factors || "",
    strategy_risks: bs.strategy_risks || "",
  });
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const autosave = useAutosave(form, async (v) => {
    await updateBlueSheetStrategy(bs.id, { ...v, strategy_approach: v.strategy_approach || null });
    onSaved();
  }, { enabled: editable });

  return (
    <StepFrame title="Estrategia" intro="Con todo lo anterior a la vista: cómo vamos a ganar. Sin este resumen el Blue Sheet no se puede aprobar." autosave={autosave} editable={editable}>
      <CountedArea label="Resumen de la estrategia" min={50} rows={5} value={form.strategy_summary} onChange={set("strategy_summary")} disabled={!editable} placeholder="A quién convencer primero, con qué argumento y cómo neutralizar a la competencia." />
      <Field label="Enfoque" optional>{(p) => <TextInput {...p} value={form.strategy_approach} onChange={set("strategy_approach")} disabled={!editable} maxLength={100} placeholder="Consultivo, por precio, por servicio…" />}</Field>
      <Field label="Mensajes clave" optional>{(p) => <TextArea {...p} rows={2} value={form.strategy_key_themes} onChange={set("strategy_key_themes")} disabled={!editable} />}</Field>
      <Field label="Qué nos diferencia" optional>{(p) => <TextArea {...p} rows={2} value={form.differentiation_factors} onChange={set("differentiation_factors")} disabled={!editable} />}</Field>
      <Field label="Riesgos de la estrategia" optional>{(p) => <TextArea {...p} rows={2} value={form.strategy_risks} onChange={set("strategy_risks")} disabled={!editable} />}</Field>
    </StepFrame>
  );
}
