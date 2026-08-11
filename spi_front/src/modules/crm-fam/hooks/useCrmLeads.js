import { useState, useEffect, useCallback } from "react";
import { fetchLeads, fetchLeadById } from "../../../core/api/crmFamApi";

export function useLeads(params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchLeads(params));
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]); // ponytail: stringify deps

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}

export function useLead(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchLeadById(id));
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}
