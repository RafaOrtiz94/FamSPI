import React, { useState } from 'react';
import kickoffApi from '../api/kickoffApi';
import KickoffStarRating from './KickoffStarRating';
import toast from 'react-hot-toast';

const PARAMS = [
  { key: 'impacto',   label: 'Impacto',                desc: '¿Qué tan relevante fue el tema para ti?' },
  { key: 'contenido', label: 'Contenido',              desc: '¿La información fue clara y bien estructurada?' },
  { key: 'destreza',  label: 'Destreza del presentador', desc: '¿Cómo calificarías las habilidades del presentador?' },
];

export default function KickoffPresentationRatingModal({ presentationId, presentationTitle, onDone, mandatory = false }) {
  const [ratings, setRatings] = useState({ impacto: 0, contenido: 0, destreza: 0 });
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);

  const allSet = PARAMS.every(p => ratings[p.key] > 0);

  const submit = async () => {
    if (!allSet) { toast.error('Por favor califica los 3 parámetros'); return; }
    setSaving(true);
    try {
      await kickoffApi.ratePresentation(presentationId, ratings);
      setDone(true);
      toast.success('¡Gracias por tu calificación!');
      setTimeout(() => onDone?.(), 2000);
    } catch (err) {
      const msg = err?.response?.data?.message || 'No se pudo guardar la calificación';
      if (err?.response?.status === 409 || msg.includes('ya calific')) {
        setDone(true);
        onDone?.();
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-xl font-black text-slate-900 mb-2">¡Gracias!</h3>
          <p className="text-slate-500 text-sm">Tu calificación fue registrada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl mb-3">
            ⭐
          </div>
          <h3 className="text-xl font-black text-slate-900">Califica la presentación</h3>
          <p className="text-slate-500 text-sm mt-1 leading-snug">
            <strong className="text-slate-700">{presentationTitle}</strong> ha finalizado.
            {mandatory
              ? ' Califica esta presentación para poder unirte a la siguiente.'
              : ' Tu opinión ayuda a mejorar.'}
          </p>
        </div>

        {/* Rating params */}
        <div className="flex flex-col gap-5 mb-6">
          {PARAMS.map(param => (
            <div key={param.key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{param.label}</p>
                <p className="text-xs text-slate-400 leading-snug">{param.desc}</p>
              </div>
              <div className="flex-shrink-0">
                <KickoffStarRating
                  value={ratings[param.key]}
                  onChange={v => setRatings(r => ({ ...r, [param.key]: v }))}
                  size="md"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!mandatory && (
            <button
              onClick={() => onDone?.()}
              className="flex-1 py-2.5 text-sm font-medium text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Ahora no
            </button>
          )}
          <button
            disabled={saving || !allSet}
            onClick={submit}
            className={`py-2.5 text-sm font-semibold bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mandatory ? 'w-full' : 'flex-1'}`}
          >
            {saving ? 'Guardando…' : 'Enviar calificación'}
          </button>
        </div>
        {mandatory && !allSet && (
          <p className="text-center text-xs text-slate-400 mt-2">
            Selecciona las 3 calificaciones para continuar
          </p>
        )}
      </div>
    </div>
  );
}
