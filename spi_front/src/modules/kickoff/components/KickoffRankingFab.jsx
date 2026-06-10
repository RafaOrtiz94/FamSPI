import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import kickoffApi from '../api/kickoffApi';
import Modal from '../../../core/ui/components/Modal';

// Design system tokens (DESIGN.md)
const D = {
  navalSlate:   '#1E293B',
  stormSlate:   '#334155',
  inkSlate:     '#1F2937',
  warmAsh:      '#6B7280',
  fog:          '#D1D5DB',
  softBorder:   '#E5E7EB',
  surfaceWhite: '#FFFFFF',
  paperWhite:   '#F9FAFB',
  actionBlue:   '#2563EB',
  skySignal:    '#0EA5E9',
};

const POLL_MS = 5000;

function ScoreBar({ value }) {
  if (!value) {
    return (
      <span className="text-[11px] font-mono" style={{ color: D.fog }}>
        sin votos
      </span>
    );
  }
  const pct = Math.min((parseFloat(value) / 5) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: D.softBorder }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: D.actionBlue }} />
      </div>
      <span className="text-[11px] font-mono font-semibold" style={{ color: D.inkSlate }}>
        {parseFloat(value).toFixed(1)}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-5 h-3 rounded-full flex-shrink-0" style={{ background: D.softBorder }} />
      <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: D.softBorder }} />
      <div className="flex-1 h-3 rounded-full" style={{ background: D.softBorder }} />
      <div className="w-20 h-3 rounded-full" style={{ background: D.softBorder }} />
    </div>
  );
}

function RankingContent({ eventId }) {
  const [rankings, setRankings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await kickoffApi.getAporteRankings(eventId);
      setRankings(res.data || []);
    } catch {
      setRankings([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) { setLoading(false); return; }
    setLoading(true);
    load();
    timerRef.current = setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.hidden) clearInterval(timerRef.current);
      else { load(); timerRef.current = setInterval(load, POLL_MS); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [eventId, load]);

  // Live badge header
  const liveHeader = (
    <div className="flex items-center justify-between mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: D.warmAsh }}>
        Top 10 colaboradores
      </p>
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ background: 'rgba(14,165,233,0.12)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: D.skySignal }}
        />
        <span
          className="text-[10px] font-mono font-semibold uppercase tracking-widest"
          style={{ color: D.skySignal }}
        >
          En vivo
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        {liveHeader}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${D.softBorder}`, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}
        >
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ borderBottom: i < 5 ? `1px solid ${D.softBorder}` : 'none' }}>
              <SkeletonRow />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (!rankings.length) {
    return (
      <>
        {liveHeader}
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <svg
            width="40" height="40" viewBox="0 0 24 24"
            fill="none" stroke={D.fog} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="mb-3" aria-hidden="true"
          >
            <path d="M6 9H4a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h2" />
            <path d="M18 9h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
            <path d="M6 5h12v8a6 6 0 0 1-12 0V5Z" />
            <path d="M9 21h6" /><path d="M12 17v4" />
          </svg>
          <p className="text-sm font-medium" style={{ color: D.inkSlate }}>
            Sin datos de ranking aun
          </p>
          <p className="text-xs mt-1" style={{ color: D.warmAsh }}>
            Aparece cuando haya aportes votados
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {liveHeader}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:  D.surfaceWhite,
          border:      `1px solid ${D.softBorder}`,
          boxShadow:   '0 2px 10px rgba(0,0,0,0.06)',
        }}
      >
        {rankings.slice(0, 10).map((r, idx) => {
          const initials = (r.collaborator_name || 'C').trim().charAt(0).toUpperCase();
          const isFirst  = idx === 0 && r.rating_count > 0;

          return (
            <div
              key={r.id ?? idx}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background:   isFirst ? D.paperWhite : D.surfaceWhite,
                borderBottom: idx < Math.min(rankings.length, 10) - 1
                  ? `1px solid ${D.softBorder}`
                  : 'none',
              }}
            >
              {/* Position */}
              <div className="w-5 text-center flex-shrink-0">
                {isFirst ? (
                  <svg
                    width="15" height="15" viewBox="0 0 24 24"
                    fill="none" stroke={D.actionBlue} strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="mx-auto" aria-label="Primer lugar"
                  >
                    <path d="M6 9H4a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h2" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
                    <path d="M6 5h12v8a6 6 0 0 1-12 0V5Z" />
                    <path d="M9 21h6" /><path d="M12 17v4" />
                  </svg>
                ) : (
                  <span className="text-[11px] font-mono font-medium" style={{ color: D.warmAsh }}>
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden"
                style={{
                  background: isFirst ? '#DBEAFE' : D.paperWhite,
                  color:      isFirst ? '#1D4ED8' : D.warmAsh,
                  border:     `1px solid ${isFirst ? '#BFDBFE' : D.softBorder}`,
                }}
              >
                {r.collaborator_avatar_url
                  ? <img src={r.collaborator_avatar_url} alt="" className="w-full h-full object-cover" />
                  : initials}
              </div>

              {/* Name + presentación de origen */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: D.inkSlate, fontWeight: isFirst ? 600 : 400 }}>
                  {r.collaborator_name || 'Colaborador'}
                </p>
                {r.presentation_title && (
                  <p className="text-[11px] truncate" style={{ color: D.warmAsh }}>
                    {r.presentation_title}
                  </p>
                )}
              </div>

              {/* Score */}
              <div className="flex-shrink-0">
                <ScoreBar value={r.avg_rating} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function KickoffRankingFab({ alwaysShow = false }) {
  const location  = useLocation();
  const isKickoff = alwaysShow ||
    location.pathname.startsWith('/dashboard/kickoff') ||
    location.pathname.startsWith('/kickoff/sala/');

  const [open,    setOpen]    = useState(false);
  const [eventId, setEventId] = useState(null);

  useEffect(() => {
    if (!isKickoff) return;
    kickoffApi.getCurrentEvent()
      .then(res => setEventId(res?.data?.id ?? null))
      .catch(() => setEventId(null));
  }, [isKickoff]);

  if (!isKickoff) return null;

  return (
    <>
      {/* FAB — elevated in dashboard to clear other FABs; standard position on standalone pages */}
      {!open && (
        <div className={`fixed right-4 z-[89] sm:right-6 ${alwaysShow ? 'bottom-6 sm:bottom-6' : 'bottom-40 sm:bottom-44'}`}>
          <button
            onClick={() => setOpen(true)}
            title="Ranking en vivo"
            aria-label="Ver ranking en vivo"
            className="relative flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/20 transition focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
            style={{
              background:   D.navalSlate,
              touchAction:  'manipulation',
              transition:   'background 120ms cubic-bezier(0.23,1,0.32,1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = D.stormSlate; }}
            onMouseLeave={e => { e.currentTarget.style.background = D.navalSlate; }}
          >
            <svg
              width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="white" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9H4a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h2" />
              <path d="M18 9h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
              <path d="M6 5h12v8a6 6 0 0 1-12 0V5Z" />
              <path d="M9 21h6" />
              <path d="M12 17v4" />
            </svg>
          </button>
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Ranking de Aportes"
        maxWidth="max-w-md"
      >
        <RankingContent eventId={eventId} />
      </Modal>
    </>
  );
}
