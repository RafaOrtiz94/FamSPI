import { useState, useEffect, useCallback } from "react";
import { fetchCrmDashboard, fetchCrmPipeline } from "../../../core/api/crmFamApi";

export function useCrmDashboard() {
  const [data, setData] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, pipelineData] = await Promise.all([
        fetchCrmDashboard(),
        fetchCrmPipeline(),
      ]);
      setData(dashData);
      setPipeline(pipelineData);
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, pipeline, loading, error, refresh: load };
}
