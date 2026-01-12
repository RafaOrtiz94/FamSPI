import React, { useState, useEffect } from "react";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";

const RejectScheduleModal = ({ open, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Rechazar Cronograma">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Por favor indica la razón del rechazo para que el asesor pueda corregir
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ejemplo: Falta cobertura en Cuenca, agregar más visitas..."
          rows={4}
          className="w-full border rounded-lg p-3"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>
            Confirmar Rechazo
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RejectScheduleModal;
