import React from 'react';
import { useNavigate } from 'react-router-dom';
import KickoffCanvaEmbed from './KickoffCanvaEmbed';
import KickoffInteractiveBlock from './KickoffInteractiveBlock';
import KickoffStatusBadge from './KickoffStatusBadge';
import KickoffQRCode from './KickoffQRCode';
import { KickoffElapsedTimer } from './KickoffTimer';

export default function KickoffPresentationView({ presentation, isProjectorMode }) {
  const navigate = useNavigate();

  if (!presentation) return null;

  const blocks       = presentation.blocks || [];
  const activeBlock  = presentation.active_block || null;
  const blockIndex   = blocks.findIndex(b => b.id === activeBlock?.id);

  const canAskQuestions = ['active', 'questions_open'].includes(presentation.status);

  return (
    <div className={`flex flex-col gap-6 ${isProjectorMode ? 'text-lg' : ''}`}>
      {/* Back nav */}
      {!isProjectorMode && (
        <button
          onClick={() => navigate(-1)}
          className="self-start flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Volver al cronograma
        </button>
      )}

      {/* Presentation header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <KickoffStatusBadge status={presentation.status} type="presentation" />
            {presentation.status === 'active' && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                <KickoffElapsedTimer startDate={presentation.updated_at} />
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{presentation.title}</h2>
          {presentation.presenter_name && (
            <p className="text-slate-500 text-sm mt-1">Presentador: {presentation.presenter_name}</p>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Canva embed (2/3) */}
        <div className="lg:col-span-2">
          <KickoffCanvaEmbed
            embedUrl={presentation.canva_embed_url}
            fallbackUrl={presentation.canva_url || presentation.fallback_url}
            title={presentation.title}
          />
        </div>

        {/* Right: sidebar (1/3) */}
        <div className="flex flex-col gap-5">
          {/* Interactive block */}
          <div>
            <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">
              Contenido interactivo
            </h3>
            <KickoffInteractiveBlock
              block={activeBlock}
              totalBlocks={blocks.length}
              currentIndex={blockIndex}
            />
          </div>

          {/* Q&A access */}
          {canAskQuestions && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 flex flex-col items-center gap-4 text-center">
              <h3 className="font-semibold text-purple-800 text-sm">Sala de preguntas</h3>
              <KickoffQRCode presentationId={presentation.id} />
              <button
                onClick={() => navigate(`/dashboard/kickoff/sala/${presentation.id}`)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Ir a sala de preguntas
              </button>
            </div>
          )}

          {!canAskQuestions && presentation.status !== 'finished' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-400">
              Las preguntas se habilitan cuando el presentador abre la sala.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
