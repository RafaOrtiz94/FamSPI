import { useCallback, useEffect, useState } from "react";
import {
  acceptSwotSuggestion,
  createSwotItem,
  createSwotVersion,
  deleteSwotItem,
  dismissSwotSuggestion,
  fetchAccountSwot,
  fetchSwotVersion,
  fetchSwotVersions,
  updateSwotItem,
} from "../../../core/api/crmFamApi";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import { ConfirmDialog, ReasonDialog } from "../ui/dialogs";

const QUADRANTS = [
  { key: "strength", label: "Fortalezas", hint: "Lo que juega a favor en la cuenta", tone: "border-fam-success bg-fam-success-bg", text: "text-fam-success" },
  { key: "opportunity", label: "Oportunidades", hint: "Espacio para crecer", tone: "border-fam-action bg-fam-selected", text: "text-fam-action" },
  { key: "weakness", label: "Debilidades", hint: "Lo que hay que corregir", tone: "border-fam-warning bg-fam-warning-bg", text: "text-fam-warning" },
  { key: "threat", label: "Amenazas", hint: "Riesgos externos o de cierre", tone: "border-fam-danger-solid bg-fam-danger-bg", text: "text-fam-danger" },
];
const QUADRANT_BY_KEY = Object.fromEntries(QUADRANTS.map((q) => [q.key, q]));
const IMPACT_LABEL = { high: "Impacto alto", medium: "Impacto medio", low: "Impacto bajo" };
const IMPACT_CLS = {
  high: "bg-fam-danger-bg text-fam-danger",
  medium: "bg-fam-warning-bg text-fam-warning",
  low: "bg-fam-subtle text-fam-muted",
};

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;
const inputCls = "w-full rounded-md border border-fam-border px-3 py-1.5 text-sm text-fam-text focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";
const btnGhost = "rounded-md border border-fam-border px-2.5 py-1 text-xs font-medium text-fam-text hover:bg-fam-subtle disabled:opacity-60";

