import React from "react";

const Badge = ({ children, variant = "gray", className = "" }) => {
  const variantClasses = {
    gray: "border border-slate-200 bg-slate-100 text-slate-700",
    blue: "border border-blue-200 bg-blue-100 text-blue-700",
    yellow: "border border-yellow-200 bg-yellow-100 text-yellow-800",
    orange: "border border-orange-200 bg-orange-100 text-orange-800",
    purple: "border border-violet-200 bg-violet-100 text-violet-800",
    cyan: "border border-cyan-200 bg-cyan-100 text-cyan-800",
    green: "border border-emerald-200 bg-emerald-100 text-emerald-800",
    red: "border border-red-200 bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-xs font-semibold ${variantClasses[variant] || variantClasses.gray} ${className}`}
    >
      {children}
    </span>
  );
};

export { Badge };
