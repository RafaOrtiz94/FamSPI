import React from 'react';
import { FiFile, FiCheck, FiX } from 'react-icons/fi';

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

export default function PurchaseNoInvoiceTable({
  purchases = [],
  isFinance = false,
  isTalento = false,
  onApprove = null,
  loadingPurchaseId = null,
}) {
  if (!purchases.length) {
    return (
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-8 text-center">
        <p className="text-sm text-[#6B7280]">No hay compras sin factura</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
      <table className="w-full">
        <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151]">Fecha</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151]">Descripción</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#374151]">Total</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#374151]">Aprobaciones</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#374151]">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {purchases.map((purchase) => {
            const financeApproved = !!purchase.approved_by_finance;
            const talentoApproved = !!purchase.approved_by_talento;
            const fullyApproved = financeApproved && talentoApproved;

            return (
              <tr
                key={purchase.id}
                className="bg-white transition hover:bg-[#F9FAFB]"
              >
                <td className="px-4 py-3 text-sm text-[#374151]">{formatDate(purchase.purchase_date)}</td>
                <td className="px-4 py-3 text-sm text-[#374151]">{purchase.description}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[#1F2937]">
                  {formatMoney(purchase.total)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {fullyApproved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-medium text-[#15803D]">
                        <FiCheck size={14} />
                        Aprobado
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                            financeApproved
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-[#FEE2E2] text-[#7F1D1D]'
                          }`}
                          title="Aprobación de Finanzas"
                        >
                          {financeApproved ? <FiCheck size={12} /> : <FiX size={12} />}
                          Fin
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                            talentoApproved
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-[#FEE2E2] text-[#7F1D1D]'
                          }`}
                          title="Aprobación de Talento"
                        >
                          {talentoApproved ? <FiCheck size={12} /> : <FiX size={12} />}
                          Tal
                        </span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {purchase.file_id && (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          // Aquí iría la lógica para descargar el archivo
                        }}
                        className="cursor-pointer text-[#2563EB] hover:text-[#1D4ED8] transition"
                        title="Ver justificante"
                      >
                        <FiFile size={16} />
                      </a>
                    )}

                    {isFinance && !financeApproved && onApprove && (
                      <button
                        onClick={() => onApprove(purchase.id, 'finance')}
                        disabled={loadingPurchaseId === purchase.id}
                        className="cursor-pointer rounded-md bg-[#DCFCE7] p-1 text-[#15803D] transition hover:bg-[#BBF7D0] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2"
                        title="Aprobar (Finanzas)"
                      >
                        <FiCheck size={16} />
                      </button>
                    )}

                    {isTalento && !talentoApproved && onApprove && (
                      <button
                        onClick={() => onApprove(purchase.id, 'talento')}
                        disabled={loadingPurchaseId === purchase.id}
                        className="cursor-pointer rounded-md bg-[#DCFCE7] p-1 text-[#15803D] transition hover:bg-[#BBF7D0] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2"
                        title="Aprobar (Talento)"
                      >
                        <FiCheck size={16} />
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
