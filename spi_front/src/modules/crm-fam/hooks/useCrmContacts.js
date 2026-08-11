import { useState, useEffect, useCallback } from "react";
import { fetchContacts } from "../../../core/api/crmFamApi";

export function useContacts(params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchContacts(params));
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
