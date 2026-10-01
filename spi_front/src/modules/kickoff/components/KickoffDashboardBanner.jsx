import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SESSION_KEY = 'kickoff_banner_dismissed_2026';

export default function KickoffDashboardBanner() {
  const [dismissed, setDismissed] = useState(
    () => !!sessionStorage.getItem(SESSION_KEY)
  );
  const navigate = useNavigate();

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 60%, #0a1628 100%)', borderBottom: '1px solid #1a2d45' }}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
        {/* Pulse dot */}
        <span className="hidden sm:flex flex-shrink-0 h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: '#00a8d4' }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#00a8d4' }} />
        </span>

        {/* Tag */}
        <span
          className="hidden sm:inline-flex flex-shrink-0 items-center text-xs font-black tracking-widest font-mono px-2.5 py-1 rounded-full"
          style={{ background: '#00a8d414', color: '#00a8d4', border: '1px solid #00a8d440' }}
        >
          KICK OFF 2026
        </span>

        {/* Message */}
        <p className="flex-1 text-sm font-semibold truncate" style={{ color: '#c8dff5' }}>
          <span className="font-black" style={{ color: '#ffffff' }}>Misión Posible · Agentes de Cambio</span>
          <span className="hidden sm:inline" style={{ color: '#6b8aaa' }}> — El evento Kick Off 2026 está activo. Únete ahora.</span>
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate('/dashboard/kickoff')}
          className="flex-shrink-0 px-4 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: '#00a8d4', color: '#ffffff' }}
        >
          Acceder
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10"
          aria-label="Cerrar"
          style={{ color: '#4a6080' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
