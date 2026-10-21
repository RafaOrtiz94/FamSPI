// Scorecard (calificación ponderada, con guardado automático) y paso de Revisión (requisitos para
// enviar, comentarios del equipo e historial de versiones).
import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import {
  createReviewComment, fetchBlueSheetScorecard, fetchBlueSheetVersions, fetchReviewComments, resolveReviewComment,
  saveBlueSheetScorecard,
} from "../../../../core/api/crmFamApi";
import { useUI } from "../../../../core/ui/UIContext";
import { Badge, Btn, cx, DataTable, ErrorNote, Field, SelectInput, Skeleton, TextArea } from "../../ui/kit";
import { date, errorMessage } from "../../ui/format";
import { useLoad } from "../../ui/useLoad";
import { FlagToggle, levelLabel, levelTone, SaveStatus, STEPS, useAutosave } from "./shared";

const SCORE_HINTS = ["Sin evidencia", "Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"];

// ─── Scorecard ───────────────────────────────────────────────────────────────
function ScorecardForm({ bs, criteria, initial, editable, redFlags, onSaved }) {
  const [answers, setAnswers] = useState(initial);
  const [serverScore, setServerScore] = useState(null);
  const autosave = useAutosave(answers, async (v) => {
    const res = await saveBlueSheetScorecard(bs.id, { answers: Object.entries(v).map(([criterion_id, score]) => ({ criterion_id, score })) });
    setServerScore(res?.score ?? null);
    onSaved();
  }, { enabled: editable, delay: 700 });

  const answered = Object.keys(answers).length;
  // Mismo cálculo ponderado que el servidor, para mostrar el avance sin esperar al guardado.
  const localScore = useMemo(() => {
    const totalWeight = criteria.reduce((s, c) => s + Number(c.weight || 0), 0);
    if (!totalWeight) return 0;
    const sum = criteria.reduce((s, c) => s + ((Number(answers[c.id]) || 0) / 5) * Number(c.weight || 0), 0);
    return Math.min(100, Math.round((sum / totalWeight) * 100));
  }, [criteria, answers]);
  const score = autosave.dirty || serverScore === null ? localScore : Math.round(Number(serverScore));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-fam-text">Scorecard</h2>
          <p className="mt-1 max-w-2xl text-sm text-fam-muted">Califica de 0 a 5 qué tan bien estamos en cada criterio. Cuenta para la salud del negocio; con cinco criterios calificados ya suma a la completitud.</p>
        </div>
        <SaveStatus autosave={autosave} editable={editable} />
      </div>

      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-xl bg-fam-selected px-4 py-3">
        <p className="fam-numeric text-2xl font-semibold tracking-tight text-fam-text">{score}<span className="text-base font-normal text-fam-muted"> / 100</span></p>
        <p className="text-[13px] text-fam-muted">{answered} de {criteria.length} criterios calificados</p>
      </div>

      <ul className="divide-y divide-fam-border rounded-xl border border-fam-border bg-fam-surface">
        {criteria.map((c) => {
          const value = answers[c.id];
          return (
            <li key={c.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fam-text">{c.criterion_name}</p>
                  {c.criterion_description && <p className="mt-0.5 text-[13px] text-fam-muted">{c.criterion_description}</p>}
                </div>
                <FlagToggle active={redFlags.isFlagged("scorecard_criterion", c.id)} label={c.criterion_name} onClick={() => redFlags.toggle("scorecard_criterion", c.id, `Respuesta baja en scorecard: ${c.criterion_name}`)} />
              </div>
              <div role="radiogroup" aria-label={`Calificación de ${c.criterion_name}`} className="mt-2 flex flex-wrap items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={`${n}: ${SCORE_HINTS[n]}`}
                    title={SCORE_HINTS[n]}
                    disabled={!editable}
                    onClick={() => setAnswers((a) => ({ ...a, [c.id]: n }))}
                    className={cx(
                      "fam-numeric inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors duration-100 disabled:cursor-not-allowed",
                      value === n ? "border-fam-action bg-fam-action text-fam-on-action" : "border-fam-border bg-fam-surface text-fam-text hover:bg-fam-subtle disabled:opacity-60",
                    )}
                  >
                    {n}
                  </button>
                ))}
                <span className="ml-2 text-[13px] text-fam-muted">{value === undefined ? "Sin calificar" : SCORE_HINTS[value]}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StepScorecard({ bs, editable, redFlags, onSaved }) {
  const { loading, data, error, reload } = useLoad(() => fetchBlueSheetScorecard(bs.id), [bs.id]);
  if (loading && !data) return <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  const criteria = Array.isArray(data?.criteria) ? data.criteria : [];
  if (!criteria.length) {
    return (
      <div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-fam-text">Scorecard</h2>
        <p className="text-sm text-fam-muted">No hay criterios de scorecard configurados. Un administrador puede crearlos en Configuración del CRM.</p>
      </div>
    );
  }
  const initial = Object.fromEntries((data.answers || []).map((a) => [a.criterion_id, Number(a.score)]));
  return <ScorecardForm key={bs.id} bs={bs} criteria={criteria} initial={initial} editable={editable} redFlags={redFlags} onSaved={onSaved} />;
}

// ─── Revisión ────────────────────────────────────────────────────────────────
const SECTION_OPTIONS = [{ value: "", label: "Todo el Blue Sheet" }, ...STEPS.filter((s) => s.id !== "revision").map((s) => ({ value: s.id, label: s.label }))];
// Secciones guardadas con las claves de la pantalla anterior.
const LEGACY_SECTIONS = { general: "Objetivo y situación", buyers: "Compradores", results: "Resultados y Wins", competitors: "Competencia", strengths: "Fortalezas", scorecard: "Scorecard", actions: "Acciones" };
const sectionLabel = (value) => SECTION_OPTIONS.find((o) => o.value === value)?.label || LEGACY_SECTIONS[value] || value;

export function StepReview({ bs, editable, requirements, counts, onGoTo }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(
    async () => {
      const [comments, versions] = await Promise.allSettled([fetchReviewComments(bs.id), fetchBlueSheetVersions(bs.id)]);
      return {
        comments: comments.status === "fulfilled" && Array.isArray(comments.value) ? comments.value : [],
        versions: versions.status === "fulfilled" && Array.isArray(versions.value) ? versions.value : [],
      };
    },
    [bs.id, bs.status],
  );
  const [draft, setDraft] = useState({ section_name: "", comment_text: "" });
  const [posting, setPosting] = useState(false);
  const [resolving, setResolving] = useState(null);
  const comments = data?.comments || [];
  const versions = data?.versions || [];
  const ordered = [...comments.filter((c) => !c.is_resolved), ...comments.filter((c) => c.is_resolved)];

  useEffect(() => { setDraft({ section_name: "", comment_text: "" }); }, [bs.id]);

  const post = async () => {
    setPosting(true);
    try {
      await createReviewComment(bs.id, { section_name: draft.section_name || null, comment_text: draft.comment_text.trim() });
      setDraft({ section_name: "", comment_text: "" });
      await reload();
    } catch (err) { showToast(errorMessage(err, "No se pudo guardar el comentario."), "error"); }
    finally { setPosting(false); }
  };
  const resolve = async (c) => {
    setResolving(c.id);
    try { await resolveReviewComment(bs.id, c.id); await reload(); }
    catch (err) { showToast(errorMessage(err, "No se pudo marcar como resuelto."), "error"); }
    finally { setResolving(null); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fam-text">Revisión</h2>
        <p className="mt-1 max-w-2xl text-sm text-fam-muted">Lo mínimo para enviar el Blue Sheet a tu jefe, los comentarios del equipo y las versiones aprobadas.</p>
      </div>

      <section aria-label="Requisitos para enviar a revisión">
        <h3 className="mb-2 text-base font-semibold text-fam-text">Para enviar a revisión</h3>
        <ul className="divide-y divide-fam-border rounded-xl border border-fam-border bg-fam-surface">
          {requirements.map((r) => (
            <li key={r.label} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
              <span className={cx("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full", r.met ? "bg-fam-success-bg text-fam-success" : "bg-fam-subtle text-fam-muted")}>
                {r.met ? <FiCheck className="h-3 w-3" aria-hidden="true" /> : <FiX className="h-3 w-3" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1 text-sm text-fam-text">{r.label}<span className="sr-only">{r.met ? " (cumplido)" : " (pendiente)"}</span></span>
              {!r.met && r.step && <Btn variant="link" onClick={() => onGoTo(r.step)}>Completar</Btn>}
            </li>
          ))}
        </ul>
        {counts === null && <p className="mt-2 text-[13px] text-fam-muted">Verificando compradores y acciones…</p>}
      </section>

      <section aria-label="Comentarios del equipo">
        <h3 className="mb-2 text-base font-semibold text-fam-text">Comentarios <span className="fam-numeric text-sm font-normal text-fam-muted">{comments.filter((c) => !c.is_resolved).length} pendiente(s)</span></h3>
        <ErrorNote message={error} onRetry={reload} className="mb-3" />
        <div className="mb-4 rounded-xl border border-fam-border bg-fam-surface p-4">
          <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <Field label="Sección">
              {(p) => <SelectInput {...p} value={draft.section_name} onChange={(e) => setDraft((d) => ({ ...d, section_name: e.target.value }))}>{SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectInput>}
            </Field>
            <Field label="Comentario">
              {(p) => <TextArea {...p} rows={2} value={draft.comment_text} onChange={(e) => setDraft((d) => ({ ...d, comment_text: e.target.value }))} placeholder="Una nota para el equipo sobre esta sección." />}
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Btn variant="primary" size="sm" loading={posting} disabled={!draft.comment_text.trim()} onClick={post}>{posting ? "Guardando…" : "Comentar"}</Btn>
          </div>
        </div>
        {loading && !data ? <Skeleton className="h-16 w-full" /> : ordered.length === 0 ? (
          <p className="text-sm text-fam-muted">Sin comentarios todavía.</p>
        ) : (
          <ul className="divide-y divide-fam-border rounded-xl border border-fam-border bg-fam-surface">
            {ordered.map((c) => (
              <li key={c.id} className={cx("flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5", c.is_resolved && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {c.section_name && <Badge>{sectionLabel(c.section_name)}</Badge>}
                    {c.severity && c.severity !== "info" && <Badge tone={levelTone(c.severity)}>Severidad {levelLabel(c.severity).toLowerCase()}</Badge>}
                    {c.requires_correction && !c.is_resolved && <Badge tone="danger">Requiere corrección</Badge>}
                    {c.is_resolved && <Badge tone="success">Resuelto</Badge>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-fam-text">{c.comment_text}</p>
                  <p className="mt-1 text-xs text-fam-muted">{c.created_by_name || "—"} · <span className="fam-numeric">{date(c.created_at)}</span></p>
                </div>
                {!c.is_resolved && editable && <Btn size="sm" loading={resolving === c.id} onClick={() => resolve(c)}>Marcar resuelto</Btn>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Historial de versiones">
        <h3 className="mb-2 text-base font-semibold text-fam-text">Versiones aprobadas</h3>
        {loading && !data ? <Skeleton className="h-12 w-full" /> : versions.length === 0 ? (
          <p className="text-sm text-fam-muted">Aún no hay versiones: se guarda una cada vez que el Blue Sheet es aprobado.</p>
        ) : (
          <div className="rounded-xl border border-fam-border bg-fam-surface">
            <DataTable
              caption="Versiones aprobadas"
              columns={[
                { key: "version_number", header: "Versión", render: (v) => <span className="fam-numeric font-medium">v{v.version_number}</span> },
                { key: "reason", header: "Motivo" },
                { key: "created_by_name", header: "Por", hideBelow: "sm" },
                { key: "created_at", header: "Fecha", render: (v) => <span className="fam-numeric">{date(v.created_at)}</span> },
              ]}
              rows={versions}
            />
          </div>
        )}
      </section>
    </div>
  );
}
