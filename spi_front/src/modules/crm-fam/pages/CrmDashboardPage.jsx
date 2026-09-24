import { Link } from "react-router-dom";
import { useCrmDashboard } from "../hooks/useCrmDashboard";

const EMPTY = "-";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fmt = (value) =>
  `$${toNumber(value).toLocaleString("es-EC", { maximumFractionDigits: 0 })}`;

const STATUS_COLORS = {
  open: { bg: "#DCFCE7", text: "#16A34A" },
  won: { bg: "#DCFCE7", text: "#16A34A" },
  lost: { bg: "#FEE2E2", text: "#DC2626" },
  on_hold: { bg: "#FEF3C7", text: "#D97706" },
  default: { bg: "#E5E7EB", text: "#6B7280" },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.default;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status || EMPTY}
    </span>
  );
}

function KpiCard({ title, value, subtitle }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <p className="text-sm text-[#6B7280] font-medium">{title}</p>
      <p className="text-3xl font-bold text-[#1F2937] mt-1">{value ?? EMPTY}</p>
      {subtitle && <p className="text-xs text-[#6B7280] mt-1">{subtitle}</p>}
    </div>
  );
}

function SkeletonKpis() {
  return Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <div className="animate-pulse bg-gray-200 h-4 w-32 rounded mb-3" />
      <div className="animate-pulse bg-gray-200 h-8 w-20 rounded mb-2" />
      <div className="animate-pulse bg-gray-200 h-3 w-24 rounded" />
    </div>
  ));
}

export default function CrmDashboardPage() {
  const { data, pipeline, loading, error } = useCrmDashboard();

  const opportunityStats = Array.isArray(data?.opportunities) ? data.opportunities : [];
  const openStats = opportunityStats.find((row) => row.status === "open") || {};

  const openOpp = toNumber(data?.open_opportunities_count ?? data?.open_count ?? openStats.count);
  const pipelineTotal = toNumber(
    data?.pipeline_total ?? data?.open_pipeline_total ?? openStats.total_amount
  );
  const blueSheetsPending = toNumber(
    data?.blue_sheets_pending_review ?? data?.blue_sheet_ready_for_review_count
  );
  const myOpenActions = toNumber(data?.my_open_actions ?? data?.my_actions_open);

  const stages = Array.isArray(pipeline?.by_stage)
    ? pipeline.by_stage
    : Array.isArray(pipeline)
    ? pipeline
    : [];

  const statusDist = Array.isArray(data?.status_distribution)
    ? data.status_distribution
    : Array.isArray(pipeline?.status_distribution)
    ? pipeline.status_distribution
    : opportunityStats;

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#1F2937]">Dashboard CRM</h1>
        <Link
          to="/dashboard/crm-fam/opportunities"
          className="text-sm text-[#2563EB] hover:underline font-medium"
        >
          Ver oportunidades
        </Link>
      </header>

      {error && (
        <div className="mb-5 px-4 py-3 bg-[#FEE2E2] border border-[#DC2626] text-[#DC2626] rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <SkeletonKpis />
        ) : (
          <>
            <KpiCard
              title="Oportunidades abiertas"
              value={openOpp}
              subtitle="estado: open"
            />
            <KpiCard
              title="Pipeline total"
              value={fmt(pipelineTotal)}
              subtitle="suma estimated_amount open"
            />
            <KpiCard
              title="Blue Sheets pendientes"
              value={blueSheetsPending}
              subtitle="estado: ready_for_review"
            />
            <KpiCard
              title="Mis acciones abiertas"
              value={myOpenActions}
              subtitle="asignadas a ti"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#1F2937]">Pipeline por etapa</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-5 rounded" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[#6B7280] text-center">Sin datos</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#6B7280]">Etapa</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-[#6B7280]"># Opp</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-[#6B7280]">Monto</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-[#6B7280] hidden sm:table-cell">Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s, i) => (
                    <tr key={i} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-4 py-3 text-[#1F2937] font-medium">
                        {s.stage_name ?? s.name ?? EMPTY}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6B7280]">
                        {toNumber(s.count ?? s.opportunity_count)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6B7280]">
                        {fmt(s.total_amount ?? s.amount_total)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6B7280] hidden sm:table-cell">
                        {fmt(s.weighted_amount ?? s.weighted)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#1F2937]">Distribucion por estado</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-5 rounded" />
              ))}
            </div>
          ) : statusDist.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[#6B7280] text-center">Sin datos</p>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {statusDist.map((s, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3">
                  <StatusBadge status={s.status} />
                  <span className="text-sm font-medium text-[#1F2937]">
                    {toNumber(s.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
