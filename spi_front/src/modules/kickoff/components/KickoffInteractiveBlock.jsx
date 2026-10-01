import React from 'react';

const TYPE_ICONS = {
  info:     '💡',
  question: '❓',
  poll:     '📊',
  image:    '🖼️',
  video:    '🎬',
  text:     '📝',
  custom:   '✨',
};

const TYPE_ACCENT = {
  info:     'from-blue-50 to-indigo-50 border-blue-200',
  question: 'from-purple-50 to-violet-50 border-purple-200',
  poll:     'from-emerald-50 to-teal-50 border-emerald-200',
  image:    'from-amber-50 to-yellow-50 border-amber-200',
  video:    'from-red-50 to-rose-50 border-red-200',
  text:     'from-slate-50 to-gray-50 border-slate-200',
  custom:   'from-pink-50 to-fuchsia-50 border-pink-200',
};

export default function KickoffInteractiveBlock({ block, totalBlocks, currentIndex }) {
  if (!block) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-400 text-sm">
        Sin contenido interactivo en este momento
      </div>
    );
  }

  const accent = TYPE_ACCENT[block.block_type] || TYPE_ACCENT.info;
  const icon   = TYPE_ICONS[block.block_type] || '📌';

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${accent} p-5 transition-all duration-500`}
      style={{ animation: 'kickoffBlockIn 0.4s ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            {block.block_type}
          </span>
        </div>
        {totalBlocks > 1 && (
          <span className="text-xs text-slate-400 font-mono">
            {currentIndex + 1} / {totalBlocks}
          </span>
        )}
      </div>

      {/* Title */}
      {block.title && (
        <h4 className="font-semibold text-slate-800 text-base mb-2">{block.title}</h4>
      )}

      {/* Content */}
      {block.content && (
        <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{block.content}</p>
      )}

      {/* Image */}
      {block.image_url && (
        <img
          src={block.image_url}
          alt={block.title || 'Contenido interactivo'}
          className="w-full rounded-xl mt-3 object-contain max-h-64 border border-white/60"
          loading="lazy"
        />
      )}

      <style>{`
        @keyframes kickoffBlockIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
