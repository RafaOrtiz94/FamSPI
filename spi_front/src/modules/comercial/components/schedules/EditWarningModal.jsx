import React from "react";
import Modal from "../../../../core/ui/components/Modal";
import Button from "../../../../core/ui/components/Button";

const EditWarningModal = ({ open, onClose, onConfirm }) => (
  <Modal open={open} onClose={onClose} title="⚠️ Modificar cronograma aprobado">
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">Importante</p>
        <p className="mt-1 text-amber-700">
          Este cronograma ya fue aprobado por tu jefe comercial. Al modificarlo se enviará nuevamente a
          aprobación y tu vista de clientes mostrará todos los clientes hasta que vuelva a ser aprobado.
        </p>
      </div>
      <p className="text-sm text-gray-700">¿Quieres habilitar la edición ahora?</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Sí, habilitar edición
        </Button>
      </div>
    </div>
  </Modal>
);

export default EditWarningModal;
