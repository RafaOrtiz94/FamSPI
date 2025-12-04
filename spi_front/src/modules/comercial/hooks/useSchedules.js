import { useEffect, useState, useCallback } from "react";
import {
  fetchSchedules,
  fetchScheduleDetail,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  submitSchedule,
  addScheduledVisit,
  updateScheduledVisit,
  deleteScheduledVisit,
} from "../../../core/api/schedulesApi";

export const useSchedules = ({ skipLoad = false } = {}) => {
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [error, setError] = useState(null);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSchedules();
      setSchedules(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los cronogramas");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScheduleDetail = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScheduleDetail(id);
      setActiveSchedule(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el cronograma");
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (payload) => {
      setLoading(true);
      setError(null);
      try {
        const data = await createSchedule(payload);
        await loadSchedules();
        setActiveSchedule(data);
        return data;
      } catch (err) {
        setError(err.message || "No se pudo crear el cronograma");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const update = useCallback(
    async (id, payload) => {
      setLoading(true);
      setError(null);
      try {
        const data = await updateSchedule(id, payload);
        await loadScheduleDetail(id);
        return data;
      } catch (err) {
        setError(err.message || "No se pudo actualizar el cronograma");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadScheduleDetail],
  );

  const remove = useCallback(
    async (id) => {
      setLoading(true);
      setError(null);
      try {
        await deleteSchedule(id);
        const refreshed = await fetchSchedules();
        setSchedules(refreshed);
        setActiveSchedule((current) => {
          if (current?.id !== id) return current;
          return refreshed[0] || null;
        });
      } catch (err) {
        setError(err.message || "No se pudo eliminar el cronograma");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const submit = useCallback(
    async (id) => {
      setLoading(true);
      setError(null);
      try {
        const data = await submitSchedule(id);
        await loadScheduleDetail(id);
        return data;
      } catch (err) {
        setError(err.message || "No se pudo enviar el cronograma");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadScheduleDetail],
  );

  const addVisit = useCallback(
    async (id, payload) => {
      setLoading(true);
      setError(null);
      try {
        const data = await addScheduledVisit(id, payload);
        await loadScheduleDetail(id);
        return data;
      } catch (err) {
        setError(err.message || "No se pudo agregar la visita");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadScheduleDetail],
  );

  const updateVisit = useCallback(
    async (id, visitId, payload) => {
      setLoading(true);
      setError(null);
      try {
        const data = await updateScheduledVisit(id, visitId, payload);
        await loadScheduleDetail(id);
        return data;
      } catch (err) {
        setError(err.message || "No se pudo actualizar la visita");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadScheduleDetail],
  );

  const removeVisit = useCallback(
    async (id, visitId) => {
      setLoading(true);
      setError(null);
      try {
        await deleteScheduledVisit(id, visitId);
        await loadScheduleDetail(id);
      } catch (err) {
        setError(err.message || "No se pudo eliminar la visita");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadScheduleDetail],
  );

  useEffect(() => {
    if (skipLoad) return;
    loadSchedules();
  }, [loadSchedules, skipLoad]);

  return {
    schedules,
    activeSchedule,
    loading,
    error,
    loadSchedules,
    loadScheduleDetail,
    create,
    update,
    remove,
    submit,
    addVisit,
    updateVisit,
    removeVisit,
  };
};

export default useSchedules;
