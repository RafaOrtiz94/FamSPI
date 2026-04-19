import React, { useEffect, useState, useRef } from "react";
import { SummarySkeleton } from "./AttendanceReportsLoadingState";

const AnimatedCounter = ({ value, duration = 500 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const targetValue = Number(value) || 0;

  useEffect(() => {
    if (targetValue === previousValue.current) return;
    
    const startValue = previousValue.current;
    const diff = targetValue - startValue;
    const steps = 20;
    const stepDuration = Math.min(duration / steps, 25);
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + diff * eased);
      setDisplayValue(current);
      
      if (step >= steps) {
        clearInterval(timer);
        previousValue.current = targetValue;
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [targetValue, duration]);

  return <span>{displayValue}</span>;
};

const AttendanceReportsSummaryCards = ({ items = [], isLoading = false }) => {
  if (isLoading) {
    return <SummarySkeleton />;
  }

  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            <AnimatedCounter value={item.value} duration={400} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AttendanceReportsSummaryCards;
