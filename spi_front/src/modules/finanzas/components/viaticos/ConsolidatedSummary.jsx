import React from 'react';
import { FiFileText } from 'react-icons/fi';

const toMoney = (v) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(Number(v)) ? Number(v) : 0);

const surfaceClass = 'rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]';

export default function ConsolidatedSummary({ allowance = {} }) {
  const sri = Number(allowance.total_sri_invoices) || 0;
  const manual = Number(allowance.total_manual_notes) || 0;
  const purchases = Number(allowance.total_purchases_no_invoice) || 0;
  const consolidated = Number(allowance.total_consolidated) || 0;
  const deducible = Number(allowance.deducible_10_percent) || 0;
  const isEmpty = sri === 0 && manual === 0 && purchases === 0;

  return (
    <div className={`${surfaceClass} p-5`}>
      <p className="mb-4 text-sm font-semibold text-slate-900">Resumen de gastos</p>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <FiFileText className="h-8 w-8 text-slate-300" />
          <p className="text-xs text-slate-400">Sin documentos registrados aún</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total facturas SRI</span>
              <span className="font-mono text-sm text-slate-700">{toMoney(sri)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total notas manuales</span>
              <span className="font-mono text-sm text-slate-700">{toMoney(manual)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total compras sin factura</span>
              <span className="font-mono text-sm text-slate-700">{toMoney(purchases)}</span>
            </div>
          </div>

          <div className="my-4 border-t border-slate-100" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-900">Total consolidado</span>
            <span className="font-mono text-xl font-bold text-slate-900">{toMoney(consolidated)}</span>
          </div>

          {deducible > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
              <span className="text-xs font-medium text-amber-800">Deducible 10%</span>
              <span className="font-mono text-sm font-semibold text-amber-700">{toMoney(deducible)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
