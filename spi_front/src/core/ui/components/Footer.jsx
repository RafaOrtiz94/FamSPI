import React from "react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 sm:text-left">
          © {year} <span className="font-semibold text-slate-700 dark:text-slate-200">SPI Fam</span>
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
          Departamento de TI
        </p>
        <p className="text-center text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 sm:text-right">
          Plataforma Ejecutiva
        </p>
      </div>
    </footer>
  );
}
