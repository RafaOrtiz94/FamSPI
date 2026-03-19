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
  closeOnBackdrop = true,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Modal"}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.20)] ${maxWidth}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          {title ? <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2> : <span />}
          <button
            type="button"
            onClick={() => !disableClose && onClose?.()}
            disabled={disableClose}
            className="ml-auto rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
