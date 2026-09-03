import React from "react";

const Toast = ({ message, type = "info" }) => {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className={`fixed bottom-4 right-4 z-[100] max-w-[calc(100vw-2rem)] rounded-xl border px-4 py-2 text-sm shadow-lg ${styles[type]}`}>
      {message}
    </div>
  );
};

export default Toast;
