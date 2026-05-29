import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import kickoffApi from '../api/kickoffApi';
import toast from 'react-hot-toast';

const BASE_FRONTEND = window.location.origin;

export default function KickoffQRCode({ presentationId, isAdmin = false }) {
  const canvasRef  = useRef(null);
  const [token,    setToken]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const loadQr = async () => {
    setLoading(true);
    setError(null);
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
      width:  220,
      margin: 2,
      color:  { dark: '#1e293b', light: '#ffffff' },
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
      <div className="flex items-center justify-center w-[220px] h-[220px] bg-slate-50 rounded-2xl border border-slate-200 animate-pulse" />
    );
  }

  if (error || !token) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50">
        <p className="text-sm text-slate-500">QR no disponible</p>
        {isAdmin && (
          <button
            onClick={regenerate}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Generar QR
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-100">
        <canvas ref={canvasRef} />
      </div>
      <p className="text-xs text-slate-400 text-center max-w-[200px]">
        Escanea para ingresar a la sala de preguntas
      </p>
      {isAdmin && (
        <button
          onClick={regenerate}
          className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
        >
          Regenerar QR
        </button>
      )}
    </div>
  );
}
