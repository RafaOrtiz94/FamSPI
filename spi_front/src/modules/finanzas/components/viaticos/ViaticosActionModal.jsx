import React from "react";
import Modal from "../../../../core/ui/components/Modal";
import { BTN_PRIMARY, BTN_SECONDARY, CONTROL, Spinner } from "./viaticosShared";

function ViaticosActionModal({
  open,
  title,
  description,
  label,
  value,
  onChange,
  onClose,
  onConfirm,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  placeholder = "",
  type = "text",
  required = false,
  loading = false,
  multiline = false,
  min,
  step,
}) {
  const isDisabled = loading || (required && !String(value ?? "").trim());

  return (
    <Modal open={open} onClose={loading ? undefined : onClose} title={title} maxWidth="max-w-lg">
      <div className="space-y-4">
        {description ? <p className="text-sm leading-6 text-slate-600">{description}</p> : null}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
          {multiline ? (
            <textarea
              rows={4}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              className={`${CONTROL} min-h-[110px] w-full resize-none`}
            />
          ) : (
            <input
              type={type}
              value={value}
              min={min}
              step={step}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              className={`${CONTROL} w-full`}
            />
          )}
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={loading} className={BTN_SECONDARY}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isDisabled} className={BTN_PRIMARY}>
            {loading ? <Spinner size={13} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ViaticosActionModal;
