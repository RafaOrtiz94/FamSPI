import React from "react";
import { FiX } from "react-icons/fi";

const Modal = ({ open, isOpen, title, onClose, children }) => {
  const visible = typeof open !== "undefined" ? open : isOpen;
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <FiX className="w-5 h-5" />
        </button>
        {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
