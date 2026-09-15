import React from 'react';
import { FiFileText } from 'react-icons/fi';

const toMoney = (value) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(Number(value)) ? Number(value) : 0);

const fmtDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-EC');
};

const getExpenseModeLabel = (value) => {
  if (value === 'with_card') return 'Con tarjeta';
  if (value === 'without_card') return 'Sin tarjeta';
  return 'Sin definir';
};

const ExpenseModeBadge = ({ value }) => {
  const isWithCard = value === 'with_card';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      isWithCard ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {getExpenseModeLabel(value)}
    </span>
  );
};

export default function PurchaseNoInvoiceTable({ purchases = [] }) {
  if (!purchases.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-8 text-center">
        <FiFileText className="h-8 w-8 text-slate-300" />
        <p className="text-xs text-slate-400">No hay compras sin factura registradas</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fecha</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Descripcion</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Modo</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Liquidacion</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Archivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {purchases.map((purchase) => {
            const isWithCard = purchase.expense_mode === 'with_card';
            return (
              <tr key={purchase.id} className="bg-white transition-colors hover:bg-slate-50">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{fmtDate(purchase.purchase_date)}</td>
                <td className="px-3 py-2.5 max-w-[260px]">
                  <p className="truncate text-xs text-slate-700">{purchase.description}</p>
                  {purchase.justification && (
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{purchase.justification}</p>
                  )}
                </td>
                <td className="px-3 py-2.5"><ExpenseModeBadge value={purchase.expense_mode} /></td>
                <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-slate-900">{toMoney(purchase.total)}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  {isWithCard ? 'Pago al banco' : 'Devolucion'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {purchase.file_id ? (
                    <button
                      className="cursor-pointer text-slate-400 transition hover:text-blue-600 focus:outline-none"
                      title="Ver justificante"
                    >
                      <FiFileText size={14} />
                    </button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
