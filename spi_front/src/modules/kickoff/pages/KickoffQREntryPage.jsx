import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import KickoffQuestionRoom from '../components/KickoffQuestionRoom';
import KickoffPresentationRatingModal from '../components/KickoffPresentationRatingModal';
import kickoffApi from '../api/kickoffApi';

const WAITING_STATUSES = ['pending', 'ready'];
const MODERATOR_ROLES  = new Set(['jefe_ti', 'admin', 'administrador']);

export default function KickoffQREntryPage() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // state: loading | waiting | rating_gate | valid | invalid
  const [state,         setState]         = useState('loading');
  const [qrData,        setQrData]        = useState(null);
  const [reason,        setReason]        = useState('');
  const [pendingRating, setPendingRating] = useState(null);
  const pollRef = useRef(null);

  const applyResult = useCallback((data) => {
    setQrData(data);
    if (data.requires_rating) {
      setPendingRating(data.requires_rating);
      setState('rating_gate');
      clearInterval(pollRef.current);
    } else if (WAITING_STATUSES.includes(data.presentation_status)) {
      setState('waiting');
    } else {
      setState('valid');
      clearInterval(pollRef.current);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(`/kickoff/sala/${token}`);
      navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
      return;
    }

    if (!token) {
      setState('invalid');
      setReason('Token no proporcionado');
      return;
    }

    const validate = () =>
      kickoffApi.validateQr(token)
        .then(res => {
          if (res.data) {
            applyResult(res.data);
          } else {
            setState('invalid');
            setReason(res.message || 'QR inválido');
            clearInterval(pollRef.current);
          }
        })
        .catch(err => {
          setState('invalid');
          setReason(err?.response?.data?.message || 'Este QR no es válido o ha expirado');
          clearInterval(pollRef.current);
        });

    validate();
    pollRef.current = setInterval(validate, 6000);
    return () => clearInterval(pollRef.current);
  }, [token, isAuthenticated, authLoading, applyResult]); // eslint-disable-line

  // After rating is submitted, re-validate to continue
  const onRatingDone = useCallback(() => {
    setPendingRating(null);
    setState('loading');
    const validate = () =>
      kickoffApi.validateQr(token)
        .then(res => {
          if (res.data) {
            applyResult(res.data);
          } else {
            setState('invalid');
            setReason(res.message || 'QR inválido');
            clearInterval(pollRef.current);
          }
        })
        .catch(() => {
          setState('invalid');
          setReason('Error al validar el acceso');
          clearInterval(pollRef.current);
        });
    validate();
    pollRef.current = setInterval(validate, 6000);
  }, [token, applyResult]);

  const isModerator = MODERATOR_ROLES.has(user?.role?.toLowerCase?.()) ||
    (user?.roles || []).some(r => MODERATOR_ROLES.has(r?.toLowerCase?.()));

  if (authLoading || state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Validando acceso…</p>
        </div>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center px-4">
        <div>
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="font-bold text-slate-800 text-xl">Acceso no válido</h2>
          <p className="text-slate-500 text-sm mt-2 max-w-sm">{reason}</p>
          <button
            onClick={() => navigate('/dashboard/kickoff')}
            className="mt-6 px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            Ir al Kick Off 2026
          </button>
        </div>
      </div>
    );
  }

  // Mandatory rating gate — must rate the previous presentation before entering
  if (state === 'rating_gate' && pendingRating) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <KickoffPresentationRatingModal
          presentationId={pendingRating.presentation_id}
          presentationTitle={pendingRating.presentation_title}
          mandatory
          onDone={onRatingDone}
        />
      </div>
    );
  }

  if (state === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center px-4">
        <div className="max-w-sm">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-5">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="font-bold text-slate-800 text-xl mb-2">Sala en preparación</h2>
          <p className="text-slate-500 text-sm mb-1">
            <strong className="text-slate-700">{qrData?.presentation_title}</strong>
          </p>
          <p className="text-slate-400 text-sm">
            {qrData?.event_name} — La sala abrirá automáticamente cuando el presentador inicie.
          </p>
          <p className="mt-5 text-xs text-purple-400 animate-pulse">Verificando cada 6 segundos…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-sm">Acceso válido</p>
            <p className="text-green-600 text-xs">
              {qrData?.event_name} — {qrData?.presentation_title}
            </p>
          </div>
        </div>

        <KickoffQuestionRoom
          presentationId={qrData?.presentation_id}
          presentationTitle={qrData?.presentation_title}
          isModerator={isModerator}
        />
      </div>
    </div>
  );
}
