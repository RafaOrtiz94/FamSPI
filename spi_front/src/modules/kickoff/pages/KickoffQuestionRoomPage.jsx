import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import KickoffQuestionRoom from '../components/KickoffQuestionRoom';
import { KickoffAutoStartCountdown } from '../components/KickoffTimer';
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

  const canJoin = ['active', 'questions_open', 'questions_closed', 'finished'].includes(presentation?.status);

  if (!canJoin && !isModerator) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4" style={{ background: '#f4f8fc' }}>
        <div>
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="font-bold text-lg" style={{ color: '#0a1628' }}>Presentación no iniciada</h2>
          <p className="text-sm mt-2" style={{ color: '#6b8aaa' }}>
            La sala estará disponible cuando el presentador inicie la presentación.
          </p>
          <button onClick={() => navigate('/dashboard/kickoff')} className="mt-4 text-xs font-mono font-bold" style={{ color: '#00a8d4' }}>
            ← VOLVER AL CRONOGRAMA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f4f8fc' }}>
      <KickoffAutoStartCountdown presentation={presentation} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-xs font-bold font-mono tracking-widest uppercase transition-colors"
          style={{ color: '#6b8aaa' }}
        >
          ← VOLVER
        </button>
        <KickoffQuestionRoom
          presentationId={presentationId}
          presentationTitle={presentation?.title}
          isModerator={isModerator}
          isPresenter={isPresenter}
        />
      </div>
    </div>
  );
}
