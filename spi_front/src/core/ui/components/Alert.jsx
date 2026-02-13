import React from 'react';

const Alert = ({ children, className = '' }) => {
  return (
    <div className={`p-4 rounded-md bg-red-50 border border-red-200 ${className}`}>
      {children}
    </div>
  );
};

const AlertDescription = ({ children, className = '' }) => {
  return (
    <div className={`text-sm text-red-700 ${className}`}>
      {children}
    </div>
  );
};

export { Alert, AlertDescription };
export default Alert;
