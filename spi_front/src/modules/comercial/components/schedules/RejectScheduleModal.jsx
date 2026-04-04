import React, { useState, useEffect } from "react";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";

const RejectScheduleModal = ({
  open,
  onClose,
  onConfirm,
  loading = false,
  disabled = false,
  title = "Rechazar cronograma",
  description = "Incluye notes obligatorias para registrar la auditoria de la decision.",
  actionLabel = "Confirmar rechazo",
}) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{description}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Escribe notes de auditoria..."
          rows={4}
          className="w-full border rounded-lg p-3"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={disabled}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={disabled || !reason.trim()}
            loading={loading}
            onClick={() => onConfirm(reason)}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RejectScheduleModal;

