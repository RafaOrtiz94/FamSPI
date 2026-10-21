// Diálogos breves reutilizables, sobre el <Modal> del sistema. Reemplazan a window.prompt/confirm.
import { useState } from "react";
import Modal from "../../../core/ui/components/Modal";
import { Btn, ErrorNote, Field, TextArea } from "./kit";
import { errorMessage } from "./format";

// Pide un texto (motivo, nota…) y ejecuta onConfirm(texto). Muestra el error del servidor sin cerrarse.
export function ReasonDialog({ title, description, label = "Motivo", placeholder, confirmLabel = "Confirmar", danger = false, required = false, initial = "", onConfirm, onClose }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (required && !text.trim()) { setError(`Escribe ${label.toLowerCase()}.`); return; }
    setBusy(true); setError("");
    try {
      await onConfirm(text.trim());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal open title={title} onClose={onClose} maxWidth="max-w-md" disableClose={busy}>
      <form onSubmit={submit}>
        {description && <p className="mb-4 text-sm text-fam-muted">{description}</p>}
        <ErrorNote message={error} className="mb-4" />
        <Field label={label} optional={!required}>
          {(p) => <TextArea {...p} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus />}
        </Field>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" variant={danger ? "danger" : "primary"} loading={busy}>{busy ? "Procesando…" : confirmLabel}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// Confirmación de una acción con consecuencia: explica el objeto y el efecto antes de ejecutar.
export function ConfirmDialog({ title, description, confirmLabel = "Confirmar", danger = false, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setBusy(true); setError("");
    try { await onConfirm(); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Modal open title={title} onClose={onClose} maxWidth="max-w-md" disableClose={busy}>
      {description && <p className="text-sm text-fam-text">{description}</p>}
      <ErrorNote message={error} className="mt-4" />
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
        <Btn variant={danger ? "danger" : "primary"} onClick={run} loading={busy}>{busy ? "Procesando…" : confirmLabel}</Btn>
      </div>
    </Modal>
  );
}
