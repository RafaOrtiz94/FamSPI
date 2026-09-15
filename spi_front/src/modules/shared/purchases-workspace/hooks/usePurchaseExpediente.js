import { useCallback, useEffect, useRef, useState } from 'react';
import { getEquipmentPurchaseById, getEquipmentPurchaseTimeline } from '../../../../core/api/equipmentPurchasesApi';
import { getPrivatePurchaseById, getPrivatePurchaseTimeline } from '../../../../core/api/privatePurchasesApi';

const STALE_MS = 30_000;

const usePurchaseExpediente = (id, type) => {
  const [purchase,  setPurchase]  = useState(null);
  const [timeline,  setTimeline]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const fetchedAt   = useRef(null);
  const abortRef    = useRef(null);

  const fetchPurchase = useCallback(async (force = false) => {
    if (!id || !type) return;
    const now = Date.now();
    if (!force && fetchedAt.current && now - fetchedAt.current < STALE_MS) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const [data, tl] = await Promise.all([
        type === 'public'
          ? getEquipmentPurchaseById(id)
          : getPrivatePurchaseById(id),
        type === 'public'
          ? getEquipmentPurchaseTimeline(id).catch(() => null)
          : getPrivatePurchaseTimeline(id).catch(() => null),
      ]);
      setPurchase(data);
      setTimeline(tl);
      fetchedAt.current = Date.now();
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Error cargando expediente');
      }
    } finally {
      setLoading(false);
    }
  }, [id, type]);

  useEffect(() => {
    fetchPurchase();
    return () => abortRef.current?.abort();
  }, [fetchPurchase]);

  const refresh = useCallback(() => fetchPurchase(true), [fetchPurchase]);

  return { purchase, timeline, loading, error, refresh };
};

export default usePurchaseExpediente;
