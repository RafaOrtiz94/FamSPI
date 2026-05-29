import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import KickoffWelcomeScreen from '../components/KickoffWelcomeScreen';
import KickoffScheduleIndex from '../components/KickoffScheduleIndex';
import KickoffAdminConfig from '../components/KickoffAdminConfig';
import { useKickoffEventPolling } from '../hooks/useKickoffPolling';

const ADMIN_ROLES = new Set(['jefe_ti', 'admin', 'administrador']);

export default function KickoffPage() {
  const { user }           = useAuth();
  const [searchParams]     = useSearchParams();
  const [welcomed, setW]   = useState(false);
  const [tab, setTab]      = useState('schedule'); // schedule | admin

  const { event, presentations, loading, error } = useKickoffEventPolling();

  const isAdmin       = ADMIN_ROLES.has(user?.role?.toLowerCase?.()) ||
                        (user?.roles || []).some(r => ADMIN_ROLES.has(r?.toLowerCase?.()));
  const isProjector   = searchParams.get('mode') === 'projector';
  const firstName     = user?.fullname?.split(' ')[0] || user?.email?.split('@')[0] || 'colaborador';

  // Skip welcome if ?nowelcome param set (for re-renders / projector mode)
  const skipWelcome = searchParams.get('nowelcome') === '1' || isProjector;

  useEffect(() => {
    if (skipWelcome) setW(true);
  }, [skipWelcome]);

  return (
    <>
      {/* Welcome animation */}
      {!welcomed && (
        <KickoffWelcomeScreen userName={firstName} onDone={() => setW(true)} />
      )}

      {/* Main content */}
      <div className={`min-h-screen bg-slate-50 transition-opacity duration-500 ${welcomed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isProjector ? 'text-xl' : ''}`}>

          {/* Page header */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Kick Off{' '}
                <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}>
                  2026
                </span>
              </h1>
              <p className="text-slate-500 text-sm mt-1">Proyecciones FAM — Evento interno</p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTab('schedule')}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                    tab === 'schedule' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Cronograma
                </button>
                <button
                  onClick={() => setTab('admin')}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                    tab === 'admin' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  ⚙ Configurar
                </button>
              </div>
            )}
          </div>

          {/* Loading state */}
          {loading && tab === 'schedule' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded-full w-3/4 mb-3" />
                  <div className="h-3 bg-slate-100 rounded-full w-1/2 mb-2" />
                  <div className="h-8 bg-slate-100 rounded-xl mt-4" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && tab === 'schedule' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center max-w-md mx-auto mt-8">
              <div className="text-4xl mb-4">🔒</div>
              <p className="font-semibold text-slate-800 text-lg mb-1">Módulo no disponible aún</p>
              <p className="text-slate-500 text-sm">
                El Kick Off 2026 estará disponible para todos el día del evento.<br />
                Si crees que deberías tener acceso, contacta al área de TI.
              </p>
            </div>
          )}

          {/* Main content */}
          {!loading && tab === 'schedule' && (
            <KickoffScheduleIndex
              event={event}
              presentations={presentations}
              currentUserId={user?.id}
            />
          )}

          {tab === 'admin' && isAdmin && (
            <KickoffAdminConfig eventId={event?.id} />
          )}
        </div>
      </div>
    </>
  );
}
