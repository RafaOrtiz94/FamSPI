// Pasos del Blue Sheet que son listas: compradores, resultados, competencia, fortalezas, red flags
// y acciones. Cada alta va en el diálogo del sistema y cada baja pide confirmación explícita.
import { useEffect, useState } from "react";
import { FiCheck, FiPlus } from "react-icons/fi";
import Modal from "../../../../core/ui/components/Modal";
import {
  acceptRedFlag, completeActionItem, createActionItem, createBuyingInfluence, createCompetitor, createRedFlag,
  createStrength, createWinResult, deleteActionItem, deleteBuyingInfluence, deleteCompetitor, deleteRedFlag,
  deleteStrength, deleteWinResult, fetchActionItems, fetchBuyingInfluences, fetchCompetitors, fetchRedFlags,
  fetchStrengths, fetchWinResults,
} from "../../../../core/api/crmFamApi";
import { useUI } from "../../../../core/ui/UIContext";
import { ConfirmDialog } from "../../ui/dialogs";
import { Badge, Btn, cx, ErrorNote, Field, SelectInput, Skeleton, TextArea, TextInput } from "../../ui/kit";
import { date, daysFromToday, errorMessage, relativeDay } from "../../ui/format";
import { useAdvisors, useLoad } from "../../ui/useLoad";
import { FlagToggle, levelLabel, LEVELS, levelTone } from "./shared";

const ROLES = { economic_buyer: "Comprador económico", user_buyer: "Comprador usuario", technical_buyer: "Comprador técnico", coach: "Coach" };
const ROLE_HINTS = {
  economic_buyer: "Da la aprobación final y libera el dinero.",
  user_buyer: "Usará la solución en su trabajo diario.",
  technical_buyer: "Evalúa y puede vetar por requisitos técnicos.",
  coach: "Nos guía dentro de la cuenta y quiere que ganemos.",
};
const RECEPTIVITY = { growth: "Quiere crecer", trouble: "Tiene un problema", even_keel: "Está conforme", overconfident: "Se cree mejor de lo que está" };
const ACCESS = { direct: "Directo", limited: "Limitado", none: "Sin acceso" };
const ELEMENT_LABELS = { buying_influence: "un comprador", competitor: "un competidor", scorecard_criterion: "el scorecard", action_item: "una acción" };
const asList = (res) => (Array.isArray(res) ? res : []);

// ─── Marco común de un paso de lista ─────────────────────────────────────────
function ListFrame({ title, intro, count, addLabel, onAdd, editable, loading, error, onRetry, emptyTitle, emptyHint, children }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-fam-text">{title} {!loading && <span className="fam-numeric text-base font-normal text-fam-muted">{count}</span>}</h2>
          {intro && <p className="mt-1 max-w-2xl text-sm text-fam-muted">{intro}</p>}
        </div>
        {editable && onAdd && <Btn variant="primary" icon={FiPlus} onClick={onAdd}>{addLabel}</Btn>}
      </div>
      <ErrorNote message={error} onRetry={onRetry} className="mb-4" />
      {loading ? <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        : error ? null
        : count === 0 ? (
          <div className="rounded-xl border border-dashed border-fam-border px-6 py-10 text-center">
            <p className="text-base font-semibold text-fam-text">{emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-fam-muted">{emptyHint}</p>
            {editable && onAdd && <div className="mt-4 flex justify-center"><Btn variant="primary" icon={FiPlus} onClick={onAdd}>{addLabel}</Btn></div>}
          </div>
        ) : children}
    </div>
  );
}

function Row({ children, actions }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </li>
  );
}
const ROWS = "divide-y divide-fam-border rounded-xl border border-fam-border bg-fam-surface";

