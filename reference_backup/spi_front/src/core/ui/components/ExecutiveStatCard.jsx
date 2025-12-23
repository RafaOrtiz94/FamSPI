import React from "react";
import clsx from "clsx";

export default function ExecutiveStatCard({
  icon,
  label,
  value,
  from = "from-primary",
  to = "to-accent",
  className = "",
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br p-5 text-white shadow-lg shadow-slate-900/30",
        from,
        to,
        className
      )}
    >
      <div className="absolute inset-0 opacity-40 mix-blend-screen">
        <div className="absolute right-6 top-4 h-16 w-16 rounded-full bg-white/30 blur-2xl" />
      </div>
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">{label}</p>
          <p className="mt-2 text-3xl font-extrabold">{value ?? "—"}</p>
        </div>
        {icon ? <div className="text-2xl text-white/80">{icon}</div> : null}
      </div>
    </div>
  );
}
