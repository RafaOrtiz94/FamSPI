import React from 'react';
import { FiLock } from 'react-icons/fi';

const RoleGatedAction = ({ allowed, tooltip, children }) => {
  if (allowed) return children;

  return (
    <div
      className="relative inline-flex items-center gap-1 opacity-40 cursor-not-allowed select-none"
      title={tooltip || 'Tu rol no tiene acceso a esta acción'}
      aria-disabled="true"
    >
      <FiLock size={11} className="text-warm-ash flex-shrink-0" aria-hidden="true" />
      <span className="text-xs text-warm-ash">Sin acceso</span>
    </div>
  );
};

export default RoleGatedAction;
