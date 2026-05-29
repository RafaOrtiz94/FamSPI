import React, { useState } from 'react';

export default function KickoffStarRating({
  value = 0,
  onChange,
  readonly = false,
  size = 'md',
  label,
}) {
  const [hover, setHover] = useState(0);
  const sizeCls = { sm: 'text-xl gap-0.5', md: 'text-2xl gap-1', lg: 'text-3xl gap-1.5' }[size] || 'text-2xl gap-1';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
      )}
      <div className={`flex ${sizeCls}`}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
            className={`
              leading-none transition-transform duration-75 select-none
              ${!readonly ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}
            `}
          >
            <span className={
              star <= (hover || value)
                ? 'text-yellow-400 drop-shadow-sm'
                : 'text-slate-200'
            }>
              ★
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
