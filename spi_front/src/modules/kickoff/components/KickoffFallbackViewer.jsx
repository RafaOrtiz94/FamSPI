import React from 'react';

export default function KickoffFallbackViewer({ fallbackUrl, title, reason }) {
  return (
    <div className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-5 p-8 text-center min-h-[320px]">
      <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center text-3xl">
        🖥️
      </div>

      <div>
        <h4 className="font-semibold text-slate-700 text-lg">
          Modo contingencia
        </h4>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">
          {reason || 'La presentación embebida no está disponible en este momento.'}
        </p>
      </div>

      {fallbackUrl && (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Abrir presentación en nueva pestaña
        </a>
      )}

      <p className="text-xs text-slate-400">
        El evento continúa normalmente. Puedes seguir enviando preguntas.
      </p>
    </div>
  );
}
