import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import KickoffQuestionRoom from '../components/KickoffQuestionRoom';
import kickoffApi from '../api/kickoffApi';

const ADMIN_ROLES = new Set(['jefe_ti', 'admin', 'administrador']);

export default function KickoffQuestionRoomPage() {
  const { presentationId }  = useParams();
  const { user }            = useAuth();
  const navigate            = useNavigate();

  const [presentation, setPres] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!presentationId) return;
    kickoffApi.getPresentation(presentationId)
      .then(res => setPres(res.data))
      .catch(() => setError('No se pudo cargar esta sala de preguntas'))
      .finally(() => setLoading(false));
  }, [presentationId]);

  const isAdmin     = ADMIN_ROLES.has(user?.role?.toLowerCase?.()) ||
                      (user?.roles || []).some(r => ADMIN_ROLES.has(r?.toLowerCase?.()));
  const isPresenter = presentation?.presenter_user_id === user?.id;
  const isModerator = isAdmin || isPresenter;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center px-4">
        <div>
          <div className="text-4xl mb-4">❌</div>
          <p className="font-semibold text-slate-700">{error}</p>
          <button onClick={() => navigate('/dashboard/kickoff')} className="mt-4 text-sm text-blue-600 hover:underline">
            Volver al cronograma
          </button>
        </div>
      </div>
    );
  }

  const canJoin = ['active', 'questions_open'].includes(presentation?.status);

  if (!canJoin && !isModerator) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center px-4">
        <div>
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="font-bold text-slate-800 text-lg">Sala cerrada</h2>
          <p className="text-slate-500 text-sm mt-2">
            La sala de preguntas no está activa en este momento.<br />
            Estado actual: <strong>{presentation?.status}</strong>
          </p>
          <button onClick={() => navigate('/dashboard/kickoff')} className="mt-4 text-sm text-blue-600 hover:underline">
            Volver al cronograma
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Volver a la presentación
        </button>
        <KickoffQuestionRoom
          presentationId={presentationId}
          presentationTitle={presentation?.title}
          isModerator={isModerator}
        />
      </div>
    </div>
  );
}
