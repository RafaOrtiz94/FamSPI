import { useCallback, useEffect, useRef, useState } from 'react';
import { getEquipmentPurchaseById, getEquipmentPurchaseTimeline } from '../../../../core/api/equipmentPurchasesApi';
import { getPrivatePurchaseById, getPrivatePurchaseTimeline } from '../../../../core/api/privatePurchasesApi';
import { getBusinessCaseStateHistory } from '../../../../core/api/businessCaseApi';

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
      const data = await (type === 'public'
        ? getEquipmentPurchaseById(id)
        : getPrivatePurchaseById(id));
      const businessCaseId = data?.business_case_gate?.business_case_id || data?.business_case_id || null;
      const [tl, businessCaseHistory] = await Promise.all([
        type === 'public'
          ? getEquipmentPurchaseTimeline(id).catch(() => null)
          : getPrivatePurchaseTimeline(id).catch(() => null),
        businessCaseId
          ? getBusinessCaseStateHistory(businessCaseId).catch(() => null)
          : Promise.resolve(null),
      ]);
      const purchaseEvents = Array.isArray(tl)
        ? tl
        : Array.isArray(tl?.events)
        ? tl.events
        : Array.isArray(tl?.rows)
        ? tl.rows
        : [];
      const businessCaseEvents = (businessCaseHistory?.history || []).map((event) => ({
        ...event,
        type: 'business_case_state_transition',
        action: `Business Case: ${event.from_state || 'inicio'} → ${event.to_state || 'actualizado'}`,
        timestamp: event.transitioned_at,
        source: 'business_case',
      }));
      setPurchase(data);
      setTimeline({
        ...(tl && !Array.isArray(tl) ? tl : {}),
        events: [...purchaseEvents, ...businessCaseEvents],
        business_case_id: businessCaseId,
      });
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
