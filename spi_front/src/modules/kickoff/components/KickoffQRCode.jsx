import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import kickoffApi from '../api/kickoffApi';
import toast from 'react-hot-toast';

const BASE_FRONTEND = window.location.origin;

export default function KickoffQRCode({ presentationId, isAdmin = false }) {
  const canvasRef = useRef(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const loadQr = async () => {
    setLoading(true); setError(null);
    try {
      const res = await kickoffApi.getActiveQr(presentationId);
      setToken(res.data?.token || null);
    } catch {
      setError('No se pudo cargar el QR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQr(); }, [presentationId]); // eslint-disable-line

  useEffect(() => {
    if (!token || !canvasRef.current) return;
    const url = `${BASE_FRONTEND}/kickoff/sala/${token}`;
    QRCode.toCanvas(canvasRef.current, url, {
      width:  200,
      margin: 2,
      color:  { dark: '#0a1628', light: '#ffffff' },
    });
  }, [token]);

  const regenerate = async () => {
    try {
      await kickoffApi.regenerateQr(presentationId, { expires_in_hours: 10 });
      await loadQr();
      toast.success('QR regenerado correctamente');
    } catch {
      toast.error('No se pudo regenerar el QR');
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl animate-pulse"
        style={{ width: 200, height: 200, background: '#f4f8fc', border: '1px solid #dce8f5' }}
      />
    );
  }

  if (error || !token) {
    return (
      <div
        className="flex flex-col items-center gap-3 p-5 rounded-2xl text-center"
        style={{ background: '#f4f8fc', border: '1.5px dashed #b8d0e8' }}
      >
        <p className="text-xs font-mono font-bold" style={{ color: '#6b8aaa' }}>[ QR NO DISPONIBLE ]</p>
        {isAdmin && (
          <button
            onClick={regenerate}
            className="px-4 py-1.5 text-xs font-black tracking-widest uppercase rounded-xl transition-colors"
            style={{ background: '#e8f7fc', color: '#00a8d4', border: '1px solid #b8e6f5' }}
          >
            [ GENERAR QR ]
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="p-3 rounded-2xl"
        style={{ background: '#ffffff', border: '1px solid #dce8f5', boxShadow: '0 2px 12px #0a162810' }}
      >
        <canvas ref={canvasRef} />
      </div>
      <p className="text-xs text-center max-w-[200px] font-mono" style={{ color: '#6b8aaa' }}>
        Escanea para unirte a la sala de preguntas y aportes
      </p>
      {isAdmin && (
        <button
          onClick={regenerate}
          className="text-xs font-bold font-mono tracking-wide transition-colors"
          style={{ color: '#00a8d4' }}
        >
          [ REGENERAR QR ]
        </button>
      )}
    </div>
  );
}
