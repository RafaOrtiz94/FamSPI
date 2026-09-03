import React, { useRef, useState, useEffect } from 'react';
import welcomeVideo from '../../../assets/VID-20260529-WA0006.mp4';
import welcomeVideoMobile from '../../../assets/famMovile.mp4';

const FADE_MS = 600;

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export default function KickoffWelcomeScreen({ onDone }) {
  const videoRef  = useRef(null);
  const [showBtn,     setShowBtn]     = useState(false);
  const [blocked,     setBlocked]     = useState(false);
  const [exiting,     setExiting]     = useState(false);
  const [videoSrc,    setVideoSrc]    = useState(null);

  useEffect(() => {
    setVideoSrc(isMobile() ? welcomeVideoMobile : welcomeVideo);
  }, []);

  useEffect(() => {
    if (!videoSrc) return;
    const video = videoRef.current;
    if (!video) return;

    video.load();
    video.play().catch(() => {
      setBlocked(true);
    });
  }, [videoSrc]);

  const handleEnded = () => setShowBtn(true);
  const handleError = () => setShowBtn(true); // fallo de carga → saltar directo al botón

  const handleManualPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setBlocked(false);
    video.play().catch(() => setShowBtn(true));
  };

  const handleContinue = () => {
    setExiting(true);
    setTimeout(() => onDone?.(), FADE_MS);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black transition-opacity"
      style={{ transitionDuration: `${FADE_MS}ms`, opacity: exiting ? 0 : 1, pointerEvents: exiting ? 'none' : 'auto' }}
    >
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          onEnded={handleEnded}
          onError={handleError}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Overlay de play manual cuando autoplay es bloqueado */}
      {blocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <button
            onClick={handleManualPlay}
            className="flex flex-col items-center gap-3 text-white"
          >
            <span className="w-20 h-20 rounded-full border-2 border-white/70 flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="text-sm font-medium tracking-wide opacity-80">Toca para reproducir</span>
          </button>
        </div>
      )}

      {/* Botón Entrar — aparece al terminar el video */}
      {showBtn && (
        <div className="absolute inset-0 flex items-end justify-center pb-16" style={{ animation: 'kwFadeIn 0.4s ease-out forwards' }}>
          <button
            onClick={handleContinue}
            className="px-10 py-3 rounded-full font-bold text-lg shadow-2xl cursor-pointer tracking-wide"
            style={{ background: '#e8b820', color: '#ffffff', backdropFilter: 'blur(8px)', border: '2px solid rgba(232,184,32,0.6)', boxShadow: '0 0 24px rgba(232,184,32,0.5)' }}
          >
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              Entrar
            </span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes kwFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
