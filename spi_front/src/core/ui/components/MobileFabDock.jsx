import React, { useEffect, useRef, useState } from "react";
import { FiEdit3, FiHelpCircle, FiX, FiMoreVertical } from "react-icons/fi";

export default function MobileFabDock({ famSignRef, helpTicketRef, famSignCount = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const dockRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    const handleOutside = (e) => {
      if (dockRef.current && !dockRef.current.contains(e.target)) setExpanded(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [expanded]);

  const openFamSign = () => {
    setExpanded(false);
    famSignRef.current?.open();
  };

  const openHelpTicket = () => {
    setExpanded(false);
    helpTicketRef.current?.open();
  };

  return (
    <div ref={dockRef} className="fixed bottom-6 left-3 z-[9998] sm:hidden">
      {/* Speed-dial sub-buttons */}
      <div
        className={`absolute bottom-14 left-0 flex flex-col items-start gap-3 transition-all duration-200 ${
          expanded ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        {/* FamSign */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openFamSign}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg active:scale-95 transition-transform"
            aria-label="Firmas pendientes"
          >
            <FiEdit3 size={18} />
            {famSignCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full border-2 border-white bg-amber-500 px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white">
                {famSignCount > 99 ? "99+" : famSignCount}
              </span>
            )}
          </button>
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-sm whitespace-nowrap">
            {famSignCount > 0 ? `${famSignCount} firma${famSignCount === 1 ? "" : "s"} pendiente${famSignCount === 1 ? "" : "s"}` : "FamSign"}
          </span>
        </div>

        {/* Soporte TI */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openHelpTicket}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg active:scale-95 transition-transform"
            aria-label="Soporte TI"
          >
            <FiHelpCircle size={18} />
          </button>
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-sm whitespace-nowrap">
            Soporte TI
          </span>
        </div>
      </div>

      {/* Toggle principal */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white shadow-[0_8px_24px_rgba(15,23,42,0.25)] transition-transform active:scale-95"
        aria-label={expanded ? "Cerrar menú" : "Abrir acciones"}
      >
        {expanded ? <FiX size={20} /> : <FiMoreVertical size={20} />}
        {!expanded && famSignCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full border-2 border-white bg-amber-500 px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white">
            {famSignCount > 99 ? "99+" : famSignCount}
          </span>
        )}
      </button>
    </div>
  );
}
