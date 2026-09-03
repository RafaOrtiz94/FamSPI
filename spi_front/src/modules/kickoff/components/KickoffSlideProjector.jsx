import React, { useState, useEffect, useRef } from 'react';
import { useKickoffPolling } from '../hooks/useKickoffPolling';

export default function KickoffSlideProjector({ presentationId }) {
  const { presentation, loading } = useKickoffPolling(presentationId);

  const [displayedBlock, setDisplayedBlock] = useState(null);
  const [fading,         setFading]         = useState(false);
  const prevIdRef = useRef(null);

  const blocks      = presentation?.blocks || [];
  const activeBlock = presentation?.active_block || null;
  const blockIndex  = blocks.findIndex(b => b.id === activeBlock?.id);
  const total       = blocks.length;

  // Transición suave cuando cambia el bloque activo
  useEffect(() => {
    if (!activeBlock) {
      setDisplayedBlock(null);
      prevIdRef.current = null;
      return;
    }
    if (activeBlock.id === prevIdRef.current) return;

    setFading(true);
    const t = setTimeout(() => {
      setDisplayedBlock(activeBlock);
      prevIdRef.current = activeBlock.id;
      setFading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [activeBlock?.id]); // eslint-disable-line

  // Estado inicial: mostrar sin transición
  useEffect(() => {
    if (activeBlock && prevIdRef.current === null) {
      setDisplayedBlock(activeBlock);
      prevIdRef.current = activeBlock.id;
    }
  }, [activeBlock]);

  /* ─── Pantalla de espera ───────────────────────────────────────────────── */
  if (loading && !displayedBlock) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  if (!displayedBlock && !loading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 select-none">
        <div className="text-white/10 text-9xl font-black">▶</div>
        {presentation?.title && (
          <p className="text-white/50 text-2xl font-semibold tracking-tight text-center px-8">
            {presentation.title}
          </p>
        )}
        <p className="text-white/25 text-sm tracking-widest uppercase">
          Esperando presentación…
        </p>
      </div>
    );
  }

  const slide = displayedBlock;

  /* ─── Vista proyector ──────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">

      {/* Contenido de la diapositiva */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: fading ? 0 : 1, transition: 'opacity 280ms ease-in-out' }}
      >
        {slide?.image_url ? (
          <img
            key={slide.id}
            src={slide.image_url}
            alt={slide.title || 'Diapositiva'}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          /* Sin imagen: mostrar texto centrado */
          <div className="max-w-5xl mx-auto px-20 text-center">
            {slide?.title && (
              <h1 className="text-white text-6xl font-black leading-tight mb-8 tracking-tight">
                {slide.title}
              </h1>
            )}
            {slide?.content && (
              <p className="text-white/75 text-3xl leading-relaxed font-light whitespace-pre-wrap">
                {slide.content}
              </p>
            )}
            {!slide?.title && !slide?.content && (
              <p className="text-white/20 text-xl">Sin contenido configurado</p>
            )}
          </div>
        )}
      </div>

      {/* Contador de diapositivas — esquina inferior derecha, muy sutil */}
      {total > 1 && blockIndex >= 0 && (
        <div className="absolute bottom-5 right-7 text-white/20 text-xs font-mono tabular-nums">
          {blockIndex + 1} / {total}
        </div>
      )}

      {/* Título de la presentación — esquina superior izquierda, muy sutil */}
      {presentation?.title && (
        <div className="absolute top-5 left-7 text-white/15 text-xs truncate max-w-xs">
          {presentation.title}
        </div>
      )}
    </div>
  );
}
