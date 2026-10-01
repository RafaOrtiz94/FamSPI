import React, { useState, useEffect, useRef } from 'react';
import KickoffFallbackViewer from './KickoffFallbackViewer';

const LOAD_TIMEOUT_MS = 12000;

export default function KickoffCanvaEmbed({ embedUrl, fallbackUrl, title }) {
  const [status, setStatus]   = useState('loading'); // loading | loaded | error
  const timerRef              = useRef(null);

  useEffect(() => {
    if (!embedUrl) { setStatus('error'); return; }
    setStatus('loading');

    timerRef.current = setTimeout(() => setStatus('error'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timerRef.current);
  }, [embedUrl]);

  const handleLoad = () => {
    clearTimeout(timerRef.current);
    setStatus('loaded');
  };

  const handleError = () => {
    clearTimeout(timerRef.current);
    setStatus('error');
  };

  if (!embedUrl || status === 'error') {
    return (
      <KickoffFallbackViewer
        fallbackUrl={fallbackUrl || embedUrl}
        title={title}
        reason={!embedUrl ? 'No hay enlace de presentación configurado' : 'La presentación no pudo cargarse'}
      />
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900" style={{ paddingTop: '56.25%' }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Cargando presentación…</p>
        </div>
      )}
      <iframe
        src={embedUrl}
        title={title || 'Presentación Canva'}
        className="absolute inset-0 w-full h-full border-0"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        onLoad={handleLoad}
        onError={handleError}
        style={{ opacity: status === 'loaded' ? 1 : 0, transition: 'opacity 0.4s ease' }}
      />
    </div>
  );
}
