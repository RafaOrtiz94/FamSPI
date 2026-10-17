// Piezas compartidas del Blue Sheet guiado: pasos, guardado automático y red flags por elemento.
import { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheck, FiFlag, FiLoader } from "react-icons/fi";
import { fetchElementRedFlags, toggleElementRedFlag } from "../../../../core/api/crmFamApi";
import { cx } from "../../ui/kit";
import { errorMessage } from "../../ui/format";

// Orden del recorrido (Strategic Selling): de entender al cliente a decidir cómo ganar.
// `keys` son los criterios de completitud del backend que cada paso resuelve.
export const STEPS = [
  { id: "objetivo", label: "Objetivo y situación", keys: ["sales_objective", "situation_current", "situation_desired"] },
  { id: "proceso", label: "Proceso de compra", keys: ["buying_process"] },
  { id: "compradores", label: "Compradores", keys: ["economic_buyer", "coach"] },
  { id: "resultados", label: "Resultados y Wins", keys: ["win_results"] },
  { id: "competencia", label: "Competencia", keys: ["competitors"] },
  { id: "fortalezas", label: "Fortalezas", keys: ["strengths"] },
  { id: "redflags", label: "Red flags", keys: [] },
  { id: "scorecard", label: "Scorecard", keys: ["scorecard"] },
  { id: "estrategia", label: "Estrategia", keys: ["strategy_summary"] },
  { id: "acciones", label: "Acciones", keys: [] },
  { id: "revision", label: "Revisión", keys: [] },
];

export const EDITABLE_STATUSES = ["draft", "in_progress", "needs_update", "observed"];
export const LEVELS = [
  { value: "low", label: "Bajo" }, { value: "medium", label: "Medio" }, { value: "high", label: "Alto" }, { value: "critical", label: "Crítico" },
];
export const levelLabel = (value) => LEVELS.find((l) => l.value === value)?.label || value || "—";
export const levelTone = (value) => (value === "critical" || value === "high" ? "danger" : value === "medium" ? "warning" : "neutral");

// Guarda solo cuando el usuario deja de escribir, y dice la verdad sobre el estado: guardando,
// guardado o fallo (con reintento). No se guarda nada en el primer render ni si no hubo cambios.
export function useAutosave(values, save, { enabled = true, delay = 1000 } = {}) {
  const [state, setState] = useState({ status: "idle", error: "" });
  const lastSaved = useRef(JSON.stringify(values));
  const latest = useRef(values);
  const saveRef = useRef(save);
  latest.current = values;
  saveRef.current = save;

  const run = useCallback(async () => {
    const snapshot = JSON.stringify(latest.current);
    if (snapshot === lastSaved.current) return;
    setState({ status: "saving", error: "" });
    try {
      await saveRef.current(latest.current);
      lastSaved.current = snapshot;
      setState({ status: "saved", error: "" });
    } catch (err) {
      setState({ status: "error", error: errorMessage(err, "No se pudo guardar.") });
    }
  }, []);

  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return undefined;
    const t = setTimeout(run, delay);
    return () => clearTimeout(t);
  }, [serialized, enabled, delay, run]);

  // Al salir del paso se guarda lo pendiente.
  useEffect(() => () => { if (enabled && JSON.stringify(latest.current) !== lastSaved.current) saveRef.current(latest.current).catch(() => {}); }, [enabled]);

  return { ...state, retry: run, dirty: serialized !== lastSaved.current };
}

export function SaveStatus({ autosave, editable }) {
  if (!editable) return <p className="text-[13px] text-fam-muted">Solo lectura en este estado.</p>;
  const { status, error, retry, dirty } = autosave;
  return (
    <p role="status" className={cx("flex items-center gap-1.5 text-[13px]", status === "error" ? "text-fam-danger" : "text-fam-muted")}>
      {status === "saving" && <><FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Guardando…</>}
      {status === "saved" && !dirty && <><FiCheck className="h-3.5 w-3.5" aria-hidden="true" /> Cambios guardados</>}
      {status === "error" && <><FiAlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {error} <button type="button" onClick={retry} className="underline underline-offset-2">Reintentar</button></>}
      {(status === "idle" || (status === "saved" && dirty)) && (dirty ? "Cambios sin guardar…" : "Se guarda automáticamente")}
    </p>
  );
}

// Elementos (comprador, competidor, criterio, acción) marcados como red flag. Se carga una vez por
// Blue Sheet y se comparte entre pasos; el cambio es optimista y se revierte si el servidor falla.
export function useElementRedFlags(blueSheetId, onError) {
  const [flags, setFlags] = useState([]);
  const same = (f, type, id) => f.related_entity_type === type && f.related_entity_id === id;

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!blueSheetId) return undefined;
    let cancelled = false;
    fetchElementRedFlags(blueSheetId).then((rows) => { if (!cancelled) setFlags(Array.isArray(rows) ? rows : []); }).catch(() => { if (!cancelled) setFlags([]); });
    return () => { cancelled = true; };
  }, [blueSheetId, reloadKey]);
  // Tras guardar un paso: el servidor pudo marcar o resolver red flags automáticas.
  const reload = () => setReloadKey((k) => k + 1);

  // Red flags sobre campos del Blue Sheet (urgencia, presupuesto, textos). La clave del campo va en flag_category.
  const fieldFlag = (field) => flags.find((f) => f.related_entity_type === "field" && f.flag_category === field) || null;
  const toggleField = async (field, text) => {
    try {
      await toggleElementRedFlag(blueSheetId, { related_entity_type: "field", field, text });
    } catch (err) {
      onError?.(errorMessage(err, "No se pudo actualizar la red flag."));
    } finally {
      reload();
    }
  };

  const isFlagged = (type, id) => flags.some((f) => same(f, type, id));
  const toggle = async (type, id, label) => {
    const was = isFlagged(type, id);
    setFlags((prev) => (was ? prev.filter((f) => !same(f, type, id)) : [...prev, { related_entity_type: type, related_entity_id: id }]));
    try {
      await toggleElementRedFlag(blueSheetId, { related_entity_type: type, related_entity_id: id, label });
    } catch (err) {
      setFlags((prev) => (was ? [...prev, { related_entity_type: type, related_entity_id: id }] : prev.filter((f) => !same(f, type, id))));
      onError?.(errorMessage(err, "No se pudo actualizar la red flag."));
    }
  };
  return { isFlagged, toggle, fieldFlag, toggleField, reload, count: flags.length };
}

// Botón para marcar/desmarcar un elemento como red flag. `suggested` = el sistema la sugiere (p. ej. acción vencida).
export function FlagToggle({ active, suggested, onClick, disabled, label }) {
  const text = active ? `Quitar red flag: ${label}` : suggested ? `Confirmar red flag sugerida: ${label}` : `Marcar red flag: ${label}`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={text}
      title={text}
      className={cx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-100 disabled:opacity-50",
        active ? "border-transparent bg-fam-danger-bg text-fam-danger" : suggested ? "border-transparent bg-fam-warning-bg text-fam-warning" : "border-fam-border text-fam-muted hover:bg-fam-subtle hover:text-fam-text",
      )}
    >
      <FiFlag className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
