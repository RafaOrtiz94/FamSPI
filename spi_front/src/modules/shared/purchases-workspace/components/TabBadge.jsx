import React from 'react';

const VARIANTS = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', label: 'pendiente' },
  active: { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500', label: 'en curso' },
  done: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'completado' },
  blocked: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'bloqueado' },
  control: { bg: 'bg-green-100', text: 'text-green-900', dot: 'bg-green-600 motion-safe:animate-pulse', label: 'control activo' },
  na: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-300', label: 'n/a' },
};

const STATUS_TO_VARIANT = {
  pendiente: 'pending',
  pending: 'pending',
  'en curso': 'active',
  active: 'active',
  ok: 'done',
  completado: 'done',
  completed: 'done',
  done: 'done',
  bloqueado: 'blocked',
  blocked: 'blocked',
  'control activo': 'control',
  control: 'control',
  skipped: 'na',
  neutral: 'na',
  'n/a': 'na',
  na: 'na',
};

const TabBadge = ({ variant, status, label, dot = true, className = '' }) => {
  const resolvedVariant = STATUS_TO_VARIANT[status] || STATUS_TO_VARIANT[variant] || variant || 'na';
  const style = VARIANTS[resolvedVariant] ?? VARIANTS.na;
  const text = label || style.label;

  return (
    <span
      className={`inline-flex min-h-5 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${style.bg} ${style.text} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />}
      {text}
    </span>
  );
};

export default TabBadge;
