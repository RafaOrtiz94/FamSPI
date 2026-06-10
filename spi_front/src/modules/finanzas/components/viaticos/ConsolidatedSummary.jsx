import React from 'react';

const formatMoney = (v, cur = 'USD') =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

export default function ConsolidatedSummary({ allowance = {} }) {
  const sriTotal = allowance.total_sri_invoices || 0;
  const manualTotal = allowance.total_manual_notes || 0;
  const purchasesTotal = allowance.total_purchases_no_invoice || 0;
  const consolidated = allowance.total_consolidated || 0;
  const deducible = allowance.deducible_10_percent || 0;

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
      <h3 className="mb-6 text-[1.125rem] font-semibold text-[#1F2937]">Resumen de Gastos</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#6B7280]">Total Facturas SRI</span>
          <span className="font-mono text-sm text-[#1F2937]">{formatMoney(sriTotal)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#6B7280]">Total Notas Manuales</span>
          <span className="font-mono text-sm text-[#1F2937]">{formatMoney(manualTotal)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#6B7280]">Total Compras sin Factura</span>
          <span className="font-mono text-sm text-[#1F2937]">{formatMoney(purchasesTotal)}</span>
        </div>

        <div className="border-t border-[#E5E7EB] pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-semibold text-[#1F2937]">Total Consolidado</span>
            <span className="font-mono text-lg font-bold text-[#1E293B]">{formatMoney(consolidated)}</span>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-[#FEF3C7] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#92400E]">Deducible 10%</span>
            <span className="font-mono font-semibold text-[#D97706]">{formatMoney(deducible)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
