import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import KickoffPresenterPanel from '../components/KickoffPresenterPanel';
import KickoffPresenterRemote from '../components/KickoffPresenterRemote';
import { KickoffAutoStartCountdown } from '../components/KickoffTimer';
import { useKickoffPolling } from '../hooks/useKickoffPolling';

const ADMIN_ROLES = new Set(['jefe_ti', 'admin', 'administrador']);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function KickoffPresentationPage() {
  const { presentationId } = useParams();
  const { user }           = useAuth();
  const navigate           = useNavigate();
  const isMobile = useIsMobile();

  return (
    <KickoffPresentationInner
      presentationId={presentationId}
      user={user}
      navigate={navigate}
      isMobile={isMobile}
    />
  );
}

function KickoffPresentationInner({ presentationId, user, navigate, isMobile }) {
  const { presentation, questions, loading, error, refresh } = useKickoffPolling(presentationId);

  const isAdmin     = ADMIN_ROLES.has(user?.role?.toLowerCase?.()) ||
                      (user?.roles || []).some(r => ADMIN_ROLES.has(r?.toLowerCase?.()));
  const isPresenter = presentation?.presenter_user_id === user?.id;
  const showPanel   = isAdmin || isPresenter;

  // Redirigir a los no-presentadores a la sala de preguntas
  useEffect(() => {
    if (!loading && !showPanel && presentation) {
      navigate(`/dashboard/kickoff/sala/${presentationId}`, { replace: true });
    }
  }, [loading, showPanel, presentation, presentationId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-700 font-medium">No se pudo cargar la presentación</p>
          <p className="text-slate-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Presentador en móvil → remote clicker
  if (showPanel && isMobile) {
    return (
      <>
        <KickoffAutoStartCountdown presentation={presentation} />
        <KickoffPresenterRemote presentation={presentation} onRefresh={refresh} />
      </>
    );
  }

  // Presentador en escritorio → panel completo
  if (showPanel) {
    return (
      <>
        <KickoffAutoStartCountdown presentation={presentation} />
        <div className="min-h-screen bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <KickoffPresenterPanel presentation={presentation} questions={questions} onRefresh={refresh} />
          </div>
        </div>
      </>
    );
  }

  // No-presentadores: redirigen via useEffect, spinner mientras tanto
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
