import React from "react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center sm:text-left">
          © {year} <span className="font-semibold text-white">SPI Fam</span> · Departamento de TI
        </p>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-white/50 sm:text-right">
          React & Tailwind · Plataforma Ejecutiva
        </p>
      </div>
    </footer>
  );
}