function ImpactChip({ impact }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IMPACT_CLS[impact] || IMPACT_CLS.medium}`}>{IMPACT_LABEL[impact] || impact}</span>;
}

// ─── Una tarjeta de cuadrante con alta manual y edición en línea ─────────────
function Quadrant({ q, items, busy, planId, planName, onCreate, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", impact: "medium", scope: "account" });
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ title: "", impact: "medium" });

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const ok = await onCreate({
      quadrant: q.key, title: draft.title, impact: draft.impact,
      ...(draft.scope === "plan" && planId ? { plan_id: planId } : {}),
    });
    if (ok) { setAdding(false); setDraft({ title: "", impact: "medium", scope: "account" }); }
  };

  const saveEdit = async (item) => {
    const ok = await onUpdate(item.id, { title: edit.title, impact: edit.impact });
    if (ok) setEditingId(null);
  };

  return (
    <section className={`rounded-xl border-l-4 border border-fam-border bg-fam-surface p-4 ${q.tone.split(" ")[0]}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className={`text-sm font-semibold ${q.text}`}>{q.label} <span className="font-normal text-fam-muted">({items.length})</span></h3>
          <p className="text-xs text-fam-muted">{q.hint}</p>
        </div>
        {!adding && <button type="button" onClick={() => setAdding(true)} className={btnGhost}>+ Agregar</button>}
      </div>

      {adding && (
        <form onSubmit={submit} className="mb-3 space-y-2 rounded-lg bg-fam-subtle p-3">
          <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} className={inputCls} placeholder={`Nueva ${q.label.toLowerCase().slice(0, -1)}…`} />
          <div className="flex flex-wrap gap-2">
            <select value={draft.impact} onChange={(e) => setDraft({ ...draft, impact: e.target.value })} className={`${inputCls} w-auto`}>
              <option value="high">Impacto alto</option><option value="medium">Impacto medio</option><option value="low">Impacto bajo</option>
            </select>
            {planId && (
              <select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} className={`${inputCls} w-auto`}>
                <option value="account">Toda la cuenta</option>
                <option value="plan">Solo el plan{planName ? `: ${planName}` : ""}</option>
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className={btnGhost}>Cancelar</button>
            <button type="submit" disabled={busy} className="rounded-md bg-fam-action px-3 py-1 text-xs font-medium text-fam-on-action hover:bg-fam-action-hover disabled:opacity-60">Guardar</button>
          </div>
        </form>
      )}

      {items.length === 0 && !adding ? (
        <p className="text-xs text-fam-muted">Sin elementos todavía.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-fam-border px-3 py-2">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={200} className={inputCls} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select value={edit.impact} onChange={(e) => setEdit({ ...edit, impact: e.target.value })} className={`${inputCls} w-auto`}>
                      <option value="high">Impacto alto</option><option value="medium">Impacto medio</option><option value="low">Impacto bajo</option>
                    </select>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className={btnGhost}>Cancelar</button>
                      <button type="button" onClick={() => saveEdit(item)} disabled={busy} className="rounded-md bg-fam-action px-3 py-1 text-xs font-medium text-fam-on-action disabled:opacity-60">Guardar</button>
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-fam-text">{item.title}</p>
                  {item.description && <p className="mt-0.5 text-xs text-fam-muted">{item.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ImpactChip impact={item.impact} />
                    <span className="rounded-full bg-fam-subtle px-2 py-0.5 text-[10px] font-semibold text-fam-muted">{item.source === "auto" ? "Sugerido" : "Manual"}</span>
                    {item.plan_name && <span className="rounded-full bg-fam-selected px-2 py-0.5 text-[10px] font-semibold text-fam-action">Plan: {item.plan_name}</span>}
                    <span className="ml-auto flex gap-3 text-xs">
                      <button type="button" onClick={() => { setEditingId(item.id); setEdit({ title: item.title, impact: item.impact }); }} className="text-fam-action hover:underline">Editar</button>
                      <button type="button" onClick={() => onDelete(item)} className="text-fam-danger hover:underline">Quitar</button>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Historial de versiones ──────────────────────────────────────────────────
function VersionsModal({ accountId, versions, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  const open = async (v) => {
    setError("");
    try { setDetail(await fetchSwotVersion(accountId, v.id)); }
    catch (err) { setError(errMsg(err, "No se pudo abrir la versión")); }
  };

  const group = (list) => QUADRANTS.map((q) => ({ q, rows: (list || []).filter((i) => i.quadrant === q.key) }));

  return (
    <Modal open title="Historial del FODA" onClose={onClose} maxWidth="max-w-3xl" closeOnBackdrop>
        {error && <p className="mb-3 text-sm text-fam-danger">{error}</p>}
        {versions.length === 0 ? (
          <p className="text-sm text-fam-muted">Aún no hay versiones guardadas.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => open(v)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${detail?.id === v.id ? "border-fam-action bg-fam-selected" : "border-fam-border hover:bg-fam-subtle"}`}
                  >
                    <span className="font-semibold text-fam-text">Versión {v.version_number}</span>
                    <span className="block text-xs text-fam-muted">
                      {new Date(v.created_at).toLocaleDateString("es-EC", { year: "numeric", month: "short", day: "numeric" })} · {v.item_count} elem.
                    </span>
                    {v.note && <span className="block text-xs text-fam-muted">{v.note}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div>
              {!detail ? (
                <p className="text-sm text-fam-muted">Selecciona una versión para ver su contenido y qué cambió desde entonces.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-fam-muted">Guardada por {detail.created_by_name || "—"}.</p>
                  {group(detail.snapshot).map(({ q, rows }) => rows.length > 0 && (
                    <div key={q.key} className="mb-3">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${q.text}`}>{q.label}</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-fam-text">{rows.map((r, i) => <li key={i}>{r.title}</li>)}</ul>
                    </div>
                  ))}
                  <div className="mt-4 rounded-lg bg-fam-subtle p-3 text-sm">
                    <p className="font-semibold text-fam-text">Cambios desde esta versión</p>
                    {detail.changes_since.added.length === 0 && detail.changes_since.removed.length === 0 && <p className="mt-1 text-xs text-fam-muted">Sin cambios.</p>}
                    {detail.changes_since.added.map((i, k) => <p key={`a${k}`} className="mt-1 text-xs text-fam-success">+ {QUADRANT_BY_KEY[i.quadrant]?.label}: {i.title}</p>)}
                    {detail.changes_since.removed.map((i, k) => <p key={`r${k}`} className="mt-1 text-xs text-fam-danger">− {QUADRANT_BY_KEY[i.quadrant]?.label}: {i.title}</p>)}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
    </Modal>
  );
}

// ─── Tarjeta principal ───────────────────────────────────────────────────────
export default function AccountSwotCard({ accountId, planId }) {
  const { showToast } = useUI();
  const [data, setData] = useState({ items: [], suggestions: [], plan: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState(null); // null = modal cerrado
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [versioning, setVersioning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      setData(await fetchAccountSwot(accountId, planId ? { plan_id: planId } : {}));
    } catch (err) { setError(errMsg(err, "No se pudo cargar el FODA")); }
    finally { setLoading(false); }
  }, [accountId, planId]);

  useEffect(() => { load(); }, [load]);

  // Ejecuta una accion de escritura y recarga; devuelve true si salió bien.
  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      if (okMessage) showToast(okMessage, "success");
      await load();
      return true;
    } catch (err) {
      showToast(errMsg(err, "No se pudo completar la acción"), "error");
      return false;
    } finally { setBusy(false); }
  };

  const planName = data.plan?.name || "";
  const effectivePlanId = planId || data.plan?.id || null;

  // plan_id es el contexto con el que se calcularon las sugerencias; el servidor decide a qué se liga.
  const accept = (s) => run(() => acceptSwotSuggestion(accountId, { source_key: s.source_key, plan_id: planId || undefined }), "Agregado al FODA");
  const dismiss = (s) => run(() => dismissSwotSuggestion(accountId, { source_key: s.source_key, plan_id: planId || undefined }));
  const create = (payload) => run(() => createSwotItem(accountId, payload), "Elemento agregado");
  const update = (id, payload) => run(() => updateSwotItem(accountId, id, payload), "Elemento actualizado");
  const remove = (item) => setRemoving(item);
  const saveVersion = () => setVersioning(true);

  const openHistory = async () => {
    try { setVersions(await fetchSwotVersions(accountId)); }
    catch (err) { showToast(errMsg(err, "No se pudo cargar el historial"), "error"); }
  };

  const byQuadrant = (key) => data.items.filter((i) => i.quadrant === key);

  return (
    <div className="mb-6 rounded-xl border border-fam-border bg-fam-surface p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-fam-text">Análisis FODA de la cuenta</h2>
          <p className="text-xs text-fam-muted">El CRM sugiere elementos a partir del historial, el Blue Sheet y las actividades; tú decides cuáles aplican.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={saveVersion} disabled={busy || data.items.length === 0} className={btnGhost}>Guardar versión</button>
          <button type="button" onClick={openHistory} className={btnGhost}>Historial</button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-fam-danger">{error}</p>}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-fam-action border-t-transparent" />
        </div>
      ) : (
        <>
          {data.suggestions.length > 0 && (
            <div className="mb-5 rounded-xl border border-fam-border bg-fam-canvas p-4">
              <button type="button" onClick={() => setShowSuggestions((v) => !v)} className="flex w-full items-center justify-between text-left">
                <span className="text-sm font-semibold text-fam-text">Sugerencias del CRM ({data.suggestions.length})</span>
                <span className="text-xs text-fam-muted">{showSuggestions ? "Ocultar" : "Mostrar"}</span>
              </button>
              {showSuggestions && (
                <ul className="mt-3 space-y-2">
                  {data.suggestions.map((s) => {
                    const q = QUADRANT_BY_KEY[s.quadrant];
                    return (
                      <li key={s.source_key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fam-border bg-fam-surface px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-fam-text">
                            <span className={`mr-2 text-[10px] font-semibold uppercase tracking-wide ${q.text}`}>{q.label.slice(0, -1)}</span>
                            {s.title}
                          </p>
                          {s.description && <p className="text-xs text-fam-muted">{s.description}</p>}
                          <div className="mt-1"><ImpactChip impact={s.impact} /></div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => accept(s)} disabled={busy} className="rounded-md bg-fam-action px-3 py-1 text-xs font-medium text-fam-on-action hover:bg-fam-action-hover disabled:opacity-60">Aceptar</button>
                          <button type="button" onClick={() => dismiss(s)} disabled={busy} className={btnGhost}>Descartar</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {QUADRANTS.map((q) => (
              <Quadrant
                key={q.key}
                q={q}
                items={byQuadrant(q.key)}
                busy={busy}
                planId={effectivePlanId}
                planName={planName}
                onCreate={create}
                onUpdate={update}
                onDelete={remove}
              />
            ))}
          </div>
        </>
      )}

      {versions && <VersionsModal accountId={accountId} versions={versions} onClose={() => setVersions(null)} />}
      {removing && (
        <ConfirmDialog
          title="Quitar del FODA"
          description={`“${removing.title}”${removing.source === "auto" ? " es una sugerencia del CRM: al quitarla no volverá a proponerse." : " se eliminará del análisis."}`}
          confirmLabel="Quitar"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => { await deleteSwotItem(accountId, removing.id); setRemoving(null); await load(); }}
        />
      )}
      {versioning && (
        <ReasonDialog
          title="Guardar versión del FODA"
          description="Guarda una foto del análisis actual para comparar más adelante qué cambió."
          label="Nota"
          placeholder="Revisión trimestral, tras la visita, cambio de plan…"
          confirmLabel="Guardar versión"
          onClose={() => setVersioning(false)}
          onConfirm={async (note) => {
            await createSwotVersion(accountId, { note: note || undefined, plan_id: planId || undefined });
            setVersioning(false);
            showToast("Versión guardada", "success");
          }}
        />
      )}
    </div>
  );
}
