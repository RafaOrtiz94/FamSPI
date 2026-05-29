import React, { useEffect, useState } from 'react';

const SHOW_MS  = 2800;
const FADE_MS  = 600;

/**
 * Full-screen animated welcome screen.
 * Calls onDone() after the exit animation completes.
 */
export default function KickoffWelcomeScreen({ userName, onDone }) {
  const [phase, setPhase] = useState('enter'); // enter | hold | exit

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), SHOW_MS);
    const t2 = setTimeout(() => onDone?.(), SHOW_MS + FADE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line

  const base   = 'fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity';
  const hidden = phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100';

  return (
    <div
      className={`${base} ${hidden}`}
      style={{ transitionDuration: `${FADE_MS}ms`, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}
    >
      {/* Particle grid decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
      </div>

      {/* Logo / event brand */}
      <div className="relative flex flex-col items-center gap-6 px-8 text-center"
        style={{ animation: 'kickoffFadeUp 0.7s ease-out forwards' }}>

        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          <span className="text-3xl select-none">🚀</span>
        </div>

        <div>
          <p className="text-blue-300 text-sm font-semibold tracking-widest uppercase mb-2">
            FAM — Evento interno
          </p>
          <h1 className="text-white text-5xl md:text-6xl font-black tracking-tight leading-none">
            Kick Off
            <span className="text-transparent bg-clip-text ml-3"
              style={{ backgroundImage: 'linear-gradient(90deg, #60a5fa, #a78bfa)' }}>
              2026
            </span>
          </h1>
        </div>

        <div className="mt-4 flex flex-col items-center gap-1">
          <p className="text-slate-400 text-base">Bienvenido</p>
          <p className="text-white text-2xl md:text-3xl font-bold">
            Hola Agente{' '}
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #60a5fa, #a78bfa)' }}>
              {userName || ''}
            </span>
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-0.5 bg-white/10 rounded-full overflow-hidden mt-6">
          <div
            className="h-full rounded-full"
            style={{
              background:  'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              animation:   `kickoffProgress ${SHOW_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes kickoffFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes kickoffProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0ms !important; }
        }
      `}</style>
    </div>
  );
}
