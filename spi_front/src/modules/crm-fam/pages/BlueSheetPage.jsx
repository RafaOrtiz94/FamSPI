// Blue Sheet guiado: once pasos en el orden en que se piensa una venta compleja, con su estado a la
// vista, guardado automático en los pasos de texto y la completitud siempre presente. Antes era un
// formulario de nueve pestañas sin orden ni indicación de qué faltaba.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiCheck, FiChevronLeft, FiChevronRight, FiDownload, FiSend } from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import {
  approveBlueSheet, createBlueSheet, downloadBlueSheetPdf, fetchBlueSheetByOpportunity, fetchBlueSheetCompleteness,
  fetchOpportunityById, observeBlueSheet, reopenBlueSheet, submitBlueSheet,
} from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { ReasonDialog } from "../ui/dialogs";
import { Badge, Btn, cx, ErrorNote, Field, PageHeader, Panel, SelectInput, Skeleton, StatusBadge, TextArea } from "../ui/kit";
import { errorMessage } from "../ui/format";
import { isManager } from "../ui/roles";
import { blueSheetStatus } from "../ui/status";
import { useUrlState } from "../ui/useUrlState";
import { StepActions, StepBuyers, StepCompetitors, StepRedFlags, StepResults, StepStrengths, useBlueSheetCounts } from "./bluesheet/ListSteps";
import { StepReview, StepScorecard } from "./bluesheet/ScorecardReview";
import { EDITABLE_STATUSES, LEVELS, STEPS, useElementRedFlags } from "./bluesheet/shared";
import { StepBuyingProcess, StepObjective, StepStrategy } from "./bluesheet/TextSteps";

const BASE = "/dashboard/crm-fam";

// Plantillas: solo texto inicial para no arrancar de cero. El usuario lo edita después.
const TEMPLATES = {
  blank: { label: "En blanco", data: {} },
  new_client: {
    label: "Cliente nuevo",
    data: {
      sales_objective_text: "Cerrar la primera venta con este cliente y establecer una relación comercial recurrente.",
      customer_situation_current: "Cliente sin historial de compras previas con FAM. Evaluando proveedores.",
      customer_situation_desired: "Cliente convertido, con primer pedido facturado y proceso de reorden establecido.",
    },
  },
  renewal: {
    label: "Renovación o recompra",
    data: {
      sales_objective_text: "Renovar el contrato o servicio vigente antes de su vencimiento, evitando fuga a la competencia.",
      customer_situation_current: "Cliente activo con contrato o equipo próximo a vencer o renovar.",
      customer_situation_desired: "Renovación firmada con condiciones iguales o mejores, sin interrupción de servicio.",
    },
  },
  upsell: {
    label: "Expansión",
    data: {
      sales_objective_text: "Ampliar el alcance actual del cliente con equipos o servicios adicionales.",
      customer_situation_current: "Cliente activo satisfecho con la solución actual, con necesidad detectada de mayor capacidad o alcance.",
      customer_situation_desired: "Cliente con la solución ampliada operando y facturada.",
    },
  },
};

