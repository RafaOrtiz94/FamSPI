import React from 'react';
import { FiFile, FiTrash2, FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi';

const formatMoney = (v) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-EC');
};

const statusBadge = {
  pendiente_clasificacion: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', icon: FiClock, label: 'Pendiente' },
  clasificada: { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]', icon: FiCheckCircle, label: 'Clasificada' },
  rechazada: { bg: 'bg-[#FEE2E2]', text: 'text-[#7F1D1D]', icon: FiXCircle, label: 'Rechazada' },
};

export default function ManualNotesTable({ notes = [], isFinance = false, isRequester = false, onDelete = null }) {
  if (!notes.length) {
    return (
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-8 text-center">
        <p className="text-sm text-[#6B7280]">No hay notas de venta manuales</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
      <table className="w-full">
        <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151]">Fecha</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151]">RUC</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151]">Concepto</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#374151]">Base 12%</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#374151]">Base 0%</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#374151]">IVA</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#374151]">Total</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#374151]">Estado</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#374151]">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {notes.map((note) => {
            const status = statusBadge[note.status] || statusBadge.pendiente_clasificacion;
            const StatusIcon = status.icon;

            return (
              <tr
                key={note.id}
                className="bg-white transition hover:bg-[#F9FAFB]"
              >
                <td className="px-4 py-3 text-sm text-[#374151]">{formatDate(note.issue_date)}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">{note.supplier_ruc}</td>
                <td className="px-4 py-3 text-sm text-[#374151]">
                  {note.details_text || note.expense_description}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-[#374151]">
                  {formatMoney(note.subtotal_12)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-[#374151]">
                  {formatMoney(note.subtotal_0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-[#374151]">
                  {formatMoney(note.iva)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[#1F2937]">
                  {formatMoney(note.total)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.text}`}>
                    <StatusIcon size={14} />
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    {note.drive_link && (
                      <a
                        href={note.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer text-[#2563EB] hover:text-[#1D4ED8] transition"
                        title="Ver documento"
                      >
                        <FiFile size={16} />
                      </a>
                    )}
                    {isRequester && onDelete && (
                      <button
                        onClick={() => onDelete(note.id)}
                        className="cursor-pointer text-[#6B7280] hover:text-[#DC2626] transition focus:outline-none"
                        title="Eliminar"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
