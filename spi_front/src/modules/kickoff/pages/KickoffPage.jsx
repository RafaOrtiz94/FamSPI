import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import KickoffScheduleIndex from '../components/KickoffScheduleIndex';
import KickoffAdminConfig from '../components/KickoffAdminConfig';
import KickoffEventPicker from '../components/KickoffEventPicker';
import KickoffSummaryPanel from '../components/KickoffSummaryPanel';
import KickoffPostEventQA from '../components/KickoffPostEventQA';
import { useKickoffEventPolling } from '../hooks/useKickoffPolling';

const ADMIN_ROLES  = new Set(['jefe_ti', 'admin', 'administrador']);
const REPORT_ROLES = new Set(['jefe_ti', 'gerencia_general']);

export default function KickoffPage() {
  const { user }       = useAuth();
  const [searchParams] = useSearchParams();
  const role           = user?.role?.toLowerCase?.() || '';

  const isAdmin      = ADMIN_ROLES.has(role) || (user?.roles || []).some(r => ADMIN_ROLES.has(r?.toLowerCase?.()));
  const isTiAdmin    = role === 'jefe_ti';
  const isGerencia   = role === 'gerencia_general';
  const canReport    = REPORT_ROLES.has(role); // puede ver resumen y responder preguntas
  const isProjector  = searchParams.get('mode') === 'projector';

  // Tabs disponibles según rol
  const tabs = isAdmin
    ? [
        { key: 'schedule', label: '[ CRONOGRAMA ]' },
        { key: 'qa',       label: '[ PREGUNTAS ]' },
        { key: 'summary',  label: '[ RESUMEN ]' },
        { key: 'admin',    label: '[ CONFIGURAR ]' },
      ]
    : isGerencia
      ? [
          { key: 'qa',      label: '[ RESPONDER PREGUNTAS ]' },
          { key: 'summary', label: '[ EXPORTAR REPORTE ]' },
        ]
      : [];

  const defaultTab = isGerencia ? 'qa' : 'schedule';
  const [tab, setTab]  = useState(defaultTab);
  const [adminEventId, setAdminEventId] = useState(null);

  const { event, presentations, loading, error } = useKickoffEventPolling();

  return (
    <div className="min-h-screen" style={{ background: '#f4f8fc' }}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isProjector ? 'text-xl' : ''}`}>

        {/* Page header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-widest font-mono mb-1" style={{ color: '#6b8aaa' }}>
              FAM PROJECT · EVENTO INTERNO
            </p>
            <h1 className="text-3xl font-black tracking-tight" style={{ color: '#0a1628' }}>
              Kick Off{' '}
              <span style={{ color: '#00a8d4' }}>2026</span>
            </h1>
            <p className="text-xs font-mono mt-1" style={{ color: '#6b8aaa' }}>
              MISIÓN POSIBLE · AGENTES DE CAMBIO
            </p>
          </div>

          {tabs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="px-4 py-2 text-xs font-black tracking-widest uppercase rounded-xl transition-colors font-mono"
                  style={
                    tab === t.key
                      ? { background: '#00a8d4', color: '#fff', border: '1px solid #00a8d4' }
                      : { background: '#fff', color: '#6b8aaa', border: '1px solid #dce8f5' }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
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

        {/* Error */}
        {error && tab === 'schedule' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center max-w-md mx-auto mt-8">
            <div className="text-4xl mb-4">🔒</div>
            <p className="font-semibold text-slate-800 text-lg mb-1">Módulo no disponible</p>
            <p className="text-slate-500 text-sm">
              Si crees que deberías tener acceso, contacta al área de TI.
            </p>
          </div>
        )}

        {/* Tab: Cronograma */}
        {tab === 'schedule' && !loading && (
          <KickoffScheduleIndex
            event={event}
            presentations={presentations}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            isTiAdmin={isTiAdmin}
          />
        )}

        {/* Tab: Preguntas (responder) */}
        {tab === 'qa' && canReport && (
          <KickoffPostEventQA eventId={event?.id} />
        )}

        {/* Tab: Resumen / Exportar */}
        {tab === 'summary' && canReport && (
          <KickoffSummaryPanel eventId={event?.id} eventName={event?.name} />
        )}

        {/* Tab: Configurar (solo jefe_ti) */}
        {tab === 'admin' && isTiAdmin && (
          adminEventId === null
            ? <KickoffEventPicker
                currentEventId={event?.id}
                onSelect={id => setAdminEventId(id)}
              />
            : <KickoffAdminConfig
                eventId={adminEventId}
                onBack={() => setAdminEventId(null)}
              />
        )}
      </div>
    </div>
  );
}
