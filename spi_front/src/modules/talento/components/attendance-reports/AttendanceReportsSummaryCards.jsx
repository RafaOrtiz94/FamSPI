import React from "react";

const AttendanceReportsSummaryCards = ({ items = [] }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{item.value}</div>
        </div>
      ))}
    </div>
  );
};

export default AttendanceReportsSummaryCards;
