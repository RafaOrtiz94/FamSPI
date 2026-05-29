import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import KickoffPresenterPanel from '../components/KickoffPresenterPanel';
import KickoffPresentationView from '../components/KickoffPresentationView';
import { useKickoffPolling } from '../hooks/useKickoffPolling';

const ADMIN_ROLES = new Set(['jefe_ti', 'admin', 'administrador']);

export default function KickoffPresentationPage() {
  const { presentationId }       = useParams();
  const { user }                 = useAuth();
  const [searchParams]           = useSearchParams();
  const isProjector              = searchParams.get('mode') === 'projector';

  const { presentation, questions, loading, error, refresh } = useKickoffPolling(presentationId);

  const isAdmin     = ADMIN_ROLES.has(user?.role?.toLowerCase?.()) ||
                      (user?.roles || []).some(r => ADMIN_ROLES.has(r?.toLowerCase?.()));
  const isPresenter = presentation?.presenter_user_id === user?.id;
  const showPanel   = isAdmin || isPresenter;

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

  return (
    <div className={`min-h-screen bg-slate-50 ${isProjector ? 'text-lg' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showPanel ? (
          <KickoffPresenterPanel
            presentation={presentation}
            questions={questions}
            onRefresh={refresh}
          />
        ) : (
          <KickoffPresentationView
            presentation={presentation}
            isProjectorMode={isProjector}
          />
        )}
      </div>
    </div>
  );
}
