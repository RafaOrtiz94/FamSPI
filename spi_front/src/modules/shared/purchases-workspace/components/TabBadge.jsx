import React from 'react';

const VARIANTS = {
  pending:   { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500'  },
  active:    { bg: 'bg-sky-100',    text: 'text-sky-800',    dot: 'bg-sky-500'    },
  done:      { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  blocked:   { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500'    },
  skipped:   { bg: 'bg-slate-100',  text: 'text-slate-500',  dot: 'bg-slate-400'  },
  na:        { bg: 'bg-slate-100',  text: 'text-slate-400',  dot: 'bg-slate-300'  },
};

const TabBadge = ({ variant = 'na', label, dot = true, className = '' }) => {
  const s = VARIANTS[variant] ?? VARIANTS.na;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium leading-none ${s.bg} ${s.text} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden="true" />}
      {label}
    </span>
  );
};

export default TabBadge;
