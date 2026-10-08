import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";

const Modal = ({
  open,
  isOpen,
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
  disableClose = false,
  closeOnBackdrop = false,
  hideHeader = false,
}) => {
  const visible = typeof open !== "undefined" ? open : isOpen;

  useEffect(() => {
    if (!visible || disableClose) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disableClose, onClose, visible]);

  if (!visible) return null;

  const handleBackdropClick = () => {
    if (!disableClose && closeOnBackdrop) {
      onClose?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[30] flex items-end justify-center bg-[#0F172A]/60 sm:items-center sm:p-4"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Modal"}
        className={`relative z-[40] flex w-full flex-col overflow-hidden rounded-t-2xl border border-[#E5E7EB] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)] sm:rounded-2xl ${maxWidth}`}
        style={{ maxHeight: "calc(92dvh - env(safe-area-inset-bottom, 0px))" }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* drag handle — visible only on mobile */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-full bg-slate-200" />
        </div>

        {!hideHeader && (
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
            {title ? <h2 className="text-base font-bold text-slate-900 sm:text-xl">{title}</h2> : <span />}
            <button
              type="button"
              onClick={() => !disableClose && onClose?.()}
              disabled={disableClose}
              className="ml-auto cursor-pointer rounded-2xl p-2 text-slate-400 transition duration-150 ease-out hover:bg-slate-100 hover:text-slate-700 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto overscroll-contain ${hideHeader ? "" : "px-4 py-4 sm:px-6 sm:py-5"}`}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
