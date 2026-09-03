import { useState, useEffect, useRef, useCallback } from 'react';
import kickoffApi from '../api/kickoffApi';

const POLL_MS = 4000;

/**
 * Polls the current presentation state (active block + questions) every POLL_MS ms.
 * Pauses automatically when the browser tab is hidden to avoid unnecessary requests.
 */
export function useKickoffPolling(presentationId, { enabled = true } = {}) {
  const [presentation, setPresentation] = useState(null);
  const [questions,    setQuestions]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const timerRef  = useRef(null);
  const activeRef = useRef(enabled);

  const fetchAll = useCallback(async () => {
    if (!presentationId || !activeRef.current) return;
    try {
      const [presRes, qRes] = await Promise.all([
        kickoffApi.getPresentation(presentationId),
        kickoffApi.getQuestions(presentationId),
      ]);
      setPresentation(presRes.data);
      setQuestions(qRes.data || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [presentationId]);

  useEffect(() => {
    activeRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!presentationId) return;

    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_MS);

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
      } else {
        fetchAll();
        timerRef.current = setInterval(fetchAll, POLL_MS);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [presentationId, fetchAll]);

  return { presentation, questions, loading, error, refresh: fetchAll };
}

/**
 * Polls the current active event and its presentations.
 */
export function useKickoffEventPolling({ enabled = true } = {}) {
  const [event,         setEvent]         = useState(null);
  const [presentations, setPresentations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const timerRef = useRef(null);

  const blockedRef = useRef(false);

  const fetchEvent = useCallback(async () => {
    if (!enabled || blockedRef.current) return;
    try {
      const evtRes = await kickoffApi.getCurrentEvent();
      const evt    = evtRes.data;
      setEvent(evt);
      setError(null);

      if (evt?.id) {
        const presRes = await kickoffApi.getPresentations(evt.id);
        setPresentations(presRes.data || []);
      } else {
        setPresentations([]);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) {
        // Stop polling — access denied, no point retrying
        blockedRef.current = true;
        clearInterval(timerRef.current);
      }
      setError(err?.response?.data?.message || 'Error al cargar el evento');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchEvent();
    timerRef.current = setInterval(fetchEvent, POLL_MS);

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
      } else {
        fetchEvent();
        timerRef.current = setInterval(fetchEvent, POLL_MS);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchEvent]);

  return { event, presentations, loading, error, refresh: fetchEvent };
}
