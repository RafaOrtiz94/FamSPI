import React from "react";

const LoadingSpinner = ({ size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <svg
      className={`animate-spin text-slate-600 ${sizeClasses[size] || sizeClasses.md} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

const SkeletonLine = ({ width = "w-full", height = "h-4", className = "" }) => (
  <div className={`animate-pulse rounded bg-slate-200 ${width} ${height} ${className}`} />
);

const SkeletonCard = ({ className = "" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 ${className}`}>
    <SkeletonLine width="w-16" height="h-2" className="mb-2" />
    <SkeletonLine width="w-12" height="h-6" />
  </div>
);

const SkeletonTableRow = () => (
  <tr className="bg-white">
    <td className="px-4 py-3"><SkeletonLine width="w-20" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-32" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-24" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-16" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-12" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-24" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-12" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-8" /></td>
    <td className="px-4 py-3"><SkeletonLine width="w-16" /></td>
  </tr>
);

export const SummarySkeleton = () => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
    {[...Array(6)].map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const TableSkeleton = ({ rowCount = 5 }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-900 text-white">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Fecha</th>
            <th className="px-4 py-3 text-left font-semibold">Colaborador</th>
            <th className="px-4 py-3 text-left font-semibold">Departamento</th>
            <th className="px-4 py-3 text-left font-semibold">Estado</th>
            <th className="px-4 py-3 text-left font-semibold">Disc.</th>
            <th className="px-4 py-3 text-left font-semibold">Geo</th>
            <th className="px-4 py-3 text-left font-semibold">Marcas</th>
            <th className="px-4 py-3 text-right font-semibold">Horas</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[...Array(rowCount)].map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const AttendanceReportsLoadingState = ({
  isLoading = false,
  isInitialLoading = false,
  isRefetching = false,
  message,
  className = "",
}) => {
  const showSpinner = isLoading || isInitialLoading;

  if (!showSpinner) {
    return null;
  }

  const loadingMessage = message || (isRefetching ? "Actualizando datos..." : "Cargando registros...");

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-12 ${className}`}
    >
      <LoadingSpinner size="lg" />
      <p className="text-sm font-medium text-slate-600">{loadingMessage}</p>
    </div>
  );
};

export default AttendanceReportsLoadingState;