// Observación del manager: uno o varios comentarios por sección, que el comercial verá al volver.
function ObserveModal({ sections, onClose, onSubmit }) {
  const blank = () => ({ section_name: "", comment_text: "", severity: "medium", requires_correction: true });
  const [comments, setComments] = useState([blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setField = (i, name, value) => setComments((prev) => prev.map((c, idx) => (idx === i ? { ...c, [name]: value } : c)));

  const submit = async (e) => {
    e.preventDefault();
    const valid = comments.filter((c) => c.comment_text.trim());
    if (!valid.length) { setError("Escribe al menos un comentario explicando qué hay que corregir."); return; }
    setBusy(true); setError("");
    try { await onSubmit({ comments: valid.map((c) => ({ ...c, comment_text: c.comment_text.trim(), section_name: c.section_name || null })) }); }
    catch (err) { setError(errorMessage(err, "No se pudo observar el Blue Sheet.")); setBusy(false); }
  };

  return (
    <Modal open title="Observar Blue Sheet" onClose={onClose} maxWidth="max-w-2xl" disableClose={busy}>
      <form onSubmit={submit} noValidate>
        <p className="mb-4 text-sm text-fam-muted">El comercial verá cada comentario en el paso Revisión y podrá corregir y volver a enviar.</p>
        <ErrorNote message={error} className="mb-4" />
        <div className="space-y-4">
          {comments.map((c, i) => (
            <fieldset key={i} className="rounded-xl border border-fam-border p-4">
              <legend className="px-1 text-[13px] font-medium text-fam-text">Comentario {i + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sección">
                  {(p) => <SelectInput {...p} value={c.section_name} onChange={(e) => setField(i, "section_name", e.target.value)}><option value="">Todo el Blue Sheet</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</SelectInput>}
                </Field>
                <Field label="Severidad">
                  {(p) => <SelectInput {...p} value={c.severity} onChange={(e) => setField(i, "severity", e.target.value)}>{LEVELS.filter((l) => l.value !== "critical").map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</SelectInput>}
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Qué hay que corregir">{(p) => <TextArea {...p} rows={2} value={c.comment_text} onChange={(e) => setField(i, "comment_text", e.target.value)} />}</Field>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-fam-text"><input type="checkbox" checked={c.requires_correction} onChange={(e) => setField(i, "requires_correction", e.target.checked)} /> Requiere corrección</label>
                {comments.length > 1 && <Btn variant="ghost" size="sm" onClick={() => setComments((prev) => prev.filter((_, idx) => idx !== i))}>Quitar</Btn>}
              </div>
            </fieldset>
          ))}
        </div>
        <Btn size="sm" className="mt-3" onClick={() => setComments((prev) => [...prev, blank()])}>Agregar otro comentario</Btn>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={busy}>{busy ? "Guardando…" : "Observar"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function BlueSheetPage() {
  const { opportunityId } = useParams();
  const { user } = useAuth();
  const { showToast } = useUI();
  const manager = isManager(user);
  const [url, setUrl] = useUrlState({ paso: "objetivo" });
  const [state, setState] = useState({ loading: true, opp: null, bs: null, error: "" });
  const [completeness, setCompleteness] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [template, setTemplate] = useState("blank");
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
    const [o, b] = await Promise.allSettled([fetchOpportunityById(opportunityId), fetchBlueSheetByOpportunity(opportunityId)]);
    if (o.status === "rejected") {
      setState({ loading: false, opp: null, bs: null, error: errorMessage(o.reason, "No se pudo cargar la oportunidad.") });
      return;
    }
    // Sin Blue Sheet el servidor responde 404: no es un error, es el estado inicial.
    setState({ loading: false, opp: o.value, bs: b.status === "fulfilled" ? b.value : null, error: "" });
  }, [opportunityId]);
  useEffect(() => { load(); }, [load]);

  const bs = state.bs;
  const opp = state.opp;
  const redFlags = useElementRedFlags(bs?.id, (msg) => showToast(msg, "error"));
  const counts = useBlueSheetCounts(bs?.id, refreshKey);

  useEffect(() => {
    if (!bs?.id) return undefined;
    let cancelled = false;
    fetchBlueSheetCompleteness(bs.id).then((res) => { if (!cancelled) setCompleteness(res); }).catch(() => { if (!cancelled) setCompleteness(null); });
    return () => { cancelled = true; };
  }, [bs?.id, refreshKey]);

  // Tras cada guardado se refrescan en silencio el Blue Sheet (estado, puntajes) y la completitud.
  const onChanged = useCallback(() => { setRefreshKey((k) => k + 1); load({ silent: true }); }, [load]);

  const checklist = useMemo(() => (Array.isArray(completeness?.checklist) ? completeness.checklist : []), [completeness]);
  const metKeys = useMemo(() => new Set(checklist.filter((i) => i.met).map((i) => i.key)), [checklist]);
  const score = Math.round(Number(completeness?.completeness_score ?? bs?.completeness_score ?? 0));

  if (state.loading) return <div className="space-y-4"><Skeleton className="h-4 w-56" /><Skeleton className="h-8 w-72" /><Skeleton className="h-64 w-full" /></div>;
  if (state.error) {
    return (
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Blue Sheet" context={<Link to={`${BASE}/opportunities`} className="underline underline-offset-2">Embudo</Link>} />
        <ErrorNote message={state.error} onRetry={() => load()} />
      </div>
    );
  }

  const context = (
    <>
      <Link to={`${BASE}/opportunities`} className="underline underline-offset-2">Embudo</Link> / <Link to={`${BASE}/opportunities/${opportunityId}`} className="underline underline-offset-2">{opp.name}</Link> / Blue Sheet
    </>
  );

  // ── Sin Blue Sheet todavía ──
  if (!bs) {
    const create = async () => {
      setBusy("create");
      try { await createBlueSheet(opportunityId, TEMPLATES[template].data); await load({ silent: true }); showToast("Blue Sheet creado", "success"); }
      catch (err) { showToast(errorMessage(err, "No se pudo crear el Blue Sheet."), "error"); }
      finally { setBusy(""); }
    };
    return (
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Blue Sheet" context={context} />
        <Panel className="max-w-2xl">
          <h2 className="text-base font-semibold text-fam-text">Esta oportunidad aún no tiene Blue Sheet</h2>
          <p className="mt-1 text-sm text-fam-muted">Es la hoja de estrategia de la venta: quién decide, qué gana cada uno, contra quién competimos y qué haremos. Se completa en {STEPS.length} pasos y se guarda sola.</p>
          <div className="mt-4 max-w-xs">
            <Field label="Empezar con" hint="La plantilla solo sugiere un texto inicial que luego editas.">
              {(p) => <SelectInput {...p} value={template} onChange={(e) => setTemplate(e.target.value)}>{Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</SelectInput>}
            </Field>
          </div>
          <div className="mt-5"><Btn variant="primary" loading={busy === "create"} onClick={create}>{busy === "create" ? "Creando…" : "Crear Blue Sheet"}</Btn></div>
        </Panel>
      </div>
    );
  }

  const editable = EDITABLE_STATUSES.includes(bs.status);
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === url.paso));
  const step = STEPS[stepIndex];
  const goTo = (id) => { setUrl({ paso: id }, { replace: false }); window.scrollTo({ top: 0 }); };

  const requirements = [
    { label: "Objetivo de venta descrito (más de 20 caracteres)", met: (bs.sales_objective_text || "").trim().length > 20, step: "objetivo" },
    { label: "Al menos un comprador registrado", met: (counts?.buyers || 0) >= 1, step: "compradores" },
    { label: "Scorecard iniciado", met: Number(bs.scorecard_score) > 0, step: "scorecard" },
    { label: "Al menos una acción", met: (counts?.actions || 0) >= 1, step: "acciones" },
  ];
  const canSubmit = editable && counts !== null && requirements.every((r) => r.met);
  const stepState = (s) => {
    if (s.id === "acciones") return (counts?.actions || 0) >= 1 ? "done" : "todo";
    if (s.id === "redflags" || s.id === "revision") return "info";
    return s.keys.every((k) => metKeys.has(k)) ? "done" : s.keys.some((k) => metKeys.has(k)) ? "partial" : "todo";
  };
  const nextPending = STEPS.find((s) => ["todo", "partial"].includes(stepState(s)));

  const run = async (name, fn, okMessage) => {
    setBusy(name);
    try { await fn(); await load({ silent: true }); setRefreshKey((k) => k + 1); if (okMessage) showToast(okMessage, "success"); }
    catch (err) { showToast(errorMessage(err, "No se pudo completar la acción."), "error"); }
    finally { setBusy(""); }
  };
  const downloadPdf = async () => {
    setBusy("pdf");
    try { await downloadBlueSheetPdf(bs.id); } catch (err) { showToast(errorMessage(err, "No se pudo generar el PDF."), "error"); }
    finally { setBusy(""); }
  };

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Blue Sheet"
        context={context}
        actions={(
          <>
            <Btn icon={FiDownload} loading={busy === "pdf"} onClick={downloadPdf}>{busy === "pdf" ? "Generando…" : "PDF"}</Btn>
            {manager && ["approved", "observed"].includes(bs.status) && <Btn onClick={() => setDialog("reopen")}>Reabrir</Btn>}
            {manager && bs.status === "ready_for_review" && (
              <>
                <Btn onClick={() => setDialog("observe")}>Observar</Btn>
                <Btn variant="primary" icon={FiCheck} onClick={() => setDialog("approve")}>Aprobar</Btn>
              </>
            )}
            {editable && (
              <Btn
                variant="primary"
                icon={FiSend}
                loading={busy === "submit"}
                disabled={!canSubmit}
                title={canSubmit ? undefined : "Completa los requisitos del paso Revisión"}
                onClick={() => run("submit", () => submitBlueSheet(bs.id), "Enviado a revisión")}
              >
                Enviar a revisión
              </Btn>
            )}
          </>
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fam-muted">
          <StatusBadge of={blueSheetStatus} value={bs.status} />
          {bs.version_number > 1 && <span>Versión <span className="fam-numeric text-fam-text">{bs.version_number}</span></span>}
          {redFlags.count > 0 && <Badge tone="danger">{redFlags.count} elemento(s) con red flag</Badge>}
          {editable && !canSubmit && counts !== null && <button type="button" onClick={() => goTo("revision")} className="text-fam-action underline underline-offset-2">Ver qué falta para enviar</button>}
        </div>
      </PageHeader>

      {bs.status === "needs_update" && bs.reopen_reason && <p className="mb-4 rounded-lg bg-fam-danger-bg px-4 py-3 text-sm text-fam-danger"><strong>Reabierto:</strong> {bs.reopen_reason}</p>}
      {bs.status === "needs_update" && !bs.reopen_reason && <p className="mb-4 rounded-lg bg-fam-warning-bg px-4 py-3 text-sm text-fam-warning">La oportunidad cambió de monto o de fecha de cierre: revisa el Blue Sheet y vuelve a enviarlo.</p>}
      {bs.status === "observed" && <p className="mb-4 rounded-lg bg-fam-warning-bg px-4 py-3 text-sm text-fam-warning">Tu jefe observó este Blue Sheet. Revisa los comentarios en el paso <button type="button" onClick={() => goTo("revision")} className="underline underline-offset-2">Revisión</button>, corrige y vuelve a enviarlo.</p>}
      {bs.status === "ready_for_review" && !manager && <p className="mb-4 rounded-lg bg-fam-info-bg px-4 py-3 text-sm text-fam-info">En revisión: no se puede editar hasta que sea aprobado u observado.</p>}
      {bs.status === "approved" && bs.approval_notes && <p className="mb-4 rounded-lg bg-fam-success-bg px-4 py-3 text-sm text-fam-success"><strong>Aprobado:</strong> {bs.approval_notes}</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* Pasos + completitud */}
        <aside aria-label="Pasos del Blue Sheet">
          <div className="mb-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-fam-muted">Completitud</span>
              <span className="fam-numeric text-sm font-semibold text-fam-text">{score}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fam-subtle" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="Completitud del Blue Sheet">
              <div className="h-full rounded-full bg-fam-action transition-[width] duration-200" style={{ width: `${score}%` }} />
            </div>
            {nextPending && nextPending.id !== step.id && (
              <button type="button" onClick={() => goTo(nextPending.id)} className="mt-2 text-left text-[13px] text-fam-action underline underline-offset-2">Siguiente pendiente: {nextPending.label}</button>
            )}
          </div>

          {/* Móvil: selector de paso */}
          <div className="lg:hidden">
            <SelectInput aria-label="Paso del Blue Sheet" value={step.id} onChange={(e) => goTo(e.target.value)}>
              {STEPS.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.label}{stepState(s) === "done" ? " ✓" : ""}</option>)}
            </SelectInput>
          </div>

          <ol className="hidden space-y-0.5 lg:block">
            {STEPS.map((s, i) => {
              const st = stepState(s);
              const current = s.id === step.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goTo(s.id)}
                    aria-current={current ? "step" : undefined}
                    className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100", current ? "bg-fam-selected font-semibold text-fam-text" : "text-fam-text hover:bg-fam-subtle")}
                  >
                    <span className={cx(
                      "fam-numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                      st === "done" ? "border-transparent bg-fam-success-bg text-fam-success" : current ? "border-fam-action text-fam-action" : "border-fam-border text-fam-muted",
                    )}>
                      {st === "done" ? <FiCheck className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {st === "partial" && <span className="shrink-0 text-xs font-normal text-fam-warning">a medias</span>}
                    <span className="sr-only">{st === "done" ? " (completo)" : st === "todo" ? " (pendiente)" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Contenido del paso */}
        <div className="min-w-0">
          <div key={step.id} className="rounded-xl border border-fam-border bg-fam-surface p-4 sm:p-6">
            {step.id === "objetivo" && <StepObjective bs={bs} editable={editable} onSaved={onChanged} />}
            {step.id === "proceso" && <StepBuyingProcess bs={bs} editable={editable} onSaved={onChanged} />}
            {step.id === "compradores" && <StepBuyers bs={bs} editable={editable} redFlags={redFlags} onChanged={onChanged} />}
            {step.id === "resultados" && <StepResults bs={bs} editable={editable} onChanged={onChanged} />}
            {step.id === "competencia" && <StepCompetitors bs={bs} editable={editable} redFlags={redFlags} onChanged={onChanged} />}
            {step.id === "fortalezas" && <StepStrengths bs={bs} editable={editable} onChanged={onChanged} />}
            {step.id === "redflags" && <StepRedFlags bs={bs} editable={editable} canAccept={manager} onChanged={onChanged} />}
            {step.id === "scorecard" && <StepScorecard bs={bs} editable={editable} redFlags={redFlags} onSaved={onChanged} />}
            {step.id === "estrategia" && <StepStrategy bs={bs} editable={editable} onSaved={onChanged} />}
            {step.id === "acciones" && <StepActions bs={bs} editable={editable} redFlags={redFlags} onChanged={onChanged} />}
            {step.id === "revision" && <StepReview bs={bs} editable={editable} requirements={requirements} counts={counts} onGoTo={goTo} />}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Btn icon={FiChevronLeft} disabled={stepIndex === 0} onClick={() => goTo(STEPS[stepIndex - 1].id)}>Anterior</Btn>
            <span className="fam-numeric text-[13px] text-fam-muted">Paso {stepIndex + 1} de {STEPS.length}</span>
            {stepIndex < STEPS.length - 1
              ? <Btn variant="primary" onClick={() => goTo(STEPS[stepIndex + 1].id)}>Siguiente <FiChevronRight className="h-4 w-4" aria-hidden="true" /></Btn>
              : <span className="w-[104px]" aria-hidden="true" />}
          </div>
        </div>
      </div>

      {dialog === "approve" && (
        <ReasonDialog
          title="Aprobar Blue Sheet"
          description="Se guardará una versión aprobada. No se puede aprobar con red flags críticas abiertas ni sin resumen de estrategia."
          label="Nota de aprobación"
          confirmLabel="Aprobar"
          onClose={() => setDialog(null)}
          onConfirm={async (notes) => { await approveBlueSheet(bs.id, { notes: notes || null }); setDialog(null); await load({ silent: true }); showToast("Blue Sheet aprobado", "success"); }}
        />
      )}
      {dialog === "reopen" && (
        <ReasonDialog
          title="Reabrir Blue Sheet"
          description="Volverá a ser editable y el comercial deberá enviarlo otra vez."
          label="Motivo de la reapertura"
          confirmLabel="Reabrir"
          required
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await reopenBlueSheet(bs.id, { reason }); setDialog(null); await load({ silent: true }); showToast("Blue Sheet reabierto", "success"); }}
        />
      )}
      {dialog === "observe" && (
        <ObserveModal
          sections={STEPS.filter((s) => s.id !== "revision")}
          onClose={() => setDialog(null)}
          onSubmit={async (payload) => { await observeBlueSheet(bs.id, payload); setDialog(null); await load({ silent: true }); showToast("Blue Sheet observado", "success"); }}
        />
      )}
    </div>
  );
}
