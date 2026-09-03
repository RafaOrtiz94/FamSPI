import { useState, useEffect, useCallback } from "react";
import { fetchBlueSheetByOpportunity } from "../../../core/api/crmFamApi";

export function useBlueSheet(opportunityId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!opportunityId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBlueSheetByOpportunity(opportunityId));
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}
