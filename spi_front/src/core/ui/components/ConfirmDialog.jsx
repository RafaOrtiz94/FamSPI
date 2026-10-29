import React from "react";
import Button from "./Button";

const ConfirmDialog = ({ open, title, message, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
        <p className="mt-2 break-words text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={onConfirm}>Confirmar</Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
