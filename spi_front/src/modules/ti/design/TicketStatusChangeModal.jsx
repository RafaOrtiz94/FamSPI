import React, { useEffect, useState } from "react";
import Modal from "../../../core/ui/components/Modal";
import Button from "../../../core/ui/components/Button";
import { toStatusLabel } from "../../../core/utils/workflowUi";

// Reemplaza window.prompt() nativo: captura el motivo de espera (u otro
// comentario obligatorio de cambio de estado) con validacion inline,
// siguiendo la matriz "modal del sistema" de DESIGN.md §9 (accion breve y
// autocontenida, sin necesitar URL propia).
const TicketStatusChangeModal = ({ open, ticketCode, nextStatus, onCancel, onConfirm, submitting = false }) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 3 && !submitting;

  return (
    <Modal open={open} onClose={onCancel} title="Motivo de espera">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>
          Vas a mover el ticket <span className="font-mono font-semibold" style={{ color: "var(--ti-text)" }}>{ticketCode}</span> a{" "}
          <span className="font-semibold" style={{ color: "var(--ti-text)" }}>{toStatusLabel(nextStatus)}</span>. Indica el motivo para que quede
          registrado en el historial.
        </p>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ti-text-muted)" }}>
            Motivo (obligatorio)
          </span>
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Ej. En espera de respuesta del proveedor"
            className="w-full resize-none px-3 py-2 text-sm outline-none transition"
            style={{
              borderRadius: "var(--ti-radius-control)",
              border: "1px solid var(--ti-border-control)",
              background: "var(--ti-surface)",
              color: "var(--ti-text)",
            }}
          />
          {trimmed.length > 0 && trimmed.length < 3 ? (
            <span className="text-xs" style={{ color: "var(--ti-danger-text)" }}>
              El motivo debe tener al menos 3 caracteres.
            </span>
          ) : null}
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" disabled={!canSubmit} loading={submitting} onClick={() => onConfirm(trimmed)}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TicketStatusChangeModal;
