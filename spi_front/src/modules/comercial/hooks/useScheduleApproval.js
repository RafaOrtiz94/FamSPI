import { useEffect, useState, useCallback } from "react";
import {
  fetchPendingSchedules,
  approveSchedule,
  rejectSchedule,
  fetchTeamSchedules,
  fetchScheduleAnalytics,
} from "../../../core/api/schedulesApi";

export const useScheduleApproval = () => {
  const [pending, setPending] = useState([]);
  const [teamSchedules, setTeamSchedules] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingSchedules();
      setPending(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los cronogramas pendientes");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeamSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTeamSchedules(await fetchTeamSchedules());
    } catch (err) {
      setError(err.message || "No se pudo cargar la vista de equipo");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalytics(await fetchScheduleAnalytics());
    } catch (err) {
      setError(err.message || "No se pudieron cargar las métricas");
    }
  }, []);

  const approve = useCallback(
    async (id) => {
      setLoading(true);
      setError(null);
      try {
        const data = await approveSchedule(id);
        await Promise.all([loadPending(), loadTeamSchedules(), loadAnalytics()]);
        return data;
      } catch (err) {
        setError(err.message || "No se pudo aprobar el cronograma");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadPending, loadTeamSchedules, loadAnalytics],
  );

  const reject = useCallback(
    async (id, reason) => {
      setLoading(true);
      setError(null);
      try {
        const data = await rejectSchedule(id, reason);
        await Promise.all([loadPending(), loadTeamSchedules(), loadAnalytics()]);
        return data;
      } catch (err) {
        setError(err.message || "No se pudo rechazar el cronograma");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadPending, loadTeamSchedules, loadAnalytics],
  );

  useEffect(() => {
    loadPending();
    loadTeamSchedules();
    loadAnalytics();
  }, [loadPending, loadTeamSchedules, loadAnalytics]);

  return { pending, teamSchedules, analytics, loading, error, approve, reject, loadPending };
};

export default useScheduleApproval;
