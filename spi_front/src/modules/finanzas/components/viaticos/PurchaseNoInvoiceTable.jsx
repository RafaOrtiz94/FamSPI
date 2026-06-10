import React from 'react';
import { FiFileText, FiCheck, FiX } from 'react-icons/fi';

const toMoney = (v) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(Number(v)) ? Number(v) : 0);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-EC');
};

function ApprovalBadges({ financeApproved, talentoApproved }) {
  if (financeApproved && talentoApproved) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
        <FiCheck size={10} /> Aprobado
      </span>
    );
  }
  return (
    <div className="flex items-center justify-center gap-1">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        financeApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
      }`} title="Finanzas">
        {financeApproved ? <FiCheck size={9} /> : <FiX size={9} />}
        Fin
      </span>
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        talentoApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
      }`} title="Talento humano">
        {talentoApproved ? <FiCheck size={9} /> : <FiX size={9} />}
        Tal
      </span>
    </div>
  );
}

export default function PurchaseNoInvoiceTable({
  purchases = [],
  isFinance = false,
  isTalento = false,
  onApprove = null,
  loadingPurchaseId = null,
}) {
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
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Descripción</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Aprobaciones</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {purchases.map((purchase) => {
            const financeApproved = !!purchase.approved_by_finance;
            const talentoApproved = !!purchase.approved_by_talento;
            const isLoadingThis = loadingPurchaseId === String(purchase.id);

            return (
              <tr key={purchase.id} className="bg-white transition-colors hover:bg-slate-50">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{fmtDate(purchase.purchase_date)}</td>
                <td className="px-3 py-2.5 max-w-[200px]">
                  <p className="truncate text-xs text-slate-700">{purchase.description}</p>
                  {purchase.justification && (
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{purchase.justification}</p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-slate-900">
                  {toMoney(purchase.total)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <ApprovalBadges financeApproved={financeApproved} talentoApproved={talentoApproved} />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {purchase.file_id && (
                      <button className="cursor-pointer text-slate-400 transition hover:text-blue-600 focus:outline-none"
                        title="Ver justificante">
                        <FiFileText size={14} />
                      </button>
                    )}
                    {isFinance && !financeApproved && onApprove && (
                      <button
                        onClick={() => onApprove(purchase.id, 'finance')}
                        disabled={isLoadingThis}
                        title="Aprobar como Finanzas"
                        className="cursor-pointer rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-200 active:scale-[0.97] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-sky-500">
                        Aprobar
                      </button>
                    )}
                    {isTalento && !talentoApproved && onApprove && (
                      <button
                        onClick={() => onApprove(purchase.id, 'talento')}
                        disabled={isLoadingThis}
                        title="Aprobar como Talento"
                        className="cursor-pointer rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-200 active:scale-[0.97] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-sky-500">
                        Aprobar
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
