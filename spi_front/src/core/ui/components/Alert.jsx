import React from "react";

const Alert = ({ children, className = "" }) => {
  return (
    <div className={`rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 ${className}`}>
      {children}
    </div>
  );
};

const AlertDescription = ({ children, className = "" }) => {
  return <div className={`leading-relaxed text-sm text-red-700 ${className}`}>{children}</div>;
};

export { Alert, AlertDescription };
export default Alert;
