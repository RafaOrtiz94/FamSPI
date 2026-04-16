import React from "react";

const AttendanceReportsEmptyState = ({ onConsult }) => {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      Aun no hay resultados consultados. Ajusta el rango, usuario o estado y presiona{" "}
      <button
        type="button"
        onClick={onConsult}
        className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2"
      >
        Consultar rango
      </button>
      .
    </div>
  );
};

export default AttendanceReportsEmptyState;
