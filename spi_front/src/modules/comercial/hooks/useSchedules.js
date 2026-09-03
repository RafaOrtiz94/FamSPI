import { useEffect, useState, useCallback } from "react";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../core/api";
import {
 fetchSchedules,
 fetchScheduleHolidays,
 fetchScheduleDetail,
 createSchedule,
 updateSchedule,
 deleteSchedule,
 submitSchedule,
 addScheduledVisit,
 syncScheduleWeekCity,
 updateScheduledVisit,
 deleteScheduledVisit,
} from "../../../core/api/schedulesApi";

const cloneActive = (schedule) => {
 if (!schedule) return null;
 return {
 ...schedule,
 visits: Array.isArray(schedule.visits) ? [...schedule.visits] : [],
 };
};

const normalizeVisitPayload = (payload = {}) => ({
 client_request_id: Number(payload.client_request_id ?? payload.clientRequestId ?? 0) || null,
 planned_date: String(payload.planned_date ?? payload.plannedDate ?? "").slice(0, 10),
 city: payload.city || null,
 priority: Number(payload.priority || 1) || 1,
 notes: payload.notes || null,
});

const buildOptimisticVisit = (payload = {}, tempId) => ({
 id: tempId,
 schedule_id: null,
 client_request_id: payload.client_request_id,
 city: payload.city,
 planned_date: payload.planned_date,
 priority: payload.priority,
 notes: payload.notes,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
});

export const useSchedules = ({ skipLoad = false } = {}) => {
 const [loading, setLoading] = useState(false);
 const [schedules, setSchedules] = useState([]);
 const [activeSchedule, setActiveSchedule] = useState(null);
 const [holidays, setHolidays] = useState({ by_year: {}, dates: [] });
 const [error, setError] = useState(null);

 const loadSchedules = useCallback(async ({ silent = false } = {}) => {
 if (!silent) setLoading(true);
 setError(null);
 try {
 const data = await fetchSchedules();
 setSchedules(data);
 } catch (err) {
 setError(err.message || "No se pudieron cargar los cronogramas");
 } finally {
 if (!silent) setLoading(false);
 }
 }, []);

 const loadHolidays = useCallback(async ({ silent = false } = {}) => {
 if (!silent) setLoading(true);
 try {
 const data = await fetchScheduleHolidays();
 setHolidays({
 by_year: data?.by_year || {},
 dates: Array.isArray(data?.dates) ? data.dates : [],
 });
 } catch (_error) {
 // No bloquea el modulo si el endpoint no responde.
 } finally {
 if (!silent) setLoading(false);
 }
 }, []);

 const loadScheduleDetail = useCallback(async (id, { silent = false } = {}) => {
 if (!silent) setLoading(true);
 setError(null);
 try {
 const data = await fetchScheduleDetail(id);
 setActiveSchedule(data);
 } catch (err) {
 setError(err.message || "No se pudo cargar el cronograma");
 } finally {
 if (!silent) setLoading(false);
 }
 }, []);

 const create = useCallback(
 async (payload) => {
 setLoading(true);
 setError(null);
 try {
 const data = await createSchedule(payload);
 await loadSchedules({ silent: true });
 setActiveSchedule(data);
 return data;
 } catch (err) {
 setError(err.message || "No se pudo crear el cronograma");
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [loadSchedules],
 );

 const update = useCallback(
 async (id, payload) => {
 setLoading(true);
 setError(null);
 try {
 const data = await updateSchedule(id, payload);
 await loadScheduleDetail(id, { silent: true });
 await loadSchedules({ silent: true });
 return data;
 } catch (err) {
 setError(err.message || "No se pudo actualizar el cronograma");
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [loadScheduleDetail, loadSchedules],
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
 await loadScheduleDetail(id, { silent: true });
 await loadSchedules({ silent: true });
 return data;
 } catch (err) {
 setError(err.message || "No se pudo enviar el cronograma");
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [loadScheduleDetail, loadSchedules],
 );

 const addVisit = useCallback(
 async (id, payload) => {
 setLoading(true);
 setError(null);

 const normalized = normalizeVisitPayload(payload);
 const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
 const previousActive = cloneActive(activeSchedule);

 if (activeSchedule?.id === id) {
 const optimisticVisit = buildOptimisticVisit(normalized, optimisticId);
 setActiveSchedule((current) => {
 if (!current || current.id !== id) return current;
 return {
 ...current,
 visits: [...(Array.isArray(current.visits) ? current.visits : []), optimisticVisit],
 };
 });
 }

 try {
 const data = await addScheduledVisit(id, payload);
 await loadScheduleDetail(id, { silent: true });
 await loadSchedules({ silent: true });
 return data;
 } catch (err) {
 if (previousActive?.id === id) {
 setActiveSchedule(previousActive);
 }
 setError(err.message || "No se pudo agregar la visita");
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [activeSchedule, loadScheduleDetail, loadSchedules],
 );

 const updateVisit = useCallback(
 async (id, visitId, payload) => {
 setLoading(true);
 setError(null);
 try {
 const data = await updateScheduledVisit(id, visitId, payload);
 await loadScheduleDetail(id, { silent: true });
 await loadSchedules({ silent: true });
 return data;
 } catch (err) {
 setError(err.message || "No se pudo actualizar la visita");
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [loadScheduleDetail, loadSchedules],
 );

 const syncWeekCity = useCallback(
 async (id, payload) => {
 setLoading(true);
 setError(null);
 try {
 const data = await syncScheduleWeekCity(id, payload);
 await loadScheduleDetail(id, { silent: true });
 await loadSchedules({ silent: true });
 return data;
 } catch (err) {
 setError(err.message || "No se pudo sincronizar la ciudad de la semana");
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [loadScheduleDetail, loadSchedules],
 );

 const removeVisit = useCallback(
 async (id, visitId) => {
 setLoading(true);
 setError(null);

 const previousActive = cloneActive(activeSchedule);
 if (activeSchedule?.id === id) {
 setActiveSchedule((current) => {
 if (!current || current.id !== id) return current;
 return {
 ...current,
 visits: (current.visits || []).filter((visit) => String(visit.id) !== String(visitId)),
 };
 });
 }

 try {
 await deleteScheduledVisit(id, visitId);
 await loadScheduleDetail(id, { silent: true });
 await loadSchedules({ silent: true });
 } catch (err) {
 if (previousActive?.id === id) {
 setActiveSchedule(previousActive);
 }
 setError(err.message || "No se pudo eliminar la visita");
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [activeSchedule, loadScheduleDetail, loadSchedules],
 );

 useEffect(() => {
 loadHolidays({ silent: true });
 if (skipLoad) return;
 loadSchedules();
 }, [loadHolidays, loadSchedules, skipLoad]);

 useScopedAutoUpdate(
 DATA_UPDATE_SCOPES.SCHEDULES,
 () => {
 loadHolidays({ silent: true });
 if (skipLoad) return;
 loadSchedules({ silent: true });
 if (activeSchedule?.id) {
 loadScheduleDetail(activeSchedule.id, { silent: true });
 }
 },
 [skipLoad, activeSchedule?.id, loadHolidays, loadSchedules, loadScheduleDetail],
 );

 return {
 schedules,
 activeSchedule,
 holidays,
 loading,
 error,
 loadSchedules,
 loadHolidays,
 loadScheduleDetail,
 create,
 update,
 remove,
 submit,
 addVisit,
 updateVisit,
 syncWeekCity,
 removeVisit,
 };
};

export default useSchedules;

