import React from 'react';

export default function KickoffFallbackViewer({ fallbackUrl, title, reason }) {
  return (
    <div
      className="w-full rounded-2xl flex flex-col items-center justify-center gap-5 p-10 text-center min-h-[320px]"
      style={{ background: '#f4f8fc', border: '1.5px dashed #b8d0e8' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: '#e8f7fc', border: '1px solid #b8e6f5' }}
      >
        🖥️
      </div>

      <div>
        <p className="text-xs font-black tracking-widest font-mono mb-1" style={{ color: '#6b8aaa' }}>
          [ MODO CONTINGENCIA ]
        </p>
        <h4 className="font-bold text-base" style={{ color: '#0a1628' }}>
          Presentación no disponible
        </h4>
        <p className="text-sm mt-1 max-w-sm" style={{ color: '#6b8aaa' }}>
          {reason || 'La presentación embebida no está disponible en este momento.'}
        </p>
      </div>

      {fallbackUrl && (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-xl transition-colors"
          style={{ background: '#e8f7fc', color: '#00a8d4', border: '1px solid #b8e6f5' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          [ ABRIR PRESENTACIÓN ]
        </a>
      )}

      <p className="text-xs" style={{ color: '#94b0c8' }}>
        El evento continúa normalmente · Puedes seguir enviando preguntas
      </p>
    </div>
  );
}
