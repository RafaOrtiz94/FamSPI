/**
 * Shared primitives reutilizados por todos los componentes de etapa.
 */

import React from "react";
import { FiFileText, FiExternalLink, FiRefreshCw, FiCheck, FiX } from "react-icons/fi";

export function SectionTitle({ children }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">{children}</p>
  );
}

export function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</p>
      <div className="mt-0.5 text-sm text-[#1F2937]">{children}</div>
    </div>
  );
}

export function DriveLink({ url, label }) {
  if (!url) return <span className="text-[#9CA3AF] text-sm">No disponible</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1F2937] transition hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer">
      <FiFileText size={12} /> {label} <FiExternalLink size={11} />
    </a>
  );
}

export function ActionBar({ children }) {
  return (
    <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white/95 px-5 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export function RejectBtn({ onClick, disabled, label = "Rechazar postulante" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#FCA5A5] bg-white px-4 py-2 text-sm font-semibold text-[#DC2626] transition hover:bg-[#FEF2F2] active:scale-95 disabled:opacity-50 cursor-pointer">
      <FiX size={13} /> {label}
    </button>
  );
}

export function AdvanceBtn({ onClick, disabled, saving, label = "Aprobar y continuar" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || saving}
      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-95 disabled:opacity-50 cursor-pointer">
      {saving ? <FiRefreshCw size={13} className="animate-spin" /> : <FiCheck size={13} />}
      {label}
    </button>
  );
}

export function Textarea({ value, onChange, placeholder, rows = 4, disabled }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 disabled:opacity-60"
    />
  );
}

export function Input({ type = "text", value, onChange, placeholder, disabled, min, max, step }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 disabled:opacity-60"
    />
  );
}

export function Select({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 disabled:opacity-60"
    >
      {children}
    </select>
  );
}

export function DoneNotice({ label = "Esta etapa ya fue completada." }) {
  return (
    <div className="mx-5 mt-5 flex items-center gap-2 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3">
      <FiCheck size={15} className="shrink-0 text-[#16A34A]" />
      <p className="text-sm font-medium text-[#16A34A]">{label}</p>
    </div>
  );
}

export function RejectedNotice({ onReactivate, saving }) {
  return (
    <div className="mx-5 mt-5 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-4">
      <p className="text-sm font-semibold text-[#DC2626]">Postulante rechazado</p>
      <p className="mt-1 text-xs text-[#6B7280]">Puedes revertir el rechazo si lo consideras necesario.</p>
      <button type="button" onClick={onReactivate} disabled={saving}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#FCA5A5] bg-white px-3 py-1.5 text-xs font-semibold text-[#DC2626] transition hover:bg-[#FEE2E2] disabled:opacity-50 cursor-pointer">
        {saving ? <FiRefreshCw size={11} className="animate-spin" /> : null}
        Reactivar proceso
      </button>
    </div>
  );
}