// Diálogo de alta genérico: maneja envío, error del servidor y bloqueo mientras guarda.
function AddModal({ title, submitLabel = "Agregar", validate, onSubmit, onClose, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const problem = validate?.();
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try { await onSubmit(); } catch (err) { setError(errorMessage(err, "No se pudo guardar.")); setBusy(false); }
  };
  return (
    <Modal open title={title} onClose={onClose} maxWidth="max-w-lg" disableClose={busy}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        <div className="space-y-4">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={busy}>{busy ? "Guardando…" : submitLabel}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function useRemove(remove, reload, onChanged) {
  const { showToast } = useUI();
  const [target, setTarget] = useState(null);
  const dialog = target && (
    <ConfirmDialog
      title={target.title}
      description={target.description}
      confirmLabel="Eliminar"
      danger
      onClose={() => setTarget(null)}
      onConfirm={async () => { await remove(target.id); setTarget(null); await reload(); onChanged?.(); showToast("Eliminado", "success"); }}
    />
  );
  return [setTarget, dialog];
}

// ─── Compradores ─────────────────────────────────────────────────────────────
export function StepBuyers({ bs, editable, redFlags, onChanged }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(() => fetchBuyingInfluences(bs.id), [bs.id]);
  const list = asList(data);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ full_name: "", job_title: "", influence_role: "economic_buyer", receptivity: "even_keel", access_level: "direct" });
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const [askRemove, removeDialog] = useRemove(deleteBuyingInfluence, reload, onChanged);
  const missingRoles = ["economic_buyer", "coach"].filter((r) => !list.some((b) => b.influence_role === r));

  return (
    <ListFrame
      title="Compradores"
      intro="Quiénes influyen en la decisión y qué papel juega cada uno. Hace falta al menos un comprador económico y un coach."
      count={list.length} addLabel="Agregar comprador" onAdd={() => setAdding(true)} editable={editable}
      loading={loading && !data} error={error} onRetry={reload}
      emptyTitle="Aún no hay compradores" emptyHint="Empieza por quien da la aprobación final (comprador económico) y por tu coach dentro de la cuenta."
    >
      {missingRoles.length > 0 && (
        <p className="mb-3 rounded-lg bg-fam-warning-bg px-3 py-2 text-[13px] text-fam-warning">Falta identificar: {missingRoles.map((r) => ROLES[r].toLowerCase()).join(" y ")}.</p>
      )}
      <ul className={ROWS}>
        {list.map((b) => (
          <Row
            key={b.id}
            actions={(
              <>
                <FlagToggle active={redFlags.isFlagged("buying_influence", b.id)} label={b.full_name} onClick={() => redFlags.toggle("buying_influence", b.id, `Red flag en influenciador: ${b.full_name}`)} />
                {editable && <Btn variant="ghost" size="sm" onClick={() => askRemove({ id: b.id, title: `Eliminar a ${b.full_name}`, description: "También se quitarán sus resultados y Wins registrados." })}>Eliminar</Btn>}
              </>
            )}
          >
            <p className="text-sm font-medium text-fam-text">{b.full_name}{b.job_title && <span className="font-normal text-fam-muted"> · {b.job_title}</span>}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="info">{ROLES[b.influence_role] || b.influence_role}</Badge>
              {b.receptivity && <Badge>{RECEPTIVITY[b.receptivity] || b.receptivity}</Badge>}
              {b.access_level && <Badge tone={b.access_level === "none" ? "danger" : b.access_level === "limited" ? "warning" : "neutral"}>Acceso {(ACCESS[b.access_level] || b.access_level).toLowerCase()}</Badge>}
            </div>
          </Row>
        ))}
      </ul>

      {adding && (
        <AddModal
          title="Agregar comprador"
          validate={() => (!form.full_name.trim() ? "Escribe el nombre." : "")}
          onClose={() => setAdding(false)}
          onSubmit={async () => {
            await createBuyingInfluence(bs.id, { ...form, full_name: form.full_name.trim(), job_title: form.job_title.trim() || null });
            setAdding(false);
            setForm({ full_name: "", job_title: "", influence_role: "economic_buyer", receptivity: "even_keel", access_level: "direct" });
            await reload(); onChanged?.(); showToast("Comprador agregado", "success");
          }}
        >
          <Field label="Nombre">{(p) => <TextInput {...p} value={form.full_name} onChange={set("full_name")} maxLength={255} autoFocus />}</Field>
          <Field label="Cargo" optional>{(p) => <TextInput {...p} value={form.job_title} onChange={set("job_title")} maxLength={150} />}</Field>
          <Field label="Rol en la decisión" hint={ROLE_HINTS[form.influence_role]}>
            {(p) => <SelectInput {...p} value={form.influence_role} onChange={set("influence_role")}>{Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectInput>}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cómo ve su situación">
              {(p) => <SelectInput {...p} value={form.receptivity} onChange={set("receptivity")}>{Object.entries(RECEPTIVITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectInput>}
            </Field>
            <Field label="Nuestro acceso">
              {(p) => <SelectInput {...p} value={form.access_level} onChange={set("access_level")}>{Object.entries(ACCESS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectInput>}
            </Field>
          </div>
        </AddModal>
      )}
      {removeDialog}
    </ListFrame>
  );
}

// ─── Resultados y Wins ───────────────────────────────────────────────────────
export function StepResults({ bs, editable, onChanged }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(
    async () => { const [results, buyers] = await Promise.all([fetchWinResults(bs.id), fetchBuyingInfluences(bs.id)]); return { results: asList(results), buyers: asList(buyers) }; },
    [bs.id],
  );
  const results = data?.results || [];
  const buyers = data?.buyers || [];
  const [adding, setAdding] = useState(null); // comprador para el que se agrega
  const [form, setForm] = useState({ result_type: "win", description: "", importance_level: "medium" });
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const [askRemove, removeDialog] = useRemove(deleteWinResult, reload, onChanged);
  const covered = buyers.filter((b) => results.some((r) => r.buying_influence_id === b.id && r.result_type === "win")).length;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-fam-text">Resultados y Wins {data && <span className="fam-numeric text-base font-normal text-fam-muted">{results.length}</span>}</h2>
        <p className="mt-1 max-w-2xl text-sm text-fam-muted">El Resultado es lo que gana la empresa del cliente; el Win, lo que gana cada persona. Sin un Win propio, ese comprador no está asegurado.</p>
      </div>
      <ErrorNote message={error} onRetry={reload} className="mb-4" />
      {loading && !data ? <Skeleton className="h-24 w-full" /> : error ? null : buyers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fam-border px-6 py-10 text-center">
          <p className="text-base font-semibold text-fam-text">Primero registra a los compradores</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-fam-muted">Los resultados y Wins se registran por comprador: agrégalos en el paso Compradores.</p>
        </div>
      ) : (
        <>
          <p className={cx("mb-3 text-sm", covered === buyers.length ? "text-fam-success" : "text-fam-warning")}>
            <span className="fam-numeric font-semibold">{covered} de {buyers.length}</span> compradores con Win propio registrado.
          </p>
          <ul className={ROWS}>
            {buyers.map((b) => {
              const own = results.filter((r) => r.buying_influence_id === b.id);
              const hasWin = own.some((r) => r.result_type === "win");
              return (
                <li key={b.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium text-fam-text">
                      {b.full_name} <span className="font-normal text-fam-muted">· {ROLES[b.influence_role] || b.influence_role}</span>
                      {!hasWin && <Badge tone="warning" className="ml-2">Sin Win</Badge>}
                    </p>
                    {editable && <Btn size="sm" icon={FiPlus} onClick={() => { setForm({ result_type: hasWin ? "result" : "win", description: "", importance_level: "medium" }); setAdding(b); }}>Agregar</Btn>}
                  </div>
                  {own.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {own.map((r) => (
                        <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-fam-canvas px-3 py-2">
                          <div className="min-w-0">
                            <div className="mb-0.5 flex flex-wrap gap-1.5">
                              <Badge tone={r.result_type === "win" ? "success" : "info"}>{r.result_type === "win" ? "Win" : "Resultado"}</Badge>
                              <Badge tone={levelTone(r.importance_level)}>Importancia {levelLabel(r.importance_level).toLowerCase()}</Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-fam-text">{r.description || r.result_description}</p>
                          </div>
                          {editable && <Btn variant="ghost" size="sm" onClick={() => askRemove({ id: r.id, title: "Eliminar este registro", description: r.description || r.result_description })}>Eliminar</Btn>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {adding && (
        <AddModal
          title={`Agregar para ${adding.full_name}`}
          validate={() => (!form.description.trim() ? "Describe el resultado o Win." : "")}
          onClose={() => setAdding(null)}
          onSubmit={async () => {
            await createWinResult(adding.id, { ...form, description: form.description.trim() });
            setAdding(null);
            await reload(); onChanged?.(); showToast("Registrado", "success");
          }}
        >
          <Field label="Tipo" hint={form.result_type === "win" ? "Lo que gana esta persona: reconocimiento, tranquilidad, un ascenso…" : "Lo que gana su empresa: menos costos, más capacidad, cumplimiento…"}>
            {(p) => (
              <SelectInput {...p} value={form.result_type} onChange={set("result_type")}>
                <option value="win">Win (personal)</option>
                <option value="result">Resultado (de la empresa)</option>
              </SelectInput>
            )}
          </Field>
          <Field label="Descripción">{(p) => <TextArea {...p} value={form.description} onChange={set("description")} autoFocus />}</Field>
          <Field label="Importancia para esta persona">
            {(p) => <SelectInput {...p} value={form.importance_level} onChange={set("importance_level")}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</SelectInput>}
          </Field>
        </AddModal>
      )}
      {removeDialog}
    </div>
  );
}

// ─── Competencia ─────────────────────────────────────────────────────────────
export function StepCompetitors({ bs, editable, redFlags, onChanged }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(() => fetchCompetitors(bs.id), [bs.id]);
  const list = asList(data);
  const [adding, setAdding] = useState(false);
  const empty = { competitor_name: "", threat_level: "medium", known_strengths: "", known_weaknesses: "" };
  const [form, setForm] = useState(empty);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const [askRemove, removeDialog] = useRemove(deleteCompetitor, reload, onChanged);

  return (
    <ListFrame
      title="Competencia"
      intro="Contra quién competimos en esta oportunidad, incluida la opción de que el cliente no haga nada."
      count={list.length} addLabel="Agregar competidor" onAdd={() => setAdding(true)} editable={editable}
      loading={loading && !data} error={error} onRetry={reload}
      emptyTitle="Aún no hay competidores" emptyHint="Registra al menos uno: el proveedor actual, otra marca o “no hacer nada”."
    >
      <ul className={ROWS}>
        {list.map((c) => (
          <Row
            key={c.id}
            actions={(
              <>
                <FlagToggle active={redFlags.isFlagged("competitor", c.id)} label={c.competitor_name} onClick={() => redFlags.toggle("competitor", c.id, `Competidor de riesgo: ${c.competitor_name}`)} />
                {editable && <Btn variant="ghost" size="sm" onClick={() => askRemove({ id: c.id, title: `Eliminar a ${c.competitor_name}` })}>Eliminar</Btn>}
              </>
            )}
          >
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fam-text">{c.competitor_name}<Badge tone={levelTone(c.threat_level)}>Amenaza {levelLabel(c.threat_level).toLowerCase()}</Badge></p>
            {c.known_strengths && <p className="mt-1 text-[13px] text-fam-muted"><span className="text-fam-text">Fortalezas:</span> {c.known_strengths}</p>}
            {c.known_weaknesses && <p className="mt-0.5 text-[13px] text-fam-muted"><span className="text-fam-text">Debilidades:</span> {c.known_weaknesses}</p>}
          </Row>
        ))}
      </ul>
      {adding && (
        <AddModal
          title="Agregar competidor"
          validate={() => (!form.competitor_name.trim() ? "Escribe el nombre del competidor." : "")}
          onClose={() => setAdding(false)}
          onSubmit={async () => {
            await createCompetitor(bs.id, { ...form, competitor_name: form.competitor_name.trim() });
            setAdding(false); setForm(empty);
            await reload(); onChanged?.(); showToast("Competidor agregado", "success");
          }}
        >
          <Field label="Nombre">{(p) => <TextInput {...p} value={form.competitor_name} onChange={set("competitor_name")} maxLength={200} autoFocus />}</Field>
          <Field label="Nivel de amenaza">
            {(p) => <SelectInput {...p} value={form.threat_level} onChange={set("threat_level")}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</SelectInput>}
          </Field>
          <Field label="Sus fortalezas" optional>{(p) => <TextArea {...p} rows={2} value={form.known_strengths} onChange={set("known_strengths")} />}</Field>
          <Field label="Sus debilidades" optional>{(p) => <TextArea {...p} rows={2} value={form.known_weaknesses} onChange={set("known_weaknesses")} />}</Field>
        </AddModal>
      )}
      {removeDialog}
    </ListFrame>
  );
}

// ─── Fortalezas ──────────────────────────────────────────────────────────────
export function StepStrengths({ bs, editable, onChanged }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(() => fetchStrengths(bs.id), [bs.id]);
  const list = asList(data);
  const [adding, setAdding] = useState(false);
  const empty = { strength_category: "", strength_description: "", relevance_score: 3 };
  const [form, setForm] = useState(empty);
  const [askRemove, removeDialog] = useRemove(deleteStrength, reload, onChanged);

  return (
    <ListFrame
      title="Fortalezas"
      intro="Lo que nos diferencia de verdad en esta oportunidad y que le importa a algún comprador."
      count={list.length} addLabel="Agregar fortaleza" onAdd={() => setAdding(true)} editable={editable}
      loading={loading && !data} error={error} onRetry={reload}
      emptyTitle="Aún no hay fortalezas" emptyHint="Una fortaleza solo cuenta si mejora nuestra posición frente a la competencia aquí, no en general."
    >
      <ul className={ROWS}>
        {list.map((s) => (
          <Row key={s.id} actions={editable && <Btn variant="ghost" size="sm" onClick={() => askRemove({ id: s.id, title: "Eliminar fortaleza", description: s.strength_description })}>Eliminar</Btn>}>
            <p className="text-sm text-fam-text">{s.strength_description}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {s.strength_category && <Badge>{s.strength_category}</Badge>}
              <Badge tone={Number(s.relevance_score) >= 4 ? "success" : "neutral"}>Relevancia {Number(s.relevance_score) || 0} de 5</Badge>
            </div>
          </Row>
        ))}
      </ul>
      {adding && (
        <AddModal
          title="Agregar fortaleza"
          validate={() => (!form.strength_description.trim() ? "Describe la fortaleza." : "")}
          onClose={() => setAdding(false)}
          onSubmit={async () => {
            await createStrength(bs.id, { ...form, strength_description: form.strength_description.trim(), strength_category: form.strength_category.trim() || null });
            setAdding(false); setForm(empty);
            await reload(); onChanged?.(); showToast("Fortaleza agregada", "success");
          }}
        >
          <Field label="Descripción">{(p) => <TextArea {...p} value={form.strength_description} onChange={(e) => setForm((f) => ({ ...f, strength_description: e.target.value }))} autoFocus />}</Field>
          <Field label="Categoría" optional>{(p) => <TextInput {...p} value={form.strength_category} onChange={(e) => setForm((f) => ({ ...f, strength_category: e.target.value }))} maxLength={100} placeholder="Servicio, producto, precio, relación…" />}</Field>
          <Field label="Relevancia para el cliente">
            {(p) => (
              <SelectInput {...p} value={form.relevance_score} onChange={(e) => setForm((f) => ({ ...f, relevance_score: Number(e.target.value) }))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} de 5</option>)}
              </SelectInput>
            )}
          </Field>
        </AddModal>
      )}
      {removeDialog}
    </ListFrame>
  );
}

// ─── Red flags ───────────────────────────────────────────────────────────────
export function StepRedFlags({ bs, editable, canAccept, onChanged }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(() => fetchRedFlags(bs.id), [bs.id]);
  const list = asList(data);
  const [adding, setAdding] = useState(false);
  const empty = { flag_description: "", severity: "medium", mitigation_plan: "" };
  const [form, setForm] = useState(empty);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const [askRemove, removeDialog] = useRemove(deleteRedFlag, reload, onChanged);
  const [accepting, setAccepting] = useState(null);
  const openCritical = list.filter((f) => f.severity === "critical" && f.status === "open").length;

  const accept = async (flag) => {
    setAccepting(flag.id);
    try { await acceptRedFlag(flag.id, { mitigation_plan: flag.mitigation_plan || "Riesgo aceptado" }); await reload(); onChanged?.(); showToast("Red flag aceptada", "success"); }
    catch (err) { showToast(errorMessage(err, "No se pudo aceptar la red flag."), "error"); }
    finally { setAccepting(null); }
  };

  return (
    <ListFrame
      title="Red flags"
      intro="Lo que puede hacernos perder: información que falta, compradores sin cubrir, dudas sin resolver. Una red flag crítica abierta impide aprobar el Blue Sheet."
      count={list.length} addLabel="Agregar red flag" onAdd={() => setAdding(true)} editable={editable}
      loading={loading && !data} error={error} onRetry={reload}
      emptyTitle="Sin red flags" emptyHint="Si de verdad no hay ninguna, perfecto. Si dudas, regístrala: es mejor una alerta de más que una sorpresa."
    >
      {openCritical > 0 && <p className="mb-3 rounded-lg bg-fam-danger-bg px-3 py-2 text-[13px] text-fam-danger">{openCritical} red flag(s) crítica(s) abierta(s): hay que resolverlas o aceptarlas antes de aprobar.</p>}
      <ul className={ROWS}>
        {list.map((f) => (
          <Row
            key={f.id}
            actions={(
              <>
                {canAccept && f.status === "open" && <Btn size="sm" icon={FiCheck} loading={accepting === f.id} onClick={() => accept(f)}>Aceptar riesgo</Btn>}
                {editable && <Btn variant="ghost" size="sm" onClick={() => askRemove({ id: f.id, title: "Eliminar red flag", description: f.flag_description || f.flag_title })}>Eliminar</Btn>}
              </>
            )}
          >
            <p className="text-sm text-fam-text">{f.flag_description || f.flag_title}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={levelTone(f.severity)}>Severidad {levelLabel(f.severity).toLowerCase()}</Badge>
              <Badge tone={f.status === "open" ? "warning" : "success"}>{f.status === "open" ? "Abierta" : f.status === "accepted" ? "Aceptada" : f.status === "resolved" ? "Resuelta" : f.status}</Badge>
              {f.related_entity_type && <Badge>Marcada en {ELEMENT_LABELS[f.related_entity_type] || f.related_entity_type}</Badge>}
            </div>
            {f.mitigation_plan && <p className="mt-1.5 text-[13px] text-fam-muted"><span className="text-fam-text">Mitigación:</span> {f.mitigation_plan}</p>}
          </Row>
        ))}
      </ul>
      {adding && (
        <AddModal
          title="Agregar red flag"
          validate={() => (!form.flag_description.trim() ? "Describe la red flag." : "")}
          onClose={() => setAdding(false)}
          onSubmit={async () => {
            await createRedFlag(bs.id, { ...form, flag_description: form.flag_description.trim(), mitigation_plan: form.mitigation_plan.trim() || null });
            setAdding(false); setForm(empty);
            await reload(); onChanged?.(); showToast("Red flag agregada", "success");
          }}
        >
          <Field label="Qué puede salir mal">{(p) => <TextArea {...p} value={form.flag_description} onChange={set("flag_description")} autoFocus />}</Field>
          <Field label="Severidad">
            {(p) => <SelectInput {...p} value={form.severity} onChange={set("severity")}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</SelectInput>}
          </Field>
          <Field label="Plan de mitigación" optional>{(p) => <TextArea {...p} rows={2} value={form.mitigation_plan} onChange={set("mitigation_plan")} />}</Field>
        </AddModal>
      )}
      {removeDialog}
    </ListFrame>
  );
}

// ─── Acciones ────────────────────────────────────────────────────────────────
const PRIORITIES = [{ value: "low", label: "Baja" }, { value: "medium", label: "Media" }, { value: "high", label: "Alta" }, { value: "urgent", label: "Urgente" }];
const priorityLabel = (v) => PRIORITIES.find((p) => p.value === v)?.label || v;

export function StepActions({ bs, editable, redFlags, onChanged }) {
  const { showToast } = useUI();
  const advisors = useAdvisors();
  const { loading, data, error, reload } = useLoad(() => fetchActionItems(bs.id), [bs.id]);
  const list = asList(data);
  const [adding, setAdding] = useState(false);
  const empty = { title: "", priority: "medium", due_date: "", owner_user_id: "" };
  const [form, setForm] = useState(empty);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const [askRemove, removeDialog] = useRemove(deleteActionItem, reload, onChanged);
  const [completing, setCompleting] = useState(null);
  const isOpen = (a) => !["completed", "cancelled"].includes(a.status);
  const sorted = [...list].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)));

  const complete = async (a) => {
    setCompleting(a.id);
    try { await completeActionItem(a.id, {}); await reload(); onChanged?.(); showToast("Acción completada", "success"); }
    catch (err) { showToast(errorMessage(err, "No se pudo completar. Solo su responsable o un manager puede hacerlo."), "error"); }
    finally { setCompleting(null); }
  };

  return (
    <ListFrame
      title="Acciones"
      intro="Los próximos pasos concretos para mejorar nuestra posición, con responsable y fecha. Hace falta al menos una para enviar a revisión."
      count={list.length} addLabel="Agregar acción" onAdd={() => setAdding(true)} editable={editable}
      loading={loading && !data} error={error} onRetry={reload}
      emptyTitle="Aún no hay acciones" emptyHint="Convierte cada red flag o hueco de cobertura en una acción con dueño y fecha."
    >
      <ul className={ROWS}>
        {sorted.map((a) => {
          const open = isOpen(a);
          const late = open && a.due_date && daysFromToday(a.due_date) < 0;
          const flagged = redFlags.isFlagged("action_item", a.id);
          return (
            <Row
              key={a.id}
              actions={(
                <>
                  <FlagToggle active={flagged} suggested={late && !flagged} label={a.title} onClick={() => redFlags.toggle("action_item", a.id, `Tarea vencida: ${a.title}`)} />
                  {open && <Btn size="sm" icon={FiCheck} loading={completing === a.id} onClick={() => complete(a)}>Completar</Btn>}
                  {editable && <Btn variant="ghost" size="sm" onClick={() => askRemove({ id: a.id, title: "Eliminar acción", description: a.title })}>Eliminar</Btn>}
                </>
              )}
            >
              <p className={cx("text-sm font-medium", open ? "text-fam-text" : "text-fam-muted line-through")}>{a.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-fam-muted">
                <Badge tone={a.priority === "urgent" || a.priority === "high" ? "warning" : "neutral"}>Prioridad {priorityLabel(a.priority).toLowerCase()}</Badge>
                {!open && <Badge tone="success">Completada</Badge>}
                {a.owner_name && <span>{a.owner_name}</span>}
                {a.due_date && <span className={late ? "font-medium text-fam-danger" : undefined}>· {late ? `venció ${relativeDay(a.due_date)}` : `vence ${date(a.due_date)}`}</span>}
              </div>
            </Row>
          );
        })}
      </ul>
      {adding && (
        <AddModal
          title="Agregar acción"
          validate={() => (!form.title.trim() ? "Escribe qué hay que hacer." : "")}
          onClose={() => setAdding(false)}
          onSubmit={async () => {
            await createActionItem(bs.id, {
              title: form.title.trim(), priority: form.priority,
              ...(form.due_date ? { due_date: form.due_date } : {}),
              ...(form.owner_user_id ? { owner_user_id: Number(form.owner_user_id) } : {}),
            });
            setAdding(false); setForm(empty);
            await reload(); onChanged?.(); showToast("Acción agregada", "success");
          }}
        >
          <Field label="Qué hay que hacer">{(p) => <TextInput {...p} value={form.title} onChange={set("title")} maxLength={255} autoFocus placeholder="Reunión con el comprador económico para validar presupuesto" />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prioridad">
              {(p) => <SelectInput {...p} value={form.priority} onChange={set("priority")}>{PRIORITIES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</SelectInput>}
            </Field>
            <Field label="Fecha límite" optional>{(p) => <TextInput {...p} type="date" value={form.due_date} onChange={set("due_date")} />}</Field>
          </div>
          <Field label="Responsable" optional>
            {(p) => (
              <SelectInput {...p} value={form.owner_user_id} onChange={set("owner_user_id")}>
                <option value="">Yo mismo</option>
                {advisors.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.email}</option>)}
              </SelectInput>
            )}
          </Field>
        </AddModal>
      )}
      {removeDialog}
    </ListFrame>
  );
}

// Re-exportado para el resumen de requisitos de envío.
export function useBlueSheetCounts(bsId, refreshKey) {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    if (!bsId) return undefined;
    let cancelled = false;
    Promise.allSettled([fetchBuyingInfluences(bsId), fetchActionItems(bsId)]).then(([b, a]) => {
      if (cancelled) return;
      setCounts({ buyers: b.status === "fulfilled" ? asList(b.value).length : 0, actions: a.status === "fulfilled" ? asList(a.value).length : 0 });
    });
    return () => { cancelled = true; };
  }, [bsId, refreshKey]);
  return counts;
}
