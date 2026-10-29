import React from 'react';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';

const LEVELS = {
  warn:  { Icon: FiAlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'text-caution-amber' },
  error: { Icon: FiAlertTriangle, bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-800',   icon: 'text-alert-red'     },
  info:  { Icon: FiInfo,          bg: 'bg-sky-50',   border: 'border-sky-200',   text: 'text-sky-800',   icon: 'text-sky-signal'    },
};

const BlockerAlert = ({ message, level = 'warn', className = '' }) => {
  if (!message) return null;
  const s = LEVELS[level] ?? LEVELS.warn;
  const { Icon } = s;
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border ${s.bg} ${s.border} ${className}`} role="alert">
      <Icon size={15} className={`flex-shrink-0 mt-0.5 ${s.icon}`} aria-hidden="true" />
      <p className={`text-sm leading-snug ${s.text}`}>{message}</p>
    </div>
  );
};

export default BlockerAlert;
